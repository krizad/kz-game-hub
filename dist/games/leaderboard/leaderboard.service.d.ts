import { LeaderboardEntry, GameResultRecord } from '@repo/types';
export declare class LeaderboardService {
    recordGameResult(gameType: string, roomCode: string, results: {
        playerName: string;
        score: number;
        rank: number;
    }[]): Promise<void>;
    getLeaderboard(gameType?: string, limit?: number): Promise<LeaderboardEntry[]>;
    getPlayerStats(playerName: string): Promise<{
        totalScore: number;
        gamesPlayed: number;
        wins: number;
        recentGames: GameResultRecord[];
    } | null>;
}
