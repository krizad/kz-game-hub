import { TicTacToeBotDifficulty, UltimateTicTacToeState, UltimateTTTCell } from '@repo/types';
export interface UltimateTTTBotMove {
    macroIndex: number;
    microIndex: number;
}
export declare function checkLineWin(cells: (UltimateTTTCell | 'DRAW')[]): {
    winner: 'X' | 'O' | null;
    line?: number[];
};
export declare function getLegalUltimateMoves(uttt: UltimateTicTacToeState): UltimateTTTBotMove[];
export declare function getUltimateMove(uttt: UltimateTicTacToeState, botSide: 'X' | 'O', difficulty?: TicTacToeBotDifficulty): UltimateTTTBotMove | null;
