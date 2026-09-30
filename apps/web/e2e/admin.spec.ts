import { test, expect } from '@playwright/test';
import { goToLobbyInEnglish } from './helpers';

/**
 * Admin panel smoke coverage — READ-ONLY BY DESIGN.
 *
 * Every toggle in this panel writes straight through to the shared remote
 * production MySQL (`GameSettingsService.setEnabled` upserts unconditionally,
 * even with DISABLE_GAME_SETTINGS_DB=1, which only skips *loading*). Never
 * click `admin-game-toggle-*`, `admin-artist-toggle-*` or `admin-artist-*`
 * delete buttons here; flag-gating behavior stays covered by jest specs.
 */
test('admin panel unlocks and lists every game flag and artist preset', async ({ page }) => {
  await goToLobbyInEnglish(page);

  await page.getByTestId('admin-settings-button').click();
  await expect(page.getByTestId('admin-key-input')).toBeVisible();

  // Unlock is purely client-side (form submit, no server round-trip)
  await page.getByTestId('admin-key-input').fill('e2e-readonly-key');
  await page.getByTestId('admin-unlock').click();

  // 13 games + the two Tic-Tac-Toe mode flags
  const flagTypes = [
    'WHO_KNOW',
    'SOUNDS_FISHY',
    'TIC_TAC_TOE',
    'GOBBLER_MODE',
    'ULTIMATE_MODE',
    'RPS',
    'DETECTIVE_CLUB',
    'WHO_AM_I',
    'WHO_FIRST',
    'MUSIC_TRIVIA',
    'THE_MIND',
    'SABOTEUR',
    'COUP',
    'CARD_GAME',
    'BANANA_THIEF',
  ];
  for (const flag of flagTypes) {
    const toggle = page.getByTestId(`admin-game-toggle-${flag}`);
    await expect(toggle).toBeVisible();
    // Fail-open defaults: every flag starts enabled
    await expect(toggle).toBeChecked();
  }

  // Artist preset section renders rows (seeded catalogs in the reference DB)
  // or the explicit empty state ("No artist presets yet" / Thai) — read-only
  // either way. CI's local DB has zero artists, so this branch matters there.
  await expect(
    page
      .locator('[data-testid^="admin-artist-toggle-"]')
      .first()
      .or(page.getByText(/no artist|artists?\s*empty|ยังไม่มีรายชื่อศิลปิน/i)),
  ).toBeVisible({ timeout: 10000 });
});

test('admin panel closes without leaving the lobby', async ({ page }) => {
  await goToLobbyInEnglish(page);

  await page.getByTestId('admin-settings-button').click();
  await page.getByLabel('Close admin settings').click();
  await expect(page.getByTestId('admin-key-input')).toBeHidden();

  // The lobby is still usable: the game grid is present
  await expect(page.locator('#lobbyNameInput')).toBeVisible();
});
