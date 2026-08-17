import { RoomState, WordCategory } from '@repo/types';
export declare class WhoAmIService {
    getCategories(lang?: string): Promise<WordCategory[]>;
    private fetchRandomWords;
    startGameHostInput(room: RoomState, requesterId: string, playerWords: Record<string, string>): RoomState | null;
    startGameAiGenerated(room: RoomState, requesterId: string): Promise<RoomState | null>;
    startGameRandom(room: RoomState, requesterId: string): Promise<RoomState | null>;
    startGameAwaitHostInput(room: RoomState, requesterId: string): RoomState | null;
    startGamePlayerInput(room: RoomState, requesterId: string): RoomState | null;
    submitPlayerWord(room: RoomState, socketId: string, word: string): {
        room: RoomState;
        error?: string;
    } | null;
    private assignShuffledWords;
    private findNextPlayer;
    private enterFinalGuessPhase;
    handleGameAction(room: RoomState, requesterId: string, action: Record<string, unknown>): RoomState | null;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
}
