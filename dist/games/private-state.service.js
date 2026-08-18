"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateStateService = void 0;
const common_1 = require("@nestjs/common");
let PrivateStateService = class PrivateStateService {
    constructor() {
        this.data = new Map();
    }
    roomStore(roomCode, create = false) {
        let store = this.data.get(roomCode);
        if (!store && create) {
            store = new Map();
            this.data.set(roomCode, store);
        }
        return store;
    }
    set(roomCode, socketId, key, value) {
        const store = this.roomStore(roomCode, true);
        const socketData = store.get(socketId) ?? {};
        socketData[key] = value;
        store.set(socketId, socketData);
    }
    setMany(roomCode, socketId, values) {
        for (const [key, value] of Object.entries(values)) {
            this.set(roomCode, socketId, key, value);
        }
    }
    get(roomCode, socketId, key) {
        const store = this.roomStore(roomCode);
        return store?.get(socketId)?.[key];
    }
    has(roomCode, socketId, key) {
        const store = this.roomStore(roomCode);
        const socketData = store?.get(socketId);
        return !!socketData && key in socketData;
    }
    delete(roomCode, socketId, key) {
        const store = this.roomStore(roomCode);
        const socketData = store?.get(socketId);
        if (socketData) {
            delete socketData[key];
            if (Object.keys(socketData).length === 0) {
                store.delete(socketId);
            }
        }
    }
    getSocketData(roomCode, socketId) {
        const store = this.roomStore(roomCode);
        return { ...(store?.get(socketId) ?? {}) };
    }
    getRoomData(roomCode, key) {
        const result = new Map();
        const store = this.roomStore(roomCode);
        if (!store)
            return result;
        for (const [socketId, socketData] of store.entries()) {
            if (key in socketData) {
                result.set(socketId, socketData[key]);
            }
        }
        return result;
    }
    takeRoomData(roomCode, key) {
        const result = this.getRoomData(roomCode, key);
        for (const socketId of result.keys()) {
            this.delete(roomCode, socketId, key);
        }
        return result;
    }
    remapSocketId(roomCode, oldSocketId, newSocketId) {
        const store = this.roomStore(roomCode);
        if (!store)
            return;
        const socketData = store.get(oldSocketId);
        if (!socketData)
            return;
        store.delete(oldSocketId);
        store.set(newSocketId, { ...(store.get(newSocketId) ?? {}), ...socketData });
    }
    clearSocket(roomCode, socketId) {
        this.roomStore(roomCode)?.delete(socketId);
    }
    clearRoom(roomCode) {
        this.data.delete(roomCode);
    }
};
exports.PrivateStateService = PrivateStateService;
exports.PrivateStateService = PrivateStateService = __decorate([
    (0, common_1.Injectable)()
], PrivateStateService);
//# sourceMappingURL=private-state.service.js.map