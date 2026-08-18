"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const who_know_service_1 = require("./who-know.service");
const private_state_service_1 = require("../private-state.service");
const types_1 = require("@repo/types");
describe('WhoKnowService', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        privateState = new private_state_service_1.PrivateStateService();
        const module = await testing_1.Test.createTestingModule({
            providers: [who_know_service_1.WhoKnowService, { provide: private_state_service_1.PrivateStateService, useValue: privateState }],
        }).compile();
        service = module.get(who_know_service_1.WhoKnowService);
    });
    function createRoom(players, status = types_1.RoomStatus.LOBBY) {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: 'WHO_KNOW',
            status,
            roomHostId: 'p1',
            createdAt: new Date(),
            config: { hostSelection: 'FIXED', timerMin: 5 },
            players: players.map((p, i) => ({
                id: p.socketId,
                socketId: p.socketId,
                name: `P${i}`,
                score: 0,
                roomId: 'room-id',
                connected: true,
                ...p,
            })),
        };
    }
    const fourPlayers = () => [
        { socketId: 'p1', hasBeenHost: false },
        { socketId: 'p2', hasBeenHost: false },
        { socketId: 'p3', hasBeenHost: false },
        { socketId: 'p4', hasBeenHost: false },
    ];
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('assignRoles', () => {
        it('assigns roles privately and never broadcasts them', () => {
            const room = createRoom(fourPlayers());
            const result = service.assignRoles(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.room.status).toBe(types_1.RoomStatus.WORD_SETTING);
            expect(JSON.stringify(result.room)).not.toContain(types_1.Role.Know);
            expect(JSON.stringify(result.room.players)).not.toContain('"role"');
            const roles = Object.values(room.players.map((p) => privateState.get(room.code, p.socketId, 'wkRole')));
            expect(roles).toContain(types_1.Role.Host);
            expect(roles).toContain(types_1.Role.Know);
            expect(roles).toContain(types_1.Role.Unknow);
        });
        it('should fail if connected players count < 4', () => {
            const room = createRoom([
                { socketId: 'p1' },
                { socketId: 'p2' },
                { socketId: 'p3' },
                { socketId: 'p4', connected: false },
            ]);
            expect(service.assignRoles(room, 'p1')).toBeNull();
        });
        it('should fail when re-invoked mid-game', () => {
            const room = createRoom(fourPlayers(), types_1.RoomStatus.QUESTIONING);
            expect(service.assignRoles(room, 'p1')).toBeNull();
        });
    });
    describe('setWord', () => {
        function seedRoles(room) {
            privateState.set(room.code, 'p1', 'wkRole', types_1.Role.Host);
            privateState.set(room.code, 'p2', 'wkRole', types_1.Role.Know);
            privateState.set(room.code, 'p3', 'wkRole', types_1.Role.Unknow);
            privateState.set(room.code, 'p4', 'wkRole', types_1.Role.Unknow);
        }
        it('should set secret word and start timer', () => {
            const room = createRoom(fourPlayers(), types_1.RoomStatus.WORD_SETTING);
            seedRoles(room);
            const secretWords = new Map();
            const result = service.setWord(room, 'Apple', 'p1', secretWords);
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.QUESTIONING);
            expect(result.endTime).toBeGreaterThan(Date.now());
            expect(secretWords.get(room.code)).toBe('Apple');
        });
        it('rejects non-host callers, empty words, and oversized words', () => {
            const room = createRoom(fourPlayers(), types_1.RoomStatus.WORD_SETTING);
            seedRoles(room);
            const secretWords = new Map();
            expect(service.setWord(room, 'Apple', 'p2', secretWords)).toBeNull();
            expect(service.setWord(room, '   ', 'p1', secretWords)).toBeNull();
            expect(service.setWord(room, 'a'.repeat(61), 'p1', secretWords)).toBeNull();
            expect(secretWords.size).toBe(0);
        });
    });
    describe('submitVote', () => {
        function seedVotingRoom() {
            const room = createRoom(fourPlayers(), types_1.RoomStatus.VOTING);
            privateState.set(room.code, 'p1', 'wkRole', types_1.Role.Host);
            privateState.set(room.code, 'p2', 'wkRole', types_1.Role.Know);
            privateState.set(room.code, 'p3', 'wkRole', types_1.Role.Unknow);
            privateState.set(room.code, 'p4', 'wkRole', types_1.Role.Unknow);
            room.votes = {};
            return room;
        }
        it('should register votes privately and resolve correctly', () => {
            const room = seedVotingRoom();
            service.submitVote(room, 'p3', 'p2');
            const result = service.submitVote(room, 'p4', 'p2');
            expect(result.status).toBe(types_1.RoomStatus.VOTING);
            expect(result.votes).toEqual({});
            const finalResult = service.submitVote(room, 'p2', 'p3');
            expect(finalResult.status).toBe(types_1.RoomStatus.RESULT);
            expect(finalResult.winner).toBe('COMMONERS');
            expect(finalResult.players[2].score).toBe(1);
            expect(finalResult.players[3].score).toBe(1);
            expect(finalResult.votes).toEqual({ p2: 'p3', p3: 'p2', p4: 'p2' });
        });
        it('should result in INSIDER win if insider is not correctly caught', () => {
            const room = seedVotingRoom();
            service.submitVote(room, 'p3', 'p4');
            service.submitVote(room, 'p4', 'p3');
            const result = service.submitVote(room, 'p2', 'p3');
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.winner).toBe('INSIDER');
            expect(result.players[1].score).toBe(2);
        });
        it('rejects self votes, host votes, host targets, and double votes', () => {
            const room = seedVotingRoom();
            expect(service.submitVote(room, 'p3', 'p3')).toBeNull();
            expect(service.submitVote(room, 'p1', 'p2')).toBeNull();
            expect(service.submitVote(room, 'p3', 'p1')).toBeNull();
            expect(service.submitVote(room, 'p3', 'stranger')).toBeNull();
            expect(service.submitVote(room, 'p3', 'p2')).not.toBeNull();
            expect(service.submitVote(room, 'p3', 'p4')).toBeNull();
        });
    });
    describe('handleQuestioningTimeout', () => {
        it('moves QUESTIONING to RESULT with TIMEOUT winner and reveals roles', () => {
            const room = createRoom(fourPlayers(), types_1.RoomStatus.QUESTIONING);
            privateState.set(room.code, 'p2', 'wkRole', types_1.Role.Know);
            const result = service.handleQuestioningTimeout(room);
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.winner).toBe('TIMEOUT');
            expect(result.players[1].role).toBe(types_1.Role.Know);
        });
        it('ignores rooms not in QUESTIONING', () => {
            const room = createRoom(fourPlayers(), types_1.RoomStatus.VOTING);
            expect(service.handleQuestioningTimeout(room)).toBeNull();
        });
    });
});
//# sourceMappingURL=who-know.service.spec.js.map