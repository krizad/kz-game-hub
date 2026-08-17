"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const rps_service_1 = require("./rps.service");
const types_1 = require("@repo/types");
describe('RPSService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [rps_service_1.RPSService],
        }).compile();
        service = module.get(rps_service_1.RPSService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('assignRoles', () => {
        it('should assign roles and set up game for 1V1', () => {
            const room = {
                players: [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }],
                roomHostId: 'p1',
                config: { rpsMode: '1V1' },
                rpsState: {},
            };
            const result = service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.room.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.room.rpsState.activePlayers).toEqual(['p1', 'p2']);
            expect(result.room.rpsState.queue).toEqual(['p3']);
        });
        it('should assign roles and set up game for ALL_AT_ONCE', () => {
            const room = {
                players: [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }],
                roomHostId: 'p1',
                config: { rpsMode: 'ALL_AT_ONCE' },
                rpsState: {},
            };
            const result = service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.room.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.room.rpsState.activePlayers).toEqual(['p1', 'p2', 'p3']);
            expect(result.room.rpsState.queue).toEqual([]);
        });
    });
    describe('makeChoice - 1V1 mode', () => {
        it('should resolve a round correctly and handle queue', () => {
            const room = {
                gameType: types_1.GameType.RPS,
                status: types_1.RoomStatus.PLAYING,
                players: [
                    { socketId: 'p1', connected: true },
                    { socketId: 'p2', connected: true },
                    { socketId: 'p3', connected: true },
                ],
                config: { rpsMode: '1V1', rpsBestOf: 3 },
                rpsState: {
                    activePlayers: ['p1', 'p2'],
                    queue: ['p3'],
                    choices: {},
                    scores: { p1: 0, p2: 0, p3: 0 },
                },
            };
            let result = service.makeChoice(room, 'p1', 'ROCK');
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
            result = service.makeChoice(room, 'p2', 'SCISSORS');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            const rps = result.rpsState;
            expect(rps.roundWinner).toBe('p1');
            expect(rps.scores['p1']).toBe(1);
            expect(rps.activePlayers).toEqual(['p1', 'p3']);
            expect(rps.queue).toEqual(['p2']);
        });
    });
    describe('makeChoice - ALL_AT_ONCE mode', () => {
        it('should correctly determine winners', () => {
            const room = {
                gameType: types_1.GameType.RPS,
                status: types_1.RoomStatus.PLAYING,
                players: [
                    { socketId: 'p1', connected: true },
                    { socketId: 'p2', connected: true },
                    { socketId: 'p3', connected: true },
                ],
                config: { rpsMode: 'ALL_AT_ONCE', rpsBestOf: 3 },
                rpsState: {
                    activePlayers: ['p1', 'p2', 'p3'],
                    queue: [],
                    choices: {},
                    scores: { p1: 0, p2: 0, p3: 0 },
                },
            };
            service.makeChoice(room, 'p1', 'ROCK');
            service.makeChoice(room, 'p2', 'SCISSORS');
            const result = service.makeChoice(room, 'p3', 'SCISSORS');
            const rps = result.rpsState;
            expect(rps.roundWinner).toEqual(['p1']);
            expect(rps.scores['p1']).toBe(1);
        });
        it('should determine DRAW if all choices are present', () => {
            const room = {
                gameType: types_1.GameType.RPS,
                status: types_1.RoomStatus.PLAYING,
                players: [
                    { socketId: 'p1', connected: true },
                    { socketId: 'p2', connected: true },
                    { socketId: 'p3', connected: true },
                ],
                config: { rpsMode: 'ALL_AT_ONCE', rpsBestOf: 3 },
                rpsState: {
                    activePlayers: ['p1', 'p2', 'p3'],
                    queue: [],
                    choices: {},
                    scores: { p1: 0, p2: 0, p3: 0 },
                },
            };
            service.makeChoice(room, 'p1', 'ROCK');
            service.makeChoice(room, 'p2', 'PAPER');
            const result = service.makeChoice(room, 'p3', 'SCISSORS');
            const rps = result.rpsState;
            expect(rps.roundWinner).toBe('DRAW');
        });
    });
    describe('reset', () => {
        it('should reset game to lobby', () => {
            const room = {
                gameType: types_1.GameType.RPS,
                status: types_1.RoomStatus.RESULT,
                players: [{ socketId: 'p1', score: 5 }],
                roomHostId: 'p1',
            };
            const result = service.reset(room, 'p1');
            expect(result.status).toBe(types_1.RoomStatus.LOBBY);
            expect(result.rpsState.choices).toEqual({});
            expect(result.players[0].score).toBe(0);
        });
    });
});
//# sourceMappingURL=rps.service.spec.js.map