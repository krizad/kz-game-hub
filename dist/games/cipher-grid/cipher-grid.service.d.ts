import { RoomState, CipherClueCount, CipherGridState, CipherGridMode, CipherRole, CipherTeam, CipherGridPicturePack } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export type CipherOutcome = {
    room: RoomState;
    error?: undefined;
} | {
    room?: undefined;
    error: string;
};
export declare class CipherGridService {
    private readonly privateState;
    constructor(privateState: PrivateStateService);
    createInitialState(mode?: CipherGridMode, picturePack?: CipherGridPicturePack): CipherGridState;
    startGame(room: RoomState, requesterId: string): RoomState | null;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
    cancelRound(room: RoomState, requesterId: string, round: number): CipherOutcome;
    assignTeam(room: RoomState, requesterId: string, team: CipherTeam | null, role?: CipherRole, targetId?: string): CipherOutcome;
    randomizeTeams(room: RoomState, requesterId: string): CipherOutcome;
    startMatch(room: RoomState, requesterId: string): CipherOutcome;
    nextRound(room: RoomState, requesterId: string): CipherOutcome;
    giveClue(room: RoomState, requesterId: string, rawWord: string, count: CipherClueCount): CipherOutcome;
    pingCard(room: RoomState, requesterId: string, cardIndex: number): CipherOutcome;
    revealCard(room: RoomState, requesterId: string, cardIndex: number): CipherOutcome;
    endTurn(room: RoomState, requesterId: string): CipherOutcome;
    challengeClue(room: RoomState, requesterId: string): CipherOutcome;
    respondChallenge(room: RoomState, requesterId: string, clueId: string, accept: boolean): CipherOutcome;
    handleTurnTimeout(room: RoomState, deadline: number): RoomState | null;
    remapSocketId(state: CipherGridState, oldSocketId: string, newSocketId: string): void;
    handlePlayerRemoved(room: RoomState, socketId: string): void;
    private clearRound;
    private participants;
    private trackers;
    private removeFromTeams;
    private pruneTeams;
    private guardTracker;
    private isValidCount;
    private guessLimit;
    private markRevealed;
    private switchTurn;
    private finishRound;
    private armTurnTimer;
    private keycard;
    private syncKeycards;
    private clearKeycards;
    private pickWords;
    private buildKeycard;
    private shuffle;
}
