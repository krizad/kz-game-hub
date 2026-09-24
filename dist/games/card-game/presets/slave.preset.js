"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLAVE_PRESET = exports.SLAVE_RANK_ORDER = void 0;
exports.SLAVE_RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const DEFAULT_DECK = { kind: 'STANDARD_52', jokers: false, copies: 1 };
const DEFAULT_DEAL = {
    cardsPerPlayer: 13,
    countMode: 'DEAL_ALL_UNEVEN',
    starterPolicy: 'ROTATE',
};
const DEFAULT_ACTIONS = {
    allowed: ['PLAY', 'PASS'],
    timeoutSeconds: 0,
    autoAction: 'PASS',
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
const DEFAULT_CONFIG = {
    preset: 'SLAVE',
    deck: DEFAULT_DECK,
    deal: DEFAULT_DEAL,
    actions: DEFAULT_ACTIONS,
    piles: DEFAULT_PILES,
    visibility: DEFAULT_VISIBILITY,
    scoring: DEFAULT_SCORING,
};
exports.SLAVE_PRESET = {
    id: 'SLAVE',
    minPlayers: 2,
    maxPlayers: 4,
    phases: ['PLAYER_TURNS', 'RESULT'],
    evaluation: 'TRICK_TAKING',
    roundEndConditions: [{ kind: 'FIRST_EMPTY_HAND' }],
    defaultConfig: DEFAULT_CONFIG,
    allowed: {
        deck: [DEFAULT_DECK],
        deal: [DEFAULT_DEAL],
        actions: [DEFAULT_ACTIONS],
        piles: [DEFAULT_PILES],
        visibility: [DEFAULT_VISIBILITY],
        scoring: [DEFAULT_SCORING],
    },
};
//# sourceMappingURL=slave.preset.js.map