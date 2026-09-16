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
import {
  PileStacks,
  createDeck,
  dealRound,
  resolveStarter,
  shuffleDeck,
  toPublicState,
} from './card-engine.service';
import { PrivateStateService } from '../private-state.service';
import { SAM_SIP_CARD_VALUES } from './presets/sam-sip.preset';

const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const PILES_KEY = 'piles';

type DeckBuilder = (policy: DeckPolicy) => PlayingCard[];

export class SamSipRuntime {
  constructor(
    private readonly privateStateService: PrivateStateService,
    private readonly buildShuffledDeck: DeckBuilder = (policy) => shuffleDeck(createDeck(policy)),
  ) {}

  startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState | null {
    const dealt = dealRound(
      this.buildShuffledDeck(config.deck),
      playerIds,
      config.deal,
      config.piles.reserveSize,
    );
    if (!dealt.ok || !dealt.hands) return null;
    const hands = dealt.hands;
    const stock = [...(dealt.stock ?? [])];
    const flipped = stock.pop();
    const piles: PileStacks = {
      stock,
      discards: flipped ? [flipped] : [],
      reserve: dealt.reserve ?? [],
    };
    this.setPiles(room.code, piles);

    const chipBalances = room.cardGameChips ?? {};
    room.cardGameChips = chipBalances;
    const chips: Record<string, number> = {};
    const decisions: Record<string, CardDecision> = {};
    for (const id of playerIds) {
      chipBalances[id] = chipBalances[id] ?? config.scoring.startingChips;
      chips[id] = chipBalances[id];
      decisions[id] = 'PENDING';
      this.setHand(room.code, id, hands[id]);
    }

    const starterId =
      resolveStarter(config.deal.starterPolicy, {
        playerOrder: playerIds,
        previousStarterId: room.cardGameState?.dealerId,
        previousWinnerId: room.cardGameState?.result?.winnerIds[0],
      }) ?? playerIds[0];
    room.cardGameState = toPublicState(
      {
        preset: 'SAM_SIP',
        phase: 'PLAYER_TURNS',
        dealerId: starterId,
        activePlayerId: starterId,
        playerOrder: playerIds,
        hands,
        chips,
        decisions,
      },
      config.visibility,
    );
    room.cardGameState.discardTop = piles.discards.at(-1) ?? null;
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
    if (action.type !== 'DRAW' && action.type !== 'CLAIM' && action.type !== 'DISCARD') {
      return null;
    }
    if (!config.actions.allowed.includes(action.type)) return null;
    const hand = this.getHand(room.code, socketId);
    if (!hand) return null;
    const piles = this.pilesFor(room.code);

    if (action.type === 'DRAW' || action.type === 'CLAIM') {
      if (socketId !== state.activePlayerId || state.decisions[socketId] !== 'PENDING') return null;
      let acquired: PlayingCard | undefined;
      if (action.type === 'DRAW') {
        acquired = piles.stock.pop();
        if (!acquired) return this.endRoundByExhaustion(room, config);
      } else {
        const top = piles.discards.at(-1);
        if (!top || !this.canClaim(top, hand)) return null;
        piles.discards.pop();
        acquired = top;
      }
      hand.push(acquired);
      return this.finishAcquire(
        room,
        socketId,
        hand,
        piles,
        config,
        action.type === 'DRAW' ? 'DRAWN' : 'CLAIMED',
      );
    }

    if (action.type === 'DISCARD') {
      if (socketId !== state.activePlayerId) return null;
      const decision = state.decisions[socketId];
      if (decision !== 'DRAWN' && decision !== 'CLAIMED') return null;
      const index = hand.findIndex((card) => card.id === action.cardId);
      if (index === -1) return null;
      const [discarded] = hand.splice(index, 1);
      piles.discards.push(discarded);
      this.setHand(room.code, socketId, hand);
      this.setPiles(room.code, piles);
      state.handCounts[socketId] = hand.length;
      state.decisions[socketId] = 'DISCARDED';
      state.discardTop = discarded;
      if (hand.length === 0) return this.settle(room, config, socketId);
      const nextId = this.nextPlayer(state, socketId);
      state.activePlayerId = nextId;
      state.decisions[nextId] = 'PENDING';
      return room;
    }

    return null;
  }

  private finishAcquire(
    room: RoomState,
    socketId: string,
    hand: PlayingCard[],
    piles: PileStacks,
    config: CardGameConfig,
    decision: 'DRAWN' | 'CLAIMED',
  ): RoomState {
    const state = room.cardGameState!;
    const removed = this.removeSumTenPairs(hand);
    if (removed.length > 0) piles.discards.push(...removed);
    this.setHand(room.code, socketId, hand);
    this.setPiles(room.code, piles);
    state.handCounts[socketId] = hand.length;
    state.discardTop = piles.discards.at(-1) ?? null;
    if (hand.length === 0) return this.settle(room, config, socketId);
    state.decisions[socketId] = decision;
    return room;
  }

  private endRoundByExhaustion(room: RoomState, config: CardGameConfig): RoomState {
    const state = room.cardGameState!;
    const counts = state.playerOrder.map((id) => state.handCounts[id] ?? 0);
    const minimum = Math.min(...counts);
    const fewest = state.playerOrder.filter((id) => (state.handCounts[id] ?? 0) === minimum);
    return this.settle(room, config, fewest.length === 1 ? fewest[0] : undefined);
  }

  private settle(room: RoomState, config: CardGameConfig, winnerId?: string): RoomState {
    const state = room.cardGameState!;
    const chips: Record<string, number> = { ...state.chips };
    const stake = config.scoring.baseStake;
    if (winnerId) {
      for (const id of state.playerOrder) {
        if (id === winnerId) continue;
        chips[id] -= stake;
        chips[winnerId] += stake;
      }
    }
    room.cardGameChips = chips;

    const revealedHands: Record<string, PlayingCard[]> = {};
    for (const id of state.playerOrder) revealedHands[id] = this.getHand(room.code, id) ?? [];
    const others = state.playerOrder.filter((id) => id !== winnerId);

    room.cardGameState = toPublicState(
      {
        preset: 'SAM_SIP',
        phase: 'RESULT',
        dealerId: state.dealerId,
        activePlayerId: null,
        playerOrder: state.playerOrder,
        hands: revealedHands,
        chips,
        decisions: state.decisions,
        result: {
          playerScores: state.handCounts,
          winnerIds: winnerId ? [winnerId] : [],
          placements: winnerId ? [winnerId, ...others] : state.playerOrder,
          revealedHands,
        },
      },
      config.visibility,
    );
    room.cardGameState.discardTop = state.discardTop ?? null;
    room.status = RoomStatus.RESULT;
    return room;
  }

  private canClaim(card: PlayingCard, hand: PlayingCard[]): boolean {
    const value = SAM_SIP_CARD_VALUES[card.rank];
    return hand.some((candidate) => SAM_SIP_CARD_VALUES[candidate.rank] + value === 10);
  }

  private removeSumTenPairs(hand: PlayingCard[]): PlayingCard[] {
    const removed: PlayingCard[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < hand.length; i += 1) {
        for (let j = i + 1; j < hand.length; j += 1) {
          if (SAM_SIP_CARD_VALUES[hand[i].rank] + SAM_SIP_CARD_VALUES[hand[j].rank] === 10) {
            const [second] = hand.splice(j, 1);
            const [first] = hand.splice(i, 1);
            removed.push(first, second);
            changed = true;
            break outer;
          }
        }
      }
    }
    return removed;
  }

  private nextPlayer(state: CardGamePublicState, afterId: string): string {
    const order = state.playerOrder;
    const start = order.indexOf(afterId);
    for (let step = 1; step <= order.length; step += 1) {
      const candidate = order[(start + step) % order.length];
      if ((state.handCounts[candidate] ?? 0) > 0) return candidate;
    }
    return order[(start + 1) % order.length];
  }

  private setHand(roomCode: string, socketId: string, hand: PlayingCard[]): void {
    this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
      preset: 'SAM_SIP',
      hand,
    } satisfies CardGamePrivateState);
  }

  private getHand(roomCode: string, socketId: string): PlayingCard[] | undefined {
    return this.privateStateService.get<CardGamePrivateState>(roomCode, socketId, PRIVATE_KEY)
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
