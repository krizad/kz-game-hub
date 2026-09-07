export type UltimateTTTCell = 'X' | 'O' | null;

export interface UltimateSubBoardState {
  cells: UltimateTTTCell[]; // 9 cells (0-8)
  winner?: 'X' | 'O' | 'DRAW';
  winningLine?: number[]; // indices 0-8 within sub-board
}

export interface UltimateTicTacToeState {
  subBoards: UltimateSubBoardState[]; // 9 sub-boards (0-8)
  macroBoard: ('X' | 'O' | 'DRAW' | null)[]; // 9 macro cells (0-8)
  playerXId?: string; // socketId of Player X
  playerOId?: string; // socketId of Player O
  currentTurn: 'X' | 'O';
  activeMacroIndex: number | null; // 0-8, or null for Free Move anywhere
  winner?: 'X' | 'O' | 'DRAW';
  winningMacroLine?: number[]; // indices 0-8 of winning line on macro board
  lastMove?: { macroIndex: number; microIndex: number };
}

export interface UltimateTTTMovePayload {
  macroIndex: number;
  microIndex: number;
}
