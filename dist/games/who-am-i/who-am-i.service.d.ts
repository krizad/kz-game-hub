import { RoomState, WhoAmIGameState, WordCategory } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export declare class WhoAmIService {
    private readonly privateState;
    constructor(privateState: PrivateStateService);
    private shuffleArray;
    private setMyWord;
    private clearRoomPrivateData;
    private syncVisibleWords;
    private finishGame;
    private createGameState;
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
    private eligiblePlayers;
    private findNextPlayer;
    private enterFinalGuessPhase;
    handleGameAction(room: RoomState, requesterId: string, action: Record<string, unknown>): RoomState | null;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
    remapSocketId(state: WhoAmIGameState, oldSocketId: string, newSocketId: string): void;
}
