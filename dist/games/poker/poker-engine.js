"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POKER_STREETS = void 0;
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.compareEvaluations = compareEvaluations;
exports.evaluateHand = evaluateHand;
exports.buildSidePots = buildSidePots;
exports.uncalledBetPortion = uncalledBetPortion;
exports.isStreetPhase = isStreetPhase;
exports.nextStreet = nextStreet;
exports.actableSeats = actableSeats;
exports.bettingRoundComplete = bettingRoundComplete;
exports.bettingPossible = bettingPossible;
exports.legalMoves = legalMoves;
exports.autoAction = autoAction;
const crypto_1 = require("crypto");
function createDeck() {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ id: `${rank}-${suit}`, rank, suit });
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = (0, crypto_1.randomInt)(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
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
const CATEGORY_ORDER = [
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
function compareEvaluations(a, b) {
    if (a.catIndex !== b.catIndex)
        return a.catIndex - b.catIndex;
    const len = Math.max(a.tiebreak.length, b.tiebreak.length);
    for (let i = 0; i < len; i++) {
        const av = a.tiebreak[i] ?? 0;
        const bv = b.tiebreak[i] ?? 0;
        if (av !== bv)
            return av - bv;
    }
    return 0;
}
function evaluateHand(cards) {
    if (cards.length < 5)
        throw new Error('Need at least 5 cards');
    if (cards.length === 5)
        return evaluateFive(cards);
    let best = null;
    for (let i = 0; i < cards.length - 1; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            const five = cards.filter((_, idx) => idx !== i && idx !== j);
            const evaluation = evaluateFive(five);
            if (!best || compareEvaluations(evaluation, best) > 0)
                best = evaluation;
        }
    }
    return best;
}
function evaluateFive(cards) {
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
    const counts = new Map();
    for (const v of values)
        counts.set(v, (counts.get(v) ?? 0) + 1);
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const quad = groups.find(([, n]) => n === 4);
    if (quad) {
        return {
            category: 'FOUR_OF_A_KIND',
            catIndex: 7,
            tiebreak: [quad[0], groups.find(([v]) => v !== quad[0])[0]],
            best: groupedOrder(cards, counts, [quad[0], groups.find(([v]) => v !== quad[0])[0]]),
        };
    }
    const trips = groups.filter(([, n]) => n === 3);
    const pair = groups.find(([, n]) => n === 2);
    if (trips.length >= 2 || (trips.length === 1 && pair)) {
        const topTrip = trips[0][0];
        const pairValue = trips.length >= 2 ? trips[1][0] : pair[0];
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
function straightHighCard(valuesDesc) {
    const unique = [...new Set(valuesDesc)].sort((a, b) => b - a);
    if (unique.includes(14) &&
        unique.includes(5) &&
        unique.includes(4) &&
        unique.includes(3) &&
        unique.includes(2)) {
        return 5;
    }
    let run = 1;
    for (let i = 1; i < unique.length; i++) {
        run = unique[i] === unique[i - 1] - 1 ? run + 1 : 1;
        if (run >= 5)
            return unique[i] + 4;
    }
    return null;
}
function byValueDesc(cards, valuesDesc) {
    return [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
}
function straightOrder(cards, high) {
    const picked = [];
    for (let v = high; v > high - 5; v--) {
        const target = v === 14 ? 14 : v;
        const card = cards.find((c) => RANK_VALUES[c.rank] === target && !picked.includes(c));
        if (card) {
            picked.push(card);
        }
        else if (v === 1 || (high === 5 && v === 5)) {
            const ace = cards.find((c) => RANK_VALUES[c.rank] === 14);
            if (ace)
                picked.push(ace);
        }
    }
    return picked;
}
function groupedOrder(cards, counts, orderedValues) {
    const used = new Set();
    const result = [];
    for (const value of orderedValues) {
        if (used.has(value))
            continue;
        used.add(value);
        const group = cards.filter((c) => RANK_VALUES[c.rank] === value);
        result.push(...group);
    }
    return result.slice(0, 5);
}
function buildSidePots(seats) {
    const entries = Object.entries(seats).filter(([, seat]) => seat.totalBet > 0);
    if (entries.length === 0)
        return [];
    const levels = [...new Set(entries.map(([, seat]) => seat.totalBet))].sort((a, b) => a - b);
    const pots = [];
    let previous = 0;
    for (const level of levels) {
        let amount = 0;
        for (const [, seat] of entries) {
            amount += Math.min(seat.totalBet, level) - Math.min(seat.totalBet, previous);
        }
        const eligible = entries
            .filter(([id, seat]) => seat.status !== 'FOLDED' && seat.status !== 'OUT' && seat.totalBet >= level)
            .map(([id]) => id);
        if (amount > 0) {
            if (eligible.length > 0) {
                pots.push({ amount, eligiblePlayerIds: eligible });
            }
            else if (pots.length > 0) {
                pots[pots.length - 1].amount += amount;
            }
            else {
                const remaining = entries.filter(([, seat]) => seat.status !== 'FOLDED');
                pots.push({
                    amount,
                    eligiblePlayerIds: remaining.map(([id]) => id),
                });
            }
        }
        previous = level;
    }
    const merged = [];
    for (const pot of pots) {
        const last = merged[merged.length - 1];
        if (last && sameIds(last.eligiblePlayerIds, pot.eligiblePlayerIds)) {
            last.amount += pot.amount;
        }
        else {
            merged.push(pot);
        }
    }
    return merged;
}
function sameIds(a, b) {
    return a.length === b.length && a.every((id) => b.includes(id));
}
function uncalledBetPortion(seats) {
    const totals = Object.entries(seats)
        .map(([id, seat]) => ({ id, totalBet: seat.totalBet }))
        .sort((a, b) => b.totalBet - a.totalBet);
    if (totals.length < 2)
        return null;
    const top = totals[0];
    const second = totals[1].totalBet;
    if (top.totalBet > second)
        return { playerId: top.id, amount: top.totalBet - second };
    return null;
}
exports.POKER_STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
function isStreetPhase(phase) {
    return exports.POKER_STREETS.includes(phase);
}
function nextStreet(phase) {
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
function actableSeats(state) {
    return state.playerOrder.filter((id) => {
        const seat = state.seats[id];
        return seat && seat.status === 'ACTIVE';
    });
}
function bettingRoundComplete(state) {
    const inHand = state.playerOrder.filter((id) => {
        const seat = state.seats[id];
        return seat.status === 'ACTIVE' || seat.status === 'ALL_IN';
    });
    if (inHand.length <= 1)
        return true;
    const actionable = actableSeats(state);
    if (actionable.length === 0)
        return true;
    if (actionable.length === 1) {
        const seat = state.seats[actionable[0]];
        return seat.hasActed && seat.bet >= state.currentBet;
    }
    return actionable.every((id) => {
        const seat = state.seats[id];
        return seat.hasActed && seat.bet === state.currentBet;
    });
}
function bettingPossible(state) {
    return actableSeats(state).length >= 2;
}
function legalMoves(state, playerId) {
    const seat = state.seats[playerId];
    if (!seat || seat.status !== 'ACTIVE')
        return null;
    const toCall = Math.max(0, state.currentBet - seat.bet);
    const callAmount = Math.min(toCall, seat.chips);
    const maxRaiseTo = seat.chips + seat.bet;
    const canCheck = toCall === 0;
    const othersActive = state.playerOrder.some((id) => id !== playerId && state.seats[id].status === 'ACTIVE');
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
function autoAction(state) {
    const moves = legalMoves(state, state.activePlayerId ?? '');
    return moves?.canCheck ? 'CHECK' : 'FOLD';
}
//# sourceMappingURL=poker-engine.js.map