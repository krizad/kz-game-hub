import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@repo/database';
import { LeaderboardEntry, GameResultRecord } from '@repo/types';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  async recordGameResult(
    gameType: string,
    roomCode: string,
    results: { playerName: string; score: number; rank: number }[],
  ): Promise<void> {
    try {
      await prisma.gameResult.createMany({
        data: results.map((r) => ({
          gameType,
          roomCode,
          playerName: r.playerName,
          score: r.score,
          rank: r.rank,
        })),
      });
    } catch (error) {
      this.logger.error('Failed to record game result:', error as Error);
    }
  }

  async getLeaderboard(gameType?: string, limit: number = 20): Promise<LeaderboardEntry[]> {
    try {
      const results = await prisma.gameResult.groupBy({
        by: ['playerName'],
        where: gameType ? { gameType } : undefined,
        _sum: { score: true },
        _count: { _all: true },
        orderBy: { _sum: { score: 'desc' } },
        take: limit,
      });

      return results.map((r, idx) => ({
        playerName: r.playerName,
        totalScore: r._sum.score ?? 0,
        gamesPlayed: r._count._all,
        rank: idx + 1,
      }));
    } catch (error) {
      this.logger.error('Failed to get leaderboard:', error as Error);
      return [];
    }
  }

  async getPlayerStats(playerName: string): Promise<{
    totalScore: number;
    gamesPlayed: number;
    wins: number;
    recentGames: GameResultRecord[];
  } | null> {
    try {
      const stats = await prisma.gameResult.aggregate({
        where: { playerName },
        _sum: { score: true },
        _count: { _all: true },
      });

      if (stats._count._all === 0) return null;

      const wins = await prisma.gameResult.count({
        where: { playerName, rank: 1 },
      });

      const recentGames = await prisma.gameResult.findMany({
        where: { playerName },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          gameType: true,
          score: true,
          rank: true,
        },
      });

      return {
        totalScore: stats._sum.score ?? 0,
        gamesPlayed: stats._count._all,
        wins,
        recentGames: recentGames.map((g) => ({
          gameType: g.gameType,
          playerName,
          score: g.score,
          rank: g.rank,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get player stats:', error as Error);
      return null;
    }
  }
}
