import { Injectable } from '@nestjs/common';
import {
  GameType,
  RoomState,
  RoomStatus,
  UserState,
  WerewolfNightActionKind,
  WerewolfNightSlot,
  WerewolfPhase,
  WerewolfPlayerView,
  WerewolfRole,
  WerewolfState,
  WerewolfTeam,
  WerewolfVision,
  WerewolfWolfCoordinationMode,
  WerewolfWolfRevealMode,
  WEREWOLF_MAX_PLAYERS,
  WEREWOLF_MIN_PLAYERS,
  evaluateWerewolfWinner,
  getWerewolfNightSlots,
  getWerewolfRoleTable,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';

/**
 * Werewolf (ADR 0015) — hostless local-party social deduction.
 *
 * Secrets live ONLY in PrivateStateService:
 *  - per player: `wwRole` (role value), `wwWolves` (PRIVATE_ROSTER roster by
 *    name), `wwNight` (current wake prompt), `wwTally` (LIVE_TALLY votes by
 *    name), `wwVisions` (Seer history by name), `wwDayVote` (own vote by
 *    name) — all moved wholesale on reconnect by the shared remap;
 *  - room level under the `__room__` pseudo socket (`WW_*` records), keyed by
 *    the stable UserState.id so nothing inside them needs remapping.
 *
 * The public `WerewolfState` carries phases, the fixed slot schedule, revealed
 * deaths and closed vote results only. Night length is constant regardless of
 * who is alive, so timing itself can never betray a death: a slot whose role
 * group is dead burns silently instead of being skipped.
 *
 * Phase timers are deadline-driven: the service only sets `phaseEndsAt`; the
 * gateway's `syncWerewolfTimer` re-arms `RoomTimerService` on every broadcast
 * and calls {@link handlePhaseTimeout}. A paused phase has `phaseEndsAt === null`,
 * which the sync helper treats as "cancel the timer".
 */

const ROOM_KEY = '__room__';
const K_NIGHT = 'WW_NIGHT';
const K_PAUSE = 'WW_PAUSE';
const K_DOCTOR_LAST = 'WW_DOCTOR_LAST';
const K_POTIONS = 'WW_WITCH_POTIONS';
const K_DAY_VOTES = 'WW_DAY_VOTES';
const K_HUNTER_DAY_SHOT = 'WW_HUNTER_DAY_SHOT';
const K_LYNCHED_HUNTER = 'WW_LYNCHED_HUNTER';
const K_AFTER_RESULT = 'WW_AFTER_RESULT';

const WW_RECONNECT_GRACE_MS = 60_000;
/** Dwell after the vote closes so the table hears the lynch/shot announcement. */
const RESULT_DWELL_MS = 8_000;

interface WerewolfNightRecord {
  /** Living wolf votes: voter UserState.id → target UserState.id. */
  killVotes: Record<string, string>;
  bittenPlayerId: string | null;
  killSettled: boolean;
  checkTargetPlayerId: string | null;
  doctorHealPlayerId: string | null;
  witchHealPlayerId: string | null;
  witchPoisonPlayerId: string | null;
  hunterShotTargetPlayerId: string | null;
  /** Set at HUNTER_SHOT slot start: the bitten hunter who will die and may shoot. */
  hunterShotHunterId: string | null;
}

interface WerewolfPauseRecord {
  remainingMs: number;
  graceEndsAtById: Record<string, number>;
}

type WitchPotions = { healUsed: boolean; poisonUsed: boolean };

@Injectable()
export class WerewolfService {
  constructor(private readonly privateStateService: PrivateStateService) {}

  // --- configuration helpers ---

  private nightSeconds(room: RoomState): number {
    return room.config.werewolfNightSeconds ?? 20;
  }

  private discussionSeconds(room: RoomState): number {
    return room.config.werewolfDiscussionSeconds ?? 180;
  }

  private voteSeconds(room: RoomState): number {
    return room.config.werewolfVoteSeconds ?? 60;
  }

  // --- lookups ---

  private playerBySocket(room: RoomState, socketId: string): UserState | undefined {
    return room.players.find((p) => p.socketId === socketId && !p.isViewer);
  }

  private playerById(room: RoomState, playerId: string): UserState | undefined {
    return room.players.find((p) => p.id === playerId);
  }

  /** Public players-map key (socket id) for a stable UserState.id. */
  private keyOf(room: RoomState, playerId: string | null | undefined): string | null {
    if (!playerId) return null;
    return this.playerById(room, playerId)?.socketId ?? null;
  }

  private roleOf(room: RoomState, socketId: string): WerewolfRole | undefined {
    return this.privateStateService.get<WerewolfRole>(room.code, socketId, 'wwRole');
  }

  private roleOfId(room: RoomState, playerId: string): WerewolfRole | undefined {
    const player = this.playerById(room, playerId);
    return player ? this.roleOf(room, player.socketId) : undefined;
  }

  private nameOf(room: RoomState, playerId: string): string {
    return this.playerById(room, playerId)?.name ?? '?';
  }

  private livingWolves(room: RoomState, state: WerewolfState): string[] {
    return Object.keys(state.players).filter(
      (key) => state.players[key].alive && this.roleOf(room, key) === WerewolfRole.WEREWOLF,
    );
  }

  private livingCount(state: WerewolfState): number {
    return Object.values(state.players).filter((view) => view.alive).length;
  }

  private nightRecord(room: RoomState): WerewolfNightRecord {
    return (
      this.privateStateService.get<WerewolfNightRecord>(room.code, ROOM_KEY, K_NIGHT) ?? {
        killVotes: {},
        bittenPlayerId: null,
        killSettled: false,
        checkTargetPlayerId: null,
        doctorHealPlayerId: null,
        witchHealPlayerId: null,
        witchPoisonPlayerId: null,
        hunterShotTargetPlayerId: null,
        hunterShotHunterId: null,
      }
    );
  }

  private potions(room: RoomState, playerId: string): WitchPotions {
    const all =
      this.privateStateService.get<Record<string, WitchPotions>>(room.code, ROOM_KEY, K_POTIONS) ??
      {};
    return all[playerId] ?? { healUsed: false, poisonUsed: false };
  }

  private consumePotion(room: RoomState, playerId: string, kind: 'heal' | 'poison'): void {
    const all =
      this.privateStateService.get<Record<string, WitchPotions>>(room.code, ROOM_KEY, K_POTIONS) ??
      {};
    const mine = all[playerId] ?? { healUsed: false, poisonUsed: false };
    if (kind === 'heal') mine.healUsed = true;
    else mine.poisonUsed = true;
    all[playerId] = mine;
    this.privateStateService.set(room.code, ROOM_KEY, K_POTIONS, all);
  }

  private biteWillLand(night: WerewolfNightRecord): boolean {
    return (
      night.bittenPlayerId !== null &&
      night.bittenPlayerId !== night.doctorHealPlayerId &&
      night.bittenPlayerId !== night.witchHealPlayerId
    );
  }

  // --- game start / reset ---

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.WEREWOLF) return null;
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;

    const seated = room.players.filter((p) => !p.isViewer && p.connected !== false);
    if (seated.length < WEREWOLF_MIN_PLAYERS || seated.length > WEREWOLF_MAX_PLAYERS) {
      return null;
    }

    const { roles } = getWerewolfRoleTable(seated.length, {
      witchEnabled: room.config.werewolfWitchEnabled !== false,
      hunterEnabled: room.config.werewolfHunterEnabled !== false,
    });
    const shuffled = this.shuffle(roles);

    const players: Record<string, WerewolfPlayerView> = {};
    const wolfNames: string[] = [];
    seated.forEach((player, index) => {
      const role = shuffled[index];
      players[player.socketId] = { alive: true };
      this.privateStateService.set(room.code, player.socketId, 'wwRole', role);
      if (role === WerewolfRole.WEREWOLF) wolfNames.push(player.name);
    });

    if (
      (room.config.werewolfWolfReveal ?? WerewolfWolfRevealMode.EYE_CONTACT) ===
      WerewolfWolfRevealMode.PRIVATE_ROSTER
    ) {
      for (const player of seated) {
        if (this.roleOf(room, player.socketId) === WerewolfRole.WEREWOLF) {
          this.privateStateService.set(room.code, player.socketId, 'wwWolves', [...wolfNames]);
        }
      }
    }

    room.werewolfState = {
      phase: WerewolfPhase.NIGHT,
      phaseEndsAt: null,
      night: 0,
      paused: false,
      players,
      nightSlots: getWerewolfNightSlots(shuffled),
      nightSlotIndex: -1,
      dawn: null,
      voteProgress: null,
      voteResult: null,
      hunterShot: null,
      winner: null,
    };
    room.status = RoomStatus.PLAYING;
    this.beginNight(room);
    return room;
  }

  reset(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.WEREWOLF) return null;
    if (room.roomHostId !== requesterId) return null;
    // Single game per room: everything in private state belongs to Werewolf.
    this.privateStateService.clearRoom(room.code);
    room.werewolfState = undefined;
    room.status = RoomStatus.LOBBY;
    return room;
  }

  // --- night sequence ---

  private beginNight(room: RoomState): void {
    const state = room.werewolfState!;
    state.phase = WerewolfPhase.NIGHT;
    state.night += 1;
    state.dawn = null;
    state.voteProgress = null;
    state.voteResult = null;
    state.hunterShot = null;
    state.paused = false;

    // The slot schedule was fixed at game start; dead slots burn silently.
    this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, {
      killVotes: {},
      bittenPlayerId: null,
      killSettled: false,
      checkTargetPlayerId: null,
      doctorHealPlayerId: null,
      witchHealPlayerId: null,
      witchPoisonPlayerId: null,
      hunterShotTargetPlayerId: null,
      hunterShotHunterId: null,
    } satisfies WerewolfNightRecord);
    this.privateStateService.delete(room.code, ROOM_KEY, K_DAY_VOTES);
    this.privateStateService.delete(room.code, ROOM_KEY, K_HUNTER_DAY_SHOT);
    this.privateStateService.delete(room.code, ROOM_KEY, K_LYNCHED_HUNTER);

    this.beginSlot(room, 0);
  }

  private livingTargetNames(room: RoomState, state: WerewolfState) {
    return Object.keys(state.players)
      .filter((key) => state.players[key].alive)
      .map((key) => ({ id: key, name: this.playerBySocket(room, key)?.name ?? '?' }));
  }

  private beginSlot(room: RoomState, slotIndex: number): void {
    const state = room.werewolfState!;
    state.nightSlotIndex = slotIndex;
    const slot = state.nightSlots[slotIndex];
    state.phaseEndsAt = Date.now() + this.nightSeconds(room) * 1000;

    // A fresh slot means fresh prompts: clear everyone first, then entitle.
    for (const key of Object.keys(state.players)) {
      this.privateStateService.delete(room.code, key, 'wwNight');
    }

    const livingNames = this.livingTargetNames(room, state);

    switch (slot) {
      case 'WOLVES': {
        const wolves = this.livingWolves(room, state);
        if (wolves.length === 0) break;
        const coordination =
          room.config.werewolfWolfCoordination ?? WerewolfWolfCoordinationMode.SECRET_BALLOT;
        for (const key of wolves) {
          this.privateStateService.set(room.code, key, 'wwNight', {
            kind: WerewolfNightActionKind.KILL,
            targets: livingNames.filter((t) => t.id !== key),
            showTally: coordination === WerewolfWolfCoordinationMode.LIVE_TALLY,
          });
        }
        if (coordination === WerewolfWolfCoordinationMode.LIVE_TALLY) {
          for (const key of wolves) {
            this.privateStateService.set(room.code, key, 'wwTally', {});
          }
        }
        break;
      }
      case 'SEER': {
        const seer = livingNames.find((t) => this.roleOf(room, t.id) === WerewolfRole.SEER);
        if (!seer) break;
        this.privateStateService.set(room.code, seer.id, 'wwNight', {
          kind: WerewolfNightActionKind.CHECK,
          targets: livingNames.filter((t) => t.id !== seer.id),
        });
        break;
      }
      case 'DOCTOR': {
        const doctor = livingNames.find((t) => this.roleOf(room, t.id) === WerewolfRole.DOCTOR);
        if (!doctor) break;
        const lastHealed = this.keyOf(
          room,
          this.privateStateService.get<string>(room.code, ROOM_KEY, K_DOCTOR_LAST),
        );
        this.privateStateService.set(room.code, doctor.id, 'wwNight', {
          kind: WerewolfNightActionKind.HEAL,
          targets: livingNames.filter((t) => t.id !== lastHealed),
        });
        break;
      }
      case 'WITCH': {
        const witch = livingNames.find((t) => this.roleOf(room, t.id) === WerewolfRole.WITCH);
        if (!witch) break;
        const night = this.nightRecord(room);
        const potions = this.potions(room, this.playerBySocket(room, witch.id)!.id);
        if (potions.healUsed && potions.poisonUsed) break;
        const victimKey = night.killSettled ? this.keyOf(room, night.bittenPlayerId) : null;
        this.privateStateService.set(room.code, witch.id, 'wwNight', {
          kind: WerewolfNightActionKind.HEAL,
          targets: livingNames.filter((t) => t.id !== witch.id),
          victimId: victimKey,
          victimName: victimKey ? (this.playerBySocket(room, victimKey)?.name ?? null) : null,
          healRemaining: !potions.healUsed,
          poisonRemaining: !potions.poisonUsed,
        });
        break;
      }
      case 'HUNTER_SHOT': {
        const night = this.nightRecord(room);
        // The shot is pending exactly when tonight's bite will land on the Hunter.
        const biteOnHunter =
          this.biteWillLand(night) &&
          this.roleOfId(room, night.bittenPlayerId!) === WerewolfRole.HUNTER;
        night.hunterShotHunterId = biteOnHunter ? night.bittenPlayerId : null;
        this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
        if (!night.hunterShotHunterId) break;
        const hunterKey = this.keyOf(room, night.hunterShotHunterId);
        if (!hunterKey) break;
        this.privateStateService.set(room.code, hunterKey, 'wwNight', {
          kind: WerewolfNightActionKind.SHOT,
          targets: livingNames.filter((t) => t.id !== hunterKey),
        });
        break;
      }
    }
  }

  /** Deadline fire: settle the current slot, advance or resolve the night. */
  handlePhaseTimeout(room: RoomState, expectedDeadline: number): RoomState | null {
    const state = room.werewolfState;
    if (!state || room.status !== RoomStatus.PLAYING) return null;
    if (state.paused || state.phaseEndsAt !== expectedDeadline) return null;

    if (state.phase === WerewolfPhase.NIGHT) {
      const night = this.nightRecord(room);
      this.settleSlot(room, state, night);
      const next = state.nightSlotIndex + 1;
      if (next < state.nightSlots.length) {
        this.beginSlot(room, next);
      } else {
        this.resolveNight(room);
      }
      return room;
    }

    if (state.phase === WerewolfPhase.DAY_DISCUSSION) {
      this.beginVote(room);
      return room;
    }

    if (state.phase === WerewolfPhase.DAY_VOTE) {
      this.resolveVote(room);
      return room;
    }

    if (state.phase === WerewolfPhase.DAY_RESULT) {
      if (this.privateStateService.get<string>(room.code, ROOM_KEY, K_AFTER_RESULT) === 'SHOT') {
        this.beginDayHunterShot(room);
      } else {
        this.beginNight(room);
      }
      return room;
    }

    if (state.phase === WerewolfPhase.DAY_HUNTER_SHOT) {
      this.resolveHunterShot(room);
      return room;
    }

    return null;
  }

  private settleSlot(room: RoomState, state: WerewolfState, night: WerewolfNightRecord): void {
    const slot = state.nightSlots[state.nightSlotIndex];
    switch (slot) {
      case 'WOLVES': {
        if (night.killSettled) break;
        const wolves = this.livingWolves(room, state);
        const wolfIds = new Set(
          wolves.map((key) => this.playerBySocket(room, key)?.id).filter(Boolean) as string[],
        );
        const cast = Object.entries(night.killVotes).filter(([voterId]) => wolfIds.has(voterId));
        const targets = cast.map(([, targetId]) => targetId);
        const coordination =
          room.config.werewolfWolfCoordination ?? WerewolfWolfCoordinationMode.SECRET_BALLOT;
        let bitten: string | null = null;
        if (coordination === WerewolfWolfCoordinationMode.SILENT_CONSENSUS) {
          const unanimous =
            wolves.length > 0 &&
            cast.length === wolves.length &&
            targets.every((t) => t === targets[0]);
          bitten = unanimous ? targets[0] : null;
        } else {
          const counts = new Map<string, number>();
          for (const target of targets) counts.set(target, (counts.get(target) ?? 0) + 1);
          const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0 && (sorted.length === 1 || sorted[0][1] > sorted[1][1])) {
            bitten = sorted[0][0];
          }
        }
        night.bittenPlayerId = bitten;
        night.killSettled = true;
        this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
        break;
      }
      case 'SEER': {
        const seerKey = Object.keys(state.players).find(
          (key) => state.players[key].alive && this.roleOf(room, key) === WerewolfRole.SEER,
        );
        if (seerKey && night.checkTargetPlayerId) {
          const targetKey = this.keyOf(room, night.checkTargetPlayerId);
          if (targetKey) {
            const visions =
              this.privateStateService.get<WerewolfVision[]>(room.code, seerKey, 'wwVisions') ?? [];
            visions.push({
              night: state.night,
              targetName: this.nameOf(room, night.checkTargetPlayerId),
              isWolf: this.roleOfId(room, night.checkTargetPlayerId) === WerewolfRole.WEREWOLF,
            });
            this.privateStateService.set(room.code, seerKey, 'wwVisions', visions);
          }
        }
        break;
      }
      case 'DOCTOR': {
        if (night.doctorHealPlayerId) {
          this.privateStateService.set(
            room.code,
            ROOM_KEY,
            K_DOCTOR_LAST,
            night.doctorHealPlayerId,
          );
        }
        break;
      }
      case 'WITCH':
      case 'HUNTER_SHOT':
        // Potions were consumed at submission; the shot target is already recorded.
        break;
    }
  }

  private resolveNight(room: RoomState): void {
    const state = room.werewolfState!;
    const night = this.nightRecord(room);

    const deaths: { playerId: string; cause?: 'SHOT' }[] = [];
    if (this.biteWillLand(night)) deaths.push({ playerId: night.bittenPlayerId! });
    if (night.witchPoisonPlayerId) deaths.push({ playerId: night.witchPoisonPlayerId });
    if (night.hunterShotTargetPlayerId) {
      deaths.push({ playerId: night.hunterShotTargetPlayerId, cause: 'SHOT' });
    }

    this.markDeaths(room, state, deaths);

    state.dawn = {
      night: state.night,
      deaths: this.toAnnouncements(room, deaths),
    };

    const winner = this.checkWinner(room, state);
    if (winner) {
      this.finishGame(room, state, winner);
      return;
    }

    state.phase = WerewolfPhase.DAY_DISCUSSION;
    state.phaseEndsAt = Date.now() + this.discussionSeconds(room) * 1000;
  }

  // --- day sequence ---

  private beginVote(room: RoomState): void {
    const state = room.werewolfState!;
    state.phase = WerewolfPhase.DAY_VOTE;
    state.phaseEndsAt = Date.now() + this.voteSeconds(room) * 1000;
    this.privateStateService.set(room.code, ROOM_KEY, K_DAY_VOTES, {});
    state.voteProgress = { cast: 0, total: this.livingCount(state) };
    for (const key of Object.keys(state.players)) {
      this.privateStateService.set(room.code, key, 'wwDayVote', null);
    }
  }

  private resolveVote(room: RoomState): void {
    const state = room.werewolfState!;
    const votes =
      this.privateStateService.get<Record<string, string>>(room.code, ROOM_KEY, K_DAY_VOTES) ?? {};

    const counts = new Map<string, number>();
    for (const targetId of Object.values(votes)) {
      if (targetId === 'ABSTAIN') continue;
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const lynchedPlayerId =
      sorted.length > 0 && (sorted.length === 1 || sorted[0][1] > sorted[1][1])
        ? sorted[0][0]
        : null;

    const publicVotes: Record<string, string> = {};
    for (const [voterId, targetId] of Object.entries(votes)) {
      const voterKey = this.keyOf(room, voterId);
      const targetKey = targetId === 'ABSTAIN' ? 'ABSTAIN' : this.keyOf(room, targetId);
      if (voterKey && targetKey) publicVotes[voterKey] = targetKey;
    }
    state.voteResult = {
      lynchedPlayerId: this.keyOf(room, lynchedPlayerId),
      votes: publicVotes,
    };
    state.voteProgress = null;

    if (lynchedPlayerId) {
      this.markDeaths(room, state, [{ playerId: lynchedPlayerId }]);
    }

    const winner = this.checkWinner(room, state);
    if (winner) {
      this.finishGame(room, state, winner);
      return;
    }

    const lynchedWasHunter =
      lynchedPlayerId !== null && this.roleOfId(room, lynchedPlayerId) === WerewolfRole.HUNTER;
    this.privateStateService.set(
      room.code,
      ROOM_KEY,
      K_AFTER_RESULT,
      lynchedWasHunter ? 'SHOT' : 'NIGHT',
    );
    if (lynchedWasHunter) {
      this.privateStateService.set(room.code, ROOM_KEY, K_LYNCHED_HUNTER, lynchedPlayerId);
    }
    state.phase = WerewolfPhase.DAY_RESULT;
    state.phaseEndsAt = Date.now() + RESULT_DWELL_MS;
  }

  private beginDayHunterShot(room: RoomState): void {
    const state = room.werewolfState!;
    const lynchedPlayerId = this.privateStateService.get<string>(
      room.code,
      ROOM_KEY,
      K_LYNCHED_HUNTER,
    );
    const hunterKey = this.keyOf(room, lynchedPlayerId);
    if (!lynchedPlayerId || !hunterKey) {
      this.beginNight(room);
      return;
    }
    state.phase = WerewolfPhase.DAY_HUNTER_SHOT;
    state.phaseEndsAt = Date.now() + this.nightSeconds(room) * 1000;
    state.hunterShot = {
      hunterId: hunterKey,
      hunterName: this.nameOf(room, lynchedPlayerId),
    };
    this.privateStateService.set(room.code, hunterKey, 'wwNight', {
      kind: WerewolfNightActionKind.SHOT,
      targets: this.livingTargetNames(room, state).filter((t) => t.id !== hunterKey),
    });
  }

  private resolveHunterShot(room: RoomState): void {
    const state = room.werewolfState!;
    const targetPlayerId = this.privateStateService.get<string>(
      room.code,
      ROOM_KEY,
      K_HUNTER_DAY_SHOT,
    );
    let deaths: { playerId: string; cause?: 'SHOT' }[] = [];
    if (targetPlayerId) {
      this.markDeaths(room, state, [{ playerId: targetPlayerId, cause: 'SHOT' }]);
      deaths = [{ playerId: targetPlayerId, cause: 'SHOT' }];
    }
    // Announce the shot through the dawn channel so the table hears it.
    state.dawn = {
      night: state.night,
      deaths: this.toAnnouncements(room, deaths),
    };
    const winner = this.checkWinner(room, state);
    if (winner) {
      this.finishGame(room, state, winner);
      return;
    }
    this.privateStateService.set(room.code, ROOM_KEY, K_AFTER_RESULT, 'NIGHT');
    state.phase = WerewolfPhase.DAY_RESULT;
    state.phaseEndsAt = Date.now() + RESULT_DWELL_MS;
  }

  // --- win conditions ---

  private checkWinner(room: RoomState, state: WerewolfState): WerewolfTeam | null {
    const annotated = room.players
      .filter((p) => !p.isViewer && state.players[p.socketId])
      .map((p) => ({
        alive: state.players[p.socketId].alive,
        isWolf: this.roleOf(room, p.socketId) === WerewolfRole.WEREWOLF,
      }));
    return evaluateWerewolfWinner(annotated);
  }

  private finishGame(room: RoomState, state: WerewolfState, winner: WerewolfTeam): void {
    state.phase = WerewolfPhase.GAME_OVER;
    state.winner = winner;
    state.phaseEndsAt = null;
    state.paused = false;
    state.nightSlotIndex = -1;
    for (const player of room.players) {
      if (player.isViewer) continue;
      const view = state.players[player.socketId];
      if (!view) continue;
      view.finalRole = this.roleOf(room, player.socketId);
      const isWinner =
        winner === 'WOLVES'
          ? view.finalRole === WerewolfRole.WEREWOLF
          : view.finalRole !== WerewolfRole.WEREWOLF;
      if (isWinner) player.score += 1;
    }
    room.status = RoomStatus.RESULT;
  }

  // --- death bookkeeping ---

  private markDeaths(
    room: RoomState,
    state: WerewolfState,
    deaths: { playerId: string; cause?: 'SHOT' }[],
  ): void {
    for (const death of deaths) {
      const key = this.keyOf(room, death.playerId);
      const role = this.roleOfId(room, death.playerId);
      if (!key) continue;
      const view = state.players[key];
      if (!view || !view.alive) continue;
      view.alive = false;
      view.revealedRole = role;
    }
  }

  private toAnnouncements(room: RoomState, deaths: { playerId: string; cause?: 'SHOT' }[]) {
    return deaths.flatMap((death) => {
      const key = this.keyOf(room, death.playerId);
      const role = this.roleOfId(room, death.playerId);
      if (!key || !role) return [];
      return [
        {
          playerId: key,
          name: this.nameOf(room, death.playerId),
          role,
          cause: death.cause,
        },
      ];
    });
  }

  // --- client actions ---

  handleNightAction(
    room: RoomState,
    socketId: string,
    action: WerewolfNightActionKind,
    targetId: string,
  ): RoomState | null {
    const state = room.werewolfState;
    if (!state || room.status !== RoomStatus.PLAYING || state.paused) return null;

    const actor = this.playerBySocket(room, socketId);
    if (!actor) return null;
    const view = state.players[socketId];
    const role = this.roleOf(room, socketId);
    if (!view || !role) return null;

    const night = this.nightRecord(room);
    const targetKey = state.players[targetId] ? targetId : null;
    const targetPlayer = targetKey ? this.playerBySocket(room, targetKey) : undefined;
    if (!targetPlayer) return null;

    if (action === WerewolfNightActionKind.SHOT) {
      return this.handleShot(room, state, night, socketId, actor.id, targetKey!, targetPlayer);
    }

    if (state.phase !== WerewolfPhase.NIGHT) return null;
    const expectedSlot = this.slotForAction(action, role);
    if (!expectedSlot || state.nightSlots[state.nightSlotIndex] !== expectedSlot) return null;

    switch (action) {
      case WerewolfNightActionKind.KILL: {
        if (role !== WerewolfRole.WEREWOLF || !view.alive) return null;
        if (!state.players[targetKey!].alive || targetKey === socketId) return null;
        night.killVotes[actor.id] = targetPlayer.id;
        this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
        this.refreshWolfTally(room, state);
        const coordination =
          room.config.werewolfWolfCoordination ?? WerewolfWolfCoordinationMode.SECRET_BALLOT;
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: action,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          showTally: coordination === WerewolfWolfCoordinationMode.LIVE_TALLY,
          submittedTargetName: targetPlayer.name,
        });
        return room;
      }
      case WerewolfNightActionKind.CHECK: {
        if (role !== WerewolfRole.SEER || !view.alive) return null;
        if (!state.players[targetKey!].alive || targetKey === socketId) return null;
        night.checkTargetPlayerId = targetPlayer.id;
        this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: action,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          submittedTargetName: targetPlayer.name,
        });
        return room;
      }
      case WerewolfNightActionKind.HEAL: {
        if (role === WerewolfRole.DOCTOR) {
          if (!view.alive) return null;
          if (!state.players[targetKey!].alive) return null;
          const lastHealed = this.keyOf(
            room,
            this.privateStateService.get<string>(room.code, ROOM_KEY, K_DOCTOR_LAST),
          );
          if (targetKey === lastHealed) return null;
          night.doctorHealPlayerId = targetPlayer.id;
          this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
          this.privateStateService.set(room.code, socketId, 'wwNight', {
            kind: action,
            targets: [],
            submittedTargetName: targetPlayer.name,
          });
          return room;
        }
        if (role === WerewolfRole.WITCH) {
          if (!view.alive) return null;
          const potions = this.potions(room, actor.id);
          if (potions.healUsed || potions.poisonUsed) return null;
          if (!night.killSettled || !night.bittenPlayerId) return null;
          const victimKey = this.keyOf(room, night.bittenPlayerId);
          if (targetKey !== victimKey) return null;
          night.witchHealPlayerId = night.bittenPlayerId;
          this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
          this.consumePotion(room, actor.id, 'heal');
          this.privateStateService.set(room.code, socketId, 'wwNight', {
            kind: action,
            targets: [],
            submittedTargetName: this.nameOf(room, night.bittenPlayerId),
          });
          return room;
        }
        return null;
      }
      case WerewolfNightActionKind.POISON: {
        if (role !== WerewolfRole.WITCH || !view.alive) return null;
        const potions = this.potions(room, actor.id);
        if (potions.healUsed || potions.poisonUsed) return null;
        if (!state.players[targetKey!].alive || targetKey === socketId) return null;
        night.witchPoisonPlayerId = targetPlayer.id;
        this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
        this.consumePotion(room, actor.id, 'poison');
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: action,
          targets: [],
          submittedTargetName: targetPlayer.name,
        });
        return room;
      }
      default:
        return null;
    }
  }

  /** Hunter shot: valid in the night HUNTER_SHOT slot or the public day phase. */
  private handleShot(
    room: RoomState,
    state: WerewolfState,
    night: WerewolfNightRecord,
    socketId: string,
    actorPlayerId: string,
    targetKey: string,
    targetPlayer: UserState,
  ): RoomState | null {
    const role = this.roleOf(room, socketId);
    const view = state.players[socketId];
    if (role !== WerewolfRole.HUNTER) return null;
    if (!view) return null;
    if (state.phase === WerewolfPhase.NIGHT) {
      if (state.nightSlots[state.nightSlotIndex] !== 'HUNTER_SHOT') return null;
      // The bitten hunter is still marked alive until dawn; entitlement comes
      // from being tonight's pending shot, not from view liveness.
      if (night.hunterShotHunterId !== actorPlayerId) return null;
      if (!state.players[targetKey].alive || targetKey === socketId) return null;
      night.hunterShotTargetPlayerId = targetPlayer.id;
      this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
    } else if (state.phase === WerewolfPhase.DAY_HUNTER_SHOT) {
      if (!state.players[targetKey].alive || targetKey === socketId) return null;
      this.privateStateService.set(room.code, ROOM_KEY, K_HUNTER_DAY_SHOT, targetPlayer.id);
    } else {
      return null;
    }
    this.privateStateService.set(room.code, socketId, 'wwNight', {
      kind: WerewolfNightActionKind.SHOT,
      targets: [],
      submittedTargetName: targetPlayer.name,
    });
    return room;
  }

  private slotForAction(
    action: WerewolfNightActionKind,
    role: WerewolfRole,
  ): WerewolfNightSlot | null {
    switch (action) {
      case WerewolfNightActionKind.KILL:
        return role === WerewolfRole.WEREWOLF ? 'WOLVES' : null;
      case WerewolfNightActionKind.CHECK:
        return role === WerewolfRole.SEER ? 'SEER' : null;
      case WerewolfNightActionKind.HEAL:
        // Both the Doctor and the Witch heal, each in their own wake.
        if (role === WerewolfRole.DOCTOR) return 'DOCTOR';
        if (role === WerewolfRole.WITCH) return 'WITCH';
        return null;
      case WerewolfNightActionKind.POISON:
        return role === WerewolfRole.WITCH ? 'WITCH' : null;
      default:
        return null;
    }
  }

  private refreshWolfTally(room: RoomState, state: WerewolfState): void {
    const coordination =
      room.config.werewolfWolfCoordination ?? WerewolfWolfCoordinationMode.SECRET_BALLOT;
    if (coordination !== WerewolfWolfCoordinationMode.LIVE_TALLY) return;
    const night = this.nightRecord(room);
    const tally: Record<string, string> = {};
    for (const [voterId, targetId] of Object.entries(night.killVotes)) {
      tally[this.nameOf(room, voterId)] = this.nameOf(room, targetId);
    }
    for (const key of this.livingWolves(room, state)) {
      this.privateStateService.set(room.code, key, 'wwTally', tally);
    }
  }

  handleDayVote(room: RoomState, socketId: string, targetId: string): RoomState | null {
    const state = room.werewolfState;
    if (!state || room.status !== RoomStatus.PLAYING) return null;
    if (state.phase !== WerewolfPhase.DAY_VOTE || state.paused) return null;
    const actor = this.playerBySocket(room, socketId);
    const view = state.players[socketId];
    if (!actor || !view || !view.alive) return null;

    if (targetId !== 'ABSTAIN') {
      if (!state.players[targetId] || !state.players[targetId].alive) return null;
      if (targetId === socketId) return null;
    }
    const votes =
      this.privateStateService.get<Record<string, string>>(room.code, ROOM_KEY, K_DAY_VOTES) ?? {};
    const hadVoted = actor.id in votes;
    // Store targets as stable UserState.id (resolveVote works in player ids).
    votes[actor.id] = targetId === 'ABSTAIN' ? 'ABSTAIN' : this.playerBySocket(room, targetId)!.id;
    this.privateStateService.set(room.code, ROOM_KEY, K_DAY_VOTES, votes);
    if (!hadVoted) {
      state.voteProgress = {
        cast: (state.voteProgress?.cast ?? 0) + 1,
        total: state.voteProgress?.total ?? this.livingCount(state),
      };
    }
    this.privateStateService.set(
      room.code,
      socketId,
      'wwDayVote',
      targetId === 'ABSTAIN' ? 'ABSTAIN' : (this.playerBySocket(room, targetId)?.name ?? null),
    );
    return room;
  }

  /** Host-only: cut the day discussion short and open the vote immediately. */
  handleSkipDiscussion(room: RoomState, socketId: string): RoomState | null {
    const state = room.werewolfState;
    if (!state || room.status !== RoomStatus.PLAYING) return null;
    if (state.phase !== WerewolfPhase.DAY_DISCUSSION || state.paused) return null;
    if (socketId !== room.roomHostId) return null;

    this.beginVote(room);
    return room;
  }

  // --- disconnect / pause / reconnect ---

  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    const state = room.werewolfState;
    if (!state || state.phase === WerewolfPhase.GAME_OVER) return;
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) {
      // Temporary drop: the seat is kept, so freeze the phase for everyone.
      if (!player.isViewer && state.players[socketId]?.alive) {
        this.pausePhase(room, player.id);
      }
      return;
    }
    // Seat removed (grace expired or explicit leave): eliminate without reveal.
    this.eliminateRemoved(room, socketId);
  }

  handleReconnect(room: RoomState, playerId: string): void {
    const state = room.werewolfState;
    if (!state || state.phase === WerewolfPhase.GAME_OVER) return;
    this.resumeIfAllBack(room);
    const player = this.playerById(room, playerId);
    if (!player) return;
    // Prompts embed public socket keys, which just changed — rebuild them.
    this.refreshPrivateViews(room, player.socketId);
  }

  private pausePhase(room: RoomState, playerId: string): void {
    const state = room.werewolfState!;
    const now = Date.now();
    let pause = this.privateStateService.get<WerewolfPauseRecord>(room.code, ROOM_KEY, K_PAUSE);
    if (!pause) {
      pause = {
        remainingMs: Math.max(0, (state.phaseEndsAt ?? now) - now),
        graceEndsAtById: {},
      };
      state.paused = true;
      state.phaseEndsAt = null;
    }
    pause.graceEndsAtById[playerId] = now + WW_RECONNECT_GRACE_MS;
    this.privateStateService.set(room.code, ROOM_KEY, K_PAUSE, pause);
  }

  private resumeIfAllBack(room: RoomState): void {
    const state = room.werewolfState;
    if (!state) return;
    const pause = this.privateStateService.get<WerewolfPauseRecord>(room.code, ROOM_KEY, K_PAUSE);
    if (!pause) return;
    const stillAway = room.players.some(
      (p) => p.connected === false && !p.isViewer && state.players[p.socketId]?.alive === true,
    );
    if (stillAway) return;
    state.paused = false;
    state.phaseEndsAt = Date.now() + pause.remainingMs;
    this.privateStateService.delete(room.code, ROOM_KEY, K_PAUSE);
  }

  private eliminateRemoved(room: RoomState, socketId: string): void {
    const state = room.werewolfState;
    if (!state) return;
    const view = state.players[socketId];
    if (view && view.alive) {
      view.alive = false;
      // Deliberately no revealedRole: a disconnected player's role stays secret.
      const winner = this.checkWinner(room, state);
      const livingCount = this.livingCount(state);
      if (winner === 'WOLVES' || winner === 'VILLAGE' || livingCount < 3) {
        // The match can no longer finish fairly — back to the lobby, no result.
        this.privateStateService.clearRoom(room.code);
        room.werewolfState = undefined;
        room.status = RoomStatus.LOBBY;
        return;
      }
    }
    this.resumeIfAllBack(room);
    if (room.werewolfState) this.refreshAllNightPrompts(room);
  }

  // --- reconnect-time private view rebuild ---

  /** Rebuild the reconnecting player's private payloads with fresh socket keys. */
  private refreshPrivateViews(room: RoomState, socketId: string): void {
    const state = room.werewolfState;
    if (!state) return;
    if (state.phase === WerewolfPhase.NIGHT) {
      this.rebuildNightPrompt(room, socketId);
    }
    if (state.phase === WerewolfPhase.DAY_HUNTER_SHOT) {
      const shotHunterId = this.privateStateService.get<string>(
        room.code,
        ROOM_KEY,
        K_LYNCHED_HUNTER,
      );
      if (shotHunterId && this.keyOf(room, shotHunterId) === socketId) {
        const shotTargetId = this.privateStateService.get<string>(
          room.code,
          ROOM_KEY,
          K_HUNTER_DAY_SHOT,
        );
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: WerewolfNightActionKind.SHOT,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          submittedTargetName: shotTargetId ? this.nameOf(room, shotTargetId) : null,
        });
      }
    }
  }

  private refreshAllNightPrompts(room: RoomState): void {
    const state = room.werewolfState;
    if (!state || state.phase !== WerewolfPhase.NIGHT) return;
    for (const player of room.players) {
      if (player.isViewer) continue;
      this.rebuildNightPrompt(room, player.socketId);
    }
  }

  /** Regenerate the current slot's prompt (with fresh ids) for one player. */
  private rebuildNightPrompt(room: RoomState, socketId: string): void {
    const state = room.werewolfState!;
    const view = state.players[socketId];
    const role = this.roleOf(room, socketId);
    if (!view || !role) return;
    const night = this.nightRecord(room);
    const slot = state.nightSlots[state.nightSlotIndex];
    const actorPlayerId = this.playerBySocket(room, socketId)?.id;

    switch (slot) {
      case 'WOLVES': {
        if (role !== WerewolfRole.WEREWOLF || !view.alive) return;
        const votedFor = actorPlayerId ? night.killVotes[actorPlayerId] : undefined;
        const coordination =
          room.config.werewolfWolfCoordination ?? WerewolfWolfCoordinationMode.SECRET_BALLOT;
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: WerewolfNightActionKind.KILL,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          showTally: coordination === WerewolfWolfCoordinationMode.LIVE_TALLY,
          submittedTargetName: votedFor ? this.nameOf(room, votedFor) : null,
        });
        return;
      }
      case 'SEER': {
        if (role !== WerewolfRole.SEER || !view.alive) return;
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: WerewolfNightActionKind.CHECK,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          submittedTargetName: night.checkTargetPlayerId
            ? this.nameOf(room, night.checkTargetPlayerId)
            : null,
        });
        return;
      }
      case 'DOCTOR': {
        if (role !== WerewolfRole.DOCTOR || !view.alive) return;
        const lastHealed = this.keyOf(
          room,
          this.privateStateService.get<string>(room.code, ROOM_KEY, K_DOCTOR_LAST),
        );
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: WerewolfNightActionKind.HEAL,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== lastHealed),
          submittedTargetName: night.doctorHealPlayerId
            ? this.nameOf(room, night.doctorHealPlayerId)
            : null,
        });
        return;
      }
      case 'WITCH': {
        if (role !== WerewolfRole.WITCH || !view.alive) return;
        const potions = this.potions(room, actorPlayerId!);
        if (potions.healUsed || potions.poisonUsed) {
          this.privateStateService.delete(room.code, socketId, 'wwNight');
          return;
        }
        const victimKey = night.killSettled ? this.keyOf(room, night.bittenPlayerId) : null;
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: WerewolfNightActionKind.HEAL,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          victimId: victimKey,
          victimName: victimKey ? (this.playerBySocket(room, victimKey)?.name ?? null) : null,
          healRemaining: !potions.healUsed,
          poisonRemaining: !potions.poisonUsed,
        });
        return;
      }
      case 'HUNTER_SHOT': {
        if (role !== WerewolfRole.HUNTER) return;
        // The bitten hunter is still "alive" in the view until dawn.
        if (night.hunterShotHunterId !== actorPlayerId) return;
        this.privateStateService.set(room.code, socketId, 'wwNight', {
          kind: WerewolfNightActionKind.SHOT,
          targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
          submittedTargetName: night.hunterShotTargetPlayerId
            ? this.nameOf(room, night.hunterShotTargetPlayerId)
            : null,
        });
        return;
      }
    }
  }

  // --- reconnect remap ---

  remapSocketId(state: WerewolfState, oldSocketId: string, newSocketId: string): void {
    if (state.players[oldSocketId]) {
      state.players[newSocketId] = state.players[oldSocketId];
      delete state.players[oldSocketId];
    }
    if (state.dawn) {
      for (const death of state.dawn.deaths) {
        if (death.playerId === oldSocketId) death.playerId = newSocketId;
      }
    }
    if (state.voteResult) {
      if (state.voteResult.lynchedPlayerId === oldSocketId) {
        state.voteResult.lynchedPlayerId = newSocketId;
      }
      const remappedVotes: Record<string, string> = {};
      for (const [voterKey, targetKey] of Object.entries(state.voteResult.votes)) {
        remappedVotes[voterKey === oldSocketId ? newSocketId : voterKey] =
          targetKey === oldSocketId ? newSocketId : targetKey;
      }
      state.voteResult.votes = remappedVotes;
    }
    if (state.hunterShot?.hunterId === oldSocketId) state.hunterShot.hunterId = newSocketId;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
