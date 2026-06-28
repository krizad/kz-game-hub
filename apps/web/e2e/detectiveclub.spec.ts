import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Detective Club Gameplay', () => {
  test('three players can start game and enter setup phase', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'DetHost', 'Detective Club');
    const origin = await getOrigin(p1);

    await joinRoom(p2, origin, roomCode, 'D1');
    await joinRoom(p3, origin, roomCode, 'D2');

    // Verify all joined
    await p1.waitForTimeout(1000);
    for (const name of ['D1', 'D2']) {
      await expect(p1.getByText(name)).toBeVisible({ timeout: 5000 });
    }

    // Host starts game
    const startBtn = p1.getByText('Start Game');
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await p1.waitForTimeout(3000);
    }

    // Game should be in SETUP phase - each player has a role
    await p1.waitForTimeout(1000);

    // Check for role display or setup phase text
    const hasRole = await p1
      .locator('text=Your Role')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasSetup = await p1
      .locator('text=Setup Phase')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(hasRole || hasSetup).toBeTruthy();

    // Informer should submit a word if visible
    const wordInput = p1.locator('#wordInput');
    if (await wordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wordInput.fill('Mystery');
      await p1.locator('button:has-text("Confirm Word")').click();
      await p1.waitForTimeout(1500);
    }

    await p1.waitForTimeout(1000);
    await Promise.all(contexts.map((c) => c.close()));
  });

  test('can create room and see lobby', async ({ page }) => {
    await createRoom(page, 'DetTest', 'Detective Club');
    await expect(page.getByText('DetTest').first()).toBeVisible();
  });
});
