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

    // P1 joins X, P2 joins O
    await p1.locator('button:has-text("Join as X")').click();
    await p2.locator('button:has-text("Join as O")').click();
    await p1.waitForTimeout(1000);
    await p2.waitForTimeout(1000);

    // The 3x3 board cells
    const p1Cells = p1.locator('div.grid.grid-cols-3 button');
    const p2Cells = p2.locator('div.grid.grid-cols-3 button');

    // X: 0 1 2 / O: 4 5 — X wins on the top row
    const moves: Array<{ player: typeof p1; cells: typeof p1Cells; index: number }> = [
      { player: p1, cells: p1Cells, index: 0 },
      { player: p2, cells: p2Cells, index: 4 },
      { player: p1, cells: p1Cells, index: 1 },
      { player: p2, cells: p2Cells, index: 5 },
      { player: p1, cells: p1Cells, index: 2 },
    ];

    for (const move of moves) {
      await expect(move.cells.nth(move.index)).toBeEnabled({ timeout: 5000 });
      await move.cells.nth(move.index).click();
      await move.player.waitForTimeout(500);
    }

    // Winner banner appears on both clients
    await expect(p1.getByText('wins', { exact: false }).first()).toBeVisible({ timeout: 5000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
