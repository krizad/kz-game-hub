import { RoomState, UltimateTicTacToeState, UltimateTTTCell } from '@repo/types';
export declare class UltimateTicTacToeService {
    private readonly winningLines;
    createInitialState(): UltimateTicTacToeState;
    private isMember;
    private isValidIndex;
    checkWin(cells: (UltimateTTTCell | 'DRAW')[]): {
        winner: 'X' | 'O' | null;
        line?: number[];
    };
    joinSide(room: RoomState, clientId: string, side: 'X' | 'O'): RoomState | null;
    makeMove(room: RoomState, clientId: string, macroIndex: number, microIndex: number): RoomState | null;
    reset(room: RoomState, clientId: string): RoomState | null;
    remapSocketId(state: UltimateTicTacToeState, oldSocketId: string, newSocketId: string): void;
}
