"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("@repo/database");
const card_rule_preset_repository_1 = require("./card-rule-preset.repository");
const pok_deng_preset_1 = require("./presets/pok-deng.preset");
jest.mock('@repo/database', () => ({
    prisma: {
        cardRulePreset: {
            create: jest.fn(),
            findUnique: jest.fn(),
        },
    },
}));
const mockedPrisma = database_1.prisma;
const SHARE_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;
describe('CardRulePresetRepository', () => {
    let repository;
    beforeEach(() => {
        jest.clearAllMocks();
        repository = new card_rule_preset_repository_1.CardRulePresetRepository();
    });
    const validConfig = () => JSON.parse(JSON.stringify(pok_deng_preset_1.POK_DENG_PRESET.defaultConfig));
    describe('publish', () => {
        it('rejects a configuration outside the preset allow-list without touching storage', async () => {
            const tampered = validConfig();
            tampered.scoring.baseStake = 0;
            const result = await repository.publish(tampered, pok_deng_preset_1.POK_DENG_PRESET);
            expect(result.ok).toBe(false);
            expect(result.error).toBe('INVALID_CONFIG');
            expect(mockedPrisma.cardRulePreset.create).not.toHaveBeenCalled();
        });
        it('stores only the canonical validated config and returns an opaque code', async () => {
            mockedPrisma.cardRulePreset.create.mockResolvedValue({ id: 'row-1' });
            const smuggled = { ...validConfig(), hands: ['A-CLUBS'] };
            const result = await repository.publish(smuggled, pok_deng_preset_1.POK_DENG_PRESET);
            expect(result.ok).toBe(true);
            expect(result.shareCode).toMatch(SHARE_CODE_PATTERN);
            const data = mockedPrisma.cardRulePreset.create.mock.calls[0][0].data;
            expect(data.presetId).toBe('POK_DENG');
            expect(data.version).toBe(1);
            expect(data.shareCode).toBe(result.shareCode);
            expect(data.config.hands).toBeUndefined();
            expect(JSON.stringify(data.config)).not.toContain('CLUBS');
        });
        it('retries with a fresh code when the share code collides', async () => {
            mockedPrisma.cardRulePreset.create
                .mockRejectedValueOnce({ code: 'P2002' })
                .mockResolvedValueOnce({ id: 'row-2' });
            const result = await repository.publish(validConfig(), pok_deng_preset_1.POK_DENG_PRESET);
            expect(result.ok).toBe(true);
            expect(mockedPrisma.cardRulePreset.create).toHaveBeenCalledTimes(2);
            const first = mockedPrisma.cardRulePreset.create.mock.calls[0][0].data.shareCode;
            const second = mockedPrisma.cardRulePreset.create.mock.calls[1][0].data.shareCode;
            expect(first).not.toBe(second);
        });
        it('surfaces a storage error when creation fails for any other reason', async () => {
            mockedPrisma.cardRulePreset.create.mockRejectedValue(new Error('database down'));
            const result = await repository.publish(validConfig(), pok_deng_preset_1.POK_DENG_PRESET);
            expect(result).toEqual({ ok: false, error: 'STORAGE_ERROR' });
            expect(mockedPrisma.cardRulePreset.create).toHaveBeenCalledTimes(1);
        });
    });
    describe('importByCode', () => {
        it('returns NOT_FOUND for an unknown code and normalizes the lookup', async () => {
            mockedPrisma.cardRulePreset.findUnique.mockResolvedValue(null);
            const result = await repository.importByCode('  abcd23ef  ', pok_deng_preset_1.POK_DENG_PRESET);
            expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
            expect(mockedPrisma.cardRulePreset.findUnique).toHaveBeenCalledWith({
                where: { shareCode: 'ABCD23EF' },
                select: { presetId: true, config: true },
            });
        });
        it('returns STORAGE_ERROR when the lookup throws', async () => {
            mockedPrisma.cardRulePreset.findUnique.mockRejectedValue(new Error('database down'));
            const result = await repository.importByCode('ABCD23EF', pok_deng_preset_1.POK_DENG_PRESET);
            expect(result).toEqual({ ok: false, error: 'STORAGE_ERROR' });
        });
        it('refuses a code that belongs to another preset', async () => {
            mockedPrisma.cardRulePreset.findUnique.mockResolvedValue({
                presetId: 'SLAVE',
                config: validConfig(),
            });
            const result = await repository.importByCode('ABC234XYZ89K', pok_deng_preset_1.POK_DENG_PRESET);
            expect(result).toEqual({ ok: false, error: 'PRESET_MISMATCH' });
        });
        it('re-validates the stored config and rejects tampered rows', async () => {
            mockedPrisma.cardRulePreset.findUnique.mockResolvedValue({
                presetId: 'POK_DENG',
                config: { preset: 'POK_DENG', scoring: { baseStake: -5 } },
            });
            const result = await repository.importByCode('ABC234XYZ89K', pok_deng_preset_1.POK_DENG_PRESET);
            expect(result).toEqual({ ok: false, error: 'INVALID_STORED_CONFIG' });
        });
        it('returns a room-local copy that cannot mutate the shared preset defaults', async () => {
            mockedPrisma.cardRulePreset.findUnique.mockResolvedValue({
                presetId: 'POK_DENG',
                config: { preset: 'POK_DENG' },
            });
            const result = await repository.importByCode('abc234xyz89k', pok_deng_preset_1.POK_DENG_PRESET);
            expect(result.ok).toBe(true);
            result.config.deal.cardsPerPlayer = 9;
            expect(pok_deng_preset_1.POK_DENG_PRESET.defaultConfig.deal.cardsPerPlayer).toBe(2);
        });
    });
});
//# sourceMappingURL=card-rule-preset.repository.spec.js.map