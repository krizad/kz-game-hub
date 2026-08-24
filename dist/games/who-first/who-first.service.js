"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhoFirstService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const VALID_ACTIONS = [
    'START_COUNTDOWN',
    'PRESS_BUTTON',
    'NEXT_ROUND',
    'END_GAME',
];
let WhoFirstService = class WhoFirstService {
    getCountdownRange(room) {
        const minConfig = room.config.whoFirstMinCountdownMs ?? 2000;
        const maxConfig = room.config.whoFirstMaxCountdownMs ?? 5000;
        return { min: Math.min(minConfig, maxConfig), max: Math.max(minConfig, maxConfig) };
    }
    startCountdown(room) {
        const state = room.whoFirstState;
        if (!state)
            return;
        state.phase = 'COUNTDOWN';
        state.presses = [];
        state.roundWinnerId = undefined;
        const { min, max } = this.getCountdownRange(room);
        state.countdownDurationMs = Math.floor(Math.random() * (max - min + 1) + min);
        state.countdownStartTime = Date.now();
        state.countdownEndTime = state.countdownStartTime + state.countdownDurationMs;
    }
    getExpectedCount(room) {
        const hostPlays = room.config.whoFirstHostPlays ?? false;
        return room.players.filter((p) => p.connected).length - (hostPlays ? 0 : 1);
    }
    resolveRoundWinner(room) {
        const state = room.whoFirstState;
        if (!state)
            return;
        const validPresses = state.presses
            .filter((p) => !p.isPenalty)
            .sort((a, b) => a.timestamp - b.timestamp);
        if (validPresses.length === 0)
            return;
        const winnerId = validPresses[0].socketId;
        state.roundWinnerId = winnerId;
        const winner = room.players.find((p) => p.socketId === winnerId);
        if (winner)
            winner.score += 1;
    }
    startGame(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const connectedCount = room.players.filter((p) => p.connected !== false).length;
        if (connectedCount < 2)
            return null;
        const maxRounds = room.config.whoFirstInfiniteRounds
            ? 0
            : (room.config.whoFirstMaxRounds ?? room.config.maxRounds ?? 3);
        room.whoFirstState = {
            phase: 'COUNTDOWN',
            presses: [],
            currentRound: 1,
            maxRounds,
        };
        room.status = types_1.RoomStatus.PLAYING;
        this.startCountdown(room);
        return room;
    }
    setActive(room) {
        const state = room.whoFirstState;
        if (!state || state.phase !== 'COUNTDOWN')
            return null;
        state.phase = 'ACTIVE';
        state.activeStartTime = Date.now();
        return room;
    }
    handleGameAction(room, clientId, action) {
        const state = room.whoFirstState;
        if (!state)
            return null;
        if (!VALID_ACTIONS.includes(action.type))
            return null;
        const isHost = room.roomHostId === clientId;
        const isPlayer = room.players.some((p) => p.socketId === clientId);
        const penaltyEnabled = room.config.whoFirstPenalty ?? false;
        const hostPlays = room.config.whoFirstHostPlays ?? false;
        const canPlay = isPlayer && (!isHost || hostPlays);
        switch (action.type) {
            case 'START_COUNTDOWN':
                if (isHost && state.phase === 'ROUND_RESULT') {
                    this.startCountdown(room);
                }
                else {
                    return null;
                }
                break;
            case 'PRESS_BUTTON': {
                if (!canPlay)
                    return null;
                if (state.presses.some((p) => p.socketId === clientId)) {
                    return null;
                }
                const pressTime = Date.now();
                if (state.phase === 'COUNTDOWN') {
                    if (penaltyEnabled) {
                        state.presses.push({
                            socketId: clientId,
                            timestamp: pressTime,
                            isPenalty: true,
                        });
                        const expectedCount = this.getExpectedCount(room);
                        if (state.presses.length >= expectedCount && expectedCount > 0) {
                            state.phase = 'ROUND_RESULT';
                        }
                    }
                }
                else if (state.phase === 'ACTIVE') {
                    const reactionTimeMs = state.activeStartTime ? pressTime - state.activeStartTime : 0;
                    state.presses.push({
                        socketId: clientId,
                        timestamp: pressTime,
                        reactionTimeMs,
                        isPenalty: false,
                    });
                    const expectedCount = this.getExpectedCount(room);
                    const activePresses = state.presses.filter((p) => !p.isPenalty).length;
                    const foulCount = state.presses.filter((p) => p.isPenalty).length;
                    if (activePresses + foulCount >= expectedCount && expectedCount > 0) {
                        state.phase = 'ROUND_RESULT';
                        this.resolveRoundWinner(room);
                    }
                }
                else {
                    return null;
                }
                break;
            }
            case 'NEXT_ROUND':
                if (isHost && state.phase === 'ROUND_RESULT') {
                    if (state.maxRounds === 0 || state.currentRound < state.maxRounds) {
                        state.currentRound++;
                        this.startCountdown(room);
                    }
                    else {
                        state.phase = 'FINISHED';
                        room.status = types_1.RoomStatus.RESULT;
                    }
                }
                else {
                    return null;
                }
                break;
            case 'END_GAME':
                if (isHost) {
                    state.phase = 'FINISHED';
                    room.status = types_1.RoomStatus.RESULT;
                }
                else {
                    return null;
                }
                break;
            default:
                return null;
        }
        return room;
    }
    resetGame(room, requesterId) {
        if (room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.whoFirstState = {
            phase: 'COUNTDOWN',
            presses: [],
            currentRound: 1,
            maxRounds: room.config.whoFirstInfiniteRounds
                ? 0
                : (room.config.whoFirstMaxRounds ?? room.config.maxRounds ?? 3),
        };
        return room;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        state.presses.forEach((press) => {
            if (press.socketId === oldSocketId)
                press.socketId = newSocketId;
        });
        if (state.roundWinnerId === oldSocketId)
            state.roundWinnerId = newSocketId;
    }
};
exports.WhoFirstService = WhoFirstService;
exports.WhoFirstService = WhoFirstService = __decorate([
    (0, common_1.Injectable)()
], WhoFirstService);
//# sourceMappingURL=who-first.service.js.map