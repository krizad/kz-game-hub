import { Test, TestingModule } from '@nestjs/testing';
import { SoundsFishyService } from './sounds-fishy.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SoundsFishyService],
    }).compile();

    service = module.get<SoundsFishyService>(SoundsFishyService);
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
      } as unknown as RoomState;

      (prisma.soundsFishyQuestion.aggregate as jest.Mock).mockResolvedValue({
        _min: { query_count: 0 },
      });
      (prisma.soundsFishyQuestion.findMany as jest.Mock).mockResolvedValue([
        { id: 1, question: 'Q?', answer: 'A!', lang: 'th' },
      ]);
      (prisma.soundsFishyQuestion.update as jest.Mock).mockResolvedValue({});

      const result = await service.assignRoles(room, 'p1');
      expect(result).not.toBeNull();
      expect(prisma.soundsFishyQuestion.aggregate).toHaveBeenCalled();
      expect(prisma.soundsFishyQuestion.findMany).toHaveBeenCalled();
      expect(prisma.soundsFishyQuestion.update).toHaveBeenCalled();

      expect(result!.room.status).toBe(RoomStatus.QUESTIONING);
      expect(result!.room.soundsFishyState).toBeDefined();
      expect(result!.room.soundsFishyState!.question.question).toBe('Q?');
    });

    it('should return null if not enough players', async () => {
      const room = {
        players: [{ socketId: 'p1' }, { socketId: 'p2' }],
        roomHostId: 'p1',
      } as unknown as RoomState;

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
          currentPhase: SoundsFishyPhase.SETUP,
          pickerId: 'p1',
          redHerringIds: ['p2', 'p3'],
          question: { answer: 'Truth' },
          playerAnswers: {},
        },
      } as unknown as RoomState;

      // red herring submitting exact truth should return null
      let result = service.submitAnswer(room, 'p2', 'truth ');
      expect(result).toBeNull();

      // submit valid answer
      result = service.submitAnswer(room, 'p2', 'Fake');
      expect(result).not.toBeNull();
      expect(result!.soundsFishyState!.playerAnswers['p2'].answer).toBe('Fake');

      // submit last answer
      result = service.submitAnswer(room, 'p3', 'Another Fake');
      expect(result!.soundsFishyState!.currentPhase).toBe(SoundsFishyPhase.THE_PITCH);
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
          currentPhase: SoundsFishyPhase.THE_HUNT,
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
      } as unknown as RoomState;

      const result = service.eliminatePlayer(room, 'p1', 'p3');
      expect(result!.soundsFishyState!.eliminatedPlayers).toContain('p3');
      expect(result!.soundsFishyState!.roundScorePool).toBe(1);

      // game should end since all red herrings eliminated
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players[0].score).toBe(1); // picker gets 1
    });

    it('should correctly handle eliminating the Blue Fish', () => {
      const room = {
        players: [
          { socketId: 'p1', score: 0 },
          { socketId: 'p2', score: 0 },
          { socketId: 'p3', score: 0 },
        ],
        soundsFishyState: {
          currentPhase: SoundsFishyPhase.THE_HUNT,
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
      } as unknown as RoomState;

      const result = service.eliminatePlayer(room, 'p1', 'p2');
      expect(result!.soundsFishyState!.eliminatedPlayers).toContain('p2');

      // game should end since blue fish eliminated
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players[1].score).toBe(1); // blue fish gets 1 point (1 surviving red herring)
      expect(result!.players[2].score).toBe(1); // red herring gets 1 point
    });
  });
});
