import { Test, TestingModule } from '@nestjs/testing';
import { SoundsFishyService } from './sounds-fishy.service';
import { PrivateStateService } from '../private-state.service';
import { RoomState, RoomStatus, SoundsFishyPhase } from '@repo/types';

jest.mock('@repo/database', () => ({
  prisma: {
    soundsFishyQuestion: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@repo/database';

describe('SoundsFishyService', () => {
  let service: SoundsFishyService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SoundsFishyService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();

    service = module.get<SoundsFishyService>(SoundsFishyService);
    jest.clearAllMocks();
  });

  function createRoom(players: Partial<RoomState['players'][number]>[]): RoomState {
    return {
      id: 'room-id',
      code: 'ABC123',
      gameType: 'SOUNDS_FISHY',
      status: RoomStatus.QUESTIONING,
      roomHostId: 'p1',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1, language: 'th' },
      players: players.map((p, i) => ({
        id: p.socketId as string,
        socketId: p.socketId as string,
        name: `P${i}`,
        score: 0,
        roomId: 'room-id',
        connected: true,
        ...p,
      })),
    } as unknown as RoomState;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignRoles', () => {
    it('should assign roles, fetch a question, and keep secrets out of public state', async () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);

      (prisma.soundsFishyQuestion.aggregate as jest.Mock).mockResolvedValue({
        _min: { query_count: 0 },
      });
      (prisma.soundsFishyQuestion.findMany as jest.Mock).mockResolvedValue([
        { id: 1, question: 'Q?', answer: 'A!', lang: 'th' },
      ]);
      (prisma.soundsFishyQuestion.update as jest.Mock).mockResolvedValue({});

      const result = await service.assignRoles(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.room.status).toBe(RoomStatus.QUESTIONING);
      expect(result!.room.soundsFishyState).toBeDefined();
      expect(result!.room.soundsFishyState!.question!.question).toBe('Q?');

      const state = result!.room.soundsFishyState!;
      expect(state.question!.answer).toBeUndefined();
      expect(state.blueFishId).toBeNull();
      expect(state.redHerringIds).toEqual([]);

      const serialized = JSON.stringify(result!.room);
      expect(serialized).not.toContain('A!');
      expect(serialized).not.toContain('BLUE_FISH');

      const nonPicker = room.players.find((p) => p.socketId !== state.pickerId)!;
      expect(privateState.get(room.code, nonPicker.socketId, 'sfTrueAnswer')).toBe('A!');
    });

    it('should return null if not enough connected players', async () => {
      const room = createRoom([
        { socketId: 'p1' },
        { socketId: 'p2' },
        { socketId: 'p3', connected: false },
      ]);

      const result = await service.assignRoles(room, 'p1');
      expect(result).toBeNull();
    });
  });

  describe('submitAnswer', () => {
    function seedPrivate(room: RoomState) {
      privateState.set(room.code, '__room__', 'sfRoomTrueAnswer', 'Truth');
      privateState.set(room.code, '__room__', 'sfRoomBlueFish', 'p2');
      privateState.set(room.code, '__room__', 'sfRoomRedHerrings', ['p3']);
      for (const p of room.players) {
        const role =
          p.socketId === 'p1' ? 'PICKER' : p.socketId === 'p2' ? 'BLUE_FISH' : 'RED_HERRING';
        privateState.set(room.code, p.socketId, 'sfRole', role);
        if (role !== 'PICKER') privateState.set(room.code, p.socketId, 'sfTrueAnswer', 'Truth');
      }
    }

    it('rejects the red herring copying the truth and stores answers privately', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      seedPrivate(room);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingAnswers: {},
      } as unknown as RoomState['soundsFishyState'];

      expect(service.submitAnswer(room, 'p3', 'truth ')).toBeNull();

      const result = service.submitAnswer(room, 'p3', 'Fake');
      expect(result).not.toBeNull();
      expect(result!.soundsFishyState!.playerAnswers['p3']).toBeUndefined();
      expect(privateState.get(room.code, 'p3', 'sfMyAnswer')).toMatchObject({ answer: 'Fake' });
      expect(JSON.stringify(result!)).not.toContain('Fake');
    });

    it('rejects the blue fish entering a wrong answer and blocks resubmission', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      seedPrivate(room);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingAnswers: {},
      } as unknown as RoomState['soundsFishyState'];

      expect(service.submitAnswer(room, 'p2', 'Wrong')).toBeNull();
      expect(service.submitAnswer(room, 'p2', 'Truth')).not.toBeNull();
      expect(service.submitAnswer(room, 'p2', 'Changed')).toBeNull();
    });

    it('transitions to THE_PITCH when all connected non-pickers answered', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      seedPrivate(room);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingAnswers: {},
      } as unknown as RoomState['soundsFishyState'];

      service.submitAnswer(room, 'p2', 'Truth');
      const result = service.submitAnswer(room, 'p3', 'Fake');

      expect(result!.soundsFishyState!.currentPhase).toBe(SoundsFishyPhase.THE_PITCH);
    });
  });

  describe('eliminatePlayer', () => {
    function setupHunt(room: RoomState) {
      privateState.set(room.code, '__room__', 'sfRoomBlueFish', 'p2');
      privateState.set(room.code, '__room__', 'sfRoomRedHerrings', ['p3']);
      privateState.set(room.code, '__room__', 'sfRoomTrueAnswer', 'Truth');
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.THE_HUNT,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {
          p2: { playerId: 'p2', answer: 'Truth', isRevealed: true },
          p3: { playerId: 'p3', answer: 'Fake', isRevealed: true },
        },
        answeredPlayerIds: ['p2', 'p3'],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingAnswers: {},
      } as unknown as RoomState['soundsFishyState'];
    }

    it('should correctly handle eliminating a Red Herring', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      setupHunt(room);

      const result = service.eliminatePlayer(room, 'p1', 'p3');
      expect(result!.soundsFishyState!.eliminatedPlayers).toContain('p3');
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players[0].score).toBe(1);
      expect(result!.soundsFishyState!.blueFishId).toBe('p2');
      expect(result!.soundsFishyState!.question!.answer).toBe('Truth');
    });

    it('should correctly handle eliminating the Blue Fish', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      setupHunt(room);

      const result = service.eliminatePlayer(room, 'p1', 'p2');
      expect(result!.soundsFishyState!.eliminatedPlayers).toContain('p2');
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players[1].score).toBe(1);
      expect(result!.players[2].score).toBe(1);
    });

    it('blocks elimination when a connected player has not been revealed', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      setupHunt(room);
      room.soundsFishyState!.playerAnswers = {
        p2: { playerId: 'p2', answer: 'Truth', isRevealed: true },
      };

      expect(service.eliminatePlayer(room, 'p1', 'p3')).toBeNull();
    });
  });
});
