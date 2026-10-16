import { Test, TestingModule } from '@nestjs/testing';
import { MusicTriviaService } from './music-trivia.service';
import { PrivateStateService } from '../private-state.service';
import { ArtistPresetService } from '../artist-preset.service';
import { RoomState, RoomStatus, GameType } from '@repo/types';

describe('MusicTriviaService', () => {
  let service: MusicTriviaService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicTriviaService,
        PrivateStateService,
        { provide: ArtistPresetService, useValue: { getCatalog: jest.fn(async () => null) } },
      ],
    }).compile();

    service = module.get<MusicTriviaService>(MusicTriviaService);
    privateState = module.get<PrivateStateService>(PrivateStateService);
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
        { id: '1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1', connected: true },
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
    service.startGame(room, 'host-1');
    room.musicTriviaState!.phase = 'GET_READY';

    const result = await service.handleGameAction(room, 'attacker', { type: 'PLAYER_READY' });

    expect(result).toBeNull();
    expect(room.musicTriviaState!.readyPlayerIds).toEqual([]);
  });

  describe('answerTimeout', () => {
    function createAnsweringRoom(): RoomState {
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCDEF',
        status: RoomStatus.LOBBY, // startGame only starts from the lobby…
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
      const state = room.musicTriviaState!;
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
      expect(result!.room.musicTriviaState!.phase).toBe('PLAYING');
      const round = result!.room.musicTriviaState!.currentRound!;
      expect(round.struckOutIds).toContain('player-2');
      expect(round.currentBuzzerId).toBeNull();
      // Music resumes so the other player can buzz in
      expect(result!.syncPlay).toBeDefined();
    });

    it('reveals the answer when the timeout strikes out the last eligible player', () => {
      const room = createAnsweringRoom();
      room.players.find((p) => p.socketId === 'player-3')!.connected = false;
      room.musicTriviaState!.currentRound!.struckOutIds.push('player-3');

      const result = service.answerTimeout(room);

      expect(result).not.toBeNull();
      expect(result!.room.musicTriviaState!.phase).toBe('REVEAL');
    });

    it('returns null when no round is active', () => {
      const room = createAnsweringRoom();
      room.musicTriviaState!.currentRound = null;

      expect(service.answerTimeout(room)).toBeNull();
    });

    it('reveals the answer when the deadline passes with nobody buzzing', () => {
      const room = createAnsweringRoom();
      // Nobody has buzzed yet: the round sits in PLAYING with no buzzer
      room.musicTriviaState!.phase = 'PLAYING';
      room.musicTriviaState!.currentRound!.currentBuzzerId = null;

      const result = service.answerTimeout(room);

      expect(result).not.toBeNull();
      expect(result!.room.musicTriviaState!.phase).toBe('REVEAL');
      // The round is kept intact for the history entry on NEXT_ROUND
      expect(result!.room.musicTriviaState!.currentRound).not.toBeNull();
    });

    it('cancels the answer timer when the last eligible player submits a wrong answer and triggers REVEAL', async () => {
      const room = createAnsweringRoom();
      privateState.set(room.code, '__ROOM__', 'mtTrackAnswers', [
        { id: 't1', title: 'Correct Title', artist: 'Correct Artist' },
      ]);
      room.musicTriviaState!.currentRound!.struckOutIds.push('player-3');

      const result = await service.handleGameAction(room, 'player-2', {
        type: 'SUBMIT_ANSWER',
        answer: 'Totally Wrong',
      });

      expect(result).not.toBeNull();
      expect(result!.room.musicTriviaState!.phase).toBe('REVEAL');
      expect(result!.timerCommands).toEqual([{ kind: 'CANCEL', name: 'music-trivia-answer' }]);
    });

    it('ignores stale answerTimeout callbacks once the round has resolved or advanced to COUNTDOWN', () => {
      const room = createAnsweringRoom();
      for (const phase of [
        'ANSWER_RESULT',
        'REVEAL',
        'GET_READY',
        'COUNTDOWN',
        'FINISHED',
      ] as const) {
        room.musicTriviaState!.phase = phase;
        expect(service.answerTimeout(room)).toBeNull();
      }
    });
  });

  describe('configureSource', () => {
    it('sends the host the round-1 answer in GAME_MASTER mode', async () => {
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
          musicTriviaMode: 'GAME_MASTER',
          musicTriviaSource: 'ITUNES',
          musicTriviaRounds: 1,
          musicTriviaHostPlays: false,
          musicTriviaAnswerTimeoutMs: 15000,
        },
      };
      expect(service.startGame(room, 'host-1')).not.toBeNull();
      service['sourceFactory'].register({
        sourceType: 'ITUNES',
        search: jest.fn().mockResolvedValue([
          {
            id: 'v1',
            title: 'Song A',
            artist: 'Artist A',
            trackViewUrl: 'https://x/1',
            album: 'Album',
            releaseYear: 2020,
            artworkUrl: 'https://img/1',
            durationMs: 30000,
            previewUrl: 'https://p/1',
            sourceType: 'ITUNES',
          },
        ]),
      });

      const actionResult = await service['configureSource'](room, 'host-1', {
        type: 'CONFIGURE_SOURCE',
        query: 'test',
      });

      expect(actionResult?.hostAnswerTo).toEqual({
        socketId: 'host-1',
        title: 'Song A',
        artist: 'Artist A',
        artworkUrl: 'https://img/1',
        trackViewUrl: 'https://x/1',
      });
    });

    it('sets errorReason to NO_TRACKS when no tracks are found', async () => {
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
          musicTriviaRounds: 5,
        },
      };
      service.startGame(room, 'host-1');
      service['sourceFactory'].register({
        sourceType: 'ITUNES',
        search: jest.fn().mockResolvedValue([]),
      });

      await service.handleGameAction(room, 'host-1', {
        type: 'CONFIGURE_SOURCE',
        query: 'nonexistent-song-xyz',
      });

      expect(room.musicTriviaState?.phase).toBe('SETUP');
      expect(room.musicTriviaState?.errorReason).toBe('NO_TRACKS');
      expect(room.musicTriviaState?.errorMessage).toBe(
        'No songs found for this search. Try a different artist or genre.',
      );
    });

    it('sets errorReason to PROVIDER_UNAVAILABLE when adapter throws network error', async () => {
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
          musicTriviaRounds: 5,
        },
      };
      service.startGame(room, 'host-1');
      service['sourceFactory'].register({
        sourceType: 'ITUNES',
        search: jest.fn().mockRejectedValue(new Error('Connection timed out')),
      });

      await service.handleGameAction(room, 'host-1', {
        type: 'CONFIGURE_SOURCE',
        query: 'rock music',
      });

      expect(room.musicTriviaState?.phase).toBe('SETUP');
      expect(room.musicTriviaState?.errorReason).toBe('PROVIDER_UNAVAILABLE');
      expect(room.musicTriviaState?.errorMessage).toBe('Connection timed out');
    });

    it('sets errorReason to PROVIDER_UNAVAILABLE when preset catalog is not found', async () => {
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
          musicTriviaArtistPresetId: 'missing-preset',
          musicTriviaLevel: 'EASY',
          musicTriviaRounds: 5,
        },
      };
      service.startGame(room, 'host-1');

      await service.handleGameAction(room, 'host-1', {
        type: 'CONFIGURE_SOURCE',
      });

      expect(room.musicTriviaState?.phase).toBe('SETUP');
      expect(room.musicTriviaState?.errorReason).toBe('PROVIDER_UNAVAILABLE');
    });
  });

  describe('hostJudge in GAME_MASTER mode', () => {
    it('sets answeredCorrectly, awards score, and transitions to ANSWER_RESULT on correct judgment', async () => {
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCD',
        status: RoomStatus.PLAYING,
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
          musicTriviaMode: 'GAME_MASTER',
          musicTriviaRounds: 5,
        },
        musicTriviaState: {
          phase: 'BUZZED',
          mode: 'GAME_MASTER',
          sourceType: 'ITUNES',
          totalRounds: 5,
          currentRound: {
            roundNumber: 1,
            track: { id: 't1', previewUrl: 'url', sourceType: 'ITUNES', durationMs: 30000 },
            buzzerPresses: [],
            currentBuzzerId: 'player-2',
            struckOutIds: [],
            answeredCorrectly: false,
            winnerId: null,
          },
          roundHistory: [],
          readyPlayerIds: [],
          scores: { 'host-1': 0, 'player-2': 0 },
          hostPlays: false,
          answerTimeoutMs: 15000,
        },
      };
      privateState.set(room.code, '__ROOM__', 'mtTrackAnswers', [
        { id: 't1', title: 'Song 1', artist: 'Artist 1' },
      ]);

      const result = await service.handleGameAction(room, 'host-1', {
        type: 'HOST_JUDGE',
        correct: true,
      });

      expect(result).not.toBeNull();
      expect(room.musicTriviaState?.phase).toBe('ANSWER_RESULT');
      expect(room.musicTriviaState?.currentRound?.answeredCorrectly).toBe(true);
      expect(room.musicTriviaState?.currentRound?.winnerId).toBe('player-2');
      expect(room.musicTriviaState?.scores['player-2']).toBe(1);
      expect(room.players[1].score).toBe(1);
    });

    it('strikes out buzzer and returns to PLAYING on incorrect judgment if other players remain', async () => {
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCD',
        status: RoomStatus.PLAYING,
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
            name: 'Player 2',
            score: 0,
            roomId: 'room-1',
            connected: true,
          },
          {
            id: '3',
            socketId: 'player-3',
            name: 'Player 3',
            score: 0,
            roomId: 'room-1',
            connected: true,
          },
        ],
        createdAt: new Date(),
        config: {
          hostSelection: 'FIXED',
          timerMin: 5,
          musicTriviaMode: 'GAME_MASTER',
          musicTriviaRounds: 5,
        },
        musicTriviaState: {
          phase: 'BUZZED',
          mode: 'GAME_MASTER',
          sourceType: 'ITUNES',
          totalRounds: 5,
          currentRound: {
            roundNumber: 1,
            track: { id: 't1', previewUrl: 'url', sourceType: 'ITUNES', durationMs: 30000 },
            buzzerPresses: [],
            currentBuzzerId: 'player-2',
            struckOutIds: [],
            answeredCorrectly: false,
            winnerId: null,
          },
          roundHistory: [],
          readyPlayerIds: [],
          scores: { 'host-1': 0, 'player-2': 0, 'player-3': 0 },
          hostPlays: false,
          answerTimeoutMs: 15000,
        },
      };

      const result = await service.handleGameAction(room, 'host-1', {
        type: 'HOST_JUDGE',
        correct: false,
      });

      expect(result).not.toBeNull();
      expect(room.musicTriviaState?.phase).toBe('PLAYING');
      expect(room.musicTriviaState?.currentRound?.struckOutIds).toContain('player-2');
      expect(room.musicTriviaState?.currentRound?.currentBuzzerId).toBeNull();
    });

    it('rejects judging attempts by guests or outside BUZZED phase', async () => {
      const room: RoomState = {
        id: 'room-1',
        gameType: GameType.MUSIC_TRIVIA,
        code: 'ABCD',
        status: RoomStatus.PLAYING,
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
          musicTriviaMode: 'GAME_MASTER',
          musicTriviaRounds: 5,
        },
        musicTriviaState: {
          phase: 'BUZZED',
          mode: 'GAME_MASTER',
          sourceType: 'ITUNES',
          totalRounds: 5,
          currentRound: {
            roundNumber: 1,
            track: { id: 't1', previewUrl: 'url', sourceType: 'ITUNES', durationMs: 30000 },
            buzzerPresses: [],
            currentBuzzerId: 'player-2',
            struckOutIds: [],
            answeredCorrectly: false,
            winnerId: null,
          },
          roundHistory: [],
          readyPlayerIds: [],
          scores: { 'host-1': 0, 'player-2': 0 },
          hostPlays: false,
          answerTimeoutMs: 15000,
        },
      };

      // Guest attempts to judge
      const guestResult = await service.handleGameAction(room, 'player-2', {
        type: 'HOST_JUDGE',
        correct: true,
      });
      expect(guestResult).toBeNull();

      // Host attempts to judge in PLAYING phase
      room.musicTriviaState!.phase = 'PLAYING';
      const wrongPhaseResult = await service.handleGameAction(room, 'host-1', {
        type: 'HOST_JUDGE',
        correct: true,
      });
      expect(wrongPhaseResult).toBeNull();
    });
  });

  it('finalizeCountdown returns null instead of crashing after a reset cleared the state', () => {
    const room: RoomState = {
      id: 'room-1',
      gameType: GameType.MUSIC_TRIVIA,
      code: 'ABCDEF',
      status: RoomStatus.LOBBY,
      roomHostId: 'host-1',
      players: [{ id: '1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1' }],
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 5 },
    };

    expect(service.finalizeCountdown(room)).toBeNull();
  });

  it('finalizeCountdown arms the per-round answer timeout when PLAYING starts', () => {
    const room: RoomState = {
      id: 'room-1',
      gameType: GameType.MUSIC_TRIVIA,
      code: 'ABCDEF',
      status: RoomStatus.LOBBY,
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
    const state = room.musicTriviaState!;
    state.phase = 'COUNTDOWN';
    state.playStartTime = undefined;
    state.currentRound = {
      roundNumber: 1,
      track: {
        id: 't1',
        previewUrl: 'https://example.com/preview.m4a',
        sourceType: 'ITUNES',
        durationMs: 30000,
      },
      buzzerPresses: [],
      currentBuzzerId: null,
      struckOutIds: [],
      answeredCorrectly: false,
      winnerId: null,
    };

    const result = service.finalizeCountdown(room);

    expect(result).not.toBeNull();
    const schedule = result!.timerCommands?.find((cmd) => cmd.kind === 'SCHEDULE');
    expect(schedule).toBeDefined();
    expect(schedule!.name).toBe('music-trivia-answer');
  });

  it('startGame refuses to restart a running game', () => {
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
    expect(service.startGame(room, 'host-1')).not.toBeNull();
    expect(room.status).toBe(RoomStatus.PLAYING);

    expect(service.startGame(room, 'host-1')).toBeNull();
  });

  describe('reconnect snapshots', () => {
    let room: RoomState;

    beforeEach(() => {
      room = {
        id: 'room-1',
        code: 'ABC123',
        gameType: GameType.MUSIC_TRIVIA,
        status: RoomStatus.PLAYING,
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
        musicTriviaState: {
          phase: 'PLAYING',
          mode: 'GAME_MASTER',
          sourceType: 'ITUNES',
          totalRounds: 2,
          currentRound: {
            roundNumber: 2,
            track: {
              id: 'track-2',
              previewUrl: 'https://example.com/clip.m4a',
              sourceType: 'ITUNES',
              durationMs: 30_000,
              artworkUrl: 'https://example.com/art.jpg',
            },
            buzzerPresses: [],
            currentBuzzerId: null,
            struckOutIds: [],
            answeredCorrectly: false,
            winnerId: null,
          },
          roundHistory: [],
          readyPlayerIds: [],
          scores: {},
          hostPlays: false,
          answerTimeoutMs: 15_000,
          playStartTime: Date.now() - 5_000,
        },
      };
      privateState.set(room.code, '__ROOM__', 'mtTrackAnswers', [
        { id: 'track-1', title: 'Old song', artist: 'Old artist' },
        {
          id: 'track-2',
          title: 'Current song',
          artist: 'Current artist',
          trackViewUrl: 'https://example.com/track-2',
        },
      ]);
    });

    it('restores only a live PLAYING clip with its original timestamp', () => {
      const stateBefore = JSON.stringify(room.musicTriviaState);
      expect(service.getCurrentSyncPlay(room)).toEqual({
        roundNumber: 2,
        playStartTime: room.musicTriviaState!.playStartTime,
        previewUrl: 'https://example.com/clip.m4a',
        sourceType: 'ITUNES',
        durationMs: 30_000,
        artworkUrl: 'https://example.com/art.jpg',
      });
      expect(JSON.stringify(room.musicTriviaState)).toBe(stateBefore);

      room.musicTriviaState!.phase = 'BUZZED';
      expect(service.getCurrentSyncPlay(room)).toBeNull();
      room.musicTriviaState!.phase = 'PLAYING';
      room.musicTriviaState!.playStartTime = Date.now() - 30_000;
      expect(service.getCurrentSyncPlay(room)).toBeNull();
      room.musicTriviaState!.playStartTime = Date.now() + 1_000;
      expect(service.getCurrentSyncPlay(room)).toBeNull();
      room.musicTriviaState!.playStartTime = undefined;
      expect(service.getCurrentSyncPlay(room)).toBeNull();
    });

    it('restores a private hint only for the current eligible host and round', () => {
      expect(service.getCurrentHostAnswer(room, 'host-1')).toEqual({
        title: 'Current song',
        artist: 'Current artist',
        artworkUrl: 'https://example.com/art.jpg',
        trackViewUrl: 'https://example.com/track-2',
      });
      expect(service.getCurrentHostAnswer(room, 'player-2')).toBeNull();

      room.roomHostId = 'player-2';
      expect(service.getCurrentHostAnswer(room, 'host-1')).toBeNull();
      expect(service.getCurrentHostAnswer(room, 'player-2')?.title).toBe('Current song');
      room.players[1].isViewer = true;
      expect(service.getCurrentHostAnswer(room, 'player-2')).toBeNull();
    });

    it('withholds hints outside an active GM round', () => {
      for (const phase of ['GET_READY', 'COUNTDOWN', 'PLAYING', 'BUZZED', 'ANSWERING'] as const) {
        room.musicTriviaState!.phase = phase;
        expect(service.getCurrentHostAnswer(room, 'host-1')?.title).toBe('Current song');
      }
      room.musicTriviaState!.phase = 'REVEAL';
      expect(service.getCurrentHostAnswer(room, 'host-1')).toBeNull();
      room.musicTriviaState!.phase = 'PLAYING';
      room.musicTriviaState!.hostPlays = true;
      expect(service.getCurrentHostAnswer(room, 'host-1')).toBeNull();
      room.musicTriviaState!.hostPlays = false;
      room.musicTriviaState!.mode = 'TYPING';
      expect(service.getCurrentHostAnswer(room, 'host-1')).toBeNull();
    });

    it('remaps socket ID across scores, round state, struck-outs, buzzer, and ready IDs without resetting timer', () => {
      const state = room.musicTriviaState!;
      state.scores['player-2'] = 3;
      state.readyPlayerIds = ['player-2', 'host-1'];
      state.currentRound!.currentBuzzerId = 'player-2';
      state.currentRound!.winnerId = 'player-2';
      state.currentRound!.struckOutIds = ['player-2'];
      state.currentRound!.buzzerPresses = [
        { playerId: 'player-2', timestamp: Date.now() - 1000, reactionTimeMs: 1200 },
      ];
      state.roundHistory = [
        {
          roundNumber: 1,
          winnerId: 'player-2',
          trackTitle: 'Old song',
          artistName: 'Old artist',
        },
      ];
      const initialPlayStartTime = state.playStartTime;

      service.remapSocketId(state, 'player-2', 'player-2-reconnected');

      expect(state.scores['player-2']).toBeUndefined();
      expect(state.scores['player-2-reconnected']).toBe(3);
      expect(state.readyPlayerIds).toEqual(['player-2-reconnected', 'host-1']);
      expect(state.currentRound!.currentBuzzerId).toBe('player-2-reconnected');
      expect(state.currentRound!.winnerId).toBe('player-2-reconnected');
      expect(state.currentRound!.struckOutIds).toEqual(['player-2-reconnected']);
      expect(state.currentRound!.buzzerPresses[0].playerId).toBe('player-2-reconnected');
      expect(state.roundHistory[0].winnerId).toBe('player-2-reconnected');
      // Timer and round number must NOT be reset
      expect(state.playStartTime).toBe(initialPlayStartTime);
      expect(state.currentRound!.roundNumber).toBe(2);
    });

    it('ensures guest reconnecting in TYPING mode never receives host answer', () => {
      room.musicTriviaState!.mode = 'TYPING';
      expect(service.getCurrentHostAnswer(room, 'player-2')).toBeNull();
      expect(service.getCurrentHostAnswer(room, 'host-1')).toBeNull();
    });
  });
});
