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

/** Slave rank order: 3 is lowest and 2 is highest (CONTEXT.md MVP contract). */
export const SLAVE_RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const DEFAULT_DECK: DeckPolicy = { kind: 'STANDARD_52', jokers: false, copies: 1 };

const DEFAULT_DEAL: DealPolicy = {
  cardsPerPlayer: 13,
  countMode: 'DEAL_ALL_UNEVEN',
  starterPolicy: 'ROTATE',
};

const DEFAULT_ACTIONS: ActionPolicy = {
  allowed: ['PLAY', 'PASS'],
  timeoutSeconds: 0,
  autoAction: 'PASS',
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

const DEFAULT_CONFIG: CardGameConfig = {
  preset: 'SLAVE',
  deck: DEFAULT_DECK,
  deal: DEFAULT_DEAL,
  actions: DEFAULT_ACTIONS,
  piles: DEFAULT_PILES,
  visibility: DEFAULT_VISIBILITY,
  scoring: DEFAULT_SCORING,
};

/**
 * Slave preset: every card is dealt (the remainder goes to the earliest seats), so
 * hand sizes may differ by one. The 3♣ holder opens with single/pair/triple
 * combinations, following plays must match the size and beat the rank, passing is
 * final for the trick, and the first player to empty their hand wins the round.
 * 2 ranks highest.
 */
export const SLAVE_PRESET: CardGamePresetDefinition = {
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
    actions: [
      DEFAULT_ACTIONS,
      { allowed: ['PLAY', 'PASS'], timeoutSeconds: 20, autoAction: 'PASS' },
    ],
    piles: [DEFAULT_PILES],
    visibility: [DEFAULT_VISIBILITY],
    scoring: [DEFAULT_SCORING],
  },
};
