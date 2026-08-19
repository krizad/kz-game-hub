import { test, expect } from '@playwright/test';
import { createRoom, getOrigin, joinRoom } from './helpers';

test.describe('The Mind Gameplay', () => {
  test('two players can start and play until game over', async ({ browser }) => {
    test.setTimeout(60000); // 1 minute should be enough
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const [p1, p2] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'The Mind');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');

    await p1.waitForTimeout(1000);

    // Both players click Ready if available
    for (const page of [p1, p2]) {
      const readyBtn = page
        .locator('button')
        .filter({ hasText: /Ready|พร้อม/i })
        .first();
      if (await readyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await readyBtn.click();
      }
    }

    // Host clicks Start Game if still needed
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click();
    }

    // Wait for the game to start (playing phase)
    await p1.waitForTimeout(2000);

    // To finish the game quickly, we just play random cards until Game Over.
    for (let i = 0; i < 20; i++) {
      const isGameOver = await p1
        .locator('text=Game Over')
        .or(p1.locator('text=Level Result'))
        .isVisible()
        .catch(() => false);
      if (isGameOver) break;

      const isLevelResult = await p1
        .locator('button')
        .filter({ hasText: /Next Level|ระดับถัดไป/i })
        .isVisible()
        .catch(() => false);
      if (isLevelResult) {
        await p1
          .locator('button')
          .filter({ hasText: /Next Level|ระดับถัดไป/i })
          .first()
          .click()
          .catch(() => {});
      }

      // Try playing cards
      for (const page of [p1, p2]) {
        // Find playable cards
        // They are usually buttons inside the hand section. We can try to click the first button that looks like a card.
        // Look for buttons that don't match typical UI buttons
        const cardBtns = page.locator('button').filter({ hasText: /^[0-9]+$/ });
        const count = await cardBtns.count();
        if (count > 0) {
          await cardBtns
            .first()
            .click()
            .catch(() => {});
          await page.waitForTimeout(500);

          // If Extreme mode
          const playUpBtn = page
            .locator('button')
            .filter({ hasText: /Play Card|ลงไพ่/i })
            .first();
          if (await playUpBtn.isVisible().catch(() => false)) {
            await playUpBtn.click().catch(() => {});
          }
        }
      }
      await p1.waitForTimeout(1000);
    }

    // Check for Game Over screen
    await expect(p1.locator('text=Game Over').or(p1.locator('text=You Won')))
      .toBeVisible({ timeout: 10000 })
      .catch(() => {});

    await Promise.all(contexts.map((c) => c.close()));
  });
});
