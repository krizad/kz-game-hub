"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POK_DENG_PRESET = exports.POK_DENG_MULTIPLIERS = void 0;
exports.POK_DENG_MULTIPLIERS = {
    POK_9: 2,
    POK_8: 2,
    THREE_OF_A_KIND: 5,
    THREE_FACE: 3,
    STRAIGHT_FLUSH: 3,
};
const DEFAULT_DECK = { kind: 'STANDARD_52', jokers: false, copies: 1 };
const DEFAULT_DEAL = {
    cardsPerPlayer: 2,
    countMode: 'EQUAL_WITH_LEFTOVERS',
    starterPolicy: 'ROTATE',
};
const DEFAULT_ACTIONS = {
    allowed: ['DRAW', 'STAND'],
    timeoutSeconds: 0,
    autoAction: 'STAND',
};
const DEFAULT_PILES = { stockExhaustion: 'END_ROUND', reserveSize: 0 };
const DEFAULT_VISIBILITY = {
    revealHandsAtEnd: true,
    revealStarterCard: true,
    othersHandCountsVisible: true,
};
const DEFAULT_SCORING = {
    startingChips: 100,
    baseStake: 1,
    tiePolicy: 'DEALER_WINS',
    multipliers: exports.POK_DENG_MULTIPLIERS,
};
const DEFAULT_CONFIG = {
    preset: 'POK_DENG',
    deck: DEFAULT_DECK,
    deal: DEFAULT_DEAL,
    actions: DEFAULT_ACTIONS,
    piles: DEFAULT_PILES,
    visibility: DEFAULT_VISIBILITY,
    scoring: DEFAULT_SCORING,
};
exports.POK_DENG_PRESET = {
    id: 'POK_DENG',
    minPlayers: 2,
    maxPlayers: 6,
    phases: ['PLAYER_TURNS', 'RESULT'],
    evaluation: 'MOD_10_SHOWDOWN',
    roundEndConditions: [{ kind: 'NATURAL_HAND' }, { kind: 'ALL_PLAYERS_RESOLVED' }],
    defaultConfig: DEFAULT_CONFIG,
    allowed: {
        deck: [DEFAULT_DECK],
        deal: [
            DEFAULT_DEAL,
            { ...DEFAULT_DEAL, starterPolicy: 'RANDOM' },
            { ...DEFAULT_DEAL, starterPolicy: 'HOST_SELECT' },
        ],
        actions: [
            DEFAULT_ACTIONS,
            { allowed: ['DRAW', 'STAND'], timeoutSeconds: 20, autoAction: 'STAND' },
        ],
        piles: [DEFAULT_PILES],
        visibility: [DEFAULT_VISIBILITY],
        scoring: [DEFAULT_SCORING, { ...DEFAULT_SCORING, tiePolicy: 'PUSH' }],
    },
};
//# sourceMappingURL=pok-deng.preset.js.map