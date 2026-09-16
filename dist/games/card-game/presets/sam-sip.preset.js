"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAM_SIP_PRESET = exports.SAM_SIP_DEFAULT_CONFIG = exports.SAM_SIP_CARD_VALUES = void 0;
exports.SAM_SIP_CARD_VALUES = {
    A: 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 10,
    Q: 10,
    K: 10,
};
const DEFAULT_DECK = { kind: 'STANDARD_52', jokers: false, copies: 1 };
const DEFAULT_DEAL = {
    cardsPerPlayer: 5,
    countMode: 'EQUAL_WITH_LEFTOVERS',
    starterPolicy: 'ROTATE',
};
const DEFAULT_ACTIONS = {
    allowed: ['DRAW', 'CLAIM', 'DISCARD'],
    timeoutSeconds: 0,
    autoAction: 'DRAW',
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
    tiePolicy: 'PUSH',
    multipliers: {},
};
exports.SAM_SIP_DEFAULT_CONFIG = {
    preset: 'SAM_SIP',
    deck: DEFAULT_DECK,
    deal: DEFAULT_DEAL,
    actions: DEFAULT_ACTIONS,
    piles: DEFAULT_PILES,
    visibility: DEFAULT_VISIBILITY,
    scoring: DEFAULT_SCORING,
};
exports.SAM_SIP_PRESET = {
    id: 'SAM_SIP',
    minPlayers: 2,
    maxPlayers: 4,
    phases: ['PLAYER_TURNS', 'RESULT'],
    evaluation: 'PAIR_REMOVAL',
    roundEndConditions: [{ kind: 'FIRST_EMPTY_HAND' }, { kind: 'STOCK_EMPTY' }],
    defaultConfig: exports.SAM_SIP_DEFAULT_CONFIG,
    allowed: {
        deck: [DEFAULT_DECK],
        deal: [DEFAULT_DEAL],
        actions: [DEFAULT_ACTIONS],
        piles: [DEFAULT_PILES],
        visibility: [DEFAULT_VISIBILITY],
        scoring: [DEFAULT_SCORING],
    },
};
//# sourceMappingURL=sam-sip.preset.js.map