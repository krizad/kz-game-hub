import { GameType, RoomState, SOCKET_EVENTS } from '@repo/types';
import { GamesGateway } from './games.gateway';

describe('GamesGateway payload guard', () => {
  let gateway: GamesGateway;

  beforeEach(() => {
    gateway = new GamesGateway({} as never, {} as never, {} as never, {} as never);
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
      { leaveRoom, joinRoom, findRoomCodeBySocketId } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() } as never;

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
      { leaveRoom, joinRoom, findRoomCodeBySocketId } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() } as never;

    gateway.handleJoinRoom({ code: 'abc123', name: 'Player' }, client);

    expect(leaveRoom).not.toHaveBeenCalled();
    expect(joinRoom).toHaveBeenCalled();
  });

  it('deletes the room when the creator cannot join it', () => {
    const createRoom = jest.fn(() => ({ code: 'NEW123' }));
    const joinRoom = jest.fn(() => null);
    const deleteRoom = jest.fn();
    const gateway = new GamesGateway(
      { createRoom, joinRoom, deleteRoom, findRoomCodeBySocketId: jest.fn(() => null) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() } as never;

    gateway.handleCreateRoom({ name: 'Host' }, client);

    expect(deleteRoom).toHaveBeenCalledWith('NEW123');
  });

  it('keeps the saboteur auto-pass deadline stable across unrelated broadcasts', () => {
    jest.useFakeTimers({ now: 0 });
    const schedule = jest.fn();
    const cancel = jest.fn();
    const gatewayInstance = new GamesGateway(
      {} as never,
      {} as never,
      { schedule, cancel } as never,
      { getSocketData: jest.fn(() => ({})) } as never,
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

  it('requires a well-formed card-game action payload', () => {
    expect(isValid(SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: null })).toBe(false);
    expect(isValid(SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: {} })).toBe(false);
    expect(
      isValid(SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: { type: 'DRAW' } }),
    ).toBe(true);
  });
});
