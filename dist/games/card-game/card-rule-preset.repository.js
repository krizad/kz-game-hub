"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardRulePresetRepository = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_1 = require("@repo/database");
const card_engine_service_1 = require("./card-engine.service");
const SHARE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SHARE_CODE_LENGTH = 12;
const MAX_PUBLISH_ATTEMPTS = 5;
let CardRulePresetRepository = class CardRulePresetRepository {
    async publish(config, preset) {
        const validated = (0, card_engine_service_1.validateConfig)(config, preset);
        if (!validated.ok || !validated.config)
            return { ok: false, error: 'INVALID_CONFIG' };
        for (let attempt = 0; attempt < MAX_PUBLISH_ATTEMPTS; attempt += 1) {
            const shareCode = this.generateShareCode();
            try {
                await database_1.prisma.cardRulePreset.create({
                    data: {
                        presetId: preset.id,
                        shareCode,
                        version: 1,
                        config: validated.config,
                    },
                });
                return { ok: true, shareCode };
            }
            catch (error) {
                if (!this.isDuplicateShareCode(error))
                    return { ok: false, error: 'STORAGE_ERROR' };
            }
        }
        return { ok: false, error: 'SHARE_CODE_EXHAUSTED' };
    }
    async importByCode(shareCode, preset) {
        const normalizedCode = shareCode.trim().toUpperCase();
        if (!normalizedCode)
            return { ok: false, error: 'NOT_FOUND' };
        let stored;
        try {
            stored = await database_1.prisma.cardRulePreset.findUnique({
                where: { shareCode: normalizedCode },
                select: { presetId: true, config: true },
            });
        }
        catch {
            return { ok: false, error: 'STORAGE_ERROR' };
        }
        if (!stored)
            return { ok: false, error: 'NOT_FOUND' };
        if (stored.presetId !== preset.id)
            return { ok: false, error: 'PRESET_MISMATCH' };
        const validated = (0, card_engine_service_1.validateConfig)(stored.config, preset);
        if (!validated.ok || !validated.config)
            return { ok: false, error: 'INVALID_STORED_CONFIG' };
        return { ok: true, config: validated.config };
    }
    generateShareCode() {
        const bytes = (0, crypto_1.randomBytes)(SHARE_CODE_LENGTH);
        let code = '';
        for (let index = 0; index < SHARE_CODE_LENGTH; index += 1) {
            code += SHARE_CODE_ALPHABET[bytes[index] % SHARE_CODE_ALPHABET.length];
        }
        return code;
    }
    isDuplicateShareCode(error) {
        return !!error && typeof error === 'object' && error.code === 'P2002';
    }
};
exports.CardRulePresetRepository = CardRulePresetRepository;
exports.CardRulePresetRepository = CardRulePresetRepository = __decorate([
    (0, common_1.Injectable)()
], CardRulePresetRepository);
//# sourceMappingURL=card-rule-preset.repository.js.map