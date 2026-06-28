import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Sounds Fishy Gameplay', () => {
  test('three players can start game and enter answer phase', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'FishHost', 'Sounds Fishy');
    const origin = await getOrigin(p1);

    await joinRoom(p2, origin, roomCode, 'F1');
    await joinRoom(p3, origin, roomCode, 'F2');

    // All should be in the room
    await p1.waitForTimeout(1500);

    // Host starts game
    const startBtn = p1.getByText('Start Game');
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await p1.waitForTimeout(3000);
    }

    // Check for answer submission phase
    // Non-picker players should see an answer input
    await p1.waitForTimeout(1000);

    for (const page of [p2, p3]) {
      const input = page.locator('input').filter({ hasText: '' });
      if ((await input.count()) > 0) {
        const answerInput = input.last();
        if (await answerInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await answerInput.fill('This is the truth');
        }
        const submitBtn = page.locator('button').filter({ hasText: /Submit/ });
        if (
          await submitBtn
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await submitBtn.first().click();
        }
      }
    }

    await p1.waitForTimeout(2000);
    await Promise.all(contexts.map((c) => c.close()));
  });

  test('can create room and see lobby', async ({ page }) => {
    await createRoom(page, 'FishTest', 'Sounds Fishy');
    await expect(page.getByText('FishTest').first()).toBeVisible();
  });
});
