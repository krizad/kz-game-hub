import { randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  GameType,
  PokerAction,
  PokerMode,
  PokerPotResult,
  PokerPublicState,
  PokerSeat,
  PlayingCard,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import {
  HandEvaluation,
  autoAction,
  bettingPossible,
  bettingRoundComplete,
  buildSidePots,
  compareEvaluations,
  createDeck,
  evaluateHand,
  isStreetPhase,
  legalMoves,
  nextStreet,
  shuffleDeck,
  uncalledBetPortion,
} from './poker-engine';

const PRIVATE_KEY = 'poker';
const ENGINE_SOCKET_ID = '__poker-engine__';
const DECK_KEY = 'deck';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

@Injectable()
export class PokerService {
  constructor(private readonly privateStateService: PrivateStateService) {}

  /* ---------------------------------------------------------------- */
  /* Match lifecycle                                                   */
  /* ---------------------------------------------------------------- */

  /** Start a fresh match from the lobby: every seat gets a full stack. */
  startMatch(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.POKER || room.roomHostId !== requesterId) return null;
    if (room.status !== RoomStatus.LOBBY && room.status !== RoomStatus.RESULT) return null;
    const players = room.players.filter((p) => !p.isViewer && p.connected !== false);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) return null;

    const seats: Record<string, PokerSeat> = {};
    for (const player of players) {
      seats[player.socketId] = {
        chips: this.startingStack(room),
        bet: 0,
        totalBet: 0,
        status: 'ACTIVE',
        hasActed: false,
      };
    }
    room.pokerState = {
      mode: (room.config.pokerMode ?? 'ONLINE') as PokerMode,
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
    };
    room.status = RoomStatus.PLAYING;
    this.clearAllHoleCards(room);
    this.dealHand(room);
    return room;
  }

  resetMatch(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.POKER || room.roomHostId !== requesterId) return null;
    room.pokerState = undefined;
    this.clearAllHoleCards(room);
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
    room.status = RoomStatus.LOBBY;
    return room;
  }

  /* ---------------------------------------------------------------- */
  /* Action routing                                                    */
  /* ---------------------------------------------------------------- */

  handleAction(room: RoomState, socketId: string, action: PokerAction): RoomState | null {
    const state = room.pokerState;
    if (!state || room.gameType !== GameType.POKER) return null;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return null;

    const isHost = room.roomHostId === socketId;
    switch (action.type) {
      case 'START_HAND':
        if (!isHost) return null;
        if (state.phase !== 'HAND_RESULT' && state.phase !== 'SHOWDOWN') return null;
        this.dealHand(room);
        return room;
      case 'END_MATCH':
        if (!isHost) return null;
        this.endMatch(room);
        return room;
      case 'REBUY':
        if (!isHost) return null;
        return this.rebuy(room, action.targetId) ? room : null;
      case 'ADJUST_CHIPS':
        if (!isHost || state.mode !== 'CHIPS_LEDGER') return null;
        return this.adjustChips(room, action.targetId, action.amount) ? room : null;
      case 'POT_AWARD':
        if (!isHost || state.mode !== 'CHIPS_LEDGER') return null;
        return this.awardPot(room, action.targetIds) ? room : null;
      case 'FOLD':
      case 'CHECK':
      case 'CALL':
      case 'BET':
      case 'ALL_IN':
        return this.applyBettingAction(room, socketId, action) ? room : null;
      case 'SHOW':
      case 'MUCK':
        return this.applyReveal(room, socketId, action.type === 'SHOW') ? room : null;
      default:
        return null;
    }
  }

  /** The auto-action the server takes for the active seat when its timer expires. */
  resolveAutoAction(room: RoomState): { playerId: string; action: PokerAction } | null {
    const state = room.pokerState;
    if (!state || !isStreetPhase(state.phase) || !state.activePlayerId) return null;
    return { playerId: state.activePlayerId, action: { type: autoAction(state) } };
  }

  /* ---------------------------------------------------------------- */
  /* Reconnection / removal                                            */
  /* ---------------------------------------------------------------- */

  remapSocketId(state: PokerPublicState, oldSocketId: string, newSocketId: string): void {
    if (state.dealerId === oldSocketId) state.dealerId = newSocketId;
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    state.seats = this.remapRecord(state.seats, oldSocketId, newSocketId);
    if (state.showdown) {
      state.showdown.awaitingRevealIds = state.showdown.awaitingRevealIds.map((id) =>
        id === oldSocketId ? newSocketId : id,
      );
      state.showdown.revealedCards = this.remapRecord(
        state.showdown.revealedCards,
        oldSocketId,
        newSocketId,
      );
      state.showdown.pendingPots = state.showdown.pendingPots.map((pot) => ({
        ...pot,
        eligiblePlayerIds: pot.eligiblePlayerIds.map((id) =>
          id === oldSocketId ? newSocketId : id,
        ),
      }));
    }
    if (state.handResult) {
      state.handResult.pots = state.handResult.pots.map((pot) => ({
        ...pot,
        winnerIds: pot.winnerIds.map((id) => (id === oldSocketId ? newSocketId : id)),
      }));
      if (state.handResult.uncalledRefund?.playerId === oldSocketId) {
        state.handResult.uncalledRefund.playerId = newSocketId;
      }
    }
  }

  /**
   * A seated player was removed mid-match. A live betting round dies: the
   * hand is annulled with no result and the room returns to the lobby — the
   * next start is a fresh match with full stacks (CONTEXT.md round cancellation).
   */
  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    const state = room.pokerState;
    if (!state) return;
    if (isStreetPhase(state.phase) && state.playerOrder.includes(socketId)) {
      this.cancelHand(room);
    }
  }

  /** Annul the current hand, drop all private card data, and return to the lobby. */
  cancelHand(room: RoomState): void {
    room.pokerState = undefined;
    this.clearAllHoleCards(room);
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
    room.status = RoomStatus.LOBBY;
  }

  /* ---------------------------------------------------------------- */
  /* Hand flow                                                         */
  /* ---------------------------------------------------------------- */

  private dealHand(room: RoomState): void {
    const state = room.pokerState!;
    const bigBlind = this.bigBlind(room);

    for (const id of state.playerOrder) {
      this.privateStateService.delete(room.code, id, PRIVATE_KEY);
    }
    // Seats reset from chips: funded seats play, busted seats sit out.
    for (const id of state.playerOrder) {
      const seat = state.seats[id];
      seat.status = seat.chips > 0 ? 'ACTIVE' : 'OUT';
      seat.bet = 0;
      seat.totalBet = 0;
      seat.hasActed = false;
      seat.raiseLocked = false;
      seat.lastAction = undefined;
      seat.lastActionAmount = undefined;
      seat.cardsRevealed = false;
      seat.handCategory = undefined;
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

    state.dealerId = state.dealerId
      ? this.nextSeatIn(eligible, state.dealerId)
      : eligible[randomInt(eligible.length)];

    const deck = shuffleDeck(createDeck());
    this.privateStateService.set(
      room.code,
      ENGINE_SOCKET_ID,
      DECK_KEY,
      state.mode === 'ONLINE' ? deck : [],
    );

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
    state.minRaiseTo = bigBlind;

    if (state.mode === 'ONLINE') {
      for (const id of eligible) {
        const holeCards = [deck.pop()!, deck.pop()!];
        this.privateStateService.set(room.code, id, PRIVATE_KEY, { holeCards });
      }
    }

    // Preflop action starts left of the big blind (heads-up: the button/SB).
    state.phase = 'PREFLOP';
    if (bettingRoundComplete(state)) {
      // Everyone all-in from antes/blinds — run the board out.
      this.closeStreet(room);
    } else {
      this.setActive(room, this.nextSeatAfter(state, bbId));
    }
  }

  private applyBettingAction(room: RoomState, socketId: string, action: PokerAction): boolean {
    const state = room.pokerState!;
    if (!isStreetPhase(state.phase) || state.activePlayerId !== socketId) return false;
    const seat = state.seats[socketId];
    const moves = legalMoves(state, socketId);
    if (!moves) return false;

    switch (action.type) {
      case 'FOLD':
        seat.status = 'FOLDED';
        seat.lastAction = 'FOLD';
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
        if (seat.raiseLocked) return false;
        const betBefore = seat.bet;
        const raiseTo = Math.min(Math.max(action.amount, moves.minRaiseTo), moves.maxRaiseTo);
        // A raise is short only when the stack cannot reach a full raise.
        const isFullRaise = raiseTo >= moves.minRaiseTo;
        const isShortAllIn = raiseTo === moves.maxRaiseTo && !isFullRaise;
        this.commit(room, socketId, raiseTo - seat.bet, state.currentBet === 0 ? 'BET' : 'RAISE');
        state.currentBet = raiseTo;
        if (isFullRaise) {
          const raiseSize = raiseTo - betBefore;
          state.minRaiseTo = raiseTo + raiseSize;
          for (const id of state.playerOrder) state.seats[id].raiseLocked = false;
        } else if (isShortAllIn) {
          for (const id of state.playerOrder) {
            if (id !== socketId && state.seats[id].hasActed) state.seats[id].raiseLocked = true;
          }
        }
        break;
      }
      case 'ALL_IN': {
        if (moves.maxRaiseTo <= state.currentBet && seat.bet === state.currentBet) return false;
        const target = moves.maxRaiseTo;
        const isRaise = target > state.currentBet;
        if (isRaise && seat.raiseLocked) return false;
        const betBefore = seat.bet;
        this.commit(room, socketId, target - seat.bet, 'ALL_IN');
        if (isRaise) {
          state.currentBet = target;
          if (target >= moves.minRaiseTo) {
            const raiseSize = target - betBefore;
            state.minRaiseTo = target + raiseSize;
            for (const id of state.playerOrder) state.seats[id].raiseLocked = false;
          } else {
            for (const id of state.playerOrder) {
              if (id !== socketId && state.seats[id].hasActed) state.seats[id].raiseLocked = true;
            }
          }
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

    // A raise re-opens action for everyone now facing more chips.
    for (const id of state.playerOrder) {
      if (
        id !== socketId &&
        state.seats[id].status === 'ACTIVE' &&
        state.seats[id].bet < state.currentBet
      ) {
        state.seats[id].hasActed = false;
      }
    }

    if (bettingRoundComplete(state)) {
      this.closeStreet(room);
    } else {
      this.setActive(room, this.nextToAct(state, socketId));
    }
    return true;
  }

  private closeStreet(room: RoomState): void {
    const state = room.pokerState!;
    for (const id of state.playerOrder) {
      state.pot += state.seats[id].bet;
      state.seats[id].bet = 0;
      state.seats[id].hasActed = false;
      state.seats[id].raiseLocked = false;
    }
    state.currentBet = 0;
    state.minRaiseTo = this.bigBlind(room);
    state.activePlayerId = null;

    if (state.phase === 'RIVER') {
      this.enterShowdown(room);
      return;
    }
    const street = nextStreet(state.phase)!;
    if (state.mode === 'ONLINE') this.dealCommunity(room, street);
    state.phase = street;

    if (!bettingPossible(state)) {
      // All-in runout: no more betting — deal the remaining streets and stop.
      if (state.mode === 'ONLINE') {
        let phase = street;
        while (phase !== 'RIVER') {
          phase = nextStreet(phase)!;
          this.dealCommunity(room, phase);
        }
      }
      state.phase = 'RIVER';
      this.enterShowdown(room);
      return;
    }
    this.setActive(room, this.nextSeatAfter(state, state.dealerId!));
  }

  private dealCommunity(room: RoomState, street: PokerPublicState['phase']): void {
    const state = room.pokerState!;
    const deck =
      this.privateStateService.get<PlayingCard[]>(room.code, ENGINE_SOCKET_ID, DECK_KEY) ?? [];
    const count = street === 'FLOP' ? 3 : street === 'TURN' || street === 'RIVER' ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const card = deck.pop();
      if (card) state.board.push(card);
    }
    this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);
  }

  /* ---------------------------------------------------------------- */
  /* Showdown                                                          */
  /* ---------------------------------------------------------------- */

  private enterShowdown(room: RoomState): void {
    const state = room.pokerState!;
    state.activePlayerId = null;
    state.turnDeadline = null;

    const live = state.playerOrder.filter(
      (id) => state.seats[id].status === 'ACTIVE' || state.seats[id].status === 'ALL_IN',
    );
    // Commit the final street's chips to the pot before splitting.
    for (const id of state.playerOrder) {
      state.pot += state.seats[id].bet;
      state.seats[id].bet = 0;
    }

    if (state.mode === 'CHIPS_LEDGER') {
      state.showdown = {
        awaitingRevealIds: [],
        revealedCards: {},
        pendingPots: buildSidePots(state.seats),
      };
      state.phase = 'SHOWDOWN';
      return;
    }

    const results = this.settlePots(room, live);
    state.handResult = { pots: results };
    state.showdown = {
      awaitingRevealIds: [...live],
      revealedCards: {},
      pendingPots: [],
    };
    state.phase = 'SHOWDOWN';
  }

  /** ONLINE: evaluate every live seat, split each pot among its best hands. */
  private settlePots(room: RoomState, live: string[]): PokerPotResult[] {
    const state = room.pokerState!;
    const pots = buildSidePots(state.seats);
    const board = state.board;
    const evaluations = new Map<string, HandEvaluation>();
    for (const id of live) {
      const hole = this.holeCards(room.code, id) ?? [];
      evaluations.set(id, evaluateHand([...hole, ...board]));
    }
    const results: PokerPotResult[] = [];
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
        handCategory: best.category,
        bestCards: winners.length === 1 ? best.best : undefined,
      });
    }
    // Contributions are settled — reset them so the next hand starts clean.
    for (const id of state.playerOrder) state.seats[id].totalBet = 0;
    state.pot = 0;
    return results;
  }

  private applyReveal(room: RoomState, socketId: string, show: boolean): boolean {
    const state = room.pokerState!;
    if (state.phase !== 'SHOWDOWN' || state.mode !== 'ONLINE' || !state.showdown) return false;
    if (!state.showdown.awaitingRevealIds.includes(socketId)) return false;
    state.showdown.awaitingRevealIds = state.showdown.awaitingRevealIds.filter(
      (id) => id !== socketId,
    );
    if (show) {
      const cards = this.holeCards(room.code, socketId) ?? [];
      state.showdown.revealedCards[socketId] = cards;
      state.seats[socketId].cardsRevealed = true;
      const board = state.board;
      if (cards.length > 0 && board.length >= 3) {
        state.seats[socketId].handCategory = evaluateHand([...cards, ...board]).category;
      }
    }
    if (state.showdown.awaitingRevealIds.length === 0) {
      state.phase = 'HAND_RESULT';
    }
    return true;
  }

  private awardUncontested(room: RoomState, winnerId: string): void {
    const state = room.pokerState!;
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
      pots: [{ amount: award, winnerIds: [winnerId] }],
      ...(refund && refund.playerId === winnerId ? { uncalledRefund: refund } : {}),
    };
    for (const id of state.playerOrder) {
      state.seats[id].totalBet = 0;
      state.seats[id].bet = 0;
    }
    state.pot = 0;
    state.showdown = { awaitingRevealIds: [], revealedCards: {}, pendingPots: [] };
    state.phase = 'HAND_RESULT';
    state.activePlayerId = null;
    state.turnDeadline = null;
  }

  /** CHIPS_LEDGER: host awards the oldest pending pot to one or more winners. */
  private awardPot(room: RoomState, targetIds: string[]): boolean {
    const state = room.pokerState!;
    if (state.phase !== 'SHOWDOWN' || !state.showdown) return false;
    const pot = state.showdown.pendingPots[0];
    if (!pot) return false;
    if (!Array.isArray(targetIds) || targetIds.length === 0) return false;
    if (!targetIds.every((id) => pot.eligiblePlayerIds.includes(id))) return false;

    this.distribute(room, pot.amount, targetIds);
    state.handResult = {
      pots: [...(state.handResult?.pots ?? []), { amount: pot.amount, winnerIds: [...targetIds] }],
    };
    state.showdown.pendingPots = state.showdown.pendingPots.slice(1);
    if (state.showdown.pendingPots.length === 0) {
      for (const id of state.playerOrder) state.seats[id].totalBet = 0;
      state.pot = 0;
      state.phase = 'HAND_RESULT';
    }
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Host chip management                                              */
  /* ---------------------------------------------------------------- */

  private rebuy(room: RoomState, targetId: string): boolean {
    const state = room.pokerState;
    if (!state) return false;
    const seat = state.seats[targetId];
    if (!seat || seat.chips > 0) return false;
    if (!room.players.some((p) => p.socketId === targetId && !p.isViewer)) return false;
    seat.chips += this.startingStack(room);
    // Takes effect at the next deal: mid-hand the seat stays out of this hand.
    return true;
  }

  private adjustChips(room: RoomState, targetId: string, amount: number): boolean {
    const state = room.pokerState!;
    const seat = state.seats[targetId];
    if (!seat || !Number.isInteger(amount)) return false;
    seat.chips = Math.max(0, seat.chips + amount);
    return true;
  }

  private endMatch(room: RoomState): void {
    const state = room.pokerState;
    const seats = state?.seats ?? {};
    for (const player of room.players) {
      if (player.isViewer) continue;
      player.score = seats[player.socketId]?.chips ?? 0;
    }
    if (state) {
      state.phase = 'HAND_RESULT';
      state.activePlayerId = null;
      state.turnDeadline = null;
    }
    this.clearAllHoleCards(room);
    room.status = RoomStatus.RESULT;
  }

  /* ---------------------------------------------------------------- */
  /* Chip helpers                                                      */
  /* ---------------------------------------------------------------- */

  /** Move chips from a seat's stack into its street bet (all-in when short). */
  private commit(
    room: RoomState,
    playerId: string,
    amount: number,
    action: PokerSeat['lastAction'],
  ): void {
    const state = room.pokerState!;
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
    const state = room.pokerState!;
    const ordered = [...winnerIds].sort(
      (a, b) => this.seatsFromDealer(state).indexOf(a) - this.seatsFromDealer(state).indexOf(b),
    );
    const base = Math.floor(amount / ordered.length);
    let remainder = amount - base * ordered.length;
    for (const id of ordered) {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      state.seats[id].chips += share;
    }
  }

  private seatsFromDealer(state: PokerPublicState): string[] {
    const eligible = state.playerOrder.filter((id) => state.seats[id]);
    if (!state.dealerId) return eligible;
    const dealerIndex = eligible.indexOf(state.dealerId);
    if (dealerIndex === -1) return eligible;
    return [...eligible.slice(dealerIndex + 1), ...eligible.slice(0, dealerIndex + 1)];
  }

  private setActive(room: RoomState, playerId: string | null): void {
    const state = room.pokerState!;
    state.activePlayerId = playerId;
    const enabled = room.config.pokerTurnTimerEnabled !== false;
    const seconds = room.config.pokerTurnTimerSeconds ?? 30;
    state.turnDeadline = playerId && enabled && seconds > 0 ? Date.now() + seconds * 1000 : null;
  }

  /** Next seat (in hand, still able to act) after `afterId`. */
  private nextToAct(state: PokerPublicState, afterId: string): string | null {
    const order = this.seatsFromDealer(state);
    const startIndex = order.indexOf(afterId);
    for (let i = 1; i <= order.length; i++) {
      const id = order[(startIndex + i) % order.length];
      const seat = state.seats[id];
      if (seat.status !== 'ACTIVE') continue;
      if (!seat.hasActed || seat.bet < state.currentBet) return id;
    }
    // Everyone eligible has matched — the round is closed.
    const anyActive = order.find((id) => state.seats[id].status === 'ACTIVE');
    return anyActive ?? null;
  }

  /** Next seat with `status ACTIVE` strictly after `afterId` (wrapping). */
  private nextSeatAfter(state: PokerPublicState, afterId: string): string | null {
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
    return this.privateStateService.get<{ holeCards?: PlayingCard[] }>(
      roomCode,
      socketId,
      PRIVATE_KEY,
    )?.holeCards;
  }

  private clearAllHoleCards(room: RoomState): void {
    for (const player of room.players) {
      this.privateStateService.delete(room.code, player.socketId, PRIVATE_KEY);
    }
  }

  private remapRecord<T>(
    record: Record<string, T>,
    oldKey: string,
    newKey: string,
  ): Record<string, T> {
    if (!(oldKey in record)) return record;
    const { [oldKey]: value, ...remaining } = record;
    return { ...remaining, [newKey]: value };
  }

  /* ---------------------------------------------------------------- */
  /* Config                                                            */
  /* ---------------------------------------------------------------- */

  private smallBlind(room: RoomState): number {
    return Math.max(1, room.config.pokerSmallBlind ?? 10);
  }

  private bigBlind(room: RoomState): number {
    return Math.max(this.smallBlind(room), room.config.pokerBigBlind ?? 20);
  }

  private ante(room: RoomState): number {
    return Math.max(0, room.config.pokerAnte ?? 0);
  }

  private startingStack(room: RoomState): number {
    return Math.max(10, room.config.pokerStartingStack ?? 1000);
  }
}
