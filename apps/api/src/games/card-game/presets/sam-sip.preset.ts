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

/** Sum-to-ten pair values: A=1 … 9 face value, 10/J/Q/K = 10 and can never pair. */
export const SAM_SIP_CARD_VALUES: Record<string, number> = {
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

const DEFAULT_DECK: DeckPolicy = { kind: 'STANDARD_52', jokers: false, copies: 1 };
const DEFAULT_DEAL: DealPolicy = {
  cardsPerPlayer: 5,
  countMode: 'EQUAL_WITH_LEFTOVERS',
  starterPolicy: 'ROTATE',
};
const DEFAULT_ACTIONS: ActionPolicy = {
  allowed: ['DRAW', 'CLAIM', 'DISCARD'],
  timeoutSeconds: 0,
  autoAction: 'DRAW',
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

export const SAM_SIP_DEFAULT_CONFIG: CardGameConfig = {
  preset: 'SAM_SIP',
  deck: DEFAULT_DECK,
  deal: DEFAULT_DEAL,
  actions: DEFAULT_ACTIONS,
  piles: DEFAULT_PILES,
  visibility: DEFAULT_VISIBILITY,
  scoring: DEFAULT_SCORING,
};

export const SAM_SIP_PRESET: CardGamePresetDefinition = {
  id: 'SAM_SIP',
  minPlayers: 2,
  maxPlayers: 4,
  phases: ['PLAYER_TURNS', 'RESULT'],
  evaluation: 'PAIR_REMOVAL',
  roundEndConditions: [{ kind: 'FIRST_EMPTY_HAND' }, { kind: 'STOCK_EMPTY' }],
  defaultConfig: SAM_SIP_DEFAULT_CONFIG,
  allowed: {
    deck: [DEFAULT_DECK],
    deal: [DEFAULT_DEAL],
    actions: [DEFAULT_ACTIONS],
    piles: [DEFAULT_PILES],
    visibility: [DEFAULT_VISIBILITY],
    scoring: [DEFAULT_SCORING],
  },
};
