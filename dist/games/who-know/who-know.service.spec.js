"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const who_know_service_1 = require("./who-know.service");
const types_1 = require("@repo/types");
describe('WhoKnowService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [who_know_service_1.WhoKnowService],
        }).compile();
        service = module.get(who_know_service_1.WhoKnowService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('assignRoles', () => {
        it('should assign roles to players', () => {
            const room = {
                players: [
                    { socketId: 'p1', hasBeenHost: false },
                    { socketId: 'p2', hasBeenHost: false },
                    { socketId: 'p3', hasBeenHost: false },
                    { socketId: 'p4', hasBeenHost: false },
                ],
                roomHostId: 'p1',
                config: { hostSelection: 'FIXED' },
            };
            const result = service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.room.status).toBe(types_1.RoomStatus.WORD_SETTING);
            expect(result.room.players[0].role).toBe(types_1.Role.Host);
            const knowPlayer = result.room.players.find((p) => p.role === types_1.Role.Know);
            expect(knowPlayer).toBeDefined();
        });
        it('should fail if players count < 4', () => {
            const room = {
                players: [
                    { socketId: 'p1', hasBeenHost: false },
                    { socketId: 'p2', hasBeenHost: false },
                    { socketId: 'p3', hasBeenHost: false },
                ],
                roomHostId: 'p1',
                config: { hostSelection: 'FIXED' },
            };
            const result = service.assignRoles(room, 'p1');
            expect(result).toBeNull();
        });
    });
    describe('setWord', () => {
        it('should set secret word and start timer', () => {
            const room = {
                code: 'XYZ123',
                status: types_1.RoomStatus.WORD_SETTING,
                players: [{ socketId: 'p1', role: types_1.Role.Host }],
                config: { timerMin: 5 },
            };
            const secretWords = new Map();
            const result = service.setWord(room, 'Apple', 'p1', secretWords);
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.QUESTIONING);
            expect(result.endTime).toBeGreaterThan(Date.now());
            expect(secretWords.get('XYZ123')).toBe('Apple');
        });
    });
    describe('submitVote', () => {
        it('should register vote and check resolution', () => {
            const room = {
                status: types_1.RoomStatus.VOTING,
                players: [
                    { socketId: 'p1', role: types_1.Role.Host, connected: true, score: 0 },
                    { socketId: 'p2', role: types_1.Role.Know, connected: true, score: 0 },
                    { socketId: 'p3', role: types_1.Role.Unknow, connected: true, score: 0 },
                    { socketId: 'p4', role: types_1.Role.Unknow, connected: true, score: 0 },
                ],
                votes: {},
            };
            service.submitVote(room, 'p3', 'p2');
            const result = service.submitVote(room, 'p4', 'p2');
            expect(result.status).toBe(types_1.RoomStatus.VOTING);
            const finalResult = service.submitVote(room, 'p2', 'p3');
            expect(finalResult.status).toBe(types_1.RoomStatus.RESULT);
            expect(finalResult.winner).toBe('COMMONERS');
            expect(finalResult.players[2].score).toBe(1);
            expect(finalResult.players[3].score).toBe(1);
        });
        it('should result in INSIDER win if insider is not correctly caught', () => {
            const room = {
                status: types_1.RoomStatus.VOTING,
                players: [
                    { socketId: 'p1', role: types_1.Role.Host, connected: true, score: 0 },
                    { socketId: 'p2', role: types_1.Role.Know, connected: true, score: 0 },
                    { socketId: 'p3', role: types_1.Role.Unknow, connected: true, score: 0 },
                    { socketId: 'p4', role: types_1.Role.Unknow, connected: true, score: 0 },
                ],
                votes: {},
            };
            service.submitVote(room, 'p3', 'p4');
            service.submitVote(room, 'p4', 'p3');
            const result = service.submitVote(room, 'p2', 'p3');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.winner).toBe('INSIDER');
            expect(result.players[1].score).toBe(2);
        });
    });
});
//# sourceMappingURL=who-know.service.spec.js.map