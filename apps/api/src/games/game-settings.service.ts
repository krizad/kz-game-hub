import { Injectable, Logger } from '@nestjs/common';
import { GameSettingsMap, GameType } from '@repo/types';
import { prisma } from '@repo/database';

/**
 * Per-game enable/disable flags backed by the DB `GameSetting` table and held
 * in memory (the same reference-data pattern as the trivia question store).
 * Unknown games and load failures fail OPEN: a settings outage never locks
 * every game out of the hub.
 */
@Injectable()
export class GameSettingsService {
  private readonly logger = new Logger(GameSettingsService.name);
  private readonly enabled = new Map<GameType, boolean>();

  async load(): Promise<void> {
    try {
      const rows = await prisma.gameSetting.findMany();
      const next = new Map<GameType, boolean>();
      for (const row of rows) {
        if (Object.values(GameType).includes(row.gameType as GameType)) {
          next.set(row.gameType as GameType, row.enabled);
        }
      }
      this.enabled.clear();
      for (const [gameType, isEnabled] of next) this.enabled.set(gameType, isEnabled);
    } catch (error) {
      this.logger.error('Failed to load game settings; keeping current flags', error as Error);
    }
  }

  isEnabled(gameType: GameType): boolean {
    return this.enabled.get(gameType) ?? true;
  }

  snapshot(): GameSettingsMap {
    return Object.fromEntries(this.enabled) as GameSettingsMap;
  }

  async setEnabled(gameType: GameType, enabled: boolean): Promise<void> {
    await prisma.gameSetting.upsert({
      where: { gameType },
      update: { enabled },
      create: { gameType, enabled },
    });
    this.enabled.set(gameType, enabled);
  }
}
