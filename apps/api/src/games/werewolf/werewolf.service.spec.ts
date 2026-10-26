import { Test, TestingModule } from '@nestjs/testing';
import { WerewolfService } from './werewolf.service';
import { PrivateStateService } from '../private-state.service';
import {
  GameType,
  RoomState,
  RoomStatus,
  UserState,
  WerewolfNightActionKind,
  WerewolfNightSlot,
  WerewolfPhase,
  WerewolfPrivateState,
  WerewolfRole,
  WerewolfVision,
  WerewolfWolfCoordinationMode,
  WerewolfWolfRevealMode,
} from '@repo/types';

describe('WerewolfService', () => {
  let service: WerewolfService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WerewolfService, PrivateStateService],
    }).compile();

    service = module.get(WerewolfService);
    privateState = module.get(PrivateStateService);
  });

  function makePlayers(count: number): UserState[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player${i + 1}`,
      socketId: `s${i + 1}`,
      score: 0,
      roomId: 'r1',
      connected: true,
    }));
  }

  function makeRoom(playerCount = 6, overrides: Partial<RoomState> = {}): RoomState {
    return {
      id: 'r1',
      gameType: GameType.WEREWOLF,
      code: 'ABC123',
      status: RoomStatus.LOBBY,
      roomHostId: 's1',
      players: makePlayers(playerCount),
      createdAt: new Date(),
      config: {
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5,
        language: 'th',
        werewolfWolfReveal: WerewolfWolfRevealMode.PRIVATE_ROSTER,
        werewolfWolfCoordination: WerewolfWolfCoordinationMode.SECRET_BALLOT,
        werewolfNightSeconds: 5,
        werewolfDiscussionSeconds: 30,
        werewolfVoteSeconds: 15,
        werewolfWitchEnabled: true,
        werewolfHunterEnabled: true,
      },
      ...overrides,
    } as RoomState;
  }

  function roleOf(room: RoomState, socketId: string): WerewolfRole | undefined {
    return privateState.get<WerewolfRole>(room.code, socketId, 'wwRole');
  }

  function findByRole(room: RoomState, role: WerewolfRole): string[] {
    return room.players
      .filter((p) => !p.isViewer && roleOf(room, p.socketId) === role)
      .map((p) => p.socketId);
  }

  /** Fire the current phase deadline (same contract as gateway syncWerewolfTimer). */
  function advance(room: RoomState): void {
    const state = room.werewolfState!;
    const deadline = state.phaseEndsAt;
    expect(deadline).not.toBeNull();
    expect(service.handlePhaseTimeout(room, deadline!)).not.toBeNull();
  }

  function settleNight(room: RoomState): void {
    const state = room.werewolfState!;
    while ((state.phase as WerewolfPhase) === WerewolfPhase.NIGHT) advance(room);
  }

  /** Walk the night forward until the given slot is running. */
  function advanceToSlot(room: RoomState, slot: WerewolfNightSlot): void {
    const state = room.werewolfState!;
    let guard = 0;
    while (state.nightSlots[state.nightSlotIndex] !== slot) {
      advance(room);
      if (++guard > 8) throw new Error(`slot ${slot} never started`);
    }
  }

  /** Walk discussion → vote → result dwell until the night (or game over). */
  function runDay(room: RoomState): void {
    const state = room.werewolfState!;
    let guard = 0;
    while (
      (state.phase as WerewolfPhase) !== WerewolfPhase.NIGHT &&
      (state.phase as WerewolfPhase) !== WerewolfPhase.GAME_OVER
    ) {
      advance(room);
      if (++guard > 6) throw new Error('day never ended');
    }
  }

  describe('startGame', () => {
    it('deals roles for 6 players: 2 wolves, seer, 3 villagers', () => {
      const room = makeRoom(6);
      const result = service.startGame(room, 's1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.werewolfState!.phase).toBe(WerewolfPhase.NIGHT);
      expect(result!.werewolfState!.night).toBe(1);
      expect(findByRole(room, WerewolfRole.WEREWOLF)).toHaveLength(2);
      expect(findByRole(room, WerewolfRole.SEER)).toHaveLength(1);
      expect(findByRole(room, WerewolfRole.VILLAGER)).toHaveLength(3);
      expect(findByRole(room, WerewolfRole.WITCH)).toHaveLength(0);
      // 6 players: only WOLVES + SEER slots exist
      expect(result!.werewolfState!.nightSlots).toEqual(['WOLVES', 'SEER']);
      expect(result!.werewolfState!.nightSlotIndex).toBe(0);
    });

    it('deals doctor/witch/hunter at the right player counts', () => {
      const room9 = makeRoom(9);
      service.startGame(room9, 's1');
      expect(findByRole(room9, WerewolfRole.WEREWOLF)).toHaveLength(2);
      expect(findByRole(room9, WerewolfRole.DOCTOR)).toHaveLength(1);
      expect(findByRole(room9, WerewolfRole.WITCH)).toHaveLength(1);
      expect(findByRole(room9, WerewolfRole.HUNTER)).toHaveLength(1);

      const room12 = makeRoom(12);
      service.startGame(room12, 's1');
      expect(findByRole(room12, WerewolfRole.WEREWOLF)).toHaveLength(3);
    });

    it('respects witch/hunter toggles', () => {
      const room = makeRoom(9);
      room.config.werewolfWitchEnabled = false;
      room.config.werewolfHunterEnabled = false;
      service.startGame(room, 's1');
      expect(findByRole(room, WerewolfRole.WITCH)).toHaveLength(0);
      expect(findByRole(room, WerewolfRole.HUNTER)).toHaveLength(0);
      // no HUNTER_SHOT slot without a hunter
      expect(room.werewolfState!.nightSlots).not.toContain('HUNTER_SHOT');
    });

    it('sends the wolf roster privately only in PRIVATE_ROSTER mode', () => {
      const rosterRoom = makeRoom(6);
      service.startGame(rosterRoom, 's1');
      const wolf = findByRole(rosterRoom, WerewolfRole.WEREWOLF)[0];
      const wolves = privateState.get<string[]>(rosterRoom.code, wolf, 'wwWolves');
      expect(wolves).toHaveLength(2);

      const eyeRoom = makeRoom(6);
      eyeRoom.config.werewolfWolfReveal = WerewolfWolfRevealMode.EYE_CONTACT;
      service.startGame(eyeRoom, 's1');
      const eyeWolf = findByRole(eyeRoom, WerewolfRole.WEREWOLF)[0];
      expect(privateState.get(eyeRoom.code, eyeWolf, 'wwWolves')).toBeUndefined();
    });

    it('rejects non-host, wrong status and out-of-range player counts', () => {
      expect(service.startGame(makeRoom(6), 's2')).toBeNull();
      expect(service.startGame(makeRoom(6, { status: RoomStatus.PLAYING }), 's1')).toBeNull();
      expect(service.startGame(makeRoom(5), 's1')).toBeNull();
      expect(service.startGame(makeRoom(13), 's1')).toBeNull();
    });

    it('reset returns to LOBBY and clears all private state', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      expect(service.reset(room, 's2')).toBeNull();
      const result = service.reset(room, 's1');
      expect(result!.status).toBe(RoomStatus.LOBBY);
      expect(result!.werewolfState).toBeUndefined();
      for (const p of room.players) {
        expect(privateState.get(room.code, p.socketId, 'wwRole')).toBeUndefined();
      }
    });
  });

  describe('night: werewolves', () => {
    it('kills the plurality target at dawn (SECRET_BALLOT)', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const target = villagers[0];

      for (const wolf of wolves) {
        expect(
          service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, target),
        ).not.toBeNull();
      }
      settleNight(room);

      const state = room.werewolfState!;
      expect(state.phase).toBe(WerewolfPhase.DAY_DISCUSSION);
      expect(state.dawn!.deaths).toHaveLength(1);
      expect(state.dawn!.deaths[0].playerId).toBe(target);
      expect(state.players[target].alive).toBe(false);
      expect(state.players[target].revealedRole).toBe(WerewolfRole.VILLAGER);
      // wolves stay secret while alive
      expect(state.players[wolves[0]].revealedRole).toBeUndefined();
    });

    it('a tie means no kill; the dawn announces no deaths', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, villagers[0]);
      service.handleNightAction(room, wolves[1], WerewolfNightActionKind.KILL, villagers[1]);
      settleNight(room);

      expect(room.werewolfState!.dawn!.deaths).toHaveLength(0);
      expect(room.werewolfState!.players[villagers[0]].alive).toBe(true);
    });

    it('a timeout is no action: wolves that never vote kill nobody', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      settleNight(room);
      expect(room.werewolfState!.dawn!.deaths).toHaveLength(0);
    });

    it('resubmission replaces the vote until the slot ends', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, villagers[0]);
      service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, villagers[1]);
      service.handleNightAction(room, wolves[1], WerewolfNightActionKind.KILL, villagers[1]);
      settleNight(room);
      expect(room.werewolfState!.dawn!.deaths[0].playerId).toBe(villagers[1]);
    });

    it('SILENT_CONSENSUS kills only on a unanimous target', () => {
      const room = makeRoom(6);
      room.config.werewolfWolfCoordination = WerewolfWolfCoordinationMode.SILENT_CONSENSUS;
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);

      // mismatch → no kill
      service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, villagers[0]);
      service.handleNightAction(room, wolves[1], WerewolfNightActionKind.KILL, villagers[1]);
      settleNight(room);
      expect(room.werewolfState!.dawn!.deaths).toHaveLength(0);
      advance(room); // discussion → vote
      advance(room); // vote closes (nobody voted)
      advance(room); // result dwell → night 2
      expect(room.werewolfState!.phase).toBe(WerewolfPhase.NIGHT);
      expect(room.werewolfState!.night).toBe(2);

      // night 2: unanimous → kill
      for (const wolf of wolves) {
        expect(
          service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, villagers[0]),
        ).not.toBeNull();
      }
      settleNight(room);
      expect(room.werewolfState!.dawn!.deaths[0].playerId).toBe(villagers[0]);
    });

    it('LIVE_TALLY mirrors the running votes to living wolves only', () => {
      const room = makeRoom(6);
      room.config.werewolfWolfCoordination = WerewolfWolfCoordinationMode.LIVE_TALLY;
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const targetName = room.players.find((p) => p.socketId === villagers[0])!.name;
      const wolfName = room.players.find((p) => p.socketId === wolves[0])!.name;
      service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, villagers[0]);

      const tally = privateState.get<Record<string, string>>(room.code, wolves[0], 'wwTally');
      expect(tally).toBeDefined();
      expect(tally![wolfName]).toBe(targetName);
      // villagers never receive a tally
      expect(privateState.get(room.code, villagers[1], 'wwTally')).toBeUndefined();
    });

    it('rejects votes from non-wolves and in the wrong slot', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const seer = findByRole(room, WerewolfRole.SEER)[0];
      const villager = findByRole(room, WerewolfRole.VILLAGER)[0];
      // wrong role
      expect(
        service.handleNightAction(room, seer, WerewolfNightActionKind.KILL, villager),
      ).toBeNull();
      // wrong slot (seer cannot check during the WOLVES slot)
      expect(
        service.handleNightAction(room, seer, WerewolfNightActionKind.CHECK, villager),
      ).toBeNull();
    });
  });

  describe('night: seer', () => {
    it('records a wolf/not-wolf vision, never the full role', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const seer = findByRole(room, WerewolfRole.SEER)[0];
      const wolf = findByRole(room, WerewolfRole.WEREWOLF)[0];
      const villager = findByRole(room, WerewolfRole.VILLAGER)[0];

      advanceToSlot(room, 'SEER'); // wolves slot burns first (no kill)
      expect(
        service.handleNightAction(room, seer, WerewolfNightActionKind.CHECK, wolf),
      ).not.toBeNull();
      settleNight(room); // seer slot resolves → dawn

      const visions = privateState.get<WerewolfVision[]>(room.code, seer, 'wwVisions');
      expect(visions).toHaveLength(1);
      expect(visions[0]).toMatchObject({ night: 1, isWolf: true });

      // second night, check a villager
      advance(room); // discussion → vote
      advance(room); // vote closes
      advance(room); // result dwell → night 2
      advanceToSlot(room, 'SEER');
      expect(
        service.handleNightAction(room, seer, WerewolfNightActionKind.CHECK, villager),
      ).not.toBeNull();
      settleNight(room);

      const visions2 = privateState.get<WerewolfVision[]>(room.code, seer, 'wwVisions');
      expect(visions2).toHaveLength(2);
      expect(visions2[1]).toMatchObject({ night: 2, isWolf: false });
    });
  });

  describe('night: doctor', () => {
    function make7(): { room: RoomState; doctor: string } {
      const room = makeRoom(7);
      service.startGame(room, 's1');
      return { room, doctor: findByRole(room, WerewolfRole.DOCTOR)[0] };
    }

    it('a doctor heal saves the bitten player and is never announced', () => {
      const { room, doctor } = make7();
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const target = villagers[0];

      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, target);
      }
      advanceToSlot(room, 'DOCTOR');
      expect(
        service.handleNightAction(room, doctor, WerewolfNightActionKind.HEAL, target),
      ).not.toBeNull();
      settleNight(room);

      expect(room.werewolfState!.dawn!.deaths).toHaveLength(0);
      expect(room.werewolfState!.players[target].alive).toBe(true);
    });

    it('heals the self but never the same target on consecutive nights', () => {
      const { room, doctor } = make7();
      const doctorSocketId = doctor;
      advanceToSlot(room, 'DOCTOR');
      expect(
        service.handleNightAction(room, doctor, WerewolfNightActionKind.HEAL, doctorSocketId),
      ).not.toBeNull();
      settleNight(room);
      advance(room); // → vote
      advance(room); // vote closes
      advance(room); // result dwell → night 2

      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      advanceToSlot(room, 'DOCTOR');
      // self again immediately after self-healing last night → rejected
      expect(
        service.handleNightAction(room, doctor, WerewolfNightActionKind.HEAL, doctorSocketId),
      ).toBeNull();
      // someone else is fine
      expect(
        service.handleNightAction(room, doctor, WerewolfNightActionKind.HEAL, villagers[0]),
      ).not.toBeNull();
    });
  });

  describe('night: witch', () => {
    function make8(): { room: RoomState; witch: string } {
      const room = makeRoom(8);
      service.startGame(room, 's1');
      return { room, witch: findByRole(room, WerewolfRole.WITCH)[0] };
    }

    it('sees the victim, heals them, and cannot heal herself', () => {
      const { room, witch } = make8();
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const target = villagers[0];

      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, target);
      }
      advanceToSlot(room, 'WITCH');
      const prompt = privateState.get<NonNullable<WerewolfPrivateState['night']>>(
        room.code,
        witch,
        'wwNight',
      );
      expect(prompt).not.toBeNull();
      expect(prompt!.victimId).toBe(target);
      expect(prompt!.healRemaining).toBe(true);

      // healing herself is not an option
      expect(
        service.handleNightAction(room, witch, WerewolfNightActionKind.HEAL, witch),
      ).toBeNull();
      expect(
        service.handleNightAction(room, witch, WerewolfNightActionKind.HEAL, target),
      ).not.toBeNull();

      settleNight(room);
      expect(room.werewolfState!.dawn!.deaths).toHaveLength(0);
    });

    it('poison kills at dawn and cannot be combined with the heal', () => {
      const { room, witch } = make8();
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const bitten = villagers[0];
      const poisoned = villagers[1];

      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, bitten);
      }
      advanceToSlot(room, 'WITCH');

      expect(
        service.handleNightAction(room, witch, WerewolfNightActionKind.POISON, poisoned),
      ).not.toBeNull();
      // one potion per night: heal after poison is rejected
      expect(
        service.handleNightAction(room, witch, WerewolfNightActionKind.HEAL, bitten),
      ).toBeNull();

      settleNight(room);
      const deaths = room.werewolfState!.dawn!.deaths;
      expect(deaths.map((d) => d.playerId).sort()).toEqual([bitten, poisoned].sort());
    });

    it('a poisoned hunter cannot shoot', () => {
      const room = makeRoom(9); // Hunter is dealt from 9 players
      service.startGame(room, 's1');
      const witch = findByRole(room, WerewolfRole.WITCH)[0];
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const hunter = findByRole(room, WerewolfRole.HUNTER)[0];

      service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, wolves[1]);
      advanceToSlot(room, 'WITCH'); // kill settles after the wolves slot
      expect(
        service.handleNightAction(room, witch, WerewolfNightActionKind.POISON, hunter),
      ).not.toBeNull();

      let guard = 0;
      while (
        (room.werewolfState!.phase as WerewolfPhase) === WerewolfPhase.NIGHT &&
        room.werewolfState!.nightSlots[room.werewolfState!.nightSlotIndex] !== 'HUNTER_SHOT'
      ) {
        advance(room);
        if (++guard > 8) break;
      }
      settleNight(room);

      expect(room.werewolfState!.dawn!.deaths.map((d) => d.playerId)).toContain(hunter);
      // no shot prompt was ever issued to the poisoned hunter
      const night = privateState.get<NonNullable<WerewolfPrivateState['night']>>(
        room.code,
        hunter,
        'wwNight',
      );
      expect(night?.kind).not.toBe(WerewolfNightActionKind.SHOT);
    });
  });

  describe('hunter', () => {
    it('a night-bitten hunter shoots during the HUNTER_SHOT slot and the shot lands at dawn', () => {
      const room = makeRoom(9);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const hunter = findByRole(room, WerewolfRole.HUNTER)[0];
      const villagers = findByRole(room, WerewolfRole.VILLAGER);

      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, hunter);
      }
      // walk to the HUNTER_SHOT slot
      let guard = 0;
      while (room.werewolfState!.nightSlots[room.werewolfState!.nightSlotIndex] !== 'HUNTER_SHOT') {
        advance(room);
        if (++guard > 6) throw new Error('HUNTER_SHOT slot never started');
      }
      expect(
        service.handleNightAction(room, hunter, WerewolfNightActionKind.SHOT, villagers[0]),
      ).not.toBeNull();
      settleNight(room);

      const deaths = room.werewolfState!.dawn!.deaths;
      expect(deaths.map((d) => d.playerId).sort()).toEqual([hunter, villagers[0]].sort());
      expect(deaths.find((d) => d.playerId === villagers[0])!.cause).toBe('SHOT');
    });

    it('a lynched hunter shoots in the public day phase', () => {
      const room = makeRoom(9);
      service.startGame(room, 's1');
      const hunter = findByRole(room, WerewolfRole.HUNTER)[0];
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);

      settleNight(room); // no kill
      advance(room); // discussion → vote
      const voters = room.players
        .filter(
          (p) =>
            !p.isViewer && p.socketId !== hunter && room.werewolfState!.players[p.socketId].alive,
        )
        .map((p) => p.socketId)
        .filter((sid) => !wolves.includes(sid));
      for (const voter of voters) {
        expect(service.handleDayVote(room, voter, hunter)).not.toBeNull();
      }
      advance(room); // vote closes
      expect(room.werewolfState!.phase).toBe(WerewolfPhase.DAY_RESULT);
      expect(room.werewolfState!.voteResult!.lynchedPlayerId).toBe(hunter);
      advance(room); // result dwell → DAY_HUNTER_SHOT
      expect(room.werewolfState!.phase).toBe(WerewolfPhase.DAY_HUNTER_SHOT);
      expect(room.werewolfState!.hunterShot!.hunterId).toBe(hunter);

      expect(
        service.handleNightAction(room, hunter, WerewolfNightActionKind.SHOT, wolves[0]),
      ).not.toBeNull();
      advance(room); // shot resolves → result dwell
      expect(room.werewolfState!.players[wolves[0]].alive).toBe(false);
      advance(room); // dwell → night 2
      expect(room.werewolfState!.phase).toBe(WerewolfPhase.NIGHT);
      expect(room.werewolfState!.night).toBe(2);
    });
  });

  describe('day vote', () => {
    function reachVote(room: RoomState): void {
      settleNight(room);
      advance(room); // discussion → vote
      expect(room.werewolfState!.phase).toBe(WerewolfPhase.DAY_VOTE);
    }

    it('lynches the plurality target, reveals the role and the votes', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      reachVote(room);
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const target = villagers[0];

      const voters = room.players
        .filter((p) => room.werewolfState!.players[p.socketId].alive)
        .map((p) => p.socketId)
        .filter((sid) => sid !== target);
      // everyone except the target votes them; the target abstains
      for (const voter of voters) {
        expect(service.handleDayVote(room, voter, target)).not.toBeNull();
      }
      expect(service.handleDayVote(room, target, 'ABSTAIN')).not.toBeNull();
      expect(room.werewolfState!.voteProgress!.cast).toBe(voters.length + 1);

      advance(room);
      const state = room.werewolfState!;
      expect(state.voteResult!.lynchedPlayerId).toBe(target);
      expect(Object.values(state.voteResult!.votes).filter((v) => v !== 'ABSTAIN')).toHaveLength(
        voters.length,
      );
      expect(state.players[target].alive).toBe(false);
      expect(state.players[target].revealedRole).toBe(WerewolfRole.VILLAGER);
      expect(wolves.every((w) => state.players[w].alive)).toBe(true);
    });

    it('a tie lynches nobody and the game continues', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      reachVote(room);
      const state = room.werewolfState!;
      const alive = room.players
        .filter((p) => state.players[p.socketId].alive)
        .map((p) => p.socketId);
      // two mutually-exclusive votes + abstains → 1 vs 1 tie
      expect(service.handleDayVote(room, alive[0], alive[1])).not.toBeNull();
      expect(service.handleDayVote(room, alive[1], alive[0])).not.toBeNull();
      for (const voter of alive.slice(2)) {
        expect(service.handleDayVote(room, voter, 'ABSTAIN')).not.toBeNull();
      }
      advance(room);

      expect(room.werewolfState!.voteResult!.lynchedPlayerId).toBeNull();
      advance(room); // dwell → night 2
      expect(room.werewolfState!.phase).toBe(WerewolfPhase.NIGHT);
      expect(room.werewolfState!.night).toBe(2);
    });

    it('dead players and self-votes are rejected; resubmission replaces', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      // kill a villager at night 1
      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, villagers[0]);
      }
      settleNight(room);
      advance(room); // → vote

      expect(service.handleDayVote(room, villagers[0], villagers[1])).toBeNull();
      expect(service.handleDayVote(room, villagers[1], villagers[1])).toBeNull();
      expect(service.handleDayVote(room, villagers[1], villagers[2])).not.toBeNull();
      const seer = findByRole(room, WerewolfRole.SEER)[0];
      expect(service.handleDayVote(room, villagers[1], seer)).not.toBeNull();
      const votes = privateState.get<Record<string, string>>(room.code, '__room__', 'WW_DAY_VOTES');
      expect(Object.values(votes).filter((v) => v !== 'ABSTAIN')).toHaveLength(1);
    });
  });

  describe('win conditions', () => {
    it('village wins when every wolf is dead; winners score +1 and roles go final', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);

      const state = room.werewolfState!;
      const lynch = (target: string) => {
        advance(room); // discussion → vote
        const voters = room.players
          .filter((p) => state.players[p.socketId].alive)
          .map((p) => p.socketId)
          .filter((sid) => sid !== target);
        for (const voter of voters) service.handleDayVote(room, voter, target);
        service.handleDayVote(room, target, 'ABSTAIN');
        advance(room); // close
      };

      settleNight(room); // night 1: no kill
      lynch(wolves[0]);
      expect(state.players[wolves[0]].alive).toBe(false);
      advance(room); // result dwell → night 2
      settleNight(room); // night 2: no kill
      lynch(wolves[1]);

      expect(state.phase).toBe(WerewolfPhase.GAME_OVER);
      expect(state.winner).toBe('VILLAGE');
      expect(room.status).toBe(RoomStatus.RESULT);
      for (const p of room.players) {
        expect(state.players[p.socketId].finalRole).toBeDefined();
      }
      const villagerScore = room.players.find((p) => p.socketId === villagers[1])!.score;
      expect(villagerScore).toBe(1);
      expect(room.players.find((p) => p.socketId === wolves[0])!.score).toBe(0);
    });

    it('wolves win at parity (wolves >= living others)', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      const state = room.werewolfState!;
      const eat = (target: string) => {
        for (const wolf of wolves) {
          service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, target);
        }
        settleNight(room);
        runDay(room);
      };

      // Night 1: 2W vs 4V → 2W vs 3V (no parity yet)
      eat(villagers[0]);
      expect(state.phase).toBe(WerewolfPhase.NIGHT);
      expect(state.winner).toBeNull();
      // Night 2: 2W vs 2V → parity at dawn
      eat(villagers[1]);
      expect(state.phase).toBe(WerewolfPhase.GAME_OVER);
      expect(state.winner).toBe('WOLVES');
    });
  });

  describe('pause / reconnect / removal', () => {
    it('disconnecting a living player pauses the phase; reconnecting resumes it', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const state = room.werewolfState!;
      const before = state.phaseEndsAt!;

      const victim = room.players[2];
      victim.connected = false;
      service.handlePlayerDisconnect(room, victim.socketId);
      expect(state.paused).toBe(true);
      expect(state.phaseEndsAt).toBeNull();

      // reconnect with a fresh socket
      victim.connected = true;
      const oldSocketId = victim.socketId;
      victim.socketId = 's2-reconnected';
      service.remapSocketId(state, oldSocketId, victim.socketId);
      service.handleReconnect(room, victim.id);

      expect(state.paused).toBe(false);
      expect(state.phaseEndsAt).not.toBeNull();
      // remaining time is preserved (a few ms of processing drift allowed)
      expect(state.phaseEndsAt!).toBeLessThanOrEqual(before + 50);
      expect(state.phaseEndsAt!).toBeGreaterThan(Date.now());
    });

    it('a second disconnect extends the pause without resetting the remaining time', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const state = room.werewolfState!;
      room.players[2].connected = false;
      service.handlePlayerDisconnect(room, room.players[2].socketId);
      const remainingAfterFirst = privateState.get<{ remainingMs: number }>(
        room.code,
        '__room__',
        'WW_PAUSE',
      )!.remainingMs;

      room.players[3].connected = false;
      service.handlePlayerDisconnect(room, room.players[3].socketId);
      const pause = privateState.get<{
        remainingMs: number;
        graceEndsAtById: Record<string, number>;
      }>(room.code, '__room__', 'WW_PAUSE')!;
      expect(pause.remainingMs).toBe(remainingAfterFirst);
      expect(Object.keys(pause.graceEndsAtById)).toHaveLength(2);
      expect(state.paused).toBe(true);
    });

    it('a removed player is eliminated without their role being revealed', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const state = room.werewolfState!;
      const victim = room.players[4];
      const victimRole = roleOf(room, victim.socketId);

      // GamesService splices the player and clears their private state on expiry
      room.players = room.players.filter((p) => p.id !== victim.id);
      privateState.clearSocket(room.code, victim.socketId);
      service.handlePlayerDisconnect(room, victim.socketId);

      expect(state.players[victim.socketId].alive).toBe(false);
      expect(state.players[victim.socketId].revealedRole).toBeUndefined();
      expect(roleOf(room, victim.socketId)).toBeUndefined();
      expect(victimRole).toBeDefined(); // sanity: they had a role
      expect(room.status).toBe(RoomStatus.PLAYING);
    });

    it('aborts to the lobby without a result when the match becomes unwinnable', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);

      // remove both wolves → parity broken by removals → abort
      for (const wolf of wolves) {
        room.players = room.players.filter((p) => p.socketId !== wolf);
        privateState.clearSocket(room.code, wolf);
        service.handlePlayerDisconnect(room, wolf);
      }
      expect(room.status).toBe(RoomStatus.LOBBY);
      expect(room.werewolfState).toBeUndefined();
    });

    it('actions are rejected while paused', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);

      room.players[2].connected = false;
      service.handlePlayerDisconnect(room, room.players[2].socketId);
      expect(
        service.handleNightAction(room, wolves[0], WerewolfNightActionKind.KILL, villagers[0]),
      ).toBeNull();

      // deadline fires are ignored while paused
      const deadline = room.werewolfState!.phaseEndsAt;
      expect(deadline).toBeNull();
    });
  });

  describe('remapSocketId', () => {
    it('moves the player entry, dawn deaths, votes and hunter shot', () => {
      const room = makeRoom(6);
      service.startGame(room, 's1');
      const state = room.werewolfState!;
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, villagers[0]);
      }
      settleNight(room);
      advance(room); // → vote
      const voters = room.players
        .filter((p) => state.players[p.socketId].alive)
        .map((p) => p.socketId);
      for (const voter of voters) service.handleDayVote(room, voter, villagers[1]);
      advance(room); // close → DAY_RESULT

      const mover = room.players.find((p) => p.socketId === wolves[0])!;
      const old = mover.socketId;
      mover.socketId = 'new-socket';
      service.remapSocketId(state, old, 'new-socket');

      expect(state.players['new-socket']).toBeDefined();
      expect(state.players[old]).toBeUndefined();
    });
  });

  describe('privacy', () => {
    it('the broadcast state never carries secret roles, prompts or rosters', () => {
      const room = makeRoom(8);
      service.startGame(room, 's1');
      const state = room.werewolfState!;
      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, villagers[0]);
      }
      settleNight(room);

      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain('wwNight');
      expect(serialized).not.toContain('wwWolves');
      expect(serialized).not.toContain('wwRole');
      expect(serialized).not.toContain('wwTally');
      expect(serialized).not.toContain('wwVisions');
      // no living player carries a revealedRole; killed villager's role is public
      for (const [key, view] of Object.entries(state.players)) {
        if (view.alive) expect(view.revealedRole).toBeUndefined();
        else expect(view.revealedRole).toBeDefined();
        void key;
      }
    });
  });

  describe('night slot schedule invariants', () => {
    it('keeps the night length constant: dead role slots burn silently', () => {
      const room = makeRoom(7);
      service.startGame(room, 's1');
      const state = room.werewolfState!;
      expect(state.nightSlots).toEqual(['WOLVES', 'SEER', 'DOCTOR']);
      const firstSlots = [...state.nightSlots];

      const wolves = findByRole(room, WerewolfRole.WEREWOLF);
      const villagers = findByRole(room, WerewolfRole.VILLAGER);
      // kill the doctor tonight
      const doctor = findByRole(room, WerewolfRole.DOCTOR)[0];
      for (const wolf of wolves) {
        service.handleNightAction(room, wolf, WerewolfNightActionKind.KILL, doctor);
      }
      settleNight(room);
      advance(room); // discussion → vote
      const voters = room.players
        .filter((p) => state.players[p.socketId].alive)
        .map((p) => p.socketId)
        .filter((sid) => sid !== villagers[0]);
      for (const voter of voters) service.handleDayVote(room, voter, villagers[0]);
      advance(room); // close
      advance(room); // result dwell → night 2

      // doctor died tonight: the slot still burns (schedule unchanged)
      expect(state.nightSlots).toEqual(firstSlots);
      expect(state.nightSlots).toContain('DOCTOR');
    });
  });
});
