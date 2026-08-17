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
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('joinSide', () => {
        it('should assign sides to players', () => {
            const room = {
                gameType: types_1.GameType.TIC_TAC_TOE,
                status: types_1.RoomStatus.LOBBY,
                ticTacToeState: {},
            };
            let result = service.joinSide(room, 'p1', 'X');
            expect(result).not.toBeNull();
            expect(result.ticTacToeState.playerXId).toBe('p1');
            result = service.joinSide(room, 'p2', 'O');
            expect(result.ticTacToeState.playerOId).toBe('p2');
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
        });
    });
    describe('makeMove', () => {
        it('should place a move on the board', () => {
            const room = {
                gameType: types_1.GameType.TIC_TAC_TOE,
                status: types_1.RoomStatus.PLAYING,
                ticTacToeState: {
                    playerXId: 'p1',
                    playerOId: 'p2',
                    currentTurn: 'X',
                    board: Array(9).fill(null),
                },
            };
            const result = service.makeMove(room, 'p1', 0);
            expect(result).not.toBeNull();
            expect(result.ticTacToeState.board[0]).toBe('X');
            expect(result.ticTacToeState.currentTurn).toBe('O');
        });
        it('should handle a winning move', () => {
            const room = {
                players: [{ socketId: 'p1', score: 0 }],
                gameType: types_1.GameType.TIC_TAC_TOE,
                status: types_1.RoomStatus.PLAYING,
                ticTacToeState: {
                    playerXId: 'p1',
                    currentTurn: 'X',
                    board: ['X', 'X', null, null, null, null, null, null, null],
                },
            };
            const result = service.makeMove(room, 'p1', 2);
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.ticTacToeState.winner).toBe('X');
            expect(result.players[0].score).toBe(1);
        });
        it('should handle a draw', () => {
            const room = {
                gameType: types_1.GameType.TIC_TAC_TOE,
                status: types_1.RoomStatus.PLAYING,
                ticTacToeState: {
                    playerXId: 'p1',
                    currentTurn: 'X',
                    board: ['O', 'X', 'X', 'X', 'O', 'O', 'X', 'O', null],
                },
            };
            const result = service.makeMove(room, 'p1', 8);
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.ticTacToeState.winner).toBe('DRAW');
        });
    });
    describe('reset', () => {
        it('should reset game to playing if both players present', () => {
            const room = {
                gameType: types_1.GameType.TIC_TAC_TOE,
                status: types_1.RoomStatus.RESULT,
                ticTacToeState: {
                    playerXId: 'p1',
                    playerOId: 'p2',
                    winner: 'X',
                },
            };
            const result = service.reset(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.ticTacToeState.currentTurn).toBe('O');
            expect(result.ticTacToeState.board.every((cell) => cell === null)).toBeTruthy();
        });
    });
});
//# sourceMappingURL=tic-tac-toe.service.spec.js.map