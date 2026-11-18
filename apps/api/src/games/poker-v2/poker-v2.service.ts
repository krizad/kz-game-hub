import { randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  GameType,
  PlayingCard,
  PokerV2Action,
  PokerV2Advisor,
  PokerV2HandCategory,
  PokerV2PotResult,
  PokerV2PublicState,
  PokerV2Seat,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { buildAdvisor, simulateEquity, EquityEntry } from './poker-v2-advisor';
import {
  buildSidePots,
  compareEvaluations,
  createDeck,
  evaluateHand,
  HandEvaluation,
  shuffleDeck,
  uncalledBetPortion,
} from '../poker/poker-engine';

const PRIVATE_KEY = 'pokerV2';
const ENGINE_SOCKET_ID = '__poker-v2-engine__';
const DECK_KEY = 'deck';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 9;
/** Bounded reviewable hand history kept in the public state. */
const MAX_HISTORY = 20;

@Injectable()
export class PokerV2Service {
  constructor(private readonly privateStateService: PrivateStateService) {}

  /* ---------------------------------------------------------------- */
  /* Match lifecycle                                                   */
  /* ---------------------------------------------------------------- */

  /** Start a tournament from the lobby: every seat gets a full stack. */
  startMatch(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.POKER_V2 || room.roomHostId !== requesterId) return null;
    if (room.status !== RoomStatus.LOBBY && room.status !== RoomStatus.RESULT) {
      return null;
    }
    const players = room.players.filter((p) => !p.isViewer && p.connected !== false);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) return null;

    const seats: Record<string, PokerV2Seat> = {};
    for (const player of players) {
      seats[player.socketId] = {
        chips: this.startingStack(room),
        bet: 0,
        totalBet: 0,
        status: 'ACTIVE',
        hasActed: false,
      };
    }
    room.pokerV2State = {
      phase: 'HAND_RESULT',
      handNumber: 0,
      playerOrder: players.map((p) => p.socketId),
      seats,
      dealerId: null,
      activePlayerId: null,
      currentBet: 0,
      minRaiseTo: 0,
      pot: 0,
      board: [],
      smallBlind: this.smallBlind(room),
      bigBlind: this.bigBlind(room),
      ante: this.ante(room),
      turnDeadline: null,
      nextHandDeadline: null,
      history: [],
    };
    room.status = RoomStatus.PLAYING;
    this.clearAllPrivate(room);
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
    this.dealHand(room);
    return room;
  }

  resetMatch(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.POKER_V2 || room.roomHostId !== requesterId) return null;
    room.pokerV2State = undefined;
    this.clearAllPrivate(room);
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
    room.status = RoomStatus.LOBBY;
    return room;
  }

  /* ---------------------------------------------------------------- */
  /* Action routing                                                    */
  /* ---------------------------------------------------------------- */

  handleAction(room: RoomState, socketId: string, action: PokerV2Action): RoomState | null {
    const state = room.pokerV2State;
    if (!state || room.gameType !== GameType.POKER_V2) return null;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return null;

    const isHost = room.roomHostId === socketId;
    switch (action.type) {
      case 'START_HAND':
        // A "deal now" skip: any seated player may cut the countdown short.
        if (!state.playerOrder.includes(socketId)) return null;
        if (state.phase !== 'HAND_RESULT') return null;
        this.dealHand(room);
        return room;
      case 'END_MATCH':
        if (!isHost) return null;
        this.endMatch(room);
        return room;
      case 'FOLD':
      case 'CHECK':
      case 'CALL':
      case 'BET':
      case 'ALL_IN':
        return this.applyBettingAction(room, socketId, action) ? room : null;
      default:
        return null;
    }
  }

  /** The auto-action for the active seat when its turn timer expires. */
  resolveAutoAction(room: RoomState): { playerId: string; action: PokerV2Action } | null {
    const state = room.pokerV2State;
    if (!state || !isStreetPhase(state.phase) || !state.activePlayerId) return null;
    const seat = state.seats[state.activePlayerId];
    if (!seat) return null;
    const toCall = Math.max(0, state.currentBet - seat.bet);
    return {
      playerId: state.activePlayerId,
      action: { type: toCall === 0 ? 'CHECK' : 'FOLD' },
    };
  }

  /** Auto-deal the next hand once its countdown has elapsed. */
  autoDealIfDue(room: RoomState): boolean {
    const state = room.pokerV2State;
    if (!state || state.phase !== 'HAND_RESULT') return false;
    if (!state.nextHandDeadline || Date.now() < state.nextHandDeadline) return false;
    this.dealHand(room);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Reconnection / removal                                            */
  /* ---------------------------------------------------------------- */

  remapSocketId(state: PokerV2PublicState, oldSocketId: string, newSocketId: string): void {
    if (state.dealerId === oldSocketId) state.dealerId = newSocketId;
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    state.seats = remapRecord(state.seats, oldSocketId, newSocketId);
    if (state.showdown) {
      state.showdown.revealedCards = remapRecord(
        state.showdown.revealedCards,
        oldSocketId,
        newSocketId,
      );
    }
    if (state.handResult) {
      state.handResult.pots = state.handResult.pots.map((pot) => ({
        ...pot,
        winnerIds: pot.winnerIds.map((id) => (id === oldSocketId ? newSocketId : id)),
        eligiblePlayerIds: pot.eligiblePlayerIds?.map((id) =>
          id === oldSocketId ? newSocketId : id,
        ),
      }));
      if (state.handResult.uncalledRefund?.playerId === oldSocketId) {
        state.handResult.uncalledRefund.playerId = newSocketId;
      }
    }
  }

  /**
   * A seated player was removed mid-match. If they were still in the hand
   * their hand dies as an instant fold (committed chips stay in the pot)
   * and betting continues; settled pots are theirs to keep.
   */
  handlePlayerRemoved(room: RoomState, socketId: string): void {
    const state = room.pokerV2State;
    if (!state || !isStreetPhase(state.phase)) return;
    const seat = state.seats[socketId];
    if (!seat || seat.status !== 'ACTIVE') return;

    seat.status = 'FOLDED';
    seat.lastAction = 'FOLD';
    this.deletePrivate(room, socketId);
    this.recomputeAdvisors(room);
    this.advanceAfterAction(room, socketId);
  }

  /* ---------------------------------------------------------------- */
  /* Hand flow                                                         */
  /* ---------------------------------------------------------------- */

  private dealHand(room: RoomState): void {
    const state = room.pokerV2State!;
    const bigBlind = this.bigBlind(room);

    for (const id of state.playerOrder) {
      this.deletePrivate(room, id);
    }
    // Funded seats play; busted seats are out of the tournament.
    for (const id of state.playerOrder) {
      const seat = state.seats[id];
      seat.status = seat.chips > 0 ? 'ACTIVE' : 'OUT';
      seat.bet = 0;
      seat.totalBet = 0;
      seat.hasActed = false;
      seat.raiseLocked = false;
      seat.lastAction = undefined;
      seat.lastActionAmount = undefined;
      seat.handCategory = undefined;
      seat.handRank = undefined;
    }

    const eligible = state.playerOrder.filter((id) => state.seats[id].status === 'ACTIVE');
    if (eligible.length < MIN_PLAYERS) {
      this.endMatch(room);
      return;
    }

    state.handNumber += 1;
    state.pot = 0;
    state.board = [];
    state.currentBet = 0;
    // Preflop the big blind is the forced opening bet, so the minimum raise
    // is a full second big blind (raise-TO total of 2×BB).
    state.minRaiseTo = bigBlind * 2;
    state.activePlayerId = null;
    state.showdown = undefined;
    state.handResult = undefined;
    state.turnDeadline = null;
    state.nextHandDeadline = null;

    state.dealerId = state.dealerId
      ? this.nextSeatIn(eligible, state.dealerId)
      : eligible[randomInt(eligible.length)];

    const deck = shuffleDeck(createDeck());
    this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);

    // Ante (everyone), then blinds. Posting short just goes all-in.
    if (state.ante > 0) {
      for (const id of eligible) {
        this.commit(room, id, Math.min(state.ante, state.seats[id].chips), 'ANTE');
      }
    }
    const sbId =
      eligible.length === MIN_PLAYERS
        ? state.dealerId!
        : this.nextSeatIn(eligible, state.dealerId!);
    const bbId = this.nextSeatIn(eligible, sbId);
    this.commit(room, sbId, Math.min(state.smallBlind, state.seats[sbId].chips), 'SMALL_BLIND');
    this.commit(room, bbId, Math.min(bigBlind, state.seats[bbId].chips), 'BIG_BLIND');
    state.currentBet = bigBlind;

    for (const id of eligible) {
      const holeCards = [deck.pop()!, deck.pop()!];
      this.privateStateService.set(room.code, id, PRIVATE_KEY, {
        holeCards,
      });
    }

    state.phase = 'PREFLOP';
    this.recomputeAdvisors(room);
    if (bettingRoundComplete(state)) {
      this.closeStreet(room);
    } else {
      this.setActive(room, this.nextSeatAfter(state, bbId));
    }
  }

  private applyBettingAction(room: RoomState, socketId: string, action: PokerV2Action): boolean {
    const state = room.pokerV2State!;
    if (!isStreetPhase(state.phase) || state.activePlayerId !== socketId) return false;
    const seat = state.seats[socketId];
    const moves = legalMoves(state, socketId);
    if (!moves) return false;

    switch (action.type) {
      case 'FOLD':
        seat.status = 'FOLDED';
        seat.lastAction = 'FOLD';
        this.deletePrivate(room, socketId);
        break;
      case 'CHECK':
        if (!moves.canCheck) return false;
        seat.lastAction = 'CHECK';
        break;
      case 'CALL': {
        if (moves.canCheck || moves.callAmount <= 0) return false;
        this.commit(room, socketId, moves.callAmount, 'CALL');
        break;
      }
      case 'BET': {
        if (!moves.canBet || !Number.isInteger(action.amount)) return false;
        const raiseTo = action.amount;
        if (raiseTo < moves.minRaiseTo || raiseTo > moves.maxRaiseTo) return false;
        const previousBet = state.currentBet;
        this.commit(room, socketId, raiseTo - seat.bet, previousBet === 0 ? 'BET' : 'RAISE');
        this.recordRaise(state, socketId, raiseTo, previousBet);
        break;
      }
      case 'ALL_IN': {
        if (moves.maxRaiseTo <= state.currentBet && seat.bet === state.currentBet) return false;
        const target = moves.maxRaiseTo;
        const isRaise = target > state.currentBet;
        if (isRaise && seat.raiseLocked) return false;
        if (
          isRaise &&
          !state.playerOrder.some((id) => id !== socketId && state.seats[id].status === 'ACTIVE')
        ) {
          return false;
        }
        const previousBet = state.currentBet;
        this.commit(room, socketId, target - seat.bet, 'ALL_IN');
        if (isRaise) {
          this.recordRaise(state, socketId, target, previousBet);
        }
        break;
      }
      default:
        return false;
    }

    seat.hasActed = true;

    // Folded down to one → uncontested pot (with uncalled-bet refund).
    const live = state.playerOrder.filter(
      (id) => state.seats[id].status === 'ACTIVE' || state.seats[id].status === 'ALL_IN',
    );
    if (live.length === 1) {
      this.awardUncontested(room, live[0]);
      return true;
    }

    this.advanceAfterAction(room, socketId);
    return true;
  }

  /** Re-open action after a raise, then advance the street or the turn. */
  private advanceAfterAction(room: RoomState, actorId: string): void {
    const state = room.pokerV2State!;
    // A raise re-opens action for everyone now facing more chips.
    for (const id of state.playerOrder) {
      if (
        id !== actorId &&
        state.seats[id].status === 'ACTIVE' &&
        state.seats[id].bet < state.currentBet
      ) {
        state.seats[id].hasActed = false;
      }
    }

    if (state.seats[actorId].status === 'FOLDED') {
      this.recomputeAdvisors(room);
    }

    if (bettingRoundComplete(state)) {
      this.closeStreet(room);
    } else {
      this.setActive(room, this.nextToAct(state, actorId));
    }
  }

  /** Track the last full increment while short all-ins accumulate above it. */
  private recordRaise(
    state: PokerV2PublicState,
    raiserId: string,
    raiseTo: number,
    previousBet: number,
  ): void {
    const fullIncrement = Math.max(1, state.minRaiseTo - previousBet);
    const increment = raiseTo - previousBet;
    state.currentBet = raiseTo;
    state.minRaiseTo = raiseTo + (increment >= fullIncrement ? increment : fullIncrement);
    if (increment >= fullIncrement) {
      for (const id of state.playerOrder) state.seats[id].raiseLocked = false;
    } else {
      for (const id of state.playerOrder) {
        if (id === raiserId) continue;
        const seat = state.seats[id];
        if (seat.status !== 'ACTIVE' || (!seat.hasActed && !seat.raiseLocked)) continue;
        seat.raiseLocked = raiseTo - seat.bet < fullIncrement;
      }
    }
  }

  private closeStreet(room: RoomState): void {
    const state = room.pokerV2State!;
    for (const id of state.playerOrder) {
      state.pot += state.seats[id].bet;
      state.seats[id].bet = 0;
      state.seats[id].hasActed = false;
      state.seats[id].raiseLocked = false;
    }
    state.currentBet = 0;
    state.minRaiseTo = this.bigBlind(room);
    state.activePlayerId = null;
    state.turnDeadline = null;

    if (state.phase === 'RIVER') {
      this.enterShowdown(room);
      return;
    }
    const street = nextStreet(state.phase)!;
    const deck =
      this.privateStateService.get<PlayingCard[]>(room.code, ENGINE_SOCKET_ID, DECK_KEY) ?? [];
    const count = street === 'FLOP' ? 3 : street === 'TURN' || street === 'RIVER' ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const card = deck.pop();
      if (card) state.board.push(card);
    }
    this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);
    state.phase = street;

    if (!bettingPossible(state)) {
      // All-in runout: no more betting — deal the remaining streets and stop.
      while (state.phase !== 'RIVER') {
        const next = nextStreet(state.phase)!;
        for (let i = 0; i < (next === 'FLOP' ? 3 : 1); i++) {
          const card = deck.pop();
          if (card) state.board.push(card);
        }
        state.phase = next;
      }
      this.enterShowdown(room);
      return;
    }
    this.recomputeAdvisors(room);
    this.setActive(room, this.nextSeatAfter(state, state.dealerId!));
  }

  /* ---------------------------------------------------------------- */
  /* Showdown                                                          */
  /* ---------------------------------------------------------------- */

  /** Online poker convention: every live hand is revealed automatically. */
  private enterShowdown(room: RoomState): void {
    const state = room.pokerV2State!;
    state.activePlayerId = null;
    state.turnDeadline = null;

    const live = state.playerOrder.filter(
      (id) => state.seats[id].status === 'ACTIVE' || state.seats[id].status === 'ALL_IN',
    );
    for (const id of state.playerOrder) {
      state.pot += state.seats[id].bet;
      state.seats[id].bet = 0;
    }

    const revealedCards: Record<string, PlayingCard[]> = {};
    const evaluations = new Map<string, HandEvaluation>();
    for (const id of live) {
      const cards = this.holeCards(room.code, id) ?? [];
      revealedCards[id] = cards;
      evaluations.set(id, evaluateHand([...cards, ...state.board]));
    }
    state.showdown = { revealedCards };

    const results = this.settlePots(room, live, evaluations);
    state.handResult = { pots: results };
    for (const id of state.playerOrder) {
      this.deletePrivate(room, id);
    }
    state.phase = 'HAND_RESULT';
    this.recordHistory(room);

    const fundable = state.playerOrder.filter((id) => state.seats[id].chips > 0);
    if (fundable.length <= 1) {
      state.handResult.matchEnded = true;
      this.endMatch(room);
      return;
    }
    this.armNextHand(room);
  }

  /** Snapshot the settled hand into the table history (bounded list). */
  private recordHistory(room: RoomState): void {
    const state = room.pokerV2State!;
    const result = state.handResult;
    if (!result) return;
    const revealedCards: Record<string, PlayingCard[]> = {};
    const seatHands: Record<string, PokerV2HandCategory> = {};
    for (const [id, cards] of Object.entries(state.showdown?.revealedCards ?? {})) {
      if (cards.length > 0) revealedCards[id] = [...cards];
    }
    for (const id of Object.keys(revealedCards)) {
      const category = state.seats[id]?.handCategory;
      if (category) seatHands[id] = category;
    }
    state.history = [
      ...state.history,
      {
        handNumber: state.handNumber,
        board: [...state.board],
        pots: result.pots.map((pot) => ({
          winnerIds: [...pot.winnerIds],
          amount: pot.amount,
          handCategory: pot.handCategory,
        })),
        revealedCards,
        seatHands,
        ...(result.uncalledRefund ? { uncalledRefund: { ...result.uncalledRefund } } : {}),
      },
    ].slice(-MAX_HISTORY);
  }

  /** ONLINE: evaluate every live seat, split each pot among its best hands. */
  private settlePots(
    room: RoomState,
    live: string[],
    evaluations: Map<string, HandEvaluation>,
  ): PokerV2PotResult[] {
    const state = room.pokerV2State!;
    const pots = buildSidePots(state.seats);
    const results: PokerV2PotResult[] = [];
    for (const pot of pots) {
      const contenders = pot.eligiblePlayerIds.filter((id) => evaluations.has(id));
      if (contenders.length === 0) continue;
      let winners = [contenders[0]];
      for (const id of contenders.slice(1)) {
        const cmp = compareEvaluations(evaluations.get(id)!, evaluations.get(winners[0])!);
        if (cmp > 0) winners = [id];
        else if (cmp === 0) winners.push(id);
      }
      this.distribute(room, pot.amount, winners);
      const best = evaluations.get(winners[0])!;
      results.push({
        amount: pot.amount,
        winnerIds: winners,
        eligiblePlayerIds: pot.eligiblePlayerIds,
        handCategory: best.category,
        bestCards: winners.length === 1 ? best.best : undefined,
      });
    }
    // Publish each live seat's final hand class for the result panel.
    for (const id of live) {
      const evaluation = evaluations.get(id);
      if (!evaluation) continue;
      state.seats[id].handCategory = evaluation.category;
      state.seats[id].handRank = evaluation.catIndex;
    }
    for (const id of state.playerOrder) state.seats[id].totalBet = 0;
    state.pot = 0;
    return results;
  }

  private awardUncontested(room: RoomState, winnerId: string): void {
    const state = room.pokerV2State!;
    const refund = uncalledBetPortion(state.seats);
    let potTotal = state.pot;
    for (const id of state.playerOrder) potTotal += state.seats[id].bet;
    let award = potTotal;
    if (refund && refund.playerId === winnerId) {
      award -= refund.amount;
      state.seats[winnerId].chips += refund.amount;
    }
    state.seats[winnerId].chips += award;
    state.handResult = {
      pots: [{ amount: award, winnerIds: [winnerId], eligiblePlayerIds: [winnerId] }],
      ...(refund && refund.playerId === winnerId ? { uncalledRefund: refund } : {}),
    };
    for (const id of state.playerOrder) {
      state.seats[id].totalBet = 0;
      state.seats[id].bet = 0;
    }
    state.pot = 0;
    state.showdown = { revealedCards: {} };
    for (const id of state.playerOrder) {
      this.deletePrivate(room, id);
    }
    state.phase = 'HAND_RESULT';
    state.activePlayerId = null;
    state.turnDeadline = null;
    this.recordHistory(room);

    const fundable = state.playerOrder.filter((id) => state.seats[id].chips > 0);
    if (fundable.length <= 1) {
      state.handResult.matchEnded = true;
      this.endMatch(room);
      return;
    }
    this.armNextHand(room);
  }

  /* ---------------------------------------------------------------- */
  /* Match end / timers                                                */
  /* ---------------------------------------------------------------- */

  private armNextHand(room: RoomState): void {
    const state = room.pokerV2State!;
    const seconds = this.autoDealSeconds(room);
    state.nextHandSeconds = seconds;
    state.nextHandDeadline = Date.now() + seconds * 1000;
  }

  private endMatch(room: RoomState): void {
    const state = room.pokerV2State;
    const seats = state?.seats ?? {};
    for (const player of room.players) {
      if (player.isViewer) continue;
      player.score = seats[player.socketId]?.chips ?? 0;
    }
    if (state) {
      state.phase = 'HAND_RESULT';
      state.activePlayerId = null;
      state.turnDeadline = null;
      state.nextHandDeadline = null;
    }
    this.clearAllPrivate(room);
    room.status = RoomStatus.RESULT;
  }

  /* ---------------------------------------------------------------- */
  /* Advisors                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Refresh every live seat's hand-strength advisor. One shared Monte-Carlo
   * pass estimates all equities at once; the river is compared exactly.
   */
  private recomputeAdvisors(room: RoomState): void {
    const state = room.pokerV2State;
    if (!state || room.status !== RoomStatus.PLAYING) return;
    if (!isStreetPhase(state.phase)) return;
    // Hosts may switch the win-odds panel off room-wide (also saves CPU).
    if (room.config.pokerV2AdvisorEnabled === false) return;

    const live: EquityEntry[] = [];
    for (const id of state.playerOrder) {
      const seat = state.seats[id];
      if (seat.status !== 'ACTIVE' && seat.status !== 'ALL_IN') continue;
      const hole = this.holeCards(room.code, id);
      if (!hole || hole.length !== 2) continue;
      live.push({ socketId: id, holeCards: hole });
    }

    // Per-player-perspective Monte Carlo; handles the complete board too.
    const equities = simulateEquity(live, state.board);

    for (const entry of live) {
      const equity = equities.get(entry.socketId) ?? 0;
      const advisor = buildAdvisor(entry.holeCards, state.board, equity);
      const current = this.privateStateService.get<PokerV2PrivateShape>(
        room.code,
        entry.socketId,
        PRIVATE_KEY,
      );
      this.privateStateService.set(room.code, entry.socketId, PRIVATE_KEY, {
        ...current,
        advisor,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Chip helpers                                                      */
  /* ---------------------------------------------------------------- */

  /** Move chips from a seat's stack into its street bet (all-in when short). */
  private commit(
    room: RoomState,
    playerId: string,
    amount: number,
    action: PokerV2Seat['lastAction'],
  ): void {
    const state = room.pokerV2State!;
    const seat = state.seats[playerId];
    const pay = Math.min(amount, seat.chips);
    seat.chips -= pay;
    seat.bet += pay;
    seat.totalBet += pay;
    seat.lastAction = pay < amount && action !== 'ANTE' ? 'ALL_IN' : action;
    seat.lastActionAmount = pay;
    if (seat.chips === 0 && seat.status === 'ACTIVE') seat.status = 'ALL_IN';
  }

  /** Split an amount across winners; odd chips go to the first seat left of the dealer. */
  private distribute(room: RoomState, amount: number, winnerIds: string[]): void {
    const state = room.pokerV2State!;
    const seatsOrder = this.seatsFromDealer(state);
    const ordered = [...winnerIds].sort((a, b) => seatsOrder.indexOf(a) - seatsOrder.indexOf(b));
    const base = Math.floor(amount / ordered.length);
    let remainder = amount - base * ordered.length;
    for (const id of ordered) {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      state.seats[id].chips += share;
    }
  }

  private seatsFromDealer(state: PokerV2PublicState): string[] {
    const eligible = state.playerOrder.filter((id) => state.seats[id]);
    if (!state.dealerId) return eligible;
    const dealerIndex = eligible.indexOf(state.dealerId);
    if (dealerIndex === -1) return eligible;
    return [...eligible.slice(dealerIndex + 1), ...eligible.slice(0, dealerIndex + 1)];
  }

  private setActive(room: RoomState, playerId: string | null): void {
    const state = room.pokerV2State!;
    state.activePlayerId = playerId;
    const enabled = room.config.pokerV2TurnTimerEnabled !== false;
    const seconds = room.config.pokerV2TurnTimerSeconds ?? 20;
    state.turnDeadline = playerId && enabled && seconds > 0 ? Date.now() + seconds * 1000 : null;
  }

  /** Next seat (in hand, still able to act) after `afterId`. */
  private nextToAct(state: PokerV2PublicState, afterId: string): string | null {
    const order = this.seatsFromDealer(state);
    const startIndex = order.indexOf(afterId);
    for (let i = 1; i <= order.length; i++) {
      const id = order[(startIndex + i) % order.length];
      const seat = state.seats[id];
      if (seat.status !== 'ACTIVE') continue;
      if (!seat.hasActed || seat.bet < state.currentBet) return id;
    }
    const anyActive = order.find((id) => state.seats[id].status === 'ACTIVE');
    return anyActive ?? null;
  }

  /** Next seat with `status ACTIVE` strictly after `afterId` (wrapping). */
  private nextSeatAfter(state: PokerV2PublicState, afterId: string): string | null {
    const order = this.seatsFromDealer(state);
    const startIndex = order.indexOf(afterId);
    for (let i = 1; i <= order.length; i++) {
      const id = order[(startIndex + i) % order.length];
      if (state.seats[id].status === 'ACTIVE') return id;
    }
    return null;
  }

  private nextSeatIn(ids: string[], afterId: string): string {
    const index = ids.indexOf(afterId);
    return ids[(index + 1) % ids.length];
  }

  private holeCards(roomCode: string, socketId: string): PlayingCard[] | undefined {
    return this.privateStateService.get<PokerV2PrivateShape>(roomCode, socketId, PRIVATE_KEY)
      ?.holeCards;
  }

  private deletePrivate(room: RoomState, socketId: string): void {
    this.privateStateService.delete(room.code, socketId, PRIVATE_KEY);
  }

  private clearAllPrivate(room: RoomState): void {
    for (const player of room.players) {
      this.deletePrivate(room, player.socketId);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Config                                                            */
  /* ---------------------------------------------------------------- */

  private smallBlind(room: RoomState): number {
    return Math.max(1, room.config.pokerV2SmallBlind ?? 10);
  }

  private bigBlind(room: RoomState): number {
    return Math.max(this.smallBlind(room), room.config.pokerV2BigBlind ?? 20);
  }

  private ante(room: RoomState): number {
    return Math.max(0, room.config.pokerV2Ante ?? 0);
  }

  private startingStack(room: RoomState): number {
    return Math.max(10, room.config.pokerV2StartingStack ?? 1000);
  }

  private autoDealSeconds(room: RoomState): number {
    return Math.min(60, Math.max(3, room.config.pokerV2AutoDealSeconds ?? 10));
  }
}

/* ------------------------------------------------------------------ */
/* Betting-round helpers (v2-typed mirrors of the poker v1 engine)     */
/* ------------------------------------------------------------------ */

const POKER_V2_STREETS: PokerV2PublicState['phase'][] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

function isStreetPhase(phase: PokerV2PublicState['phase']): boolean {
  return POKER_V2_STREETS.includes(phase);
}

function nextStreet(phase: PokerV2PublicState['phase']): PokerV2PublicState['phase'] | null {
  switch (phase) {
    case 'PREFLOP':
      return 'FLOP';
    case 'FLOP':
      return 'TURN';
    case 'TURN':
      return 'RIVER';
    default:
      return null;
  }
}

/** Seats still allowed to act: in the hand, not folded, chips behind. */
function actableSeats(state: PokerV2PublicState): string[] {
  return state.playerOrder.filter((id) => state.seats[id]?.status === 'ACTIVE');
}

function bettingRoundComplete(state: PokerV2PublicState): boolean {
  const inHand = state.playerOrder.filter((id) => {
    const status = state.seats[id]?.status;
    return status === 'ACTIVE' || status === 'ALL_IN';
  });
  if (inHand.length <= 1) return true;
  const actionable = actableSeats(state);
  if (actionable.length === 0) return true;
  if (actionable.length === 1) {
    const seat = state.seats[actionable[0]];
    return seat.hasActed && seat.bet >= state.currentBet;
  }
  return actionable.every((id) => {
    const seat = state.seats[id];
    return seat.hasActed && seat.bet === state.currentBet;
  });
}

function bettingPossible(state: PokerV2PublicState): boolean {
  return actableSeats(state).length >= 2;
}

function legalMoves(
  state: PokerV2PublicState,
  playerId: string,
): {
  canFold: boolean;
  canCheck: boolean;
  callAmount: number;
  canBet: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
} | null {
  const seat = state.seats[playerId];
  if (!seat || seat.status !== 'ACTIVE') return null;
  const toCall = Math.max(0, state.currentBet - seat.bet);
  const callAmount = Math.min(toCall, seat.chips);
  const maxRaiseTo = seat.chips + seat.bet;
  const canCheck = toCall === 0;
  const othersActive = state.playerOrder.some(
    (id) => id !== playerId && state.seats[id].status === 'ACTIVE',
  );
  const minRaiseTo = Math.max(state.minRaiseTo, state.currentBet + 1);
  return {
    canFold: true,
    canCheck,
    callAmount,
    canBet: othersActive && !seat.raiseLocked && maxRaiseTo >= minRaiseTo,
    minRaiseTo,
    maxRaiseTo,
  };
}

function remapRecord<T>(
  record: Record<string, T>,
  oldKey: string,
  newKey: string,
): Record<string, T> {
  if (!(oldKey in record)) return record;
  const { [oldKey]: value, ...remaining } = record;
  return { ...remaining, [newKey]: value };
}

interface PokerV2PrivateShape {
  holeCards?: PlayingCard[];
  advisor?: PokerV2Advisor;
}
