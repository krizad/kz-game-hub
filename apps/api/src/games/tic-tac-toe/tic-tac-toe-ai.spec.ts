import { TicTacToeCell } from '@repo/types';
import { checkWinner, getRandomMove, getBestMove } from './tic-tac-toe-ai';

describe('TicTacToeAI', () => {
  describe('checkWinner', () => {
    it('detects row win', () => {
      const board: TicTacToeCell[] = ['X', 'X', 'X', null, null, null, null, null, null];
      expect(checkWinner(board)).toBe('X');
    });

    it('detects column win', () => {
      const board: TicTacToeCell[] = ['O', null, null, 'O', null, null, 'O', null, null];
      expect(checkWinner(board)).toBe('O');
    });

    it('detects diagonal win', () => {
      const board: TicTacToeCell[] = ['X', null, null, null, 'X', null, null, null, 'X'];
      expect(checkWinner(board)).toBe('X');
    });

    it('detects draw', () => {
      const board: TicTacToeCell[] = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
      expect(checkWinner(board)).toBe('DRAW');
    });

    it('returns null when game is ongoing', () => {
      const board: TicTacToeCell[] = ['X', 'O', null, null, null, null, null, null, null];
      expect(checkWinner(board)).toBeNull();
    });
  });

  describe('getRandomMove (Easy Mode)', () => {
    it('returns an empty cell index', () => {
      const board: TicTacToeCell[] = ['X', 'O', 'X', 'O', null, 'X', 'O', 'X', 'O'];
      const move = getRandomMove(board);
      expect(move).toBe(4);
    });

    it('returns -1 when board is full', () => {
      const board: TicTacToeCell[] = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
      expect(getRandomMove(board)).toBe(-1);
    });
  });

  describe('getBestMove (God Mode)', () => {
    it('takes the winning move immediately', () => {
      // Bot is X: board has X at 0 and 1, cell 2 is empty -> must play 2
      const board: TicTacToeCell[] = ['X', 'X', null, 'O', 'O', null, null, null, null];
      const move = getBestMove(board, 'X');
      expect(move).toBe(2);
    });

    it('blocks opponent from winning', () => {
      // Opponent is X at 3 and 4, 5 is empty. Bot is O -> must play 5 to block
      const board: TicTacToeCell[] = [null, null, null, 'X', 'X', null, 'O', null, null];
      const move = getBestMove(board, 'O');
      expect(move).toBe(5);
    });

    it('takes center or corner on empty board', () => {
      const board: TicTacToeCell[] = Array(9).fill(null);
      const move = getBestMove(board, 'X');
      expect([0, 2, 4, 6, 8]).toContain(move);
    });

    it('never loses against a random player over 100 games (God mode proof)', () => {
      let botLosses = 0;
      let botWins = 0;
      let draws = 0;

      for (let game = 0; game < 100; game++) {
        const board: TicTacToeCell[] = Array(9).fill(null);
        // Alternate who starts first
        const botSide: 'X' | 'O' = game % 2 === 0 ? 'X' : 'O';
        const humanSide: 'X' | 'O' = botSide === 'X' ? 'O' : 'X';
        let turn: 'X' | 'O' = 'X';

        while (!checkWinner(board)) {
          if (turn === botSide) {
            const botMove = getBestMove(board, botSide);
            expect(botMove).toBeGreaterThanOrEqual(0);
            expect(board[botMove]).toBeNull();
            board[botMove] = botSide;
          } else {
            const randomMove = getRandomMove(board);
            expect(randomMove).toBeGreaterThanOrEqual(0);
            board[randomMove] = humanSide;
          }
          turn = turn === 'X' ? 'O' : 'X';
        }

        const result = checkWinner(board);
        if (result === humanSide) {
          botLosses++;
        } else if (result === botSide) {
          botWins++;
        } else {
          draws++;
        }
      }

      expect(botLosses).toBe(0);
      expect(botWins + draws).toBe(100);
      expect(botWins).toBeGreaterThan(0);
    });

    it('always draws when playing against itself (optimal vs optimal)', () => {
      for (let game = 0; game < 5; game++) {
        const board: TicTacToeCell[] = Array(9).fill(null);
        let turn: 'X' | 'O' = 'X';

        while (!checkWinner(board)) {
          const move = getBestMove(board, turn);
          expect(move).toBeGreaterThanOrEqual(0);
          expect(board[move]).toBeNull();
          board[move] = turn;
          turn = turn === 'X' ? 'O' : 'X';
        }

        expect(checkWinner(board)).toBe('DRAW');
      }
    });
  });
});
