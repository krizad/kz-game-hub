import {
  buildSidePots,
  compareEvaluations,
  evaluateHand,
  legalMoves,
  uncalledBetPortion,
} from './poker-engine';
import { PokerPublicState, PokerSeat, PlayingCard } from '@repo/types';

const card = (rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard => ({
  id: `${rank}-${suit}`,
  rank,
  suit,
});

function seat(overrides: Partial<PokerSeat> = {}): PokerSeat {
  return {
    chips: 0,
    bet: 0,
    totalBet: 0,
    status: 'ACTIVE',
    hasActed: false,
    ...overrides,
  };
}

function makeState(
  seats: Record<string, PokerSeat>,
  overrides: Partial<PokerPublicState> = {},
): PokerPublicState {
  return {
    mode: 'ONLINE',
    phase: 'FLOP',
    handNumber: 1,
    playerOrder: Object.keys(seats),
    seats,
    dealerId: null,
    activePlayerId: null,
    currentBet: 0,
    minRaiseTo: 20,
    pot: 0,
    board: [],
    smallBlind: 10,
    bigBlind: 20,
    ante: 0,
    turnDeadline: null,
    ...overrides,
  };
}

describe('poker-engine hand evaluation', () => {
  it('ranks royal flush above straight flush', () => {
    const royal = [
      card('10', 'SPADES'),
      card('J', 'SPADES'),
      card('Q', 'SPADES'),
      card('K', 'SPADES'),
      card('A', 'SPADES'),
    ];
    const wheel = [
      card('A', 'HEARTS'),
      card('2', 'HEARTS'),
      card('3', 'HEARTS'),
      card('4', 'HEARTS'),
      card('5', 'HEARTS'),
    ];
    expect(compareEvaluations(evaluateHand(royal), evaluateHand(wheel))).toBeGreaterThan(0);
    expect(evaluateHand(royal).category).toBe('ROYAL_FLUSH');
  });

  it('plays the wheel (A-2-3-4-5) as a five-high straight', () => {
    const wheel = [
      card('A', 'SPADES'),
      card('2', 'HEARTS'),
      card('3', 'DIAMONDS'),
      card('4', 'CLUBS'),
      card('5', 'SPADES'),
    ];
    const evalWheel = evaluateHand(wheel);
    expect(evalWheel.category).toBe('STRAIGHT');
    expect(evalWheel.tiebreak).toEqual([5]);
  });

  it('picks the best 5 of 7 (two pair over one pair)', () => {
    const seven = [
      card('A', 'SPADES'),
      card('A', 'HEARTS'),
      card('K', 'DIAMONDS'),
      card('K', 'CLUBS'),
      card('2', 'SPADES'),
      card('7', 'HEARTS'),
      card('9', 'CLUBS'),
    ];
    const evaluation = evaluateHand(seven);
    expect(evaluation.category).toBe('TWO_PAIR');
    expect(evaluation.tiebreak).toEqual([14, 13, 9]);
  });

  it('finds the flush among 7 cards', () => {
    const seven = [
      card('2', 'SPADES'),
      card('5', 'SPADES'),
      card('9', 'SPADES'),
      card('J', 'SPADES'),
      card('K', 'SPADES'),
      card('A', 'HEARTS'),
      card('A', 'DIAMONDS'),
    ];
    expect(evaluateHand(seven).category).toBe('FLUSH');
  });

  it('full house beats flush and splits trips correctly', () => {
    const full = [
      card('8', 'SPADES'),
      card('8', 'HEARTS'),
      card('8', 'DIAMONDS'),
      card('K', 'CLUBS'),
      card('K', 'SPADES'),
    ];
    const flush = [
      card('A', 'CLUBS'),
      card('J', 'CLUBS'),
      card('9', 'CLUBS'),
      card('7', 'CLUBS'),
      card('3', 'CLUBS'),
    ];
    expect(compareEvaluations(evaluateHand(full), evaluateHand(flush))).toBeGreaterThan(0);
  });
});

describe('poker-engine side pots', () => {
  it('builds a main pot and side pot from differing all-in levels', () => {
    const seats: Record<string, PokerSeat> = {
      a: seat({ totalBet: 100, status: 'ALL_IN' }),
      b: seat({ totalBet: 100, status: 'ALL_IN' }),
      c: seat({ totalBet: 300, status: 'ALL_IN' }),
      d: seat({ totalBet: 300 }),
    };
    const pots = buildSidePots(seats);
    expect(pots).toHaveLength(2);
    expect(pots[0]).toEqual({ amount: 400, eligiblePlayerIds: ['a', 'b', 'c', 'd'] });
    expect(pots[1].amount).toBe(400);
    expect([...pots[1].eligiblePlayerIds].sort()).toEqual(['c', 'd']);
  });

  it('gives folded contributions to the pot but never eligibility', () => {
    const seats: Record<string, PokerSeat> = {
      a: seat({ totalBet: 50, status: 'FOLDED' }),
      b: seat({ totalBet: 50 }),
    };
    const pots = buildSidePots(seats);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(100);
    expect(pots[0].eligiblePlayerIds).toEqual(['b']);
  });

  it('detects the uncalled portion of the top bet', () => {
    const seats: Record<string, PokerSeat> = {
      a: seat({ totalBet: 250 }),
      b: seat({ totalBet: 100, status: 'FOLDED' }),
      c: seat({ totalBet: 100 }),
    };
    expect(uncalledBetPortion(seats)).toEqual({ playerId: 'a', amount: 150 });
    expect(
      uncalledBetPortion({ a: seat({ totalBet: 100 }), c: seat({ totalBet: 100 }) }),
    ).toBeNull();
  });
});

describe('poker-engine legal moves', () => {
  it('offers check to a matched bet and no raise when alone vs all-ins', () => {
    const state = makeState({
      a: seat({ chips: 500, bet: 0 }),
      b: seat({ chips: 0, bet: 100, totalBet: 100, status: 'ALL_IN' }),
    });
    state.currentBet = 100;
    const moves = legalMoves(state, 'a');
    expect(moves!.canCheck).toBe(false);
    expect(moves!.callAmount).toBe(100);
    expect(moves!.canBet).toBe(false);
  });

  it('caps the min raise at the short stack (all-in below min raise)', () => {
    const state = makeState({
      a: seat({ chips: 60, bet: 0, totalBet: 40 }),
      b: seat({ chips: 900, bet: 100, totalBet: 100 }),
    });
    state.currentBet = 100;
    state.minRaiseTo = 200;
    const moves = legalMoves(state, 'a');
    expect(moves!.minRaiseTo).toBe(60); // short all-in: min raise-to equals max
    expect(moves!.maxRaiseTo).toBe(60);
    expect(moves!.isAllInCall).toBe(true);
  });
});
