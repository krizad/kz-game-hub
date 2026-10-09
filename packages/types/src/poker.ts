import { PlayingCard } from './card-game';

/**
 * POKER — one game type, two modes sharing one no-limit betting engine
 * (ADR 0009). ONLINE deals cards and evaluates showdowns on the server;
 * CHIPS_LEDGER tracks bets for a physical table's real deck.
 */
export type PokerMode = 'ONLINE' | 'CHIPS_LEDGER';

export type PokerPhase = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'HAND_RESULT';

export type PokerSeatStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'OUT';

export type PokerLastAction =
  | 'ANTE'
  | 'SMALL_BLIND'
  | 'BIG_BLIND'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN'
  | 'FOLD';

export type PokerHandCategory =
  | 'HIGH_CARD'
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export interface PokerSeat {
  /** Chips behind (not yet committed this street). */
  chips: number;
  /** Committed this street. */
  bet: number;
  /** Committed this hand — the side-pot contribution. */
  totalBet: number;
  status: PokerSeatStatus;
  /** Whether the seat has acted in the current betting round. */
  hasActed: boolean;
  /**
   * Locked out of raising because the last raise was a short all-in and this
   * seat had already acted. May only fold or call (ADR 0009 engine rule).
   */
  raiseLocked?: boolean;
  lastAction?: PokerLastAction;
  lastActionAmount?: number;
  /** ONLINE showdown: the seat chose to show their hole cards. */
  cardsRevealed?: boolean;
  /** ONLINE showdown, revealed seats only: best hand category. */
  handCategory?: PokerHandCategory;
}

export interface PokerPot {
  amount: number;
  /** Non-folded seats entitled to this pot (matched its contribution level). */
  eligiblePlayerIds: string[];
}

export interface PokerPotResult {
  amount: number;
  winnerIds: string[];
  /** ONLINE only: winning hand category. */
  handCategory?: PokerHandCategory;
  /** ONLINE only: the best five cards. */
  bestCards?: PlayingCard[];
}

export interface PokerShowdown {
  /** ONLINE: seats still choosing show/muck. CHIPS_LEDGER: always empty. */
  awaitingRevealIds: string[];
  revealedCards: Record<string, PlayingCard[]>;
  /**
   * CHIPS_LEDGER only: pots awaiting the host's POT_AWARD, lowest index next.
   * Empty in ONLINE mode (the server settles pots itself).
   */
  pendingPots: PokerPot[];
}

export interface PokerHandResult {
  pots: PokerPotResult[];
  /** Portion of the last bet no one matched, returned before pot creation. */
  uncalledRefund?: { playerId: string; amount: number };
}

/** Broadcast state. Never contains the deck order or unrevealed hole cards. */
export interface PokerPublicState {
  mode: PokerMode;
  phase: PokerPhase;
  handNumber: number;
  playerOrder: string[];
  seats: Record<string, PokerSeat>;
  dealerId: string | null;
  activePlayerId: string | null;
  /** Highest total commitment this street — the amount to match. */
  currentBet: number;
  /** Minimum legal raise-TO total for the current betting round. */
  minRaiseTo: number;
  /** Total chips in every pot (display sum). */
  pot: number;
  board: PlayingCard[];
  smallBlind: number;
  bigBlind: number;
  ante: number;
  /** Turn-timer deadline (epoch ms) when armed; null when no timer applies. */
  turnDeadline?: number | null;
  showdown?: PokerShowdown;
  handResult?: PokerHandResult;
}

/** Private per-socket state: the receiving player's hole cards only. */
export interface PokerPrivateState {
  holeCards?: PlayingCard[];
}

/**
 * Poker player actions. BET carries the raise-TO total for the street
 * (a open bet is just a raise-to over the zero current bet).
 */
export type PokerAction =
  | { type: 'START_HAND' }
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'BET'; amount: number }
  | { type: 'ALL_IN' }
  | { type: 'SHOW' }
  | { type: 'MUCK' }
  | { type: 'POT_AWARD'; targetIds: string[] }
  | { type: 'REBUY'; targetId: string }
  | { type: 'ADJUST_CHIPS'; targetId: string; amount: number }
  | { type: 'END_MATCH' };
