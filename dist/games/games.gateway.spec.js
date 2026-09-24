"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@repo/types");
const games_gateway_1 = require("./games.gateway");
const gameSettingsStub = () => ({
    load: jest.fn(),
    snapshot: jest.fn(() => ({})),
    setEnabled: jest.fn(),
    isEnabled: jest.fn(() => true),
});
describe('GamesGateway payload guard', () => {
    let gateway;
    beforeEach(() => {
        gateway = new games_gateway_1.GamesGateway({}, {}, {}, {}, gameSettingsStub());
    });
    const isValid = (event, payload) => gateway.isValidPayload(event, payload);
    it('accepts who_am_i_get_categories without a room code', () => {
        expect(isValid(types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'en' })).toBe(true);
        expect(isValid(types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'th' })).toBe(true);
        expect(isValid(types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, {})).toBe(true);
    });
    it('rejects who_am_i_get_categories with an unsafe lang', () => {
        expect(isValid(types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 42 })).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'x'.repeat(50) })).toBe(false);
    });
    it('still requires a valid room code for room events', () => {
        expect(isValid(types_1.SOCKET_EVENTS.START_GAME, {})).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.START_GAME, { code: 'abc' })).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.START_GAME, { code: 'abc123' })).toBe(true);
    });
    it('accepts exchange selections of any small size and rejects malformed ones', () => {
        expect(isValid(types_1.SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0] })).toBe(true);
        expect(isValid(types_1.SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0, 1] })).toBe(true);
        expect(isValid(types_1.SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0, 1, 2, 3, 4] })).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: ['0'] })).toBe(false);
    });
    it('wires grace-expiry broadcasts after init', () => {
        const setRoomLifecycleListener = jest.fn();
        const getAvailableRooms = jest.fn(() => []);
        const lifecycleGateway = new games_gateway_1.GamesGateway({ setRoomLifecycleListener, getAvailableRooms }, {}, {}, {}, gameSettingsStub());
        const toMock = jest.fn(() => ({ emit: jest.fn() }));
        lifecycleGateway.server = { to: toMock, emit: jest.fn() };
        lifecycleGateway.afterInit();
        expect(setRoomLifecycleListener).toHaveBeenCalled();
        const listener = setRoomLifecycleListener.mock.calls[0][0];
        listener({ type: 'ROOM_DELETED', code: 'ABC123' });
        expect(toMock).toHaveBeenCalledWith('ABC123');
        expect(getAvailableRooms).toHaveBeenCalled();
    });
    it('leaves the previous room before joining another', () => {
        const leaveRoom = jest.fn(() => ({ outcome: 'NOT_IN_ROOM' }));
        const joinRoom = jest.fn(() => null);
        const findRoomCodeBySocketId = jest.fn(() => 'OLD123');
        const gateway = new games_gateway_1.GamesGateway({ leaveRoom, joinRoom, findRoomCodeBySocketId, getRoom: jest.fn(() => undefined) }, {}, {}, {}, gameSettingsStub());
        const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() };
        gateway.handleJoinRoom({ code: 'abc123', name: 'Player' }, client);
        expect(findRoomCodeBySocketId).toHaveBeenCalledWith('sock1');
        expect(leaveRoom).toHaveBeenCalledWith('sock1', true);
        expect(joinRoom).toHaveBeenCalled();
    });
    it('does not leave when joining the same room again', () => {
        const leaveRoom = jest.fn(() => ({ outcome: 'NOT_IN_ROOM' }));
        const joinRoom = jest.fn(() => null);
        const findRoomCodeBySocketId = jest.fn(() => 'ABC123');
        const gateway = new games_gateway_1.GamesGateway({ leaveRoom, joinRoom, findRoomCodeBySocketId, getRoom: jest.fn(() => undefined) }, {}, {}, {}, gameSettingsStub());
        const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() };
        gateway.handleJoinRoom({ code: 'abc123', name: 'Player' }, client);
        expect(leaveRoom).not.toHaveBeenCalled();
        expect(joinRoom).toHaveBeenCalled();
    });
    it('deletes the room when the creator cannot join it', () => {
        const createRoom = jest.fn(() => ({ code: 'NEW123' }));
        const joinRoom = jest.fn(() => null);
        const deleteRoom = jest.fn();
        const gateway = new games_gateway_1.GamesGateway({
            createRoom,
            joinRoom,
            deleteRoom,
            findRoomCodeBySocketId: jest.fn(() => null),
            isGameEnabled: jest.fn(() => true),
        }, {}, {}, {}, gameSettingsStub());
        const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() };
        gateway.handleCreateRoom({ name: 'Host' }, client);
        expect(deleteRoom).toHaveBeenCalledWith('NEW123');
    });
    it('keeps the saboteur auto-pass deadline stable across unrelated broadcasts', () => {
        jest.useFakeTimers({ now: 0 });
        const schedule = jest.fn();
        const cancel = jest.fn();
        const deadlines = new Map();
        const gamesService = {
            getRoom: jest.fn(),
            saboteurTurnDeadline: jest.fn((code, playerId, seconds) => {
                const current = deadlines.get(code);
                if (current && current.playerId === playerId)
                    return current.deadline;
                const deadline = Date.now() + seconds * 1000;
                deadlines.set(code, { playerId, deadline });
                return deadline;
            }),
            clearSaboteurTurnDeadline: jest.fn((code) => deadlines.delete(code)),
            saboteurAutoPass: jest.fn(() => null),
        };
        const gatewayInstance = new games_gateway_1.GamesGateway(gamesService, {}, { schedule, cancel }, { getSocketData: jest.fn(() => ({})) }, gameSettingsStub());
        gatewayInstance.server = { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() };
        const room = {
            code: 'SAB123',
            gameType: types_1.GameType.SABOTEUR,
            config: { saboteurTurnTimerEnabled: true, saboteurTurnTimerSeconds: 60 },
            players: [],
            saboteurState: { currentPhase: 'PLAYING', activePlayerId: 'p1' },
        };
        const broadcast = gatewayInstance.broadcastRoomState.bind(gatewayInstance);
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
        const gatewayInstance = new games_gateway_1.GamesGateway({}, {}, { schedule, cancel }, { getSocketData: jest.fn(() => ({})) }, gameSettingsStub());
        gatewayInstance.server = { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() };
        const broadcast = gatewayInstance.broadcastRoomState.bind(gatewayInstance);
        broadcast({
            code: 'CARD1',
            gameType: types_1.GameType.CARD_GAME,
            config: {},
            players: [],
            cardGameState: { phase: 'PLAYER_TURNS', activePlayerId: 'p1', turnDeadline: 12_345 },
        });
        expect(schedule).toHaveBeenCalledWith('CARD1', 'card-game', 12_345, expect.any(Function));
        broadcast({
            code: 'CARD2',
            gameType: types_1.GameType.CARD_GAME,
            config: {},
            players: [],
            cardGameState: { phase: 'PLAYER_TURNS', activePlayerId: 'p1', turnDeadline: null },
        });
        expect(cancel).toHaveBeenCalledWith('CARD2', 'card-game');
    });
    it('requires a well-formed card-game action payload', () => {
        expect(isValid(types_1.SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: null })).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: {} })).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.CARD_GAME_ACTION, { code: 'abc123', action: { type: 'DRAW' } })).toBe(true);
    });
    it('requires a well-formed set_game_enabled payload', () => {
        expect(isValid(types_1.SOCKET_EVENTS.SET_GAME_ENABLED, { gameType: types_1.GameType.COUP, enabled: true })).toBe(false);
        expect(isValid(types_1.SOCKET_EVENTS.SET_GAME_ENABLED, {
            gameType: types_1.GameType.COUP,
            enabled: true,
            adminKey: 'secret',
        })).toBe(true);
        expect(isValid(types_1.SOCKET_EVENTS.SET_GAME_ENABLED, {
            gameType: 'NOT_A_GAME',
            enabled: true,
            adminKey: 'secret',
        })).toBe(false);
    });
    it('blocks creating a room for a disabled game', () => {
        const createRoom = jest.fn();
        const gateway = new games_gateway_1.GamesGateway({
            createRoom,
            isGameEnabled: jest.fn(() => false),
            findRoomCodeBySocketId: jest.fn(),
        }, {}, {}, {}, gameSettingsStub());
        const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() };
        gateway.handleCreateRoom({ name: 'Host', gameType: types_1.GameType.COUP }, client);
        expect(createRoom).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(types_1.SOCKET_EVENTS.ERROR, {
            message: 'This game is currently disabled.',
        });
    });
    it('blocks a new player from joining a disabled game but lets seated members return', () => {
        const joinRoom = jest.fn(() => null);
        const disabledRoom = {
            code: 'ABC123',
            gameType: types_1.GameType.COUP,
            players: [{ socketId: 'member1' }],
        };
        const gamesService = {
            joinRoom,
            findRoomCodeBySocketId: jest.fn(() => null),
            getRoom: jest.fn(() => disabledRoom),
            isGameEnabled: jest.fn(() => false),
        };
        const gateway = new games_gateway_1.GamesGateway(gamesService, {}, {}, {}, gameSettingsStub());
        const newcomer = { id: 'newcomer', join: jest.fn(), emit: jest.fn() };
        const member = { id: 'member1', join: jest.fn(), emit: jest.fn() };
        gateway.handleJoinRoom({ code: 'abc123', name: 'Newcomer' }, newcomer);
        expect(joinRoom).not.toHaveBeenCalled();
        expect(newcomer.emit).toHaveBeenCalledWith(types_1.SOCKET_EVENTS.ERROR, {
            message: 'This game is currently disabled.',
        });
        gateway.handleJoinRoom({ code: 'abc123', name: 'Member' }, member);
        expect(joinRoom).toHaveBeenCalled();
    });
    it('rejects set_game_enabled without the admin key', async () => {
        const setEnabled = jest.fn();
        const gateway = new games_gateway_1.GamesGateway({}, {}, {}, {}, { load: jest.fn(), snapshot: jest.fn(() => ({})), setEnabled, isEnabled: jest.fn() });
        const client = { id: 'sock1', join: jest.fn(), emit: jest.fn() };
        const previousSecret = process.env.ADMIN_SECRET;
        delete process.env.ADMIN_SECRET;
        try {
            await gateway.handleSetGameEnabled({ gameType: types_1.GameType.COUP, enabled: false, adminKey: 'guess' }, client);
        }
        finally {
            if (previousSecret === undefined)
                delete process.env.ADMIN_SECRET;
            else
                process.env.ADMIN_SECRET = previousSecret;
        }
        expect(setEnabled).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(types_1.SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
    });
});
//# sourceMappingURL=games.gateway.spec.js.map