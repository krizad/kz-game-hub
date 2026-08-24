import { RoomState, Role } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export declare class WhoKnowService {
    private readonly privateState;
    constructor(privateState: PrivateStateService);
    private getRole;
    private setRole;
    private clearRoles;
    private revealRoles;
    assignRoles(room: RoomState, requesterId: string): {
        room: RoomState;
        roles: Record<string, Role>;
    } | null;
    setWord(room: RoomState, word: string, requesterId: string, secretWords: Map<string, string>): RoomState | null;
    stopTimer(room: RoomState, requesterId: string): RoomState | null;
    endQuestioning(room: RoomState, requesterId: string, timeout?: boolean): RoomState | null;
    handleQuestioningTimeout(room: RoomState): RoomState | null;
    checkVoteResolution(room: RoomState): boolean;
    submitVote(room: RoomState, voterId: string, targetId: string): RoomState | null;
    resetGame(room: RoomState, requesterId: string, secretWords: Map<string, string>): RoomState | null;
    remapVotes(votes: Record<string, string>, oldSocketId: string, newSocketId: string): void;
}
