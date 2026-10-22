import { GobblerPiece, GobblerState } from '@repo/types';
import {
  canPlaceOver,
  checkGobblerWin,
  getGobblerMove,
  getLegalGobblerMoves,
  sizeValue,
} from './gobbler-ai';

describe('GobblerAI', () => {
  describe('canPlaceOver & sizeValue', () => {
    it('ranks LARGE > MEDIUM > SMALL', () => {
      expect(sizeValue('LARGE')).toBeGreaterThan(sizeValue('MEDIUM'));
      expect(sizeValue('MEDIUM')).toBeGreaterThan(sizeValue('SMALL'));
    });

    it('allows placing on empty cell', () => {
      expect(canPlaceOver('SMALL', [])).toBe(true);
    });

    it('allows larger piece to cover smaller piece', () => {
      const cell: GobblerPiece[] = [{ id: '1', side: 'O', size: 'SMALL' }];
      expect(canPlaceOver('MEDIUM', cell)).toBe(true);
      expect(canPlaceOver('LARGE', cell)).toBe(true);
      expect(canPlaceOver('SMALL', cell)).toBe(false);
    });
  });

  describe('checkGobblerWin', () => {
    it('detects a row win by top pieces', () => {
      const board: GobblerPiece[][] = Array.from({ length: 9 }, () => []);
      board[0].push({ id: '1', side: 'X', size: 'SMALL' });
      board[1].push({ id: '2', side: 'X', size: 'MEDIUM' });
      board[2].push({ id: '3', side: 'X', size: 'LARGE' });
      expect(checkGobblerWin(board).winner).toBe('X');
    });

    it('ignores covered pieces of another player', () => {
      const board: GobblerPiece[][] = Array.from({ length: 9 }, () => []);
      // O has piece at 0, 1, 2, but at 1 it is covered by X
      board[0].push({ id: '1', side: 'O', size: 'SMALL' });
      board[1].push({ id: '2', side: 'O', size: 'SMALL' });
      board[1].push({ id: '3', side: 'X', size: 'MEDIUM' });
      board[2].push({ id: '4', side: 'O', size: 'SMALL' });
      expect(checkGobblerWin(board).winner).toBeNull();
    });
  });

  describe('getGobblerMove', () => {
    const createBaseState = (): GobblerState => ({
      board: Array.from({ length: 9 }, () => []),
      currentTurn: 'X',
      inventory: {
        X: [
          { id: 'x-s1', side: 'X', size: 'SMALL' },
          { id: 'x-m1', side: 'X', size: 'MEDIUM' },
          { id: 'x-l1', side: 'X', size: 'LARGE' },
        ],
        O: [
          { id: 'o-s1', side: 'O', size: 'SMALL' },
          { id: 'o-m1', side: 'O', size: 'MEDIUM' },
          { id: 'o-l1', side: 'O', size: 'LARGE' },
        ],
      },
      scores: { X: 0, O: 0 },
    });

    it('takes the winning move when available in God mode', () => {
      const state = createBaseState();
      // X already has cells 0 and 1
      state.board[0].push({ id: 'x1', side: 'X', size: 'LARGE' });
      state.board[1].push({ id: 'x2', side: 'X', size: 'LARGE' });

      const move = getGobblerMove(state, 'X', 'GOD');
      expect(move).not.toBeNull();
      expect(move!.toIndex).toBe(2);
    });

    it('blocks opponent from winning on the next turn', () => {
      const state = createBaseState();
      state.currentTurn = 'O';
      // X threatens row 0 with cells 0 and 1
      state.board[0].push({ id: 'x1', side: 'X', size: 'SMALL' });
      state.board[1].push({ id: 'x2', side: 'X', size: 'SMALL' });

      const move = getGobblerMove(state, 'O', 'GOD');
      expect(move).not.toBeNull();
      // Bot must play at cell 2 to block
      expect(move!.toIndex).toBe(2);
    });

    it('picks a valid legal move in Easy mode', () => {
      const state = createBaseState();
      const move = getGobblerMove(state, 'X', 'EASY');
      expect(move).not.toBeNull();
      const legalMoves = getLegalGobblerMoves(state, 'X');
      const isLegal = legalMoves.some(
        (m) =>
          m.toIndex === move!.toIndex &&
          (m.type === 'PLACE' ? m.pieceId === (move as any).pieceId : true),
      );
      expect(isLegal).toBe(true);
    });
  });
});
