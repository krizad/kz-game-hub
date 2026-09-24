"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const types_1 = require("@repo/types");
jest.mock('@repo/database', () => ({
    prisma: {
        gameSetting: {
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));
const database_1 = require("@repo/database");
const game_settings_service_1 = require("./game-settings.service");
describe('GameSettingsService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [game_settings_service_1.GameSettingsService],
        }).compile();
        service = module.get(game_settings_service_1.GameSettingsService);
        jest.clearAllMocks();
    });
    it('loads flags from the DB and keeps unknown games enabled', async () => {
        database_1.prisma.gameSetting.findMany.mockResolvedValue([
            { gameType: 'COUP', enabled: false },
            { gameType: 'SABOTEUR', enabled: true },
            { gameType: 'NOT_A_GAME', enabled: false },
        ]);
        await service.load();
        expect(service.isEnabled(types_1.GameType.COUP)).toBe(false);
        expect(service.isEnabled(types_1.GameType.SABOTEUR)).toBe(true);
        expect(service.isEnabled(types_1.GameType.THE_MIND)).toBe(true);
        expect(service.snapshot()).toEqual({ COUP: false, SABOTEUR: true });
    });
    it('fails open when the DB load errors', async () => {
        database_1.prisma.gameSetting.findMany.mockRejectedValue(new Error('db down'));
        await service.load();
        expect(service.isEnabled(types_1.GameType.COUP)).toBe(true);
    });
    it('persists a flag flip and updates the in-memory snapshot', async () => {
        database_1.prisma.gameSetting.upsert.mockResolvedValue({});
        await service.setEnabled(types_1.GameType.COUP, false);
        expect(database_1.prisma.gameSetting.upsert).toHaveBeenCalledWith({
            where: { gameType: 'COUP' },
            update: { enabled: false },
            create: { gameType: 'COUP', enabled: false },
        });
        expect(service.isEnabled(types_1.GameType.COUP)).toBe(false);
    });
});
//# sourceMappingURL=game-settings.service.spec.js.map