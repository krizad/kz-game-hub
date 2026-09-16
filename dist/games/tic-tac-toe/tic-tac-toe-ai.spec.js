"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tic_tac_toe_ai_1 = require("./tic-tac-toe-ai");
describe('TicTacToeAI', () => {
    describe('checkWinner', () => {
        it('detects row win', () => {
            const board = ['X', 'X', 'X', null, null, null, null, null, null];
            expect((0, tic_tac_toe_ai_1.checkWinner)(board)).toBe('X');
        });
        it('detects column win', () => {
            const board = ['O', null, null, 'O', null, null, 'O', null, null];
            expect((0, tic_tac_toe_ai_1.checkWinner)(board)).toBe('O');
        });
        it('detects diagonal win', () => {
            const board = ['X', null, null, null, 'X', null, null, null, 'X'];
            expect((0, tic_tac_toe_ai_1.checkWinner)(board)).toBe('X');
        });
        it('detects draw', () => {
            const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
            expect((0, tic_tac_toe_ai_1.checkWinner)(board)).toBe('DRAW');
        });
        it('returns null when game is ongoing', () => {
            const board = ['X', 'O', null, null, null, null, null, null, null];
            expect((0, tic_tac_toe_ai_1.checkWinner)(board)).toBeNull();
        });
    });
    describe('getRandomMove (Easy Mode)', () => {
        it('only ever picks an empty cell and can pick either of them', () => {
            const board = ['X', 'O', 'X', 'O', null, 'X', 'O', 'X', null];
            const picked = new Set();
            for (let attempt = 0; attempt < 100; attempt += 1) {
                const move = (0, tic_tac_toe_ai_1.getRandomMove)(board);
                expect([4, 8]).toContain(move);
                picked.add(move);
            }
            expect(picked.size).toBe(2);
        });
        it('returns -1 when board is full', () => {
            const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
            expect((0, tic_tac_toe_ai_1.getRandomMove)(board)).toBe(-1);
        });
    });
    describe('getBestMove (God Mode)', () => {
        it('takes the winning move immediately', () => {
            const board = ['X', 'X', null, 'O', 'O', null, null, null, null];
            const move = (0, tic_tac_toe_ai_1.getBestMove)(board, 'X');
            expect(move).toBe(2);
        });
        it('blocks opponent from winning', () => {
            const board = [null, null, null, 'X', 'X', null, 'O', null, null];
            const move = (0, tic_tac_toe_ai_1.getBestMove)(board, 'O');
            expect(move).toBe(5);
        });
        it('takes center or corner on empty board', () => {
            const board = Array(9).fill(null);
            const move = (0, tic_tac_toe_ai_1.getBestMove)(board, 'X');
            expect([0, 2, 4, 6, 8]).toContain(move);
        });
        it('never loses against a random player over 100 games (God mode proof)', () => {
            let botLosses = 0;
            let botWins = 0;
            let draws = 0;
            for (let game = 0; game < 100; game++) {
                const board = Array(9).fill(null);
                const botSide = game % 2 === 0 ? 'X' : 'O';
                const humanSide = botSide === 'X' ? 'O' : 'X';
                let turn = 'X';
                while (!(0, tic_tac_toe_ai_1.checkWinner)(board)) {
                    if (turn === botSide) {
                        const botMove = (0, tic_tac_toe_ai_1.getBestMove)(board, botSide);
                        expect(botMove).toBeGreaterThanOrEqual(0);
                        expect(board[botMove]).toBeNull();
                        board[botMove] = botSide;
                    }
                    else {
                        const randomMove = (0, tic_tac_toe_ai_1.getRandomMove)(board);
                        expect(randomMove).toBeGreaterThanOrEqual(0);
                        board[randomMove] = humanSide;
                    }
                    turn = turn === 'X' ? 'O' : 'X';
                }
                const result = (0, tic_tac_toe_ai_1.checkWinner)(board);
                if (result === humanSide) {
                    botLosses++;
                }
                else if (result === botSide) {
                    botWins++;
                }
                else {
                    draws++;
                }
            }
            expect(botLosses).toBe(0);
            expect(botWins + draws).toBe(100);
            expect(botWins).toBeGreaterThan(0);
        });
        it('always draws when playing against itself (optimal vs optimal)', () => {
            for (let game = 0; game < 5; game++) {
                const board = Array(9).fill(null);
                let turn = 'X';
                while (!(0, tic_tac_toe_ai_1.checkWinner)(board)) {
                    const move = (0, tic_tac_toe_ai_1.getBestMove)(board, turn);
                    expect(move).toBeGreaterThanOrEqual(0);
                    expect(board[move]).toBeNull();
                    board[move] = turn;
                    turn = turn === 'X' ? 'O' : 'X';
                }
                expect((0, tic_tac_toe_ai_1.checkWinner)(board)).toBe('DRAW');
            }
        });
    });
});
//# sourceMappingURL=tic-tac-toe-ai.spec.js.map