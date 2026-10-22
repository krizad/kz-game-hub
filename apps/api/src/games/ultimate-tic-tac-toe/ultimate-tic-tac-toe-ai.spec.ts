import { UltimateTicTacToeState } from '@repo/types';
import { checkLineWin, getLegalUltimateMoves, getUltimateMove } from './ultimate-tic-tac-toe-ai';

describe('UltimateTicTacToeAI', () => {
  const createBaseState = (): UltimateTicTacToeState => ({
    subBoards: Array.from({ length: 9 }, () => ({
      cells: Array(9).fill(null),
    })),
    macroBoard: Array(9).fill(null),
    currentTurn: 'X',
    activeMacroIndex: null,
  });

  describe('checkLineWin', () => {
    it('detects 3-in-a-row win', () => {
      expect(checkLineWin(['X', 'X', 'X', null, null, null, null, null, null]).winner).toBe('X');
    });

    it('ignores DRAW cells when determining line win', () => {
      expect(
        checkLineWin(['DRAW', 'DRAW', 'DRAW', null, null, null, null, null, null]).winner,
      ).toBeNull();
    });
  });

  describe('getLegalUltimateMoves', () => {
    it('returns all empty cells in active sub-board when activeMacroIndex is set', () => {
      const state = createBaseState();
      state.activeMacroIndex = 4;
      const moves = getLegalUltimateMoves(state);
      expect(moves.length).toBe(9);
      expect(moves.every((m) => m.macroIndex === 4)).toBe(true);
    });

    it('returns empty cells from all unfinished sub-boards when free move (null)', () => {
      const state = createBaseState();
      state.activeMacroIndex = null;
      // Mark subBoard 0 as won
      state.subBoards[0].winner = 'X';
      state.macroBoard[0] = 'X';

      const moves = getLegalUltimateMoves(state);
      expect(moves.length).toBe(8 * 9);
      expect(moves.some((m) => m.macroIndex === 0)).toBe(false);
    });
  });

  describe('getUltimateMove', () => {
    it('picks an immediate game-winning move in God mode', () => {
      const state = createBaseState();
      state.activeMacroIndex = 2; // Sent to macro index 2
      // Macro board has X at 0 and 1, so winning subBoard 2 wins the game!
      state.macroBoard[0] = 'X';
      state.macroBoard[1] = 'X';

      // In subBoard 2, X has cells 0 and 1
      state.subBoards[2].cells[0] = 'X';
      state.subBoards[2].cells[1] = 'X';

      const move = getUltimateMove(state, 'X', 'GOD');
      expect(move).toEqual({ macroIndex: 2, microIndex: 2 });
    });

    it('blocks opponent from winning sub-board on the next turn', () => {
      const state = createBaseState();
      state.currentTurn = 'O';
      state.activeMacroIndex = 0;

      // In subBoard 0, X has cells 3 and 4
      state.subBoards[0].cells[3] = 'X';
      state.subBoards[0].cells[4] = 'X';

      const move = getUltimateMove(state, 'O', 'GOD');
      expect(move).toEqual({ macroIndex: 0, microIndex: 5 });
    });

    it('returns a legal move in Easy mode', () => {
      const state = createBaseState();
      state.activeMacroIndex = 3;
      const move = getUltimateMove(state, 'X', 'EASY');
      expect(move).not.toBeNull();
      expect(move!.macroIndex).toBe(3);
      expect(state.subBoards[3].cells[move!.microIndex]).toBeNull();
    });
  });
});
