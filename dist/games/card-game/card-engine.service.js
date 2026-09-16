"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANK_INDEX = exports.SUITS = exports.RANKS = void 0;
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.stableSerialise = stableSerialise;
exports.validateConfig = validateConfig;
exports.deepCopyJson = deepCopyJson;
exports.previewDeal = previewDeal;
exports.dealRound = dealRound;
exports.drawFromStacks = drawFromStacks;
exports.resolveStarter = resolveStarter;
exports.toPublicState = toPublicState;
exports.evaluateRoundEnd = evaluateRoundEnd;
exports.autoActionFor = autoActionFor;
exports.mod10Score = mod10Score;
exports.outcomeTagForMod10 = outcomeTagForMod10;
exports.rankIndexIn = rankIndexIn;
exports.isSameRankGroup = isSameRankGroup;
exports.beatsRankGroup = beatsRankGroup;
exports.settleMod10Showdown = settleMod10Showdown;
const crypto_1 = require("crypto");
exports.RANKS = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
];
exports.SUITS = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];
exports.RANK_INDEX = Object.fromEntries(exports.RANKS.map((rank, index) => [rank, index]));
function createDeck(policy) {
    const deck = [];
    for (let copy = 0; copy < policy.copies; copy += 1) {
        for (const suit of exports.SUITS) {
            for (const rank of exports.RANKS) {
                const id = policy.copies > 1 ? `${rank}-${suit}#${copy}` : `${rank}-${suit}`;
                deck.push({ id, rank, suit });
            }
        }
    }
    return deck;
}
function shuffleDeck(deck, randomIndex = crypto_1.randomInt) {
    const shuffled = [...deck];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = randomIndex(index + 1);
        [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
}
function sortValue(value) {
    if (Array.isArray(value))
        return value.map(sortValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, sortValue(entry)]));
    }
    return value;
}
function stableSerialise(value) {
    return JSON.stringify(sortValue(value));
}
function validateConfig(input, preset) {
    const errors = [];
    const source = input ?? {};
    if (source.preset !== undefined && source.preset !== preset.id) {
        errors.push(`preset: expected ${preset.id}`);
    }
    if (!Number.isInteger(preset.minPlayers) || preset.minPlayers < 2) {
        errors.push('preset: minPlayers must be at least 2');
    }
    if (!Number.isInteger(preset.maxPlayers) || preset.maxPlayers < preset.minPlayers) {
        errors.push('preset: maxPlayers must be greater than or equal to minPlayers');
    }
    if (preset.phases.length === 0) {
        errors.push('preset: phases must not be empty');
    }
    const deck = source.deck ?? preset.defaultConfig.deck;
    const deal = source.deal ?? preset.defaultConfig.deal;
    const actions = source.actions ?? preset.defaultConfig.actions;
    const piles = source.piles ?? preset.defaultConfig.piles;
    const visibility = source.visibility ?? preset.defaultConfig.visibility;
    const scoring = source.scoring ?? preset.defaultConfig.scoring;
    const allow = (name, value, allowed, collected) => {
        if (!allowed.some((entry) => stableSerialise(entry) === stableSerialise(value))) {
            collected.push(`${name}: policy is not allowed by the preset`);
        }
    };
    const allowErrors = [];
    allow('deck', deck, preset.allowed.deck, allowErrors);
    allow('deal', deal, preset.allowed.deal, allowErrors);
    allow('actions', actions, preset.allowed.actions, allowErrors);
    allow('piles', piles, preset.allowed.piles, allowErrors);
    allow('visibility', visibility, preset.allowed.visibility, allowErrors);
    allow('scoring', scoring, preset.allowed.scoring, allowErrors);
    if (allowErrors.length > 0)
        return { ok: false, errors: [...errors, ...allowErrors] };
    if (!Number.isInteger(deck.copies) || deck.copies < 1 || deck.copies > 2) {
        errors.push('deck: copies must be an integer between 1 and 2');
    }
    if (deck.jokers) {
        errors.push('deck: jokers are not supported');
    }
    if (!Number.isInteger(deal.cardsPerPlayer) || deal.cardsPerPlayer < 1 || deal.cardsPerPlayer > 13) {
        errors.push('deal: cardsPerPlayer must be an integer between 1 and 13');
    }
    if (actions.allowed.length === 0) {
        errors.push('actions: allowed must not be empty');
    }
    if (new Set(actions.allowed).size !== actions.allowed.length) {
        errors.push('actions: allowed must not contain duplicates');
    }
    if (!Number.isInteger(actions.timeoutSeconds) ||
        actions.timeoutSeconds < 0 ||
        actions.timeoutSeconds > 600) {
        errors.push('actions: timeoutSeconds must be an integer between 0 and 600');
    }
    if (!actions.allowed.includes(actions.autoAction)) {
        errors.push('actions: autoAction must be one of the allowed actions');
    }
    if (!Number.isInteger(piles.reserveSize) || piles.reserveSize < 0 || piles.reserveSize > 52) {
        errors.push('piles: reserveSize must be an integer between 0 and 52');
    }
    if (piles.stockExhaustion !== 'USE_RESERVE' && piles.reserveSize !== 0) {
        errors.push('piles: reserveSize must be 0 unless the exhaustion policy uses a reserve');
    }
    if (!Number.isInteger(scoring.startingChips) ||
        scoring.startingChips < 0 ||
        scoring.startingChips > 100000) {
        errors.push('scoring: startingChips must be an integer between 0 and 100000');
    }
    if (!Number.isInteger(scoring.baseStake) || scoring.baseStake < 1 || scoring.baseStake > 1000) {
        errors.push('scoring: baseStake must be an integer between 1 and 1000');
    }
    for (const [tag, multiplier] of Object.entries(scoring.multipliers)) {
        if (!Number.isFinite(multiplier) || multiplier <= 0) {
            errors.push(`scoring: multiplier for ${tag} must be a positive finite number`);
        }
    }
    if (errors.length > 0)
        return { ok: false, errors };
    return {
        ok: true,
        config: {
            preset: preset.id,
            deck: deepCopyJson(deck),
            deal: deepCopyJson(deal),
            actions: deepCopyJson(actions),
            piles: deepCopyJson(piles),
            visibility: deepCopyJson(visibility),
            scoring: deepCopyJson(scoring),
        },
    };
}
function deepCopyJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function previewDeal(deckSize, playerCount, policy, reserveSize = 0) {
    if (!Number.isInteger(deckSize) || deckSize < 1) {
        return { ok: false, error: 'deal: the deck is empty' };
    }
    if (!Number.isInteger(playerCount) || playerCount < 1) {
        return { ok: false, error: 'deal: at least one player is required' };
    }
    const reserved = Math.min(Math.max(reserveSize, 0), deckSize);
    const usable = deckSize - reserved;
    if (policy.countMode === 'DEAL_ALL') {
        if (usable % playerCount !== 0) {
            return { ok: false, error: 'deal: the deck cannot be divided evenly across the players' };
        }
        const perPlayer = usable / playerCount;
        if (perPlayer < 1)
            return { ok: false, error: 'deal: not enough cards to deal' };
        return { ok: true, preview: { perPlayer, stockSize: 0, reserveSize: reserved } };
    }
    const dealt = policy.cardsPerPlayer * playerCount;
    if (policy.countMode === 'REJECT_IF_NOT_EVEN' && dealt !== usable) {
        return { ok: false, error: 'deal: the deck would not be fully consumed' };
    }
    if (dealt > usable) {
        return { ok: false, error: 'deal: not enough cards to deal' };
    }
    return { ok: true, preview: { perPlayer: policy.cardsPerPlayer, stockSize: usable - dealt, reserveSize: reserved } };
}
function dealRound(deck, playerIds, policy, reserveSize = 0) {
    if (new Set(playerIds).size !== playerIds.length) {
        return { ok: false, error: 'deal: player ids must be unique' };
    }
    const previewed = previewDeal(deck.length, playerIds.length, policy, reserveSize);
    if (!previewed.ok || !previewed.preview) {
        return { ok: false, error: previewed.error ?? 'deal: invalid deal policy' };
    }
    const preview = previewed.preview;
    const stock = [...deck];
    const reserve = [];
    for (let count = 0; count < preview.reserveSize; count += 1) {
        reserve.push(stock.pop());
    }
    const hands = {};
    for (const id of playerIds)
        hands[id] = [];
    for (let round = 0; round < preview.perPlayer; round += 1) {
        for (const id of playerIds)
            hands[id].push(stock.pop());
    }
    return { ok: true, hands, stock, reserve };
}
function drawFromStacks(stacks, policy, randomIndex = crypto_1.randomInt) {
    const next = {
        stock: [...stacks.stock],
        discards: [...stacks.discards],
        reserve: [...stacks.reserve],
    };
    const fromStock = next.stock.pop();
    if (fromStock)
        return { ok: true, card: fromStock, stacks: next };
    if (policy.stockExhaustion === 'USE_RESERVE') {
        const fromReserve = next.reserve.pop();
        if (fromReserve)
            return { ok: true, card: fromReserve, stacks: next };
        return { ok: false, reason: 'END_ROUND' };
    }
    if (policy.stockExhaustion === 'RESHUFFLE_DISCARDS_EXCEPT_TOP') {
        const topDiscard = next.discards.at(-1);
        const rest = topDiscard ? next.discards.slice(0, -1) : next.discards;
        if (rest.length === 0)
            return { ok: false, reason: 'END_ROUND' };
        next.discards = topDiscard ? [topDiscard] : [];
        next.stock = shuffleDeck(rest, randomIndex);
        const reshuffledTop = next.stock.pop();
        if (!reshuffledTop)
            return { ok: false, reason: 'END_ROUND' };
        return { ok: true, card: reshuffledTop, stacks: next };
    }
    return { ok: false, reason: 'END_ROUND' };
}
function resolveStarter(policy, context) {
    const { playerOrder } = context;
    if (playerOrder.length === 0)
        return null;
    const seatAfter = (id) => {
        const index = id ? playerOrder.indexOf(id) : -1;
        return playerOrder[(index + 1) % playerOrder.length];
    };
    switch (policy) {
        case 'RANDOM': {
            const random = context.randomIndex ?? crypto_1.randomInt;
            return playerOrder[random(playerOrder.length)];
        }
        case 'ROTATE':
            return seatAfter(context.previousStarterId);
        case 'PREVIOUS_WINNER':
            return context.previousWinnerId ?? playerOrder[0];
        case 'PREVIOUS_LOSER':
            return context.previousLoserId ?? playerOrder[0];
        default:
            return null;
    }
}
function toPublicState(snapshot, visibility, viewerId) {
    const handCounts = {};
    for (const id of snapshot.playerOrder) {
        const isViewer = viewerId !== undefined && id === viewerId;
        if (visibility.othersHandCountsVisible || isViewer) {
            handCounts[id] = snapshot.hands[id]?.length ?? 0;
        }
    }
    const keepHands = visibility.revealHandsAtEnd && snapshot.phase === 'RESULT';
    const result = snapshot.result
        ? {
            ...snapshot.result,
            revealedHands: keepHands ? snapshot.result.revealedHands : {},
        }
        : undefined;
    return {
        preset: snapshot.preset,
        phase: snapshot.phase,
        dealerId: snapshot.dealerId,
        activePlayerId: snapshot.activePlayerId,
        playerOrder: [...snapshot.playerOrder],
        handCounts,
        chips: { ...snapshot.chips },
        decisions: { ...snapshot.decisions },
        ...(result ? { result } : {}),
    };
}
function evaluateRoundEnd(conditions, context) {
    for (const condition of conditions) {
        if (condition.kind === 'NATURAL_HAND' && context.naturalPlayerIds.length > 0)
            return condition.kind;
        if (condition.kind === 'ALL_PLAYERS_RESOLVED' && context.pendingPlayerIds.length === 0)
            return condition.kind;
        if (condition.kind === 'DEALER_RESOLVED' && context.dealerResolved)
            return condition.kind;
        if (condition.kind === 'STOCK_EMPTY' && context.stockEmpty)
            return condition.kind;
    }
    return null;
}
function autoActionFor(policy) {
    return policy.autoAction;
}
function cardValue(card) {
    if (card.rank === 'A')
        return 1;
    const numeric = Number(card.rank);
    return Number.isFinite(numeric) ? numeric : 0;
}
function mod10Score(hand) {
    return hand.reduce((total, card) => total + cardValue(card), 0) % 10;
}
function outcomeTagForMod10(hand) {
    if (hand.length === 3) {
        if (hand.every((card) => card.rank === hand[0].rank))
            return 'THREE_OF_A_KIND';
        if (hand.every((card) => card.rank === 'J' || card.rank === 'Q' || card.rank === 'K')) {
            return 'THREE_FACE';
        }
        const sameSuit = hand.every((card) => card.suit === hand[0].suit);
        if (sameSuit) {
            const indices = hand.map((card) => exports.RANK_INDEX[card.rank]).sort((left, right) => left - right);
            if (indices[1] === indices[0] + 1 && indices[2] === indices[1] + 1)
                return 'STRAIGHT_FLUSH';
        }
    }
    if (hand.length === 2) {
        const score = mod10Score(hand);
        if (score === 8)
            return 'POK_8';
        if (score === 9)
            return 'POK_9';
    }
    return 'NORMAL';
}
function rankIndexIn(rankOrder, rank) {
    return rankOrder.indexOf(rank);
}
function isSameRankGroup(cards, maxSize = 3) {
    if (cards.length === 0 || cards.length > maxSize)
        return false;
    return cards.every((card) => card.rank === cards[0].rank);
}
function beatsRankGroup(candidate, current, rankOrder) {
    if (candidate.length === 0)
        return false;
    if (current.length === 0)
        return true;
    if (candidate.length !== current.length)
        return false;
    if (!isSameRankGroup(candidate) || !isSameRankGroup(current))
        return false;
    return rankIndexIn(rankOrder, candidate[0].rank) > rankIndexIn(rankOrder, current[0].rank);
}
function settleMod10Showdown(input) {
    const { playerOrder, dealerId, hands } = input;
    const dealerHand = hands[dealerId] ?? [];
    const dealerScore = mod10Score(dealerHand);
    const scores = {};
    const outcomeTags = {};
    const winnerIds = [];
    const deltas = {};
    const revealedHands = {};
    for (const id of playerOrder) {
        const hand = hands[id] ?? [];
        scores[id] = mod10Score(hand);
        outcomeTags[id] = outcomeTagForMod10(hand);
        revealedHands[id] = hand.map((card) => ({ ...card }));
        deltas[id] = 0;
    }
    deltas[dealerId] = deltas[dealerId] ?? 0;
    for (const id of playerOrder) {
        if (id === dealerId)
            continue;
        const playerScore = scores[id];
        const playerWins = playerScore > dealerScore || (playerScore === dealerScore && input.tiePolicy === 'PLAYER_WINS');
        const push = playerScore === dealerScore && input.tiePolicy === 'PUSH';
        if (playerWins) {
            const stake = input.baseStake * (input.multipliers[outcomeTags[id]] ?? 1);
            deltas[id] += stake;
            deltas[dealerId] -= stake;
            winnerIds.push(id);
        }
        else if (!push) {
            const stake = input.baseStake * (input.multipliers[outcomeTags[dealerId]] ?? 1);
            deltas[id] -= stake;
            deltas[dealerId] += stake;
        }
    }
    return { dealerScore, scores, outcomeTags, winnerIds, deltas, revealedHands };
}
//# sourceMappingURL=card-engine.service.js.map