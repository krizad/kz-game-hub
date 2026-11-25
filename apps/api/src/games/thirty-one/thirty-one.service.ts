import { Injectable } from '@nestjs/common';
import {
  GameType,
  PlayingCard,
  RoomState,
  RoomStatus,
  THIRTY_ONE_MAX_PLAYERS,
  THIRTY_ONE_MIN_PLAYERS,
  THIRTY_ONE_STARTING_LIVES,
  ThirtyOneAction,
  ThirtyOneHandEvaluation,
  ThirtyOnePrivateState,
  ThirtyOnePublicState,
  ThirtyOneSeat,
  ThirtyOneShowdownReason,
} from '@repo/types';
import { createDeck, shuffleDeck } from '../poker/poker-engine';
import { PrivateStateService } from '../private-state.service';

const PRIVATE_KEY = 'thirtyOne';
const ENGINE_SOCKET_ID = '__thirty-one-engine__';
const DECK_KEY = 'deck';

interface EngineDeckState {
  drawPile: PlayingCard[];
  discardPile: PlayingCard[];
}

export function cardPointValue(rank: PlayingCard['rank']): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return Number(rank);
}

/**
 * Evaluates a 3-card Thirty-One hand:
 * - 3 of a kind (same rank, different suits) = 30.5 (beats everything except 31)
 * - Otherwise, max sum of cards sharing the same suit (A=11, K/Q/J/10=10, 2-9=face)
 * - 31 = Blitz
 */
export function evaluateThirtyOneHand(cards: PlayingCard[]): ThirtyOneHandEvaluation {
  if (cards.length !== 3) {
    return evaluateBestSubset(cards, null);
  }
  const [a, b, c] = cards;
  if (a.rank === b.rank && b.rank === c.rank) {
    return {
      score: 30.5,
      bestSuit: null,
      isThreeOfAKind: true,
      isBlitz: false,
    };
  }

  const suitSums: Record<PlayingCard['suit'], number> = {
    CLUBS: 0,
    DIAMONDS: 0,
    HEARTS: 0,
    SPADES: 0,
  };
  for (const card of cards) {
    suitSums[card.suit] += cardPointValue(card.rank);
  }

  let bestSuit: PlayingCard['suit'] = cards[0].suit;
  let bestScore = -1;
  for (const suit of ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const) {
    if (suitSums[suit] > bestScore) {
      bestScore = suitSums[suit];
      bestSuit = suit;
    }
  }

  return {
    score: bestScore,
    bestSuit,
    isThreeOfAKind: false,
    isBlitz: bestScore === 31,
  };
}

function evaluateBestSubset(
  cards: PlayingCard[],
  forbiddenDiscardCardId: string | null,
): ThirtyOneHandEvaluation {
  if (cards.length < 3) {
    return { score: 0, bestSuit: null, isThreeOfAKind: false, isBlitz: false };
  }
  if (cards.length === 3) {
    return evaluateThirtyOneHand(cards);
  }
  let best: ThirtyOneHandEvaluation | null = null;
  for (let dropIdx = 0; dropIdx < cards.length; dropIdx++) {
    if (forbiddenDiscardCardId && cards[dropIdx].id === forbiddenDiscardCardId) continue;
    const subset = cards.filter((_, idx) => idx !== dropIdx);
    const evaluation = evaluateThirtyOneHand(subset);
    if (!best || evaluation.score > best.score) {
      best = evaluation;
    }
  }
  return best ?? evaluateThirtyOneHand(cards.slice(0, 3));
}

@Injectable()
export class ThirtyOneService {
  constructor(private readonly privateStateService: PrivateStateService) {}

  /* ---------------------------------------------------------------- */
  /* Match lifecycle                                                   */
  /* ---------------------------------------------------------------- */

  startMatch(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.THIRTY_ONE || room.roomHostId !== requesterId) return null;
    if (room.status !== RoomStatus.LOBBY && room.status !== RoomStatus.RESULT) return null;

    const players = room.players.filter((p) => !p.isViewer && p.connected !== false);
    if (players.length < THIRTY_ONE_MIN_PLAYERS || players.length > THIRTY_ONE_MAX_PLAYERS) {
      return null;
    }

    for (const p of room.players) {
      p.score = 0;
    }

    const seats: Record<string, ThirtyOneSeat> = {};
    for (const player of players) {
      seats[player.socketId] = {
        lives: THIRTY_ONE_STARTING_LIVES,
        onWelfare: false,
        status: 'ACTIVE',
      };
    }

    room.thirtyOneState = {
      phase: 'PLAYING',
      roundNumber: 0,
      playerOrder: players.map((p) => p.socketId),
      seats,
      dealerId: null,
      activePlayerId: null,
      turnSubPhase: 'CHOOSE_ACTION',
      turnDeadline: null,
      knockerId: null,
      finalTurnQueue: [],
      drawPileCount: 0,
      discardPileCount: 0,
      topDiscard: null,
      winnerId: null,
    };

    room.status = RoomStatus.PLAYING;
    this.clearAllPrivate(room);
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
    this.dealRound(room);
    return room;
  }

  resetMatch(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.THIRTY_ONE || room.roomHostId !== requesterId) return null;
    room.thirtyOneState = undefined;
    this.clearAllPrivate(room);
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
    room.status = RoomStatus.LOBBY;
    return room;
  }

  /* ---------------------------------------------------------------- */
  /* Action routing                                                    */
  /* ---------------------------------------------------------------- */

  handleAction(room: RoomState, socketId: string, action: ThirtyOneAction): RoomState | null {
    const state = room.thirtyOneState;
    if (!state || room.gameType !== GameType.THIRTY_ONE) return null;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return null;

    if (action.type === 'END_MATCH') {
      if (room.roomHostId !== socketId) return null;
      this.endMatch(room);
      return room;
    }

    if (action.type === 'NEXT_ROUND') {
      if (room.roomHostId !== socketId) return null;
      if (state.phase !== 'ROUND_RESULT') return null;
      this.dealRound(room);
      return room;
    }

    if (state.phase !== 'PLAYING' || state.activePlayerId !== socketId) return null;
    const seat = state.seats[socketId];
    if (!seat || seat.status !== 'ACTIVE') return null;

    switch (action.type) {
      case 'DRAW_STOCK':
        return this.handleDrawStock(room, socketId) ? room : null;
      case 'DRAW_DISCARD':
        return this.handleDrawDiscard(room, socketId) ? room : null;
      case 'DISCARD':
        return this.handleDiscard(room, socketId, action.cardId) ? room : null;
      case 'KNOCK':
        return this.handleKnock(room, socketId) ? room : null;
      default:
        return null;
    }
  }

  handleTurnTimeout(room: RoomState, expectedDeadline: number): RoomState | null {
    const state = room.thirtyOneState;
    if (!state || room.status !== RoomStatus.PLAYING || state.phase !== 'PLAYING') return null;
    if (!state.turnDeadline || state.turnDeadline !== expectedDeadline) return null;
    if (!state.activePlayerId) return null;

    const actorId = state.activePlayerId;

    if (state.turnSubPhase === 'CHOOSE_ACTION') {
      if (!this.handleDrawStock(room, actorId)) return null;
    }

    // Re-read private hand and discard the card that yields the highest valid 3-card score
    const priv = this.getPrivate(room, actorId);
    if (!priv || priv.hand.length === 0) return null;

    const chosenCardId = this.pickBestValidDiscard(priv.hand, priv.forbiddenDiscardCardId ?? null);
    if (!chosenCardId) return null;

    this.handleDiscard(room, actorId, chosenCardId, true);
    return room;
  }

  /* ---------------------------------------------------------------- */
  /* Reconnection / removal                                            */
  /* ---------------------------------------------------------------- */

  remapSocketId(state: ThirtyOnePublicState, oldSocketId: string, newSocketId: string): void {
    if (state.dealerId === oldSocketId) state.dealerId = newSocketId;
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    if (state.knockerId === oldSocketId) state.knockerId = newSocketId;
    if (state.winnerId === oldSocketId) state.winnerId = newSocketId;
    state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    state.finalTurnQueue = state.finalTurnQueue.map((id) =>
      id === oldSocketId ? newSocketId : id,
    );
    state.seats = remapRecord(state.seats, oldSocketId, newSocketId);

    if (state.lastAction && state.lastAction.playerId === oldSocketId) {
      state.lastAction = { ...state.lastAction, playerId: newSocketId };
    }

    if (state.showdown) {
      const sd = state.showdown;
      if (sd.knockerId === oldSocketId) sd.knockerId = newSocketId;
      sd.winnerIds = sd.winnerIds.map((id) => (id === oldSocketId ? newSocketId : id));
      sd.loserIds = sd.loserIds.map((id) => (id === oldSocketId ? newSocketId : id));
      sd.welfareEnteredIds = sd.welfareEnteredIds.map((id) =>
        id === oldSocketId ? newSocketId : id,
      );
      sd.eliminatedIds = sd.eliminatedIds.map((id) => (id === oldSocketId ? newSocketId : id));
      sd.revealedHands = remapRecord(sd.revealedHands, oldSocketId, newSocketId);
      sd.handScores = remapRecord(sd.handScores, oldSocketId, newSocketId);
      sd.lifeChanges = remapRecord(sd.lifeChanges, oldSocketId, newSocketId);
    }
  }

  handlePlayerRemoved(room: RoomState, socketId: string): void {
    const state = room.thirtyOneState;
    if (!state || state.phase === 'MATCH_OVER') return;
    const seat = state.seats[socketId];
    if (!seat || seat.status === 'ELIMINATED') return;

    seat.status = 'ELIMINATED';
    seat.lives = 0;
    seat.onWelfare = false;
    seat.forfeited = true;
    seat.eliminatedRound = state.roundNumber;
    seat.eliminatedOrder = this.nextEliminationOrder(state);

    // Return player's extra card to discard pile if they were mid-turn with 4 cards
    const priv = this.getPrivate(room, socketId);
    const deck = this.getDeck(room);
    if (priv && deck && priv.hand.length > 0) {
      for (const card of priv.hand) {
        deck.discardPile.push(card);
      }
      this.setDeck(room, deck);
      state.discardPileCount = deck.discardPile.length;
      state.topDiscard = deck.discardPile[deck.discardPile.length - 1] ?? null;
    }
    this.deletePrivate(room, socketId);

    state.finalTurnQueue = state.finalTurnQueue.filter((id) => id !== socketId);

    const aliveIds = this.getAlivePlayerIds(state);
    if (aliveIds.length <= 1) {
      this.finishMatch(room, aliveIds[0] ?? null);
      return;
    }

    if (state.phase === 'PLAYING' && state.activePlayerId === socketId) {
      if (state.knockerId !== null) {
        if (state.finalTurnQueue.length === 0) {
          this.resolveShowdown(room, 'KNOCK');
        } else {
          state.turnSubPhase = 'CHOOSE_ACTION';
          this.setActive(room, state.finalTurnQueue[0]);
        }
      } else {
        const nextId = this.nextAlivePlayer(state, socketId);
        state.turnSubPhase = 'CHOOSE_ACTION';
        this.setActive(room, nextId);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Round flow                                                        */
  /* ---------------------------------------------------------------- */

  private dealRound(room: RoomState): void {
    const state = room.thirtyOneState!;
    const aliveIds = this.getAlivePlayerIds(state);
    if (aliveIds.length <= 1) {
      this.finishMatch(room, aliveIds[0] ?? null);
      return;
    }

    state.roundNumber += 1;
    state.dealerId = state.dealerId ? this.nextAlivePlayer(state, state.dealerId) : aliveIds[0];

    const firstPlayerId = this.nextAlivePlayer(state, state.dealerId);
    const shuffled = shuffleDeck(createDeck());

    // Clear previous private hands
    this.clearAllPrivate(room);

    // Deal 3 cards to each active player
    const hands = new Map<string, PlayingCard[]>();
    for (const id of aliveIds) {
      hands.set(id, []);
    }
    for (let c = 0; c < 3; c++) {
      for (const id of aliveIds) {
        const card = shuffled.pop()!;
        hands.get(id)!.push(card);
      }
    }

    const firstDiscard = shuffled.pop()!;
    const deck: EngineDeckState = {
      drawPile: shuffled,
      discardPile: [firstDiscard],
    };
    this.setDeck(room, deck);

    let hasBlitzOnDeal = false;
    for (const id of aliveIds) {
      const hand = hands.get(id)!;
      const evaluation = evaluateThirtyOneHand(hand);
      if (evaluation.isBlitz) {
        hasBlitzOnDeal = true;
      }
      this.setPrivate(room, id, {
        hand,
        evaluation,
        forbiddenDiscardCardId: null,
      });
    }

    state.knockerId = null;
    state.finalTurnQueue = [];
    state.showdown = undefined;
    state.lastAction = undefined;
    state.reshuffledThisTurn = false;
    state.drawPileCount = deck.drawPile.length;
    state.discardPileCount = deck.discardPile.length;
    state.topDiscard = firstDiscard;
    state.turnSubPhase = 'CHOOSE_ACTION';

    if (hasBlitzOnDeal) {
      this.resolveShowdown(room, 'BLITZ');
      return;
    }

    state.phase = 'PLAYING';
    this.setActive(room, firstPlayerId);
  }

  private handleDrawStock(room: RoomState, socketId: string): boolean {
    const state = room.thirtyOneState!;
    const deck = this.getDeck(room);
    const priv = this.getPrivate(room, socketId);
    if (!deck || !priv) return false;

    let reshuffled = false;
    if (deck.drawPile.length === 0) {
      reshuffled = this.reshuffleDiscardIntoDraw(deck);
      if (deck.drawPile.length === 0) return false;
    }

    const drawn = deck.drawPile.pop()!;
    const hand = [...priv.hand, drawn];

    // If draw pile just ran empty, immediately replenish from discard pile (keeping top discard)
    if (deck.drawPile.length === 0 && deck.discardPile.length > 1) {
      if (this.reshuffleDiscardIntoDraw(deck)) {
        reshuffled = true;
      }
    }

    this.setDeck(room, deck);
    this.setPrivate(room, socketId, {
      hand,
      evaluation: evaluateBestSubset(hand, null),
      forbiddenDiscardCardId: null,
    });

    state.drawPileCount = deck.drawPile.length;
    state.discardPileCount = deck.discardPile.length;
    state.topDiscard = deck.discardPile[deck.discardPile.length - 1] ?? null;
    state.reshuffledThisTurn = reshuffled;
    state.turnSubPhase = 'DISCARD';
    state.lastAction = {
      playerId: socketId,
      type: 'DRAW_STOCK',
      timestamp: Date.now(),
    };
    return true;
  }

  private handleDrawDiscard(room: RoomState, socketId: string): boolean {
    const state = room.thirtyOneState!;
    const deck = this.getDeck(room);
    const priv = this.getPrivate(room, socketId);
    if (!deck || !priv || deck.discardPile.length === 0) return false;

    const drawn = deck.discardPile.pop()!;
    const hand = [...priv.hand, drawn];

    this.setDeck(room, deck);
    this.setPrivate(room, socketId, {
      hand,
      evaluation: evaluateBestSubset(hand, drawn.id),
      forbiddenDiscardCardId: drawn.id,
    });

    state.drawPileCount = deck.drawPile.length;
    state.discardPileCount = deck.discardPile.length;
    state.topDiscard = deck.discardPile[deck.discardPile.length - 1] ?? null;
    state.reshuffledThisTurn = false;
    state.turnSubPhase = 'DISCARD';
    state.lastAction = {
      playerId: socketId,
      type: 'DRAW_DISCARD',
      card: drawn,
      timestamp: Date.now(),
    };
    return true;
  }

  private handleDiscard(
    room: RoomState,
    socketId: string,
    cardId: string,
    isAutoTurn = false,
  ): boolean {
    const state = room.thirtyOneState!;
    if (state.turnSubPhase !== 'DISCARD') return false;
    if (typeof cardId !== 'string' || !cardId) return false;

    const deck = this.getDeck(room);
    const priv = this.getPrivate(room, socketId);
    if (!deck || !priv) return false;

    const cardIdx = priv.hand.findIndex((c) => c.id === cardId);
    if (cardIdx === -1) return false;

    // Anti-stall rule: cannot immediately discard the exact card just picked from Discard Pile
    if (priv.forbiddenDiscardCardId && priv.forbiddenDiscardCardId === cardId) {
      return false;
    }

    const discarded = priv.hand[cardIdx];
    const hand = priv.hand.filter((_, idx) => idx !== cardIdx);
    deck.discardPile.push(discarded);

    let reshuffled = false;
    if (deck.drawPile.length === 0 && deck.discardPile.length > 1) {
      reshuffled = this.reshuffleDiscardIntoDraw(deck);
    }

    const evaluation = evaluateThirtyOneHand(hand);
    this.setDeck(room, deck);
    this.setPrivate(room, socketId, {
      hand,
      evaluation,
      forbiddenDiscardCardId: null,
    });

    state.drawPileCount = deck.drawPile.length;
    state.discardPileCount = deck.discardPile.length;
    state.topDiscard = deck.discardPile[deck.discardPile.length - 1] ?? null;
    if (reshuffled) state.reshuffledThisTurn = true;
    state.lastAction = {
      playerId: socketId,
      type: isAutoTurn ? 'AUTO_TURN' : 'DISCARD',
      card: discarded,
      timestamp: Date.now(),
    };

    // Immediate 31 (Blitz) ends the round right away!
    if (evaluation.isBlitz) {
      this.resolveShowdown(room, 'BLITZ');
      return true;
    }

    if (state.knockerId !== null) {
      // Remove current player from final turn queue
      if (state.finalTurnQueue[0] === socketId) {
        state.finalTurnQueue.shift();
      } else {
        state.finalTurnQueue = state.finalTurnQueue.filter((id) => id !== socketId);
      }

      if (state.finalTurnQueue.length === 0) {
        this.resolveShowdown(room, 'KNOCK');
        return true;
      }

      state.turnSubPhase = 'CHOOSE_ACTION';
      this.setActive(room, state.finalTurnQueue[0]);
      return true;
    }

    const nextId = this.nextAlivePlayer(state, socketId);
    state.turnSubPhase = 'CHOOSE_ACTION';
    this.setActive(room, nextId);
    return true;
  }

  private handleKnock(room: RoomState, socketId: string): boolean {
    const state = room.thirtyOneState!;
    if (state.turnSubPhase !== 'CHOOSE_ACTION') return false;
    if (state.knockerId !== null) return false;

    const queue = this.buildFinalTurnQueue(state, socketId);
    state.knockerId = socketId;
    state.finalTurnQueue = queue;
    state.reshuffledThisTurn = false;
    state.lastAction = {
      playerId: socketId,
      type: 'KNOCK',
      timestamp: Date.now(),
    };

    if (queue.length === 0) {
      this.resolveShowdown(room, 'KNOCK');
      return true;
    }

    state.turnSubPhase = 'CHOOSE_ACTION';
    this.setActive(room, queue[0]);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Showdown & life deduction                                         */
  /* ---------------------------------------------------------------- */

  private resolveShowdown(room: RoomState, reason: ThirtyOneShowdownReason): void {
    const state = room.thirtyOneState!;
    const aliveIds = this.getAlivePlayerIds(state);

    const revealedHands: Record<string, PlayingCard[]> = {};
    const handScores: Record<string, ThirtyOneHandEvaluation> = {};

    for (const id of aliveIds) {
      const priv = this.getPrivate(room, id);
      const hand = priv?.hand ?? [];
      revealedHands[id] = hand;
      handScores[id] = evaluateThirtyOneHand(hand);
    }

    let winnerIds: string[] = [];
    let loserIds: string[] = [];
    let knockPenalty = false;
    const lifeChanges: Record<string, number> = {};
    for (const id of aliveIds) lifeChanges[id] = 0;

    if (reason === 'BLITZ') {
      winnerIds = aliveIds.filter((id) => handScores[id].isBlitz);
      loserIds = aliveIds.filter((id) => !handScores[id].isBlitz);
      for (const id of loserIds) {
        lifeChanges[id] = -1;
      }
    } else {
      const minScore = Math.min(...aliveIds.map((id) => handScores[id].score));
      const maxScore = Math.max(...aliveIds.map((id) => handScores[id].score));
      const lowestIds = aliveIds.filter((id) => handScores[id].score === minScore);
      winnerIds = aliveIds.filter((id) => handScores[id].score === maxScore);

      if (state.knockerId && lowestIds.includes(state.knockerId)) {
        // Knock penalty: knocker was lowest or tied for lowest -> loses 2 lives, others lose 0
        knockPenalty = true;
        loserIds = [state.knockerId];
        lifeChanges[state.knockerId] = -2;
      } else {
        // Lowest scorer(s) lose 1 life each
        loserIds = lowestIds;
        for (const id of lowestIds) {
          lifeChanges[id] = -1;
        }
      }
    }

    const welfareEnteredIds: string[] = [];
    const eliminatedIds: string[] = [];

    for (const id of loserIds) {
      const penalty = Math.abs(lifeChanges[id]);
      const seat = state.seats[id];
      if (!seat || penalty === 0) continue;

      if (seat.onWelfare) {
        // Already at 0 lives (On the Welfare) -> eliminated!
        seat.lives = 0;
        seat.onWelfare = false;
        seat.status = 'ELIMINATED';
        seat.eliminatedRound = state.roundNumber;
        seat.eliminatedOrder = this.nextEliminationOrder(state);
        eliminatedIds.push(id);
      } else {
        const remaining = seat.lives - penalty;
        if (remaining < 0) {
          seat.lives = 0;
          seat.onWelfare = false;
          seat.status = 'ELIMINATED';
          seat.eliminatedRound = state.roundNumber;
          seat.eliminatedOrder = this.nextEliminationOrder(state);
          eliminatedIds.push(id);
        } else if (remaining === 0) {
          seat.lives = 0;
          seat.onWelfare = true;
          welfareEnteredIds.push(id);
        } else {
          seat.lives = remaining;
        }
      }
    }

    state.showdown = {
      roundNumber: state.roundNumber,
      reason,
      knockerId: state.knockerId,
      knockPenalty,
      winnerIds,
      loserIds,
      welfareEnteredIds,
      eliminatedIds,
      revealedHands,
      handScores,
      lifeChanges,
    };

    state.activePlayerId = null;
    state.turnDeadline = null;
    state.finalTurnQueue = [];

    const remainingAlive = this.getAlivePlayerIds(state);
    if (remainingAlive.length <= 1) {
      this.finishMatch(room, remainingAlive[0] ?? null);
      return;
    }

    state.phase = 'ROUND_RESULT';
  }

  private endMatch(room: RoomState): void {
    const state = room.thirtyOneState!;
    const aliveIds = this.getAlivePlayerIds(state);
    let topId: string | null = null;
    if (aliveIds.length > 0) {
      topId = [...aliveIds].sort((a, b) => {
        const sa = state.seats[a];
        const sb = state.seats[b];
        if (sb.lives !== sa.lives) return sb.lives - sa.lives;
        return Number(sb.onWelfare) - Number(sa.onWelfare);
      })[0];
    }
    this.finishMatch(room, topId);
  }

  private finishMatch(room: RoomState, winnerId: string | null): void {
    const state = room.thirtyOneState!;
    state.phase = 'MATCH_OVER';
    state.winnerId = winnerId;
    state.activePlayerId = null;
    state.turnDeadline = null;
    state.finalTurnQueue = [];
    room.status = RoomStatus.RESULT;

    // Assign final scores on room.players for leaderboard ranking
    const totalPlayers = state.playerOrder.length;
    for (const player of room.players) {
      if (player.isViewer) continue;
      const seat = state.seats[player.socketId];
      if (!seat) continue;
      if (player.socketId === winnerId) {
        player.score = totalPlayers * 100 + seat.lives * 10 + (seat.onWelfare ? 5 : 0);
      } else if (seat.status === 'ACTIVE') {
        player.score = (totalPlayers - 1) * 50 + seat.lives * 10;
      } else {
        player.score = (seat.eliminatedOrder ?? 1) * 10;
      }
    }

    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  private reshuffleDiscardIntoDraw(deck: EngineDeckState): boolean {
    if (deck.discardPile.length <= 1) return false;
    const topCard = deck.discardPile.pop()!;
    const recycled = shuffleDeck(deck.discardPile);
    deck.drawPile = [...recycled, ...deck.drawPile];
    deck.discardPile = [topCard];
    return true;
  }

  private pickBestValidDiscard(hand: PlayingCard[], forbiddenCardId: string | null): string | null {
    let bestCardId: string | null = null;
    let bestScore = -1;

    for (let i = 0; i < hand.length; i++) {
      const candidate = hand[i];
      if (forbiddenCardId && candidate.id === forbiddenCardId) continue;
      const remaining = hand.filter((_, idx) => idx !== i);
      const evaluation = evaluateThirtyOneHand(remaining);
      if (evaluation.score > bestScore) {
        bestScore = evaluation.score;
        bestCardId = candidate.id;
      }
    }
    return bestCardId;
  }

  private setActive(room: RoomState, playerId: string | null): void {
    const state = room.thirtyOneState!;
    state.activePlayerId = playerId;
    const seconds = room.config.thirtyOneTurnSeconds ?? 0;
    state.turnDeadline = playerId && seconds > 0 ? Date.now() + seconds * 1000 : null;
  }

  private getAlivePlayerIds(state: ThirtyOnePublicState): string[] {
    return state.playerOrder.filter((id) => state.seats[id]?.status === 'ACTIVE');
  }

  private nextAlivePlayer(state: ThirtyOnePublicState, afterId: string): string {
    const order = state.playerOrder;
    const startIdx = order.indexOf(afterId);
    for (let offset = 1; offset <= order.length; offset++) {
      const candidate = order[(Math.max(0, startIdx) + offset) % order.length];
      if (state.seats[candidate]?.status === 'ACTIVE') {
        return candidate;
      }
    }
    return afterId;
  }

  private buildFinalTurnQueue(state: ThirtyOnePublicState, knockerId: string): string[] {
    const queue: string[] = [];
    const order = state.playerOrder;
    const startIdx = order.indexOf(knockerId);
    if (startIdx === -1) return queue;
    for (let offset = 1; offset < order.length; offset++) {
      const candidate = order[(startIdx + offset) % order.length];
      if (candidate !== knockerId && state.seats[candidate]?.status === 'ACTIVE') {
        queue.push(candidate);
      }
    }
    return queue;
  }

  private nextEliminationOrder(state: ThirtyOnePublicState): number {
    let maxOrder = 0;
    for (const seat of Object.values(state.seats)) {
      if (seat.eliminatedOrder && seat.eliminatedOrder > maxOrder) {
        maxOrder = seat.eliminatedOrder;
      }
    }
    return maxOrder + 1;
  }

  private getDeck(room: RoomState): EngineDeckState | undefined {
    return this.privateStateService.get<EngineDeckState>(room.code, ENGINE_SOCKET_ID, DECK_KEY);
  }

  private setDeck(room: RoomState, deck: EngineDeckState): void {
    this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);
  }

  private getPrivate(room: RoomState, socketId: string): ThirtyOnePrivateState | undefined {
    return this.privateStateService.get<ThirtyOnePrivateState>(room.code, socketId, PRIVATE_KEY);
  }

  private setPrivate(room: RoomState, socketId: string, data: ThirtyOnePrivateState): void {
    this.privateStateService.set(room.code, socketId, PRIVATE_KEY, data);
  }

  private deletePrivate(room: RoomState, socketId: string): void {
    this.privateStateService.delete(room.code, socketId, PRIVATE_KEY);
  }

  private clearAllPrivate(room: RoomState): void {
    for (const player of room.players) {
      this.privateStateService.delete(room.code, player.socketId, PRIVATE_KEY);
    }
  }
}

function remapRecord<T>(
  record: Record<string, T>,
  oldKey: string,
  newKey: string,
): Record<string, T> {
  if (!(oldKey in record)) return record;
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    next[key === oldKey ? newKey : key] = value;
  }
  return next;
}
