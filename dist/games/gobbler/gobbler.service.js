"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GobblerService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const uuid_1 = require("uuid");
let GobblerService = class GobblerService {
    createInitialInventory(side) {
        return [
            { id: (0, uuid_1.v4)(), side, size: 'SMALL' },
            { id: (0, uuid_1.v4)(), side, size: 'SMALL' },
            { id: (0, uuid_1.v4)(), side, size: 'MEDIUM' },
            { id: (0, uuid_1.v4)(), side, size: 'MEDIUM' },
            { id: (0, uuid_1.v4)(), side, size: 'LARGE' },
            { id: (0, uuid_1.v4)(), side, size: 'LARGE' },
        ];
    }
    isMember(room, clientId) {
        return room.players.some((p) => p.socketId === clientId);
    }
    isValidIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < 9;
    }
    joinSide(room, clientId, side) {
        if (room.gameType !== types_1.GameType.GOBBLER_TIC_TAC_TOE || room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (!room.gobblerState)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (side !== 'X' && side !== 'O')
            return null;
        const gb = room.gobblerState;
        const otherSide = side === 'X' ? 'O' : 'X';
        const otherSideSeat = side === 'X' ? gb.playerOId : gb.playerXId;
        const targetSeat = side === 'X' ? gb.playerXId : gb.playerOId;
        if (targetSeat && targetSeat !== clientId)
            return null;
        let changed = false;
        if (targetSeat !== clientId) {
            if (side === 'X')
                gb.playerXId = clientId;
            else
                gb.playerOId = clientId;
            changed = true;
        }
        if (otherSideSeat === clientId) {
            if (otherSide === 'X')
                gb.playerXId = undefined;
            else
                gb.playerOId = undefined;
            changed = true;
        }
        if (!changed)
            return null;
        if (gb.playerXId && gb.playerOId) {
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
        let xWins = false;
        let oWins = false;
        let winningLine;
        for (const [a, b, c] of lines) {
            const topA = board[a].length > 0 ? board[a].at(-1) : null;
            const topB = board[b].length > 0 ? board[b].at(-1) : null;
            const topC = board[c].length > 0 ? board[c].at(-1) : null;
            if (topA && topB && topC && topA.side === topB.side && topA.side === topC.side) {
                if (topA.side === 'X')
                    xWins = true;
                if (topA.side === 'O')
                    oWins = true;
                if (!winningLine)
                    winningLine = [a, b, c];
            }
        }
        if (xWins && oWins)
            return { winner: 'DRAW' };
        if (xWins)
            return { winner: 'X', line: winningLine };
        if (oWins)
            return { winner: 'O', line: winningLine };
        return { winner: null };
    }
    sizeValue(size) {
        switch (size) {
            case 'SMALL':
                return 1;
            case 'MEDIUM':
                return 2;
            case 'LARGE':
                return 3;
        }
    }
    canPlaceOver(newPiece, cell) {
        if (cell.length === 0)
            return true;
        const topPiece = cell.at(-1);
        return this.sizeValue(newPiece.size) > this.sizeValue(topPiece.size);
    }
    placePiece(room, clientId, pieceId, toIndex) {
        if (room.gameType !== types_1.GameType.GOBBLER_TIC_TAC_TOE || room.status !== types_1.RoomStatus.PLAYING)
            return null;
        const gb = room.gobblerState;
        if (!gb || gb.winner)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (typeof pieceId !== 'string' || !this.isValidIndex(toIndex))
            return null;
        let mySide = null;
        if (gb.playerXId === clientId)
            mySide = 'X';
        else if (gb.playerOId === clientId)
            mySide = 'O';
        if (!mySide || gb.currentTurn !== mySide)
            return null;
        const inventory = mySide === 'X' ? gb.inventory.X : gb.inventory.O;
        const pieceIndex = inventory.findIndex((p) => p.id === pieceId);
        if (pieceIndex === -1)
            return null;
        const piece = inventory[pieceIndex];
        if (!this.canPlaceOver(piece, gb.board[toIndex]))
            return null;
        inventory.splice(pieceIndex, 1);
        gb.board[toIndex].push(piece);
        return this.handlePostMove(room, gb);
    }
    movePiece(room, clientId, fromIndex, toIndex) {
        if (room.gameType !== types_1.GameType.GOBBLER_TIC_TAC_TOE || room.status !== types_1.RoomStatus.PLAYING)
            return null;
        const gb = room.gobblerState;
        if (!gb || gb.winner)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (!this.isValidIndex(fromIndex) || !this.isValidIndex(toIndex))
            return null;
        let mySide = null;
        if (gb.playerXId === clientId)
            mySide = 'X';
        else if (gb.playerOId === clientId)
            mySide = 'O';
        if (!mySide || gb.currentTurn !== mySide)
            return null;
        if (fromIndex === toIndex)
            return null;
        const sourceCell = gb.board[fromIndex];
        if (sourceCell.length === 0)
            return null;
        const topPiece = sourceCell.at(-1);
        if (topPiece.side !== mySide)
            return null;
        if (!this.canPlaceOver(topPiece, gb.board[toIndex]))
            return null;
        sourceCell.pop();
        gb.board[toIndex].push(topPiece);
        return this.handlePostMove(room, gb);
    }
    handlePostMove(room, gb) {
        const { winner, line } = this.checkWin(gb.board);
        if (winner) {
            gb.winner = winner;
            gb.winningLine = line;
            room.status = types_1.RoomStatus.RESULT;
            if (winner !== 'DRAW') {
                const winnerPlayerId = winner === 'X' ? gb.playerXId : gb.playerOId;
                const winnerPlayer = room.players.find((p) => p.socketId === winnerPlayerId);
                if (winnerPlayer)
                    winnerPlayer.score += 1;
            }
            const xPlayer = room.players.find((p) => p.socketId === gb.playerXId);
            const oPlayer = room.players.find((p) => p.socketId === gb.playerOId);
            gb.scores.X = xPlayer?.score ?? gb.scores.X;
            gb.scores.O = oPlayer?.score ?? gb.scores.O;
        }
        else {
            gb.currentTurn = gb.currentTurn === 'X' ? 'O' : 'X';
        }
        return room;
    }
    reset(room, clientId) {
        if (room.gameType !== types_1.GameType.GOBBLER_TIC_TAC_TOE || room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== clientId &&
            room.gobblerState?.playerXId !== clientId &&
            room.gobblerState?.playerOId !== clientId) {
            return null;
        }
        const willStartImmediately = !!(room.gobblerState?.playerXId && room.gobblerState?.playerOId);
        room.status = willStartImmediately ? types_1.RoomStatus.PLAYING : types_1.RoomStatus.LOBBY;
        const previousWinner = room.gobblerState?.winner;
        room.gobblerState = {
            board: Array.from({ length: 9 }, () => []),
            playerXId: room.gobblerState?.playerXId,
            playerOId: room.gobblerState?.playerOId,
            currentTurn: previousWinner === 'X' ? 'O' : 'X',
            inventory: {
                X: this.createInitialInventory('X'),
                O: this.createInitialInventory('O'),
            },
            scores: room.gobblerState?.scores || { X: 0, O: 0 },
        };
        if (previousWinner === 'DRAW' || !previousWinner) {
            room.gobblerState.currentTurn = 'X';
        }
        return room;
    }
};
exports.GobblerService = GobblerService;
exports.GobblerService = GobblerService = __decorate([
    (0, common_1.Injectable)()
], GobblerService);
//# sourceMappingURL=gobbler.service.js.map