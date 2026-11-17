import { PlayingCard, PokerV2Advisor, PokerV2AdvisorDraw } from '@repo/types';
import { HandEvaluation } from '../poker/poker-engine';
export declare function countImprovingOuts(known: PlayingCard[], current: HandEvaluation): number;
export declare function detectDraws(hole: PlayingCard[], board: PlayingCard[], currentCatIndex: number): PokerV2AdvisorDraw[];
export interface EquityEntry {
    socketId: string;
    holeCards: PlayingCard[];
}
export declare function simulateEquity(live: EquityEntry[], board: PlayingCard[], iterations?: number): Map<string, number>;
export declare function buildAdvisor(hole: PlayingCard[], board: PlayingCard[], equity: number): PokerV2Advisor;
