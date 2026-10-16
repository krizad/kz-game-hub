import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { prisma } from '@repo/database';
import { GameType } from '@repo/types';

jest.mock('@repo/database', () => ({
  prisma: {
    gameResult: {
      createMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  const mockPrisma = prisma as unknown as {
    gameResult: {
      createMany: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaderboardService],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('recordGameResult', () => {
    it('creates game result records for each player in the cycle', async () => {
      mockPrisma.gameResult.createMany.mockResolvedValueOnce({ count: 2 });

      await service.recordGameResult(GameType.RPS, 'ROOM1', [
        { playerName: 'Alice', score: 1, rank: 1 },
        { playerName: 'Bob', score: 0, rank: 2 },
      ]);

      expect(mockPrisma.gameResult.createMany).toHaveBeenCalledWith({
        data: [
          {
            gameType: GameType.RPS,
            roomCode: 'ROOM1',
            playerName: 'Alice',
            score: 1,
            rank: 1,
          },
          {
            gameType: GameType.RPS,
            roomCode: 'ROOM1',
            playerName: 'Bob',
            score: 0,
            rank: 2,
          },
        ],
      });
    });

    it('catches and logs errors without throwing when DB fails', async () => {
      mockPrisma.gameResult.createMany.mockRejectedValueOnce(new Error('DB failure'));

      await expect(
        service.recordGameResult(GameType.RPS, 'ROOM1', [
          { playerName: 'Alice', score: 1, rank: 1 },
        ]),
      ).resolves.toBeUndefined();
    });
  });

  describe('getLeaderboard', () => {
    it('returns leaderboard entries aggregated from result cycles', async () => {
      mockPrisma.gameResult.groupBy.mockResolvedValueOnce([
        {
          playerName: 'Alice',
          _sum: { score: 5 },
          _count: { _all: 3 },
        },
        {
          playerName: 'Bob',
          _sum: { score: 2 },
          _count: { _all: 3 },
        },
      ]);

      const result = await service.getLeaderboard(GameType.RPS, 10);

      expect(mockPrisma.gameResult.groupBy).toHaveBeenCalledWith({
        by: ['playerName'],
        where: { gameType: GameType.RPS },
        _sum: { score: true },
        _count: { _all: true },
        orderBy: { _sum: { score: 'desc' } },
        take: 10,
      });

      expect(result).toEqual([
        { playerName: 'Alice', totalScore: 5, gamesPlayed: 3, rank: 1 },
        { playerName: 'Bob', totalScore: 2, gamesPlayed: 3, rank: 2 },
      ]);
    });

    it('returns empty array when groupBy throws', async () => {
      mockPrisma.gameResult.groupBy.mockRejectedValueOnce(new Error('DB Error'));

      const result = await service.getLeaderboard();
      expect(result).toEqual([]);
    });
  });

  describe('getPlayerStats', () => {
    it('returns aggregated stats and recent games for an existing player', async () => {
      mockPrisma.gameResult.aggregate.mockResolvedValueOnce({
        _sum: { score: 12 },
        _count: { _all: 8 },
      });
      mockPrisma.gameResult.count.mockResolvedValueOnce(5);
      mockPrisma.gameResult.findMany.mockResolvedValueOnce([
        { gameType: GameType.RPS, score: 1, rank: 1 },
        { gameType: GameType.RPS, score: 0, rank: 2 },
      ]);

      const stats = await service.getPlayerStats('Alice');

      expect(mockPrisma.gameResult.aggregate).toHaveBeenCalledWith({
        where: { playerName: 'Alice' },
        _sum: { score: true },
        _count: { _all: true },
      });
      expect(mockPrisma.gameResult.count).toHaveBeenCalledWith({
        where: { playerName: 'Alice', rank: 1 },
      });
      expect(mockPrisma.gameResult.findMany).toHaveBeenCalledWith({
        where: { playerName: 'Alice' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          gameType: true,
          score: true,
          rank: true,
        },
      });

      expect(stats).toEqual({
        totalScore: 12,
        gamesPlayed: 8,
        wins: 5,
        recentGames: [
          { gameType: GameType.RPS, playerName: 'Alice', score: 1, rank: 1 },
          { gameType: GameType.RPS, playerName: 'Alice', score: 0, rank: 2 },
        ],
      });
    });

    it('returns null when player has 0 games played', async () => {
      mockPrisma.gameResult.aggregate.mockResolvedValueOnce({
        _sum: { score: null },
        _count: { _all: 0 },
      });

      const stats = await service.getPlayerStats('Ghost');
      expect(stats).toBeNull();
      expect(mockPrisma.gameResult.count).not.toHaveBeenCalled();
    });

    it('returns null when aggregate throws', async () => {
      mockPrisma.gameResult.aggregate.mockRejectedValueOnce(new Error('Connection lost'));

      const stats = await service.getPlayerStats('Alice');
      expect(stats).toBeNull();
    });
  });
});
