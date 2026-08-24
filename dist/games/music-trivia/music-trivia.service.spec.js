"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const music_trivia_service_1 = require("./music-trivia.service");
const private_state_service_1 = require("../private-state.service");
const types_1 = require("@repo/types");
describe('MusicTriviaService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [music_trivia_service_1.MusicTriviaService, private_state_service_1.PrivateStateService],
        }).compile();
        service = module.get(music_trivia_service_1.MusicTriviaService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('startGame', () => {
        it('should initialize game state correctly', () => {
            const room = {
                id: 'room-1',
                gameType: types_1.GameType.MUSIC_TRIVIA,
                code: 'ABCD',
                status: types_1.RoomStatus.LOBBY,
                roomHostId: 'host-1',
                players: [
                    {
                        id: '1',
                        socketId: 'host-1',
                        name: 'Host',
                        score: 0,
                        roomId: 'room-1',
                        connected: true,
                    },
                    {
                        id: '2',
                        socketId: 'player-2',
                        name: 'Player',
                        score: 0,
                        roomId: 'room-1',
                        connected: true,
                    },
                ],
                createdAt: new Date(),
                config: {
                    hostSelection: 'FIXED',
                    timerMin: 5,
                    musicTriviaMode: 'TYPING',
                    musicTriviaSource: 'ITUNES',
                    musicTriviaRounds: 10,
                    musicTriviaHostPlays: true,
                    musicTriviaAnswerTimeoutMs: 15000,
                },
            };
            const result = service.startGame(room, 'host-1');
            expect(result).not.toBeNull();
            expect(result?.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result?.musicTriviaState).toBeDefined();
            expect(result?.musicTriviaState?.phase).toBe('SETUP');
            expect(result?.musicTriviaState?.mode).toBe('TYPING');
            expect(result?.musicTriviaState?.totalRounds).toBe(10);
            expect(result?.musicTriviaState?.scores['host-1']).toBe(0);
            expect(result?.musicTriviaState?.scores['player-2']).toBe(0);
        });
        it('should return null if requester is not host', () => {
            const room = {
                id: 'room-1',
                gameType: types_1.GameType.MUSIC_TRIVIA,
                code: 'ABCD',
                status: types_1.RoomStatus.LOBBY,
                roomHostId: 'host-1',
                players: [
                    {
                        id: '1',
                        socketId: 'host-1',
                        name: 'Host',
                        score: 0,
                        roomId: 'room-1',
                        connected: true,
                    },
                    {
                        id: '2',
                        socketId: 'player-2',
                        name: 'Player',
                        score: 0,
                        roomId: 'room-1',
                        connected: true,
                    },
                ],
                createdAt: new Date(),
                config: { hostSelection: 'FIXED', timerMin: 5 },
            };
            const result = service.startGame(room, 'player-2');
            expect(result).toBeNull();
        });
        it('should return null if less than 2 players', () => {
            const room = {
                id: 'room-1',
                gameType: types_1.GameType.MUSIC_TRIVIA,
                code: 'ABCD',
                status: types_1.RoomStatus.LOBBY,
                roomHostId: 'host-1',
                players: [
                    {
                        id: '1',
                        socketId: 'host-1',
                        name: 'Host',
                        score: 0,
                        roomId: 'room-1',
                        connected: true,
                    },
                ],
                createdAt: new Date(),
                config: { hostSelection: 'FIXED', timerMin: 5 },
            };
            const result = service.startGame(room, 'host-1');
            expect(result).toBeNull();
        });
    });
    describe('fuzzyMatch', () => {
        it('should match exact strings', () => {
            expect(service.fuzzyMatch('Hello', 'Hello')).toBe(true);
        });
        it('should match with case insensitivity and whitespace handling', () => {
            expect(service.fuzzyMatch('  hello  world ', 'Hello World')).toBe(true);
        });
        it('should match with minor typos (Levenshtein >= 0.75)', () => {
            expect(service.fuzzyMatch('Dynamit', 'Dynamite')).toBe(true);
            expect(service.fuzzyMatch('BTS', 'BTS')).toBe(true);
            expect(service.fuzzyMatch('shape of yo', 'shape of you')).toBe(true);
        });
        it('should not match if completely different', () => {
            expect(service.fuzzyMatch('Butter', 'Dynamite')).toBe(false);
            expect(service.fuzzyMatch('Ed Sheeran', 'Justin Bieber')).toBe(false);
        });
        it('should match if input is a strong partial match (>= 3 chars contained)', () => {
            expect(service.fuzzyMatch('sheeran', 'ed sheeran')).toBe(true);
            expect(service.fuzzyMatch('dynamite', 'dynamite (feat. someone)')).toBe(true);
        });
    });
    it('should reject PLAYER_READY from a socket that is not an active player', async () => {
        const room = {
            id: 'room-1',
            gameType: types_1.GameType.MUSIC_TRIVIA,
            code: 'ABCDEF',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 'host-1',
            players: [
                { id: '1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1' },
                { id: '2', socketId: 'player-2', name: 'Player', score: 0, roomId: 'room-1' },
            ],
            createdAt: new Date(),
            config: { hostSelection: 'FIXED', timerMin: 5 },
        };
        service.startGame(room, 'host-1');
        room.musicTriviaState.phase = 'GET_READY';
        const result = await service.handleGameAction(room, 'attacker', { type: 'PLAYER_READY' });
        expect(result).toBeNull();
        expect(room.musicTriviaState.readyPlayerIds).toEqual([]);
    });
    describe('answerTimeout', () => {
        function createAnsweringRoom() {
            const room = {
                id: 'room-1',
                gameType: types_1.GameType.MUSIC_TRIVIA,
                code: 'ABCDEF',
                status: types_1.RoomStatus.PLAYING,
                roomHostId: 'host-1',
                players: [
                    { id: '1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1' },
                    { id: '2', socketId: 'player-2', name: 'Player2', score: 0, roomId: 'room-1' },
                    { id: '3', socketId: 'player-3', name: 'Player3', score: 0, roomId: 'room-1' },
                ],
                createdAt: new Date(),
                config: {
                    hostSelection: 'FIXED',
                    timerMin: 5,
                    musicTriviaMode: 'TYPING',
                    musicTriviaSource: 'ITUNES',
                    musicTriviaRounds: 10,
                    musicTriviaHostPlays: false,
                    musicTriviaAnswerTimeoutMs: 15000,
                },
            };
            service.startGame(room, 'host-1');
            const state = room.musicTriviaState;
            state.phase = 'ANSWERING';
            state.playStartTime = Date.now();
            state.currentRound = {
                roundNumber: 1,
                track: {
                    id: 't1',
                    previewUrl: 'https://example.com/preview.m4a',
                    sourceType: 'ITUNES',
                    durationMs: 30000,
                },
                buzzerPresses: [],
                currentBuzzerId: 'player-2',
                struckOutIds: [],
                answeredCorrectly: false,
                winnerId: null,
            };
            return room;
        }
        it('strikes out the buzzer and resumes playing when the answer timer fires', () => {
            const room = createAnsweringRoom();
            const result = service.answerTimeout(room);
            expect(result).not.toBeNull();
            expect(result.room.musicTriviaState.phase).toBe('PLAYING');
            const round = result.room.musicTriviaState.currentRound;
            expect(round.struckOutIds).toContain('player-2');
            expect(round.currentBuzzerId).toBeNull();
            expect(result.syncPlay).toBeDefined();
        });
        it('reveals the answer when the timeout strikes out the last eligible player', () => {
            const room = createAnsweringRoom();
            room.players.find((p) => p.socketId === 'player-3').connected = false;
            room.musicTriviaState.currentRound.struckOutIds.push('player-3');
            const result = service.answerTimeout(room);
            expect(result).not.toBeNull();
            expect(result.room.musicTriviaState.phase).toBe('REVEAL');
        });
        it('returns null when no round is active', () => {
            const room = createAnsweringRoom();
            room.musicTriviaState.currentRound = null;
            expect(service.answerTimeout(room)).toBeNull();
        });
    });
});
//# sourceMappingURL=music-trivia.service.spec.js.map