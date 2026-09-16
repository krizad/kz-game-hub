import {
  ActionPolicy,
  CardGameConfig,
  CardGamePresetDefinition,
  DealPolicy,
  DeckPolicy,
  PilePolicy,
  ScoringPolicy,
  VisibilityPolicy,
} from '@repo/types';

const DEFAULT_DECK: DeckPolicy = { kind: 'STANDARD_52', jokers: false, copies: 1 };
const DEFAULT_DEAL: DealPolicy = {
  cardsPerPlayer: 13,
  countMode: 'DEAL_ALL',
  starterPolicy: 'ROTATE',
};
const DEFAULT_ACTIONS: ActionPolicy = {
  allowed: ['TAKE_CARD'],
  timeoutSeconds: 0,
  autoAction: 'TAKE_CARD',
};
const DEFAULT_PILES: PilePolicy = { stockExhaustion: 'END_ROUND', reserveSize: 0 };
const DEFAULT_VISIBILITY: VisibilityPolicy = {
  revealHandsAtEnd: true,
  revealStarterCard: true,
  othersHandCountsVisible: true,
};
const DEFAULT_SCORING: ScoringPolicy = {
  startingChips: 100,
  baseStake: 1,
  tiePolicy: 'PUSH',
  multipliers: {},
};

/** Declarative defaults: the runtime removes one queen and deals every remaining card round-robin. */
export const OLD_MAID_DEFAULT_CONFIG: CardGameConfig = {
  preset: 'OLD_MAID',
  deck: DEFAULT_DECK,
  deal: DEFAULT_DEAL,
  actions: DEFAULT_ACTIONS,
  piles: DEFAULT_PILES,
  visibility: DEFAULT_VISIBILITY,
  scoring: DEFAULT_SCORING,
};

export const OLD_MAID_PRESET: CardGamePresetDefinition = {
  id: 'OLD_MAID',
  minPlayers: 2,
  maxPlayers: 6,
  phases: ['PLAYER_TURNS', 'RESULT'],
  evaluation: 'LAST_HOLDER_LOSES',
  roundEndConditions: [{ kind: 'LAST_HOLDER_STANDING' }],
  defaultConfig: OLD_MAID_DEFAULT_CONFIG,
  allowed: {
    deck: [DEFAULT_DECK],
    deal: [DEFAULT_DEAL],
    actions: [DEFAULT_ACTIONS],
    piles: [DEFAULT_PILES],
    visibility: [DEFAULT_VISIBILITY],
    scoring: [DEFAULT_SCORING],
  },
};
