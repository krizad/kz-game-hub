import { Test } from '@nestjs/testing';
import { DogRelayPair, GameType, RoomState, RoomStatus } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { DogRelaySecrets, DogRelayService } from './dog-relay.service';
import { buildDogRelayResultRows } from './dog-relay-results';

describe('DogRelayService', () => {
  let service: DogRelayService;
  let privateState: PrivateStateService;
  let room: RoomState;
  let now: number;
  const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T00:00:00Z'));
    now = Date.now();
    const module = await Test.createTestingModule({
      providers: [DogRelayService, PrivateStateService],
    }).compile();
    service = module.get(DogRelayService);
    privateState = module.get(PrivateStateService);
    room = {
      id: 'room',
      code: 'ABC123',
      gameType: GameType.DOG_RELAY,
      status: RoomStatus.LOBBY,
      roomHostId: 'socket0',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1, language: 'en' },
      players: ids.map((id, i) => ({
        id,
        socketId: `socket${i}`,
        name: `Player ${i}`,
        score: 99,
        roomId: 'room',
        connected: true,
      })),
    } as RoomState;
    service.initLobby(room);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const state = () => room.dogRelayState!;
  const secrets = () =>
    privateState.get<DogRelaySecrets>(room.code, '__room__', 'dogRelaySecrets')!;
  function start(): void {
    service.startRound(room, 'p0');
  }

  it('rotates Leaders through the host-arranged seats and wraps across lobby resets', () => {
    room.config.dogRelayLeaderSelection = 'ROUND_ROBIN';
    const order = ['p2', 'p4', 'p0', 'p1', 'p3'];
    service.act(room, 'p0', { type: 'REORDER_SEATS', playerIds: order }, now);
    for (const expected of [...order, order[0]]) {
      start();
      expect(state().leaderId).toBe(expected);
      expect(secrets().roles[expected]).toBe('LEADER');
      expect(Object.values(secrets().roles).filter((role) => role === 'EVIL')).toHaveLength(1);
      service.cancelRound(room, 'HOST_RESET');
    }
  });

  it('keeps the selected mode random and recovers a rotation when the last Leader leaves', () => {
    room.config.dogRelayLeaderSelection = 'RANDOM';
    jest.spyOn(Math, 'random').mockReturnValue(0);
    start();
    expect(state().leaderId).not.toBe(ids[0]);
    const lastLeader = state().leaderId!;
    service.cancelRound(room, 'HOST_RESET');
    room.players = room.players.filter((player) => player.id !== lastLeader);
    room.players.push({
      id: 'replacement',
      socketId: 'new-socket',
      name: 'New',
      score: 0,
      roomId: room.id,
      connected: true,
    });
    service.initLobby(room);
    room.config.dogRelayLeaderSelection = 'ROUND_ROBIN';
    start();
    expect(state().leaderId).toBe(state().seatOrder[0]);
  });
  function restore(): void {
    start();
    for (const id of ids) service.act(room, id, { type: 'ACK_ROLE' }, now);
    service.act(room, state().leaderId!, { type: 'BEGIN_RELAY' }, now);
    for (let i = 0; i < ids.length - 1; i++)
      service.act(room, state().relayOrder[i + 1], { type: 'CONFIRM_HANDOFF', relayIndex: i }, now);
  }
  function guess(pair: DogRelayPair): void {
    service.act(room, state().relayOrder.at(-1)!, { type: 'SUBMIT_GUESS', pair }, now);
  }
  function discuss(): void {
    restore();
    guess({ suspectId: secrets().truePair.victimId, victimId: secrets().truePair.suspectId });
  }
  function vote(): void {
    discuss();
    service.act(room, 'p0', { type: 'END_DISCUSSION' }, now);
    now += 3000;
    expect(
      service.onPhaseDeadline(room, state().roundId!, 'VOTE_COUNTDOWN', state().phaseEndsAt!, now),
    ).toBe(true);
  }
  function unchanged(action: () => void, error: string): void {
    const before = JSON.stringify(room);
    const privateBefore = JSON.stringify([
      ...privateState.getRoomData(room.code, 'dogRelaySecrets'),
    ]);
    expect(action).toThrow(error);
    expect(JSON.stringify(room)).toBe(before);
    expect(JSON.stringify([...privateState.getRoomData(room.code, 'dogRelaySecrets')])).toBe(
      privateBefore,
    );
  }

  it.each([4, 10])('rejects %i active seats before changing state', (count) => {
    room.players = Array.from({ length: count }, (_, i) => ({
      ...room.players[0],
      id: `p${i}`,
      socketId: `socket${i}`,
    }));
    service.initLobby(room);
    unchanged(() => start(), 'DOG_RELAY_PLAYER_COUNT');
  });
  it('requires a connected host and connected roster', () => {
    unchanged(() => service.startRound(room, 'p1'), 'DOG_RELAY_NOT_HOST');
    room.players[2].connected = false;
    unchanged(() => start(), 'DOG_RELAY_DISCONNECTED_PLAYER');
  });
  it('preserves reordered seats when reconciling joins/removals', () => {
    service.act(room, 'p0', { type: 'REORDER_SEATS', playerIds: [...ids].reverse() }, now);
    room.players.splice(1, 1);
    room.players.push({ ...room.players[0], id: 'new', socketId: 'new-socket' });
    service.initLobby(room);
    expect(state().seatOrder).toEqual(['p4', 'p3', 'p2', 'p0', 'new']);
    unchanged(
      () => service.act(room, 'p0', { type: 'REORDER_SEATS', playerIds: ['p0', 'p0'] }, now),
      'DOG_RELAY_INVALID_SEATS',
    );
    unchanged(
      () => service.act(room, 'p2', { type: 'REORDER_SEATS', playerIds: state().seatOrder }, now),
      'DOG_RELAY_NOT_HOST',
    );
  });
  it('keeps roles, pair, ballots and all ten candidates private until entitled phases', () => {
    start();
    const secret = secrets();
    expect(Object.values(secret.roles).filter((role) => role === 'EVIL')).toHaveLength(1);
    expect(Object.values(secret.roles).filter((role) => role === 'LEADER')).toHaveLength(1);
    expect(new Set(secret.candidateIds).size).toBe(10);
    expect(secret.candidateIds).toEqual(expect.arrayContaining(Object.values(secret.truePair)));
    expect(JSON.stringify(room)).not.toMatch(/dogRelaySecrets|truePair|dog-0|"role"/);
    expect(room.players.every((p) => p.score === 0)).toBe(true);
    for (const p of room.players) {
      const own = privateState.get<{ role: string; truePair?: DogRelayPair }>(
        room.code,
        p.socketId,
        'dogRelay',
      )!;
      expect(own.role).toBe(secret.roles[p.id]);
      expect(!!own.truePair).toBe(p.id === state().leaderId);
    }
    for (const id of ids) service.act(room, id, { type: 'ACK_ROLE' }, now);
    service.act(room, state().leaderId!, { type: 'BEGIN_RELAY' }, now);
    expect(JSON.stringify([...privateState.getRoomData(room.code, 'dogRelay')])).not.toContain(
      'truePair',
    );
  });
  it('allows concurrent acknowledgements without requiring identical revisions and rejects invalid actions', () => {
    start();
    service.act(room, 'p0', { type: 'ACK_ROLE' }, now);
    const revision = state().revision;
    service.act(room, 'p0', { type: 'ACK_ROLE' }, now);
    expect(state().revision).toBe(revision);
    unchanged(() => service.act(room, 'p1', { type: 'BEGIN_RELAY' }, now), 'DOG_RELAY_WRONG_PHASE');
    unchanged(
      () => service.act(room, 'p1', { type: 'UNKNOWN' } as never, now),
      'DOG_RELAY_INVALID_ACTION',
    );
  });
  it('requires Leader preparation and current viewer, and rejects stale handoffs', () => {
    start();
    for (const id of ids) service.act(room, id, { type: 'ACK_ROLE' }, now);
    const other = ids.find((id) => id !== state().leaderId)!;
    unchanged(() => service.act(room, other, { type: 'BEGIN_RELAY' }, now), 'DOG_RELAY_NOT_LEADER');
    service.act(room, state().leaderId!, { type: 'BEGIN_RELAY' }, now);
    unchanged(
      () => service.act(room, state().leaderId!, { type: 'CONFIRM_HANDOFF', relayIndex: 0 }, now),
      'DOG_RELAY_NOT_VIEWER',
    );
    const viewer = state().relayOrder[1];
    service.act(room, viewer, { type: 'CONFIRM_HANDOFF', relayIndex: 0 }, now);
    unchanged(
      () => service.act(room, viewer, { type: 'CONFIRM_HANDOFF', relayIndex: 0 }, now),
      'DOG_RELAY_STALE_HANDOFF',
    );
  });
  it('requires final player and two distinct valid candidate cards', () => {
    restore();
    const pair = secrets().truePair;
    unchanged(
      () => service.act(room, state().leaderId!, { type: 'SUBMIT_GUESS', pair }, now),
      'DOG_RELAY_NOT_FINAL_PLAYER',
    );
    unchanged(
      () => guess({ suspectId: pair.suspectId, victimId: pair.suspectId }),
      'DOG_RELAY_INVALID_PAIR',
    );
    unchanged(
      () => guess({ suspectId: 'not-a-card', victimId: pair.victimId }),
      'DOG_RELAY_INVALID_PAIR',
    );
  });
  it('completes a correct pair and gives the entire good team rank 1', () => {
    restore();
    guess(secrets().truePair);
    expect(state().result?.reason).toBe('CORRECT_PAIR');
    expect(room.status).toBe(RoomStatus.RESULT);
    room.players.push({
      ...room.players[0],
      id: 'spectator',
      socketId: 'spectator',
      isViewer: true,
      score: 999,
    });
    const rows = buildDogRelayResultRows(room);
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.rank === 1 && row.score === 1)).toHaveLength(4);
    expect(rows.filter((row) => row.rank === 2 && row.score === 0)).toHaveLength(1);
    const scores = room.players.map((p) => p.score);
    service.act(
      room,
      state().leaderId!,
      { type: 'SET_AWARDS', bestActorId: ids[0], worstActorId: ids[1] },
      now,
    );
    expect(room.players.map((p) => p.score)).toEqual(scores);
    const nextRoundId = state().roundId;
    service.act(room, 'p0', { type: 'NEXT_ROUND' }, now);
    expect(state().roundId).not.toBe(nextRoundId);
    expect(state().roundNumber).toBe(2);
    expect(state().result).toBeNull();
    expect(secrets().ballots).toEqual({});
  });
  it('keeps partial guesses secret and advances only matching elapsed timer callbacks', () => {
    discuss();
    expect(state().phase).toBe('DISCUSS');
    expect(state().phaseEndsAt).toBe(now + 120000);
    expect(JSON.stringify(room)).not.toContain('truePair');
    const deadline = state().phaseEndsAt!;
    expect(service.onPhaseDeadline(room, state().roundId!, 'DISCUSS', deadline, deadline - 1)).toBe(
      false,
    );
    expect(service.onPhaseDeadline(room, 'old-round', 'DISCUSS', deadline, deadline)).toBe(false);
    expect(service.onPhaseDeadline(room, state().roundId!, 'DISCUSS', deadline, deadline)).toBe(
      true,
    );
    expect(service.onPhaseDeadline(room, state().roundId!, 'DISCUSS', deadline, deadline)).toBe(
      false,
    );
    expect(state().phaseEndsAt).toBe(deadline + 3000);
  });
  it.each(['GOOD', 'EVIL'] as const)(
    'resolves secret ballots to %s and disallows self/Leader/duplicate votes',
    (team) => {
      vote();
      const evil = ids.find((id) => secrets().roles[id] === 'EVIL')!;
      const innocent = ids.find((id) => secrets().roles[id] === 'GOOD')!;
      unchanged(
        () => service.act(room, evil, { type: 'SUBMIT_VOTE', targetPlayerId: evil }, now),
        'DOG_RELAY_INVALID_VOTE',
      );
      unchanged(
        () =>
          service.act(room, evil, { type: 'SUBMIT_VOTE', targetPlayerId: state().leaderId! }, now),
        'DOG_RELAY_INVALID_VOTE',
      );
      unchanged(
        () => service.act(room, evil, { type: 'SUBMIT_VOTE', targetPlayerId: 'outsider' }, now),
        'DOG_RELAY_INVALID_VOTE',
      );
      const first = ids[0];
      const mainTarget = team === 'GOOD' ? evil : innocent;
      const target = (id: string) =>
        id === mainTarget ? (mainTarget === evil ? innocent : evil) : mainTarget;
      service.act(room, first, { type: 'SUBMIT_VOTE', targetPlayerId: target(first) }, now);
      expect(JSON.stringify(room)).not.toContain('ballots');
      unchanged(
        () => service.act(room, first, { type: 'SUBMIT_VOTE', targetPlayerId: target(first) }, now),
        'DOG_RELAY_ALREADY_VOTED',
      );
      for (const id of ids.slice(1))
        service.act(room, id, { type: 'SUBMIT_VOTE', targetPlayerId: target(id) }, now);
      expect(state().result?.winningTeam).toBe(team);
      expect(buildDogRelayResultRows(room).filter((row) => row.rank === 1)).toHaveLength(
        team === 'GOOD' ? 4 : 1,
      );
    },
  );
  it('pauses the phase once, preserves independent grace deadlines, and resumes after everyone returns', () => {
    discuss();
    now += 30000;
    const deadline = state().phaseEndsAt!;
    service.onDisconnect(room, 'p1', now);
    service.onDisconnect(room, 'p1', now + 1000);
    service.onDisconnect(room, 'p2', now + 10000);
    expect(state().pause?.remainingPhaseMs).toBe(90000);
    expect(state().pause?.graceEndsAtById).toEqual({ p1: now + 120000, p2: now + 130000 });
    unchanged(() => service.act(room, 'p0', { type: 'END_DISCUSSION' }, now), 'DOG_RELAY_PAUSED');
    expect(service.onPhaseDeadline(room, state().roundId!, 'DISCUSS', deadline, deadline)).toBe(
      false,
    );
    service.onReconnect(room, 'p1', now + 119000);
    expect(state().pause?.disconnectedIds).toEqual(['p2']);
    service.onReconnect(room, 'p2', now + 119001);
    expect(state().pause).toBeNull();
    expect(state().phaseEndsAt).toBe(now + 119001 + 90000);
  });
  it('cancels at grace expiry and clears all secrets without recording results', () => {
    discuss();
    service.onDisconnect(room, 'p1', now);
    service.onReconnect(room, 'p1', now + 120000);
    expect(room.status).toBe(RoomStatus.LOBBY);
    expect(state().cancellationReason).toBe('RECONNECT_EXPIRED');
    expect(state().result).toBeNull();
    expect(privateState.getRoomData(room.code, 'dogRelay').size).toBe(0);
    expect(privateState.getRoomData(room.code, 'dogRelaySecrets').size).toBe(0);
    expect(() => buildDogRelayResultRows(room)).toThrow('DOG_RELAY_NO_RESULT');
  });
  it('does not pause for spectators or after results; stable IDs survive changed socket delivery', () => {
    start();
    service.onDisconnect(room, 'spectator', now);
    expect(state().pause).toBeNull();
    const role = secrets().roles.p1;
    privateState.remapSocketId(room.code, 'socket1', 'replacement');
    room.players[1].socketId = 'replacement';
    service.onDisconnect(room, 'p1', now);
    service.onReconnect(room, 'p1', now + 1);
    expect(privateState.get(room.code, 'replacement', 'dogRelay')).toMatchObject({ role });
    expect(state().seatOrder).toEqual(ids);
    service.cancelRound(room, 'HOST_RESET');
    restore();
    guess(secrets().truePair);
    service.onDisconnect(room, 'p1', now);
    service.onRemoved(room, 'p1', 'PLAYER_LEFT');
    expect(state().phase).toBe('RESULT');
    expect(state().pause).toBeNull();
  });
  it('cancels active removal and drops the removed seat even before room roster mutation', () => {
    start();
    service.onRemoved(room, 'p1', 'PLAYER_LEFT');
    expect(room.status).toBe(RoomStatus.LOBBY);
    expect(state().seatOrder).not.toContain('p1');
    expect(state().cancellationReason).toBe('PLAYER_LEFT');
  });
  it('supports nine seats without skipping the last relay viewer', () => {
    room.players.push(
      ...Array.from({ length: 4 }, (_, i) => ({
        ...room.players[0],
        id: `extra${i}`,
        socketId: `extra-socket${i}`,
      })),
    );
    service.initLobby(room);
    start();
    for (const player of room.players) service.act(room, player.id, { type: 'ACK_ROLE' }, now);
    service.act(room, state().leaderId!, { type: 'BEGIN_RELAY' }, now);
    for (let i = 0; i < 8; i++) {
      expect(state().phase).toBe('RELAY');
      service.act(room, state().relayOrder[i + 1], { type: 'CONFIRM_HANDOFF', relayIndex: i }, now);
    }
    expect(state().phase).toBe('RESTORE');
    expect(state().relayOrder).toHaveLength(9);
  });
  it('restricts discussion controls, spectator actions and result controls', () => {
    discuss();
    unchanged(() => service.act(room, 'p1', { type: 'END_DISCUSSION' }, now), 'DOG_RELAY_NOT_HOST');
    room.players.push({ ...room.players[0], id: 'viewer', socketId: 'viewer', isViewer: true });
    unchanged(
      () => service.act(room, 'viewer', { type: 'END_DISCUSSION' }, now),
      'DOG_RELAY_NOT_ACTIVE_PLAYER',
    );
    service.cancelRound(room, 'HOST_RESET');
    restore();
    guess(secrets().truePair);
    const other = ids.find((id) => id !== state().leaderId)!;
    unchanged(
      () =>
        service.act(
          room,
          other,
          { type: 'SET_AWARDS', bestActorId: ids[0], worstActorId: ids[1] },
          now,
        ),
      'DOG_RELAY_NOT_LEADER',
    );
    unchanged(
      () =>
        service.act(
          room,
          state().leaderId!,
          { type: 'SET_AWARDS', bestActorId: ids[0], worstActorId: ids[0] },
          now,
        ),
      'DOG_RELAY_INVALID_AWARDS',
    );
    unchanged(() => service.act(room, 'p1', { type: 'NEXT_ROUND' }, now), 'DOG_RELAY_NOT_HOST');
    service.act(room, 'p0', { type: 'RETURN_TO_LOBBY' }, now);
    expect(state().phase).toBeNull();
    expect(privateState.getRoomData(room.code, 'dogRelay').size).toBe(0);
  });
});
