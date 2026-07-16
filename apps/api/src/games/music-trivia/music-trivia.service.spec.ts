import { Test, TestingModule } from '@nestjs/testing';
import { MusicTriviaService } from './music-trivia.service';
import { RoomState, RoomStatus, GameType } from '@repo/types';

describe('MusicTriviaService', () => {
  let service: MusicTriviaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MusicTriviaService],
    }).compile();

    service = module.get<MusicTriviaService>(MusicTriviaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startGame', () => {
    it('should initialize game state correctly', () => {
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCD',
        status: RoomStatus.LOBBY,
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
      expect(result?.status).toBe(RoomStatus.PLAYING);
      expect(result?.musicTriviaState).toBeDefined();
      expect(result?.musicTriviaState?.phase).toBe('SETUP');
      expect(result?.musicTriviaState?.mode).toBe('TYPING');
      expect(result?.musicTriviaState?.totalRounds).toBe(10);
      expect(result?.musicTriviaState?.scores['host-1']).toBe(0);
      expect(result?.musicTriviaState?.scores['player-2']).toBe(0);
    });

    it('should return null if requester is not host', () => {
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCD',
        status: RoomStatus.LOBBY,
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
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCD',
        status: RoomStatus.LOBBY,
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
      // "Dynamite" length = 8. "Dynamit" length = 7. distance = 1. similarity = 1 - 1/8 = 0.875 >= 0.75
      expect(service.fuzzyMatch('Dynamit', 'Dynamite')).toBe(true);
      expect(service.fuzzyMatch('BTS', 'BTS')).toBe(true);
      expect(service.fuzzyMatch('shape of yo', 'shape of you')).toBe(true); // distance 1
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
    const room: RoomState = {
      id: 'room-1',
      gameType: GameType.MUSIC_TRIVIA,
      code: 'ABCDEF',
      status: RoomStatus.LOBBY,
      roomHostId: 'host-1',
      players: [
        { id: '1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1' },
        { id: '2', socketId: 'player-2', name: 'Player', score: 0, roomId: 'room-1' },
      ],
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 5 },
    };
    service.startGame(room, 'host-1');
    room.musicTriviaState!.phase = 'GET_READY';

    const result = await service.handleGameAction(room, 'attacker', { type: 'PLAYER_READY' });

    expect(result).toBeNull();
    expect(room.musicTriviaState!.readyPlayerIds).toEqual([]);
  });

  // More tests would be written to cover configureSource (mocking adapter),
  // pressBuzzer, submitAnswer, etc. but basic coverage is here for the core logic.
});
