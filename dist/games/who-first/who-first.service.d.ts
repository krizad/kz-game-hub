import { RoomState, WhoFirstGameActionType } from '@repo/types';
export declare class WhoFirstService {
    startGame(room: RoomState, requesterId: string): RoomState | null;
    handleGameAction(room: RoomState, clientId: string, action: {
        type: WhoFirstGameActionType | string;
        payload?: unknown;
    }): RoomState | null;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
}
