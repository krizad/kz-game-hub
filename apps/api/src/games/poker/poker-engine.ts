import { randomInt } from 'crypto';
import {
  PokerHandCategory,
  PokerPhase,
  PokerPot,
  PokerPublicState,
  PokerSeat,
  PlayingCard,
} from '@repo/types';

/* ------------------------------------------------------------------ */
/* Deck                                                                */
/* ------------------------------------------------------------------ */

export function createDeck(): PlayingCard[] {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
  const suits = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'] as const;
  const deck: PlayingCard[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  return deck;
}

export function shuffleDeck(deck: PlayingCard[]): PlayingCard[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ------------------------------------------------------------------ */
/* Hand evaluation — best 5 of 7 (or fewer)                            */
/* ------------------------------------------------------------------ */

const RANK_VALUES: Record<PlayingCard['rank'], number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const CATEGORY_ORDER: PokerHandCategory[] = [
  'HIGH_CARD',
  'ONE_PAIR',
  'TWO_PAIR',
  'THREE_OF_A_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_OF_A_KIND',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
];

export interface HandEvaluation {
  category: PokerHandCategory;
  /** Category index (0=HIGH_CARD … 9=ROYAL_FLUSH) for numeric comparison. */
  catIndex: number;
  /** Descending tiebreak ranks; compare lexicographically against other hands. */
  tiebreak: number[];
  /** The best five cards, ordered by descending contribution. */
  best: PlayingCard[];
}

/** True when `a` beats `b`. Equal hands compare as 0. */
export function compareEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  if (a.catIndex !== b.catIndex) return a.catIndex - b.catIndex;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreak[i] ?? 0;
    const bv = b.tiebreak[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Best five-card hand from 5–7 cards. Fewer than 5 cards is invalid input. */
export function evaluateHand(cards: PlayingCard[]): HandEvaluation {
  if (cards.length < 5) throw new Error('Need at least 5 cards');
  if (cards.length === 5) return evaluateFive(cards);
  let best: HandEvaluation | null = null;
  for (let i = 0; i < cards.length - 1; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const five = cards.filter((_, idx) => idx !== i && idx !== j);
      const evaluation = evaluateFive(five);
      if (!best || compareEvaluations(evaluation, best) > 0) best = evaluation;
    }
  }
  return best!;
}

function evaluateFive(cards: PlayingCard[]): HandEvaluation {
  const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = new Set(cards.map((c) => c.suit));
  const isFlush = suits.size === 1;

  const straightHigh = straightHighCard(values);
  if (straightHigh !== null && isFlush) {
    return {
      category: straightHigh === 14 ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH',
      catIndex: straightHigh === 14 ? 9 : 8,
      tiebreak: [straightHigh],
      best: straightOrder(cards, straightHigh),
    };
  }

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]) as [
    number,
    number,
  ][];

  const quad = groups.find(([, n]) => n === 4);
  if (quad) {
    return {
      category: 'FOUR_OF_A_KIND',
      catIndex: 7,
      tiebreak: [quad[0], groups.find(([v]) => v !== quad[0])![0]],
      best: groupedOrder(cards, counts, [quad[0], groups.find(([v]) => v !== quad[0])![0]]),
    };
  }

  const trips = groups.filter(([, n]) => n === 3);
  const pair = groups.find(([, n]) => n === 2);
  if (trips.length >= 2 || (trips.length === 1 && pair)) {
    const topTrip = trips[0][0];
    const pairValue = trips.length >= 2 ? trips[1][0] : pair![0];
    return {
      category: 'FULL_HOUSE',
      catIndex: 6,
      tiebreak: [topTrip, pairValue],
      best: groupedOrder(cards, counts, [topTrip, pairValue]),
    };
  }

  if (isFlush) {
    return { category: 'FLUSH', catIndex: 5, tiebreak: values, best: byValueDesc(cards, values) };
  }

  if (straightHigh !== null) {
    return {
      category: 'STRAIGHT',
      catIndex: 4,
      tiebreak: [straightHigh],
      best: straightOrder(cards, straightHigh),
    };
  }

  if (trips.length === 1) {
    const kickers = groups.filter(([v]) => v !== trips[0][0]).map(([v]) => v);
    return {
      category: 'THREE_OF_A_KIND',
      catIndex: 3,
      tiebreak: [trips[0][0], ...kickers],
      best: groupedOrder(cards, counts, [trips[0][0], ...kickers]),
    };
  }

  const pairs = groups.filter(([, n]) => n === 2);
  if (pairs.length === 2) {
    const kickers = groups.filter(([v]) => v !== pairs[0][0] && v !== pairs[1][0]).map(([v]) => v);
    return {
      category: 'TWO_PAIR',
      catIndex: 2,
      tiebreak: [pairs[0][0], pairs[1][0], ...kickers],
      best: groupedOrder(cards, counts, [pairs[0][0], pairs[1][0], ...kickers]),
    };
  }

  if (pairs.length === 1) {
    const kickers = groups.filter(([v]) => v !== pairs[0][0]).map(([v]) => v);
    return {
      category: 'ONE_PAIR',
      catIndex: 1,
      tiebreak: [pairs[0][0], ...kickers],
      best: groupedOrder(cards, counts, [pairs[0][0], ...kickers]),
    };
  }

  return { category: 'HIGH_CARD', catIndex: 0, tiebreak: values, best: byValueDesc(cards, values) };
}

/** Highest straight top card in the (sorted desc) value list, wheel included; null if none. */
function straightHighCard(valuesDesc: number[]): number | null {
  const unique = [...new Set(valuesDesc)].sort((a, b) => b - a);
  // Wheel: A-2-3-4-5 counts as a 5-high straight.
  if (
    unique.includes(14) &&
    unique.includes(5) &&
    unique.includes(4) &&
    unique.includes(3) &&
    unique.includes(2)
  ) {
    return 5;
  }
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    run = unique[i] === unique[i - 1] - 1 ? run + 1 : 1;
    if (run >= 5) return unique[i] + 4;
  }
  return null;
}

function byValueDesc(cards: PlayingCard[], valuesDesc: number[]): PlayingCard[] {
  return [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
}

/** Order cards for straights: from the top card of the straight downward. */
function straightOrder(cards: PlayingCard[], high: number): PlayingCard[] {
  const picked: PlayingCard[] = [];
  for (let v = high; v > high - 5; v--) {
    const target = v === 14 ? 14 : v;
    const card = cards.find((c) => RANK_VALUES[c.rank] === target && !picked.includes(c));
    // Wheel (5-high): the ace plays low, so pick it for the "1" slot.
    if (card) {
      picked.push(card);
    } else if (v === 1 || (high === 5 && v === 5)) {
      const ace = cards.find((c) => RANK_VALUES[c.rank] === 14);
      if (ace) picked.push(ace);
    }
  }
  return picked;
}

/** Order cards grouped by the requested rank values (groups descending), kickers after. */
function groupedOrder(
  cards: PlayingCard[],
  counts: Map<number, number>,
  orderedValues: number[],
): PlayingCard[] {
  const used = new Set<number>();
  const result: PlayingCard[] = [];
  for (const value of orderedValues) {
    if (used.has(value)) continue;
    used.add(value);
    const group = cards.filter((c) => RANK_VALUES[c.rank] === value);
    result.push(...group);
  }
  // Trim to five in case kickers overfill (should not happen with 5-card input).
  return result.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* Side pots                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build the pot ladder from this hand's contributions. Folded seats
 * contribute their chips to every level they reached but are eligible for
 * none. Levels ascend by unique contribution totals.
 */
export function buildSidePots(seats: Record<string, PokerSeat>): PokerPot[] {
  const entries = Object.entries(seats).filter(([, seat]) => seat.totalBet > 0);
  if (entries.length === 0) return [];

  const levels = [...new Set(entries.map(([, seat]) => seat.totalBet))].sort((a, b) => a - b);
  const pots: PokerPot[] = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const [, seat] of entries) {
      amount += Math.min(seat.totalBet, level) - Math.min(seat.totalBet, previous);
    }
    const eligible = entries
      .filter(
        ([id, seat]) => seat.status !== 'FOLDED' && seat.status !== 'OUT' && seat.totalBet >= level,
      )
      .map(([id]) => id);
    if (amount > 0) {
      if (eligible.length > 0) {
        pots.push({ amount, eligiblePlayerIds: eligible });
      } else if (pots.length > 0) {
        // Dead money (everyone who reached this level folded) merges into the
        // lowest existing pot.
        pots[pots.length - 1].amount += amount;
      } else {
        // Everyone folded at this level: it belongs to whoever remains.
        const remaining = entries.filter(([, seat]) => seat.status !== 'FOLDED');
        pots.push({
          amount,
          eligiblePlayerIds: remaining.map(([id]) => id),
        });
      }
    }
    previous = level;
  }
  // Merge adjacent pots with identical eligibility (display cleanliness).
  const merged: PokerPot[] = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && sameIds(last.eligiblePlayerIds, pot.eligiblePlayerIds)) {
      last.amount += pot.amount;
    } else {
      merged.push(pot);
    }
  }
  return merged;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Portion of the top contributor's bet that nobody matched (returned to them). */
export function uncalledBetPortion(
  seats: Record<string, PokerSeat>,
): { playerId: string; amount: number } | null {
  const totals = Object.entries(seats)
    .map(([id, seat]) => ({ id, totalBet: seat.totalBet }))
    .sort((a, b) => b.totalBet - a.totalBet);
  if (totals.length < 2) return null;
  const top = totals[0];
  const second = totals[1].totalBet;
  if (top.totalBet > second) return { playerId: top.id, amount: top.totalBet - second };
  return null;
}

/* ------------------------------------------------------------------ */
/* Betting round state                                                 */
/* ------------------------------------------------------------------ */

export const POKER_STREETS: PokerPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

export function isStreetPhase(phase: PokerPhase): boolean {
  return POKER_STREETS.includes(phase);
}

export function nextStreet(phase: PokerPhase): PokerPhase | null {
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
export function actableSeats(state: PokerPublicState): string[] {
  return state.playerOrder.filter((id) => {
    const seat = state.seats[id];
    return seat && seat.status === 'ACTIVE';
  });
}

/**
 * Whether the current betting round is closed: every actionable seat has
 * acted and matched the current bet — or no actionable seats remain.
 */
export function bettingRoundComplete(state: PokerPublicState): boolean {
  const inHand = state.playerOrder.filter((id) => {
    const seat = state.seats[id];
    return seat.status === 'ACTIVE' || seat.status === 'ALL_IN';
  });
  if (inHand.length <= 1) return true;
  const actionable = actableSeats(state);
  if (actionable.length === 0) return true;
  if (actionable.length === 1) {
    // One non-all-in seat left: betting ends once they matched the largest
    // all-in commitment (no one left to act behind them).
    const seat = state.seats[actionable[0]];
    return seat.hasActed && seat.bet >= state.currentBet;
  }
  return actionable.every((id) => {
    const seat = state.seats[id];
    return seat.hasActed && seat.bet === state.currentBet;
  });
}

/**
 * Whether any betting remains possible: two+ seats can still act. Used to
 * decide between opening the next street and dealing out the all-in runout.
 */
export function bettingPossible(state: PokerPublicState): boolean {
  return actableSeats(state).length >= 2;
}

export interface PokerLegalMoves {
  canFold: boolean;
  canCheck: boolean;
  callAmount: number;
  canBet: boolean;
  /** Legal raise-TO range (inclusive) for the current street. */
  minRaiseTo: number;
  maxRaiseTo: number;
  isAllInCall: boolean;
}

export function legalMoves(state: PokerPublicState, playerId: string): PokerLegalMoves | null {
  const seat = state.seats[playerId];
  if (!seat || seat.status !== 'ACTIVE') return null;
  const toCall = Math.max(0, state.currentBet - seat.bet);
  const callAmount = Math.min(toCall, seat.chips);
  const maxRaiseTo = seat.chips + seat.bet; // shove
  const canCheck = toCall === 0;
  // Betting only makes sense when someone else can still respond; facing an
  // all-in with nothing to match, a "raise" would be dead money.
  const othersActive = state.playerOrder.some(
    (id) => id !== playerId && state.seats[id].status === 'ACTIVE',
  );
  const minRaiseTo = Math.min(Math.max(state.minRaiseTo, state.currentBet + 1), maxRaiseTo);
  return {
    canFold: true,
    canCheck,
    callAmount,
    canBet: othersActive && maxRaiseTo > state.currentBet,
    minRaiseTo,
    maxRaiseTo,
    isAllInCall: toCall > seat.chips,
  };
}

/** The auto-action for the seat when its turn timer expires: check if legal, else fold. */
export function autoAction(state: PokerPublicState): 'CHECK' | 'FOLD' {
  const moves = legalMoves(state, state.activePlayerId ?? '');
  return moves?.canCheck ? 'CHECK' : 'FOLD';
}
