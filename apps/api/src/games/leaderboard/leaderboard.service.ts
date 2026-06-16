import { Injectable } from '@nestjs/common';
import { prisma } from '@repo/database';
import { LeaderboardEntry, GameResultRecord } from '@repo/types';

@Injectable()
export class LeaderboardService {
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
      console.error('Failed to record game result:', error);
    }
  }

  async getLeaderboard(gameType?: string, limit: number = 20): Promise<LeaderboardEntry[]> {
    try {
      const whereClause = gameType ? 'WHERE "gameType" = $1' : '';
      const params = gameType ? [gameType, limit] : [limit];

      const results = await prisma.$queryRawUnsafe<
        { playerName: string; totalScore: bigint; gamesPlayed: bigint }[]
      >(
        `SELECT "playerName", SUM("score") as "totalScore", COUNT(*) as "gamesPlayed"
         FROM "GameResult"
         ${whereClause}
         GROUP BY "playerName"
         ORDER BY "totalScore" DESC
         LIMIT $${gameType ? 2 : 1}`,
        ...params,
      );

      return results.map((r, idx) => ({
        playerName: r.playerName,
        totalScore: Number(r.totalScore),
        gamesPlayed: Number(r.gamesPlayed),
        rank: idx + 1,
      }));
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
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
      const stats = await prisma.$queryRawUnsafe<
        { totalScore: bigint; gamesPlayed: bigint; wins: bigint }[]
      >(
        `SELECT
           COALESCE(SUM("score"), 0) as "totalScore",
           COUNT(*) as "gamesPlayed",
           COALESCE(SUM(CASE WHEN "rank" = 1 THEN 1 ELSE 0 END), 0) as "wins"
         FROM "GameResult"
         WHERE "playerName" = $1`,
        playerName,
      );

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

      if (stats.length === 0) return null;

      return {
        totalScore: Number(stats[0].totalScore),
        gamesPlayed: Number(stats[0].gamesPlayed),
        wins: Number(stats[0].wins),
        recentGames: recentGames.map((g) => ({
          gameType: g.gameType,
          playerName,
          score: g.score,
          rank: g.rank,
        })),
      };
    } catch (error) {
      console.error('Failed to get player stats:', error);
      return null;
    }
  }
}
