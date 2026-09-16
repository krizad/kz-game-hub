import { randomInt } from 'crypto';
import {
  ActionPolicy,
  CardActionKind,
  CardDecision,
  CardGameConfig,
  CardGamePhase,
  CardGamePresetDefinition,
  CardGamePublicState,
  CardGameResult,
  DealPolicy,
  DeckPolicy,
  PilePolicy,
  PlayingCard,
  RoundEndCondition,
  RoundEndConditionKind,
  StarterPolicy,
  TiePolicy,
  VisibilityPolicy,
} from '@repo/types';

/**
 * Pure, deterministic card-engine primitives. No Nest wiring, no room state, no I/O.
 * Piles are plain arrays where the LAST element is the top of the pile (drawn first).
 */

export const RANKS: PlayingCard['rank'][] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export const SUITS: PlayingCard['suit'][] = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];

export const RANK_INDEX = Object.fromEntries(RANKS.map((rank, index) => [rank, index])) as Record<
  PlayingCard['rank'],
  number
>;

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

export function createDeck(policy: DeckPolicy): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (let copy = 0; copy < policy.copies; copy += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const id = policy.copies > 1 ? `${rank}-${suit}#${copy}` : `${rank}-${suit}`;
        deck.push({ id, rank, suit });
      }
    }
  }
  return deck;
}

export function shuffleDeck(deck: PlayingCard[], randomIndex: RandomIndex = randomInt): PlayingCard[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

export function stableSerialise(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function validateConfig(
  input: Partial<CardGameConfig> | undefined,
  preset: CardGamePresetDefinition,
): ValidationResult {
  const errors: string[] = [];
  const source = input ?? {};

  if (source.preset !== undefined && source.preset !== preset.id) {
    errors.push(`preset: expected ${preset.id}`);
  }
  if (!Number.isInteger(preset.minPlayers) || preset.minPlayers < 2) {
    errors.push('preset: minPlayers must be at least 2');
  }
  if (!Number.isInteger(preset.maxPlayers) || preset.maxPlayers < preset.minPlayers) {
    errors.push('preset: maxPlayers must be greater than or equal to minPlayers');
  }
  if (preset.phases.length === 0) {
    errors.push('preset: phases must not be empty');
  }

  const deck = source.deck ?? preset.defaultConfig.deck;
  const deal = source.deal ?? preset.defaultConfig.deal;
  const actions = source.actions ?? preset.defaultConfig.actions;
  const piles = source.piles ?? preset.defaultConfig.piles;
  const visibility = source.visibility ?? preset.defaultConfig.visibility;
  const scoring = source.scoring ?? preset.defaultConfig.scoring;

  const allow = <T>(name: string, value: T, allowed: T[], collected: string[]): void => {
    if (!allowed.some((entry) => stableSerialise(entry) === stableSerialise(value))) {
      collected.push(`${name}: policy is not allowed by the preset`);
    }
  };
  const allowErrors: string[] = [];
  allow('deck', deck, preset.allowed.deck, allowErrors);
  allow('deal', deal, preset.allowed.deal, allowErrors);
  allow('actions', actions, preset.allowed.actions, allowErrors);
  allow('piles', piles, preset.allowed.piles, allowErrors);
  allow('visibility', visibility, preset.allowed.visibility, allowErrors);
  allow('scoring', scoring, preset.allowed.scoring, allowErrors);

  if (allowErrors.length > 0) return { ok: false, errors: [...errors, ...allowErrors] };

  if (!Number.isInteger(deck.copies) || deck.copies < 1 || deck.copies > 2) {
    errors.push('deck: copies must be an integer between 1 and 2');
  }
  if (deck.jokers) {
    errors.push('deck: jokers are not supported');
  }
  if (!Number.isInteger(deal.cardsPerPlayer) || deal.cardsPerPlayer < 1 || deal.cardsPerPlayer > 13) {
    errors.push('deal: cardsPerPlayer must be an integer between 1 and 13');
  }
  if (actions.allowed.length === 0) {
    errors.push('actions: allowed must not be empty');
  }
  if (new Set(actions.allowed).size !== actions.allowed.length) {
    errors.push('actions: allowed must not contain duplicates');
  }
  if (
    !Number.isInteger(actions.timeoutSeconds) ||
    actions.timeoutSeconds < 0 ||
    actions.timeoutSeconds > 600
  ) {
    errors.push('actions: timeoutSeconds must be an integer between 0 and 600');
  }
  if (!actions.allowed.includes(actions.autoAction)) {
    errors.push('actions: autoAction must be one of the allowed actions');
  }
  if (!Number.isInteger(piles.reserveSize) || piles.reserveSize < 0 || piles.reserveSize > 52) {
    errors.push('piles: reserveSize must be an integer between 0 and 52');
  }
  if (piles.stockExhaustion !== 'USE_RESERVE' && piles.reserveSize !== 0) {
    errors.push('piles: reserveSize must be 0 unless the exhaustion policy uses a reserve');
  }
  if (
    !Number.isInteger(scoring.startingChips) ||
    scoring.startingChips < 0 ||
    scoring.startingChips > 100000
  ) {
    errors.push('scoring: startingChips must be an integer between 0 and 100000');
  }
  if (!Number.isInteger(scoring.baseStake) || scoring.baseStake < 1 || scoring.baseStake > 1000) {
    errors.push('scoring: baseStake must be an integer between 1 and 1000');
  }
  for (const [tag, multiplier] of Object.entries(scoring.multipliers)) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      errors.push(`scoring: multiplier for ${tag} must be a positive finite number`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      preset: preset.id,
      deck: deepCopyJson(deck),
      deal: deepCopyJson(deal),
      actions: deepCopyJson(actions),
      piles: deepCopyJson(piles),
      visibility: deepCopyJson(visibility),
      scoring: deepCopyJson(scoring),
    },
  };
}

/** Returns an independent JSON copy so room configs never share references with preset defaults. */
export function deepCopyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function previewDeal(
  deckSize: number,
  playerCount: number,
  policy: DealPolicy,
  reserveSize = 0,
): DealPreviewResult {
  if (!Number.isInteger(deckSize) || deckSize < 1) {
    return { ok: false, error: 'deal: the deck is empty' };
  }
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    return { ok: false, error: 'deal: at least one player is required' };
  }
  const reserved = Math.min(Math.max(reserveSize, 0), deckSize);
  const usable = deckSize - reserved;

  if (policy.countMode === 'DEAL_ALL') {
    if (usable % playerCount !== 0) {
      return { ok: false, error: 'deal: the deck cannot be divided evenly across the players' };
    }
    const perPlayer = usable / playerCount;
    if (perPlayer < 1) return { ok: false, error: 'deal: not enough cards to deal' };
    return { ok: true, preview: { perPlayer, stockSize: 0, reserveSize: reserved } };
  }

  const dealt = policy.cardsPerPlayer * playerCount;
  if (policy.countMode === 'REJECT_IF_NOT_EVEN' && dealt !== usable) {
    return { ok: false, error: 'deal: the deck would not be fully consumed' };
  }
  if (dealt > usable) {
    return { ok: false, error: 'deal: not enough cards to deal' };
  }
  return { ok: true, preview: { perPlayer: policy.cardsPerPlayer, stockSize: usable - dealt, reserveSize: reserved } };
}

export function dealRound(
  deck: PlayingCard[],
  playerIds: string[],
  policy: DealPolicy,
  reserveSize = 0,
): DealRoundResult {
  if (new Set(playerIds).size !== playerIds.length) {
    return { ok: false, error: 'deal: player ids must be unique' };
  }
  const previewed = previewDeal(deck.length, playerIds.length, policy, reserveSize);
  if (!previewed.ok || !previewed.preview) {
    return { ok: false, error: previewed.error ?? 'deal: invalid deal policy' };
  }
  const preview = previewed.preview;

  const stock = [...deck];
  const reserve: PlayingCard[] = [];
  for (let count = 0; count < preview.reserveSize; count += 1) {
    reserve.push(stock.pop()!);
  }
  const hands: Record<string, PlayingCard[]> = {};
  for (const id of playerIds) hands[id] = [];
  for (let round = 0; round < preview.perPlayer; round += 1) {
    for (const id of playerIds) hands[id].push(stock.pop()!);
  }
  return { ok: true, hands, stock, reserve };
}

export function drawFromStacks(
  stacks: PileStacks,
  policy: PilePolicy,
  randomIndex: RandomIndex = randomInt,
): DrawResult {
  const next: PileStacks = {
    stock: [...stacks.stock],
    discards: [...stacks.discards],
    reserve: [...stacks.reserve],
  };

  const fromStock = next.stock.pop();
  if (fromStock) return { ok: true, card: fromStock, stacks: next };

  if (policy.stockExhaustion === 'USE_RESERVE') {
    const fromReserve = next.reserve.pop();
    if (fromReserve) return { ok: true, card: fromReserve, stacks: next };
    return { ok: false, reason: 'END_ROUND' };
  }

  if (policy.stockExhaustion === 'RESHUFFLE_DISCARDS_EXCEPT_TOP') {
    const topDiscard = next.discards.at(-1);
    const rest = topDiscard ? next.discards.slice(0, -1) : next.discards;
    if (rest.length === 0) return { ok: false, reason: 'END_ROUND' };
    next.discards = topDiscard ? [topDiscard] : [];
    next.stock = shuffleDeck(rest, randomIndex);
    const reshuffledTop = next.stock.pop();
    if (!reshuffledTop) return { ok: false, reason: 'END_ROUND' };
    return { ok: true, card: reshuffledTop, stacks: next };
  }

  return { ok: false, reason: 'END_ROUND' };
}

export interface StarterContext {
  playerOrder: string[];
  previousStarterId?: string;
  previousWinnerId?: string;
  previousLoserId?: string;
  randomIndex?: RandomIndex;
}

export function resolveStarter(policy: StarterPolicy, context: StarterContext): string | null {
  const { playerOrder } = context;
  if (playerOrder.length === 0) return null;

  const seatAfter = (id: string | undefined): string => {
    const index = id ? playerOrder.indexOf(id) : -1;
    return playerOrder[(index + 1) % playerOrder.length];
  };

  switch (policy) {
    case 'RANDOM': {
      const random = context.randomIndex ?? randomInt;
      return playerOrder[random(playerOrder.length)];
    }
    case 'ROTATE':
      return seatAfter(context.previousStarterId);
    case 'PREVIOUS_WINNER':
      return context.previousWinnerId ?? playerOrder[0];
    case 'PREVIOUS_LOSER':
      return context.previousLoserId ?? playerOrder[0];
    default:
      return null;
  }
}

export function toPublicState(
  snapshot: RoundSnapshot,
  visibility: VisibilityPolicy,
  viewerId?: string,
): CardGamePublicState {
  const handCounts: Record<string, number> = {};
  for (const id of snapshot.playerOrder) {
    const isViewer = viewerId !== undefined && id === viewerId;
    if (visibility.othersHandCountsVisible || isViewer) {
      handCounts[id] = snapshot.hands[id]?.length ?? 0;
    }
  }

  const keepHands = visibility.revealHandsAtEnd && snapshot.phase === 'RESULT';
  const result: CardGameResult | undefined = snapshot.result
    ? {
        ...snapshot.result,
        revealedHands: keepHands ? snapshot.result.revealedHands : {},
      }
    : undefined;

  return {
    preset: snapshot.preset,
    phase: snapshot.phase,
    dealerId: snapshot.dealerId,
    activePlayerId: snapshot.activePlayerId,
    playerOrder: [...snapshot.playerOrder],
    handCounts,
    chips: { ...snapshot.chips },
    decisions: { ...snapshot.decisions },
    ...(result ? { result } : {}),
  };
}

export function evaluateRoundEnd(
  conditions: RoundEndCondition[],
  context: RoundEndContext,
): RoundEndConditionKind | null {
  for (const condition of conditions) {
    if (condition.kind === 'NATURAL_HAND' && context.naturalPlayerIds.length > 0) return condition.kind;
    if (condition.kind === 'ALL_PLAYERS_RESOLVED' && context.pendingPlayerIds.length === 0) return condition.kind;
    if (condition.kind === 'DEALER_RESOLVED' && context.dealerResolved) return condition.kind;
    if (condition.kind === 'STOCK_EMPTY' && context.stockEmpty) return condition.kind;
  }
  return null;
}

export function autoActionFor(policy: ActionPolicy): CardActionKind {
  return policy.autoAction;
}

function cardValue(card: PlayingCard): number {
  if (card.rank === 'A') return 1;
  const numeric = Number(card.rank);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function mod10Score(hand: PlayingCard[]): number {
  return hand.reduce((total, card) => total + cardValue(card), 0) % 10;
}

export function outcomeTagForMod10(hand: PlayingCard[]): string {
  if (hand.length === 3) {
    if (hand.every((card) => card.rank === hand[0].rank)) return 'THREE_OF_A_KIND';
    if (hand.every((card) => card.rank === 'J' || card.rank === 'Q' || card.rank === 'K')) {
      return 'THREE_FACE';
    }
    const sameSuit = hand.every((card) => card.suit === hand[0].suit);
    if (sameSuit) {
      const indices = hand.map((card) => RANK_INDEX[card.rank]).sort((left, right) => left - right);
      if (indices[1] === indices[0] + 1 && indices[2] === indices[1] + 1) return 'STRAIGHT_FLUSH';
    }
  }
  if (hand.length === 2) {
    const score = mod10Score(hand);
    if (score === 8) return 'POK_8';
    if (score === 9) return 'POK_9';
  }
  return 'NORMAL';
}

export function rankIndexIn(rankOrder: string[], rank: PlayingCard['rank']): number {
  return rankOrder.indexOf(rank);
}

export function isSameRankGroup(cards: PlayingCard[], maxSize = 3): boolean {
  if (cards.length === 0 || cards.length > maxSize) return false;
  return cards.every((card) => card.rank === cards[0].rank);
}

/** Compares same-size same-rank groups under a preset rank order (last index is highest). */
export function beatsRankGroup(
  candidate: PlayingCard[],
  current: PlayingCard[],
  rankOrder: string[],
): boolean {
  if (candidate.length === 0) return false;
  if (current.length === 0) return true;
  if (candidate.length !== current.length) return false;
  if (!isSameRankGroup(candidate) || !isSameRankGroup(current)) return false;
  return rankIndexIn(rankOrder, candidate[0].rank) > rankIndexIn(rankOrder, current[0].rank);
}

export function settleMod10Showdown(input: ShowdownInput): ShowdownOutcome {
  const { playerOrder, dealerId, hands } = input;
  const dealerHand = hands[dealerId] ?? [];
  const dealerScore = mod10Score(dealerHand);

  const scores: Record<string, number> = {};
  const outcomeTags: Record<string, string> = {};
  const winnerIds: string[] = [];
  const deltas: Record<string, number> = {};
  const revealedHands: Record<string, PlayingCard[]> = {};

  for (const id of playerOrder) {
    const hand = hands[id] ?? [];
    scores[id] = mod10Score(hand);
    outcomeTags[id] = outcomeTagForMod10(hand);
    revealedHands[id] = hand.map((card) => ({ ...card }));
    deltas[id] = 0;
  }
  deltas[dealerId] = deltas[dealerId] ?? 0;

  for (const id of playerOrder) {
    if (id === dealerId) continue;
    const playerScore = scores[id];
    const playerWins =
      playerScore > dealerScore || (playerScore === dealerScore && input.tiePolicy === 'PLAYER_WINS');
    const push = playerScore === dealerScore && input.tiePolicy === 'PUSH';

    if (playerWins) {
      const stake = input.baseStake * (input.multipliers[outcomeTags[id]] ?? 1);
      deltas[id] += stake;
      deltas[dealerId] -= stake;
      winnerIds.push(id);
    } else if (!push) {
      const stake = input.baseStake * (input.multipliers[outcomeTags[dealerId]] ?? 1);
      deltas[id] -= stake;
      deltas[dealerId] += stake;
    }
  }

  return { dealerScore, scores, outcomeTags, winnerIds, deltas, revealedHands };
}
