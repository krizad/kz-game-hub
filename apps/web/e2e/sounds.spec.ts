import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

/**
 * Per-game sound toggles (the 4 games that ship a SoundToggle). Actual audio
 * output can't be asserted (WebAudio / speechSynthesis), so we verify the UI
 * state flip and that the mute preference survives a reload via the shared
 * `kzGameSoundsEnabled` localStorage key.
 */

interface GuestPool {
  guests: Page[];
  cleanup: () => Promise<void>;
}

async function spawnGuests(browser: Browser, count: number): Promise<GuestPool> {
  const guests: Page[] = [];
  const contexts: BrowserContext[] = [];
  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext();
    contexts.push(ctx);
    guests.push(await ctx.newPage());
  }
  return {
    guests,
    cleanup: async () => {
      for (const ctx of contexts) await ctx.close().catch(() => {});
    },
  };
}

async function startRoom(host: Page, guests: Page[], gameButton: string): Promise<void> {
  const code = await createRoom(host, 'Alice', gameButton);
  const origin = await getOrigin(host);
  const names = ['Bob', 'Carol', 'Dave'];
  for (let i = 0; i < guests.length; i++) {
    await joinRoom(guests[i], origin, code, names[i]);
  }
  await host.locator('button:has-text("Start Game")').first().click();
}

async function assertTogglePersisted(page: Page, testId: string) {
  const toggle = page.getByTestId(testId);
  await expect(toggle).toBeVisible({ timeout: 15000 });
  await expect(toggle).toHaveText(/🔊/);
  await toggle.click();
  await expect(toggle).toHaveText(/🔇/);
  // Reload: the muted state comes back from localStorage
  await page.reload();
  const reloaded = page.getByTestId(testId);
  await expect(reloaded).toBeVisible({ timeout: 20000 });
  await expect(reloaded).toHaveText(/🔇/);
  await reloaded.click();
}

test('coup sound toggle flips and persists', async ({ page }) => {
  const { guests, cleanup } = await spawnGuests(page.context().browser()!, 2);
  await startRoom(page, guests, 'Golden Sand House');
  await assertTogglePersisted(page, 'coup-sound-toggle');
  await cleanup();
});

test('saboteur sound toggle flips and persists', async ({ page }) => {
  const { guests, cleanup } = await spawnGuests(page.context().browser()!, 2);
  await startRoom(page, guests, 'Saboteur');
  await assertTogglePersisted(page, 'saboteur-sound-toggle');
  await cleanup();
});

test('detective club sound toggle flips and persists', async ({ page }) => {
  const { guests, cleanup } = await spawnGuests(page.context().browser()!, 2);
  await startRoom(page, guests, 'Cluecanvas');
  await assertTogglePersisted(page, 'dc-sound-toggle');
  await cleanup();
});

test('banana thief sound toggle flips and persists', async ({ page }) => {
  const { guests, cleanup } = await spawnGuests(page.context().browser()!, 3);
  await startRoom(page, guests, 'Banana Thief');
  await assertTogglePersisted(page, 'banana-thief-sound-toggle');
  await cleanup();
});
