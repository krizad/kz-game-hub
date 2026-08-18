import { RoomState } from '@repo/types';
export declare class WhoFirstService {
    private getCountdownRange;
    private startCountdown;
    private getExpectedCount;
    private resolveRoundWinner;
    startGame(room: RoomState, requesterId: string): RoomState | null;
    setActive(room: RoomState): RoomState | null;
    handleGameAction(room: RoomState, clientId: string, action: {
        type: string;
        payload?: unknown;
    }): RoomState | null;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
}
