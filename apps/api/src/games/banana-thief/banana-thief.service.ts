import { Injectable, Logger } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  GameType,
  BananaThiefPhase,
  BananaThiefRole,
  BananaThiefSpecial,
  BananaThiefState,
  BananaThiefWinner,
  BananaStatus,
  BANANA_THIEF_CLOCK_HOURS,
  BANANA_THIEF_MIN_PLAYERS,
  getBananaThiefRequiredPlayerCount,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';

const ROOM_KEY = '__room__';
const CT_ROLE = 'ctRole';
const CT_DIE = 'ctDie';
const CT_REROLL_USED = 'ctRerollUsed';
const CT_BANANA_STATUS = 'ctBananaStatus';
const CT_AWAKE_PEERS = 'ctAwakePeers';
const CT_PEEK_OFFER = 'ctPeekOffer';
const CT_PEEK_RESULT = 'ctPeekResult';
const CT_STOLE = 'ctStole';
const CT_WITNESSES = 'ctWitnesses';
const CT_SEES_THIEF = 'ctSeesThief';
const CT_SPECIAL = 'ctSpecial';
const CT_TWIN_PARTNER = 'ctTwinPartner';
const CT_CHOSEN_FOLLOWERS = 'ctChosenFollowers';

/** DLC needs a bigger table so specials don't crowd out the plain mice. */
const BANANA_THIEF_DLC_MIN_PLAYERS = BANANA_THIEF_MIN_PLAYERS + 1;
// Room-level secrets (socket ids stored as VALUES need explicit remapping).
const CT_ROOM_THIEF = 'ctRoomThief';
const CT_ROOM_FOLLOWERS = 'ctRoomFollowers';
const CT_ROOM_VOTES = 'ctRoomVotes';
const CT_ROOM_PENDING_PEEK = 'ctRoomPendingPeek';
const CT_ROOM_STOLEN = 'ctRoomStolen';

const SCORE_CORRECT_VOTE = 2;
const SCORE_THIEF_ESCAPE = 3;
const SCORE_FOLLOWER_ESCAPE = 2;

@Injectable()
export class BananaThiefService {
  private readonly logger = new Logger(BananaThiefService.name);

  constructor(private readonly privateState: PrivateStateService) {}

  /** Players who participate in the round (connected, non-viewers). */
  private participatingIds(room: RoomState): string[] {
    return room.players.filter((p) => p.connected !== false && !p.isViewer).map((p) => p.socketId);
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private randomDie(): number {
    return 1 + Math.floor(Math.random() * BANANA_THIEF_CLOCK_HOURS);
  }

  // --- Room-level secrets -------------------------------------------------

  private getThiefId(room: RoomState): string | null {
    return this.privateState.get<string>(room.code, ROOM_KEY, CT_ROOM_THIEF) ?? null;
  }

  private setThiefId(room: RoomState, socketId: string): void {
    this.privateState.set(room.code, ROOM_KEY, CT_ROOM_THIEF, socketId);
  }

  private getFollowerIds(room: RoomState): string[] {
    return this.privateState.get<string[]>(room.code, ROOM_KEY, CT_ROOM_FOLLOWERS) ?? [];
  }

  private setFollowerIds(room: RoomState, ids: string[]): void {
    this.privateState.set(room.code, ROOM_KEY, CT_ROOM_FOLLOWERS, ids);
  }

  private getVotes(room: RoomState): Record<string, string> {
    return this.privateState.get<Record<string, string>>(room.code, ROOM_KEY, CT_ROOM_VOTES) ?? {};
  }

  private setVotes(room: RoomState, votes: Record<string, string>): void {
    this.privateState.set(room.code, ROOM_KEY, CT_ROOM_VOTES, votes);
  }

  private getPendingPeeks(room: RoomState): string[] {
    return this.privateState.get<string[]>(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK) ?? [];
  }

  private addPendingPeek(room: RoomState, socketId: string): void {
    const pending = this.getPendingPeeks(room);
    if (!pending.includes(socketId)) pending.push(socketId);
    this.privateState.set(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK, pending);
  }

  private removePendingPeek(room: RoomState, socketId: string): void {
    const pending = this.getPendingPeeks(room).filter((id) => id !== socketId);
    if (pending.length === 0) {
      this.privateState.delete(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK);
    } else {
      this.privateState.set(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK, pending);
    }
  }

  private clearPendingPeeks(room: RoomState): void {
    for (const id of this.getPendingPeeks(room)) {
      this.privateState.delete(room.code, id, CT_PEEK_OFFER);
    }
    this.privateState.delete(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK);
  }

  private isStolen(room: RoomState): boolean {
    return this.privateState.get<boolean>(room.code, ROOM_KEY, CT_ROOM_STOLEN) ?? false;
  }

  private setStolen(room: RoomState, stolen: boolean): void {
    this.privateState.set(room.code, ROOM_KEY, CT_ROOM_STOLEN, stolen);
  }

  // --- Per-player secrets -------------------------------------------------

  private getDie(room: RoomState, socketId: string): number | undefined {
    return this.privateState.get<number>(room.code, socketId, CT_DIE);
  }

  private getRole(room: RoomState, socketId: string): BananaThiefRole | undefined {
    return this.privateState.get<BananaThiefRole>(room.code, socketId, CT_ROLE);
  }

  private setRole(room: RoomState, socketId: string, role: BananaThiefRole): void {
    this.privateState.set(room.code, socketId, CT_ROLE, role);
  }

  /** Awake players are everyone whose secret die hour has already passed. */
  private refreshAwakePeers(room: RoomState, clock: number): void {
    const awakeIds = this.participatingIds(room).filter(
      (id) => (this.getDie(room, id) ?? BANANA_THIEF_CLOCK_HOURS) <= clock,
    );
    const nameOf = (id: string) => room.players.find((p) => p.socketId === id)?.name;
    for (const id of awakeIds) {
      const name = nameOf(id);
      if (!name) continue;
      this.privateState.set(
        room.code,
        id,
        CT_AWAKE_PEERS,
        awakeIds
          .filter((other) => other !== id)
          .map(nameOf)
          .filter((n): n is string => !!n),
      );
    }
  }

  /**
   * Per-player banana visibility for everyone whose hour has passed: the
   * center of the table shows the banana (or its absence). Sleeping players
   * get no status at all — they see nothing.
   */
  private refreshBananaStatus(room: RoomState, clock: number): void {
    const thiefId = this.getThiefId(room);
    const stolen = this.isStolen(room);
    const stealHour = thiefId ? this.getDie(room, thiefId) : undefined;
    for (const id of this.participatingIds(room)) {
      const die = this.getDie(room, id) ?? BANANA_THIEF_CLOCK_HOURS;
      if (die > clock) {
        this.privateState.delete(room.code, id, CT_BANANA_STATUS);
        continue;
      }
      const status: BananaStatus =
        id === thiefId
          ? 'STOLEN_BY_YOU'
          : stolen && stealHour !== undefined && die === stealHour
            ? 'WITNESSED_THEFT'
            : stolen
              ? 'MISSING'
              : 'PRESENT';
      this.privateState.set(room.code, id, CT_BANANA_STATUS, status);
    }
  }

  // --- Round lifecycle ----------------------------------------------------

  /** Start a fresh round (also used for "next round"): secret roles + dice. */
  startRound(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.BANANA_THIEF) return null;
    if (room.roomHostId !== requesterId) return null;
    if (room.status === RoomStatus.PLAYING) return null; // round already live

    const participants = this.participatingIds(room);
    const minRequired = getBananaThiefRequiredPlayerCount(room.config).min;
    if (participants.length < minRequired) return null;

    const shuffled = this.shuffleArray(participants);
    const thiefId = shuffled[0];

    this.setThiefId(room, thiefId);
    this.setFollowerIds(room, []);
    this.setVotes(room, {});
    this.clearPendingPeeks(room);
    this.setStolen(room, false);

    for (const id of participants) {
      this.setRole(room, id, id === thiefId ? BananaThiefRole.THIEF : BananaThiefRole.MOUSE);
      // Dice are NOT dealt here — every player rolls their own wake hour
      // during SETUP (see rollDie); no-shows get a silent auto-roll at night.
      this.privateState.delete(room.code, id, CT_DIE);
      this.privateState.delete(room.code, id, CT_REROLL_USED);
      this.privateState.delete(room.code, id, CT_BANANA_STATUS);
      this.privateState.delete(room.code, id, CT_AWAKE_PEERS);
      this.privateState.delete(room.code, id, CT_PEEK_OFFER);
      this.privateState.delete(room.code, id, CT_PEEK_RESULT);
      this.privateState.delete(room.code, id, CT_STOLE);
      this.privateState.delete(room.code, id, CT_WITNESSES);
      this.privateState.delete(room.code, id, CT_SEES_THIEF);
      this.privateState.delete(room.code, id, CT_CHOSEN_FOLLOWERS);
      this.privateState.delete(room.code, id, CT_SPECIAL);
      this.privateState.delete(room.code, id, CT_TWIN_PARTNER);
    }

    this.maybeAssignSpecials(
      room,
      participants.filter((id) => id !== thiefId),
    );

    room.status = RoomStatus.PLAYING;
    room.bananaThiefState = {
      phase: BananaThiefPhase.SETUP,
      readyIds: [],
      clock: 0,
      tickEndsAt: null,
      phaseEndsAt: null,
      bananaStolen: false,
      votesRecorded: 0,
      votesTotal: participants.length,
    };

    return room;
  }

  /**
   * DLC "special mice": deal specific selected specials if configured,
   * or fall back to random pool when bananaThiefDlc is on.
   */
  private maybeAssignSpecials(room: RoomState, miceIds: string[]): void {
    const selected = room.config.bananaThiefSelectedSpecials;
    if (selected && selected.length > 0) {
      const shuffledMice = this.shuffleArray(miceIds);
      for (const special of selected) {
        if (special === BananaThiefSpecial.TWINS) {
          if (shuffledMice.length < 2) continue;
          const a = shuffledMice.shift()!;
          const b = shuffledMice.shift()!;
          const nameOf = (id: string) => room.players.find((p) => p.socketId === id)?.name;
          const nameA = a ? nameOf(a) : undefined;
          const nameB = b ? nameOf(b) : undefined;
          if (!a || !b || !nameA || !nameB) continue;
          this.privateState.set(room.code, a, CT_SPECIAL, special);
          this.privateState.set(room.code, b, CT_SPECIAL, special);
          this.privateState.set(room.code, a, CT_TWIN_PARTNER, nameB);
          this.privateState.set(room.code, b, CT_TWIN_PARTNER, nameA);
        } else {
          const id = shuffledMice.shift();
          if (!id) continue;
          this.privateState.set(room.code, id, CT_SPECIAL, special);
        }
      }
      return;
    }

    if (!(room.config.bananaThiefDlc ?? false)) return;
    if (miceIds.length < 4) return; // keep at least 3 plain mice

    const pool: BananaThiefSpecial[] = [
      BananaThiefSpecial.DETECTIVE,
      BananaThiefSpecial.SYCOPHANT,
      BananaThiefSpecial.SCAPEGOAT,
    ];
    const count = miceIds.length >= BANANA_THIEF_DLC_MIN_PLAYERS ? 2 : 1;
    if (count >= 2) {
      pool.push(BananaThiefSpecial.TWINS);
    }

    const shuffledMice = this.shuffleArray(miceIds);
    const shuffledPool = this.shuffleArray(pool);
    const chosen = shuffledPool.slice(0, count);

    for (const special of chosen) {
      if (special === BananaThiefSpecial.TWINS) {
        const [a, b] = shuffledMice.splice(0, 2);
        const nameOf = (id: string) => room.players.find((p) => p.socketId === id)?.name;
        const nameA = a ? nameOf(a) : undefined;
        const nameB = b ? nameOf(b) : undefined;
        if (!a || !b || !nameA || !nameB) continue;
        this.privateState.set(room.code, a, CT_SPECIAL, special);
        this.privateState.set(room.code, b, CT_SPECIAL, special);
        this.privateState.set(room.code, a, CT_TWIN_PARTNER, nameB);
        this.privateState.set(room.code, b, CT_TWIN_PARTNER, nameA);
      } else {
        const id = shuffledMice.shift();
        if (!id) continue;
        this.privateState.set(room.code, id, CT_SPECIAL, special);
      }
    }
  }

  /**
   * SETUP gate: the night begins once every participant tapped ready (the
   * host may force-start past a stuck lobby). The ready tap also unlocks
   * speech synthesis on the client for the night narration.
   */
  ready(room: RoomState, socketId: string, force = false): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.SETUP) return null;

    const participants = this.participatingIds(room);
    if (!participants.includes(socketId)) return null;

    if (force && room.roomHostId === socketId) return this.afterSetup(room);

    state.readyIds = state.readyIds ?? [];
    if (!state.readyIds.includes(socketId)) state.readyIds.push(socketId);
    if (participants.every((id) => state.readyIds.includes(id))) {
      return this.afterSetup(room);
    }
    return room;
  }

  /**
   * SETUP-phase die roll: the first press rolls the secret wake hour; one
   * more press re-rolls it. Once the single re-roll is spent (or the night
   * has begun) the request is rejected.
   */
  rollDie(room: RoomState, socketId: string): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.SETUP) return null;
    if (!this.participatingIds(room).includes(socketId)) return null;

    if (this.getDie(room, socketId) === undefined) {
      this.privateState.set(room.code, socketId, CT_DIE, this.randomDie());
      return room;
    }
    if (this.privateState.get<boolean>(room.code, socketId, CT_REROLL_USED)) return null;
    this.privateState.set(room.code, socketId, CT_DIE, this.randomDie());
    this.privateState.set(room.code, socketId, CT_REROLL_USED, true);
    return room;
  }

  private afterSetup(room: RoomState): RoomState {
    // Anyone who never pressed the die gets a silent auto-roll so the night
    // always starts with a full set of wake hours.
    for (const id of this.participatingIds(room)) {
      if (this.getDie(room, id) === undefined) {
        this.privateState.set(room.code, id, CT_DIE, this.randomDie());
      }
    }
    return this.beginNight(room);
  }

  private beginChooseFollower(room: RoomState): RoomState {
    const state = room.bananaThiefState!;
    state.phase = BananaThiefPhase.CHOOSE_FOLLOWER;
    state.readyIds = [];
    state.clock = BANANA_THIEF_CLOCK_HOURS;
    state.nightGrace = false;
    state.tickEndsAt = null;
    const chooseSeconds = 15;
    state.phaseEndsAt = Date.now() + chooseSeconds * 1000;
    return room;
  }

  /**
   * Thief recruits follower(s) directly during the CHOOSE_FOLLOWER phase.
   */
  chooseFollower(room: RoomState, requesterId: string, targetId: string): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.CHOOSE_FOLLOWER) return null;

    const thiefId = this.getThiefId(room);
    if (requesterId !== thiefId) return null;
    if (targetId === thiefId) return null;

    const participants = this.participatingIds(room);
    if (!participants.includes(targetId)) return null;

    // Scapegoat cannot be recruited (they are neutral)
    if (
      this.privateState.get<BananaThiefSpecial>(room.code, targetId, CT_SPECIAL) ===
      BananaThiefSpecial.SCAPEGOAT
    ) {
      return null;
    }

    const followers = [...this.getFollowerIds(room)];
    const maxFollowers = room.config.bananaThiefFollowerCount ?? 1;

    if (!followers.includes(targetId)) {
      if (followers.length >= maxFollowers) {
        followers.shift();
      }
      followers.push(targetId);
    }
    this.setFollowerIds(room, followers);

    const thiefName = room.players.find((p) => p.socketId === thiefId)?.name;
    const followerNames = followers
      .map((id) => room.players.find((p) => p.socketId === id)?.name)
      .filter((n): n is string => !!n);
    this.privateState.set(room.code, thiefId, CT_CHOSEN_FOLLOWERS, followerNames);

    for (const fid of followers) {
      this.setRole(room, fid, BananaThiefRole.FOLLOWER);
      if (thiefName) {
        this.privateState.set(room.code, fid, CT_SEES_THIEF, thiefName);
      }
    }

    if (followers.length >= maxFollowers) {
      this.beginDiscussion(room);
      return room;
    }
    return room;
  }

  chooseFollowerTimeout(room: RoomState): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.CHOOSE_FOLLOWER) return null;

    // Followers are NEVER auto-assigned: the role exists only because the
    // thief picked it. An indecisive thief simply starts the morning with no
    // accomplices.
    this.beginDiscussion(room);
    return room;
  }

  private beginNight(room: RoomState): RoomState {
    const state = room.bananaThiefState!;
    const hostPaced = (room.config.bananaThiefNarrator ?? 'AUTO') === 'HOST';
    const tickSeconds = room.config.bananaThiefTickSeconds ?? 6;
    state.phase = BananaThiefPhase.NIGHT;
    state.readyIds = [];
    state.clock = 0;
    state.nightGrace = false;
    state.tickEndsAt = hostPaced ? null : Date.now() + tickSeconds * 1000;
    return room;
  }

  /**
   * Advance the night clock by one hour. Called either by the auto-timer
   * (AUTO mode / grace expiry) or by the host's "next hour" button
   * (HOST-narrator mode). Stale timer callbacks are rejected upstream by the
   * gateway's phase+deadline re-check.
   */
  tick(room: RoomState): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.NIGHT) return null;

    // Grace expiry: everyone had their extra seconds — close the night.
    if (state.clock >= BANANA_THIEF_CLOCK_HOURS) {
      state.nightGrace = false;
      this.clearPendingPeeks(room);
      return this.endNight(room);
    }

    state.clock += 1;
    const clock = state.clock;

    const thiefId = this.getThiefId(room);
    const thiefDie = thiefId ? this.getDie(room, thiefId) : undefined;

    // The thief steals the moment their hour arrives; any mouse waking in the
    // same hour witnesses it — but STAYS a mouse. Followers exist only by the
    // thief's own choice (CHOOSE_FOLLOWER), never by chance.
    if (thiefDie === clock && thiefId) {
      this.setStolen(room, true);
      const thiefName = room.players.find((p) => p.socketId === thiefId)?.name;
      const witnesses: string[] = [];
      for (const id of this.participatingIds(room)) {
        if (id === thiefId) {
          this.privateState.set(room.code, id, CT_STOLE, true);
          continue;
        }
        if ((this.getDie(room, id) ?? BANANA_THIEF_CLOCK_HOURS) === clock) {
          const witnessName = room.players.find((p) => p.socketId === id)?.name;
          if (witnessName) witnesses.push(witnessName);
          if (thiefName) this.privateState.set(room.code, id, CT_SEES_THIEF, thiefName);
        }
      }
      this.privateState.set(room.code, thiefId, CT_WITNESSES, witnesses);
    } else {
      // A mouse waking completely alone earns a one-time die peek.
      const soloWakees = this.participatingIds(room).filter(
        (id) => (this.getDie(room, id) ?? BANANA_THIEF_CLOCK_HOURS) === clock,
      );
      if (soloWakees.length === 1) {
        this.privateState.set(room.code, soloWakees[0], CT_PEEK_OFFER, true);
        this.addPendingPeek(room, soloWakees[0]);
      }
    }

    this.refreshAwakePeers(room, clock);
    this.refreshBananaStatus(room, clock);

    if (clock >= BANANA_THIEF_CLOCK_HOURS) {
      // Anti-cutoff: never slam the eyes shut while a die peek is pending.
      // Hold the night open for a few extra seconds, then move on.
      if (this.getPendingPeeks(room).length > 0) {
        state.nightGrace = true;
        const graceSeconds = Math.max(5, room.config.bananaThiefTickSeconds ?? 6);
        state.tickEndsAt = Date.now() + graceSeconds * 1000;
      } else {
        return this.endNight(room);
      }
    } else {
      const hostPaced = (room.config.bananaThiefNarrator ?? 'AUTO') === 'HOST';
      state.tickEndsAt = hostPaced
        ? null
        : Date.now() + (room.config.bananaThiefTickSeconds ?? 6) * 1000;
    }

    return room;
  }

  /** HOST-narrator mode: the host manually advances to the next hour. */
  nextHour(room: RoomState, requesterId: string): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.NIGHT) return null;
    if (room.roomHostId !== requesterId) return null;
    return this.tick(room);
  }

  private endNight(room: RoomState): RoomState {
    const followerCount = room.config.bananaThiefFollowerCount ?? 1;
    if (followerCount > 0) {
      return this.beginChooseFollower(room);
    }
    this.beginDiscussion(room);
    return room;
  }

  private beginDiscussion(room: RoomState): void {
    const state = room.bananaThiefState!;
    state.phase = BananaThiefPhase.DISCUSSION;
    state.clock = BANANA_THIEF_CLOCK_HOURS;
    state.tickEndsAt = null;
    state.bananaStolen = true;
    state.phaseEndsAt = Date.now() + (room.config.bananaThiefDiscussionSeconds ?? 180) * 1000;
    // An unspent peek offer expires with the night.
    this.clearPendingPeeks(room);
  }

  /** Solo-wake reward: peek at one other player's secret die. */
  peek(room: RoomState, socketId: string, targetId: string): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.NIGHT) return null;
    if (!this.getPendingPeeks(room).includes(socketId)) return null;
    if (!this.privateState.get<boolean>(room.code, socketId, CT_PEEK_OFFER)) return null;
    if (targetId === socketId) return null;

    const participants = new Set(this.participatingIds(room));
    if (!participants.has(targetId)) return null;

    const die = this.getDie(room, targetId);
    if (die === undefined) return null;

    const targetName = room.players.find((p) => p.socketId === targetId)?.name;
    // DLC Detective: the solo-wake peek returns the target's ROLE (as of this
    // moment) instead of a die face — the whole point of the mouse.
    const isDetective =
      this.privateState.get<BananaThiefSpecial>(room.code, socketId, CT_SPECIAL) ===
      BananaThiefSpecial.DETECTIVE;
    const peekRole = isDetective
      ? (this.getRole(room, targetId) ?? BananaThiefRole.MOUSE)
      : undefined;
    this.privateState.set(room.code, socketId, CT_PEEK_RESULT, {
      targetId,
      targetName,
      die,
      ...(peekRole ? { role: peekRole } : {}),
    });
    this.privateState.delete(room.code, socketId, CT_PEEK_OFFER);
    this.removePendingPeek(room, socketId);

    return room;
  }

  /** Host skip or discussion timer expiry → open the ballot. */
  startVote(room: RoomState, requesterId: string): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.DISCUSSION) return null;
    if (room.roomHostId !== requesterId) return null;
    return this.openBallot(room);
  }

  private openBallot(room: RoomState): RoomState | null {
    const state = room.bananaThiefState!;
    const participants = this.participatingIds(room);
    if (participants.length === 0) return null;

    state.phase = BananaThiefPhase.VOTING;
    state.phaseEndsAt = Date.now() + (room.config.bananaThiefVoteSeconds ?? 15) * 1000;
    state.votesRecorded = 0;
    state.votesTotal = participants.length;
    this.setVotes(room, {});
    return room;
  }

  vote(room: RoomState, socketId: string, targetId: string): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.VOTING) return null;

    const participants = new Set(this.participatingIds(room));
    if (!participants.has(socketId) || !participants.has(targetId) || targetId === socketId) {
      return null;
    }

    const votes = this.getVotes(room);
    if (votes[socketId]) return null; // ballots are final
    votes[socketId] = targetId;
    this.setVotes(room, votes);
    state.votesRecorded = Object.keys(votes).filter((v) => participants.has(v)).length;

    if (state.votesRecorded >= state.votesTotal) {
      this.finalize(room);
    }
    return room;
  }

  /** Vote phase timer expiry — finalize with whatever ballots arrived. */
  handleVotePhaseEnd(room: RoomState): RoomState | null {
    const state = room.bananaThiefState;
    if (!state || state.phase !== BananaThiefPhase.VOTING) return null;
    this.finalize(room);
    return room;
  }

  private finalize(room: RoomState, fledThief = false): void {
    const state = room.bananaThiefState!;
    const thiefId = this.getThiefId(room);
    const followerIds = this.getFollowerIds(room);
    const votes = this.getVotes(room);

    // Tally only ballots from players still seated.
    const participants = new Set(this.participatingIds(room));
    const tally: Record<string, number> = {};
    for (const target of Object.values(votes)) {
      if (participants.has(target)) tally[target] = (tally[target] ?? 0) + 1;
    }

    let caughtId: string | null = null;
    if (fledThief) {
      caughtId = thiefId;
    } else {
      let max = 0;
      let tied = false;
      for (const [id, count] of Object.entries(tally)) {
        if (count > max) {
          max = count;
          tied = false;
          caughtId = id;
        } else if (count === max) {
          tied = true;
        }
      }
      if (tied) caughtId = null; // a tie lets the thief slip away
    }

    // DLC Scapegoat: the vote landing exactly on the goat is THEIR victory —
    // everyone else (thief team included) gets fooled.
    const caughtIsGoat =
      !!caughtId &&
      this.privateState.get<BananaThiefSpecial>(room.code, caughtId, CT_SPECIAL) ===
        BananaThiefSpecial.SCAPEGOAT;

    const winner: BananaThiefWinner = caughtIsGoat
      ? 'SCAPEGOAT'
      : caughtId && caughtId === thiefId
        ? 'MICE'
        : 'THIEF';

    const scoreDeltas: Record<string, number> = {};
    for (const id of participants) scoreDeltas[id] = 0;

    if (winner === 'SCAPEGOAT') {
      if (caughtId) scoreDeltas[caughtId] = SCORE_THIEF_ESCAPE; // +3, alone
    } else if (winner === 'MICE') {
      for (const [voter, target] of Object.entries(votes)) {
        if (participants.has(voter) && target === thiefId) {
          scoreDeltas[voter] = (scoreDeltas[voter] ?? 0) + SCORE_CORRECT_VOTE;
        }
      }
    } else {
      if (thiefId && participants.has(thiefId)) {
        scoreDeltas[thiefId] = (scoreDeltas[thiefId] ?? 0) + SCORE_THIEF_ESCAPE;
      }
      for (const id of followerIds) {
        if (participants.has(id)) {
          scoreDeltas[id] = (scoreDeltas[id] ?? 0) + SCORE_FOLLOWER_ESCAPE;
        }
      }
      // DLC Sycophant: thief-team without knowing the thief — escapes too.
      for (const id of participants) {
        if (
          scoreDeltas[id] === 0 &&
          this.privateState.get<BananaThiefSpecial>(room.code, id, CT_SPECIAL) ===
            BananaThiefSpecial.SYCOPHANT
        ) {
          scoreDeltas[id] = SCORE_FOLLOWER_ESCAPE;
        }
      }
    }

    for (const [id, delta] of Object.entries(scoreDeltas)) {
      const player = room.players.find((p) => p.socketId === id);
      if (player) player.score += delta;
    }

    state.phase = BananaThiefPhase.RESULT;
    state.tickEndsAt = null;
    state.phaseEndsAt = null;
    state.thiefId = thiefId;
    state.followerIds = followerIds.filter((id) => participants.has(id));
    state.votes = votes;
    state.caughtId = caughtId;
    // Full-morning reveal: everyone's secret wake dice hit the table.
    state.dice = {};
    for (const id of participants) {
      state.dice[id] = this.getDie(room, id) ?? 0;
    }
    // DLC specials are public knowledge once the round is over.
    state.specials = {};
    for (const id of participants) {
      const special = this.privateState.get<BananaThiefSpecial>(room.code, id, CT_SPECIAL);
      if (special) state.specials[id] = special;
    }
    state.fledThief = fledThief;
    state.winner = winner;
    state.scoreDeltas = scoreDeltas;
    room.status = RoomStatus.RESULT;
  }

  reset(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.BANANA_THIEF) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.bananaThiefState = undefined;
    this.privateState.clearRoom(room.code);

    room.players.forEach((p) => {
      p.score = 0;
    });

    return room;
  }

  // --- Reconnection & disconnect -------------------------------------------

  /**
   * The thief/follower/vote secrets live as socket-id VALUES inside the
   * room-level private record, which remapSocketId (keys only) never touches
   * — re-point them here on reconnection.
   */
  remapRoomSecrets(code: string, oldSocketId: string, newSocketId: string): void {
    const thief = this.privateState.get<string>(code, ROOM_KEY, CT_ROOM_THIEF);
    if (thief === oldSocketId) {
      this.privateState.set(code, ROOM_KEY, CT_ROOM_THIEF, newSocketId);
    }
    const followers = this.privateState.get<string[]>(code, ROOM_KEY, CT_ROOM_FOLLOWERS);
    if (followers?.includes(oldSocketId)) {
      this.privateState.set(
        code,
        ROOM_KEY,
        CT_ROOM_FOLLOWERS,
        followers.map((id) => (id === oldSocketId ? newSocketId : id)),
      );
    }
    const pendingPeeks = this.privateState.get<string[]>(code, ROOM_KEY, CT_ROOM_PENDING_PEEK);
    if (pendingPeeks?.includes(oldSocketId)) {
      this.privateState.set(
        code,
        ROOM_KEY,
        CT_ROOM_PENDING_PEEK,
        pendingPeeks.map((id) => (id === oldSocketId ? newSocketId : id)),
      );
    }
    const votes = this.privateState.get<Record<string, string>>(code, ROOM_KEY, CT_ROOM_VOTES);
    if (votes) {
      const remapped: Record<string, string> = {};
      let changed = false;
      for (const [voter, target] of Object.entries(votes)) {
        const newVoter = voter === oldSocketId ? newSocketId : voter;
        const newTarget = target === oldSocketId ? newSocketId : target;
        if (newVoter !== voter || newTarget !== target) changed = true;
        remapped[newVoter] = newTarget;
      }
      if (changed) this.privateState.set(code, ROOM_KEY, CT_ROOM_VOTES, remapped);
    }
  }

  /** Re-point every socket-id reference inside the public state on reconnect. */
  remapSocketId(state: BananaThiefState, oldSocketId: string, newSocketId: string): void {
    if (state.thiefId === oldSocketId) state.thiefId = newSocketId;
    if (state.caughtId === oldSocketId) state.caughtId = newSocketId;
    if (state.readyIds) {
      state.readyIds = state.readyIds.map((id) => (id === oldSocketId ? newSocketId : id));
    }
    if (state.followerIds) {
      state.followerIds = state.followerIds.map((id) => (id === oldSocketId ? newSocketId : id));
    }
    if (state.votes) {
      const remapped: Record<string, string> = {};
      for (const [voter, target] of Object.entries(state.votes)) {
        remapped[voter === oldSocketId ? newSocketId : voter] =
          target === oldSocketId ? newSocketId : target;
      }
      state.votes = remapped;
    }
    if (state.scoreDeltas && oldSocketId in state.scoreDeltas) {
      state.scoreDeltas[newSocketId] = state.scoreDeltas[oldSocketId];
      delete state.scoreDeltas[oldSocketId];
    }
  }

  /**
   * A dropped thief ends the round at once — the mice win by forfeit.
   * Any other dropout during voting may unblock the ballot.
   */
  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    const state = room.bananaThiefState;
    if (!state || state.phase === BananaThiefPhase.RESULT) return;

    if (this.getThiefId(room) === socketId) {
      this.finalize(room, true);
      return;
    }

    const participants = new Set(this.participatingIds(room));

    if (state.phase === BananaThiefPhase.SETUP) {
      // Re-ready against the smaller table; start once the rest are all set.
      state.readyIds = (state.readyIds ?? []).filter((id) => participants.has(id));
      if (participants.size > 0 && [...participants].every((id) => state.readyIds.includes(id))) {
        this.afterSetup(room);
      }
      return;
    }

    if (state.phase === BananaThiefPhase.CHOOSE_FOLLOWER) {
      if (this.getThiefId(room) === socketId) {
        this.finalize(room, true);
        return;
      }
    }

    if (state.phase === BananaThiefPhase.VOTING) {
      const votes = this.getVotes(room);
      state.votesRecorded = Object.keys(votes).filter((v) => participants.has(v)).length;
      state.votesTotal = participants.size;
      if (participants.size > 0 && state.votesRecorded >= state.votesTotal) {
        this.finalize(room);
      }
    }
  }
}
