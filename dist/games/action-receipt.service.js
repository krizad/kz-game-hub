"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionReceiptService = void 0;
exports.computePayloadFingerprint = computePayloadFingerprint;
const common_1 = require("@nestjs/common");
function computePayloadFingerprint(payload) {
    if (!payload || typeof payload !== 'object') {
        return String(payload);
    }
    const entries = Object.entries(payload)
        .filter(([key]) => key !== 'requestId')
        .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
}
let ActionReceiptService = class ActionReceiptService {
    constructor() {
        this.TTL_MS = 60_000;
        this.MAX_ENTRIES_PER_SEAT = 64;
        this.rooms = new Map();
    }
    isValidRequestId(requestId) {
        return typeof requestId === 'string' && requestId.length >= 1 && requestId.length <= 64;
    }
    check(code, playerId, event, requestId, payload, now = Date.now()) {
        if (!this.isValidRequestId(requestId)) {
            return { kind: 'MISS' };
        }
        const normalizedCode = code.toUpperCase();
        const seatMap = this.rooms.get(normalizedCode)?.get(playerId);
        if (!seatMap) {
            return { kind: 'MISS' };
        }
        const requestKey = `${event}:${requestId}`;
        const entry = seatMap.get(requestKey);
        if (!entry) {
            return { kind: 'MISS' };
        }
        if (now - entry.timestamp > this.TTL_MS) {
            seatMap.delete(requestKey);
            return { kind: 'MISS' };
        }
        const currentFingerprint = computePayloadFingerprint(payload);
        if (entry.fingerprint === currentFingerprint) {
            return { kind: 'HIT', receipt: entry.receipt };
        }
        const conflictReceipt = {
            code: normalizedCode,
            requestId,
            event,
            status: 'rejected',
            reason: 'REQUEST_ID_REUSED',
            serverNow: now,
        };
        return { kind: 'CONFLICT', receipt: conflictReceipt };
    }
    record(code, playerId, event, requestId, payload, receipt, now = Date.now()) {
        if (!this.isValidRequestId(requestId)) {
            return;
        }
        const normalizedCode = code.toUpperCase();
        let seatMapByPlayer = this.rooms.get(normalizedCode);
        if (!seatMapByPlayer) {
            seatMapByPlayer = new Map();
            this.rooms.set(normalizedCode, seatMapByPlayer);
        }
        let requestMap = seatMapByPlayer.get(playerId);
        if (!requestMap) {
            requestMap = new Map();
            seatMapByPlayer.set(playerId, requestMap);
        }
        for (const [key, item] of requestMap.entries()) {
            if (now - item.timestamp > this.TTL_MS) {
                requestMap.delete(key);
            }
        }
        if (requestMap.size >= this.MAX_ENTRIES_PER_SEAT) {
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [key, item] of requestMap.entries()) {
                if (item.timestamp < oldestTime) {
                    oldestTime = item.timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey) {
                requestMap.delete(oldestKey);
            }
        }
        const requestKey = `${event}:${requestId}`;
        requestMap.set(requestKey, {
            receipt,
            fingerprint: computePayloadFingerprint(payload),
            timestamp: now,
        });
    }
    clearRoom(code) {
        this.rooms.delete(code.toUpperCase());
    }
    getSeatEntryCount(code, playerId) {
        return this.rooms.get(code.toUpperCase())?.get(playerId)?.size ?? 0;
    }
};
exports.ActionReceiptService = ActionReceiptService;
exports.ActionReceiptService = ActionReceiptService = __decorate([
    (0, common_1.Injectable)()
], ActionReceiptService);
//# sourceMappingURL=action-receipt.service.js.map