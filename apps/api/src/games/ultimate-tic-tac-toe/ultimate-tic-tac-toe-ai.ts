import { TicTacToeBotDifficulty, UltimateTicTacToeState, UltimateTTTCell } from '@repo/types';

export interface UltimateTTTBotMove {
  macroIndex: number;
  microIndex: number;
}

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

export function checkLineWin(cells: (UltimateTTTCell | 'DRAW')[]): {
  winner: 'X' | 'O' | null;
  line?: number[];
} {
  for (let i = 0; i < WINNING_LINES.length; i++) {
    const [a, b, c] = WINNING_LINES[i];
    if (cells[a] && cells[a] !== 'DRAW' && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { winner: cells[a] as 'X' | 'O', line: WINNING_LINES[i] };
    }
  }
  return { winner: null };
}

export function getLegalUltimateMoves(uttt: UltimateTicTacToeState): UltimateTTTBotMove[] {
  const moves: UltimateTTTBotMove[] = [];

  const playableMacros =
    uttt.activeMacroIndex !== null
      ? [uttt.activeMacroIndex]
      : Array.from({ length: 9 }, (_, i) => i).filter(
          (m) => !uttt.subBoards[m].winner && uttt.subBoards[m].cells.includes(null),
        );

  for (const macroIndex of playableMacros) {
    const subBoard = uttt.subBoards[macroIndex];
    if (subBoard.winner) continue;

    for (let microIndex = 0; microIndex < 9; microIndex++) {
      if (subBoard.cells[microIndex] === null) {
        moves.push({ macroIndex, microIndex });
      }
    }
  }

  return moves;
}

export function getUltimateMove(
  uttt: UltimateTicTacToeState,
  botSide: 'X' | 'O',
  difficulty: TicTacToeBotDifficulty = 'GOD',
): UltimateTTTBotMove | null {
  const legalMoves = getLegalUltimateMoves(uttt);
  if (legalMoves.length === 0) return null;

  if (difficulty === 'EASY') {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const opponentSide: 'X' | 'O' = botSide === 'X' ? 'O' : 'X';
  const scoredMoves: { move: UltimateTTTBotMove; score: number }[] = [];

  for (const move of legalMoves) {
    let score = 0;
    const subBoard = uttt.subBoards[move.macroIndex];

    // Simulate placing in sub-board
    const testCells = [...subBoard.cells];
    testCells[move.microIndex] = botSide;

    const subWin = checkLineWin(testCells);

    if (subWin.winner === botSide) {
      // Move wins this sub-board!
      score += 15000;

      // Check if winning this sub-board wins the whole macro game
      const testMacro = [...uttt.macroBoard];
      testMacro[move.macroIndex] = botSide;
      const macroWin = checkLineWin(testMacro);

      if (macroWin.winner === botSide) {
        score += 1000000; // Game-winning move!
      } else {
        // Check if this sub-board win blocks opponent from winning macro board
        const oppMacro = [...uttt.macroBoard];
        oppMacro[move.macroIndex] = opponentSide;
        if (checkLineWin(oppMacro).winner === opponentSide) {
          score += 60000; // Denies opponent meta-game win
        }
      }
    } else {
      // If we don't win the sub-board, does this move block opponent from winning it?
      const oppTestCells = [...subBoard.cells];
      oppTestCells[move.microIndex] = opponentSide;
      if (checkLineWin(oppTestCells).winner === opponentSide) {
        score += 8000; // Block sub-board loss
      }

      // Check if this move advances bot toward 2-in-a-row in sub-board
      for (const [a, b, c] of WINNING_LINES) {
        if ([a, b, c].includes(move.microIndex)) {
          const lineCells = [testCells[a], testCells[b], testCells[c]];
          const botCount = lineCells.filter((c) => c === botSide).length;
          const nullCount = lineCells.filter((c) => c === null).length;
          if (botCount === 2 && nullCount === 1) {
            score += 150;
          }
        }
      }
    }

    // Destination routing analysis: next turn for opponent
    const targetBoard = uttt.subBoards[move.microIndex];
    const isTargetWonOrFull =
      targetBoard.winner !== undefined && targetBoard.winner !== null
        ? true
        : !targetBoard.cells.includes(null);

    if (isTargetWonOrFull) {
      // Gives opponent a Free Move on any open sub-board!
      score -= 2500;
    } else {
      // Target board is not full. Does opponent have an instant win on target board?
      let oppCanWinTarget = false;
      for (let m = 0; m < 9; m++) {
        if (targetBoard.cells[m] === null) {
          const simOppCells = [...targetBoard.cells];
          simOppCells[m] = opponentSide;
          if (checkLineWin(simOppCells).winner === opponentSide) {
            oppCanWinTarget = true;
            break;
          }
        }
      }
      if (oppCanWinTarget) {
        score -= 3000; // Don't feed opponent an easy sub-board win
      }
    }

    // Positional weighting
    // Center of sub-board
    if (move.microIndex === 4) score += 40;
    else if ([0, 2, 6, 8].includes(move.microIndex)) score += 20;

    // Center sub-board of macro game
    if (move.macroIndex === 4) score += 30;
    else if ([0, 2, 6, 8].includes(move.macroIndex)) score += 15;

    scoredMoves.push({ move, score });
  }

  scoredMoves.sort((a, b) => b.score - a.score);
  const bestScore = scoredMoves[0].score;
  const bestTies = scoredMoves.filter((sm) => sm.score >= bestScore - 15);
  const chosen = bestTies[Math.floor(Math.random() * bestTies.length)];
  return chosen.move;
}
