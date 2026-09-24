"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const card_engine_service_1 = require("./card-engine.service");
function card(rank, suit) {
    return { id: `${rank}-${suit}`, rank, suit };
}
const POK_DENG_CONFIG = {
    preset: 'POK_DENG',
    deck: { kind: 'STANDARD_52', jokers: false, copies: 1 },
    deal: { cardsPerPlayer: 2, countMode: 'EQUAL_WITH_LEFTOVERS', starterPolicy: 'ROTATE' },
    actions: { allowed: ['DRAW', 'STAND'], timeoutSeconds: 0, autoAction: 'STAND' },
    piles: { stockExhaustion: 'END_ROUND', reserveSize: 0 },
    visibility: { revealHandsAtEnd: true, revealStarterCard: true, othersHandCountsVisible: true },
    scoring: {
        startingChips: 100,
        baseStake: 1,
        tiePolicy: 'DEALER_WINS',
        multipliers: { POK_9: 2, POK_8: 2 },
    },
};
const PRESET = {
    id: 'POK_DENG',
    minPlayers: 2,
    maxPlayers: 6,
    phases: ['PLAYER_TURNS', 'RESULT'],
    evaluation: 'MOD_10_SHOWDOWN',
    roundEndConditions: [{ kind: 'NATURAL_HAND' }, { kind: 'ALL_PLAYERS_RESOLVED' }],
    defaultConfig: POK_DENG_CONFIG,
    allowed: {
        deck: [POK_DENG_CONFIG.deck],
        deal: [
            POK_DENG_CONFIG.deal,
            { cardsPerPlayer: 3, countMode: 'DEAL_ALL', starterPolicy: 'RANDOM' },
        ],
        actions: [POK_DENG_CONFIG.actions],
        piles: [POK_DENG_CONFIG.piles, { stockExhaustion: 'USE_RESERVE', reserveSize: 4 }],
        visibility: [
            POK_DENG_CONFIG.visibility,
            { revealHandsAtEnd: false, revealStarterCard: false, othersHandCountsVisible: false },
        ],
        scoring: [POK_DENG_CONFIG.scoring],
    },
};
const HIDDEN_VISIBILITY = {
    revealHandsAtEnd: false,
    revealStarterCard: false,
    othersHandCountsVisible: false,
};
describe('CardEngineService', () => {
    describe('validateConfig', () => {
        it('fills every category from the preset defaults', () => {
            const result = (0, card_engine_service_1.validateConfig)(undefined, PRESET);
            expect(result.ok).toBe(true);
            expect(result.config).toEqual(POK_DENG_CONFIG);
        });
        it('accepts an allow-listed override regardless of key order', () => {
            const result = (0, card_engine_service_1.validateConfig)({ scoring: { ...POK_DENG_CONFIG.scoring, multipliers: { POK_8: 2, POK_9: 2 } } }, PRESET);
            expect(result.ok).toBe(true);
            expect(result.config?.scoring.multipliers).toEqual({ POK_8: 2, POK_9: 2 });
        });
        it('rejects a config for another preset', () => {
            const result = (0, card_engine_service_1.validateConfig)({ preset: 'SLAVE' }, PRESET);
            expect(result.ok).toBe(false);
            expect(result.errors).toContain('preset: expected POK_DENG');
        });
        it('rejects policies outside the allow-list', () => {
            const result = (0, card_engine_service_1.validateConfig)({ deal: { cardsPerPlayer: 5, countMode: 'EQUAL_WITH_LEFTOVERS', starterPolicy: 'ROTATE' } }, PRESET);
            expect(result.ok).toBe(false);
            expect(result.errors).toContain('deal: policy is not allowed by the preset');
        });
        it('rejects structurally invalid policies that a preset might author', () => {
            const badConfig = {
                ...POK_DENG_CONFIG,
                deck: { kind: 'STANDARD_52', jokers: true, copies: 3 },
                actions: { allowed: ['DRAW', 'DRAW'], timeoutSeconds: 601, autoAction: 'STAND' },
                piles: { stockExhaustion: 'END_ROUND', reserveSize: 4 },
                scoring: { ...POK_DENG_CONFIG.scoring, baseStake: 0, multipliers: { POK_9: 0 } },
            };
            const badPreset = {
                ...PRESET,
                minPlayers: 1,
                defaultConfig: badConfig,
                allowed: {
                    deck: [badConfig.deck],
                    deal: [badConfig.deal],
                    actions: [badConfig.actions],
                    piles: [badConfig.piles],
                    visibility: [badConfig.visibility],
                    scoring: [badConfig.scoring],
                },
            };
            const result = (0, card_engine_service_1.validateConfig)(undefined, badPreset);
            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([
                'deck: copies must be an integer between 1 and 2',
                'deck: jokers are not supported',
                'actions: allowed must not contain duplicates',
                'actions: timeoutSeconds must be an integer between 0 and 600',
                'actions: autoAction must be one of the allowed actions',
                'piles: reserveSize must be 0 unless the exhaustion policy uses a reserve',
                'scoring: baseStake must be an integer between 1 and 1000',
                'scoring: multiplier for POK_9 must be a positive finite number',
                'preset: minPlayers must be at least 2',
            ]));
        });
    });
    describe('createDeck and shuffleDeck', () => {
        it('creates a unique standard 52-card deck', () => {
            const deck = (0, card_engine_service_1.createDeck)(POK_DENG_CONFIG.deck);
            expect(deck).toHaveLength(52);
            expect(new Set(deck.map((entry) => entry.id)).size).toBe(52);
            expect(deck.some((entry) => entry.id === 'A-CLUBS')).toBe(true);
            expect(deck.some((entry) => entry.id === 'K-SPADES')).toBe(true);
        });
        it('suffixes ids when the deck holds multiple copies', () => {
            const deck = (0, card_engine_service_1.createDeck)({ kind: 'STANDARD_52', jokers: false, copies: 2 });
            expect(deck).toHaveLength(104);
            expect(new Set(deck.map((entry) => entry.id)).size).toBe(104);
            expect(deck.some((entry) => entry.id === 'A-CLUBS#0')).toBe(true);
            expect(deck.some((entry) => entry.id === 'A-CLUBS#1')).toBe(true);
        });
        it('shuffles deterministically with an injected random source and leaves the input untouched', () => {
            const input = [
                card('A', 'CLUBS'),
                card('2', 'CLUBS'),
                card('3', 'CLUBS'),
                card('4', 'CLUBS'),
            ];
            const shuffled = (0, card_engine_service_1.shuffleDeck)(input, () => 0);
            expect(shuffled.map((entry) => entry.id)).toEqual([
                '2-CLUBS',
                '3-CLUBS',
                '4-CLUBS',
                'A-CLUBS',
            ]);
            expect(input.map((entry) => entry.id)).toEqual(['A-CLUBS', '2-CLUBS', '3-CLUBS', '4-CLUBS']);
        });
    });
    describe('previewDeal and dealRound', () => {
        it('previews an equal deal with the leftovers left in the stock', () => {
            const result = (0, card_engine_service_1.previewDeal)(52, 2, POK_DENG_CONFIG.deal);
            expect(result.ok).toBe(true);
            expect(result.preview).toEqual({ perPlayer: 2, stockSize: 48, reserveSize: 0 });
        });
        it('rejects DEAL_ALL when the deck does not divide evenly', () => {
            const policy = { cardsPerPlayer: 2, countMode: 'DEAL_ALL', starterPolicy: 'ROTATE' };
            const result = (0, card_engine_service_1.previewDeal)(52, 5, { ...policy });
            expect(result.ok).toBe(false);
            expect(result.error).toContain('evenly');
        });
        it('deals every card and gives the remainder to the earliest seats', () => {
            const policy = {
                cardsPerPlayer: 13,
                countMode: 'DEAL_ALL_UNEVEN',
                starterPolicy: 'ROTATE',
            };
            expect((0, card_engine_service_1.previewDeal)(52, 2, { ...policy }).preview).toEqual({
                perPlayer: 26,
                stockSize: 0,
                reserveSize: 0,
            });
            expect((0, card_engine_service_1.previewDeal)(52, 3, { ...policy }).preview).toEqual({
                perPlayer: 17,
                stockSize: 0,
                reserveSize: 0,
            });
            expect((0, card_engine_service_1.previewDeal)(52, 4, { ...policy }).preview).toEqual({
                perPlayer: 13,
                stockSize: 0,
                reserveSize: 0,
            });
            const deck = (0, card_engine_service_1.createDeck)({ kind: 'STANDARD_52', jokers: false, copies: 1 });
            const dealt = (0, card_engine_service_1.dealRound)(deck, ['a', 'b', 'c'], { ...policy });
            expect(dealt.ok).toBe(true);
            expect(dealt.hands?.a).toHaveLength(18);
            expect(dealt.hands?.b).toHaveLength(17);
            expect(dealt.hands?.c).toHaveLength(17);
            expect(dealt.stock).toHaveLength(0);
        });
        it('rejects REJECT_IF_NOT_EVEN when cards would remain', () => {
            const policy = {
                cardsPerPlayer: 2,
                countMode: 'REJECT_IF_NOT_EVEN',
                starterPolicy: 'ROTATE',
            };
            const result = (0, card_engine_service_1.previewDeal)(52, 2, { ...policy });
            expect(result.ok).toBe(false);
            expect(result.error).toContain('fully consumed');
        });
        it('reserves cards before dealing when the pile policy asks for a reserve', () => {
            const result = (0, card_engine_service_1.previewDeal)(52, 2, POK_DENG_CONFIG.deal, 4);
            expect(result.ok).toBe(true);
            expect(result.preview).toEqual({ perPlayer: 2, stockSize: 44, reserveSize: 4 });
        });
        it('deals round-robin from the top of the deck', () => {
            const deck = [
                card('A', 'CLUBS'),
                card('2', 'CLUBS'),
                card('3', 'CLUBS'),
                card('4', 'CLUBS'),
                card('5', 'CLUBS'),
            ];
            const result = (0, card_engine_service_1.dealRound)(deck, ['a', 'b'], POK_DENG_CONFIG.deal);
            expect(result.ok).toBe(true);
            expect(result.hands?.a.map((entry) => entry.id)).toEqual(['5-CLUBS', '3-CLUBS']);
            expect(result.hands?.b.map((entry) => entry.id)).toEqual(['4-CLUBS', '2-CLUBS']);
            expect(result.stock?.map((entry) => entry.id)).toEqual(['A-CLUBS']);
            expect(deck).toHaveLength(5);
        });
        it('rejects duplicate player ids', () => {
            const result = (0, card_engine_service_1.dealRound)((0, card_engine_service_1.createDeck)(POK_DENG_CONFIG.deck), ['a', 'a'], POK_DENG_CONFIG.deal);
            expect(result.ok).toBe(false);
            expect(result.error).toContain('unique');
        });
    });
    describe('drawFromStacks', () => {
        const stacks = () => ({
            stock: [card('2', 'CLUBS'), card('3', 'CLUBS')],
            discards: [card('4', 'CLUBS')],
            reserve: [card('5', 'CLUBS')],
        });
        it('draws from the stock first without mutating the input stacks', () => {
            const input = stacks();
            const result = (0, card_engine_service_1.drawFromStacks)(input, POK_DENG_CONFIG.piles);
            expect(result.ok).toBe(true);
            expect(result.card?.id).toBe('3-CLUBS');
            expect(result.stacks?.stock.map((entry) => entry.id)).toEqual(['2-CLUBS']);
            expect(input.stock).toHaveLength(2);
        });
        it('ends the round when the stock is empty and the policy says so', () => {
            const result = (0, card_engine_service_1.drawFromStacks)({ stock: [], discards: [card('4', 'CLUBS')], reserve: [] }, POK_DENG_CONFIG.piles);
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('END_ROUND');
        });
        it('reshuffles the discards while keeping the top discard in place', () => {
            const policy = { stockExhaustion: 'RESHUFFLE_DISCARDS_EXCEPT_TOP', reserveSize: 0 };
            const result = (0, card_engine_service_1.drawFromStacks)({
                stock: [],
                discards: [card('2', 'CLUBS'), card('3', 'CLUBS'), card('4', 'CLUBS')],
                reserve: [],
            }, { ...policy }, (maxExclusive) => maxExclusive - 1);
            expect(result.ok).toBe(true);
            expect(result.card?.id).toBe('3-CLUBS');
            expect(result.stacks?.discards.map((entry) => entry.id)).toEqual(['4-CLUBS']);
            expect(result.stacks?.stock.map((entry) => entry.id)).toEqual(['2-CLUBS']);
        });
        it('ends the round when only the top discard remains', () => {
            const policy = { stockExhaustion: 'RESHUFFLE_DISCARDS_EXCEPT_TOP', reserveSize: 0 };
            const result = (0, card_engine_service_1.drawFromStacks)({ stock: [], discards: [card('4', 'CLUBS')], reserve: [] }, { ...policy });
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('END_ROUND');
        });
        it('uses the reserve when the stock is empty', () => {
            const policy = { stockExhaustion: 'USE_RESERVE', reserveSize: 4 };
            const result = (0, card_engine_service_1.drawFromStacks)({
                stock: [],
                discards: [],
                reserve: [card('5', 'CLUBS'), card('6', 'CLUBS')],
            }, { ...policy });
            expect(result.ok).toBe(true);
            expect(result.card?.id).toBe('6-CLUBS');
            expect(result.stacks?.reserve.map((entry) => entry.id)).toEqual(['5-CLUBS']);
        });
        it('ends the round when the reserve is depleted too', () => {
            const policy = { stockExhaustion: 'USE_RESERVE', reserveSize: 4 };
            const result = (0, card_engine_service_1.drawFromStacks)({ stock: [], discards: [], reserve: [] }, { ...policy });
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('END_ROUND');
        });
    });
    describe('resolveStarter', () => {
        const order = ['a', 'b', 'c'];
        it('picks a random seat with the injected source', () => {
            expect((0, card_engine_service_1.resolveStarter)('RANDOM', { playerOrder: order, randomIndex: () => 1 })).toBe('b');
        });
        it('rotates to the seat after the previous starter and wraps', () => {
            expect((0, card_engine_service_1.resolveStarter)('ROTATE', { playerOrder: order, previousStarterId: 'c' })).toBe('a');
            expect((0, card_engine_service_1.resolveStarter)('ROTATE', { playerOrder: order, previousStarterId: 'a' })).toBe('b');
            expect((0, card_engine_service_1.resolveStarter)('ROTATE', { playerOrder: order })).toBe('a');
        });
        it('resolves previous winner and loser with a first-seat fallback', () => {
            expect((0, card_engine_service_1.resolveStarter)('PREVIOUS_WINNER', { playerOrder: order, previousWinnerId: 'b' })).toBe('b');
            expect((0, card_engine_service_1.resolveStarter)('PREVIOUS_WINNER', { playerOrder: order })).toBe('a');
            expect((0, card_engine_service_1.resolveStarter)('PREVIOUS_LOSER', { playerOrder: order, previousLoserId: 'c' })).toBe('c');
            expect((0, card_engine_service_1.resolveStarter)('PREVIOUS_LOSER', { playerOrder: order })).toBe('a');
        });
        it('leaves host selection to the adapter and handles an empty order', () => {
            expect((0, card_engine_service_1.resolveStarter)('HOST_SELECT', { playerOrder: order })).toBeNull();
            expect((0, card_engine_service_1.resolveStarter)('ROTATE', { playerOrder: [] })).toBeNull();
        });
    });
    describe('toPublicState', () => {
        const snapshot = () => ({
            preset: 'POK_DENG',
            phase: 'PLAYER_TURNS',
            dealerId: 'a',
            activePlayerId: 'b',
            playerOrder: ['a', 'b'],
            hands: {
                a: [card('A', 'CLUBS'), card('K', 'SPADES')],
                b: [card('9', 'HEARTS'), card('10', 'HEARTS')],
            },
            chips: { a: 100, b: 100 },
            decisions: { a: 'NATURAL', b: 'PENDING' },
        });
        it('never exposes unrevealed hands in the public snapshot', () => {
            const result = (0, card_engine_service_1.toPublicState)(snapshot(), POK_DENG_CONFIG.visibility);
            expect(result.handCounts).toEqual({ a: 2, b: 2 });
            expect(JSON.stringify(result)).not.toContain('CLUBS');
            expect(JSON.stringify(result)).not.toContain('HEARTS');
            expect(result.result).toBeUndefined();
        });
        it('hides other hand counts when the visibility policy says so', () => {
            const withViewer = (0, card_engine_service_1.toPublicState)(snapshot(), HIDDEN_VISIBILITY, 'a');
            expect(withViewer.handCounts).toEqual({ a: 2 });
            const withoutViewer = (0, card_engine_service_1.toPublicState)(snapshot(), HIDDEN_VISIBILITY);
            expect(withoutViewer.handCounts).toEqual({});
        });
        it('reveals hands only at the result when the policy allows it', () => {
            const result = (0, card_engine_service_1.toPublicState)({
                ...snapshot(),
                phase: 'RESULT',
                activePlayerId: null,
                result: {
                    dealerScore: 0,
                    playerScores: { a: 0, b: 9 },
                    outcomeTags: { a: 'NORMAL', b: 'POK_9' },
                    winnerIds: ['b'],
                    revealedHands: { a: [card('A', 'CLUBS')], b: [card('9', 'HEARTS')] },
                },
            }, POK_DENG_CONFIG.visibility);
            expect(Object.keys(result.result?.revealedHands ?? {})).toEqual(['a', 'b']);
            const hidden = (0, card_engine_service_1.toPublicState)({
                ...snapshot(),
                phase: 'RESULT',
                activePlayerId: null,
                result: {
                    dealerScore: 0,
                    playerScores: { a: 0, b: 9 },
                    outcomeTags: { a: 'NORMAL', b: 'POK_9' },
                    winnerIds: ['b'],
                    revealedHands: { a: [card('A', 'CLUBS')], b: [card('9', 'HEARTS')] },
                },
            }, HIDDEN_VISIBILITY);
            expect(hidden.result).toBeDefined();
            expect(hidden.result?.revealedHands).toEqual({});
        });
        it('copies mutable records so callers cannot corrupt the snapshot', () => {
            const source = snapshot();
            const result = (0, card_engine_service_1.toPublicState)(source, POK_DENG_CONFIG.visibility);
            result.chips.a = 0;
            result.playerOrder.push('c');
            expect(source.chips.a).toBe(100);
            expect(source.playerOrder).toEqual(['a', 'b']);
        });
    });
    describe('evaluateRoundEnd and autoActionFor', () => {
        const context = {
            phase: 'PLAYER_TURNS',
            naturalPlayerIds: ['a'],
            pendingPlayerIds: ['b'],
            dealerResolved: false,
            stockEmpty: true,
        };
        it('returns the first matching condition in preset order', () => {
            const conditions = [{ kind: 'STOCK_EMPTY' }, { kind: 'NATURAL_HAND' }];
            expect((0, card_engine_service_1.evaluateRoundEnd)(conditions, context)).toBe('STOCK_EMPTY');
            expect((0, card_engine_service_1.evaluateRoundEnd)(PRESET.roundEndConditions, context)).toBe('NATURAL_HAND');
        });
        it('returns null when no condition matches', () => {
            const result = (0, card_engine_service_1.evaluateRoundEnd)(PRESET.roundEndConditions, {
                phase: 'PLAYER_TURNS',
                naturalPlayerIds: [],
                pendingPlayerIds: ['b'],
                dealerResolved: false,
                stockEmpty: false,
            });
            expect(result).toBeNull();
        });
        it('exposes the validated auto action', () => {
            expect((0, card_engine_service_1.autoActionFor)(POK_DENG_CONFIG.actions)).toBe('STAND');
        });
    });
    describe('mod10Score and outcomeTagForMod10', () => {
        it('scores aces as one, faces as zero, and wraps at ten', () => {
            expect((0, card_engine_service_1.mod10Score)([card('A', 'CLUBS'), card('A', 'HEARTS'), card('A', 'SPADES')])).toBe(3);
            expect((0, card_engine_service_1.mod10Score)([card('10', 'CLUBS'), card('J', 'HEARTS'), card('Q', 'SPADES')])).toBe(0);
            expect((0, card_engine_service_1.mod10Score)([card('A', 'CLUBS'), card('9', 'HEARTS')])).toBe(0);
            expect((0, card_engine_service_1.mod10Score)([card('8', 'CLUBS'), card('10', 'HEARTS')])).toBe(8);
        });
        it('tags three-card hands in priority order', () => {
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('J', 'CLUBS'), card('J', 'HEARTS'), card('J', 'SPADES')])).toBe('THREE_OF_A_KIND');
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('J', 'CLUBS'), card('Q', 'HEARTS'), card('K', 'SPADES')])).toBe('THREE_FACE');
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('9', 'HEARTS'), card('10', 'HEARTS'), card('J', 'HEARTS')])).toBe('STRAIGHT_FLUSH');
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('2', 'HEARTS'), card('3', 'HEARTS'), card('4', 'SPADES')])).toBe('NORMAL');
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('Q', 'HEARTS'), card('K', 'HEARTS'), card('A', 'HEARTS')])).toBe('NORMAL');
        });
        it('tags two-card pok hands from the mod-10 score', () => {
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('4', 'CLUBS'), card('5', 'HEARTS')])).toBe('POK_9');
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('A', 'CLUBS'), card('7', 'HEARTS')])).toBe('POK_8');
            expect((0, card_engine_service_1.outcomeTagForMod10)([card('3', 'CLUBS'), card('4', 'HEARTS')])).toBe('NORMAL');
        });
    });
    describe('settleMod10Showdown', () => {
        const input = () => ({
            playerOrder: ['a', 'b', 'dealer'],
            dealerId: 'dealer',
            hands: {
                dealer: [card('K', 'CLUBS'), card('Q', 'HEARTS')],
                a: [card('9', 'CLUBS'), card('10', 'HEARTS')],
                b: [card('5', 'CLUBS'), card('5', 'HEARTS')],
            },
            tiePolicy: 'DEALER_WINS',
            baseStake: 1,
            multipliers: { POK_9: 2, POK_8: 2 },
        });
        it('pays winners with their outcome multiplier and charges losers', () => {
            const result = (0, card_engine_service_1.settleMod10Showdown)(input());
            expect(result.dealerScore).toBe(0);
            expect(result.scores).toEqual({ a: 9, b: 0, dealer: 0 });
            expect(result.outcomeTags.a).toBe('POK_9');
            expect(result.winnerIds).toEqual(['a']);
            expect(result.deltas).toEqual({ a: 2, b: -1, dealer: -1 });
            expect(Object.keys(result.revealedHands)).toHaveLength(3);
        });
        it('applies the dealer outcome multiplier when the dealer wins', () => {
            const result = (0, card_engine_service_1.settleMod10Showdown)({
                ...input(),
                hands: {
                    dealer: [card('9', 'CLUBS'), card('10', 'HEARTS')],
                    a: [card('2', 'CLUBS'), card('3', 'HEARTS')],
                },
                playerOrder: ['a', 'dealer'],
            });
            expect(result.winnerIds).toEqual([]);
            expect(result.deltas).toEqual({ a: -2, dealer: 2 });
        });
        it('settles ties by the tie policy', () => {
            const tied = () => ({
                ...input(),
                hands: {
                    dealer: [card('5', 'CLUBS'), card('5', 'HEARTS')],
                    a: [card('K', 'CLUBS'), card('Q', 'HEARTS')],
                },
                playerOrder: ['a', 'dealer'],
                baseStake: 3,
            });
            expect((0, card_engine_service_1.settleMod10Showdown)({ ...tied(), tiePolicy: 'DEALER_WINS' }).deltas).toEqual({
                a: -3,
                dealer: 3,
            });
            expect((0, card_engine_service_1.settleMod10Showdown)({ ...tied(), tiePolicy: 'PLAYER_WINS' }).deltas).toEqual({
                a: 3,
                dealer: -3,
            });
            expect((0, card_engine_service_1.settleMod10Showdown)({ ...tied(), tiePolicy: 'PUSH' }).deltas).toEqual({
                a: 0,
                dealer: 0,
            });
        });
        it('lets balances go negative instead of clamping', () => {
            const result = (0, card_engine_service_1.settleMod10Showdown)({
                ...input(),
                hands: {
                    dealer: [card('K', 'CLUBS'), card('Q', 'HEARTS')],
                    b: [card('5', 'CLUBS'), card('5', 'HEARTS')],
                },
                playerOrder: ['b', 'dealer'],
                baseStake: 100,
            });
            expect(result.deltas.b).toBe(-100);
            expect(result.deltas.dealer).toBe(100);
        });
    });
});
//# sourceMappingURL=card-engine.service.spec.js.map