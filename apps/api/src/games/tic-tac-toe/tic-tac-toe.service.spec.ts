import { Test, TestingModule } from '@nestjs/testing';
import { TicTacToeService } from './tic-tac-toe.service';
import { RoomState, RoomStatus, GameType } from '@repo/types';

describe('TicTacToeService', () => {
  let service: TicTacToeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicTacToeService],
    }).compile();

    service = module.get<TicTacToeService>(TicTacToeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinSide', () => {
    it('should assign sides to players', () => {
      const room = {
        gameType: GameType.TIC_TAC_TOE,
        status: RoomStatus.LOBBY,
        ticTacToeState: {},
      } as unknown as RoomState;

      let result = service.joinSide(room, 'p1', 'X');
      expect(result).not.toBeNull();
      expect(result!.ticTacToeState!.playerXId).toBe('p1');

      result = service.joinSide(room, 'p2', 'O');
      expect(result!.ticTacToeState!.playerOId).toBe('p2');
      expect(result!.status).toBe(RoomStatus.PLAYING);
    });
  });

  describe('makeMove', () => {
    it('should place a move on the board', () => {
      const room = {
        gameType: GameType.TIC_TAC_TOE,
        status: RoomStatus.PLAYING,
        ticTacToeState: {
          playerXId: 'p1',
          playerOId: 'p2',
          currentTurn: 'X',
          board: Array(9).fill(null),
        },
      } as unknown as RoomState;

      const result = service.makeMove(room, 'p1', 0);
      expect(result).not.toBeNull();
      expect(result!.ticTacToeState!.board[0]).toBe('X');
      expect(result!.ticTacToeState!.currentTurn).toBe('O');
    });

    it('should handle a winning move', () => {
      const room = {
        players: [{ socketId: 'p1', score: 0 }],
        gameType: GameType.TIC_TAC_TOE,
        status: RoomStatus.PLAYING,
        ticTacToeState: {
          playerXId: 'p1',
          currentTurn: 'X',
          board: ['X', 'X', null, null, null, null, null, null, null],
        },
      } as unknown as RoomState;

      const result = service.makeMove(room, 'p1', 2);
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.ticTacToeState!.winner).toBe('X');
      expect(result!.players[0].score).toBe(1);
    });

    it('should handle a draw', () => {
      const room = {
        gameType: GameType.TIC_TAC_TOE,
        status: RoomStatus.PLAYING,
        ticTacToeState: {
          playerXId: 'p1',
          currentTurn: 'X',
          // Board has 1 spots left (index 8), others are filled
          board: ['O', 'X', 'X', 'X', 'O', 'O', 'X', 'O', null],
        },
      } as unknown as RoomState;

      const result = service.makeMove(room, 'p1', 8);
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.ticTacToeState!.winner).toBe('DRAW');
    });
  });

  describe('reset', () => {
    it('should reset game to playing if both players present', () => {
      const room = {
        gameType: GameType.TIC_TAC_TOE,
        status: RoomStatus.RESULT,
        ticTacToeState: {
          playerXId: 'p1',
          playerOId: 'p2',
          winner: 'X',
        },
      } as unknown as RoomState;

      const result = service.reset(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.ticTacToeState!.currentTurn).toBe('O'); // Loser goes first
      expect(result!.ticTacToeState!.board.every((cell) => cell === null)).toBeTruthy();
    });
  });
});
