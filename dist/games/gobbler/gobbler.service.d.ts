import { RoomState, GobblerPiece, GobblerState, PlayerSide } from '@repo/types';
export declare class GobblerService {
    createInitialInventory(side: PlayerSide): GobblerPiece[];
    private isMember;
    private isValidIndex;
    private isGobblerRoom;
    executeBotMoveIfNeeded(room: RoomState): boolean;
    joinSide(room: RoomState, clientId: string, side: PlayerSide, options?: {
        deferBotMove?: boolean;
    }): RoomState | null;
    private checkWin;
    private sizeValue;
    private canPlaceOver;
    placePiece(room: RoomState, clientId: string, pieceId: string, toIndex: number): RoomState | null;
    movePiece(room: RoomState, clientId: string, fromIndex: number, toIndex: number): RoomState | null;
    private handlePostMove;
    reset(room: RoomState, clientId: string, toLobby?: boolean, options?: {
        deferBotMove?: boolean;
    }): RoomState | null;
    remapSocketId(state: GobblerState, oldSocketId: string, newSocketId: string): void;
}
