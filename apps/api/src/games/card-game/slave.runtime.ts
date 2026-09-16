import {
  CardDecision,
  CardGameAction,
  CardGameConfig,
  CardGamePrivateState,
  CardGamePublicState,
  DeckPolicy,
  GameType,
  PlayingCard,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import {
  beatsRankGroup,
  createDeck,
  dealRound,
  isSameRankGroup,
  shuffleDeck,
  toPublicState,
} from './card-engine.service';
import { SLAVE_RANK_ORDER } from './presets/slave.preset';

const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const FIRST_PLAY_KEY = 'slaveFirstPlay';
const LEADER_CARD_ID = '3-CLUBS';
const MAX_GROUP = 3;

type DeckBuilder = (policy: DeckPolicy) => PlayingCard[];

export class SlaveRuntime {
  constructor(
    private readonly privateStateService: PrivateStateService,
    private readonly buildShuffledDeck: DeckBuilder = (policy) => shuffleDeck(createDeck(policy)),
  ) {}

  startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState {
    const dealt = dealRound(
      this.buildShuffledDeck(config.deck),
      playerIds,
      config.deal,
      config.piles.reserveSize,
    );
    if (!dealt.ok || !dealt.hands) return room;
    const hands = dealt.hands;
    const chips: Record<string, number> = room.cardGameChips ?? {};
    room.cardGameChips = chips;
    for (const id of playerIds) chips[id] = chips[id] ?? config.scoring.startingChips;

    const leaderCardDealt = playerIds.some((id) =>
      (hands[id] ?? []).some((card) => card.id === LEADER_CARD_ID),
    );
    const leaderId =
      playerIds.find((id) => (hands[id] ?? []).some((card) => card.id === LEADER_CARD_ID)) ??
      playerIds[0];
    const decisions: Record<string, CardDecision> = {};
    for (const id of playerIds) {
      decisions[id] = 'PENDING';
      this.setHand(room.code, id, hands[id] ?? []);
    }
    this.setFirstPlayed(room.code, !leaderCardDealt);
    room.cardGameState = toPublicState(
      {
        preset: 'SLAVE',
        phase: 'PLAYER_TURNS',
        dealerId: leaderId,
        activePlayerId: leaderId,
        playerOrder: playerIds,
        hands,
        chips: { ...chips },
        decisions,
      },
      config.visibility,
    );
    room.status = RoomStatus.PLAYING;
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
    if (state.activePlayerId !== socketId) return null;
    const hand = this.getHand(room.code, socketId);
    if (!hand) return null;

    if (action.type === 'PLAY') {
      const played = this.resolvePlayedCards(hand, action.cards);
      if (!played || !isSameRankGroup(played, MAX_GROUP)) return null;
      const trick = state.trick;
      if (!trick || trick.playedById === null) {
        if (!this.hasFirstPlayed(room.code) && !played.some((card) => card.id === LEADER_CARD_ID)) {
          return null;
        }
      } else if (!beatsRankGroup(played, trick.cards, SLAVE_RANK_ORDER)) {
        return null;
      }
      const playedIds = new Set(played.map((card) => card.id));
      const remaining = hand.filter((card) => !playedIds.has(card.id));
      this.setHand(room.code, socketId, remaining);
      state.handCounts[socketId] = remaining.length;
      state.decisions[socketId] = 'PLAYED';
      state.trick = {
        leaderId: trick?.leaderId ?? socketId,
        playedById: socketId,
        cards: played,
        passIds: [],
      };
      this.setFirstPlayed(room.code, true);
      if (remaining.length === 0) {
        this.settle(room, config, socketId);
        return room;
      }
      state.activePlayerId = this.nextCardHolder(state, socketId);
      return room;
    }

    if (action.type !== 'PASS') return null;
    const trick = state.trick;
    if (!trick || trick.playedById === null || trick.playedById === socketId) return null;
    if (!trick.passIds.includes(socketId)) trick.passIds.push(socketId);
    state.decisions[socketId] = 'PASSED';
    if (this.everyoneElsePassed(state, trick)) {
      const nextLeader =
        (state.handCounts[trick.playedById] ?? 0) > 0
          ? trick.playedById
          : this.nextCardHolder(state, trick.playedById);
      state.trick = { leaderId: nextLeader, playedById: null, cards: [], passIds: [] };
      state.dealerId = nextLeader;
      state.activePlayerId = nextLeader;
      for (const id of state.playerOrder) state.decisions[id] = 'PENDING';
      return room;
    }
    state.activePlayerId = this.nextActiveAfterPass(state, socketId, trick);
    return room;
  }

  private resolvePlayedCards(hand: PlayingCard[], cardIds: string[]): PlayingCard[] | null {
    if (!cardIds || cardIds.length === 0 || cardIds.length > MAX_GROUP) return null;
    if (new Set(cardIds).size !== cardIds.length) return null;
    const played: PlayingCard[] = [];
    for (const id of cardIds) {
      const card = hand.find((candidate) => candidate.id === id);
      if (!card) return null;
      played.push(card);
    }
    return played;
  }

  private nextCardHolder(state: CardGamePublicState, afterId: string): string {
    const order = state.playerOrder;
    const start = order.indexOf(afterId);
    for (let offset = 1; offset <= order.length; offset += 1) {
      const candidate = order[(start + offset) % order.length];
      if ((state.handCounts[candidate] ?? 0) > 0) return candidate;
    }
    return afterId;
  }

  private nextActiveAfterPass(
    state: CardGamePublicState,
    afterId: string,
    trick: NonNullable<CardGamePublicState['trick']>,
  ): string {
    const order = state.playerOrder;
    const start = order.indexOf(afterId);
    for (let offset = 1; offset <= order.length; offset += 1) {
      const candidate = order[(start + offset) % order.length];
      if (candidate === trick.playedById) continue;
      if (trick.passIds.includes(candidate)) continue;
      if ((state.handCounts[candidate] ?? 0) > 0) return candidate;
    }
    return trick.playedById ?? afterId;
  }

  private everyoneElsePassed(
    state: CardGamePublicState,
    trick: NonNullable<CardGamePublicState['trick']>,
  ): boolean {
    return state.playerOrder.every((id) => {
      if (id === trick.playedById) return true;
      if ((state.handCounts[id] ?? 0) <= 0) return true;
      return trick.passIds.includes(id);
    });
  }

  private settle(room: RoomState, config: CardGameConfig, winnerId: string): void {
    const state = room.cardGameState!;
    const chips: Record<string, number> = { ...state.chips };
    const stake = config.scoring.baseStake;
    for (const id of state.playerOrder) {
      if (id === winnerId) continue;
      chips[id] = (chips[id] ?? config.scoring.startingChips) - stake;
      chips[winnerId] = (chips[winnerId] ?? config.scoring.startingChips) + stake;
    }
    room.cardGameChips = { ...room.cardGameChips, ...chips };
    const revealedHands: Record<string, PlayingCard[]> = {};
    for (const id of state.playerOrder) revealedHands[id] = this.getHand(room.code, id) ?? [];
    room.cardGameState = toPublicState(
      {
        preset: 'SLAVE',
        phase: 'RESULT',
        dealerId: state.dealerId,
        activePlayerId: null,
        playerOrder: state.playerOrder,
        hands: revealedHands,
        chips,
        decisions: state.decisions,
        result: {
          playerScores: state.handCounts,
          placements: [winnerId, ...state.playerOrder.filter((id) => id !== winnerId)],
          winnerIds: [winnerId],
          revealedHands,
        },
      },
      config.visibility,
    );
    room.status = RoomStatus.RESULT;
  }

  private setHand(roomCode: string, socketId: string, hand: PlayingCard[]): void {
    this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
      preset: 'SLAVE',
      hand,
    } satisfies CardGamePrivateState);
  }

  private getHand(roomCode: string, socketId: string): PlayingCard[] | undefined {
    return this.privateStateService.get<CardGamePrivateState>(roomCode, socketId, PRIVATE_KEY)
      ?.hand;
  }

  private setFirstPlayed(roomCode: string, played: boolean): void {
    this.privateStateService.set(roomCode, ENGINE_SOCKET_ID, FIRST_PLAY_KEY, played);
  }

  private hasFirstPlayed(roomCode: string): boolean {
    return (
      this.privateStateService.get<boolean>(roomCode, ENGINE_SOCKET_ID, FIRST_PLAY_KEY) === true
    );
  }
}
