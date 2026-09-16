import { ActionPolicy, CardActionKind, CardDecision, CardGameConfig, CardGamePhase, CardGamePresetDefinition, CardGamePublicState, CardGameResult, DealPolicy, DeckPolicy, PilePolicy, PlayingCard, RoundEndCondition, RoundEndConditionKind, StarterPolicy, TiePolicy, VisibilityPolicy } from '@repo/types';
export declare const RANKS: PlayingCard['rank'][];
export declare const SUITS: PlayingCard['suit'][];
export declare const RANK_INDEX: Record<PlayingCard["rank"], number>;
export type RandomIndex = (maxExclusive: number) => number;
export interface DealPreview {
    perPlayer: number;
    stockSize: number;
    reserveSize: number;
}
export interface PileStacks {
    stock: PlayingCard[];
    discards: PlayingCard[];
    reserve: PlayingCard[];
}
export interface ValidationResult {
    ok: boolean;
    config?: CardGameConfig;
    errors?: string[];
}
export interface DealPreviewResult {
    ok: boolean;
    preview?: DealPreview;
    error?: string;
}
export interface DealRoundResult {
    ok: boolean;
    hands?: Record<string, PlayingCard[]>;
    stock?: PlayingCard[];
    reserve?: PlayingCard[];
    error?: string;
}
export interface DrawResult {
    ok: boolean;
    card?: PlayingCard;
    stacks?: PileStacks;
    reason?: 'END_ROUND';
}
export interface RoundSnapshot {
    preset: CardGamePublicState['preset'];
    phase: CardGamePhase;
    dealerId: string;
    activePlayerId: string | null;
    playerOrder: string[];
    hands: Record<string, PlayingCard[]>;
    chips: Record<string, number>;
    decisions: Record<string, CardDecision>;
    result?: CardGameResult;
}
export interface RoundEndContext {
    phase: CardGamePhase;
    naturalPlayerIds: string[];
    pendingPlayerIds: string[];
    dealerResolved: boolean;
    stockEmpty: boolean;
}
export interface ShowdownInput {
    playerOrder: string[];
    dealerId: string;
    hands: Record<string, PlayingCard[]>;
    tiePolicy: TiePolicy;
    baseStake: number;
    multipliers: Record<string, number>;
}
export interface ShowdownOutcome {
    dealerScore: number;
    scores: Record<string, number>;
    outcomeTags: Record<string, string>;
    winnerIds: string[];
    deltas: Record<string, number>;
    revealedHands: Record<string, PlayingCard[]>;
}
export declare function createDeck(policy: DeckPolicy): PlayingCard[];
export declare function shuffleDeck(deck: PlayingCard[], randomIndex?: RandomIndex): PlayingCard[];
export declare function stableSerialise(value: unknown): string;
export declare function validateConfig(input: Partial<CardGameConfig> | undefined, preset: CardGamePresetDefinition): ValidationResult;
export declare function deepCopyJson<T>(value: T): T;
export declare function previewDeal(deckSize: number, playerCount: number, policy: DealPolicy, reserveSize?: number): DealPreviewResult;
export declare function dealRound(deck: PlayingCard[], playerIds: string[], policy: DealPolicy, reserveSize?: number): DealRoundResult;
export declare function drawFromStacks(stacks: PileStacks, policy: PilePolicy, randomIndex?: RandomIndex): DrawResult;
export interface StarterContext {
    playerOrder: string[];
    previousStarterId?: string;
    previousWinnerId?: string;
    previousLoserId?: string;
    randomIndex?: RandomIndex;
}
export declare function resolveStarter(policy: StarterPolicy, context: StarterContext): string | null;
export declare function toPublicState(snapshot: RoundSnapshot, visibility: VisibilityPolicy, viewerId?: string): CardGamePublicState;
export declare function evaluateRoundEnd(conditions: RoundEndCondition[], context: RoundEndContext): RoundEndConditionKind | null;
export declare function autoActionFor(policy: ActionPolicy): CardActionKind;
export declare function mod10Score(hand: PlayingCard[]): number;
export declare function outcomeTagForMod10(hand: PlayingCard[]): string;
export declare function rankIndexIn(rankOrder: string[], rank: PlayingCard['rank']): number;
export declare function isSameRankGroup(cards: PlayingCard[], maxSize?: number): boolean;
export declare function beatsRankGroup(candidate: PlayingCard[], current: PlayingCard[], rankOrder: string[]): boolean;
export declare function settleMod10Showdown(input: ShowdownInput): ShowdownOutcome;
