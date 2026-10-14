"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomStartGuardService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
let RoomStartGuardService = class RoomStartGuardService {
    constructor() {
        this.activeTickets = new Map();
    }
    begin(code, room) {
        if (this.activeTickets.has(code)) {
            return 'START_BUSY';
        }
        const ticket = {
            ticketId: `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            code,
            room,
            roomHostId: room.roomHostId,
            configSnapshot: JSON.stringify(room.config ?? {}),
            participantIds: this.getParticipantIds(room),
            createdAt: Date.now(),
        };
        this.activeTickets.set(code, ticket);
        return ticket;
    }
    isCurrent(ticket, room) {
        if (!room || ticket.room !== room)
            return false;
        if (this.activeTickets.get(ticket.code) !== ticket)
            return false;
        if (room.status !== types_1.RoomStatus.LOBBY)
            return false;
        if (room.roomHostId !== ticket.roomHostId)
            return false;
        if (JSON.stringify(room.config ?? {}) !== ticket.configSnapshot)
            return false;
        const currentParticipants = this.getParticipantIds(room);
        if (currentParticipants.length !== ticket.participantIds.length)
            return false;
        for (let i = 0; i < currentParticipants.length; i++) {
            if (currentParticipants[i] !== ticket.participantIds[i])
                return false;
        }
        return true;
    }
    release(ticket) {
        if (this.activeTickets.get(ticket.code) === ticket) {
            this.activeTickets.delete(ticket.code);
        }
    }
    invalidate(code) {
        this.activeTickets.delete(code);
    }
    isBusy(code) {
        return this.activeTickets.has(code);
    }
    getParticipantIds(room) {
        return (room.players || [])
            .filter((p) => !p.isViewer && p.connected !== false)
            .map((p) => p.id || p.socketId)
            .sort();
    }
};
exports.RoomStartGuardService = RoomStartGuardService;
exports.RoomStartGuardService = RoomStartGuardService = __decorate([
    (0, common_1.Injectable)()
], RoomStartGuardService);
//# sourceMappingURL=room-start-guard.service.js.map