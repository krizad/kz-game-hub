/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DogRelayAction,
  DogRelayActionRequest,
  GameType,
  RoomState,
  RoomStatus,
  SOCKET_EVENTS,
  DOG_RELAY_CARDS,
  DOG_RELAY_IMAGE_INVARIANTS,
} from '@repo/types';
import { GamesService } from '../games.service';
import { GamesGateway } from '../games.gateway';
import { PrivateStateService } from '../private-state.service';
import { PlayerSessionService } from '../player-session.service';
import { RoomTimerService } from '../room-timer.service';
import { ActionReceiptService } from '../action-receipt.service';
import { RoomStartGuardService } from '../room-start-guard.service';
import { GameSettingsService } from '../game-settings.service';
import { DogRelayService, DogRelaySecrets } from './dog-relay.service';

describe('Who Barks socket and lifecycle integration', () => {
  let module: TestingModule;
  let games: GamesService;
  let gateway: GamesGateway;
  let timers: RoomTimerService;
  let privateState: PrivateStateService;
  let room: RoomState;
  let recorded: jest.Mock;
  let outgoing: { target: string; event: string; payload: any }[];
  let sequence: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const real = [
      DogRelayService,
      PrivateStateService,
      PlayerSessionService,
      RoomTimerService,
      ActionReceiptService,
      RoomStartGuardService,
      GameSettingsService,
    ];
    const dependencies: any[] = Reflect.getMetadata('design:paramtypes', GamesService);
    module = await Test.createTestingModule({
      providers: [
        GamesService,
        ...real,
        ...dependencies
          .filter((token) => !real.includes(token))
          .map((token) => ({
            provide: token,
            useValue: { remapPrivateVotes: jest.fn(), deleteRoomData: jest.fn() },
          })),
      ],
    }).compile();
    games = module.get(GamesService);
    timers = module.get(RoomTimerService);
    privateState = module.get(PrivateStateService);
    recorded = jest.fn().mockResolvedValue(undefined);
    outgoing = [];
    sequence = 0;
    gateway = new GamesGateway(
      games,
      { recordGameResult: recorded } as any,
      timers,
      privateState,
      module.get(GameSettingsService),
      {} as any,
      module.get(ActionReceiptService),
    );
    gateway.server = {
      to: (target: string) => ({
        emit: (event: string, payload: any) =>
          outgoing.push({ target, event, payload: structuredClone(payload) }),
      }),
      emit: jest.fn(),
    } as any;
    games.setRoomLifecycleListener((event) => {
      if (event.type === 'ROOM_STATE_UPDATED') broadcast();
    });
    room = games.createRoom('socket0', GameType.DOG_RELAY);
    for (let index = 0; index < 5; index++) join(`socket${index}`, `Player ${index}`);
  });
  afterEach(async () => {
    timers.onModuleDestroy();
    await module.close();
    jest.useRealTimers();
  });
  function join(socketId: string, name: string, token?: string) {
    return games.joinRoom(room.code, { id: socketId, socketId, name } as any, token);
  }
  function broadcast() {
    (gateway as any).broadcastRoomState(room);
  }
  function client(playerId: string) {
    return {
      id: room.players.find((player) => player.id === playerId)!.socketId,
      emit: jest.fn(),
      data: {},
      leave: jest.fn(),
    } as any;
  }
  function request(action: DogRelayAction): DogRelayActionRequest {
    return {
      code: room.code,
      requestId: `integration-${sequence++}`,
      roundId: room.dogRelayState!.roundId,
      expectedRevision: room.dogRelayState!.revision,
      action,
    };
  }
  function act(playerId: string, action: DogRelayAction) {
    const socket = client(playerId);
    gateway.handleDogRelayAction(request(action), socket);
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ACTION_RECEIPT,
      expect.objectContaining({ status: 'accepted' }),
    );
    return socket;
  }
  async function start() {
    const result = await games.assignRoles(room.code, room.roomHostId);
    expect(result.error).toBeUndefined();
    broadcast();
  }
  function secrets() {
    return privateState.get<DogRelaySecrets>(room.code, '__room__', 'dogRelaySecrets')!;
  }
  function relay() {
    for (const id of room.dogRelayState!.seatOrder) act(id, { type: 'ACK_ROLE' });
    act(room.dogRelayState!.leaderId!, { type: 'BEGIN_RELAY' });
    while (room.dogRelayState!.phase === 'RELAY') {
      const state = room.dogRelayState!;
      act(state.relayOrder[state.relayIndex + 1], {
        type: 'CONFIRM_HANDOFF',
        relayIndex: state.relayIndex,
      });
    }
  }
  function guess(correct = true) {
    const pair = secrets().truePair;
    act(room.dogRelayState!.relayOrder.at(-1)!, {
      type: 'SUBMIT_GUESS',
      pair: correct ? pair : { suspectId: pair.victimId, victimId: pair.suspectId },
    });
  }

  it('allows only the host to configure random or seat-rotation Leaders in the lobby', async () => {
    expect(room.config.dogRelayLeaderSelection).toBe('RANDOM');
    expect(
      games.updateConfig(room.code, room.players[1].socketId, {
        dogRelayLeaderSelection: 'ROUND_ROBIN',
      }),
    ).toBeNull();
    games.updateConfig(room.code, room.roomHostId, { dogRelayLeaderSelection: 'FIXED' } as any);
    expect(room.config.dogRelayLeaderSelection).toBe('RANDOM');
    games.updateConfig(room.code, room.roomHostId, { dogRelayLeaderSelection: 'ROUND_ROBIN' });
    expect(room.config.dogRelayLeaderSelection).toBe('ROUND_ROBIN');
    await start();
    expect(room.dogRelayState!.leaderId).toBe(room.dogRelayState!.seatOrder[0]);
    expect(
      games.updateConfig(room.code, room.roomHostId, { dogRelayLeaderSelection: 'RANDOM' }),
    ).toBeNull();
    expect(room.config.dogRelayLeaderSelection).toBe('ROUND_ROBIN');
  });

  it('builds a stable roster, permits only host permutation and hides secrets from every broadcast', async () => {
    const ids = room.players.map((player) => player.id).reverse();
    act(room.players[0].id, { type: 'REORDER_SEATS', playerIds: ids });
    expect(room.dogRelayState!.seatOrder).toEqual(ids);
    await start();
    for (const message of outgoing.filter((item) => item.target === room.code)) {
      expect(JSON.stringify(message.payload)).not.toMatch(/truePair|dogRelaySecrets|"role"/);
    }
    const leader = room.dogRelayState!.leaderId!;
    for (const player of room.players) {
      const own = games.getPrivateSocketData(room.code, player.socketId).dogRelay as any;
      expect(own.role).toBe(secrets().roles[player.id]);
      expect(Boolean(own.truePair)).toBe(player.id === leader);
    }
  });

  it('caches an accepted handoff, rejects conflicting reuse and malformed actions without mutation', async () => {
    await start();
    for (const id of room.dogRelayState!.seatOrder) act(id, { type: 'ACK_ROLE' });
    act(room.dogRelayState!.leaderId!, { type: 'BEGIN_RELAY' });
    const socket = client(room.dogRelayState!.relayOrder[1]);
    const envelope = request({ type: 'CONFIRM_HANDOFF', relayIndex: 0 });
    gateway.handleDogRelayAction(envelope, socket);
    const broadcasts = outgoing.length;
    gateway.handleDogRelayAction(envelope, socket);
    expect(room.dogRelayState!.relayIndex).toBe(1);
    expect(outgoing).toHaveLength(broadcasts);
    gateway.handleDogRelayAction(
      { ...envelope, action: { type: 'CONFIRM_HANDOFF', relayIndex: 1 } },
      socket,
    );
    expect(socket.emit).toHaveBeenLastCalledWith(
      SOCKET_EVENTS.ACTION_RECEIPT,
      expect.objectContaining({ status: 'rejected', reason: 'REQUEST_ID_REUSED' }),
    );
    for (const action of [null, {}, { type: 'SUBMIT_GUESS', pair: null }, { type: 'UNKNOWN' }]) {
      gateway.handleDogRelayAction({ ...request({ type: 'ACK_ROLE' }), action }, socket);
      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ACTION_RECEIPT,
        expect.objectContaining({ status: 'rejected' }),
      );
    }
    expect(room.dogRelayState!.relayIndex).toBe(1);
  });

  it('pauses discussion at 30 seconds and resumes only after both stable seats reconnect', async () => {
    await start();
    relay();
    guess(false);
    jest.advanceTimersByTime(30_000);
    const players = room.players.slice(1, 3);
    const tokens = players.map((player) => games.getReconnectToken(room.code, player.socketId)!);
    const ids = [...room.dogRelayState!.seatOrder];
    const roles = { ...secrets().roles };
    for (const player of players) {
      games.leaveRoom(player.socketId, false);
      broadcast();
    }
    expect(room.dogRelayState!.pause!.remainingPhaseMs).toBe(90_000);
    expect(join('impostor', players[0].name, 'invalid')).toBeNull();
    jest.advanceTimersByTime(119_000);
    join('replacement1', players[0].name, tokens[0]);
    broadcast();
    expect(room.dogRelayState!.pause!.disconnectedIds).toEqual([players[1].id]);
    join('replacement2', players[1].name, tokens[1]);
    broadcast();
    expect(room.dogRelayState!.pause).toBeNull();
    expect(room.dogRelayState!.seatOrder).toEqual(ids);
    expect(secrets().roles).toEqual(roles);
    expect(room.dogRelayState!.phaseEndsAt).toBe(Date.now() + 90_000);
    expect((games.getPrivateSocketData(room.code, 'replacement1').dogRelay as any).role).toBe(
      roles[players[0].id],
    );
    jest.advanceTimersByTime(90_000);
    expect(room.dogRelayState!.phase).toBe('VOTE_COUNTDOWN');
    jest.advanceTimersByTime(3000);
    expect(room.dogRelayState!.phase).toBe('VOTE');
  });

  it('cancels at 120 seconds without exposing or recording a result', async () => {
    await start();
    relay();
    guess(false);
    games.leaveRoom(room.players[1].socketId, false);
    broadcast();
    jest.advanceTimersByTime(119_999);
    expect(room.status).toBe(RoomStatus.PLAYING);
    jest.advanceTimersByTime(1);
    expect(room.status).toBe(RoomStatus.LOBBY);
    expect(room.dogRelayState!.cancellationReason).toBe('RECONNECT_EXPIRED');
    expect(room.dogRelayState!.result).toBeNull();
    expect(privateState.get(room.code, '__room__', 'dogRelaySecrets')).toBeUndefined();
    expect(recorded).not.toHaveBeenCalled();
  });

  it('does not extend grace when the same socket disconnects twice', async () => {
    await start();
    const socketId = room.players[1].socketId;
    games.leaveRoom(socketId, false);
    broadcast();
    const deadline = room.dogRelayState!.pause!.graceEndsAtById[room.players[1].id];
    jest.advanceTimersByTime(60_000);
    games.leaveRoom(socketId, false);
    broadcast();
    expect(Object.values(room.dogRelayState!.pause!.graceEndsAtById)).toEqual([deadline]);
    jest.advanceTimersByTime(60_000);
    expect(room.status).toBe(RoomStatus.LOBBY);
    expect(room.dogRelayState!.cancellationReason).toBe('RECONNECT_EXPIRED');
  });

  it('freezes secret ballots, rejects forbidden targets and records a unique Evil majority', async () => {
    await start();
    relay();
    guess(false);
    act(room.players[0].id, { type: 'END_DISCUSSION' });
    jest.advanceTimersByTime(3000);
    const state = room.dogRelayState!;
    const evilId = state.seatOrder.find((id) => secrets().roles[id] === 'EVIL')!;
    const voter = state.seatOrder.find((id) => id !== state.leaderId && id !== evilId)!;
    for (const targetPlayerId of [voter, state.leaderId!, 'outsider']) {
      const socket = client(voter);
      gateway.handleDogRelayAction(request({ type: 'SUBMIT_VOTE', targetPlayerId }), socket);
      expect(socket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ACTION_RECEIPT,
        expect.objectContaining({ status: 'rejected', reason: 'DOG_RELAY_INVALID_VOTE' }),
      );
    }
    act(voter, { type: 'SUBMIT_VOTE', targetPlayerId: evilId });
    expect(
      (games.getPrivateSocketData(room.code, client(voter).id).dogRelay as any).ownVoteTargetId,
    ).toBe(evilId);
    expect(
      JSON.stringify(outgoing.filter((item) => item.target === room.code).at(-1)!.payload),
    ).not.toContain('ownVoteTargetId');
    expect(state.result).toBeNull();
    for (const id of state.seatOrder.filter((id) => id !== voter))
      act(id, { type: 'SUBMIT_VOTE', targetPlayerId: id === evilId ? voter : evilId });
    expect(state.result!.reason).toBe('EVIL_CAUGHT');
    expect(state.result!.ballots[voter]).toBe(evilId);
    expect(recorded).toHaveBeenCalledTimes(1);
  });

  it('spectator departure does not pause, while active departure cancels before result', async () => {
    await start();
    join('spectator', 'Spectator');
    expect(room.players.at(-1)!.isViewer).toBe(true);
    expect(games.getPrivateSocketData(room.code, 'spectator').dogRelay).toBeUndefined();
    games.leaveRoom('spectator', true);
    broadcast();
    expect(room.dogRelayState!.pause).toBeNull();
    expect(room.status).toBe(RoomStatus.PLAYING);
    games.leaveRoom(room.players[1].socketId, true);
    broadcast();
    expect(room.status).toBe(RoomStatus.LOBBY);
    expect(room.dogRelayState!.cancellationReason).toBe('PLAYER_LEFT');
    expect(recorded).not.toHaveBeenCalled();
  });

  it('rejects stale timer callbacks after reset and deletion', async () => {
    await start();
    relay();
    guess(false);
    const { roundId, phaseEndsAt } = room.dogRelayState!;
    games.resetGame(room.code, room.roomHostId);
    broadcast();
    jest.advanceTimersByTime(123_000);
    expect(games.dogRelayPhaseDeadline(room.code, roundId!, 'DISCUSS', phaseEndsAt!)).toBeNull();
    expect(room.status).toBe(RoomStatus.LOBBY);
    games.deleteRoom(room.code);
    expect(games.dogRelayPhaseDeadline(room.code, roundId!, 'DISCUSS', phaseEndsAt!)).toBeNull();
    expect(recorded).not.toHaveBeenCalled();
  });

  it('rejects a tenth lobby entrant as room full without removing an existing seat', () => {
    for (let index = 5; index < 9; index++) join(`socket${index}`, `Player ${index}`);
    const visitor = { id: 'tenth', emit: jest.fn(), data: {} } as any;
    gateway.handleJoinRoom({ code: room.code, name: 'Tenth' }, visitor);
    expect(visitor.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'DOG_RELAY_ROOM_FULL',
    });
    expect(room.players).toHaveLength(9);
    expect(join('tenth', 'Tenth')).toBeNull();
  });

  it('never transfers host authority to a spectator when every active seat disconnects', async () => {
    await start();
    join('spectator', 'Spectator');
    const host = room.players[0];
    const token = games.getReconnectToken(room.code, host.socketId)!;
    for (const player of room.players.slice(1).filter((player) => !player.isViewer))
      games.leaveRoom(player.socketId, false);
    games.leaveRoom(host.socketId, false);
    expect(room.roomHostId).toBe(host.socketId);
    expect(room.roomHostId).not.toBe('spectator');
    join('restored-host', host.name, token);
    expect(room.roomHostId).toBe('restored-host');
  });

  it('retains a completed result after departure and starts the next round with surviving seats', async () => {
    join('sixth', 'Sixth Player');
    await start();
    relay();
    guess();
    const firstRound = room.dogRelayState!.roundId;
    const frozenSeats = [...room.dogRelayState!.seatOrder];
    const departed = room.players.at(-1)!;
    games.leaveRoom(departed.socketId, true);
    broadcast();
    expect(room.status).toBe(RoomStatus.RESULT);
    expect(room.dogRelayState!.seatOrder).toEqual(frozenSeats);
    expect(recorded).toHaveBeenCalledTimes(1);
    act(room.players[0].id, { type: 'NEXT_ROUND' });
    expect(room.dogRelayState!.roundId).not.toBe(firstRound);
    expect(room.dogRelayState!.seatOrder).toHaveLength(5);
    expect(room.dogRelayState!.seatOrder).not.toContain(departed.id);
  });

  it('records four joint winners once despite retry, awards, broadcasts; records the next round anew', async () => {
    await start();
    relay();
    join('spectator', 'Spectator');
    room.players.at(-1)!.score = 100;
    guess();
    expect(recorded).toHaveBeenCalledTimes(1);
    const rows = recorded.mock.calls[0][2];
    expect(rows).toHaveLength(5);
    expect(rows.filter((row: any) => row.rank === 1 && row.score === 1)).toHaveLength(4);
    expect(rows.filter((row: any) => row.rank === 2 && row.score === 0)).toHaveLength(1);
    const state = room.dogRelayState!;
    act(state.leaderId!, {
      type: 'SET_AWARDS',
      bestActorId: state.seatOrder[0],
      worstActorId: state.seatOrder[1],
    });
    broadcast();
    broadcast();
    expect(recorded).toHaveBeenCalledTimes(1);
    const firstRound = state.roundId;
    act(room.players.find((player) => player.socketId === room.roomHostId)!.id, {
      type: 'NEXT_ROUND',
    });
    expect(room.dogRelayState!.roundId).not.toBe(firstRound);
    relay();
    guess();
    expect(recorded).toHaveBeenCalledTimes(2);
  });
});

describe('Who Barks catalog integrity', () => {
  it('contains 30 sequential, unique bilingual cards and approved-base-reference prompts', () => {
    expect(DOG_RELAY_CARDS).toHaveLength(30);
    expect(new Set(DOG_RELAY_CARDS.map((card) => card.id)).size).toBe(30);
    DOG_RELAY_CARDS.forEach((card, index) => {
      expect(card.number).toBe(`#${String(index + 1).padStart(3, '0')}`);
      for (const language of ['th', 'en'] as const) {
        expect(card.name[language].trim().length).toBeGreaterThan(0);
        expect(card.description[language].trim().length).toBeGreaterThan(0);
      }
      expect(card.generationPrompt).toContain(DOG_RELAY_IMAGE_INVARIANTS);
      expect(card.generationPrompt).toContain('BASE REFERENCE:');
      expect(card.generationPrompt).toContain('REQUESTED CHANGES:');
      expect(card.generationPrompt).toContain(
        'POSE LOCK: Keep the exact seated front-facing pose from the base',
      );
      expect(card.generationPrompt).not.toContain('base pose may change');
      expect(card.generationPrompt).not.toContain('Stand on two hind legs');
      const requestedChanges = card.generationPrompt
        .split('REQUESTED CHANGES: ')[1]
        .split('\nCOMPOSITION:')[0];
      expect(requestedChanges).toMatch(/^Add only /);
      expect(requestedChanges).toMatch(/unchanged seated (body|dog)/);
      expect(card.imageSrc).toBe(`/images/who-barks/cards/${card.id}.png`);
    });
  });
});
