export type GobblerSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type PlayerSide = 'X' | 'O';

export interface GobblerPiece {
  id: string; // unique identifier for the piece
  side: PlayerSide;
  size: GobblerSize;
}

export type GobblerCell = GobblerPiece[]; // Stack of pieces, top piece is visible and active

export interface GobblerState {
  board: GobblerCell[]; // Array of 9 cells, each cell is a stack
  playerXId?: string; // socketId of Player X
  playerOId?: string; // socketId of Player O
  currentTurn: PlayerSide;
  inventory: {
    X: GobblerPiece[];
    O: GobblerPiece[];
  };
  scores: {
    X: number;
    O: number;
  };
  winner?: PlayerSide | 'DRAW';
  winningLine?: number[]; // indices of the winning line
}
