import {
  CardDecision,
  CardGameAction,
  CardGameConfig,
  DeckPolicy,
  GameType,
  PlayingCard,
  RoomState,
  RoomStatus,
} from '@repo/types';
import {
  PileStacks,
  createDeck,
  resolveStarter,
  shuffleDeck,
  toPublicState,
} from './card-engine.service';
import { PrivateStateService } from '../private-state.service';

const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const PILES_KEY = 'piles';
const REMOVED_CARD_ID = 'Q-SPADES';

type DeckBuilder = (policy: DeckPolicy) => PlayingCard[];

export class OldMaidRuntime {
  constructor(
    private readonly privateStateService: PrivateStateService,
    private readonly buildShuffledDeck: DeckBuilder = (policy) => shuffleDeck(createDeck(policy)),
  ) {}

  startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState | null {
    if (playerIds.length < 2) return null;

    const deck = this.buildShuffledDeck(config.deck);
    const removedIndex = deck.findIndex((card) => card.id === REMOVED_CARD_ID);
    if (removedIndex >= 0) deck.splice(removedIndex, 1);

    const hands: Record<string, PlayingCard[]> = {};
    for (const id of playerIds) hands[id] = [];
    deck.forEach((card, index) => hands[playerIds[index % playerIds.length]].push(card));

    const discards: PlayingCard[] = [];
    for (const id of playerIds) discards.push(...this.removeRankPairs(hands[id]));
    this.setPiles(room.code, { stock: [], discards, reserve: [] });

    const chipBalances = room.cardGameChips ?? {};
    room.cardGameChips = chipBalances;
    for (const id of playerIds) chipBalances[id] = chipBalances[id] ?? config.scoring.startingChips;

    const decisions: Record<string, CardDecision> = {};
    for (const id of playerIds) {
      decisions[id] = 'PENDING';
      this.setHand(room.code, id, hands[id]);
    }

    const starterId =
      resolveStarter(config.deal.starterPolicy, {
        playerOrder: playerIds,
        previousStarterId: room.cardGameState?.dealerId,
        previousWinnerId: room.cardGameState?.result?.winnerIds[0],
      }) ?? playerIds[0];
    const startIndex = Math.max(0, playerIds.indexOf(starterId));
    let activePlayerId = playerIds[0];
    for (let offset = 0; offset < playerIds.length; offset += 1) {
      const candidate = playerIds[(startIndex + offset) % playerIds.length];
      if (hands[candidate].length > 0) {
        activePlayerId = candidate;
        break;
      }
    }
    room.cardGameState = toPublicState(
      {
        preset: 'OLD_MAID',
        phase: 'PLAYER_TURNS',
        dealerId: starterId,
        activePlayerId,
        playerOrder: playerIds,
        hands,
        chips: Object.fromEntries(playerIds.map((id) => [id, chipBalances[id]])),
        decisions,
      },
      config.visibility,
    );
    room.status = RoomStatus.PLAYING;

    const holders = playerIds.filter((id) => hands[id].length > 0);
    if (holders.length <= 1) return this.settle(room, config, holders[0] ?? null);
    return room;
  }

  handleAction(
    room: RoomState,
    socketId: string,
    action: CardGameAction,
    config: CardGameConfig,
  ): RoomState | null {
    const state = room.cardGameState;
    if (!state || room.gameType !== GameType.CARD_GAME) return null;
    if (room.status !== RoomStatus.PLAYING || state.phase !== 'PLAYER_TURNS') return null;
    if (action.type !== 'TAKE_CARD') return null;
    if (state.activePlayerId !== socketId) return null;

    const targetId = this.nextHolder(state, socketId);
    if (!targetId) return null;
    const targetHand = this.getHand(room.code, targetId);
    if (!targetHand || targetHand.length === 0) return null;
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= targetHand.length) {
      return null;
    }

    const [taken] = targetHand.splice(action.index, 1);
    this.setHand(room.code, targetId, targetHand);
    state.handCounts[targetId] = targetHand.length;

    const myHand = this.getHand(room.code, socketId) ?? [];
    myHand.push(taken);
    const matched = this.removeRankPairs(myHand);
    if (matched.length > 0) {
      const piles = this.pilesFor(room.code);
      piles.discards.push(...matched);
      this.setPiles(room.code, piles);
    }
    this.setHand(room.code, socketId, myHand);
    state.handCounts[socketId] = myHand.length;
    state.decisions[socketId] = 'TOOK';

    const holders = state.playerOrder.filter((id) => (state.handCounts[id] ?? 0) > 0);
    if (holders.length <= 1) return this.settle(room, config, holders[0] ?? null);

    const nextId = this.nextHolder(state, socketId);
    if (!nextId) return this.settle(room, config, null);
    state.activePlayerId = nextId;
    state.decisions[nextId] = 'PENDING';
    return room;
  }

  private settle(room: RoomState, config: CardGameConfig, loserId: string | null): RoomState {
    const state = room.cardGameState!;
    const chips: Record<string, number> = { ...state.chips };
    const stake = config.scoring.baseStake;
    const winnerIds = state.playerOrder.filter((id) => id !== loserId);
    if (loserId) {
      for (const id of winnerIds) {
        chips[id] += stake;
        chips[loserId] -= stake;
      }
    }
    room.cardGameChips = chips;

    const revealedHands: Record<string, PlayingCard[]> = {};
    for (const id of state.playerOrder) revealedHands[id] = this.getHand(room.code, id) ?? [];

    room.cardGameState = toPublicState(
      {
        preset: 'OLD_MAID',
        phase: 'RESULT',
        dealerId: state.dealerId,
        activePlayerId: null,
        playerOrder: state.playerOrder,
        hands: revealedHands,
        chips,
        decisions: state.decisions,
        result: {
          playerScores: state.handCounts,
          winnerIds,
          placements: loserId ? [...winnerIds, loserId] : [...state.playerOrder],
          revealedHands,
        },
      },
      config.visibility,
    );
    room.status = RoomStatus.RESULT;
    return room;
  }

  private nextHolder(state: NonNullable<RoomState['cardGameState']>, afterId: string): string | null {
    const index = state.playerOrder.indexOf(afterId);
    if (index === -1) return null;
    for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
      const candidate = state.playerOrder[(index + offset) % state.playerOrder.length];
      if (candidate !== afterId && (state.handCounts[candidate] ?? 0) > 0) return candidate;
    }
    return null;
  }

  private removeRankPairs(hand: PlayingCard[]): PlayingCard[] {
    const removed: PlayingCard[] = [];
    let index = 0;
    while (index < hand.length) {
      const partner = hand.findIndex(
        (card, other) => other > index && card.rank === hand[index].rank,
      );
      if (partner === -1) {
        index += 1;
        continue;
      }
      removed.push(hand[partner], hand[index]);
      hand.splice(partner, 1);
      hand.splice(index, 1);
    }
    return removed;
  }

  private setHand(roomCode: string, socketId: string, hand: PlayingCard[]): void {
    this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
      preset: 'OLD_MAID',
      hand,
    });
  }

  private getHand(roomCode: string, socketId: string): PlayingCard[] | undefined {
    return this.privateStateService.get<{ hand: PlayingCard[] }>(roomCode, socketId, PRIVATE_KEY)
      ?.hand;
  }

  private setPiles(roomCode: string, piles: PileStacks): void {
    this.privateStateService.set(roomCode, ENGINE_SOCKET_ID, PILES_KEY, piles);
  }

  private pilesFor(roomCode: string): PileStacks {
    return (
      this.privateStateService.get<PileStacks>(roomCode, ENGINE_SOCKET_ID, PILES_KEY) ?? {
        stock: [],
        discards: [],
        reserve: [],
      }
    );
  }
}
