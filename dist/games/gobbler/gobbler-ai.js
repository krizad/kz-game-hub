"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeValue = sizeValue;
exports.canPlaceOver = canPlaceOver;
exports.checkGobblerWin = checkGobblerWin;
exports.getLegalGobblerMoves = getLegalGobblerMoves;
exports.getGobblerMove = getGobblerMove;
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
function sizeValue(size) {
    switch (size) {
        case 'SMALL':
            return 1;
        case 'MEDIUM':
            return 2;
        case 'LARGE':
            return 3;
    }
}
function canPlaceOver(pieceSize, cell) {
    if (cell.length === 0)
        return true;
    const topPiece = cell[cell.length - 1];
    return sizeValue(pieceSize) > sizeValue(topPiece.size);
}
function checkGobblerWin(board) {
    let xWins = false;
    let oWins = false;
    let winningLine;
    for (const [a, b, c] of WINNING_LINES) {
        const topA = board[a].length > 0 ? board[a][board[a].length - 1] : null;
        const topB = board[b].length > 0 ? board[b][board[b].length - 1] : null;
        const topC = board[c].length > 0 ? board[c][board[c].length - 1] : null;
        if (topA && topB && topC && topA.side === topB.side && topA.side === topC.side) {
            if (topA.side === 'X')
                xWins = true;
            if (topA.side === 'O')
                oWins = true;
            if (!winningLine)
                winningLine = [a, b, c];
        }
    }
    if (xWins && oWins)
        return { winner: 'DRAW' };
    if (xWins)
        return { winner: 'X', line: winningLine };
    if (oWins)
        return { winner: 'O', line: winningLine };
    return { winner: null };
}
function getLegalGobblerMoves(gb, botSide) {
    const moves = [];
    const inventory = botSide === 'X' ? gb.inventory.X : gb.inventory.O;
    const seenSizes = new Set();
    for (const piece of inventory) {
        if (seenSizes.has(piece.size))
            continue;
        seenSizes.add(piece.size);
        for (let toIndex = 0; toIndex < 9; toIndex++) {
            if (canPlaceOver(piece.size, gb.board[toIndex])) {
                moves.push({ type: 'PLACE', pieceId: piece.id, toIndex });
            }
        }
    }
    for (let fromIndex = 0; fromIndex < 9; fromIndex++) {
        const cell = gb.board[fromIndex];
        if (cell.length === 0)
            continue;
        const topPiece = cell[cell.length - 1];
        if (topPiece.side !== botSide)
            continue;
        for (let toIndex = 0; toIndex < 9; toIndex++) {
            if (fromIndex === toIndex)
                continue;
            if (canPlaceOver(topPiece.size, gb.board[toIndex])) {
                moves.push({ type: 'MOVE', fromIndex, toIndex });
            }
        }
    }
    return moves;
}
function cloneBoard(board) {
    return board.map((cell) => [...cell]);
}
function simulateMove(board, move, botSide, inventory) {
    const simulated = cloneBoard(board);
    if (move.type === 'PLACE') {
        const piece = inventory.find((p) => p.id === move.pieceId);
        if (piece) {
            simulated[move.toIndex].push({ ...piece });
        }
    }
    else {
        const top = simulated[move.fromIndex].pop();
        if (top) {
            simulated[move.toIndex].push(top);
        }
    }
    return simulated;
}
function getGobblerMove(gb, botSide, difficulty = 'GOD') {
    const legalMoves = getLegalGobblerMoves(gb, botSide);
    if (legalMoves.length === 0)
        return null;
    const opponentSide = botSide === 'X' ? 'O' : 'X';
    const inventory = botSide === 'X' ? gb.inventory.X : gb.inventory.O;
    const scoredMoves = [];
    const opponentInventory = opponentSide === 'X' ? gb.inventory.X : gb.inventory.O;
    const opponentThreatCells = new Set();
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
        if (winResult.winner === botSide) {
            score += 100000;
        }
        if (winResult.winner === opponentSide) {
            score -= 100000;
        }
        if (winResult.winner === 'DRAW') {
            score += 500;
        }
        if (opponentThreatCells.has(move.toIndex)) {
            score += 25000;
        }
        if (move.toIndex === 4) {
            score += 50;
        }
        else if ([0, 2, 6, 8].includes(move.toIndex)) {
            score += 30;
        }
        else {
            score += 15;
        }
        const targetCell = gb.board[move.toIndex];
        if (targetCell.length > 0 && targetCell[targetCell.length - 1].side === opponentSide) {
            score += 40;
        }
        if (move.type === 'PLACE') {
            const piece = inventory.find((p) => p.id === move.pieceId);
            if (piece) {
                if (piece.size === 'SMALL')
                    score += 15;
                else if (piece.size === 'MEDIUM')
                    score += 10;
                else
                    score += 5;
            }
        }
        else {
            score += 20;
        }
        scoredMoves.push({ move, score });
    }
    if (difficulty === 'EASY') {
        const nonSuicidal = scoredMoves.filter((sm) => sm.score > -50000);
        const candidates = nonSuicidal.length > 0 ? nonSuicidal : scoredMoves;
        const randomChoice = candidates[Math.floor(Math.random() * candidates.length)];
        return randomChoice.move;
    }
    scoredMoves.sort((a, b) => b.score - a.score);
    const bestScore = scoredMoves[0].score;
    const bestTies = scoredMoves.filter((sm) => sm.score >= bestScore - 10);
    const chosen = bestTies[Math.floor(Math.random() * bestTies.length)];
    return chosen.move;
}
//# sourceMappingURL=gobbler-ai.js.map