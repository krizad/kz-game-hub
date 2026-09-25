import { Injectable, Logger } from '@nestjs/common';
import { GameSettingsMap, GameType, TTT_MODE_FLAGS, TttModeFlag } from '@repo/types';
import { prisma } from '@repo/database';

/** Every flag key the settings service accepts: games + TTT mode flags. */
export type SettingsKey = GameType | TttModeFlag;

const isSettingsKey = (value: string): value is SettingsKey =>
  Object.values(GameType).includes(value as GameType) ||
  (TTT_MODE_FLAGS as readonly string[]).includes(value);

/**
 * Per-game enable/disable flags backed by the DB `GameSetting` table and held
 * in memory (the same reference-data pattern as the trivia question store).
 * Includes the Tic-Tac-Toe mode flags (`GOBBLER_MODE`/`ULTIMATE_MODE`), which
 * hide those modes from the in-room selector rather than whole games.
 * Unknown games and load failures fail OPEN: a settings outage never locks
 * every game out of the hub.
 */
@Injectable()
export class GameSettingsService {
  private readonly logger = new Logger(GameSettingsService.name);
  private readonly enabled = new Map<SettingsKey, boolean>();

  async load(): Promise<void> {
    // E2E/dev isolation: tests must not depend on production flag state in the
    // shared remote DB. An empty map means fail-open for every game/flag.
    if (process.env.DISABLE_GAME_SETTINGS_DB === '1') {
      this.enabled.clear();
      return;
    }
    try {
      const rows = await prisma.gameSetting.findMany();
      const next = new Map<SettingsKey, boolean>();
      for (const row of rows) {
        if (isSettingsKey(row.gameType)) {
          next.set(row.gameType, row.enabled);
        }
      }
      this.enabled.clear();
      for (const [key, isEnabled] of next) this.enabled.set(key, isEnabled);
    } catch (error) {
      this.logger.error('Failed to load game settings; keeping current flags', error as Error);
    }
  }

  isEnabled(key: SettingsKey): boolean {
    return this.enabled.get(key) ?? true;
  }

  snapshot(): GameSettingsMap {
    return Object.fromEntries(this.enabled) as GameSettingsMap;
  }

  async setEnabled(key: SettingsKey, enabled: boolean): Promise<void> {
    await prisma.gameSetting.upsert({
      where: { gameType: key },
      update: { enabled },
      create: { gameType: key, enabled },
    });
    this.enabled.set(key, enabled);
  }
}
