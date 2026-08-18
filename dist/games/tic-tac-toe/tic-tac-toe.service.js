"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicTacToeService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
let TicTacToeService = class TicTacToeService {
    isMember(room, clientId) {
        return room.players.some((p) => p.socketId === clientId);
    }
    isValidIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < 9;
    }
    joinSide(room, clientId, side) {
        if (room.gameType !== types_1.GameType.TIC_TAC_TOE || room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (!room.ticTacToeState)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (side !== 'X' && side !== 'O')
            return null;
        const ttt = room.ticTacToeState;
        const otherSide = side === 'X' ? 'O' : 'X';
        const targetSeat = side === 'X' ? ttt.playerXId : ttt.playerOId;
        if (targetSeat && targetSeat !== clientId)
            return null;
        let changed = false;
        if (targetSeat !== clientId) {
            if (side === 'X')
                ttt.playerXId = clientId;
            else
                ttt.playerOId = clientId;
            changed = true;
        }
        const otherSeat = otherSide === 'X' ? ttt.playerXId : ttt.playerOId;
        if (otherSeat === clientId) {
            if (otherSide === 'X')
                ttt.playerXId = undefined;
            else
                ttt.playerOId = undefined;
            changed = true;
        }
        if (!changed)
            return null;
        if (ttt.playerXId && ttt.playerOId) {
            room.status = types_1.RoomStatus.PLAYING;
        }
        return room;
    }
    checkWin(board) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], line: lines[i] };
            }
        }
        return { winner: null };
    }
    makeMove(room, clientId, index) {
        if (room.gameType !== types_1.GameType.TIC_TAC_TOE || room.status !== types_1.RoomStatus.PLAYING)
            return null;
        const ttt = room.ticTacToeState;
        if (!ttt || ttt.winner)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (!this.isValidIndex(index))
            return null;
        const mySide = ttt.playerXId === clientId ? 'X' : ttt.playerOId === clientId ? 'O' : null;
        if (!mySide || ttt.currentTurn !== mySide)
            return null;
        if (ttt.board[index] !== null)
            return null;
        ttt.board[index] = mySide;
        const { winner, line } = this.checkWin(ttt.board);
        if (winner) {
            ttt.winner = winner;
            ttt.winningLine = line;
            room.status = types_1.RoomStatus.RESULT;
            const winnerPlayerId = winner === 'X' ? ttt.playerXId : ttt.playerOId;
            const winnerPlayer = room.players.find((p) => p.socketId === winnerPlayerId);
            if (winnerPlayer)
                winnerPlayer.score += 1;
        }
        else if (!ttt.board.includes(null)) {
            ttt.winner = 'DRAW';
            room.status = types_1.RoomStatus.RESULT;
        }
        else {
            ttt.currentTurn = ttt.currentTurn === 'X' ? 'O' : 'X';
        }
        return room;
    }
    reset(room, clientId) {
        if (room.gameType !== types_1.GameType.TIC_TAC_TOE || room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== clientId &&
            room.ticTacToeState?.playerXId !== clientId &&
            room.ticTacToeState?.playerOId !== clientId) {
            return null;
        }
        const willStartImmediately = !!(room.ticTacToeState?.playerXId && room.ticTacToeState?.playerOId);
        room.status = willStartImmediately ? types_1.RoomStatus.PLAYING : types_1.RoomStatus.LOBBY;
        const previousWinner = room.ticTacToeState?.winner;
        room.ticTacToeState = {
            board: Array(9).fill(null),
            playerXId: room.ticTacToeState?.playerXId,
            playerOId: room.ticTacToeState?.playerOId,
            currentTurn: previousWinner === 'X' ? 'O' : 'X',
        };
        if (previousWinner === 'DRAW') {
            room.ticTacToeState.currentTurn = 'X';
        }
        return room;
    }
};
exports.TicTacToeService = TicTacToeService;
exports.TicTacToeService = TicTacToeService = __decorate([
    (0, common_1.Injectable)()
], TicTacToeService);
//# sourceMappingURL=tic-tac-toe.service.js.map