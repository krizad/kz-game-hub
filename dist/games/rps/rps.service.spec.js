"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const rps_service_1 = require("./rps.service");
const private_state_service_1 = require("../private-state.service");
const types_1 = require("@repo/types");
describe('RPSService', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        privateState = new private_state_service_1.PrivateStateService();
        const module = await testing_1.Test.createTestingModule({
            providers: [rps_service_1.RPSService, { provide: private_state_service_1.PrivateStateService, useValue: privateState }],
        }).compile();
        service = module.get(rps_service_1.RPSService);
    });
    function createRoom(config = {}, players) {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: types_1.GameType.RPS,
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 'p1',
            createdAt: new Date(),
            config: { hostSelection: 'FIXED', timerMin: 1, rpsMode: '1V1_ROUND_ROBIN', ...config },
            players: players ??
                ['p1', 'p2', 'p3'].map((socketId) => ({
                    id: socketId,
                    socketId,
                    name: socketId,
                    score: 0,
                    roomId: 'room-id',
                    connected: true,
                })),
            rpsState: {
                activePlayers: [],
                queue: [],
                choices: {},
                choicesMade: [],
                scores: {},
            },
        };
    }
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('assignRoles', () => {
        it('should assign roles and set up game for 1V1_ROUND_ROBIN', () => {
            const room = createRoom({ rpsMode: '1V1_ROUND_ROBIN' });
            const result = service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.room.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.room.rpsState.activePlayers).toEqual(['p1', 'p2']);
            expect(result.room.rpsState.queue).toEqual(['p3']);
        });
        it('should assign roles and set up game for ALL_AT_ONCE', () => {
            const room = createRoom({ rpsMode: 'ALL_AT_ONCE' });
            const result = service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.room.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.room.rpsState.activePlayers).toEqual(['p1', 'p2', 'p3']);
            expect(result.room.rpsState.queue).toEqual([]);
        });
        it('should reject starting mid-game or with fewer than 2 connected players', () => {
            const playing = createRoom();
            playing.status = types_1.RoomStatus.PLAYING;
            expect(service.assignRoles(playing, 'p1')).toBeNull();
            const solo = createRoom({}, [
                { id: 'p1', socketId: 'p1', name: 'p1', score: 0, roomId: 'room-id', connected: true },
                { id: 'p2', socketId: 'p2', name: 'p2', score: 0, roomId: 'room-id', connected: false },
            ]);
            expect(service.assignRoles(solo, 'p1')).toBeNull();
        });
    });
    describe('makeChoice - 1V1_ROUND_ROBIN mode', () => {
        it('should keep choices private until resolution, then reveal them', () => {
            const room = createRoom();
            service.assignRoles(room, 'p1');
            const afterFirst = service.makeChoice(room, 'p1', 'ROCK');
            expect(afterFirst.status).toBe(types_1.RoomStatus.PLAYING);
            expect(afterFirst.rpsState.choices['p1']).toBeUndefined();
            expect(afterFirst.rpsState.choicesMade).toEqual(['p1']);
            expect(privateState.get(room.code, 'p1', 'rpsChoice')).toBe('ROCK');
            expect(JSON.stringify(afterFirst)).not.toContain('ROCK');
            const result = service.makeChoice(room, 'p2', 'SCISSORS');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.rpsState.choices).toEqual({ p1: 'ROCK', p2: 'SCISSORS' });
            expect(result.rpsState.roundWinner).toBe('p1');
            expect(result.rpsState.scores['p1']).toBe(1);
            expect(result.players[0].score).toBe(1);
            expect(result.rpsState.activePlayers).toEqual(['p1', 'p3']);
            expect(result.rpsState.queue).toEqual(['p2']);
        });
        it('rejects invalid choices, non-active players, and choice overwrites', () => {
            const room = createRoom();
            service.assignRoles(room, 'p1');
            expect(service.makeChoice(room, 'p1', 'NUCLEAR')).toBeNull();
            expect(service.makeChoice(room, 'p3', 'ROCK')).toBeNull();
            expect(service.makeChoice(room, 'p1', 'ROCK')).not.toBeNull();
            expect(service.makeChoice(room, 'p1', 'PAPER')).toBeNull();
        });
    });
    describe('makeChoice - ALL_AT_ONCE mode', () => {
        it('should correctly determine winners', () => {
            const room = createRoom({ rpsMode: 'ALL_AT_ONCE' });
            service.assignRoles(room, 'p1');
            service.makeChoice(room, 'p1', 'ROCK');
            service.makeChoice(room, 'p2', 'SCISSORS');
            const result = service.makeChoice(room, 'p3', 'SCISSORS');
            const rps = result.rpsState;
            expect(rps.roundWinner).toEqual(['p1']);
            expect(rps.scores['p1']).toBe(1);
            expect(rps.choices).toEqual({ p1: 'ROCK', p2: 'SCISSORS', p3: 'SCISSORS' });
        });
        it('should determine DRAW if all choices are present', () => {
            const room = createRoom({ rpsMode: 'ALL_AT_ONCE' });
            service.assignRoles(room, 'p1');
            service.makeChoice(room, 'p1', 'ROCK');
            service.makeChoice(room, 'p2', 'PAPER');
            const result = service.makeChoice(room, 'p3', 'SCISSORS');
            expect(result.rpsState.roundWinner).toBe('DRAW');
        });
    });
    describe('disconnects', () => {
        it('resolves as a draw when all active players disconnect', () => {
            const room = createRoom();
            service.assignRoles(room, 'p1');
            const p1 = room.players[0];
            p1.connected = false;
            const p2 = room.players[1];
            p2.connected = false;
            const result = service.makeChoice(room, 'p1', 'ROCK');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.rpsState.roundWinner).toBe('DRAW');
        });
        it('does not wait for a disconnected opponent choice', () => {
            const room = createRoom();
            service.assignRoles(room, 'p1');
            room.players[1].connected = false;
            const result = service.makeChoice(room, 'p1', 'PAPER');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.rpsState.roundWinner).toBe('p1');
        });
    });
    describe('nextRound & reset', () => {
        it('clears private choices when moving to the next round', () => {
            const room = createRoom();
            service.assignRoles(room, 'p1');
            service.makeChoice(room, 'p1', 'ROCK');
            service.makeChoice(room, 'p2', 'SCISSORS');
            const result = service.nextRound(room, 'p1');
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.rpsState.choices).toEqual({});
            expect(result.rpsState.choicesMade).toEqual([]);
            expect(privateState.get(room.code, 'p1', 'rpsChoice')).toBeUndefined();
        });
        it('should reset game to lobby', () => {
            const room = createRoom();
            room.status = types_1.RoomStatus.RESULT;
            room.players[0].score = 5;
            const result = service.reset(room, 'p1');
            expect(result.status).toBe(types_1.RoomStatus.LOBBY);
            expect(result.rpsState.choices).toEqual({});
            expect(result.players[0].score).toBe(0);
        });
    });
});
//# sourceMappingURL=rps.service.spec.js.map