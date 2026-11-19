export type TicTacToeCell = 'X' | 'O' | null;
export type TicTacToeMode = 'CLASSIC' | 'GOBBLER' | 'ULTIMATE';
export type TicTacToeBotDifficulty = 'EASY' | 'MEDIUM' | 'GOD';

export interface TicTacToeState {
  board: TicTacToeCell[]; // Array of 9 cells
  playerXId?: string; // socketId of Player X
  playerOId?: string; // socketId of Player O
  currentTurn: 'X' | 'O';
  /** Server timestamp; set when a human turn starts, null on game end (battleship timer pattern). */
  turnDeadline?: number | null;
  winner?: 'X' | 'O' | 'DRAW';
  winningLine?: number[]; // indices of the winning line
}

export interface TTTMakeMovePayload {
  code: string;
  index: number;
  requestId?: string;
}
