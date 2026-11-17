import { randomInt } from 'crypto';
import { PlayingCard, PokerV2Advisor, PokerV2AdvisorDraw } from '@repo/types';
import { compareEvaluations, evaluateHand, HandEvaluation } from '../poker/poker-engine';

/** Mirrors poker-engine's rank ladder (not exported there). */
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

const ALL_SUITS = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'] as const;
const ALL_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

function cardKey(card: Pick<PlayingCard, 'rank' | 'suit'>): string {
  return `${card.rank}-${card.suit}`;
}

/* ------------------------------------------------------------------ */
/* Exact outs enumeration                                              */
/* ------------------------------------------------------------------ */

/** Number of unseen cards that would lift the current hand to a higher class. */
export function countImprovingOuts(known: PlayingCard[], current: HandEvaluation): number {
  if (known.length < 5) return 0; // preflop: too speculative to enumerate
  const knownKeys = new Set(known.map(cardKey));
  let outs = 0;
  for (const rank of ALL_RANKS) {
    for (const suit of ALL_SUITS) {
      const key = cardKey({ rank, suit });
      if (knownKeys.has(key)) continue;
      const catIndex = evaluateHand([...known, { id: `adv-${key}`, rank, suit }]).catIndex;
      if (catIndex > current.catIndex) outs += 1;
    }
  }
  return outs;
}

/** P(at least one of `outs` of the `unknown` cards lands in `toCome` draws). */
function hyperProb(outs: number, unknown: number, toCome: number): number {
  if (toCome <= 0 || outs <= 0) return 0;
  if (outs >= unknown) return 1;
  if (toCome === 1) return outs / unknown;
  // 1 - C(unknown-outs, toCome) / C(unknown, toCome), log-space product.
  let logMiss = 0;
  for (let i = 0; i < toCome; i++) {
    logMiss += Math.log((unknown - outs - i) / (unknown - i));
  }
  return 1 - Math.exp(logMiss);
}

/** P(a specific `outs`-sized draw needs BOTH remaining cards, e.g. backdoor). */
function bothCardsProb(outs: number, unknown: number, toCome: number): number {
  if (toCome < 2 || outs < 2 || outs >= unknown) return 0;
  let logProb = 0;
  for (let i = 0; i < 2; i++) {
    logProb += Math.log((outs - i) / (unknown - i));
  }
  return Math.exp(logProb);
}

/* ------------------------------------------------------------------ */
/* Named draw detection                                                */
/* ------------------------------------------------------------------ */

function rankValue(rank: PlayingCard['rank']): number {
  return RANK_VALUES[rank];
}

function suitCounts(cards: PlayingCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.suit] = (counts[c.suit] ?? 0) + 1;
  return counts;
}

/** True when the 5+ card set contains a 5-run (wheel included). */
function containsStraight(values: number[]): boolean {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (
    unique.includes(14) &&
    unique.includes(5) &&
    unique.includes(4) &&
    unique.includes(3) &&
    unique.includes(2)
  ) {
    return true;
  }
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    run = unique[i] === unique[i - 1] - 1 ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
}

/** The remaining multiplicity of `rank` among unseen cards. */
function remainingOfRank(rank: PlayingCard['rank'], known: PlayingCard[]): number {
  return 4 - known.filter((c) => c.rank === rank).length;
}

/**
 * Classic draws still within reach, strongest first. `currentCatIndex` is the
 * made-hand class index (0 = high card … 9 = royal flush); preflop the only
 * meaningful named draw is a pocket pair heading for a set.
 */
export function detectDraws(
  hole: PlayingCard[],
  board: PlayingCard[],
  currentCatIndex: number,
): PokerV2AdvisorDraw[] {
  const known = [...hole, ...board];
  const unknown = 52 - known.length;
  const toCome = 5 - board.length;
  const draws: PokerV2AdvisorDraw[] = [];

  if (toCome <= 0) return draws; // river: nothing left to draw to

  // Pocket pair heading for trips / quads (any street before the river).
  if (hole.length === 2 && hole[0].rank === hole[1].rank && currentCatIndex === 1) {
    const outs = remainingOfRank(hole[0].rank, known);
    draws.push({
      id: 'SET_DRAW',
      outs,
      probNext: outs / unknown,
      probByRiver: hyperProb(outs, unknown, toCome),
    });
  }

  if (board.length === 0) return draws;

  // One-card flush draw: four to a suit without a made flush.
  const counts = suitCounts(known);
  const madeFlush = currentCatIndex >= 5;
  for (const suit of ALL_SUITS) {
    const n = counts[suit] ?? 0;
    if (n === 4 && !madeFlush) {
      const outs = 13 - n;
      draws.push({
        id: 'FLUSH_DRAW',
        outs,
        probNext: outs / unknown,
        probByRiver: hyperProb(outs, unknown, toCome),
      });
    }
    if (n === 3 && toCome >= 2 && !madeFlush) {
      draws.push({
        id: 'BACKDOOR_FLUSH',
        outs: 13 - n,
        probByRiver: bothCardsProb(13 - n, unknown, toCome),
        probNext: 0,
      });
    }
  }

  // Straight outs: which single ranks complete a 5-run in the 7–8 card set.
  if (board.length >= 3 && currentCatIndex < 4) {
    let straightOuts = 0;
    for (const rank of ALL_RANKS) {
      if (known.some((c) => c.rank === rank)) continue;
      const probeValues = [...known, { rank, suit: 'SPADES' as const }].map((c) =>
        rankValue(c.rank),
      );
      if (containsStraight(probeValues)) {
        straightOuts += remainingOfRank(rank, known);
      }
    }
    if (straightOuts >= 8) {
      draws.push({
        id: 'OPEN_ENDED_STRAIGHT',
        outs: straightOuts,
        probNext: straightOuts / unknown,
        probByRiver: hyperProb(straightOuts, unknown, toCome),
      });
    } else if (straightOuts >= 4) {
      draws.push({
        id: 'GUTSHOT',
        outs: straightOuts,
        probNext: straightOuts / unknown,
        probByRiver: hyperProb(straightOuts, unknown, toCome),
      });
    }
  }

  // One pair with a second live hole rank: catch it for two pair.
  if (
    currentCatIndex === 1 &&
    board.length >= 3 &&
    !(hole.length === 2 && hole[0].rank === hole[1].rank)
  ) {
    const boardRanks = new Set(board.map((c) => c.rank));
    const other = hole.find((c) => !board.some((bc) => bc.rank === c.rank));
    if (other && !boardRanks.has(other.rank)) {
      const outs = remainingOfRank(other.rank, known);
      if (outs > 0) {
        draws.push({
          id: 'TWO_PAIR_DRAW',
          outs,
          probNext: outs / unknown,
          probByRiver: hyperProb(outs, unknown, toCome),
        });
      }
    }
  }

  return draws;
}

/* ------------------------------------------------------------------ */
/* Win probability (Monte Carlo equity vs the live field)              */
/* ------------------------------------------------------------------ */

export interface EquityEntry {
  socketId: string;
  holeCards: PlayingCard[];
}

/**
 * Estimate every live player's equity from that player's own perspective:
 * their real hole cards against random opponents (and a random board
 * runout), which is exactly the information the player has at the table.
 * Opponents' actual hole cards never influence a player's own estimate —
 * the deck pool only excludes the board and that player's own cards.
 */
export function simulateEquity(
  live: EquityEntry[],
  board: PlayingCard[],
  iterations?: number,
): Map<string, number> {
  const shares = new Map<string, number>();
  if (live.length === 0) return shares;

  const runout = 5 - board.length;
  const results = new Map<string, number>();

  // Per-player simulation budget keeps the total evaluation cost bounded
  // (~120k five-card evaluations) regardless of table size.
  const defaultIters = Math.max(
    60,
    Math.min(400, Math.floor(120000 / (live.length * live.length * 21))),
  );

  for (const entry of live) {
    // Pool: everything the player cannot see (their own cards are known).
    const excluded = new Set<string>([...board, ...entry.holeCards].map(cardKey));
    const pool: PlayingCard[] = [];
    for (const rank of ALL_RANKS) {
      for (const suit of ALL_SUITS) {
        if (!excluded.has(cardKey({ rank, suit }))) {
          pool.push({ id: `pool-${rank}-${suit}`, rank, suit });
        }
      }
    }

    const opponents = live.length - 1;
    const need = 2 * opponents + runout;
    if (pool.length < need + 5) {
      results.set(entry.socketId, 1 / live.length);
      continue;
    }

    const iters = iterations ?? defaultIters;
    let score = 0;

    for (let iter = 0; iter < iters; iter++) {
      // Partial Fisher-Yates over a local copy of the unknown cards.
      const draw = [...pool];
      for (let i = 0; i < need; i++) {
        const j = i + randomInt(draw.length - i);
        [draw[i], draw[j]] = [draw[j], draw[i]];
      }

      const fullBoard: PlayingCard[] = [...board];
      for (let i = 0; i < runout; i++) fullBoard.push(draw[2 * opponents + i]);

      // Preflop the board is empty here — the runout completes the hand.
      const best = evaluateHand([...entry.holeCards, ...fullBoard]);
      let tieCount = 0;
      let loses = false;
      for (let o = 0; o < opponents; o++) {
        const rival = evaluateHand([draw[2 * o], draw[2 * o + 1], ...fullBoard]);
        const cmp = compareEvaluations(rival, best);
        if (cmp > 0) {
          loses = true;
          break;
        }
        if (cmp === 0) tieCount += 1;
      }
      if (!loses) score += 1 / (1 + tieCount);
    }

    results.set(entry.socketId, score / iters);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* Advisor assembly                                                    */
/* ------------------------------------------------------------------ */

/** Best made hand when fewer than five cards are known (preflop). */
function evaluateHoleOnly(hole: PlayingCard[]): HandEvaluation {
  const pair = hole.length === 2 && hole[0].rank === hole[1].rank;
  return {
    category: pair ? 'ONE_PAIR' : 'HIGH_CARD',
    catIndex: pair ? 1 : 0,
    tiebreak: [...hole].map((c) => rankValue(c.rank)).sort((a, b) => b - a),
    best: [...hole].sort((a, b) => rankValue(b.rank) - rankValue(a.rank)),
  };
}

/**
 * Build one player's advisor: current made hand + what it can still become.
 * `equity` comes from the shared simulation (or exact river comparison).
 */
export function buildAdvisor(
  hole: PlayingCard[],
  board: PlayingCard[],
  equity: number,
): PokerV2Advisor {
  const known = [...hole, ...board];
  const current = known.length >= 5 ? evaluateHand(known) : evaluateHoleOnly(hole);
  const unknown = 52 - known.length;
  const toCome = 5 - board.length;

  const outs = countImprovingOuts(known, current);
  const improveProbByRiver = board.length >= 3 ? hyperProb(outs, unknown, toCome) : 0;
  const draws = detectDraws(hole, board, current.catIndex);

  return {
    currentCategory: current.category,
    currentBest: current.best,
    winProbability: Math.round(equity * 1000) / 1000,
    outs,
    improveProbByRiver: Math.round(improveProbByRiver * 1000) / 1000,
    draws,
  };
}
