import { Test, TestingModule } from '@nestjs/testing';
import { GobblerService } from './gobbler.service';
import { RoomState, RoomStatus, GameType, GobblerState } from '@repo/types';

describe('GobblerService', () => {
  let service: GobblerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GobblerService],
    }).compile();

    service = module.get<GobblerService>(GobblerService);
  });

  function createRoom(
    status: RoomStatus,
    gobblerState: Partial<GobblerState>,
    players: Array<{ socketId: string; score?: number }> = [{ socketId: 'p1' }, { socketId: 'p2' }],
  ): RoomState {
    return {
      id: 'room-id',
      code: 'ABC123',
      gameType: GameType.GOBBLER_TIC_TAC_TOE,
      status,
      roomHostId: 'p1',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1 },
      players: players.map((p) => ({
        id: p.socketId,
        socketId: p.socketId,
        name: p.socketId,
        score: p.score ?? 0,
        roomId: 'room-id',
        connected: true,
      })),
      gobblerState: {
        board: Array.from({ length: 9 }, () => []),
        playerXId: 'p1',
        playerOId: 'p2',
        currentTurn: 'X',
        inventory: {
          X: [
            { id: 'piece1', size: 'SMALL', side: 'X' },
            { id: 'pieceXL', size: 'LARGE', side: 'X' },
          ],
          O: [
            { id: 'piece2', size: 'SMALL', side: 'O' },
            { id: 'pieceOL', size: 'LARGE', side: 'O' },
          ],
        },
        scores: { X: 0, O: 0 },
        ...gobblerState,
      },
    } as unknown as RoomState;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinSide', () => {
    it('should allow players to join sides', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: undefined,
        playerOId: undefined,
      });

      let result = service.joinSide(room, 'p1', 'X');
      expect(result).not.toBeNull();
      expect(result!.gobblerState!.playerXId).toBe('p1');

      result = service.joinSide(room, 'p2', 'O');
      expect(result).not.toBeNull();
      expect(result!.gobblerState!.playerOId).toBe('p2');
      expect(result!.status).toBe(RoomStatus.PLAYING);
    });

    it('rejects non-members and seats already taken by others', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: undefined,
        playerOId: undefined,
      });

      expect(service.joinSide(room, 'stranger', 'X')).toBeNull();
      expect(service.joinSide(room, 'p1', 'X')).not.toBeNull();
      expect(service.joinSide(room, 'p2', 'X')).toBeNull();
    });

    it('allows switching sides without leaving a ghost seat', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: undefined,
        playerOId: undefined,
      });

      service.joinSide(room, 'p1', 'X');
      service.joinSide(room, 'p1', 'O');

      expect(room.gobblerState!.playerXId).toBeUndefined();
      expect(room.gobblerState!.playerOId).toBe('p1');
    });

    it('returns null for a no-op join of the same side', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: 'p1',
        playerOId: undefined,
      });

      expect(service.joinSide(room, 'p1', 'X')).toBeNull();
      expect(room.status).toBe(RoomStatus.LOBBY);
    });
  });

  describe('placePiece', () => {
    it('should place a piece from inventory to board', () => {
      const room = createRoom(RoomStatus.PLAYING, {});

      const result = service.placePiece(room, 'p1', 'piece1', 0);
      expect(result).not.toBeNull();
      const gb = result!.gobblerState!;
      expect(gb.board[0].length).toBe(1);
      expect(gb.board[0][0].id).toBe('piece1');
      expect(gb.currentTurn).toBe('O');
    });

    it('rejects out-of-range and non-integer indexes without crashing', () => {
      const room = createRoom(RoomStatus.PLAYING, {});

      expect(service.placePiece(room, 'p1', 'piece1', -1)).toBeNull();
      expect(service.placePiece(room, 'p1', 'piece1', 9)).toBeNull();
      expect(service.placePiece(room, 'p1', 'piece1', 2.5)).toBeNull();
      expect(service.placePiece(room, 'p1', 'piece1', 0)).not.toBeNull();
    });

    it('rejects non-members and wrong-turn players', () => {
      const room = createRoom(RoomStatus.PLAYING, {});

      expect(service.placePiece(room, 'stranger', 'piece1', 0)).toBeNull();
      expect(service.placePiece(room, 'p2', 'piece2', 0)).toBeNull();
    });

    it('rejects covering a piece of equal or larger size', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        board: [[{ id: 'big', size: 'LARGE', side: 'O' }], ...Array.from({ length: 8 }, () => [])],
      });

      expect(service.placePiece(room, 'p1', 'pieceXL', 0)).toBeNull();
    });

    it('should result in a win when placing a row of 3', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        board: [
          [{ id: 'w1', size: 'LARGE', side: 'X' }],
          [{ id: 'w2', size: 'LARGE', side: 'X' }],
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
      });

      const result = service.placePiece(room, 'p1', 'piece3', 2);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.gobblerState!.winner).toBe('X');
      expect(result!.players[0].score).toBe(1);
      expect(result!.gobblerState!.scores.X).toBe(1);
    });
  });

  describe('movePiece', () => {
    it('should move a piece on the board and check win status', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        board: [
          [{ id: 'm1', size: 'LARGE', side: 'X' }],
          [{ id: 'm2', size: 'LARGE', side: 'X' }],
          [],
          [{ id: 'piece3', size: 'LARGE', side: 'X' }],
          [],
          [],
          [],
          [],
          [],
        ],
        inventory: { X: [], O: [] },
      });

      const result = service.movePiece(room, 'p1', 3, 2);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.gobblerState!.winner).toBe('X');
    });

    it('rejects invalid indexes, same-cell moves, and moving opponent pieces', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        board: [[{ id: 'op', size: 'SMALL', side: 'O' }], ...Array.from({ length: 8 }, () => [])],
      });

      expect(service.movePiece(room, 'p1', -1, 0)).toBeNull();
      expect(service.movePiece(room, 'p1', 9, 0)).toBeNull();
      expect(service.movePiece(room, 'p1', 0, 0)).toBeNull();
      expect(service.movePiece(room, 'p1', 0, 1)).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset game to playing if both players present', () => {
      const room = createRoom(RoomStatus.RESULT, {
        winner: 'X',
        scores: { X: 1, O: 0 },
      });

      const result = service.reset(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);
      expect(result!.gobblerState!.currentTurn).toBe('O'); // Loser goes first
      expect(result!.gobblerState!.inventory.X.length).toBe(6);
      expect(result!.gobblerState!.scores).toEqual({ X: 1, O: 0 });
    });
  });
});
