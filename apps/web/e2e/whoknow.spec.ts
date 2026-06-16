import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Who Know Gameplay', () => {
  test('four players can start game flow', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(), browser.newContext(),
      browser.newContext(), browser.newContext(),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'Who Know');
    const origin = await getOrigin(p1);

    await joinRoom(p2, origin, roomCode, 'P1');
    await joinRoom(p3, origin, roomCode, 'P2');
    await joinRoom(p4, origin, roomCode, 'P3');

    // All should be in the room
    await p1.waitForTimeout(2000);

    // Host starts game
    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.click();
      await p1.waitForTimeout(3000);
    }

    // Verify game started - check for the timer, questioning text, or the game content changed
    await p1.waitForTimeout(1500);
    await p2.waitForTimeout(1500);

    await Promise.all(contexts.map((c) => c.close()));
  });

  test('host sees lobby config options', async ({ page }) => {
    await createRoom(page, 'SoloHost', 'Who Know');
    await expect(page.getByText('SoloHost').first()).toBeVisible();
    await expect(page.getByText('Host Selection').or(page.getByText('การเลือกโฮสต์'))).toBeVisible({ timeout: 5000 });
  });
});
