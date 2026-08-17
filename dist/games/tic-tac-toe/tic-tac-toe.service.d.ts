import { RoomState } from '@repo/types';
export declare class TicTacToeService {
    joinSide(room: RoomState, clientId: string, side: 'X' | 'O'): RoomState | null;
    private checkWin;
    makeMove(room: RoomState, clientId: string, index: number): RoomState | null;
    reset(room: RoomState, clientId: string): RoomState | null;
}
