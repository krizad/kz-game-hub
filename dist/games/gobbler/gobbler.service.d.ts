import { RoomState, PlayerSide } from '@repo/types';
export declare class GobblerService {
    private createInitialInventory;
    joinSide(room: RoomState, clientId: string, side: PlayerSide): RoomState | null;
    private checkWin;
    private sizeValue;
    private canPlaceOver;
    placePiece(room: RoomState, clientId: string, pieceId: string, toIndex: number): RoomState | null;
    movePiece(room: RoomState, clientId: string, fromIndex: number, toIndex: number): RoomState | null;
    private handlePostMove;
    reset(room: RoomState, clientId: string): RoomState | null;
}
