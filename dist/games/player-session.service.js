"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PlayerSessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerSessionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let PlayerSessionService = PlayerSessionService_1 = class PlayerSessionService {
    constructor() {
        this.sessions = new Map();
        this.pendingTokens = new Map();
    }
    issue(roomCode, playerId, socketId) {
        this.revokePlayer(roomCode, playerId);
        const token = (0, crypto_1.randomBytes)(32).toString('base64url');
        const roomSessions = this.sessions.get(roomCode) ?? new Map();
        roomSessions.set(this.hash(token), {
            playerId,
            expiresAt: Date.now() + PlayerSessionService_1.SESSION_TTL_MS,
        });
        this.sessions.set(roomCode, roomSessions);
        this.pendingTokens.set(socketId, token);
    }
    consume(roomCode, token) {
        const roomSessions = this.sessions.get(roomCode);
        if (!roomSessions)
            return null;
        const tokenHash = this.hash(token);
        const session = roomSessions.get(tokenHash);
        roomSessions.delete(tokenHash);
        if (!session || session.expiresAt <= Date.now())
            return null;
        return session.playerId;
    }
    takePendingToken(socketId) {
        const token = this.pendingTokens.get(socketId) ?? null;
        this.pendingTokens.delete(socketId);
        return token;
    }
    revokePlayer(roomCode, playerId) {
        const roomSessions = this.sessions.get(roomCode);
        if (!roomSessions)
            return;
        for (const [tokenHash, session] of roomSessions.entries()) {
            if (session.playerId === playerId)
                roomSessions.delete(tokenHash);
        }
        if (roomSessions.size === 0)
            this.sessions.delete(roomCode);
    }
    clearRoom(roomCode) {
        this.sessions.delete(roomCode);
    }
    clearAll() {
        this.sessions.clear();
        this.pendingTokens.clear();
    }
    hash(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('base64url');
    }
};
exports.PlayerSessionService = PlayerSessionService;
PlayerSessionService.SESSION_TTL_MS = 24 * 60 * 60 * 1000;
exports.PlayerSessionService = PlayerSessionService = PlayerSessionService_1 = __decorate([
    (0, common_1.Injectable)()
], PlayerSessionService);
//# sourceMappingURL=player-session.service.js.map