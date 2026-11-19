import { RoomState, TicTacToeState } from '@repo/types';
export declare class TicTacToeService {
    private isMember;
    private isClassicTTTRoom;
    private isValidIndex;
    private stampTurnDeadline;
    handleTurnTimeout(room: RoomState, deadline: number): RoomState | null;
    executeBotMoveIfNeeded(room: RoomState): boolean;
    joinSide(room: RoomState, clientId: string, side: 'X' | 'O', options?: {
        deferBotMove?: boolean;
    }): RoomState | null;
    private checkWin;
    makeMove(room: RoomState, clientId: string, index: number, options?: {
        deferBotMove?: boolean;
    }): RoomState | null;
    reset(room: RoomState, clientId: string, toLobby?: boolean): RoomState | null;
    remapSocketId(state: TicTacToeState, oldSocketId: string, newSocketId: string): void;
}
