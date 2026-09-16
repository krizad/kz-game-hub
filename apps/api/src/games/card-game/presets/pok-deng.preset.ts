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

/**
 * Fixed Pok Deng payout multipliers (ADR 0003): each outcome tag maps to a
 * preset policy value applied server-side during showdown settlement.
 */
export const POK_DENG_MULTIPLIERS: Record<string, number> = {
  POK_9: 2,
  POK_8: 2,
  THREE_OF_A_KIND: 5,
  THREE_FACE: 3,
  STRAIGHT_FLUSH: 3,
};

const DEFAULT_DECK: DeckPolicy = { kind: 'STANDARD_52', jokers: false, copies: 1 };

const DEFAULT_DEAL: DealPolicy = {
  cardsPerPlayer: 2,
  countMode: 'EQUAL_WITH_LEFTOVERS',
  starterPolicy: 'ROTATE',
};

const DEFAULT_ACTIONS: ActionPolicy = {
  allowed: ['DRAW', 'STAND'],
  timeoutSeconds: 0,
  autoAction: 'STAND',
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
  tiePolicy: 'DEALER_WINS',
  multipliers: POK_DENG_MULTIPLIERS,
};

const DEFAULT_CONFIG: CardGameConfig = {
  preset: 'POK_DENG',
  deck: DEFAULT_DECK,
  deal: DEFAULT_DEAL,
  actions: DEFAULT_ACTIONS,
  piles: DEFAULT_PILES,
  visibility: DEFAULT_VISIBILITY,
  scoring: DEFAULT_SCORING,
};

/**
 * Pok Deng preset: rotating human dealer, two-card deal, optional third card,
 * mod-10 comparison, virtual chips and configured multipliers. Every Policy
 * the host may select is allow-listed here; anything else is rejected by
 * `validateConfig`.
 */
export const POK_DENG_PRESET: CardGamePresetDefinition = {
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
