import { GameType, RoomState } from './core';

/**
 * Werewolf (มนุษย์หมาป่า) — hostless local-party social deduction (ADR 0015).
 *
 * Privacy contract: `WerewolfState` is broadcast to every member of the room
 * and must never contain an unrevealed role, a wolf roster, a night action, a
 * pending vote target, or any timing that betrays tonight's deaths. All of
 * that lives in PrivateStateService. Public information is: phase schedule
 * (fixed wake order), revealed deaths, vote counts after close, and the
 * winner.
 */

export const WEREWOLF_MIN_PLAYERS = 6;
export const WEREWOLF_MAX_PLAYERS = 12;

export enum WerewolfRole {
  WEREWOLF = 'WEREWOLF',
  VILLAGER = 'VILLAGER',
  SEER = 'SEER',
  DOCTOR = 'DOCTOR',
  WITCH = 'WITCH',
  HUNTER = 'HUNTER',
}

export type WerewolfTeam = 'WOLVES' | 'VILLAGE';

export enum WerewolfWolfRevealMode {
  /** Wolves look at each other across the real table; phones never carry the roster. */
  EYE_CONTACT = 'EYE_CONTACT',
  /** Each wolf receives the roster privately and never opens their eyes. */
  PRIVATE_ROSTER = 'PRIVATE_ROSTER',
}

export enum WerewolfWolfCoordinationMode {
  /** Hidden plurality of cast votes; tie = no kill. */
  SECRET_BALLOT = 'SECRET_BALLOT',
  /** Same vote, with the running tally visible to wolves only. */
  LIVE_TALLY = 'LIVE_TALLY',
  /** Kill only if every living wolf submits the same target; otherwise no kill. */
  SILENT_CONSENSUS = 'SILENT_CONSENSUS',
}

/** Night wake slots, in the fixed ADR 0015 order. */
export type WerewolfNightSlot = 'WOLVES' | 'SEER' | 'DOCTOR' | 'WITCH' | 'HUNTER_SHOT';

export enum WerewolfPhase {
  NIGHT = 'NIGHT',
  DAY_DISCUSSION = 'DAY_DISCUSSION',
  DAY_VOTE = 'DAY_VOTE',
  /** Brief dwell after the vote closes: reveal votes + lynch (and shot) result. */
  DAY_RESULT = 'DAY_RESULT',
  /** A publicly lynched Hunter picks their target on their phone. */
  DAY_HUNTER_SHOT = 'DAY_HUNTER_SHOT',
  GAME_OVER = 'GAME_OVER',
}

export enum WerewolfNightActionKind {
  KILL = 'KILL',
  CHECK = 'CHECK',
  HEAL = 'HEAL',
  POISON = 'POISON',
  SHOT = 'SHOT',
}

export interface WerewolfPlayerView {
  /** Revealed only once the player's death has been announced. */
  revealedRole?: WerewolfRole;
  alive: boolean;
  /** Role of every player, populated only at GAME_OVER. */
  finalRole?: WerewolfRole;
}

export interface WerewolfDeathAnnouncement {
  playerId: string;
  name: string;
  role: WerewolfRole;
  /** Populated only for a Hunter shot, which is announced out loud. */
  cause?: 'SHOT';
}

/** The night's resolved outcome, shown at dawn and during the day. */
export interface WerewolfDawnInfo {
  night: number;
  deaths: WerewolfDeathAnnouncement[];
}

export interface WerewolfVoteResult {
  /** Lynched player id, or null when the vote tied / abstained out. */
  lynchedPlayerId: string | null;
  /** Revealed only after the vote closes (id of voter → id of target or 'ABSTAIN'). */
  votes: Record<string, string>;
}

export interface WerewolfState {
  phase: WerewolfPhase;
  /** Server epoch ms when the current phase (or current night slot) ends. */
  phaseEndsAt: number | null;
  night: number;
  paused: boolean;
  players: Record<string, WerewolfPlayerView>;
  /** The night's slot schedule in fixed order; computed at night start. */
  nightSlots: WerewolfNightSlot[];
  /** Index into nightSlots of the slot currently running. */
  nightSlotIndex: number;
  dawn: WerewolfDawnInfo | null;
  /** Live vote-cast count during DAY_VOTE; never the targets. */
  voteProgress: { cast: number; total: number } | null;
  voteResult: WerewolfVoteResult | null;
  /** Set during DAY_HUNTER_SHOT: the (already publicly dead) Hunter choosing. */
  hunterShot: { hunterId: string; hunterName: string } | null;
  winner: WerewolfTeam | null;
}

export interface WerewolfNightPrompt {
  kind: WerewolfNightActionKind;
  /** Public player keys (WerewolfState.players) with stable display names. */
  targets: { id: string; name: string }[];
  /** Wolves only: whether the coordination mode shows the live tally. */
  showTally?: boolean;
  /** Witch only: tonight's bitten victim (id + name), null when nobody was attacked. */
  victimId?: string | null;
  victimName?: string | null;
  /** Witch only: remaining potions. */
  healRemaining?: boolean;
  poisonRemaining?: boolean;
  /** Set once this player submitted their action for the current slot. */
  submittedTargetName?: string | null;
  /** Wolves only: whether the kill was already settled this night. */
  killSettled?: boolean;
}

export interface WerewolfVision {
  night: number;
  targetName: string;
  isWolf: boolean;
}

/** Per-socket private payload. Never broadcast; peer references use names. */
export interface WerewolfPrivateState {
  role: WerewolfRole;
  /** Wolves only, and only in PRIVATE_ROSTER mode: fellow wolves by name. */
  wolves?: string[];
  /** Present while this player's wake is running; null once they acted/are skipped. */
  night?: WerewolfNightPrompt | null;
  /** Seer history across nights. */
  visions?: WerewolfVision[];
  /** Wolves only in LIVE_TALLY mode: live vote tally (voter name → target name). */
  tally?: Record<string, string>;
  /** This player's submitted day vote target name, or 'ABSTAIN'. */
  dayVote?: string | null;
}

export interface WerewolfNightActionPayload {
  code: string;
  action: WerewolfNightActionKind;
  targetId: string;
}

export interface WerewolfDayVotePayload {
  code: string;
  /** Player id from public state, or the literal 'ABSTAIN'. */
  targetId: string;
}

export interface WerewolfRoleTableResult {
  roles: WerewolfRole[];
  wolves: number;
}

/**
 * Deterministic role composition (ADR 0015): 2 wolves for 6–9 players, 3 for
 * 10–12; Seer always, Doctor from 7, Witch from 8 and Hunter from 9 when the
 * host enabled them; the rest are Villagers.
 */
export function getWerewolfRoleTable(
  playerCount: number,
  options: { witchEnabled: boolean; hunterEnabled: boolean },
): WerewolfRoleTableResult {
  const roles: WerewolfRole[] = [];
  const wolves = playerCount <= 9 ? 2 : 3;
  for (let i = 0; i < wolves; i++) roles.push(WerewolfRole.WEREWOLF);
  roles.push(WerewolfRole.SEER);
  if (playerCount >= 7) roles.push(WerewolfRole.DOCTOR);
  if (playerCount >= 8 && options.witchEnabled) roles.push(WerewolfRole.WITCH);
  if (playerCount >= 9 && options.hunterEnabled) roles.push(WerewolfRole.HUNTER);
  while (roles.length < playerCount) roles.push(WerewolfRole.VILLAGER);
  return { roles, wolves };
}

/** Parity (ADR 0015): wolves win when they equal or outnumber the living others. */
export function evaluateWerewolfWinner(
  /** One entry per player, annotated from the service's secret role map. */
  annotated: { alive: boolean; isWolf: boolean }[],
): WerewolfTeam | null {
  let wolves = 0;
  let others = 0;
  for (const { alive, isWolf } of annotated) {
    if (!alive) continue;
    if (isWolf) wolves++;
    else others++;
  }
  if (wolves === 0) return 'VILLAGE';
  if (wolves >= others) return 'WOLVES';
  return null;
}

/**
 * The night's slot schedule, computed once at game start from the roles
 * actually dealt. The schedule itself is public knowledge: which roles were
 * dealt is derivable from the lobby config and the seated count. A slot whose
 * role group is dead still burns its time silently so night length never
 * betrays a death.
 */
export function getWerewolfNightSlots(dealtRoles: WerewolfRole[]): WerewolfNightSlot[] {
  const slots: WerewolfNightSlot[] = ['WOLVES'];
  if (dealtRoles.includes(WerewolfRole.SEER)) slots.push('SEER');
  if (dealtRoles.includes(WerewolfRole.DOCTOR)) slots.push('DOCTOR');
  if (dealtRoles.includes(WerewolfRole.WITCH)) slots.push('WITCH');
  if (dealtRoles.includes(WerewolfRole.HUNTER)) slots.push('HUNTER_SHOT');
  return slots;
}

export function getWerewolfRoleDistribution(room: RoomState): WerewolfRoleTableResult | null {
  if (room.gameType !== GameType.WEREWOLF || !room.werewolfState) return null;
  const seated = room.players.filter((p) => !p.isViewer).length;
  return getWerewolfRoleTable(seated, {
    witchEnabled: room.config.werewolfWitchEnabled !== false,
    hunterEnabled: room.config.werewolfHunterEnabled !== false,
  });
}
