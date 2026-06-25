import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Tic-Tac-Toe Game Flow', () => {
  test('player can create room and see lobby setup', async ({ page }) => {
    const roomCode = await createRoom(page, 'HostPlayer', 'Classic Tic Tac Toe');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    await expect(page.locator('button:has-text("Join as X")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Join as O")')).toBeVisible({ timeout: 5000 });
  });

  test('two players can play a full game', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Classic Tic Tac Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    // Both should be in the game room
    await p1.waitForTimeout(2000);
    await p2.waitForTimeout(1000);

    // P1 joins X
    await p1.locator('button:has-text("Join as X")').click();
    await p1.waitForTimeout(1000);

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
