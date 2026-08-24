import { RoomState, TicTacToeState } from '@repo/types';
export declare class TicTacToeService {
    private isMember;
    private isValidIndex;
    joinSide(room: RoomState, clientId: string, side: 'X' | 'O'): RoomState | null;
    private checkWin;
    makeMove(room: RoomState, clientId: string, index: number): RoomState | null;
    reset(room: RoomState, clientId: string): RoomState | null;
    remapSocketId(state: TicTacToeState, oldSocketId: string, newSocketId: string): void;
}
