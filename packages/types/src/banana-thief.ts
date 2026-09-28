export enum BananaThiefRole {
  THIEF = 'THIEF',
  MOUSE = 'MOUSE',
  FOLLOWER = 'FOLLOWER',
}

/**
 * Optional "special mice" DLC (room config, 5+ players). Grounded on the
 * genre's standard extra roles: DETECTIVE upgrades the solo-wake peek to a
 * thief check, TWINS are a mutually-verified innocent pair, SYCOPHANT is
 * a thief-team madman who does NOT know who the thief is, and SCAPEGOAT is
 * the classic Tanner — a neutral who WINS if the vote lands on them.
 */
export enum BananaThiefSpecial {
  DETECTIVE = 'DETECTIVE',
  TWINS = 'TWINS',
  SYCOPHANT = 'SYCOPHANT',
  SCAPEGOAT = 'SCAPEGOAT',
}

export enum BananaThiefPhase {
  /** Roles dealt; waiting for every player to tap "I'm ready". */
  SETUP = 'SETUP',
  /** Thief secretly chooses follower(s) before night hours. */
  CHOOSE_FOLLOWER = 'CHOOSE_FOLLOWER',
  /** Clock 1:00 → 6:00; players "wake" at their secret die hour. */
  NIGHT = 'NIGHT',
  /** Banana reported missing; free bluffing time (timer-gated). */
  DISCUSSION = 'DISCUSSION',
  /** Everyone votes for the thief; ballots stay sealed until reveal. */
  VOTING = 'VOTING',
  RESULT = 'RESULT',
}

export type BananaThiefWinner = 'MICE' | 'THIEF' | 'SCAPEGOAT';

/**
 * Public state broadcast to the whole room. All role/die/vote secrets live in
 * PrivateStateService — nothing here can identify the thief before RESULT,
 * when the service itself populates the reveal fields.
 */
export interface BananaThiefState {
  phase: BananaThiefPhase;
  /** Socket ids that tapped ready during SETUP (public — readiness isn't secret). */
  readyIds?: string[];
  /** Current night hour 0–6 (0 = night not started yet). */
  clock: number;
  /** Server deadline for the current night tick (client animates the clock).
   * Null in HOST-narrator mode, where the host paces the hours manually. */
  tickEndsAt?: number | null;
  /**
   * Night-end grace: hour 6 arrived but players still hold unused die peeks.
   * The night lingers a few seconds so no one gets "eyes closed" mid-action.
   */
  nightGrace?: boolean;
  /** Server deadline of the CHOOSE_FOLLOWER, DISCUSSION or VOTING phase. */
  phaseEndsAt?: number | null;
  /** Set the moment the thief steals (public knowledge only from DISCUSSION). */
  bananaStolen: boolean;
  /** Live ballot counter — identities stay sealed until RESULT. */
  votesRecorded: number;
  votesTotal: number;
  /** Reveal fields, populated only when the round reaches RESULT. */
  thiefId?: string | null;
  followerIds?: string[];
  votes?: Record<string, string>;
  caughtId?: string | null;
  /** Secret wake dice of every participant, revealed at RESULT. */
  dice?: Record<string, number>;
  /** DLC specials per participant, revealed at RESULT. */
  specials?: Record<string, BananaThiefSpecial>;
  /** True when the thief dropped mid-round and the mice win by forfeit. */
  fledThief?: boolean;
  winner?: BananaThiefWinner;
  scoreDeltas?: Record<string, number>;
}

export type BananaStatus = 'PRESENT' | 'MISSING' | 'STOLEN_BY_YOU' | 'WITNESSED_THEFT';

/** Private per-player payload delivered via PrivateStateService. */
export interface BananaThiefPrivateState {
  role: BananaThiefRole;
  /** Secret wake hour 1–6. */
  die: number;
  /** Whether the player has already used their single re-roll during SETUP. */
  rerollUsed?: boolean;
  /** Names of other players currently awake — only set while this player is
   * awake. Stored by NAME (unique per room) so a reconnect remap can't leave
   * stale socket ids inside a private payload. */
  awakePeers?: string[];
  /** Banana visibility/status in the center of the table when awake. */
  bananaStatus?: BananaStatus;
  /** One-time solo-wake reward: peek at another player's die. */
  peekOffer?: boolean;
  /** Die peek; DETECTIVE's peek carries the target's role instead. */
  peekResult?: { targetId: string; targetName: string; die: number; role?: BananaThiefRole };
  /** Set privately on the thief the moment their steal executes. */
  stole?: boolean;
  /** Thief-only: names of the mice that woke in the steal hour and saw it. */
  witnesses?: string[];
  /** Follower-only: the thief's name, revealed at the moment of conversion. */
  seesThief?: string;
  /** Thief-only: names of the chosen follower(s). */
  chosenFollowers?: string[];
  /** DLC: this player's special-mice role, if any. */
  special?: BananaThiefSpecial;
  /** DLC Twins: the partner's name — both are verified non-thieves. */
  twinPartner?: string;
}

export interface BananaThiefPeekPayload {
  code: string;
  targetId: string;
}

export interface BananaThiefVotePayload {
  code: string;
  targetId: string;
}

export interface BananaThiefChooseFollowerPayload {
  code: string;
  targetId: string;
}

export interface BananaThiefReactionPayload {
  code: string;
  emoji: string;
}

export const BANANA_THIEF_REACTIONS = ['🐭', '🧀', '😱', '😂', '👀', '🎯', '🤷', '😴'] as const;

export const BANANA_THIEF_MIN_PLAYERS = 4;
export const BANANA_THIEF_CLOCK_HOURS = 6;

export interface BananaThiefPlayerRequirement {
  min: number;
  recommended: number;
  followerCount: number;
  specialsCount: number;
  plainMiceCount: number;
  breakdown: {
    labelKey: string;
    count: number;
  }[];
}

/**
 * Calculates the required/recommended player count based on config.
 * Formula: 1 Thief + Follower Count (if > 0) + Specials Count (Twins=2, others=1) + at least 2 Plain Mice.
 * Absolute minimum is 4.
 */
export function getBananaThiefRequiredPlayerCount(config?: {
  bananaThiefFollowerCount?: number;
  bananaThiefSelectedSpecials?: BananaThiefSpecial[];
}): BananaThiefPlayerRequirement {
  const followerCount = config?.bananaThiefFollowerCount ?? 1;
  const specials = config?.bananaThiefSelectedSpecials ?? [];

  let specialsTotal = 0;
  for (const s of specials) {
    if (s === BananaThiefSpecial.TWINS) {
      specialsTotal += 2;
    } else {
      specialsTotal += 1;
    }
  }

  const calculatedMin = 1 + followerCount + specialsTotal + 2;
  const min = Math.max(BANANA_THIEF_MIN_PLAYERS, calculatedMin);
  const recommended = min + 1;

  const breakdown: { labelKey: string; count: number }[] = [
    { labelKey: 'gameBananaThief.breakdownThief', count: 1 },
  ];
  if (followerCount > 0) {
    breakdown.push({ labelKey: 'gameBananaThief.breakdownFollower', count: followerCount });
  }
  if (specialsTotal > 0) {
    breakdown.push({ labelKey: 'gameBananaThief.breakdownSpecials', count: specialsTotal });
  }
  breakdown.push({ labelKey: 'gameBananaThief.breakdownPlainMice', count: 2 });

  return {
    min,
    recommended,
    followerCount,
    specialsCount: specialsTotal,
    plainMiceCount: 2,
    breakdown,
  };
}
