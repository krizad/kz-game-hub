"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UltimateTicTacToeService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const ultimate_tic_tac_toe_ai_1 = require("./ultimate-tic-tac-toe-ai");
let UltimateTicTacToeService = class UltimateTicTacToeService {
    constructor() {
        this.winningLines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
    }
    createInitialState() {
        return {
            subBoards: Array.from({ length: 9 }, () => ({
                cells: Array(9).fill(null),
            })),
            macroBoard: Array(9).fill(null),
            currentTurn: 'X',
            activeMacroIndex: null,
        };
    }
    isMember(room, clientId) {
        return clientId === types_1.BOT_SOCKET_ID || room.players.some((p) => p.socketId === clientId);
    }
    isValidIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < 9;
    }
    checkWin(cells) {
        for (let i = 0; i < this.winningLines.length; i++) {
            const [a, b, c] = this.winningLines[i];
            if (cells[a] && cells[a] !== 'DRAW' && cells[a] === cells[b] && cells[a] === cells[c]) {
                return { winner: cells[a], line: this.winningLines[i] };
            }
        }
        return { winner: null };
    }
    isUltimateTTTRoom(room) {
        return room.gameType === types_1.GameType.TIC_TAC_TOE && room.config.ticTacToeMode === 'ULTIMATE';
    }
    executeBotMoveIfNeeded(room) {
        if (!this.isUltimateTTTRoom(room) || room.status !== types_1.RoomStatus.PLAYING) {
            return false;
        }
        if (!room.config.ticTacToeVsBot)
            return false;
        const uttt = room.ultimateTicTacToeState;
        if (!uttt || uttt.winner)
            return false;
        const botSide = uttt.playerXId === types_1.BOT_SOCKET_ID ? 'X' : uttt.playerOId === types_1.BOT_SOCKET_ID ? 'O' : null;
        if (!botSide || uttt.currentTurn !== botSide)
            return false;
        const difficulty = room.config.ticTacToeBotDifficulty ?? 'GOD';
        const move = (0, ultimate_tic_tac_toe_ai_1.getUltimateMove)(uttt, botSide, difficulty);
        if (!move)
            return false;
        const res = this.makeMove(room, types_1.BOT_SOCKET_ID, move.macroIndex, move.microIndex);
        return !!res;
    }
    joinSide(room, clientId, side, options) {
        if (!this.isUltimateTTTRoom(room) || room.status !== types_1.RoomStatus.LOBBY) {
            return null;
        }
        if (!room.ultimateTicTacToeState)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (side !== 'X' && side !== 'O')
            return null;
        const uttt = room.ultimateTicTacToeState;
        const isVsBot = !!room.config.ticTacToeVsBot;
        if (isVsBot) {
            if (side === 'X') {
                uttt.playerXId = clientId;
                uttt.playerOId = types_1.BOT_SOCKET_ID;
            }
            else {
                uttt.playerOId = clientId;
                uttt.playerXId = types_1.BOT_SOCKET_ID;
            }
            room.status = types_1.RoomStatus.PLAYING;
            if (!options?.deferBotMove) {
                this.executeBotMoveIfNeeded(room);
            }
            return room;
        }
        const otherSide = side === 'X' ? 'O' : 'X';
        const targetSeat = side === 'X' ? uttt.playerXId : uttt.playerOId;
        const targetSeatCurrent = side === 'X' ? uttt.playerXId : uttt.playerOId;
        if (targetSeatCurrent && targetSeatCurrent !== clientId)
            return null;
        let changed = false;
        if (targetSeat !== clientId) {
            if (side === 'X')
                uttt.playerXId = clientId;
            else
                uttt.playerOId = clientId;
            changed = true;
        }
        const otherSeat = otherSide === 'X' ? uttt.playerXId : uttt.playerOId;
        if (otherSeat === clientId) {
            if (otherSide === 'X')
                uttt.playerXId = undefined;
            else
                uttt.playerOId = undefined;
            changed = true;
        }
        if (!changed)
            return null;
        if (uttt.playerXId && uttt.playerOId) {
            room.status = types_1.RoomStatus.PLAYING;
        }
        return room;
    }
    makeMove(room, clientId, macroIndex, microIndex) {
        if (!this.isUltimateTTTRoom(room) || room.status !== types_1.RoomStatus.PLAYING) {
            return null;
        }
        const uttt = room.ultimateTicTacToeState;
        if (!uttt || uttt.winner)
            return null;
        if (!this.isMember(room, clientId))
            return null;
        if (!this.isValidIndex(macroIndex) || !this.isValidIndex(microIndex))
            return null;
        const mySide = uttt.playerXId === clientId ? 'X' : uttt.playerOId === clientId ? 'O' : null;
        if (!mySide || uttt.currentTurn !== mySide)
            return null;
        if (uttt.activeMacroIndex !== null && uttt.activeMacroIndex !== macroIndex) {
            return null;
        }
        const subBoard = uttt.subBoards[macroIndex];
        if (!subBoard)
            return null;
        if (subBoard.winner)
            return null;
        if (subBoard.cells[microIndex] !== null)
            return null;
        subBoard.cells[microIndex] = mySide;
        uttt.lastMove = { macroIndex, microIndex };
        const subWin = this.checkWin(subBoard.cells);
        if (subWin.winner) {
            subBoard.winner = subWin.winner;
            subBoard.winningLine = subWin.line;
            uttt.macroBoard[macroIndex] = subWin.winner;
        }
        else if (!subBoard.cells.includes(null)) {
            subBoard.winner = 'DRAW';
            uttt.macroBoard[macroIndex] = 'DRAW';
        }
        const macroWin = this.checkWin(uttt.macroBoard);
        if (macroWin.winner) {
            uttt.winner = macroWin.winner;
            uttt.winningMacroLine = macroWin.line;
            room.status = types_1.RoomStatus.RESULT;
            const winnerPlayerId = macroWin.winner === 'X' ? uttt.playerXId : uttt.playerOId;
            const winnerPlayer = room.players.find((p) => p.socketId === winnerPlayerId);
            if (winnerPlayer)
                winnerPlayer.score += 1;
            return room;
        }
        const hasPlayableSubBoard = uttt.subBoards.some((sb) => !sb.winner && sb.cells.includes(null));
        if (!hasPlayableSubBoard) {
            uttt.winner = 'DRAW';
            room.status = types_1.RoomStatus.RESULT;
            return room;
        }
        const targetSubBoard = uttt.subBoards[microIndex];
        if (targetSubBoard.winner || !targetSubBoard.cells.includes(null)) {
            uttt.activeMacroIndex = null;
        }
        else {
            uttt.activeMacroIndex = microIndex;
        }
        uttt.currentTurn = uttt.currentTurn === 'X' ? 'O' : 'X';
        return room;
    }
    reset(room, clientId, toLobby = false, options) {
        if (!this.isUltimateTTTRoom(room) || room.status !== types_1.RoomStatus.RESULT) {
            return null;
        }
        if (room.roomHostId !== clientId &&
            room.ultimateTicTacToeState?.playerXId !== clientId &&
            room.ultimateTicTacToeState?.playerOId !== clientId) {
            return null;
        }
        const uttt = room.ultimateTicTacToeState;
        const willStartImmediately = !toLobby && !!(uttt?.playerXId && uttt?.playerOId);
        room.status = willStartImmediately ? types_1.RoomStatus.PLAYING : types_1.RoomStatus.LOBBY;
        const previousWinner = uttt?.winner;
        room.ultimateTicTacToeState = {
            subBoards: Array.from({ length: 9 }, () => ({
                cells: Array(9).fill(null),
            })),
            macroBoard: Array(9).fill(null),
            playerXId: toLobby ? undefined : uttt?.playerXId,
            playerOId: toLobby ? undefined : uttt?.playerOId,
            currentTurn: previousWinner === 'X' ? 'O' : 'X',
            activeMacroIndex: null,
        };
        if (previousWinner === 'DRAW') {
            room.ultimateTicTacToeState.currentTurn = 'X';
        }
        if (room.status === types_1.RoomStatus.PLAYING && room.config.ticTacToeVsBot) {
            if (!options?.deferBotMove) {
                this.executeBotMoveIfNeeded(room);
            }
        }
        return room;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.playerXId === oldSocketId)
            state.playerXId = newSocketId;
        if (state.playerOId === oldSocketId)
            state.playerOId = newSocketId;
    }
};
exports.UltimateTicTacToeService = UltimateTicTacToeService;
exports.UltimateTicTacToeService = UltimateTicTacToeService = __decorate([
    (0, common_1.Injectable)()
], UltimateTicTacToeService);
//# sourceMappingURL=ultimate-tic-tac-toe.service.js.map