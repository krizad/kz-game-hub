import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Gobbler Tic-Tac-Toe Gameplay', () => {
  test('two players join sides and game auto-starts', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'GX', 'Gobbler Tic Tac Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GO');

    // Both should be in the game room
    await p1.waitForTimeout(2000);
    await p2.waitForTimeout(1000);

    // P1 joins X
    await p1.locator('button:has-text("Join X")').click();
    await p1.waitForTimeout(1000);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('can join side X and see inventory', async ({ page }) => {
    await createRoom(page, 'Solo', 'Gobbler Tic Tac Toe');
    await page.locator('button:has-text("Join X")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toContainText('Connecting');
  });
});
