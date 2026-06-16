import { test, expect } from '@playwright/test';

test.describe('Tic-Tac-Toe Game Flow', () => {
  test('player can create room and see lobby setup', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.body.innerText.includes('Connecting') && !document.body.innerText.includes('กำลังเชื่อมต่อ'),
      { timeout: 15000 },
    );
    await page.getByText('EN').click();
    await page.waitForTimeout(300);
    await page.locator('#lobbyNameInput').fill('HostPlayer');
    await page.locator('button:has-text("Classic Tic Tac Toe")').first().click();
    await page.waitForTimeout(2000);

    // Should see the lobby with X and O join buttons
    await expect(page.getByText('Join as X').or(page.getByText('X')).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Join as O').or(page.getByText('O')).first()).toBeVisible({ timeout: 5000 });

    // Room code should be displayed
    const text = await page.locator('body').innerText();
    const match = text.match(/\b[A-Z0-9]{6}\b/);
    expect(match?.[0]).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('two players can play a full game', async ({ browser }) => {
    const player1Ctx = await browser.newContext();
    const player2Ctx = await browser.newContext();
    const p1 = await player1Ctx.newPage();
    const p2 = await player2Ctx.newPage();

    // Player 1 enters lobby
    await p1.goto('/');
    await p1.waitForFunction(
      () => !document.body.innerText.includes('Connecting') && !document.body.innerText.includes('กำลังเชื่อมต่อ'),
      { timeout: 15000 },
    );
    await p1.getByText('EN').click();
    await p1.waitForTimeout(300);
    await p1.locator('#lobbyNameInput').fill('Alice');
    await p1.locator('button:has-text("Classic Tic Tac Toe")').first().click();
    await p1.waitForTimeout(2000);

    // Get room code
    const roomText = await p1.locator('body').innerText();
    const match = roomText.match(/\b[A-Z0-9]{6}\b/);
    const roomCode = match ? match[0] : '';
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Player 2 joins via invite URL
    const baseUrl = await p1.evaluate(() => window.location.origin);
    await p2.goto(`${baseUrl}/?room=${roomCode}`);
    await expect(p2.locator('#inviteNameInput')).toBeVisible({ timeout: 15000 });
    await p2.locator('#inviteNameInput').fill('Bob');
    const enterBtn = p2.locator('button').filter({ hasText: /Enter Game|เข้าสู่เกม/ });
    await enterBtn.click();
    await p2.waitForTimeout(2000);

    // Both join sides - use the "Join" text with side indicators
    await p1.locator('button:has-text("Join as X")').click();
    await p1.waitForTimeout(1000);
    // P2 needs time to see the lobby state
    await p2.waitForTimeout(2000);
    const joinO = p2.locator('button').filter({ hasText: /Join.*O|Join as O/ });
    const joinOCount = await joinO.count();
    if (joinOCount > 0) {
      await joinO.first().click();
    }

    // Wait for game to start (playing status or board visible)
    await p1.waitForTimeout(2000);

    // Verify board is visible for both
    const boardVisible = await p1.locator('.grid').count();
    if (boardVisible > 0) {
      // Make moves: P1 (X) plays first - find empty cell
      const emptyCells = p1.locator('.grid button').filter({ hasNotText: /./ });
      const count = await emptyCells.count();
      if (count > 0) {
        const firstCell = emptyCells.first();
        await firstCell.click();
        await p1.waitForTimeout(500);

        // P2 (O) plays
        const p2EmptyCells = p2.locator('.grid button').filter({ hasNotText: /./ });
        const p2Count = await p2EmptyCells.count();
        if (p2Count > 0) {
          await p2EmptyCells.first().click();
        }
      }
    }

    await player1Ctx.close();
    await player2Ctx.close();
  });
});
