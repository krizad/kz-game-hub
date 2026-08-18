"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tic_tac_toe_service_1 = require("./tic-tac-toe.service");
const types_1 = require("@repo/types");
describe('TicTacToeService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [tic_tac_toe_service_1.TicTacToeService],
        }).compile();
        service = module.get(tic_tac_toe_service_1.TicTacToeService);
    });
    function createRoom(status, state, players = [{ socketId: 'p1' }, { socketId: 'p2' }]) {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: types_1.GameType.TIC_TAC_TOE,
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
            ticTacToeState: {
                board: Array(9).fill(null),
                playerXId: 'p1',
                playerOId: 'p2',
                currentTurn: 'X',
                ...state,
            },
        };
    }
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('joinSide', () => {
        it('should assign sides to players', () => {
            const room = createRoom(types_1.RoomStatus.LOBBY, {
                playerXId: undefined,
                playerOId: undefined,
            });
            let result = service.joinSide(room, 'p1', 'X');
            expect(result).not.toBeNull();
            expect(result.ticTacToeState.playerXId).toBe('p1');
            result = service.joinSide(room, 'p2', 'O');
            expect(result.ticTacToeState.playerOId).toBe('p2');
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
        });
        it('rejects non-members and seats taken by others', () => {
            const room = createRoom(types_1.RoomStatus.LOBBY, {
                playerXId: undefined,
                playerOId: undefined,
            });
            expect(service.joinSide(room, 'stranger', 'X')).toBeNull();
            expect(service.joinSide(room, 'p1', 'X')).not.toBeNull();
            expect(service.joinSide(room, 'p2', 'X')).toBeNull();
            expect(room.ticTacToeState.playerXId).toBe('p1');
        });
        it('allows switching sides without leaving a ghost seat', () => {
            const room = createRoom(types_1.RoomStatus.LOBBY, {
                playerXId: undefined,
                playerOId: undefined,
            });
            service.joinSide(room, 'p1', 'X');
            service.joinSide(room, 'p1', 'O');
            expect(room.ticTacToeState.playerXId).toBeUndefined();
            expect(room.ticTacToeState.playerOId).toBe('p1');
        });
        it('returns null for a no-op join of the same side', () => {
            const room = createRoom(types_1.RoomStatus.LOBBY, {
                playerXId: 'p1',
                playerOId: undefined,
            });
            expect(service.joinSide(room, 'p1', 'X')).toBeNull();
            expect(room.status).toBe(types_1.RoomStatus.LOBBY);
        });
    });
    describe('makeMove', () => {
        it('should place a move on the board', () => {
            const room = createRoom(types_1.RoomStatus.PLAYING, {});
            const result = service.makeMove(room, 'p1', 0);
            expect(result).not.toBeNull();
            expect(result.ticTacToeState.board[0]).toBe('X');
            expect(result.ticTacToeState.currentTurn).toBe('O');
        });
        it('rejects out-of-range, non-integer, occupied, non-member, and wrong-turn moves', () => {
            const room = createRoom(types_1.RoomStatus.PLAYING, {
                board: ['X', null, null, null, null, null, null, null, null],
                currentTurn: 'O',
            });
            expect(service.makeMove(room, 'p2', -1)).toBeNull();
            expect(service.makeMove(room, 'p2', 9)).toBeNull();
            expect(service.makeMove(room, 'p2', 2.5)).toBeNull();
            expect(service.makeMove(room, 'p2', 0)).toBeNull();
            expect(service.makeMove(room, 'stranger', 1)).toBeNull();
            expect(service.makeMove(room, 'p1', 1)).toBeNull();
            expect(service.makeMove(room, 'p2', 1)).not.toBeNull();
        });
        it('should handle a winning move', () => {
            const room = createRoom(types_1.RoomStatus.PLAYING, {
                playerOId: undefined,
                board: ['X', 'X', null, null, null, null, null, null, null],
            }, [{ socketId: 'p1', score: 0 }]);
            const result = service.makeMove(room, 'p1', 2);
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.ticTacToeState.winner).toBe('X');
            expect(result.players[0].score).toBe(1);
        });
        it('should handle a draw', () => {
            const room = createRoom(types_1.RoomStatus.PLAYING, {
                playerOId: undefined,
                board: ['O', 'X', 'X', 'X', 'O', 'O', 'X', 'O', null],
            });
            const result = service.makeMove(room, 'p1', 8);
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.ticTacToeState.winner).toBe('DRAW');
        });
    });
    describe('reset', () => {
        it('should reset game to playing if both players present', () => {
            const room = createRoom(types_1.RoomStatus.RESULT, {
                winner: 'X',
            });
            const result = service.reset(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.ticTacToeState.currentTurn).toBe('O');
            expect(result.ticTacToeState.board.every((cell) => cell === null)).toBeTruthy();
        });
        it('rejects reset from non-participants', () => {
            const room = createRoom(types_1.RoomStatus.RESULT, { winner: 'X' });
            expect(service.reset(room, 'stranger')).toBeNull();
            expect(room.status).toBe(types_1.RoomStatus.RESULT);
        });
    });
});
//# sourceMappingURL=tic-tac-toe.service.spec.js.map