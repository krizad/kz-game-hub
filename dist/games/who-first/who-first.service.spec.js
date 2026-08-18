"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const who_first_service_1 = require("./who-first.service");
const types_1 = require("@repo/types");
describe('WhoFirstService', () => {
    let service;
    beforeEach(() => {
        service = new who_first_service_1.WhoFirstService();
    });
    function createRoom(config = {}) {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: 'WHO_FIRST',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 'p1',
            createdAt: new Date(),
            config: {
                hostSelection: 'FIXED',
                timerMin: 1,
                whoFirstPenalty: true,
                whoFirstHostPlays: false,
                whoFirstMinCountdownMs: 1000,
                whoFirstMaxCountdownMs: 1000,
                ...config,
            },
            players: [
                { id: 'p1', socketId: 'p1', name: 'P1', score: 0, roomId: 'room-id', connected: true },
                { id: 'p2', socketId: 'p2', name: 'P2', score: 0, roomId: 'room-id', connected: true },
                { id: 'p3', socketId: 'p3', name: 'P3', score: 0, roomId: 'room-id', connected: true },
            ],
        };
    }
    it('starts the game in COUNTDOWN with a server-owned deadline', () => {
        const room = createRoom();
        const result = service.startGame(room, 'p1');
        expect(result).not.toBeNull();
        expect(room.status).toBe(types_1.RoomStatus.PLAYING);
        expect(room.whoFirstState.phase).toBe('COUNTDOWN');
        expect(room.whoFirstState.countdownEndTime).toBeGreaterThan(Date.now());
        expect(room.whoFirstState.countdownDurationMs).toBe(1000);
    });
    it('rejects start when not in LOBBY or with fewer than 2 connected players', () => {
        const playing = createRoom();
        playing.status = types_1.RoomStatus.PLAYING;
        expect(service.startGame(playing, 'p1')).toBeNull();
        const solo = createRoom();
        solo.players[1].connected = false;
        solo.players[2].connected = false;
        expect(service.startGame(solo, 'p1')).toBeNull();
    });
    it('transitions COUNTDOWN to ACTIVE only via the server setActive', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        expect(room.whoFirstState.phase).toBe('COUNTDOWN');
        expect(service.setActive(room)).not.toBeNull();
        expect(room.whoFirstState.phase).toBe('ACTIVE');
        expect(room.whoFirstState.activeStartTime).toBeDefined();
    });
    it('does not honor a client SET_ACTIVE action', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        expect(service.handleGameAction(room, 'p1', { type: 'SET_ACTIVE' })).toBeNull();
        expect(room.whoFirstState.phase).toBe('COUNTDOWN');
    });
    it('rejects presses from non-members and double presses', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        service.setActive(room);
        expect(service.handleGameAction(room, 'stranger', { type: 'PRESS_BUTTON' })).toBeNull();
        expect(service.handleGameAction(room, 'p2', { type: 'PRESS_BUTTON' })).not.toBeNull();
        expect(service.handleGameAction(room, 'p2', { type: 'PRESS_BUTTON' })).toBeNull();
    });
    it('rejects the host press when hostPlays is false', () => {
        const room = createRoom({ whoFirstHostPlays: false });
        service.startGame(room, 'p1');
        service.setActive(room);
        expect(service.handleGameAction(room, 'p1', { type: 'PRESS_BUTTON' })).toBeNull();
    });
    it('awards a score to the fastest presser and resolves the round', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        service.setActive(room);
        service.handleGameAction(room, 'p2', { type: 'PRESS_BUTTON' });
        const result = service.handleGameAction(room, 'p3', { type: 'PRESS_BUTTON' });
        expect(result.whoFirstState.phase).toBe('ROUND_RESULT');
        expect(result.whoFirstState.roundWinnerId).toBe('p2');
        expect(result.players[1].score).toBe(1);
        expect(result.players[2].score).toBe(0);
    });
    it('records penalties during COUNTDOWN and resolves when all pressed', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        service.handleGameAction(room, 'p2', { type: 'PRESS_BUTTON' });
        const result = service.handleGameAction(room, 'p3', { type: 'PRESS_BUTTON' });
        expect(result.whoFirstState.phase).toBe('ROUND_RESULT');
        expect(result.whoFirstState.presses.every((p) => p.isPenalty)).toBe(true);
        expect(result.whoFirstState.roundWinnerId).toBeUndefined();
    });
    it('advances rounds and finishes after the last round', () => {
        const room = createRoom({ whoFirstMaxRounds: 1 });
        service.startGame(room, 'p1');
        service.setActive(room);
        service.handleGameAction(room, 'p2', { type: 'PRESS_BUTTON' });
        service.handleGameAction(room, 'p3', { type: 'PRESS_BUTTON' });
        const result = service.handleGameAction(room, 'p1', { type: 'NEXT_ROUND' });
        expect(result.status).toBe(types_1.RoomStatus.RESULT);
        expect(result.whoFirstState.phase).toBe('FINISHED');
    });
    it('rejects NEXT_ROUND and END_GAME from non-hosts and unknown actions', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        expect(service.handleGameAction(room, 'p2', { type: 'NEXT_ROUND' })).toBeNull();
        expect(service.handleGameAction(room, 'p2', { type: 'END_GAME' })).toBeNull();
        expect(service.handleGameAction(room, 'p1', { type: 'NONSENSE' })).toBeNull();
    });
    it('allows END_GAME from host to finish the game', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        service.setActive(room);
        const result = service.handleGameAction(room, 'p1', { type: 'END_GAME' });
        expect(result.status).toBe(types_1.RoomStatus.RESULT);
        expect(result.whoFirstState.phase).toBe('FINISHED');
    });
    it('resets to LOBBY only from RESULT by the host', () => {
        const room = createRoom();
        service.startGame(room, 'p1');
        service.setActive(room);
        service.handleGameAction(room, 'p1', { type: 'END_GAME' });
        expect(service.resetGame(room, 'p2')).toBeNull();
        const result = service.resetGame(room, 'p1');
        expect(result.status).toBe(types_1.RoomStatus.LOBBY);
    });
});
//# sourceMappingURL=who-first.service.spec.js.map