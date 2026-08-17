"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const sounds_fishy_service_1 = require("./sounds-fishy.service");
const types_1 = require("@repo/types");
jest.mock('@repo/database', () => ({
    prisma: {
        soundsFishyQuestion: {
            aggregate: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
    },
}));
const database_1 = require("@repo/database");
describe('SoundsFishyService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [sounds_fishy_service_1.SoundsFishyService],
        }).compile();
        service = module.get(sounds_fishy_service_1.SoundsFishyService);
        jest.clearAllMocks();
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('assignRoles', () => {
        it('should assign roles and fetch question correctly', async () => {
            const room = {
                players: [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }],
                roomHostId: 'p1',
                config: { language: 'th' },
            };
            database_1.prisma.soundsFishyQuestion.aggregate.mockResolvedValue({
                _min: { query_count: 0 },
            });
            database_1.prisma.soundsFishyQuestion.findMany.mockResolvedValue([
                { id: 1, question: 'Q?', answer: 'A!', lang: 'th' },
            ]);
            database_1.prisma.soundsFishyQuestion.update.mockResolvedValue({});
            const result = await service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(database_1.prisma.soundsFishyQuestion.aggregate).toHaveBeenCalled();
            expect(database_1.prisma.soundsFishyQuestion.findMany).toHaveBeenCalled();
            expect(database_1.prisma.soundsFishyQuestion.update).toHaveBeenCalled();
            expect(result.room.status).toBe(types_1.RoomStatus.QUESTIONING);
            expect(result.room.soundsFishyState).toBeDefined();
            expect(result.room.soundsFishyState.question.question).toBe('Q?');
        });
        it('should return null if not enough players', async () => {
            const room = {
                players: [{ socketId: 'p1' }, { socketId: 'p2' }],
                roomHostId: 'p1',
            };
            const result = await service.assignRoles(room, 'p1');
            expect(result).toBeNull();
        });
    });
    describe('submitAnswer', () => {
        it('should allow answers and check resolution', () => {
            const room = {
                players: [
                    { socketId: 'p1', connected: true },
                    { socketId: 'p2', connected: true },
                    { socketId: 'p3', connected: true },
                ],
                soundsFishyState: {
                    currentPhase: types_1.SoundsFishyPhase.SETUP,
                    pickerId: 'p1',
                    redHerringIds: ['p2', 'p3'],
                    question: { answer: 'Truth' },
                    playerAnswers: {},
                },
            };
            let result = service.submitAnswer(room, 'p2', 'truth ');
            expect(result).toBeNull();
            result = service.submitAnswer(room, 'p2', 'Fake');
            expect(result).not.toBeNull();
            expect(result.soundsFishyState.playerAnswers['p2'].answer).toBe('Fake');
            result = service.submitAnswer(room, 'p3', 'Another Fake');
            expect(result.soundsFishyState.currentPhase).toBe(types_1.SoundsFishyPhase.THE_PITCH);
        });
    });
    describe('eliminatePlayer', () => {
        it('should correctly handle eliminating a Red Herring', () => {
            const room = {
                players: [
                    { socketId: 'p1', score: 0 },
                    { socketId: 'p2', score: 0 },
                    { socketId: 'p3', score: 0 },
                ],
                soundsFishyState: {
                    currentPhase: types_1.SoundsFishyPhase.THE_HUNT,
                    pickerId: 'p1',
                    blueFishId: 'p2',
                    redHerringIds: ['p3'],
                    eliminatedPlayers: [],
                    playerAnswers: {
                        p2: { isRevealed: true },
                        p3: { isRevealed: true },
                    },
                    roundScorePool: 0,
                    roundPoints: {},
                },
            };
            const result = service.eliminatePlayer(room, 'p1', 'p3');
            expect(result.soundsFishyState.eliminatedPlayers).toContain('p3');
            expect(result.soundsFishyState.roundScorePool).toBe(1);
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.players[0].score).toBe(1);
        });
        it('should correctly handle eliminating the Blue Fish', () => {
            const room = {
                players: [
                    { socketId: 'p1', score: 0 },
                    { socketId: 'p2', score: 0 },
                    { socketId: 'p3', score: 0 },
                ],
                soundsFishyState: {
                    currentPhase: types_1.SoundsFishyPhase.THE_HUNT,
                    pickerId: 'p1',
                    blueFishId: 'p2',
                    redHerringIds: ['p3'],
                    eliminatedPlayers: [],
                    playerAnswers: {
                        p2: { isRevealed: true },
                        p3: { isRevealed: true },
                    },
                    roundScorePool: 0,
                    roundPoints: {},
                },
            };
            const result = service.eliminatePlayer(room, 'p1', 'p2');
            expect(result.soundsFishyState.eliminatedPlayers).toContain('p2');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.players[1].score).toBe(1);
            expect(result.players[2].score).toBe(1);
        });
    });
});
//# sourceMappingURL=sounds-fishy.service.spec.js.map