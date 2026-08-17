import { RoomState, Role } from '@repo/types';
export declare class SoundsFishyService {
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
