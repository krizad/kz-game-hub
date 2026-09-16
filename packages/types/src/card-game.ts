export interface PlayingCard {
  id: string;
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  suit: 'CLUBS' | 'DIAMONDS' | 'HEARTS' | 'SPADES';
}

export type CardGamePreset = 'POK_DENG' | 'SLAVE' | 'SAM_SIP' | 'OLD_MAID';

export type CardGamePhase = 'PLAYER_TURNS' | 'RESULT';

export type CardDecision =
  | 'PENDING'
  | 'STAND'
  | 'DRAWN'
  | 'NATURAL'
  | 'PLAYED'
  | 'PASSED'
  | 'CLAIMED'
  | 'DISCARDED'
  | 'TOOK';

export interface DeckPolicy {
  kind: 'STANDARD_52';
  jokers: boolean;
  copies: number;
}

/**
 * EQUAL_WITH_LEFTOVERS: deal exactly `cardsPerPlayer` to each seat, keep the rest in stock.
 * DEAL_ALL: every card is dealt; requires the deck to divide evenly (hand size is derived).
 * DEAL_ALL_UNEVEN: every card is dealt round-robin, with the remainder going to the earliest
 * seats, so hands may differ by one and the stock stays empty.
 * REJECT_IF_NOT_EVEN: deal exactly `cardsPerPlayer` to each seat and reject unless the deck is fully consumed.
 */
export type DealCountMode =
  | 'EQUAL_WITH_LEFTOVERS'
  | 'DEAL_ALL'
  | 'DEAL_ALL_UNEVEN'
  | 'REJECT_IF_NOT_EVEN';

export type StarterPolicy =
  | 'RANDOM'
  | 'HOST_SELECT'
  | 'ROTATE'
  | 'PREVIOUS_WINNER'
  | 'PREVIOUS_LOSER';

export interface DealPolicy {
  cardsPerPlayer: number;
  countMode: DealCountMode;
  starterPolicy: StarterPolicy;
}

export type CardActionKind = 'DRAW' | 'STAND' | 'PLAY' | 'PASS' | 'CLAIM' | 'DISCARD' | 'TAKE_CARD';

export interface ActionPolicy {
  allowed: CardActionKind[];
  timeoutSeconds: number;
  autoAction: CardActionKind;
}

export type StockExhaustionPolicy = 'END_ROUND' | 'RESHUFFLE_DISCARDS_EXCEPT_TOP' | 'USE_RESERVE';

export interface PilePolicy {
  stockExhaustion: StockExhaustionPolicy;
  reserveSize: number;
}

export interface VisibilityPolicy {
  revealHandsAtEnd: boolean;
  revealStarterCard: boolean;
  othersHandCountsVisible: boolean;
}

export type TiePolicy = 'DEALER_WINS' | 'PLAYER_WINS' | 'PUSH';

export interface ScoringPolicy {
  startingChips: number;
  baseStake: number;
  tiePolicy: TiePolicy;
  /** Preset-defined outcome tag -> payout multiplier. Values are validated finite numbers. */
  multipliers: Record<string, number>;
}

/** Host-editable Advanced Rules. Every category is allow-listed by the active preset. */
export interface CardGameConfig {
  preset: CardGamePreset;
  deck: DeckPolicy;
  deal: DealPolicy;
  actions: ActionPolicy;
  piles: PilePolicy;
  visibility: VisibilityPolicy;
  scoring: ScoringPolicy;
}

export type RoundEndConditionKind =
  | 'NATURAL_HAND'
  | 'ALL_PLAYERS_RESOLVED'
  | 'DEALER_RESOLVED'
  | 'STOCK_EMPTY'
  | 'FIRST_EMPTY_HAND'
  | 'LAST_HOLDER_STANDING';

export interface RoundEndCondition {
  kind: RoundEndConditionKind;
}

export type EvaluationRule = 'MOD_10_SHOWDOWN' | 'TRICK_TAKING' | 'PAIR_REMOVAL' | 'LAST_HOLDER_LOSES';

/** Allow-listed policy variants a preset offers, projected to the client for Advanced Rules controls. */
export interface CardGameAllowedOptions {
  deck: DeckPolicy[];
  deal: DealPolicy[];
  actions: ActionPolicy[];
  piles: PilePolicy[];
  visibility: VisibilityPolicy[];
  scoring: ScoringPolicy[];
}

export interface CardGamePresetDefinition {
  id: CardGamePreset;
  minPlayers: number;
  maxPlayers: number;
  phases: CardGamePhase[];
  evaluation: EvaluationRule;
  roundEndConditions: RoundEndCondition[];
  defaultConfig: CardGameConfig;
  allowed: CardGameAllowedOptions;
}

export interface CardGameResult {
  dealerScore?: number;
  playerScores: Record<string, number>;
  outcomeTags?: Record<string, string>;
  /** Seat order from first place onwards, when the preset ranks every player. */
  placements?: string[];
  winnerIds: string[];
  revealedHands: Record<string, PlayingCard[]>;
}

/** Public view of the trick currently on the table (Slave). Played cards are revealed. */
export interface TrickState {
  leaderId: string;
  playedById: string | null;
  cards: PlayingCard[];
  passIds: string[];
}

/** Redacted snapshot broadcast to every room member. Never carries unrevealed hands. */
export interface CardGamePublicState {
  preset: CardGamePreset;
  phase: CardGamePhase;
  dealerId: string;
  activePlayerId: string | null;
  playerOrder: string[];
  handCounts: Record<string, number>;
  chips: Record<string, number>;
  decisions: Record<string, CardDecision>;
  trick?: TrickState;
  /** Top card of the discard pile, revealed by design (Sam Sip claim window). */
  discardTop?: PlayingCard | null;
  result?: CardGameResult;
}

/** Sent only to the entitled socket through PrivateStateService. */
export interface CardGamePrivateState {
  preset: CardGamePreset;
  hand: PlayingCard[];
  prompt?: string;
}

export type CardGameAction =
  | { type: 'DRAW' }
  | { type: 'STAND' }
  | { type: 'NEXT_ROUND' }
  | { type: 'PLAY'; cards: string[] }
  | { type: 'PASS' }
  | { type: 'CLAIM' }
  | { type: 'DISCARD'; cardId: string }
  | { type: 'TAKE_CARD'; index: number };

export type CardGameLogKind =
  | 'DREW'
  | 'STOOD'
  | 'PLAYED'
  | 'PASSED'
  | 'CLAIMED'
  | 'DISCARDED'
  | 'TOOK';

/** Public-safe action log entry: never carries hidden card identities (ADR 0002). */
export interface CardGameLogEntry {
  actorId: string;
  kind: CardGameLogKind;
  count?: number;
}

export interface CardGameImportRulesRequest {
  /** Room code the rules are imported into. */
  code: string;
  shareCode: string;
}

export interface CardGameImportRulesResult {
  ok: boolean;
  config?: CardGameConfig;
  error?: string;
}

export interface CardGamePublishRulesRequest {
  /** Room code the rules are published from; only its lobby host may publish. */
  code: string;
  config: CardGameConfig;
}

export interface CardGamePublishRulesResult {
  ok: boolean;
  shareCode?: string;
  error?: string;
}
