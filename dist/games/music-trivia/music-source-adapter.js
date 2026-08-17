"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicSourceFactory = void 0;
class MusicSourceFactory {
    constructor() {
        this.adapters = new Map();
    }
    register(adapter) {
        this.adapters.set(adapter.sourceType, adapter);
    }
    get(type) {
        const adapter = this.adapters.get(type);
        if (!adapter) {
            throw new Error(`No music source adapter registered for type: ${type}`);
        }
        return adapter;
    }
    has(type) {
        return this.adapters.has(type);
    }
    getAvailableTypes() {
        return Array.from(this.adapters.keys());
    }
}
exports.MusicSourceFactory = MusicSourceFactory;
//# sourceMappingURL=music-source-adapter.js.map