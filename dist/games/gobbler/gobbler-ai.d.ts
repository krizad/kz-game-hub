import { GobblerPiece, GobblerSize, GobblerState, PlayerSide, TicTacToeBotDifficulty } from '@repo/types';
export type GobblerBotMove = {
    type: 'PLACE';
    pieceId: string;
    toIndex: number;
} | {
    type: 'MOVE';
    fromIndex: number;
    toIndex: number;
};
export declare function sizeValue(size: GobblerSize): number;
export declare function canPlaceOver(pieceSize: GobblerSize, cell: GobblerPiece[]): boolean;
export declare function checkGobblerWin(board: GobblerPiece[][]): {
    winner: PlayerSide | 'DRAW' | null;
    line?: number[];
};
export declare function getLegalGobblerMoves(gb: GobblerState, botSide: PlayerSide): GobblerBotMove[];
export declare function getGobblerMove(gb: GobblerState, botSide: PlayerSide, difficulty?: TicTacToeBotDifficulty): GobblerBotMove | null;
