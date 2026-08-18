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

  test('two players can play moves and X wins a row', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'GobX', 'Gobbler Tic Tac Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GobO');

    await p1.waitForTimeout(2000);
    await p2.waitForTimeout(1000);

    await p1.locator('button:has-text("Join X")').click();
    await p2.locator('button:has-text("Join O")').click();
    await p1.waitForTimeout(1500);
    await p2.waitForTimeout(1500);

    const p1Board = p1.locator('[data-testid^="gobbler-cell-"]');
    const p2Board = p2.locator('[data-testid^="gobbler-cell-"]');
    const p1InvX = p1.locator('[data-testid^="gobbler-inventory-X-"]');
    const p2InvO = p2.locator('[data-testid^="gobbler-inventory-O-"]');

    // X places on cells 0,1,2; O places on cells 6,7 (nowhere near X's row)
    const moves: Array<{
      page: typeof p1;
      inv: typeof p1InvX;
      board: typeof p1Board;
      cell: number;
    }> = [
      { page: p1, inv: p1InvX, board: p1Board, cell: 0 },
      { page: p2, inv: p2InvO, board: p2Board, cell: 6 },
      { page: p1, inv: p1InvX, board: p1Board, cell: 1 },
      { page: p2, inv: p2InvO, board: p2Board, cell: 7 },
      { page: p1, inv: p1InvX, board: p1Board, cell: 2 },
    ];

    for (const move of moves) {
      await expect(move.inv.nth(2)).toBeVisible({ timeout: 5000 });
      await move.inv.nth(2).click();
      await expect(move.board.nth(move.cell)).toBeVisible({ timeout: 5000 });
      await move.board.nth(move.cell).click();
      await move.page.waitForTimeout(600);
    }

    // Winner banner appears
    await expect(p1.locator('body')).toContainText('wins', { timeout: 5000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
