import { RoomState } from '@repo/types';
export declare class DetectiveClubService {
    private readonly logger;
    private availableCards;
    constructor();
    private loadAvailableCards;
    private drawCards;
    startGame(room: RoomState, requesterId: string): RoomState | null;
    submitWord(room: RoomState, playerId: string, word: string): RoomState | null;
    playCard(room: RoomState, playerId: string, cardIndex: number): RoomState | null;
    nextPhase(room: RoomState, requesterId: string): RoomState | null;
    submitVote(room: RoomState, playerId: string, targetId: string): RoomState | null;
    private calculateScore;
    nextRound(room: RoomState, requesterId: string): RoomState | null;
    reset(room: RoomState, requesterId: string): RoomState | null;
}
