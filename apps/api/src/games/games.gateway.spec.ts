import { GameType, RoomState, RoomStatus, SOCKET_EVENTS } from '@repo/types';
import { GamesGateway } from './games.gateway';

const gameSettingsStub = () => ({
  load: jest.fn(),
  snapshot: jest.fn(() => ({})),
  setEnabled: jest.fn(),
  isEnabled: jest.fn(() => true),
});

const artistPresetsStub = () => ({
  listPresets: jest.fn(async () => []),
  setEnabled: jest.fn(),
  deleteArtist: jest.fn(),
  getCatalog: jest.fn(async () => null),
});

describe('GamesGateway payload guard', () => {
  let gateway: GamesGateway;

  beforeEach(() => {
    gateway = new GamesGateway(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
  });

  const isValid = (event: string, payload: unknown): boolean =>
    (
      gateway as unknown as {
        isValidPayload: (event: string, payload: unknown) => boolean;
      }
    ).isValidPayload(event, payload);

  it('accepts who_am_i_get_categories without a room code', () => {
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'en' })).toBe(true);
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'th' })).toBe(true);
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, {})).toBe(true);
  });

  it('rejects who_am_i_get_categories with an unsafe lang', () => {
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 42 })).toBe(false);
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'x'.repeat(50) })).toBe(false);
  });

  it('still requires a valid room code for room events', () => {
    expect(isValid(SOCKET_EVENTS.START_GAME, {})).toBe(false);
    expect(isValid(SOCKET_EVENTS.START_GAME, { code: 'abc' })).toBe(false);
    expect(isValid(SOCKET_EVENTS.START_GAME, { code: 'abc123' })).toBe(true);
  });

  it('rejects spectator entry when disabled and permits legacy and enabled rooms', () => {
    const room = { code: 'ABC123', config: { allowSpectators: false }, players: [] };
    const getRoom = jest.fn(() => room);
    const spectatorGateway = new GamesGateway(
      {
        getRoom,
        findRoomCodeBySocketId: jest.fn(() => null),
        musicTriviaCurrentSyncPlay: jest.fn(() => null),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = { id: 'observer', join: jest.fn(), emit: jest.fn(), data: {} };

    spectatorGateway.handleSpectateJoin({ code: room.code, name: 'Observer' }, client as never);
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'SPECTATORS_DISABLED',
    });

    delete (room.config as { allowSpectators?: boolean }).allowSpectators;
    spectatorGateway.handleSpectateJoin({ code: room.code, name: 'Observer' }, client as never);
    expect(client.join).toHaveBeenCalledWith(room.code);

    client.join.mockClear();
    room.config.allowSpectators = true;
    spectatorGateway.handleSpectateJoin({ code: room.code, name: 'Observer' }, client as never);
    expect(client.join).toHaveBeenCalledWith(room.code);
  });

  it('rejects fresh late code joins that would become viewers while preserving seated reconnects', () => {
    const room = {
      code: 'ABC123',
      gameType: GameType.WHO_KNOW,
      status: RoomStatus.PLAYING,
      config: { allowSpectators: false },
      players: [],
    };
    const joinRoom = jest.fn(() => null);
    const hasSeatedSession = jest.fn(() => false);
    const admissionGateway = new GamesGateway(
      {
        getRoom: jest.fn(() => room),
        findRoomCodeBySocketId: jest.fn(() => null),
        isGameEnabled: jest.fn(() => true),
        hasSeatedSession,
        joinRoom,
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = { id: 'fresh', join: jest.fn(), emit: jest.fn(), data: {} };

    admissionGateway.handleJoinRoom({ code: room.code, name: 'Fresh' }, client as never);
    expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'SPECTATORS_DISABLED',
    });
    expect(joinRoom).not.toHaveBeenCalled();

    hasSeatedSession.mockReturnValue(true);
    admissionGateway.handleJoinRoom(
      { code: room.code, name: 'Returning', reconnectToken: 'valid' },
      client as never,
    );
    expect(hasSeatedSession).toHaveBeenCalledWith(room.code, 'valid', 'Returning');
    expect(joinRoom).toHaveBeenCalled();
  });

  it('does not treat a different name on the same socket or token as a seated reconnect', () => {
    const room = {
      code: 'ABC123',
      gameType: GameType.WHO_KNOW,
      status: RoomStatus.PLAYING,
      config: { allowSpectators: false },
      players: [{ id: 'seat1', name: 'Original', socketId: 'oldSock' }],
    };
    const joinRoom = jest.fn(() => null);
    const hasSeatedSession = jest.fn(() => false);
    const admissionGateway = new GamesGateway(
      {
        getRoom: jest.fn(() => room),
        findRoomCodeBySocketId: jest.fn(() => null),
        isGameEnabled: jest.fn(() => true),
        hasSeatedSession,
        joinRoom,
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = { id: 'oldSock', join: jest.fn(), emit: jest.fn(), data: {} };

    admissionGateway.handleJoinRoom({ code: room.code, name: 'Changed' }, client as never);
    expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'SPECTATORS_DISABLED',
    });
    expect(joinRoom).not.toHaveBeenCalled();

    room.players[0].socketId = 'otherSock';
    client.emit.mockClear();
    admissionGateway.handleJoinRoom(
      { code: room.code, name: 'Changed', reconnectToken: 'valid' },
      client as never,
    );
    expect(hasSeatedSession).toHaveBeenCalledWith(room.code, 'valid', 'Changed');
    expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'SPECTATORS_DISABLED',
    });
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it('accepts exchange selections of any small size and rejects malformed ones', () => {
    expect(isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0] })).toBe(
      true,
    );
    expect(
      isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0, 1] }),
    ).toBe(true);
    expect(
      isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0, 1, 2, 3, 4] }),
    ).toBe(false);
    expect(
      isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: ['0'] }),
    ).toBe(false);
  });

  it('wires grace-expiry broadcasts after init', () => {
    const setRoomLifecycleListener = jest.fn();
    const getAvailableRooms = jest.fn(() => []);
    const lifecycleGateway = new GamesGateway(
      { setRoomLifecycleListener, getAvailableRooms } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const toMock = jest.fn(() => ({ emit: jest.fn() }));
    lifecycleGateway.server = { to: toMock, emit: jest.fn() } as never;

    lifecycleGateway.afterInit();

    expect(setRoomLifecycleListener).toHaveBeenCalled();
    const listener = setRoomLifecycleListener.mock.calls[0][0] as (event: {
      type: string;
      code?: string;
    }) => void;
    listener({ type: 'ROOM_DELETED', code: 'ABC123' });

    expect(toMock).toHaveBeenCalledWith('ABC123');
    expect(getAvailableRooms).toHaveBeenCalled();
  });

  it('leaves the previous room before joining another', () => {
    const leaveRoom = jest.fn(() => ({ outcome: 'NOT_IN_ROOM' as const }));
    const joinRoom = jest.fn(() => null);
    const findRoomCodeBySocketId = jest.fn(() => 'OLD123');
    const gateway = new GamesGateway(
      {
        leaveRoom,
        joinRoom,
        findRoomCodeBySocketId,
        getRoom: jest.fn(() => ({ code: 'ABC123', gameType: GameType.WHO_KNOW, players: [] })),
        isGameEnabled: jest.fn(() => true),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = {
      id: 'sock1',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      data: {},
    } as never;

    gateway.handleJoinRoom({ code: 'abc123', name: 'Player' }, client);

    expect(findRoomCodeBySocketId).toHaveBeenCalledWith('sock1');
    expect(leaveRoom).toHaveBeenCalledWith('sock1', true);
    expect(joinRoom).toHaveBeenCalled();
  });

  it('does not leave when joining the same room again', () => {
    const leaveRoom = jest.fn(() => ({ outcome: 'NOT_IN_ROOM' as const }));
    const joinRoom = jest.fn(() => null);
    const findRoomCodeBySocketId = jest.fn(() => 'ABC123');
    const gateway = new GamesGateway(
      {
        leaveRoom,
        joinRoom,
        findRoomCodeBySocketId,
        getRoom: jest.fn(() => ({ code: 'ABC123', gameType: GameType.WHO_KNOW, players: [] })),
        isGameEnabled: jest.fn(() => true),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = {
      id: 'sock1',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      data: {},
    } as never;

    gateway.handleJoinRoom({ code: 'abc123', name: 'Player' }, client);

    expect(leaveRoom).not.toHaveBeenCalled();
    expect(joinRoom).toHaveBeenCalled();
  });

  it('deletes the room when the creator cannot join it', () => {
    const createRoom = jest.fn(() => ({ code: 'NEW123' }));
    const joinRoom = jest.fn(() => null);
    const deleteRoom = jest.fn();
    const gateway = new GamesGateway(
      {
        createRoom,
        joinRoom,
        deleteRoom,
        findRoomCodeBySocketId: jest.fn(() => null),
        isGameEnabled: jest.fn(() => true),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = {
      id: 'sock1',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      data: {},
    } as never;

    gateway.handleCreateRoom({ name: 'Host' }, client);

    expect(deleteRoom).toHaveBeenCalledWith('NEW123');
  });

  it('keeps the saboteur auto-pass deadline stable across unrelated broadcasts', () => {
    jest.useFakeTimers({ now: 0 });
    const schedule = jest.fn();
    const cancel = jest.fn();
    // Mirrors GamesService's deadline ownership: stable while the turn is unchanged.
    const deadlines = new Map<string, { playerId: string; deadline: number }>();
    const gamesService = {
      getRoom: jest.fn(),
      saboteurTurnDeadline: jest.fn((code: string, playerId: string, seconds: number) => {
        const current = deadlines.get(code);
        if (current && current.playerId === playerId) return current.deadline;
        const deadline = Date.now() + seconds * 1000;
        deadlines.set(code, { playerId, deadline });
        return deadline;
      }),
      clearSaboteurTurnDeadline: jest.fn((code: string) => deadlines.delete(code)),
      saboteurAutoPass: jest.fn(() => null),
    };
    const gatewayInstance = new GamesGateway(
      gamesService as never,
      {} as never,
      { schedule, cancel } as never,
      { getSocketData: jest.fn(() => ({})) } as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    gatewayInstance.server = { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() } as never;
    const room = {
      code: 'SAB123',
      gameType: GameType.SABOTEUR,
      config: { saboteurTurnTimerEnabled: true, saboteurTurnTimerSeconds: 60 },
      players: [],
      saboteurState: { currentPhase: 'PLAYING', activePlayerId: 'p1' },
    } as unknown as RoomState;
    const broadcast = (
      gatewayInstance as unknown as { broadcastRoomState: (room: RoomState) => void }
    ).broadcastRoomState.bind(gatewayInstance);

    broadcast(room);
    jest.advanceTimersByTime(5_000);
    broadcast(room);

    expect(schedule.mock.calls[0][2]).toBe(60_000);
    expect(schedule.mock.calls[1][2]).toBe(60_000);
    jest.useRealTimers();
  });

  it('arms the card-game auto-action timer from the stored deadline', () => {
    const schedule = jest.fn();
    const cancel = jest.fn();
    const gatewayInstance = new GamesGateway(
      {} as never,
      {} as never,
      { schedule, cancel } as never,
      { getSocketData: jest.fn(() => ({})) } as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    gatewayInstance.server = { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() } as never;
    const broadcast = (
      gatewayInstance as unknown as { broadcastRoomState: (room: RoomState) => void }
    ).broadcastRoomState.bind(gatewayInstance);

    broadcast({
      code: 'CARD1',
      gameType: GameType.CARD_GAME,
      config: {},
      players: [],
      cardGameState: { phase: 'PLAYER_TURNS', activePlayerId: 'p1', turnDeadline: 12_345 },
    } as unknown as RoomState);
    expect(schedule).toHaveBeenCalledWith('CARD1', 'card-game', 12_345, expect.any(Function));

    broadcast({
      code: 'CARD2',
      gameType: GameType.CARD_GAME,
      config: {},
      players: [],
      cardGameState: { phase: 'PLAYER_TURNS', activePlayerId: 'p1', turnDeadline: null },
    } as unknown as RoomState);
    expect(cancel).toHaveBeenCalledWith('CARD2', 'card-game');
  });

  it('requires a well-formed card-game action payload', () => {
    expect(isValid(SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: null })).toBe(false);
    expect(isValid(SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: {} })).toBe(false);
    expect(
      isValid(SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: { type: 'DRAW' } }),
    ).toBe(true);
  });

  it('requires a well-formed set_game_enabled payload', () => {
    expect(
      isValid(SOCKET_EVENTS.SET_GAME_ENABLED, { gameType: GameType.COUP, enabled: true }),
    ).toBe(false);
    expect(
      isValid(SOCKET_EVENTS.SET_GAME_ENABLED, {
        gameType: GameType.COUP,
        enabled: true,
        adminKey: 'secret',
      }),
    ).toBe(true);
    expect(
      isValid(SOCKET_EVENTS.SET_GAME_ENABLED, {
        gameType: 'NOT_A_GAME',
        enabled: true,
        adminKey: 'secret',
      }),
    ).toBe(false);
  });

  it('blocks creating a room for a disabled game', () => {
    const createRoom = jest.fn();
    const gateway = new GamesGateway(
      {
        createRoom,
        isGameEnabled: jest.fn(() => false),
        findRoomCodeBySocketId: jest.fn(),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const client = { id: 'sock1', join: jest.fn(), leave: jest.fn(), emit: jest.fn(), data: {} };

    gateway.handleCreateRoom({ name: 'Host', gameType: GameType.COUP }, client as never);

    expect(createRoom).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'This game is currently disabled.',
    });
  });

  it('blocks a new player from joining a disabled game but lets seated members return', () => {
    const joinRoom = jest.fn(() => null);
    const disabledRoom = {
      code: 'ABC123',
      gameType: GameType.COUP,
      players: [{ socketId: 'member1', name: 'Member' }],
    };
    const hasSeatedSession = jest.fn(
      (_code: string, token: string, name: string) => token === 'valid' && name === 'Member',
    );
    const gamesService = {
      joinRoom,
      hasSeatedSession,
      findRoomCodeBySocketId: jest.fn(() => null),
      getRoom: jest.fn(() => disabledRoom),
      isGameEnabled: jest.fn(() => false),
    };
    const gateway = new GamesGateway(
      gamesService as never,
      {} as never,
      {} as never,
      {} as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    const newcomer = {
      id: 'newcomer',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      data: {},
    };
    const member = { id: 'member1', join: jest.fn(), leave: jest.fn(), emit: jest.fn(), data: {} };

    gateway.handleJoinRoom({ code: 'abc123', name: 'Newcomer' }, newcomer as never);
    expect(joinRoom).not.toHaveBeenCalled();
    expect(newcomer.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
      message: 'This game is currently disabled.',
    });

    gateway.handleJoinRoom(
      { code: 'abc123', name: 'Member', reconnectToken: 'valid' },
      member as never,
    );
    expect(joinRoom).toHaveBeenCalled();
  });

  it('rejects set_game_enabled without the admin key', async () => {
    const setEnabled = jest.fn();
    const gateway = new GamesGateway(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { load: jest.fn(), snapshot: jest.fn(() => ({})), setEnabled, isEnabled: jest.fn() } as never,
      artistPresetsStub() as never,
    );
    const client = { id: 'sock1', join: jest.fn(), leave: jest.fn(), emit: jest.fn(), data: {} };
    const previousSecret = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;

    try {
      await gateway.handleSetGameEnabled(
        { gameType: GameType.COUP, enabled: false, adminKey: 'guess' },
        client as never,
      );
    } finally {
      if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
      else process.env.ADMIN_SECRET = previousSecret;
    }

    expect(setEnabled).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
  });
});

describe('GamesGateway Music Trivia reconnect', () => {
  const syncPlay = {
    roundNumber: 2,
    playStartTime: Date.now() - 5_000,
    previewUrl: 'https://example.com/clip.m4a',
    sourceType: 'ITUNES',
    durationMs: 30_000,
  };
  const hostAnswer = { title: 'Current song', artist: 'Current artist' };
  const room = {
    code: 'ABC123',
    gameType: GameType.MUSIC_TRIVIA,
    status: RoomStatus.PLAYING,
    roomHostId: 'host',
    players: [
      { id: 'host-player', socketId: 'host', name: 'Host', connected: true },
      { id: 'guest-player', socketId: 'guest', name: 'Guest', connected: true },
    ],
  } as RoomState;

  const makeHarness = () => {
    const events: { target: string; event: string; payload: unknown }[] = [];
    const gamesService = {
      findRoomCodeBySocketId: jest.fn(() => null),
      getRoom: jest.fn(() => room),
      joinRoom: jest.fn(() => room),
      getReconnectToken: jest.fn(() => null),
      getPlayerRole: jest.fn(() => null),
      getAvailableRooms: jest.fn(() => []),
      isGameEnabled: jest.fn(() => true),
      musicTriviaCurrentSyncPlay: jest.fn(() => syncPlay),
      musicTriviaCurrentHostAnswer: jest.fn((_code: string, socketId: string) =>
        socketId === room.roomHostId ? hostAnswer : null,
      ),
      leaveRoom: jest.fn(() => ({ outcome: 'PLAYER_LEFT', room })),
    };
    const gateway = new GamesGateway(
      gamesService as never,
      {} as never,
      {} as never,
      { getSocketData: jest.fn(() => ({})) } as never,
      gameSettingsStub() as never,
      artistPresetsStub() as never,
    );
    gateway.server = {
      to: jest.fn((target: string) => ({
        emit: (event: string, payload: unknown) => events.push({ target, event, payload }),
      })),
      emit: jest.fn(),
    } as never;
    const client = (id: string) => ({
      id,
      join: jest.fn(),
      leave: jest.fn(),
      data: {},
      emit: jest.fn((event: string, payload: unknown) =>
        events.push({ target: id, event, payload }),
      ),
    });
    return { gateway, gamesService, events, client };
  };

  beforeEach(() => {
    room.roomHostId = 'host';
    room.players[0].connected = true;
    room.players[1].connected = true;
  });

  it('sends the current clip after the room state to a rejoining player, with the host hint sent only to the host', () => {
    const { gateway, events, client } = makeHarness();
    gateway.handleJoinRoom({ code: room.code, name: 'Guest' }, client('guest') as never);

    const roomIndex = events.findIndex((entry) => entry.event === SOCKET_EVENTS.ROOM_STATE_UPDATED);
    const syncIndex = events.findIndex(
      (entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY,
    );
    expect(roomIndex).toBeGreaterThanOrEqual(0);
    expect(syncIndex).toBeGreaterThan(roomIndex);
    expect(events.filter((entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY)).toEqual([
      { target: 'guest', event: SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, payload: syncPlay },
    ]);
    expect(
      events.filter((entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER),
    ).toEqual([
      { target: 'host', event: SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, payload: hostAnswer },
    ]);
  });

  it('sends public playback to a spectator without sending the private answer', () => {
    const { gateway, events, client, gamesService } = makeHarness();
    gateway.handleSpectateJoin({ code: room.code, name: 'Observer' }, client('observer') as never);

    expect(events.map(({ event }) => event)).toEqual([
      SOCKET_EVENTS.ROOM_STATE_UPDATED,
      SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY,
    ]);
    expect(events[1].target).toBe('observer');
    expect(gamesService.musicTriviaCurrentHostAnswer).not.toHaveBeenCalled();
  });

  it('rehydrates the new host after rotation without sending playback to the room', () => {
    const { gateway, events, client } = makeHarness();
    room.players[0].connected = false;
    room.roomHostId = 'guest';
    gateway.handleDisconnect(client('host') as never);

    expect(
      events.filter((entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER),
    ).toEqual([
      { target: 'guest', event: SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, payload: hostAnswer },
    ]);
    expect(events.some((entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY)).toBe(
      false,
    );

    events.length = 0;
    room.players[0].connected = true;
    gateway.handleJoinRoom({ code: room.code, name: 'Host' }, client('host') as never);
    expect(
      events.filter((entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER),
    ).toEqual([
      { target: 'guest', event: SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, payload: hostAnswer },
    ]);
    expect(events.filter((entry) => entry.event === SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY)).toEqual([
      { target: 'host', event: SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, payload: syncPlay },
    ]);
  });
});
