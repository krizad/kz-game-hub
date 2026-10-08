import { test, expect, type Page } from '@playwright/test';
import { createRoom, getOrigin, joinRoom, waitForAnyVisible } from './helpers';
import { applyLobbyConfig } from './sim/play';

/**
 * Countaline: hard-asserts the deal, then plays cards ascending across both
 * players to a real completion (You Win or Game Over — lives are finite, so
 * Game Over is an achievable end and NOT swallowed like the old spec did).
 */
test.describe('Countaline Gameplay', () => {
  test('two players can start and play until game over', async ({ browser }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const [p1, p2] = await Promise.all(contexts.map((c) => c.newPage()));
    const pages: Page[] = [p1, p2];

    const roomCode = await createRoom(p1, 'Host', 'Countaline');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');
    // Keep the match short: default is 12 levels, far beyond the loop budget
    await applyLobbyConfig(p1, ['the-mind-maxlevel:4']);

    // Ready gates (lobby + per-level), then start
    for (const page of pages) {
      const readyBtn = page
        .locator('button')
        .filter({ hasText: /Ready|พร้อม/i })
        .first();
      if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyBtn.click();
      }
    }
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click();
    }

    // The level gate previews hands as inert divs — cards only become
    // playable buttons after EVERY player hits Ready (0/2 → 2/2)
    for (const page of pages) {
      await page
        .locator('button')
        .filter({ hasText: /Ready/i })
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
    }

    // Deal is deterministic: numeric hand-card buttons must appear on some page
    const handCards = pages.map((p) => p.locator('button').filter({ hasText: /^[0-9]+$/ }));
    const dealt = await waitForAnyVisible(handCards, 20000);
    expect(dealt, 'cards should be dealt after start').not.toBeNull();

    // Play the globally-lowest card until the game ends
    for (let i = 0; i < 40; i++) {
      const done = await p1
        .getByText(/You Win|Game Over/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (done) break;

      for (const page of pages) {
        await page
          .locator('button')
          .filter({ hasText: /Ready/i })
          .first()
          .click({ timeout: 300 })
          .catch(() => {});
      }
      await p1
        .locator('button')
        .filter({ hasText: /Next Level|Resume Level|Continue/i })
        .first()
        .click({ timeout: 300 })
        .catch(() => {});

      type CardInfo = { page: Page; index: number; value: number };
      const all: CardInfo[] = [];
      for (const page of pages) {
        const cardBtns = page.locator('button').filter({ hasText: /^[0-9]+$/ });
        const count = await cardBtns.count();
        for (let b = 0; b < count; b++) {
          const text = (
            await cardBtns
              .nth(b)
              .innerText()
              .catch(() => '')
          ).trim();
          const value = parseInt(text, 10);
          if (!Number.isNaN(value)) all.push({ page, index: b, value });
        }
      }
      if (all.length > 0) {
        all.sort((a, b) => a.value - b.value);
        const target = all[0];
        await target.page
          .locator('button')
          .filter({ hasText: /^[0-9]+$/ })
          .nth(target.index)
          .click({ timeout: 1500 })
          .catch(() => {});
      }
      await p1.waitForTimeout(500);
    }

    // Hard completion assertion — lives are finite so one of these ALWAYS
    // arrives; the old spec swallowed this expect and passed trivially.
    await expect(p1.getByText(/You Win|Game Over/i).first()).toBeVisible({ timeout: 20000 });

    await Promise.all(contexts.map((c) => c.close()));
  });
});
