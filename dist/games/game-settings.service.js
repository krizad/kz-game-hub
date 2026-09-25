"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GameSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSettingsService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const database_1 = require("@repo/database");
const isSettingsKey = (value) => Object.values(types_1.GameType).includes(value) ||
    types_1.TTT_MODE_FLAGS.includes(value);
let GameSettingsService = GameSettingsService_1 = class GameSettingsService {
    constructor() {
        this.logger = new common_1.Logger(GameSettingsService_1.name);
        this.enabled = new Map();
    }
    async load() {
        if (process.env.DISABLE_GAME_SETTINGS_DB === '1') {
            this.enabled.clear();
            return;
        }
        try {
            const rows = await database_1.prisma.gameSetting.findMany();
            const next = new Map();
            for (const row of rows) {
                if (isSettingsKey(row.gameType)) {
                    next.set(row.gameType, row.enabled);
                }
            }
            this.enabled.clear();
            for (const [key, isEnabled] of next)
                this.enabled.set(key, isEnabled);
        }
        catch (error) {
            this.logger.error('Failed to load game settings; keeping current flags', error);
        }
    }
    isEnabled(key) {
        return this.enabled.get(key) ?? true;
    }
    snapshot() {
        return Object.fromEntries(this.enabled);
    }
    async setEnabled(key, enabled) {
        await database_1.prisma.gameSetting.upsert({
            where: { gameType: key },
            update: { enabled },
            create: { gameType: key, enabled },
        });
        this.enabled.set(key, enabled);
    }
};
exports.GameSettingsService = GameSettingsService;
exports.GameSettingsService = GameSettingsService = GameSettingsService_1 = __decorate([
    (0, common_1.Injectable)()
], GameSettingsService);
//# sourceMappingURL=game-settings.service.js.map