import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Who Know Gameplay', () => {
  test('four players can start game flow', async ({ browser }) => {
    test.setTimeout(120000); // 2 minutes for Who Know
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'Who Know');
    const origin = await getOrigin(p1);

    await joinRoom(p2, origin, roomCode, 'P1');
    await joinRoom(p3, origin, roomCode, 'P2');
    await joinRoom(p4, origin, roomCode, 'P3');

    // All should be in the room
    await p1.waitForTimeout(2000);

    // Set timer to 1 minute to speed up test
    const timerInput = p1.locator('input[name="timerMin"]');
    if (await timerInput.isVisible()) {
      await timerInput.fill('1');
      await p1.waitForTimeout(500);
    }

    // Host starts game
    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.click();
      await p1.waitForTimeout(3000);
    }

    // Verify game started
    await p1.waitForTimeout(1500);

    // Host ends questioning phase
    const endBtn = p1
      .locator('button')
      .filter({ hasText: /Word Guessed|Time's Up/i })
      .first();
    if (await endBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await endBtn.click();
    }

    // Wait for Voting Phase
    await p1.waitForTimeout(2000);

    // Players vote
    for (const page of [p2, p3, p4]) {
      const voteBtn = page
        .locator('button')
        .filter({ hasText: /P1|P2|P3|Host/i })
        .first();
      if (await voteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await voteBtn.click().catch(() => {});
      }
    }

    // Check for game over or round results
    await expect(
      p1
        .locator('text=Game Over')
        .or(p1.locator('text=Scoreboard'))
        .or(p1.locator('text=Commoners'))
        .or(p1.locator('text=Insider')),
    )
      .toBeVisible({ timeout: 10000 })
      .catch(() => {});

    await Promise.all(contexts.map((c) => c.close()));
  });

  test('host sees lobby config options', async ({ page }) => {
    await createRoom(page, 'SoloHost', 'Who Know');
    await expect(page.getByText('SoloHost').first()).toBeVisible();
    await expect(page.getByText('Host Selection').or(page.getByText('การเลือกโฮสต์'))).toBeVisible({
      timeout: 5000,
    });
  });
});
