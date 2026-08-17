"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomTimerService = void 0;
const common_1 = require("@nestjs/common");
let RoomTimerService = class RoomTimerService {
    constructor() {
        this.timers = new Map();
    }
    schedule(roomCode, timerName, deadline, callback) {
        const key = this.key(roomCode, timerName);
        this.cancel(roomCode, timerName);
        const delay = Math.max(0, deadline - Date.now());
        const timer = setTimeout(() => {
            this.timers.delete(key);
            callback();
        }, delay);
        timer.unref();
        this.timers.set(key, timer);
    }
    cancel(roomCode, timerName) {
        const key = this.key(roomCode, timerName);
        const timer = this.timers.get(key);
        if (timer)
            clearTimeout(timer);
        this.timers.delete(key);
    }
    clearRoom(roomCode) {
        const prefix = `${roomCode}:`;
        for (const [key, timer] of this.timers.entries()) {
            if (key.startsWith(prefix)) {
                clearTimeout(timer);
                this.timers.delete(key);
            }
        }
    }
    onModuleDestroy() {
        for (const timer of this.timers.values())
            clearTimeout(timer);
        this.timers.clear();
    }
    key(roomCode, timerName) {
        return `${roomCode}:${timerName}`;
    }
};
exports.RoomTimerService = RoomTimerService;
exports.RoomTimerService = RoomTimerService = __decorate([
    (0, common_1.Injectable)()
], RoomTimerService);
//# sourceMappingURL=room-timer.service.js.map