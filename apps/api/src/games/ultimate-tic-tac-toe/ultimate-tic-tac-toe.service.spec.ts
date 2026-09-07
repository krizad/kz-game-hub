import { Test, TestingModule } from '@nestjs/testing';
import { UltimateTicTacToeService } from './ultimate-tic-tac-toe.service';
import { GameType, RoomState, RoomStatus, UltimateTicTacToeState } from '@repo/types';

describe('UltimateTicTacToeService', () => {
  let service: UltimateTicTacToeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UltimateTicTacToeService],
    }).compile();

    service = module.get<UltimateTicTacToeService>(UltimateTicTacToeService);
  });

  function createRoom(
    status: RoomStatus,
    stateOverrides: Partial<UltimateTicTacToeState> = {},
    players: Array<{ socketId: string; score?: number }> = [{ socketId: 'p1' }, { socketId: 'p2' }],
  ): RoomState {
    const defaultState = service.createInitialState();
    defaultState.playerXId = 'p1';
    defaultState.playerOId = 'p2';

    return {
      id: 'room-id',
      code: 'UTTT01',
      gameType: GameType.ULTIMATE_TIC_TAC_TOE,
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
      ultimateTicTacToeState: {
        ...defaultState,
        ...stateOverrides,
      },
    } as unknown as RoomState;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinSide', () => {
    it('should assign sides and start game when both seats are filled', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: undefined,
        playerOId: undefined,
      });

      let result = service.joinSide(room, 'p1', 'X');
      expect(result).not.toBeNull();
      expect(result!.ultimateTicTacToeState!.playerXId).toBe('p1');
      expect(result!.status).toBe(RoomStatus.LOBBY);

      result = service.joinSide(room, 'p2', 'O');
      expect(result!.ultimateTicTacToeState!.playerOId).toBe('p2');
      expect(result!.status).toBe(RoomStatus.PLAYING);
    });

    it('rejects taken seats and strangers', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: 'p1',
        playerOId: undefined,
      });

      expect(service.joinSide(room, 'stranger', 'O')).toBeNull();
      expect(service.joinSide(room, 'p2', 'X')).toBeNull();
    });

    it('allows player to switch sides', () => {
      const room = createRoom(RoomStatus.LOBBY, {
        playerXId: 'p1',
        playerOId: undefined,
      });

      service.joinSide(room, 'p1', 'O');
      expect(room.ultimateTicTacToeState!.playerXId).toBeUndefined();
      expect(room.ultimateTicTacToeState!.playerOId).toBe('p1');
    });
  });

  describe('makeMove & turn mechanics', () => {
    it('allows Player X to make a free move on turn 1 and directs Player O to the microIndex sub-board', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: null, // Free move
        currentTurn: 'X',
      });

      // Player X plays in macroBoard 4 (center), microIndex 2 (top-right)
      const result = service.makeMove(room, 'p1', 4, 2);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.subBoards[4].cells[2]).toBe('X');
      expect(uttt.currentTurn).toBe('O');
      expect(uttt.activeMacroIndex).toBe(2); // Next player MUST play in sub-board 2
      expect(uttt.lastMove).toEqual({ macroIndex: 4, microIndex: 2 });
    });

    it('rejects a move in a different sub-board when activeMacroIndex is set', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: 2,
        currentTurn: 'O',
      });

      // Player O tries to play in macroBoard 0 instead of 2
      const result = service.makeMove(room, 'p2', 0, 0);
      expect(result).toBeNull();
    });

    it('allows Player O to play in the designated sub-board', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: 2,
        currentTurn: 'O',
      });

      // Player O plays in macroBoard 2, microIndex 8
      const result = service.makeMove(room, 'p2', 2, 8);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.subBoards[2].cells[8]).toBe('O');
      expect(uttt.currentTurn).toBe('X');
      expect(uttt.activeMacroIndex).toBe(8); // Now Player X is sent to sub-board 8
    });

    it('claims a sub-board when 3 in a row are formed', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: 0,
        currentTurn: 'X',
      });
      room.ultimateTicTacToeState!.subBoards[0].cells = [
        'X',
        'X',
        null,
        'O',
        'O',
        null,
        null,
        null,
        null,
      ];

      // Player X completes top row of sub-board 0 by playing at microIndex 2
      const result = service.makeMove(room, 'p1', 0, 2);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.subBoards[0].winner).toBe('X');
      expect(uttt.subBoards[0].winningLine).toEqual([0, 1, 2]);
      expect(uttt.macroBoard[0]).toBe('X');
      expect(uttt.activeMacroIndex).toBe(2); // Target was microIndex 2, which is open
    });

    it('locks won sub-board from any further moves', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: null,
        currentTurn: 'O',
      });
      room.ultimateTicTacToeState!.subBoards[0].winner = 'X';
      room.ultimateTicTacToeState!.macroBoard[0] = 'X';

      // Attempt to play into already won sub-board 0
      const result = service.makeMove(room, 'p2', 0, 5);
      expect(result).toBeNull();
    });

    it('gives Free Move (activeMacroIndex = null) when directed to an already won sub-board', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: 1,
        currentTurn: 'X',
      });
      // Sub-board 3 is already won by O
      room.ultimateTicTacToeState!.subBoards[3].winner = 'O';
      room.ultimateTicTacToeState!.macroBoard[3] = 'O';

      // Player X plays in sub-board 1, cell 3 (pointing to won sub-board 3)
      const result = service.makeMove(room, 'p1', 1, 3);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      // Since sub-board 3 is already won, Player O gets Free Move!
      expect(uttt.activeMacroIndex).toBeNull();
      expect(uttt.currentTurn).toBe('O');
    });

    it('gives Free Move when directed to a drawn/full sub-board', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: 1,
        currentTurn: 'X',
      });
      // Sub-board 5 is full/draw
      room.ultimateTicTacToeState!.subBoards[5].winner = 'DRAW';
      room.ultimateTicTacToeState!.macroBoard[5] = 'DRAW';

      // Player X plays in sub-board 1, cell 5
      const result = service.makeMove(room, 'p1', 1, 5);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.activeMacroIndex).toBeNull();
    });

    it('detects a macro-board win and updates player score and room status', () => {
      const room = createRoom(
        RoomStatus.PLAYING,
        {
          activeMacroIndex: 2,
          currentTurn: 'X',
          macroBoard: ['X', 'X', null, null, null, null, null, null, null],
        },
        [
          { socketId: 'p1', score: 0 },
          { socketId: 'p2', score: 0 },
        ],
      );

      // Sub-board 2 has 2 X's
      room.ultimateTicTacToeState!.subBoards[2].cells = [
        'X',
        'X',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ];

      // Player X wins sub-board 2 at microIndex 2, completing [X, X, X] on macroBoard
      const result = service.makeMove(room, 'p1', 2, 2);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.subBoards[2].winner).toBe('X');
      expect(uttt.macroBoard[2]).toBe('X');
      expect(uttt.winner).toBe('X');
      expect(uttt.winningMacroLine).toEqual([0, 1, 2]);
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players.find((p) => p.socketId === 'p1')?.score).toBe(1);
    });

    it('detects overall game DRAW when no playable boards remain without a macro win', () => {
      const room = createRoom(RoomStatus.PLAYING, {
        activeMacroIndex: 8,
        currentTurn: 'X',
      });

      // Mark all boards except board 8 as DRAW
      for (let i = 0; i < 8; i++) {
        room.ultimateTicTacToeState!.subBoards[i].winner = 'DRAW';
        room.ultimateTicTacToeState!.macroBoard[i] = 'DRAW';
      }

      // In board 8, only 1 cell remains and will draw the board
      room.ultimateTicTacToeState!.subBoards[8].cells = [
        'X',
        'O',
        'X',
        'X',
        'O',
        'O',
        'O',
        'X',
        null,
      ];

      const result = service.makeMove(room, 'p1', 8, 8);
      expect(result).not.toBeNull();

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.subBoards[8].winner).toBe('DRAW');
      expect(uttt.winner).toBe('DRAW');
      expect(result!.status).toBe(RoomStatus.RESULT);
    });
  });

  describe('reset', () => {
    it('resets board to initial empty state with alternating starting turn', () => {
      const room = createRoom(RoomStatus.RESULT, {
        winner: 'X',
      });

      const result = service.reset(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);

      const uttt = result!.ultimateTicTacToeState!;
      expect(uttt.currentTurn).toBe('O'); // Loser goes first
      expect(uttt.activeMacroIndex).toBeNull();
      expect(uttt.macroBoard.every((cell) => cell === null)).toBe(true);
      expect(uttt.subBoards.every((sb) => sb.cells.every((c) => c === null))).toBe(true);
    });

    it('rejects reset from a stranger', () => {
      const room = createRoom(RoomStatus.RESULT, { winner: 'X' });
      expect(service.reset(room, 'stranger')).toBeNull();
    });
  });

  describe('remapSocketId', () => {
    it('remaps player socket ids correctly on reconnection', () => {
      const state = service.createInitialState();
      state.playerXId = 'old-p1';
      state.playerOId = 'old-p2';

      service.remapSocketId(state, 'old-p1', 'new-p1');
      expect(state.playerXId).toBe('new-p1');
      expect(state.playerOId).toBe('old-p2');
    });
  });
});
