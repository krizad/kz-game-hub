import { Test, TestingModule } from '@nestjs/testing';
import { WhoAmIService } from './who-am-i.service';
import { RoomState, RoomStatus, GameType } from '@repo/types';

jest.mock('@repo/database', () => ({
  prisma: {
    word: {
      groupBy: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  },
}));

import { prisma } from '@repo/database';

describe('WhoAmIService', () => {
  let service: WhoAmIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhoAmIService],
    }).compile();

    service = module.get<WhoAmIService>(WhoAmIService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCategories', () => {
    it('should fetch and map categories from DB', async () => {
      (prisma.word.groupBy as jest.Mock).mockResolvedValue([
        { category: 'Animals', _count: { id: 5 } },
        { category: 'Food', _count: { id: 3 } },
      ]);

      const result = await service.getCategories();
      expect(prisma.word.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        _count: { id: true },
      });
      expect(result).toEqual([
        { name: 'Animals', count: 5 },
        { name: 'Food', count: 3 },
      ]);
    });

    it('should return empty array when no categories', async () => {
      (prisma.word.groupBy as jest.Mock).mockResolvedValue([]);
      const result = await service.getCategories();
      expect(result).toEqual([]);
    });
  });

  describe('startGameHostInput', () => {
    it('should start game in HOST_INPUT mode', () => {
      const room = {
        status: RoomStatus.LOBBY,
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
        config: { wordMode: 'HOST_INPUT', maxRounds: 5 },
      } as unknown as RoomState;

      const playerWords = { p1: 'Apple', p2: 'Banana' };
      const result = service.startGameHostInput(room, 'host1', playerWords);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.whoAmIState).toBeDefined();
      expect(result!.whoAmIState!.phase).toBe('ASKING');
      expect(result!.whoAmIState!.playerWords).toEqual(playerWords);
      expect(result!.whoAmIState!.turnStatus).toBe('VOTING');
      expect(result!.whoAmIState!.currentRound).toBe(1);
      expect(result!.whoAmIState!.maxRounds).toBe(5);
      expect(result!.whoAmIState!.eliminatedPlayers).toEqual([]);
      expect(result!.whoAmIState!.winner).toBeNull();
      expect(['p1', 'p2']).toContain(result!.whoAmIState!.currentTurn);
    });

    it('should return null if requester is not host', () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'HOST_INPUT' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
      } as unknown as RoomState;

      expect(service.startGameHostInput(room, 'p1', {})).toBeNull();
    });

    it('should return null if config wordMode is not HOST_INPUT', () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'RANDOM' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
      } as unknown as RoomState;

      expect(service.startGameHostInput(room, 'host1', {})).toBeNull();
    });

    it('should return null if fewer than 2 non-host players', () => {
      const room = {
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
        config: { wordMode: 'HOST_INPUT' },
      } as unknown as RoomState;

      expect(service.startGameHostInput(room, 'host1', { p1: 'Word' })).toBeNull();
    });

    it('should return null if a player word is missing or empty', () => {
      const room = {
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
        config: { wordMode: 'HOST_INPUT' },
      } as unknown as RoomState;

      expect(service.startGameHostInput(room, 'host1', { p1: 'Word' })).toBeNull();
      expect(service.startGameHostInput(room, 'host1', { p1: 'Word', p2: '  ' })).toBeNull();
    });
  });

  describe('startGameRandom', () => {
    it('should fetch random words from DB and start game', async () => {
      const room = {
        status: RoomStatus.LOBBY,
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
        config: { wordMode: 'RANDOM', wordCategory: 'Food', maxRounds: 3 },
      } as unknown as RoomState;

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        { word: 'Pizza', emoji: '🍕' },
        { word: 'Sushi', emoji: '🍣' },
        { word: 'Taco', emoji: '🌮' },
      ]);

      const result = await service.startGameRandom(room, 'host1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.whoAmIState).toBeDefined();
      expect(result!.whoAmIState!.phase).toBe('ASKING');
      expect(result!.whoAmIState!.maxRounds).toBe(3);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should return null if requester is not host', async () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'RANDOM', wordCategory: 'Food' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
      } as unknown as RoomState;

      expect(await service.startGameRandom(room, 'p1')).toBeNull();
    });

    it('should return null if wordMode is not RANDOM', async () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'HOST_INPUT', wordCategory: 'Food' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
      } as unknown as RoomState;

      expect(await service.startGameRandom(room, 'host1')).toBeNull();
    });

    it('should return null if fewer than 2 players', async () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'RANDOM', wordCategory: 'Food' },
        players: [{ socketId: 'host1' }],
      } as unknown as RoomState;

      expect(await service.startGameRandom(room, 'host1')).toBeNull();
    });

    it('should return null if no wordCategory configured', async () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'RANDOM' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
      } as unknown as RoomState;

      expect(await service.startGameRandom(room, 'host1')).toBeNull();
    });

    it('should return null if not enough words in DB', async () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'RANDOM', wordCategory: 'Food' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
      } as unknown as RoomState;

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ word: 'Pizza', emoji: '🍕' }]);

      expect(await service.startGameRandom(room, 'host1')).toBeNull();
    });

    it('should assign words with emoji prefix when present', async () => {
      const room = {
        status: RoomStatus.LOBBY,
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
        config: { wordMode: 'RANDOM', wordCategory: 'Food' },
      } as unknown as RoomState;

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        { word: 'Pizza', emoji: '🍕' },
        { word: 'Sushi', emoji: null },
      ]);

      const result = await service.startGameRandom(room, 'host1');
      expect(result).not.toBeNull();

      const words = result!.whoAmIState!.playerWords;
      expect(Object.values(words)).toContain('🍕 Pizza');
      expect(Object.values(words)).toContain('Sushi');
    });
  });

  describe('startGamePlayerInput', () => {
    it('should enter COLLECTING_WORDS phase', () => {
      const room = {
        status: RoomStatus.LOBBY,
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
        config: { wordMode: 'PLAYER_INPUT', wordCategory: 'Animals', maxRounds: 4 },
      } as unknown as RoomState;

      const result = service.startGamePlayerInput(room, 'host1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.whoAmIState!.phase).toBe('COLLECTING_WORDS');
      expect(result!.whoAmIState!.wordSubmissions).toEqual({});
      expect(result!.whoAmIState!.wordSubmissionCategory).toBe('Animals');
      expect(result!.whoAmIState!.currentRound).toBe(1);
      expect(result!.whoAmIState!.maxRounds).toBe(4);
    });

    it('should return null if requester is not host', () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'PLAYER_INPUT' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }, { socketId: 'p2' }],
      } as unknown as RoomState;

      expect(service.startGamePlayerInput(room, 'p1')).toBeNull();
    });

    it('should return null if wordMode is not PLAYER_INPUT', () => {
      const room = {
        roomHostId: 'host1',
        config: { wordMode: 'HOST_INPUT' },
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
      } as unknown as RoomState;

      expect(service.startGamePlayerInput(room, 'host1')).toBeNull();
    });

    it('should return null if fewer than 2 players', () => {
      const room = {
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }],
        config: { wordMode: 'PLAYER_INPUT' },
      } as unknown as RoomState;

      expect(service.startGamePlayerInput(room, 'host1')).toBeNull();
    });

    it('should default wordSubmissionCategory to empty string', () => {
      const room = {
        status: RoomStatus.LOBBY,
        roomHostId: 'host1',
        players: [{ socketId: 'host1' }, { socketId: 'p1' }],
        config: { wordMode: 'PLAYER_INPUT' },
      } as unknown as RoomState;

      const result = service.startGamePlayerInput(room, 'host1');
      expect(result!.whoAmIState!.wordSubmissionCategory).toBe('');
    });
  });

  describe('submitPlayerWord', () => {
    function makeCollectingRoom() {
      return {
        status: RoomStatus.PLAYING,
        players: [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }],
        whoAmIState: {
          currentTurn: '',
          playerWords: {},
          currentGuess: null,
          votes: {},
          turnStatus: 'VOTING',
          winner: null,
          currentRound: 1,
          maxRounds: 3,
          eliminatedPlayers: [],
          phase: 'COLLECTING_WORDS',
          finalGuessUsed: [],
          wordSubmissions: {},
        },
      } as unknown as RoomState;
    }

    it('should accept a word submission', () => {
      const room = makeCollectingRoom();
      const result = service.submitPlayerWord(room, 'p1', 'Elephant');

      expect(result).not.toBeNull();
      expect(result!.room.whoAmIState!.wordSubmissions!['p1']).toBe('Elephant');
      expect(result!.error).toBeUndefined();
    });

    it('should lowercase the word for duplicate checking but preserve original casing', () => {
      const room = makeCollectingRoom();
      const result = service.submitPlayerWord(room, 'p1', '  Elephant  ');

      expect(result).not.toBeNull();
      expect(result!.room.whoAmIState!.wordSubmissions!['p1']).toBe('Elephant');
    });

    it('should return null if room is not PLAYING', () => {
      const room = {
        status: RoomStatus.LOBBY,
        whoAmIState: { phase: 'COLLECTING_WORDS', wordSubmissions: {} },
        players: [{ socketId: 'p1' }],
      } as unknown as RoomState;

      expect(service.submitPlayerWord(room, 'p1', 'Word')).toBeNull();
    });

    it('should return null if no gameState', () => {
      const room = {
        status: RoomStatus.PLAYING,
        players: [{ socketId: 'p1' }],
      } as unknown as RoomState;

      expect(service.submitPlayerWord(room, 'p1', 'Word')).toBeNull();
    });

    it('should return null if not in COLLECTING_WORDS phase', () => {
      const room = {
        status: RoomStatus.PLAYING,
        players: [{ socketId: 'p1' }],
        whoAmIState: { phase: 'ASKING', wordSubmissions: {} },
      } as unknown as RoomState;

      expect(service.submitPlayerWord(room, 'p1', 'Word')).toBeNull();
    });

    it('should return null if player is not in room', () => {
      const room = {
        status: RoomStatus.PLAYING,
        players: [{ socketId: 'p1' }],
        whoAmIState: { phase: 'COLLECTING_WORDS', wordSubmissions: {} },
      } as unknown as RoomState;

      expect(service.submitPlayerWord(room, 'p2', 'Word')).toBeNull();
    });

    it('should return null for empty word', () => {
      const room = makeCollectingRoom();
      expect(service.submitPlayerWord(room, 'p1', '')).toBeNull();
      expect(service.submitPlayerWord(room, 'p1', '   ')).toBeNull();
    });

    it('should reject duplicate words and clear both submissions', () => {
      const room = makeCollectingRoom();
      room.whoAmIState!.wordSubmissions = { p2: 'Apple' };

      const result = service.submitPlayerWord(room, 'p1', 'Apple');

      expect(result).not.toBeNull();
      expect(result!.error).toContain('Duplicate');
      expect(result!.room.whoAmIState!.wordSubmissions!['p1']).toBeUndefined();
      expect(result!.room.whoAmIState!.wordSubmissions!['p2']).toBeUndefined();
    });

    it('should transition from COLLECTING_WORDS to ASKING when all players submit', () => {
      const room = makeCollectingRoom();

      service.submitPlayerWord(room, 'p1', 'Elephant');
      service.submitPlayerWord(room, 'p2', 'Tiger');
      const result = service.submitPlayerWord(room, 'p3', 'Giraffe');

      expect(result).not.toBeNull();
      expect(result!.room.whoAmIState!.phase).toBe('ASKING');
      expect(result!.room.whoAmIState!.playerWords).toBeDefined();

      const assignedWords = result!.room.whoAmIState!.playerWords;
      expect(Object.keys(assignedWords).length).toBe(3);
      expect(Object.values(assignedWords)).toContain('Elephant');
      expect(Object.values(assignedWords)).toContain('Tiger');
      expect(Object.values(assignedWords)).toContain('Giraffe');

      // No player should get their own word (derangement check)
      room.players.forEach((p) => {
        expect(assignedWords[p.socketId]).not.toBe(
          result!.room.whoAmIState!.wordSubmissions?.[p.socketId],
        );
      });
    });
  });

  describe('handleGameAction', () => {
    function makeAskingRoom(overrides: Record<string, unknown> = {}) {
      return {
        gameType: GameType.WHO_AM_I,
        status: RoomStatus.PLAYING,
        roomHostId: 'host1',
        players: [
          { socketId: 'host1' },
          { socketId: 'p1' },
          { socketId: 'p2' },
          { socketId: 'p3' },
        ],
        config: { wordMode: 'PLAYER_INPUT', maxRounds: 3 },
        whoAmIState: {
          currentTurn: 'p1',
          playerWords: { p1: 'Apple', p2: 'Banana', p3: 'Cherry' },
          currentGuess: null,
          votes: {},
          turnStatus: 'VOTING',
          winner: null,
          currentRound: 1,
          maxRounds: 3,
          eliminatedPlayers: [],
          phase: 'ASKING',
          finalGuessUsed: [],
          ...overrides,
        },
      } as unknown as RoomState;
    }

    it('should return null if room is not PLAYING', () => {
      const room = {
        status: RoomStatus.LOBBY,
        whoAmIState: {},
      } as unknown as RoomState;

      expect(service.handleGameAction(room, 'p1', { type: 'SUBMIT_GUESS' })).toBeNull();
    });

    it('should return null if no gameState', () => {
      const room = {
        status: RoomStatus.PLAYING,
      } as unknown as RoomState;

      expect(service.handleGameAction(room, 'p1', { type: 'SUBMIT_GUESS' })).toBeNull();
    });

    it('should return null during COLLECTING_WORDS phase', () => {
      const room = makeAskingRoom({ phase: 'COLLECTING_WORDS' });
      expect(service.handleGameAction(room, 'p1', { type: 'SUBMIT_GUESS', guess: 'X' })).toBeNull();
    });

    it('should return null for unknown action type', () => {
      const room = makeAskingRoom();
      expect(service.handleGameAction(room, 'p1', { type: 'UNKNOWN' })).toBeNull();
    });

    describe('SUBMIT_GUESS', () => {
      it('should return null for SUBMIT_GUESS (unhandled action type)', () => {
        const room = makeAskingRoom();
        const result = service.handleGameAction(room, 'p1', {
          type: 'SUBMIT_GUESS',
          guess: 'Is it red?',
        });

        expect(result).toBeNull();
      });

      it('should return null if not current player', () => {
        const room = makeAskingRoom();
        expect(
          service.handleGameAction(room, 'p2', {
            type: 'SUBMIT_GUESS',
            guess: 'Question',
          }),
        ).toBeNull();
      });

      it('should return null if not THINKING status', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(
          service.handleGameAction(room, 'p1', {
            type: 'SUBMIT_GUESS',
            guess: 'Question',
          }),
        ).toBeNull();
      });

      it('should return null if guess is not a string', () => {
        const room = makeAskingRoom();
        expect(service.handleGameAction(room, 'p1', { type: 'SUBMIT_GUESS' })).toBeNull();
        expect(
          service.handleGameAction(room, 'p1', { type: 'SUBMIT_GUESS', guess: 123 }),
        ).toBeNull();
      });
    });

    describe('VOTE_GUESS', () => {
      it('should record a YES vote', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING', currentGuess: 'Is it red?' });
        const result = service.handleGameAction(room, 'p2', {
          type: 'VOTE_GUESS',
          vote: 'YES',
        });

        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.votes['p2']).toBe('YES');
      });

      it('should record a NO vote', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        const result = service.handleGameAction(room, 'p2', {
          type: 'VOTE_GUESS',
          vote: 'NO',
        });

        expect(result!.whoAmIState!.votes['p2']).toBe('NO');
      });

      it('should record a MAYBE vote', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        const result = service.handleGameAction(room, 'p2', {
          type: 'VOTE_GUESS',
          vote: 'MAYBE',
        });

        expect(result!.whoAmIState!.votes['p2']).toBe('MAYBE');
      });

      it('should return null if the voter is the current turn player', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(
          service.handleGameAction(room, 'p1', {
            type: 'VOTE_GUESS',
            vote: 'YES',
          }),
        ).toBeNull();
      });

      it('should return null if turnStatus is THINKING', () => {
        const room = makeAskingRoom({ turnStatus: 'THINKING' });
        expect(
          service.handleGameAction(room, 'p2', {
            type: 'VOTE_GUESS',
            vote: 'YES',
          }),
        ).toBeNull();
      });

      it('should return null if player is not in room', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(
          service.handleGameAction(room, 'p5', {
            type: 'VOTE_GUESS',
            vote: 'YES',
          }),
        ).toBeNull();
      });

      it('should return null for invalid vote value', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(
          service.handleGameAction(room, 'p2', {
            type: 'VOTE_GUESS',
            vote: 'INVALID',
          }),
        ).toBeNull();
      });

      it('should allow voting in RESULT status', () => {
        const room = makeAskingRoom({ turnStatus: 'RESULT', currentTurn: 'p2' });
        const result = service.handleGameAction(room, 'p1', {
          type: 'VOTE_GUESS',
          vote: 'MAYBE',
        });

        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.votes['p1']).toBe('MAYBE');
      });
    });

    describe('END_TURN', () => {
      it('should advance to next player on END_TURN', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        const result = service.handleGameAction(room, 'p1', { type: 'END_TURN' });

        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.currentTurn).toBe('p2');
        expect(result!.whoAmIState!.turnStatus).toBe('VOTING');
        expect(result!.whoAmIState!.currentGuess).toBeNull();
        expect(result!.whoAmIState!.votes).toEqual({});
      });

      it('should skip eliminated players', () => {
        const room = makeAskingRoom({
          turnStatus: 'VOTING',
          eliminatedPlayers: ['p2'],
        });
        const result = service.handleGameAction(room, 'p1', { type: 'END_TURN' });

        expect(result!.whoAmIState!.currentTurn).toBe('p3');
      });

      it('should return null if not current player', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(service.handleGameAction(room, 'p2', { type: 'END_TURN' })).toBeNull();
      });

      it('should return null if not VOTING status', () => {
        const room = makeAskingRoom({ turnStatus: 'RESULT' });
        expect(service.handleGameAction(room, 'p1', { type: 'END_TURN' })).toBeNull();
      });

      it('should return null if in FINAL_GUESS phase', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING', phase: 'FINAL_GUESS' });
        expect(service.handleGameAction(room, 'p1', { type: 'END_TURN' })).toBeNull();
      });

      it('should increment round and enter FINAL_GUESS if wraparound exceeds maxRounds', () => {
        const room = makeAskingRoom({
          turnStatus: 'VOTING',
          currentTurn: 'p3',
          currentRound: 3,
          maxRounds: 3,
        });

        const result = service.handleGameAction(room, 'p3', { type: 'END_TURN' });
        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.phase).toBe('FINAL_GUESS');
        expect(result!.whoAmIState!.currentRound).toBe(4);
      });
    });

    describe('GUESS_WORD', () => {
      it('should record a final guess and set turn to RESULT', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        const result = service.handleGameAction(room, 'p1', {
          type: 'GUESS_WORD',
          guess: 'Apple',
        });

        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.turnStatus).toBe('RESULT');
        expect(result!.whoAmIState!.guessResult).toBe(true);
        expect(result!.whoAmIState!.guessedWord).toBe('Apple');
        expect(result!.whoAmIState!.votes).toEqual({});
      });

      it('should return null if not current player', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(
          service.handleGameAction(room, 'p2', {
            type: 'GUESS_WORD',
            guess: 'Apple',
          }),
        ).toBeNull();
      });

      it('should return null if not VOTING status', () => {
        const room = makeAskingRoom({ turnStatus: 'RESULT' });
        expect(
          service.handleGameAction(room, 'p1', {
            type: 'GUESS_WORD',
            guess: 'Apple',
          }),
        ).toBeNull();
      });

      it('should return null if guess is empty', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(
          service.handleGameAction(room, 'p1', {
            type: 'GUESS_WORD',
            guess: '',
          }),
        ).toBeNull();
        expect(
          service.handleGameAction(room, 'p1', {
            type: 'GUESS_WORD',
            guess: '  ',
          }),
        ).toBeNull();
      });

      it('should return null if player is eliminated', () => {
        const room = makeAskingRoom({
          turnStatus: 'VOTING',
          eliminatedPlayers: ['p1'],
        });
        expect(
          service.handleGameAction(room, 'p1', {
            type: 'GUESS_WORD',
            guess: 'Apple',
          }),
        ).toBeNull();
      });
    });

    describe('END_MATCH', () => {
      it('should return null because handleGameAction requires PLAYING but resetGame requires RESULT', () => {
        const room = {
          status: RoomStatus.PLAYING,
          roomHostId: 'host1',
          whoAmIState: { winner: 'p1' },
        } as unknown as RoomState;

        const result = service.handleGameAction(room, 'host1', { type: 'END_MATCH' });
        expect(result).toBeNull();
      });
    });

    describe('NEXT_TURN', () => {
      it('should declare winner on correct guess with majority YES votes', () => {
        const room = makeAskingRoom({
          turnStatus: 'RESULT',
          guessResult: true,
          guessedWord: 'Apple',
          votes: { p2: 'YES', p3: 'YES' },
        });
        room.players[1].score = 0;

        const result = service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' });
        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.winner).toBe('p1');
        expect(result!.status).toBe(RoomStatus.RESULT);
        expect(result!.players[1].score).toBe(1);
      });

      it('should eliminate player on wrong guess (more NO than YES)', () => {
        const room = makeAskingRoom({
          turnStatus: 'RESULT',
          guessResult: true,
          guessedWord: 'Wrong',
          votes: { p2: 'NO', p3: 'NO' },
        });

        const result = service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' });
        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.eliminatedPlayers).toContain('p1');
        expect(result!.whoAmIState!.currentTurn).not.toBe('p1');
        expect(result!.whoAmIState!.turnStatus).toBe('VOTING');
      });

      it('should allow host to execute NEXT_TURN', () => {
        const room = makeAskingRoom({
          turnStatus: 'RESULT',
          guessResult: true,
          guessedWord: 'Word',
          votes: { p2: 'YES', p3: 'YES' },
        });
        room.players[1].score = 0;

        const result = service.handleGameAction(room, 'host1', { type: 'NEXT_TURN' });
        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.winner).toBe('p1');
      });

      it('should return null if turnStatus is not RESULT', () => {
        const room = makeAskingRoom({ turnStatus: 'VOTING' });
        expect(service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' })).toBeNull();
      });

      it('should return null if requester is not current player or host', () => {
        const room = makeAskingRoom({
          turnStatus: 'RESULT',
          currentTurn: 'p1',
          guessResult: true,
        });

        expect(service.handleGameAction(room, 'p2', { type: 'NEXT_TURN' })).toBeNull();
      });

      it('should end game when all players eliminated', () => {
        const room = {
          gameType: GameType.WHO_AM_I,
          status: RoomStatus.PLAYING,
          roomHostId: 'p1',
          players: [
            { socketId: 'p1', score: 0 },
            { socketId: 'p2', score: 0 },
            { socketId: 'p3', score: 0 },
          ],
          config: { wordMode: 'PLAYER_INPUT', maxRounds: 3 },
          whoAmIState: {
            currentTurn: 'p1',
            playerWords: { p1: 'A', p2: 'B', p3: 'C' },
            currentGuess: null,
            votes: { p2: 'NO', p3: 'NO' },
            turnStatus: 'RESULT',
            winner: null,
            currentRound: 1,
            maxRounds: 3,
            eliminatedPlayers: ['p2', 'p3'],
            phase: 'ASKING',
            finalGuessUsed: [],
            guessResult: true,
            guessedWord: 'Wrong',
          },
        } as unknown as RoomState;

        const result = service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' });
        expect(result).not.toBeNull();
        expect(result!.status).toBe(RoomStatus.RESULT);
        expect(result!.whoAmIState!.winner).toBeNull();
      });

      it('should enter FINAL_GUESS phase when round exceeds maxRounds after wrong guess', () => {
        const room = makeAskingRoom({
          turnStatus: 'RESULT',
          currentTurn: 'p3',
          guessResult: true,
          currentRound: 3,
          maxRounds: 3,
          eliminatedPlayers: [],
          votes: { host1: 'NO', p1: 'NO', p2: 'NO' },
        });

        const result = service.handleGameAction(room, 'p3', { type: 'NEXT_TURN' });
        expect(result).not.toBeNull();
        expect(result!.whoAmIState!.phase).toBe('FINAL_GUESS');
      });

      describe('NEXT_TURN in FINAL_GUESS phase', () => {
        it('should advance to next player in FINAL_GUESS on wrong guess', () => {
          const room = makeAskingRoom({
            turnStatus: 'RESULT',
            currentTurn: 'p1',
            guessResult: true,
            phase: 'FINAL_GUESS',
            finalGuessUsed: [],
            votes: { p2: 'NO', p3: 'NO' },
          });

          const result = service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' });
          expect(result).not.toBeNull();
          expect(result!.whoAmIState!.finalGuessUsed).toContain('p1');
          expect(result!.whoAmIState!.currentTurn).not.toBe('p1');
          expect(result!.whoAmIState!.turnStatus).toBe('VOTING');
        });

        it('should end game when all players used final guess', () => {
          const room = {
            gameType: GameType.WHO_AM_I,
            status: RoomStatus.PLAYING,
            roomHostId: 'p1',
            players: [
              { socketId: 'p1', score: 0 },
              { socketId: 'p2', score: 0 },
              { socketId: 'p3', score: 0 },
            ],
            config: { wordMode: 'PLAYER_INPUT', maxRounds: 3 },
            whoAmIState: {
              currentTurn: 'p1',
              playerWords: { p1: 'A', p2: 'B', p3: 'C' },
              currentGuess: null,
              votes: { p2: 'NO', p3: 'NO' },
              turnStatus: 'RESULT',
              winner: null,
              currentRound: 1,
              maxRounds: 3,
              eliminatedPlayers: [],
              phase: 'FINAL_GUESS',
              finalGuessUsed: ['p2', 'p3'],
              guessResult: true,
              guessedWord: 'Wrong',
            },
          } as unknown as RoomState;

          const result = service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' });
          expect(result).not.toBeNull();
          expect(result!.status).toBe(RoomStatus.RESULT);
          expect(result!.whoAmIState!.winner).toBeNull();
        });
      });

      describe('NEXT_TURN with HOST_INPUT mode', () => {
        it('should exclude host from eliminated player checks on score', () => {
          const room = {
            gameType: GameType.WHO_AM_I,
            status: RoomStatus.PLAYING,
            roomHostId: 'host1',
            players: [
              { socketId: 'host1', score: 0 },
              { socketId: 'p1', score: 0 },
              { socketId: 'p2', score: 0 },
            ],
            config: { wordMode: 'HOST_INPUT', maxRounds: 3 },
            whoAmIState: {
              currentTurn: 'p1',
              playerWords: { p1: 'Apple', p2: 'Banana' },
              currentGuess: null,
              votes: { p2: 'NO' },
              turnStatus: 'RESULT',
              winner: null,
              currentRound: 1,
              maxRounds: 3,
              eliminatedPlayers: [],
              phase: 'ASKING',
              finalGuessUsed: [],
              guessResult: true,
              guessedWord: 'Wrong',
            },
          } as unknown as RoomState;

          const result = service.handleGameAction(room, 'p1', { type: 'NEXT_TURN' });
          expect(result).not.toBeNull();
          expect(result!.whoAmIState!.eliminatedPlayers).toContain('p1');
          expect(result!.whoAmIState!.currentTurn).toBe('p2');
        });
      });
    });
  });

  describe('resetGame', () => {
    it('should reset game state to LOBBY', () => {
      const room = {
        status: RoomStatus.RESULT,
        roomHostId: 'host1',
        whoAmIState: { winner: 'p1' },
      } as unknown as RoomState;

      const result = service.resetGame(room, 'host1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.LOBBY);
      expect(result!.whoAmIState).toBeUndefined();
    });

    it('should return null if status is not RESULT', () => {
      const room = {
        status: RoomStatus.PLAYING,
        roomHostId: 'host1',
      } as unknown as RoomState;

      expect(service.resetGame(room, 'host1')).toBeNull();
    });

    it('should return null if requester is not host', () => {
      const room = {
        status: RoomStatus.RESULT,
        roomHostId: 'host1',
      } as unknown as RoomState;

      expect(service.resetGame(room, 'p1')).toBeNull();
    });
  });
});
