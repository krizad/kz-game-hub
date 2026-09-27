import { Test, TestingModule } from '@nestjs/testing';
import { CheeseThiefService } from './cheese-thief.service';
import { PrivateStateService } from '../private-state.service';
import {
  RoomState,
  RoomStatus,
  GameType,
  CheeseThiefPhase,
  CheeseThiefRole,
  CheeseThiefSpecial,
  CHEESE_THIEF_CLOCK_HOURS,
  getCheeseThiefRequiredPlayerCount,
} from '@repo/types';

const ROOM_KEY = '__room__';

describe('CheeseThiefService', () => {
  let service: CheeseThiefService;
  let privateState: PrivateStateService;
  let room: RoomState;

  const PLAYER_IDS = ['p1', 'p2', 'p3', 'p4', 'p5'];

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheeseThiefService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();

    service = module.get<CheeseThiefService>(CheeseThiefService);
    room = createRoom(PLAYER_IDS);
  });

  function createRoom(socketIds: string[]): RoomState {
    return {
      id: 'room-id',
      code: 'ABC123',
      gameType: GameType.CHEESE_THIEF,
      status: RoomStatus.LOBBY,
      roomHostId: socketIds[0],
      createdAt: new Date(),
      config: {
        hostSelection: 'FIXED',
        timerMin: 1,
        cheeseThiefFollowerCount: 0,
        cheeseThiefTickSeconds: 6,
        cheeseThiefDiscussionSeconds: 180,
        cheeseThiefVoteSeconds: 45,
      },
      players: socketIds.map((id, i) => ({
        id,
        socketId: id,
        name: `P${i + 1}`,
        score: 0,
        roomId: 'room-id',
        connected: true,
      })),
    } as unknown as RoomState;
  }

  const thiefId = () => privateState.get<string>(room.code, ROOM_KEY, 'ctRoomThief') ?? '';
  const followerIds = () =>
    privateState.get<string[]>(room.code, ROOM_KEY, 'ctRoomFollowers') ?? [];
  const votes = () =>
    privateState.get<Record<string, string>>(room.code, ROOM_KEY, 'ctRoomVotes') ?? {};

  /** Force deterministic dice/thief after the random startRound. */
  function rigGame(dice: Record<string, number>, thief?: string) {
    const t = thief ?? thiefId();
    for (const [id, die] of Object.entries(dice)) {
      privateState.set(room.code, id, 'ctDie', die);
    }
    if (thief) privateState.set(room.code, ROOM_KEY, 'ctRoomThief', thief);
    for (const id of PLAYER_IDS) {
      privateState.delete(room.code, id, 'ctSpecial');
      privateState.delete(room.code, id, 'ctTwinPartner');
      privateState.set(
        room.code,
        id,
        'ctRole',
        id === t ? CheeseThiefRole.THIEF : CheeseThiefRole.MOUSE,
      );
    }
    return t;
  }

  /** Tick the night forward one hour, asserting the service accepted it. */
  function tick(): RoomState {
    const result = service.tick(room);
    expect(result).not.toBeNull();
    return result!;
  }

  /** Start a round, rig dice, tap everyone ready (begins the night), then run
   * the whole night — including any night-end grace window. */
  function runNight(dice: Record<string, number>, thief?: string): string {
    expect(service.startRound(room, 'p1')).not.toBeNull();
    const t = rigGame(dice, thief);
    for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
    for (let i = 0; i < 8 && room.cheeseThiefState!.phase === CheeseThiefPhase.NIGHT; i++) {
      tick();
    }
    return t;
  }

  describe('startRound', () => {
    it('requires at least 4 players', () => {
      const small = createRoom(['p1', 'p2', 'p3']);
      expect(service.startRound(small, 'p1')).toBeNull();
    });

    it('rejects a non-host requester', () => {
      expect(service.startRound(room, 'p2')).toBeNull();
    });

    it('deals one thief, keeps all secrets out of the public state', () => {
      const started = service.startRound(room, 'p1')!;
      expect(started.status).toBe(RoomStatus.PLAYING);
      const state = started.cheeseThiefState!;
      expect(state.phase).toBe(CheeseThiefPhase.SETUP);
      expect(state.readyIds).toEqual([]);
      expect(state.clock).toBe(0);
      expect(state.cheeseStolen).toBe(false);
      expect(state.thiefId).toBeUndefined();

      const roles = PLAYER_IDS.map((id) =>
        privateState.get<CheeseThiefRole>(room.code, id, 'ctRole'),
      );
      expect(roles.filter((r) => r === CheeseThiefRole.THIEF)).toHaveLength(1);
      expect(roles.filter((r) => r === CheeseThiefRole.MOUSE)).toHaveLength(4);

      for (const id of PLAYER_IDS) {
        const die = privateState.get<number>(room.code, id, 'ctDie');
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(CHEESE_THIEF_CLOCK_HOURS);
      }

      // The broadcast payload must not carry any secret.
      const serialized = JSON.stringify(started);
      expect(serialized).not.toContain('ctRole');
      expect(serialized).not.toContain('ctDie');
      expect(serialized).not.toContain('ctRoomThief');
    });
  });

  describe('night tick', () => {
    beforeEach(() => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
    });

    it('advances the clock and converts a mouse waking with the thief into a follower', () => {
      const thief = rigGame({ p1: 3, p2: 1, p3: 2, p4: 3, p5: 6 }, 'p1');

      tick(); // 1:00 — p2 wakes alone
      tick(); // 2:00 — p3 wakes alone
      const atThree = tick(); // 3:00 — thief + p4 wake
      expect(atThree.cheeseThiefState!.clock).toBe(3);
      // Steal stays private until the morning announcement.
      expect(atThree.cheeseThiefState!.cheeseStolen).toBe(false);
      expect(privateState.get<boolean>(room.code, ROOM_KEY, 'ctRoomStolen')).toBe(true);
      expect(privateState.get<boolean>(room.code, thief, 'ctStole')).toBe(true);

      expect(followerIds()).toEqual(['p4']);
      expect(privateState.get<CheeseThiefRole>(room.code, 'p4', 'ctRole')).toBe(
        CheeseThiefRole.FOLLOWER,
      );
    });

    it('offers a one-time die peek to a mouse waking alone', () => {
      rigGame({ p1: 3, p2: 1, p3: 2, p4: 3, p5: 6 }, 'p1');

      tick(); // 1:00 — p2 wakes alone
      expect(privateState.get<boolean>(room.code, 'p2', 'ctPeekOffer')).toBe(true);

      const peeked = service.peek(room, 'p2', 'p1')!;
      expect(peeked).not.toBeNull();
      const result = privateState.get<{ targetName: string; die: number }>(
        room.code,
        'p2',
        'ctPeekResult',
      );
      expect(result?.die).toBe(3);
      expect(privateState.get(room.code, 'p2', 'ctPeekOffer')).toBeUndefined();
      // A second peek attempt is refused.
      expect(service.peek(room, 'p2', 'p3')).toBeNull();
    });

    it('does not grant a peek when several players wake together', () => {
      rigGame({ p1: 6, p2: 1, p3: 1, p4: 2, p5: 2 }, 'p1');
      tick(); // 1:00 — p2+p3 wake together
      expect(privateState.get(room.code, 'p2', 'ctPeekOffer')).toBeUndefined();
      expect(privateState.get(room.code, 'p3', 'ctPeekOffer')).toBeUndefined();
    });

    it('updates awake peers only for players whose hour has passed', () => {
      rigGame({ p1: 6, p2: 1, p3: 3, p4: 3, p5: 6 }, 'p1');
      tick(); // 1:00
      // p2 is awake and sees nobody (p1/p3/p4/p5 sleep).
      expect(privateState.get<string[]>(room.code, 'p2', 'ctAwakePeers')).toEqual([]);
      // Sleeping players receive no awake list at all.
      expect(privateState.get(room.code, 'p3', 'ctAwakePeers')).toBeUndefined();
    });

    it('enters DISCUSSION after hour 6 when no peek is pending', () => {
      rigGame({ p1: 1, p2: 2, p3: 2, p4: 2, p5: 2 }, 'p1');
      let last = room;
      for (let i = 0; i < CHEESE_THIEF_CLOCK_HOURS; i++) last = tick();
      const state = last.cheeseThiefState!;
      expect(state.phase).toBe(CheeseThiefPhase.DISCUSSION);
      expect(state.clock).toBe(CHEESE_THIEF_CLOCK_HOURS);
      expect(state.cheeseStolen).toBe(true);
      expect(state.tickEndsAt).toBeNull();
      expect(state.phaseEndsAt).toBeGreaterThan(Date.now());
    });

    it('holds a night-end grace period so a pending peek is never cut off', () => {
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 6 }, 'p1');
      // p5 is the hour-6 solo waker holding an unused peek.
      let last = room;
      for (let i = 0; i < CHEESE_THIEF_CLOCK_HOURS; i++) last = tick();

      const state = last.cheeseThiefState!;
      expect(state.phase).toBe(CheeseThiefPhase.NIGHT);
      expect(state.clock).toBe(CHEESE_THIEF_CLOCK_HOURS);
      expect(state.nightGrace).toBe(true);
      expect(state.tickEndsAt).not.toBeNull();

      // The peek offer survives the grace window — the action completes.
      expect(privateState.get<boolean>(room.code, 'p5', 'ctPeekOffer')).toBe(true);
      expect(service.peek(room, 'p5', 'p1')!).not.toBeNull();

      // Grace expiry closes the night and drops leftover offers.
      const closed = tick()!;
      expect(closed.cheeseThiefState!.phase).toBe(CheeseThiefPhase.DISCUSSION);
      expect(closed.cheeseThiefState!.nightGrace).toBe(false);
    });
  });

  describe('peek guards', () => {
    it('rejects peek when not offered, self-targeted, or unknown target', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 6, p2: 1, p3: 2, p4: 2, p5: 2 }, 'p1');
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      tick(); // p2 solo wake

      expect(service.peek(room, 'p3', 'p2')).toBeNull(); // not offered
      expect(service.peek(room, 'p2', 'p2')).toBeNull(); // self
      expect(service.peek(room, 'p2', 'ghost')).toBeNull(); // not a participant
    });
  });

  describe('ready gate', () => {
    it('night starts only when every participant is ready', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      const state = () => room.cheeseThiefState!;

      expect(service.ready(room, 'p2')).not.toBeNull();
      expect(state().phase).toBe(CheeseThiefPhase.SETUP);
      expect(state().readyIds).toEqual(['p2']);

      // Duplicate ready taps are idempotent.
      expect(service.ready(room, 'p2')).not.toBeNull();
      expect(state().readyIds).toEqual(['p2']);

      expect(service.ready(room, 'p3')).not.toBeNull();
      expect(service.ready(room, 'p4')).not.toBeNull();
      expect(service.ready(room, 'p5')).not.toBeNull();
      // The host taps last — the night begins on the final ready tap.
      const started = service.ready(room, 'p1')!;
      expect(started.cheeseThiefState!.phase).toBe(CheeseThiefPhase.NIGHT);
      expect(started.cheeseThiefState!.readyIds).toEqual([]);
      expect(started.cheeseThiefState!.clock).toBe(0);
    });

    it('the host can force-start past a stuck lobby', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      const forced = service.ready(room, 'p1', true)!;
      expect(forced.cheeseThiefState!.phase).toBe(CheeseThiefPhase.NIGHT);
    });

    it('a non-host force request does nothing special', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      const result = service.ready(room, 'p3', true)!;
      expect(result.cheeseThiefState!.phase).toBe(CheeseThiefPhase.SETUP);
      expect(result.cheeseThiefState!.readyIds).toEqual(['p3']);
    });

    it('viewers and non-participants cannot ready', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      expect(service.ready(room, 'ghost')).toBeNull();
    });
  });

  describe('witness & follower secrets', () => {
    it('the thief learns who saw the steal and the follower learns the thief', () => {
      runNight({ p1: 3, p2: 1, p3: 2, p4: 3, p5: 6 }, 'p1');

      expect(privateState.get<string[]>(room.code, 'p1', 'ctWitnesses')).toEqual(['P4']);
      expect(privateState.get<string>(room.code, 'p4', 'ctSeesThief')).toBe('P1');
      // Bystanders get neither secret.
      expect(privateState.get(room.code, 'p2', 'ctSeesThief')).toBeUndefined();
      expect(privateState.get(room.code, 'p2', 'ctWitnesses')).toBeUndefined();
    });

    it('an unwitnessed steal leaves the witness list empty', () => {
      runNight({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      expect(privateState.get<string[]>(room.code, 'p1', 'ctWitnesses')).toEqual([]);
    });
  });

  describe('voting', () => {
    it('host can skip the discussion straight to voting', () => {
      runNight({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      const result = service.startVote(room, 'p1')!;
      expect(result.cheeseThiefState!.phase).toBe(CheeseThiefPhase.VOTING);
      expect(result.cheeseThiefState!.votesTotal).toBe(5);
    });

    it('non-host cannot skip the discussion', () => {
      runNight({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      expect(service.startVote(room, 'p2')).toBeNull();
    });

    it('rejects invalid ballots and counts until everyone has voted', () => {
      runNight({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      service.startVote(room, 'p1');
      expect(service.vote(room, 'p1', 'p1')).toBeNull(); // self
      expect(service.vote(room, 'p1', 'ghost')).toBeNull();
      expect(service.vote(room, 'p1', 'p2')!).not.toBeNull();
      expect(votes()['p1']).toBe('p2');
      expect(service.vote(room, 'p1', 'p3')).toBeNull(); // double vote

      const state = room.cheeseThiefState!;
      expect(state.votesRecorded).toBe(1);
      expect(state.phase).toBe(CheeseThiefPhase.VOTING);

      service.vote(room, 'p2', 'p1');
      service.vote(room, 'p3', 'p1');
      service.vote(room, 'p4', 'p2');
      const final = service.vote(room, 'p5', 'p1')!;
      // p1 (thief) gathers 3 votes → caught → mice win.
      expect(final.cheeseThiefState!.phase).toBe(CheeseThiefPhase.RESULT);
      expect(final.cheeseThiefState!.winner).toBe('MICE');
      expect(final.cheeseThiefState!.caughtId).toBe('p1');
      expect(final.cheeseThiefState!.thiefId).toBe('p1');
      expect(final.status).toBe(RoomStatus.RESULT);
    });

    it('awards correct voters and escapes to thief + followers', () => {
      runNight({ p1: 1, p2: 1, p3: 3, p4: 4, p5: 5 }, 'p1');
      // p2 wakes in the thief's hour → silently converted.
      expect(followerIds()).toEqual(['p2']);

      service.startVote(room, 'p1');
      service.vote(room, 'p2', 'p1'); // follower betrays → correct
      service.vote(room, 'p3', 'p1');
      service.vote(room, 'p4', 'p3');
      service.vote(room, 'p5', 'p3');
      service.vote(room, 'p1', 'p5'); // thief votes, majority still p1? p1 has 2, p3 has 2 — tie!

      // 2 votes p1 vs 2 votes p3 → tie → thief escapes.
      const state = room.cheeseThiefState!;
      expect(state.winner).toBe('THIEF');
      expect(state.caughtId).toBeNull();

      const p1 = room.players.find((p) => p.socketId === 'p1')!;
      const p2 = room.players.find((p) => p.socketId === 'p2')!;
      const p3 = room.players.find((p) => p.socketId === 'p3')!;
      expect(p1.score).toBe(3); // thief escape
      expect(p2.score).toBe(2); // follower escape
      expect(p3.score).toBe(0); // wrong vote
    });

    it('a clear majority catches the thief and pays correct voters', () => {
      runNight({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      service.startVote(room, 'p1');
      service.vote(room, 'p2', 'p1');
      service.vote(room, 'p3', 'p1');
      service.vote(room, 'p4', 'p1');
      service.vote(room, 'p5', 'p2');
      service.vote(room, 'p1', 'p2');

      const state = room.cheeseThiefState!;
      expect(state.winner).toBe('MICE');
      expect(room.players.find((p) => p.socketId === 'p2')!.score).toBe(2);
      expect(room.players.find((p) => p.socketId === 'p3')!.score).toBe(2);
      expect(room.players.find((p) => p.socketId === 'p1')!.score).toBe(0);
    });
  });

  describe('reconnection & disconnect', () => {
    it('re-points thief/follower/vote secrets to the new socket id', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 1, p3: 3, p4: 4, p5: 5 }, 'p2');
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      for (let i = 0; i < 8 && room.cheeseThiefState!.phase === CheeseThiefPhase.NIGHT; i++) {
        tick();
      }
      service.startVote(room, 'p1');
      service.vote(room, 'p1', 'p3');

      // p1 co-wakes with the thief at 1:00 → follower; then both reconnect.
      privateState.remapSocketId(room.code, 'p2', 'p2-new');
      service.remapRoomSecrets(room.code, 'p2', 'p2-new');
      privateState.remapSocketId(room.code, 'p1', 'p1-new');
      service.remapRoomSecrets(room.code, 'p1', 'p1-new');
      service.remapSocketId(room.cheeseThiefState!, 'p1', 'p1-new');

      expect(thiefId()).toBe('p2-new');
      expect(votes()['p1-new']).toBe('p3');
      expect(followerIds()).toContain('p1-new');
      expect(privateState.get<CheeseThiefRole>(room.code, 'p2-new', 'ctRole')).toBe(
        CheeseThiefRole.THIEF,
      );
    });

    it('the thief dropping mid-round forfeits: mice win', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      const thief = thiefId();

      service.handlePlayerDisconnect(room, thief);
      const state = room.cheeseThiefState!;
      expect(state.phase).toBe(CheeseThiefPhase.RESULT);
      expect(state.winner).toBe('MICE');
      expect(state.fledThief).toBe(true);
      expect(state.thiefId).toBe(thief);
    });

    it('a non-thief dropout during voting adjusts the tally without finalizing early', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      for (let i = 0; i < 8 && room.cheeseThiefState!.phase === CheeseThiefPhase.NIGHT; i++) {
        tick();
      }
      service.startVote(room, 'p1');
      service.vote(room, 'p1', 'p3');

      // p5 leaves: 4 participants, 1 ballot — not everyone has voted yet.
      const dropped = room.players.find((p) => p.socketId === 'p5')!;
      dropped.connected = false;
      service.handlePlayerDisconnect(room, 'p5');
      const state = room.cheeseThiefState!;
      expect(state.phase).toBe(CheeseThiefPhase.VOTING);
      expect(state.votesTotal).toBe(4);
      expect(state.votesRecorded).toBe(1);
    });

    it('a SETUP dropout re-arms the ready gate; last ready player starts the night', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      for (const id of ['p1', 'p2', 'p3', 'p4']) {
        expect(service.ready(room, id)).not.toBeNull();
      }
      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.SETUP);

      const dropped = room.players.find((p) => p.socketId === 'p5')!;
      dropped.connected = false;
      service.handlePlayerDisconnect(room, 'p5');
      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.NIGHT);
    });
  });

  describe('special mice DLC', () => {
    function enableDlc() {
      (room.config as { cheeseThiefDlc?: boolean }).cheeseThiefDlc = true;
    }
    const specialOf = (id: string) =>
      privateState.get<CheeseThiefSpecial>(room.code, id, 'ctSpecial');

    it('is disabled by default: no specials dealt', () => {
      service.startRound(room, 'p1');
      expect(PLAYER_IDS.map(specialOf).filter(Boolean)).toHaveLength(0);
    });

    it('deals exactly one special at 5 players, never to the thief', () => {
      enableDlc();
      service.startRound(room, 'p1');
      const thief = thiefId();
      const specials = PLAYER_IDS.map((id) => ({ id, special: specialOf(id) })).filter(
        (s) => s.special,
      );
      expect(specials).toHaveLength(1);
      expect(specials[0].id).not.toBe(thief);
      // The special is a plain mouse at deal time.
      expect(privateState.get<CheeseThiefRole>(room.code, specials[0].id, 'ctRole')).toBe(
        CheeseThiefRole.MOUSE,
      );
    });

    it('deals two specials at 6 players, and TWINS always comes as a pair', () => {
      enableDlc();
      const big = createRoom(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
      (big.config as { cheeseThiefDlc?: boolean }).cheeseThiefDlc = true;
      const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      expect(service.startRound(big, 'p1')).not.toBeNull();
      const specials = ids
        .map((id) => ({ id, special: privateState.get(big.code, id, 'ctSpecial') }))
        .filter((s) => s.special);

      // Two distinct special TYPES are dealt. TWINS is one type but lands on
      // two players, so the head-count depends on whether twins came up.
      const types = new Set(specials.map((s) => s.special));
      expect(types.size).toBe(2);
      expect(specials.length).toBe(types.has(CheeseThiefSpecial.TWINS) ? 3 : 2);

      // If TWINS was among them, exactly two players share it with partners set.
      const twins = specials.filter((s) => s.special === CheeseThiefSpecial.TWINS);
      if (twins.length > 0) {
        expect(twins).toHaveLength(2);
        const [a, b] = twins;
        const nameOf = (id: string) => big.players.find((p) => p.socketId === id)!.name;
        expect(privateState.get(big.code, a.id, 'ctTwinPartner')).toBe(nameOf(b.id));
        expect(privateState.get(big.code, b.id, 'ctTwinPartner')).toBe(nameOf(a.id));
      }
    });

    it("the Detective's solo-wake peek reveals the target's role instead of just a die", () => {
      enableDlc();
      service.startRound(room, 'p1');
      rigGame({ p1: 6, p2: 1, p3: 2, p4: 2, p5: 2 }, 'p1');
      privateState.set(room.code, 'p2', 'ctSpecial', CheeseThiefSpecial.DETECTIVE);
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      tick(); // p2 solo wake at hour 1

      expect(service.peek(room, 'p2', 'p1')!).not.toBeNull();
      const result = privateState.get<{ targetName: string; role?: CheeseThiefRole }>(
        room.code,
        'p2',
        'ctPeekResult',
      )!;
      // p1 is the thief — the detective gets the jackpot answer.
      expect(result.role).toBe(CheeseThiefRole.THIEF);

      // A plain mouse's peek stays die-only — fresh room, fresh round.
      // Random DLC dealing may hand any special to p2, so pin a non-detective
      // one to keep this branch deterministic.
      room = createRoom(PLAYER_IDS);
      enableDlc();
      service.startRound(room, 'p1');
      rigGame({ p1: 6, p2: 1, p3: 2, p4: 2, p5: 2 }, 'p1');
      privateState.set(room.code, 'p2', 'ctSpecial', CheeseThiefSpecial.SYCOPHANT);
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      tick();
      const plain = service.peek(room, 'p2', 'p1')!;
      expect(plain).not.toBeNull();
      expect(
        privateState.get<{ role?: CheeseThiefRole }>(room.code, 'p2', 'ctPeekResult')?.role,
      ).toBeUndefined();
    });

    it('the Scapegoat wins alone when the vote lands on them', () => {
      enableDlc();
      service.startRound(room, 'p1');
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      privateState.set(room.code, 'p3', 'ctSpecial', CheeseThiefSpecial.SCAPEGOAT);
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      for (let i = 0; i < 8 && room.cheeseThiefState!.phase === CheeseThiefPhase.NIGHT; i++) {
        tick();
      }
      service.startVote(room, 'p1');
      // The whole table piles on the goat — exactly what the goat wanted.
      service.vote(room, 'p1', 'p3');
      service.vote(room, 'p2', 'p3');
      service.vote(room, 'p3', 'p1');
      service.vote(room, 'p4', 'p3');
      service.vote(room, 'p5', 'p3');

      const state = room.cheeseThiefState!;
      expect(state.winner).toBe('SCAPEGOAT');
      expect(state.caughtId).toBe('p3');
      // The goat scores +3 alone; even the thief scores nothing.
      expect(room.players.find((p) => p.socketId === 'p3')!.score).toBe(3);
      expect(room.players.find((p) => p.socketId === 'p1')!.score).toBe(0);
      expect(room.players.find((p) => p.socketId === 'p2')!.score).toBe(0);
    });

    it('the Scapegoat loses on a tie or when someone else is caught', () => {
      enableDlc();
      service.startRound(room, 'p1');
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      privateState.set(room.code, 'p3', 'ctSpecial', CheeseThiefSpecial.SCAPEGOAT);
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      for (let i = 0; i < 8 && room.cheeseThiefState!.phase === CheeseThiefPhase.NIGHT; i++) {
        tick();
      }
      service.startVote(room, 'p1');
      // 2 vs 2 tie → no one caught → goat does not win.
      service.vote(room, 'p1', 'p2');
      service.vote(room, 'p2', 'p3');
      service.vote(room, 'p3', 'p2');
      service.vote(room, 'p4', 'p3');
      service.vote(room, 'p5', 'p1');
      expect(room.cheeseThiefState!.winner).toBe('THIEF');
      expect(room.players.find((p) => p.socketId === 'p3')!.score).toBe(0);
    });

    it('the Scapegoat wakes with the thief, sees them, but is never converted', () => {
      enableDlc();
      service.startRound(room, 'p1');
      rigGame({ p1: 1, p2: 1, p3: 3, p4: 4, p5: 5 }, 'p1');
      privateState.set(room.code, 'p2', 'ctSpecial', CheeseThiefSpecial.SCAPEGOAT);
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      tick(); // hour 1: thief p1 + goat p2 co-wake

      // Thief still learns they were seen...
      expect(privateState.get<string[]>(room.code, 'p1', 'ctWitnesses')).toContain('P2');
      // ...but the goat stays a mouse and only gets the intel.
      expect(privateState.get<CheeseThiefRole>(room.code, 'p2', 'ctRole')).toBe(
        CheeseThiefRole.MOUSE,
      );
      expect(privateState.get<string>(room.code, 'p2', 'ctSeesThief')).toBe('P1');
      expect(followerIds()).toEqual([]);
    });

    it('the Sycophant escapes with the thief when the vote misses', () => {
      enableDlc();
      service.startRound(room, 'p1');
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      privateState.set(room.code, 'p3', 'ctSpecial', CheeseThiefSpecial.SYCOPHANT);
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      for (let i = 0; i < 8 && room.cheeseThiefState!.phase === CheeseThiefPhase.NIGHT; i++) {
        tick();
      }
      service.startVote(room, 'p1');
      // Everyone piles on the innocent p2 → thief + sycophant escape.
      service.vote(room, 'p1', 'p2');
      service.vote(room, 'p2', 'p1');
      service.vote(room, 'p3', 'p2');
      service.vote(room, 'p4', 'p2');
      service.vote(room, 'p5', 'p2');

      const state = room.cheeseThiefState!;
      expect(state.winner).toBe('THIEF');
      expect(room.players.find((p) => p.socketId === 'p1')!.score).toBe(3);
      expect(room.players.find((p) => p.socketId === 'p3')!.score).toBe(2); // sycophant bonus
      // Specials are revealed publicly at RESULT.
      expect(state.specials?.['p3']).toBe(CheeseThiefSpecial.SYCOPHANT);
    });
  });

  describe('result reveal', () => {
    it("finalizes with every participant's real die face", () => {
      runNight({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      service.startVote(room, 'p1');
      service.vote(room, 'p2', 'p1');
      service.vote(room, 'p3', 'p1');
      service.vote(room, 'p4', 'p1');
      service.vote(room, 'p5', 'p2');
      service.vote(room, 'p1', 'p2');

      const dice = room.cheeseThiefState!.dice!;
      expect(dice).toEqual({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 });
    });
  });

  describe('HOST-narrator mode', () => {
    it('does not auto-advance: the host paces each hour manually', () => {
      room.config.cheeseThiefNarrator = 'HOST';
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();

      const state = room.cheeseThiefState!;
      expect(state.phase).toBe(CheeseThiefPhase.NIGHT);
      expect(state.clock).toBe(0);
      expect(state.tickEndsAt).toBeNull(); // no auto-timer

      // Host advances hour by hour.
      expect(service.nextHour(room, 'p1')!.cheeseThiefState!.clock).toBe(1);
      expect(service.nextHour(room, 'p1')!.cheeseThiefState!.tickEndsAt).toBeNull();

      // Non-hosts cannot pace the night.
      expect(service.nextHour(room, 'p2')).toBeNull();
      expect(room.cheeseThiefState!.clock).toBe(2);
    });

    it('AUTO mode still arms the auto-timer on every hour', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      expect(room.cheeseThiefState!.tickEndsAt).not.toBeNull();
    });

    it('the night-end grace window still closes by itself in HOST mode', () => {
      room.config.cheeseThiefNarrator = 'HOST';
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 6 }, 'p1');
      for (const id of PLAYER_IDS) expect(service.ready(room, id)).not.toBeNull();
      for (let i = 0; i < CHEESE_THIEF_CLOCK_HOURS; i++) {
        expect(service.nextHour(room, 'p1')).not.toBeNull();
      }
      // p5's hour-6 peek is pending → grace armed with a deadline.
      expect(room.cheeseThiefState!.nightGrace).toBe(true);
      expect(room.cheeseThiefState!.tickEndsAt).not.toBeNull();
      // The scheduled timer (or the host) closes it out.
      expect(service.tick(room)!.cheeseThiefState!.phase).toBe(CheeseThiefPhase.DISCUSSION);
    });
  });

  describe('CHOOSE_FOLLOWER phase', () => {
    it('enters CHOOSE_FOLLOWER when followerCount > 0 and everyone is ready', () => {
      room.config.cheeseThiefFollowerCount = 1;
      expect(service.startRound(room, 'p1')).not.toBeNull();
      for (const id of PLAYER_IDS) {
        expect(service.ready(room, id)).not.toBeNull();
      }
      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.CHOOSE_FOLLOWER);
    });

    it('thief can pick a follower and transitions to NIGHT upon meeting quota', () => {
      room.config.cheeseThiefFollowerCount = 1;
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      for (const id of PLAYER_IDS) service.ready(room, id);

      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.CHOOSE_FOLLOWER);

      // Non-thief picking returns null
      expect(service.chooseFollower(room, 'p2', 'p3')).toBeNull();

      // Thief picking self returns null
      expect(service.chooseFollower(room, 'p1', 'p1')).toBeNull();

      // Thief picks p2
      const updated = service.chooseFollower(room, 'p1', 'p2');
      expect(updated).not.toBeNull();
      expect(privateState.get<CheeseThiefRole>(room.code, 'p2', 'ctRole')).toBe(
        CheeseThiefRole.FOLLOWER,
      );
      expect(privateState.get<string>(room.code, 'p2', 'ctSeesThief')).toBe('P1');
      expect(followerIds()).toContain('p2');
      // Quota of 1 met -> transitioned to NIGHT
      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.NIGHT);
    });

    it('cannot pick a Scapegoat as follower', () => {
      room.config.cheeseThiefFollowerCount = 1;
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      privateState.set(room.code, 'p3', 'ctSpecial', CheeseThiefSpecial.SCAPEGOAT);
      for (const id of PLAYER_IDS) service.ready(room, id);

      // Thief tries to pick Scapegoat p3 -> rejected
      expect(service.chooseFollower(room, 'p1', 'p3')).toBeNull();
    });

    it('chooseFollowerTimeout auto-selects follower and advances to NIGHT', () => {
      room.config.cheeseThiefFollowerCount = 1;
      expect(service.startRound(room, 'p1')).not.toBeNull();
      rigGame({ p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 }, 'p1');
      for (const id of PLAYER_IDS) service.ready(room, id);

      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.CHOOSE_FOLLOWER);
      const afterTimeout = service.chooseFollowerTimeout(room);
      expect(afterTimeout).not.toBeNull();
      expect(followerIds().length).toBe(1);
      expect(room.cheeseThiefState!.phase).toBe(CheeseThiefPhase.NIGHT);
    });
  });

  describe('custom selected specials', () => {
    it('assigns specific roles configured in cheeseThiefSelectedSpecials', () => {
      const big = createRoom(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
      big.config.cheeseThiefSelectedSpecials = [
        CheeseThiefSpecial.DETECTIVE,
        CheeseThiefSpecial.TWINS,
      ];
      expect(service.startRound(big, 'p1')).not.toBeNull();

      const specials = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
        .map((id) => ({
          id,
          special: privateState.get<CheeseThiefSpecial>(big.code, id, 'ctSpecial'),
        }))
        .filter((s) => s.special);

      const detectives = specials.filter((s) => s.special === CheeseThiefSpecial.DETECTIVE);
      const twins = specials.filter((s) => s.special === CheeseThiefSpecial.TWINS);

      expect(detectives).toHaveLength(1);
      expect(twins).toHaveLength(2);
    });
  });

  describe('getCheeseThiefRequiredPlayerCount calculation', () => {
    it('calculates correct min players and breakdown', () => {
      const basic = getCheeseThiefRequiredPlayerCount({
        cheeseThiefFollowerCount: 1,
        cheeseThiefSelectedSpecials: [],
      });
      // 1 Thief + 1 Follower + 2 Innocent Mice = 4
      expect(basic.min).toBe(4);

      const withSpecials = getCheeseThiefRequiredPlayerCount({
        cheeseThiefFollowerCount: 1,
        cheeseThiefSelectedSpecials: [CheeseThiefSpecial.DETECTIVE, CheeseThiefSpecial.TWINS],
      });
      // 1 Thief + 1 Follower + 1 Detective + 2 Twins + 2 Plain Mice = 7
      expect(withSpecials.min).toBe(7);
      expect(withSpecials.followerCount).toBe(1);
      expect(withSpecials.specialsCount).toBe(3);
      expect(withSpecials.plainMiceCount).toBe(2);
    });
  });

  describe('reset', () => {
    it('host reset returns the room to the lobby and wipes secrets', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      const reset = service.reset(room, 'p1')!;
      expect(reset.status).toBe(RoomStatus.LOBBY);
      expect(reset.cheeseThiefState).toBeUndefined();
      for (const p of reset.players) expect(p.score).toBe(0);
      expect(JSON.stringify(privateState.getSocketData(room.code, 'p1'))).not.toContain('ctRole');
    });

    it('non-host cannot reset', () => {
      expect(service.startRound(room, 'p1')).not.toBeNull();
      expect(service.reset(room, 'p2')).toBeNull();
    });
  });
});
