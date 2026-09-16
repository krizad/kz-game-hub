import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CardGameConfig, CardGamePresetDefinition } from '@repo/types';
import { prisma, Prisma } from '@repo/database';
import { validateConfig } from './card-engine.service';

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SHARE_CODE_LENGTH = 12;
const MAX_PUBLISH_ATTEMPTS = 5;

export interface PublishRulesResult {
  ok: boolean;
  shareCode?: string;
  error?: string;
}

export interface ImportRulesResult {
  ok: boolean;
  config?: CardGameConfig;
  error?: string;
}

@Injectable()
export class CardRulePresetRepository {
  /**
   * Persists an immutable, preset-validated copy of the given configuration
   * and returns an opaque share code. Unknown policy categories or extra
   * fields are rejected here because only the canonical validated config is
   * ever stored (ADR 0002).
   */
  async publish(config: CardGameConfig, preset: CardGamePresetDefinition): Promise<PublishRulesResult> {
    const validated = validateConfig(config, preset);
    if (!validated.ok || !validated.config) return { ok: false, error: 'INVALID_CONFIG' };

    for (let attempt = 0; attempt < MAX_PUBLISH_ATTEMPTS; attempt += 1) {
      const shareCode = this.generateShareCode();
      try {
        await prisma.cardRulePreset.create({
          data: {
            presetId: preset.id,
            shareCode,
            version: 1,
            config: validated.config as unknown as Prisma.InputJsonValue,
          },
        });
        return { ok: true, shareCode };
      } catch (error) {
        if (!this.isDuplicateShareCode(error)) return { ok: false, error: 'STORAGE_ERROR' };
      }
    }
    return { ok: false, error: 'SHARE_CODE_EXHAUSTED' };
  }

  /**
   * Loads a published configuration by its opaque code and returns a fresh,
   * room-local re-validated copy. The stored JSON is treated as untrusted.
   */
  async importByCode(shareCode: string, preset: CardGamePresetDefinition): Promise<ImportRulesResult> {
    const normalizedCode = shareCode.trim().toUpperCase();
    if (!normalizedCode) return { ok: false, error: 'NOT_FOUND' };

    let stored: { presetId: string; config: unknown } | null;
    try {
      stored = await prisma.cardRulePreset.findUnique({
        where: { shareCode: normalizedCode },
        select: { presetId: true, config: true },
      });
    } catch {
      return { ok: false, error: 'STORAGE_ERROR' };
    }

    if (!stored) return { ok: false, error: 'NOT_FOUND' };
    if (stored.presetId !== preset.id) return { ok: false, error: 'PRESET_MISMATCH' };

    const validated = validateConfig(stored.config as Partial<CardGameConfig>, preset);
    if (!validated.ok || !validated.config) return { ok: false, error: 'INVALID_STORED_CONFIG' };
    return { ok: true, config: validated.config };
  }

  private generateShareCode(): string {
    const bytes = randomBytes(SHARE_CODE_LENGTH);
    let code = '';
    for (let index = 0; index < SHARE_CODE_LENGTH; index += 1) {
      code += SHARE_CODE_ALPHABET[bytes[index] % SHARE_CODE_ALPHABET.length];
    }
    return code;
  }

  private isDuplicateShareCode(error: unknown): boolean {
    return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
  }
}
