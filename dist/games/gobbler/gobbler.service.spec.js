"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const gobbler_service_1 = require("./gobbler.service");
const types_1 = require("@repo/types");
describe('GobblerService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [gobbler_service_1.GobblerService],
        }).compile();
        service = module.get(gobbler_service_1.GobblerService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('joinSide', () => {
        it('should allow players to join sides', () => {
            const room = {
                gameType: types_1.GameType.GOBBLER_TIC_TAC_TOE,
                status: types_1.RoomStatus.LOBBY,
                gobblerState: {},
            };
            let result = service.joinSide(room, 'p1', 'X');
            expect(result).not.toBeNull();
            expect(result.gobblerState.playerXId).toBe('p1');
            result = service.joinSide(room, 'p2', 'O');
            expect(result).not.toBeNull();
            expect(result.gobblerState.playerOId).toBe('p2');
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
        });
    });
    describe('placePiece', () => {
        it('should place a piece from inventory to board', () => {
            const room = {
                gameType: types_1.GameType.GOBBLER_TIC_TAC_TOE,
                status: types_1.RoomStatus.PLAYING,
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
            };
            const result = service.placePiece(room, 'p1', 'piece1', 0);
            expect(result).not.toBeNull();
            const gb = result.gobblerState;
            expect(gb.board[0].length).toBe(1);
            expect(gb.board[0][0].id).toBe('piece1');
            expect(gb.inventory.X.length).toBe(0);
            expect(gb.currentTurn).toBe('O');
        });
        it('should result in a win when placing a row of 3', () => {
            const room = {
                players: [{ socketId: 'p1', score: 0 }],
                gameType: types_1.GameType.GOBBLER_TIC_TAC_TOE,
                status: types_1.RoomStatus.PLAYING,
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
            };
            const result = service.placePiece(room, 'p1', 'piece3', 2);
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.gobblerState.winner).toBe('X');
            expect(result.players[0].score).toBe(1);
        });
    });
    describe('movePiece', () => {
        it('should move a piece on the board and check win status', () => {
            const room = {
                players: [{ socketId: 'p1', score: 0 }],
                gameType: types_1.GameType.GOBBLER_TIC_TAC_TOE,
                status: types_1.RoomStatus.PLAYING,
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
            };
            const result = service.movePiece(room, 'p1', 3, 2);
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.RESULT);
            expect(result.gobblerState.winner).toBe('X');
        });
    });
    describe('reset', () => {
        it('should reset game to playing if both players present', () => {
            const room = {
                gameType: types_1.GameType.GOBBLER_TIC_TAC_TOE,
                status: types_1.RoomStatus.RESULT,
                gobblerState: {
                    playerXId: 'p1',
                    playerOId: 'p2',
                    winner: 'X',
                },
            };
            const result = service.reset(room, 'p1');
            expect(result).not.toBeNull();
            expect(result.status).toBe(types_1.RoomStatus.PLAYING);
            expect(result.gobblerState.currentTurn).toBe('O');
            expect(result.gobblerState.inventory.X.length).toBe(6);
        });
    });
});
//# sourceMappingURL=gobbler.service.spec.js.map