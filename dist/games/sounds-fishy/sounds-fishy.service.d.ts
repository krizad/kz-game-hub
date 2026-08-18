import { RoomState, Role } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export declare class SoundsFishyService {
    private readonly privateState;
    constructor(privateState: PrivateStateService);
    private shuffleArray;
    private isMember;
    private getTrueAnswer;
    private getBlueFishId;
    private getRedHerringIds;
    private revealRoles;
    assignRoles(room: RoomState, requesterId: string): Promise<{
        room: RoomState;
        roles: Record<string, Role>;
    } | null>;
    typeAnswer(room: RoomState, playerId: string, answer: string): RoomState | null;
    checkAnswerResolution(room: RoomState): boolean;
    submitAnswer(room: RoomState, playerId: string, answer: string): RoomState | null;
    revealPlayer(room: RoomState, pickerId: string, targetId: string): RoomState | null;
    eliminatePlayer(room: RoomState, pickerId: string, targetId: string): RoomState | null;
    bankPoints(room: RoomState, pickerId: string): RoomState | null;
    nextRound(room: RoomState, requesterId: string): RoomState | null;
}
