import { PlayingCard } from './card-game';
import { PokerHandCategory } from './poker';

/**
 * POKER V2 — streamlined online Texas Hold'em in the spirit of Governor of
 * Poker (the poker table only): hands deal themselves, showdowns reveal
 * automatically, busted seats are eliminated, and the last player holding
 * chips wins the match. One mode (ONLINE), server-dealt cards only.
 */
export type PokerV2Phase = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'HAND_RESULT';

export type PokerV2SeatStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'OUT';

export type PokerV2LastAction =
  | 'ANTE'
  | 'SMALL_BLIND'
  | 'BIG_BLIND'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN'
  | 'FOLD';

export type PokerV2HandCategory = PokerHandCategory;

export interface PokerV2Seat {
  /** Chips behind (not yet committed this street). */
  chips: number;
  /** Committed this street. */
  bet: number;
  /** Committed this hand — the side-pot contribution. */
  totalBet: number;
  status: PokerV2SeatStatus;
  /** Whether the seat has acted in the current betting round. */
  hasActed: boolean;
  /** Short-all-in raise lock (same engine rule as Poker v1). */
  raiseLocked?: boolean;
  lastAction?: PokerV2LastAction;
  lastActionAmount?: number;
  /** Set automatically at showdown for every live seat. */
  handCategory?: PokerV2HandCategory;
  handRank?: number;
}

export interface PokerV2Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PokerV2PotResult {
  amount: number;
  winnerIds: string[];
  eligiblePlayerIds?: string[];
  handCategory?: PokerV2HandCategory;
  bestCards?: PlayingCard[];
}

export interface PokerV2HandResult {
  pots: PokerV2PotResult[];
  /** Portion of the last bet nobody matched, returned before pot creation. */
  uncalledRefund?: { playerId: string; amount: number };
  /** Set when the match ended with this hand (one player holds every chip). */
  matchEnded?: boolean;
}

/** A draw the advisor detected: what you might still make, and the odds. */
export interface PokerV2AdvisorDraw {
  /** Stable draw id: FLUSH_DRAW, BACKDOOR_FLUSH, OPEN_ENDED, GUTSHOT, PAIR_TRIPS, etc. */
  id: string;
  /** Server-computed outs that complete this draw. */
  outs: number;
  /** Chance the next single card completes the draw (0–1). */
  probNext: number;
  /** Chance to complete by the river given remaining cards (0–1). */
  probByRiver: number;
}

/**
 * Private per-socket advisor payload: the current made hand and the
 * potential winning hands still within reach. Computed on the server from
 * the player's hole cards plus the public board — never broadcast.
 */
export interface PokerV2Advisor {
  /** The best five-card hand right now. */
  currentCategory: PokerV2HandCategory;
  currentBest: PlayingCard[];
  /** Estimated win probability vs the live opponents (0–1, Monte Carlo). */
  winProbability: number;
  /** Number of unknown cards that improve the current hand class. */
  outs: number;
  /** Chance the hand improves to a stronger class by the river (0–1). */
  improveProbByRiver: number;
  /** The concrete draws within reach, strongest first. */
  draws: PokerV2AdvisorDraw[];
}

/** Private per-socket state: hole cards + the hand-strength advisor. */
export interface PokerV2PrivateState {
  holeCards?: PlayingCard[];
  advisor?: PokerV2Advisor;
}

/** Broadcast state. Never contains the deck order or unrevealed hole cards. */
export interface PokerV2PublicState {
  phase: PokerV2Phase;
  handNumber: number;
  playerOrder: string[];
  seats: Record<string, PokerV2Seat>;
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
  /** Auto next-hand deal deadline (epoch ms) while in HAND_RESULT; null otherwise. */
  nextHandDeadline?: number | null;
  /** Seconds until the next hand auto-deals (for the countdown label). */
  nextHandSeconds?: number;
  showdown?: {
    /** Every live seat's cards are revealed automatically at showdown. */
    revealedCards: Record<string, PlayingCard[]>;
  };
  handResult?: PokerV2HandResult;
}

/**
 * Poker V2 player actions. BET carries the raise-TO total for the street.
 * START_HAND stays host-only as a "deal now" skip button for the countdown.
 */
export type PokerV2Action =
  | { type: 'START_HAND' }
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'BET'; amount: number }
  | { type: 'ALL_IN' }
  | { type: 'END_MATCH' };
