import { TicTacToeCell } from '@repo/types';
export declare const WINNING_LINES: number[][];
export declare function checkWinner(board: TicTacToeCell[]): 'X' | 'O' | 'DRAW' | null;
export declare function getRandomMove(board: TicTacToeCell[]): number;
export declare function getBestMove(board: TicTacToeCell[], botSide: 'X' | 'O'): number;
