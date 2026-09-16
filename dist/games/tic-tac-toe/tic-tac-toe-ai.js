"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WINNING_LINES = void 0;
exports.checkWinner = checkWinner;
exports.getRandomMove = getRandomMove;
exports.getBestMove = getBestMove;
exports.WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];
function checkWinner(board) {
    for (let i = 0; i < exports.WINNING_LINES.length; i++) {
        const [a, b, c] = exports.WINNING_LINES[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    if (!board.includes(null)) {
        return 'DRAW';
    }
    return null;
}
function getRandomMove(board) {
    const emptyIndices = [];
    for (let i = 0; i < board.length; i++) {
        if (board[i] === null) {
            emptyIndices.push(i);
        }
    }
    if (emptyIndices.length === 0)
        return -1;
    const randomIndex = Math.floor(Math.random() * emptyIndices.length);
    return emptyIndices[randomIndex];
}
function minimax(board, depth, isMaximizing, botSide) {
    const opponentSide = botSide === 'X' ? 'O' : 'X';
    const winner = checkWinner(board);
    if (winner === botSide) {
        return 10 - depth;
    }
    if (winner === opponentSide) {
        return depth - 10;
    }
    if (winner === 'DRAW') {
        return 0;
    }
    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = botSide;
                const evaluation = minimax(board, depth + 1, false, botSide);
                board[i] = null;
                if (evaluation > maxEval) {
                    maxEval = evaluation;
                }
            }
        }
        return maxEval;
    }
    else {
        let minEval = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = opponentSide;
                const evaluation = minimax(board, depth + 1, true, botSide);
                board[i] = null;
                if (evaluation < minEval) {
                    minEval = evaluation;
                }
            }
        }
        return minEval;
    }
}
function getBestMove(board, botSide) {
    const emptyCount = board.filter((c) => c === null).length;
    if (emptyCount === 9) {
        const optimalFirstMoves = [0, 2, 4, 6, 8];
        return optimalFirstMoves[Math.floor(Math.random() * optimalFirstMoves.length)];
    }
    let bestScore = -Infinity;
    let bestMoves = [];
    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            board[i] = botSide;
            const score = minimax(board, 0, false, botSide);
            board[i] = null;
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [i];
            }
            else if (score === bestScore) {
                bestMoves.push(i);
            }
        }
    }
    if (bestMoves.length > 0) {
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }
    return -1;
}
//# sourceMappingURL=tic-tac-toe-ai.js.map