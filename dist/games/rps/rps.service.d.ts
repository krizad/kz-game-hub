import { RoomState, RPSChoice, Role } from '@repo/types';
export declare class RPSService {
    assignRoles(room: RoomState, requesterId: string): {
        room: RoomState;
        roles: Record<string, Role>;
    } | null;
    makeChoice(room: RoomState, clientId: string, choice: RPSChoice): RoomState | null;
    private resolve1v1Round;
    private resolveAllAtOnceRound;
    nextRound(room: RoomState, clientId: string): RoomState | null;
    reset(room: RoomState, clientId: string): RoomState | null;
}
