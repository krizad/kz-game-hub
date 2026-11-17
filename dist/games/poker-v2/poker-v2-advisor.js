"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countImprovingOuts = countImprovingOuts;
exports.detectDraws = detectDraws;
exports.simulateEquity = simulateEquity;
exports.buildAdvisor = buildAdvisor;
const crypto_1 = require("crypto");
const poker_engine_1 = require("../poker/poker-engine");
const RANK_VALUES = {
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
const ALL_SUITS = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];
const ALL_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function cardKey(card) {
    return `${card.rank}-${card.suit}`;
}
function countImprovingOuts(known, current) {
    if (known.length < 5)
        return 0;
    const knownKeys = new Set(known.map(cardKey));
    let outs = 0;
    for (const rank of ALL_RANKS) {
        for (const suit of ALL_SUITS) {
            const key = cardKey({ rank, suit });
            if (knownKeys.has(key))
                continue;
            const catIndex = (0, poker_engine_1.evaluateHand)([...known, { id: `adv-${key}`, rank, suit }]).catIndex;
            if (catIndex > current.catIndex)
                outs += 1;
        }
    }
    return outs;
}
function hyperProb(outs, unknown, toCome) {
    if (toCome <= 0 || outs <= 0)
        return 0;
    if (outs >= unknown)
        return 1;
    if (toCome === 1)
        return outs / unknown;
    let logMiss = 0;
    for (let i = 0; i < toCome; i++) {
        logMiss += Math.log((unknown - outs - i) / (unknown - i));
    }
    return 1 - Math.exp(logMiss);
}
function bothCardsProb(outs, unknown, toCome) {
    if (toCome < 2 || outs < 2 || outs >= unknown)
        return 0;
    let logProb = 0;
    for (let i = 0; i < 2; i++) {
        logProb += Math.log((outs - i) / (unknown - i));
    }
    return Math.exp(logProb);
}
function rankValue(rank) {
    return RANK_VALUES[rank];
}
function suitCounts(cards) {
    const counts = {};
    for (const c of cards)
        counts[c.suit] = (counts[c.suit] ?? 0) + 1;
    return counts;
}
function containsStraight(values) {
    const unique = [...new Set(values)].sort((a, b) => b - a);
    if (unique.includes(14) &&
        unique.includes(5) &&
        unique.includes(4) &&
        unique.includes(3) &&
        unique.includes(2)) {
        return true;
    }
    let run = 1;
    for (let i = 1; i < unique.length; i++) {
        run = unique[i] === unique[i - 1] - 1 ? run + 1 : 1;
        if (run >= 5)
            return true;
    }
    return false;
}
function remainingOfRank(rank, known) {
    return 4 - known.filter((c) => c.rank === rank).length;
}
function detectDraws(hole, board, currentCatIndex) {
    const known = [...hole, ...board];
    const unknown = 52 - known.length;
    const toCome = 5 - board.length;
    const draws = [];
    if (toCome <= 0)
        return draws;
    if (hole.length === 2 && hole[0].rank === hole[1].rank && currentCatIndex === 1) {
        const outs = remainingOfRank(hole[0].rank, known);
        draws.push({
            id: 'SET_DRAW',
            outs,
            probNext: outs / unknown,
            probByRiver: hyperProb(outs, unknown, toCome),
        });
    }
    if (board.length === 0)
        return draws;
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
    if (board.length >= 3 && currentCatIndex < 4) {
        let straightOuts = 0;
        for (const rank of ALL_RANKS) {
            if (known.some((c) => c.rank === rank))
                continue;
            const probeValues = [...known, { rank, suit: 'SPADES' }].map((c) => rankValue(c.rank));
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
        }
        else if (straightOuts >= 4) {
            draws.push({
                id: 'GUTSHOT',
                outs: straightOuts,
                probNext: straightOuts / unknown,
                probByRiver: hyperProb(straightOuts, unknown, toCome),
            });
        }
    }
    if (currentCatIndex === 1 &&
        board.length >= 3 &&
        !(hole.length === 2 && hole[0].rank === hole[1].rank)) {
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
function simulateEquity(live, board, iterations) {
    const shares = new Map();
    if (live.length === 0)
        return shares;
    const runout = 5 - board.length;
    const results = new Map();
    const defaultIters = Math.max(60, Math.min(400, Math.floor(120000 / (live.length * live.length * 21))));
    for (const entry of live) {
        const excluded = new Set([...board, ...entry.holeCards].map(cardKey));
        const pool = [];
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
            const draw = [...pool];
            for (let i = 0; i < need; i++) {
                const j = i + (0, crypto_1.randomInt)(draw.length - i);
                [draw[i], draw[j]] = [draw[j], draw[i]];
            }
            const fullBoard = [...board];
            for (let i = 0; i < runout; i++)
                fullBoard.push(draw[2 * opponents + i]);
            const best = (0, poker_engine_1.evaluateHand)([...entry.holeCards, ...fullBoard]);
            let tieCount = 0;
            let loses = false;
            for (let o = 0; o < opponents; o++) {
                const rival = (0, poker_engine_1.evaluateHand)([draw[2 * o], draw[2 * o + 1], ...fullBoard]);
                const cmp = (0, poker_engine_1.compareEvaluations)(rival, best);
                if (cmp > 0) {
                    loses = true;
                    break;
                }
                if (cmp === 0)
                    tieCount += 1;
            }
            if (!loses)
                score += 1 / (1 + tieCount);
        }
        results.set(entry.socketId, score / iters);
    }
    return results;
}
function evaluateHoleOnly(hole) {
    const pair = hole.length === 2 && hole[0].rank === hole[1].rank;
    return {
        category: pair ? 'ONE_PAIR' : 'HIGH_CARD',
        catIndex: pair ? 1 : 0,
        tiebreak: [...hole].map((c) => rankValue(c.rank)).sort((a, b) => b - a),
        best: [...hole].sort((a, b) => rankValue(b.rank) - rankValue(a.rank)),
    };
}
function buildAdvisor(hole, board, equity) {
    const known = [...hole, ...board];
    const current = known.length >= 5 ? (0, poker_engine_1.evaluateHand)(known) : evaluateHoleOnly(hole);
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
//# sourceMappingURL=poker-v2-advisor.js.map