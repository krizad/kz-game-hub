import { Test, TestingModule } from '@nestjs/testing';
import { GobblerService } from './gobbler.service';
import { RoomState, RoomStatus, GameType } from '@repo/types';

describe('GobblerService', () => {
  let service: GobblerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GobblerService],
    }).compile();

    service = module.get<GobblerService>(GobblerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinSide', () => {
    it('should allow players to join sides', () => {
      const room = {
        gameType: GameType.GOBBLER_TIC_TAC_TOE,
        status: RoomStatus.LOBBY,
        gobblerState: {},
      } as unknown as RoomState;

      let result = service.joinSide(room, 'p1', 'X');
      expect(result).not.toBeNull();
      expect(result!.gobblerState!.playerXId).toBe('p1');

      result = service.joinSide(room, 'p2', 'O');
      expect(result).not.toBeNull();
      expect(result!.gobblerState!.playerOId).toBe('p2');
      expect(result!.status).toBe(RoomStatus.PLAYING);
    });
  });

  describe('placePiece', () => {
    it('should place a piece from inventory to board', () => {
      const room = {
        gameType: GameType.GOBBLER_TIC_TAC_TOE,
        status: RoomStatus.PLAYING,
        gobblerState: {
          playerXId: 'p1',
          playerOId: 'p2',
          currentTurn: 'X',
          board: Array.from({ length: 9 }, () => []),
          inventory: {
            X: [{ id: 'piece1', size: 'SMALL', side: 'X' }],
            O: [],
          },
          scores: { X: 0, O: 0 },
        },
      } as unknown as RoomState;

      const result = service.placePiece(room, 'p1', 'piece1', 0);
      expect(result).not.toBeNull();
      const gb = result!.gobblerState!;
      expect(gb.board[0].length).toBe(1);
      expect(gb.board[0][0].id).toBe('piece1');
      expect(gb.inventory.X.length).toBe(0);
      expect(gb.currentTurn).toBe('O');
    });

    it('should result in a win when placing a row of 3', () => {
      const room = {
        players: [{ socketId: 'p1', score: 0 }],
        gameType: GameType.GOBBLER_TIC_TAC_TOE,
        status: RoomStatus.PLAYING,
        gobblerState: {
          playerXId: 'p1',
          playerOId: 'p2',
          currentTurn: 'X',
          board: [
            [{ id: 'piece1', size: 'LARGE', side: 'X' }],
            [{ id: 'piece2', size: 'LARGE', side: 'X' }],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
          ],
          inventory: {
            X: [{ id: 'piece3', size: 'LARGE', side: 'X' }],
            O: [],
          },
          scores: { X: 0, O: 0 },
        },
      } as unknown as RoomState;

      const result = service.placePiece(room, 'p1', 'piece3', 2);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.gobblerState!.winner).toBe('X');
      expect(result!.players[0].score).toBe(1);
    });
  });

  describe('movePiece', () => {
    it('should move a piece on the board and check win status', () => {
      const room = {
        players: [{ socketId: 'p1', score: 0 }],
        gameType: GameType.GOBBLER_TIC_TAC_TOE,
        status: RoomStatus.PLAYING,
        gobblerState: {
          playerXId: 'p1',
          playerOId: 'p2',
          currentTurn: 'X',
          board: [
            [{ id: 'piece1', size: 'LARGE', side: 'X' }],
            [{ id: 'piece2', size: 'LARGE', side: 'X' }],
            [],
            [{ id: 'piece3', size: 'LARGE', side: 'X' }],
            [],
            [],
            [],
            [],
            [],
          ],
          inventory: { X: [], O: [] },
          scores: { X: 0, O: 0 },
        },
      } as unknown as RoomState;

      const result = service.movePiece(room, 'p1', 3, 2);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.gobblerState!.winner).toBe('X');
    });
  });

  describe('reset', () => {
    it('should reset game to playing if both players present', () => {
      const room = {
        gameType: GameType.GOBBLER_TIC_TAC_TOE,
        status: RoomStatus.RESULT,
        gobblerState: {
          playerXId: 'p1',
          playerOId: 'p2',
          winner: 'X',
        },
      } as unknown as RoomState;

      const result = service.reset(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.gobblerState!.currentTurn).toBe('O'); // Loser goes first
      expect(result!.gobblerState!.inventory.X.length).toBe(6);
    });
  });
});
