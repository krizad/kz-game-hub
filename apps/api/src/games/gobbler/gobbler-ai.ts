import {
  GobblerPiece,
  GobblerSize,
  GobblerState,
  PlayerSide,
  TicTacToeBotDifficulty,
} from '@repo/types';

export type GobblerBotMove =
  | { type: 'PLACE'; pieceId: string; toIndex: number }
  | { type: 'MOVE'; fromIndex: number; toIndex: number };

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function sizeValue(size: GobblerSize): number {
  switch (size) {
    case 'SMALL':
      return 1;
    case 'MEDIUM':
      return 2;
    case 'LARGE':
      return 3;
  }
}

export function canPlaceOver(pieceSize: GobblerSize, cell: GobblerPiece[]): boolean {
  if (cell.length === 0) return true;
  const topPiece = cell[cell.length - 1];
  return sizeValue(pieceSize) > sizeValue(topPiece.size);
}

export function checkGobblerWin(board: GobblerPiece[][]): {
  winner: PlayerSide | 'DRAW' | null;
  line?: number[];
} {
  let xWins = false;
  let oWins = false;
  let winningLine: number[] | undefined;

  for (const [a, b, c] of WINNING_LINES) {
    const topA = board[a].length > 0 ? board[a][board[a].length - 1] : null;
    const topB = board[b].length > 0 ? board[b][board[b].length - 1] : null;
    const topC = board[c].length > 0 ? board[c][board[c].length - 1] : null;

    if (topA && topB && topC && topA.side === topB.side && topA.side === topC.side) {
      if (topA.side === 'X') xWins = true;
      if (topA.side === 'O') oWins = true;
      if (!winningLine) winningLine = [a, b, c];
    }
  }

  if (xWins && oWins) return { winner: 'DRAW' };
  if (xWins) return { winner: 'X', line: winningLine };
  if (oWins) return { winner: 'O', line: winningLine };
  return { winner: null };
}

export function getLegalGobblerMoves(gb: GobblerState, botSide: PlayerSide): GobblerBotMove[] {
  const moves: GobblerBotMove[] = [];
  const inventory = botSide === 'X' ? gb.inventory.X : gb.inventory.O;

  // Inventory placements: deduplicate by size
  const seenSizes = new Set<GobblerSize>();
  for (const piece of inventory) {
    if (seenSizes.has(piece.size)) continue;
    seenSizes.add(piece.size);

    for (let toIndex = 0; toIndex < 9; toIndex++) {
      if (canPlaceOver(piece.size, gb.board[toIndex])) {
        moves.push({ type: 'PLACE', pieceId: piece.id, toIndex });
      }
    }
  }

  // Board moves: move own exposed pieces
  for (let fromIndex = 0; fromIndex < 9; fromIndex++) {
    const cell = gb.board[fromIndex];
    if (cell.length === 0) continue;
    const topPiece = cell[cell.length - 1];
    if (topPiece.side !== botSide) continue;

    for (let toIndex = 0; toIndex < 9; toIndex++) {
      if (fromIndex === toIndex) continue;
      if (canPlaceOver(topPiece.size, gb.board[toIndex])) {
        moves.push({ type: 'MOVE', fromIndex, toIndex });
      }
    }
  }

  return moves;
}

function cloneBoard(board: GobblerPiece[][]): GobblerPiece[][] {
  return board.map((cell) => [...cell]);
}

function simulateMove(
  board: GobblerPiece[][],
  move: GobblerBotMove,
  botSide: PlayerSide,
  inventory: GobblerPiece[],
): GobblerPiece[][] {
  const simulated = cloneBoard(board);
  if (move.type === 'PLACE') {
    const piece = inventory.find((p) => p.id === move.pieceId);
    if (piece) {
      simulated[move.toIndex].push({ ...piece });
    }
  } else {
    const top = simulated[move.fromIndex].pop();
    if (top) {
      simulated[move.toIndex].push(top);
    }
  }
  return simulated;
}

export function getGobblerMove(
  gb: GobblerState,
  botSide: PlayerSide,
  difficulty: TicTacToeBotDifficulty = 'GOD',
): GobblerBotMove | null {
  const legalMoves = getLegalGobblerMoves(gb, botSide);
  if (legalMoves.length === 0) return null;

  const opponentSide: PlayerSide = botSide === 'X' ? 'O' : 'X';
  const inventory = botSide === 'X' ? gb.inventory.X : gb.inventory.O;

  // Filter out any move that exposes an opponent win
  const scoredMoves: { move: GobblerBotMove; score: number }[] = [];

  // Check where opponent could win immediately if it were their turn
  const opponentInventory = opponentSide === 'X' ? gb.inventory.X : gb.inventory.O;
  const opponentThreatCells = new Set<number>();
  for (let idx = 0; idx < 9; idx++) {
    for (const p of opponentInventory) {
      if (canPlaceOver(p.size, gb.board[idx])) {
        const testBoard = cloneBoard(gb.board);
        testBoard[idx].push({ ...p });
        const res = checkGobblerWin(testBoard);
        if (res.winner === opponentSide) {
          opponentThreatCells.add(idx);
          break;
        }
      }
    }
  }

  for (const move of legalMoves) {
    const simBoard = simulateMove(gb.board, move, botSide, inventory);
    const winResult = checkGobblerWin(simBoard);

    let score = 0;

    // Instant Win
    if (winResult.winner === botSide) {
      score += 100000;
    }

    // Moving a piece that uncovers an opponent win -> critical disaster
    if (winResult.winner === opponentSide) {
      score -= 100000;
    }

    if (winResult.winner === 'DRAW') {
      score += 500;
    }

    // Block opponent threat
    if (opponentThreatCells.has(move.toIndex)) {
      score += 25000;
    }

    // Positional weights
    if (move.toIndex === 4) {
      score += 50; // Center
    } else if ([0, 2, 6, 8].includes(move.toIndex)) {
      score += 30; // Corner
    } else {
      score += 15; // Edge
    }

    // Gobbling an opponent piece
    const targetCell = gb.board[move.toIndex];
    if (targetCell.length > 0 && targetCell[targetCell.length - 1].side === opponentSide) {
      score += 40;
    }

    // Inventory conservation: prefer smaller pieces when placing
    if (move.type === 'PLACE') {
      const piece = inventory.find((p) => p.id === move.pieceId);
      if (piece) {
        if (piece.size === 'SMALL') score += 15;
        else if (piece.size === 'MEDIUM') score += 10;
        else score += 5;
      }
    } else {
      // Board moves are slightly encouraged if they reposition safely
      score += 20;
    }

    scoredMoves.push({ move, score });
  }

  if (difficulty === 'EASY') {
    // Pick randomly from moves that do not suicide (score > -50000), or fallback to any
    const nonSuicidal = scoredMoves.filter((sm) => sm.score > -50000);
    const candidates = nonSuicidal.length > 0 ? nonSuicidal : scoredMoves;
    const randomChoice = candidates[Math.floor(Math.random() * candidates.length)];
    return randomChoice.move;
  }

  // Sort descending by score, add slight jitter for variation among top-scored
  scoredMoves.sort((a, b) => b.score - a.score);
  const bestScore = scoredMoves[0].score;
  const bestTies = scoredMoves.filter((sm) => sm.score >= bestScore - 10);
  const chosen = bestTies[Math.floor(Math.random() * bestTies.length)];
  return chosen.move;
}
