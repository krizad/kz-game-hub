"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@repo/database");
let LeaderboardService = class LeaderboardService {
    async recordGameResult(gameType, roomCode, results) {
        try {
            await database_1.prisma.gameResult.createMany({
                data: results.map((r) => ({
                    gameType,
                    roomCode,
                    playerName: r.playerName,
                    score: r.score,
                    rank: r.rank,
                })),
            });
        }
        catch (error) {
            console.error('Failed to record game result:', error);
        }
    }
    async getLeaderboard(gameType, limit = 20) {
        try {
            const results = await database_1.prisma.gameResult.groupBy({
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
        }
        catch (error) {
            console.error('Failed to get leaderboard:', error);
            return [];
        }
    }
    async getPlayerStats(playerName) {
        try {
            const stats = await database_1.prisma.gameResult.aggregate({
                where: { playerName },
                _sum: { score: true },
                _count: { _all: true },
            });
            if (stats._count._all === 0)
                return null;
            const wins = await database_1.prisma.gameResult.count({
                where: { playerName, rank: 1 },
            });
            const recentGames = await database_1.prisma.gameResult.findMany({
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
        }
        catch (error) {
            console.error('Failed to get player stats:', error);
            return null;
        }
    }
};
exports.LeaderboardService = LeaderboardService;
exports.LeaderboardService = LeaderboardService = __decorate([
    (0, common_1.Injectable)()
], LeaderboardService);
//# sourceMappingURL=leaderboard.service.js.map