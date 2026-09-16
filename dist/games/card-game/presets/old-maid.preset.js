"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OLD_MAID_PRESET = exports.OLD_MAID_DEFAULT_CONFIG = void 0;
const DEFAULT_DECK = { kind: 'STANDARD_52', jokers: false, copies: 1 };
const DEFAULT_DEAL = {
    cardsPerPlayer: 13,
    countMode: 'DEAL_ALL',
    starterPolicy: 'ROTATE',
};
const DEFAULT_ACTIONS = {
    allowed: ['TAKE_CARD'],
    timeoutSeconds: 0,
    autoAction: 'TAKE_CARD',
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
exports.OLD_MAID_DEFAULT_CONFIG = {
    preset: 'OLD_MAID',
    deck: DEFAULT_DECK,
    deal: DEFAULT_DEAL,
    actions: DEFAULT_ACTIONS,
    piles: DEFAULT_PILES,
    visibility: DEFAULT_VISIBILITY,
    scoring: DEFAULT_SCORING,
};
exports.OLD_MAID_PRESET = {
    id: 'OLD_MAID',
    minPlayers: 2,
    maxPlayers: 6,
    phases: ['PLAYER_TURNS', 'RESULT'],
    evaluation: 'LAST_HOLDER_LOSES',
    roundEndConditions: [{ kind: 'LAST_HOLDER_STANDING' }],
    defaultConfig: exports.OLD_MAID_DEFAULT_CONFIG,
    allowed: {
        deck: [DEFAULT_DECK],
        deal: [DEFAULT_DEAL],
        actions: [DEFAULT_ACTIONS],
        piles: [DEFAULT_PILES],
        visibility: [DEFAULT_VISIBILITY],
        scoring: [DEFAULT_SCORING],
    },
};
//# sourceMappingURL=old-maid.preset.js.map