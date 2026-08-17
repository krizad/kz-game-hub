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
let WhoFirstService = class WhoFirstService {
    startGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        const maxRounds = room.config.whoFirstInfiniteRounds ? 0 : room.config.maxRounds || 3;
        room.whoFirstState = {
            phase: 'LOBBY',
            presses: [],
            currentRound: 1,
            maxRounds,
        };
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    handleGameAction(room, clientId, action) {
        const state = room.whoFirstState;
        if (!state)
            return null;
        const isHost = room.roomHostId === clientId;
        const isPlayer = room.players.some((p) => p.socketId === clientId);
        const penaltyEnabled = room.config.whoFirstPenalty ?? false;
        const hostPlays = room.config.whoFirstHostPlays ?? false;
        const canPlay = isPlayer && (!isHost || hostPlays);
        switch (action.type) {
            case 'START_COUNTDOWN':
                if (isHost && (state.phase === 'LOBBY' || state.phase === 'ROUND_RESULT')) {
                    state.phase = 'COUNTDOWN';
                    state.presses = [];
                    const min = room.config.whoFirstMinCountdownMs || 2000;
                    const max = room.config.whoFirstMaxCountdownMs || 5000;
                    state.countdownDurationMs = Math.floor(Math.random() * (max - min + 1) + min);
                    state.countdownStartTime = Date.now();
                }
                break;
            case 'PRESS_BUTTON': {
                if (!canPlay)
                    return room;
                if (state.presses.some((p) => p.socketId === clientId)) {
                    return room;
                }
                const pressTime = Date.now();
                if (state.phase === 'COUNTDOWN') {
                    if (penaltyEnabled) {
                        state.presses.push({
                            socketId: clientId,
                            timestamp: pressTime,
                            isPenalty: true,
                        });
                        const expectedCount = room.players.filter((p) => p.connected).length - (hostPlays ? 0 : 1);
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
                    const expectedCount = room.players.filter((p) => p.connected).length - (hostPlays ? 0 : 1);
                    const activePresses = state.presses.filter((p) => !p.isPenalty).length;
                    const foulCount = state.presses.filter((p) => p.isPenalty).length;
                    if (activePresses + foulCount >= expectedCount && expectedCount > 0) {
                        state.phase = 'ROUND_RESULT';
                    }
                }
                break;
            }
            case 'NEXT_ROUND':
                if (isHost && state.phase === 'ROUND_RESULT') {
                    if (state.maxRounds === 0 || state.currentRound < state.maxRounds) {
                        state.currentRound++;
                        state.phase = 'COUNTDOWN';
                        state.presses = [];
                        const min = room.config.whoFirstMinCountdownMs || 2000;
                        const max = room.config.whoFirstMaxCountdownMs || 5000;
                        state.countdownDurationMs = Math.floor(Math.random() * (max - min + 1) + min);
                        state.countdownStartTime = Date.now();
                    }
                    else {
                        state.phase = 'FINISHED';
                        room.status = types_1.RoomStatus.RESULT;
                    }
                }
                break;
            case 'END_GAME':
                if (isHost) {
                    state.phase = 'FINISHED';
                    room.status = types_1.RoomStatus.RESULT;
                }
                break;
            default:
                if (action.type === 'SET_ACTIVE' && isHost && state.phase === 'COUNTDOWN') {
                    state.phase = 'ACTIVE';
                    state.activeStartTime = Date.now();
                }
                break;
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
            phase: 'LOBBY',
            presses: [],
            currentRound: 1,
            maxRounds: room.config.whoFirstInfiniteRounds ? 0 : room.config.maxRounds || 3,
        };
        return room;
    }
};
exports.WhoFirstService = WhoFirstService;
exports.WhoFirstService = WhoFirstService = __decorate([
    (0, common_1.Injectable)()
], WhoFirstService);
//# sourceMappingURL=who-first.service.js.map