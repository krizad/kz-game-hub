"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLineWin = checkLineWin;
exports.getLegalUltimateMoves = getLegalUltimateMoves;
exports.getUltimateMove = getUltimateMove;
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
function checkLineWin(cells) {
    for (let i = 0; i < WINNING_LINES.length; i++) {
        const [a, b, c] = WINNING_LINES[i];
        if (cells[a] && cells[a] !== 'DRAW' && cells[a] === cells[b] && cells[a] === cells[c]) {
            return { winner: cells[a], line: WINNING_LINES[i] };
        }
    }
    return { winner: null };
}
function getLegalUltimateMoves(uttt) {
    const moves = [];
    const playableMacros = uttt.activeMacroIndex !== null
        ? [uttt.activeMacroIndex]
        : Array.from({ length: 9 }, (_, i) => i).filter((m) => !uttt.subBoards[m].winner && uttt.subBoards[m].cells.includes(null));
    for (const macroIndex of playableMacros) {
        const subBoard = uttt.subBoards[macroIndex];
        if (subBoard.winner)
            continue;
        for (let microIndex = 0; microIndex < 9; microIndex++) {
            if (subBoard.cells[microIndex] === null) {
                moves.push({ macroIndex, microIndex });
            }
        }
    }
    return moves;
}
function getUltimateMove(uttt, botSide, difficulty = 'GOD') {
    const legalMoves = getLegalUltimateMoves(uttt);
    if (legalMoves.length === 0)
        return null;
    if (difficulty === 'EASY') {
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }
    const opponentSide = botSide === 'X' ? 'O' : 'X';
    const scoredMoves = [];
    for (const move of legalMoves) {
        let score = 0;
        const subBoard = uttt.subBoards[move.macroIndex];
        const testCells = [...subBoard.cells];
        testCells[move.microIndex] = botSide;
        const subWin = checkLineWin(testCells);
        if (subWin.winner === botSide) {
            score += 15000;
            const testMacro = [...uttt.macroBoard];
            testMacro[move.macroIndex] = botSide;
            const macroWin = checkLineWin(testMacro);
            if (macroWin.winner === botSide) {
                score += 1000000;
            }
            else {
                const oppMacro = [...uttt.macroBoard];
                oppMacro[move.macroIndex] = opponentSide;
                if (checkLineWin(oppMacro).winner === opponentSide) {
                    score += 60000;
                }
            }
        }
        else {
            const oppTestCells = [...subBoard.cells];
            oppTestCells[move.microIndex] = opponentSide;
            if (checkLineWin(oppTestCells).winner === opponentSide) {
                score += 8000;
            }
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
        const targetBoard = uttt.subBoards[move.microIndex];
        const isTargetWonOrFull = targetBoard.winner !== undefined && targetBoard.winner !== null
            ? true
            : !targetBoard.cells.includes(null);
        if (isTargetWonOrFull) {
            score -= 2500;
        }
        else {
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
                score -= 3000;
            }
        }
        if (move.microIndex === 4)
            score += 40;
        else if ([0, 2, 6, 8].includes(move.microIndex))
            score += 20;
        if (move.macroIndex === 4)
            score += 30;
        else if ([0, 2, 6, 8].includes(move.macroIndex))
            score += 15;
        scoredMoves.push({ move, score });
    }
    scoredMoves.sort((a, b) => b.score - a.score);
    const bestScore = scoredMoves[0].score;
    const bestTies = scoredMoves.filter((sm) => sm.score >= bestScore - 15);
    const chosen = bestTies[Math.floor(Math.random() * bestTies.length)];
    return chosen.move;
}
//# sourceMappingURL=ultimate-tic-tac-toe-ai.js.map