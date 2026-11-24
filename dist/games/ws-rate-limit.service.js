"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsRateLimitService = void 0;
exports.extractClientIp = extractClientIp;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const ADMIN_EVENTS = new Set([
    types_1.SOCKET_EVENTS.ADMIN_VERIFY_KEY,
    types_1.SOCKET_EVENTS.SET_GAME_ENABLED,
    types_1.SOCKET_EVENTS.SET_ARTIST_ENABLED,
    types_1.SOCKET_EVENTS.DELETE_ARTIST,
]);
function parsePositiveInt(raw, fallback) {
    if (!raw)
        return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function extractClientIp(handshake) {
    const forwarded = handshake?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
        const firstHop = forwarded.split(',')[0]?.trim();
        if (firstHop)
            return firstHop;
    }
    else if (Array.isArray(forwarded) && forwarded.length > 0) {
        const firstHop = forwarded[0]?.split(',')[0]?.trim();
        if (firstHop)
            return firstHop;
    }
    return handshake?.address || 'unknown';
}
let WsRateLimitService = class WsRateLimitService {
    constructor() {
        this.adminBuckets = new Map();
        this.socketBuckets = new Map();
    }
    isDisabled() {
        const flag = process.env.DISABLE_RATE_LIMIT;
        return flag === '1' || flag === 'true';
    }
    isAdminEvent(event) {
        return ADMIN_EVENTS.has(event);
    }
    getBucketConfig(bucket) {
        switch (bucket) {
            case 'admin':
                return {
                    limit: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_MAX, 5),
                    windowMs: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS, 60_000),
                    lockoutMs: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_LOCKOUT_MS, 300_000),
                    errorCode: 'ADMIN_RATE_LIMITED',
                };
            case 'create_room':
                return {
                    limit: parsePositiveInt(process.env.RATE_LIMIT_CREATE_ROOM_MAX, 5),
                    windowMs: parsePositiveInt(process.env.RATE_LIMIT_CREATE_ROOM_WINDOW_MS, 60_000),
                    errorCode: 'RATE_LIMITED',
                };
            case 'external':
                return {
                    limit: parsePositiveInt(process.env.RATE_LIMIT_EXTERNAL_MAX, 10),
                    windowMs: parsePositiveInt(process.env.RATE_LIMIT_EXTERNAL_WINDOW_MS, 60_000),
                    errorCode: 'RATE_LIMITED',
                };
            case 'general':
                return {
                    limit: parsePositiveInt(process.env.RATE_LIMIT_GENERAL_MAX, 60),
                    windowMs: parsePositiveInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS, 10_000),
                    errorCode: 'RATE_LIMITED',
                };
        }
    }
    checkBucket(bucket, key, now = Date.now()) {
        if (this.isDisabled()) {
            return { allowed: true };
        }
        const config = this.getBucketConfig(bucket);
        const store = bucket === 'admin' ? this.adminBuckets : this.socketBuckets;
        const compositeKey = `${bucket}:${key}`;
        let entry = store.get(compositeKey);
        if (!entry) {
            entry = { timestamps: [] };
            store.set(compositeKey, entry);
        }
        if (entry.lockedUntil && now < entry.lockedUntil) {
            return {
                allowed: false,
                errorCode: config.errorCode,
                retryAfterMs: entry.lockedUntil - now,
            };
        }
        if (entry.lockedUntil && now >= entry.lockedUntil) {
            entry.lockedUntil = undefined;
            entry.timestamps = [];
        }
        const windowStart = now - config.windowMs;
        while (entry.timestamps.length > 0 && entry.timestamps[0] <= windowStart) {
            entry.timestamps.shift();
        }
        if (entry.timestamps.length >= config.limit) {
            if (config.lockoutMs) {
                entry.lockedUntil = now + config.lockoutMs;
                return {
                    allowed: false,
                    errorCode: config.errorCode,
                    retryAfterMs: config.lockoutMs,
                };
            }
            const oldest = entry.timestamps[0] ?? now;
            return {
                allowed: false,
                errorCode: config.errorCode,
                retryAfterMs: Math.max(1, oldest + config.windowMs - now),
            };
        }
        entry.timestamps.push(now);
        return { allowed: true };
    }
    checkEvent(params) {
        if (this.isDisabled()) {
            return { allowed: true };
        }
        const now = params.now ?? Date.now();
        if (this.isAdminEvent(params.event)) {
            return this.checkBucket('admin', params.clientIp, now);
        }
        if (params.event === types_1.SOCKET_EVENTS.CREATE_ROOM) {
            const createRes = this.checkBucket('create_room', params.socketId, now);
            if (!createRes.allowed)
                return createRes;
        }
        if (params.isExternalApiEvent) {
            const extRes = this.checkBucket('external', params.socketId, now);
            if (!extRes.allowed)
                return extRes;
        }
        if (!params.isQuietEvent) {
            return this.checkBucket('general', params.socketId, now);
        }
        return { allowed: true };
    }
    clearSocket(socketId) {
        this.socketBuckets.delete(`create_room:${socketId}`);
        this.socketBuckets.delete(`external:${socketId}`);
        this.socketBuckets.delete(`general:${socketId}`);
    }
};
exports.WsRateLimitService = WsRateLimitService;
exports.WsRateLimitService = WsRateLimitService = __decorate([
    (0, common_1.Injectable)()
], WsRateLimitService);
//# sourceMappingURL=ws-rate-limit.service.js.map