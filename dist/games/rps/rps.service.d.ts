import { RoomState, RPSChoice, Role } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export declare class RPSService {
    private readonly privateState;
    constructor(privateState: PrivateStateService);
    assignRoles(room: RoomState, requesterId: string): {
        room: RoomState;
        roles: Record<string, Role>;
    } | null;
    makeChoice(room: RoomState, clientId: string, choice: RPSChoice): RoomState | null;
    private revealChoices;
    private addScore;
    private resolve1v1Round;
    private resolveAllAtOnceRound;
    nextRound(room: RoomState, clientId: string): RoomState | null;
    reset(room: RoomState, clientId: string): RoomState | null;
}
