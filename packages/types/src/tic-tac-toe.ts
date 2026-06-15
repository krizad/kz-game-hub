export type TicTacToeCell = 'X' | 'O' | null;

export interface TicTacToeState {
  board: TicTacToeCell[]; // Array of 9 cells
  playerXId?: string; // socketId of Player X
  playerOId?: string; // socketId of Player O
  currentTurn: 'X' | 'O';
  winner?: 'X' | 'O' | 'DRAW';
  winningLine?: number[]; // indices of the winning line
}
