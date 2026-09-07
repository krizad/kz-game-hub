import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Ultimate Tic-Tac-Toe Game Flow', () => {
  test('player can create room and see lobby setup', async ({ page }) => {
    const roomCode = await createRoom(page, 'HostPlayer', 'Ultimate Tic-Tac-Toe');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    await expect(page.locator('[data-testid="uttt-join-x"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="uttt-join-o"]')).toBeVisible({ timeout: 5000 });
  });

  test('two players can join sides, play moves and win a sub-board', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Ultimate Tic-Tac-Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await p1.waitForTimeout(1500);
    await p1.locator('[data-testid="uttt-join-x"]').click();
    await p2.locator('[data-testid="uttt-join-o"]').click();
    await p1.waitForTimeout(1000);

    // Initial state: 9 sub-boards visible
    await expect(p1.locator('[data-testid="uttt-cell-0-0"]')).toBeVisible({ timeout: 5000 });
    await expect(p2.locator('[data-testid="uttt-cell-0-0"]')).toBeVisible({ timeout: 5000 });

    // Turn 1: P1 (X) plays (0, 1) -> sends P2 to macro board 1
    await p1.locator('[data-testid="uttt-cell-0-1"]').click();
    await p2.waitForTimeout(500);

    // Turn 2: P2 (O) must play in macro board 1 -> plays (1, 0), sends P1 to macro board 0
    await p2.locator('[data-testid="uttt-cell-1-0"]').click();
    await p1.waitForTimeout(500);

    // Turn 3: P1 (X) plays (0, 2) -> sends P2 to macro board 2
    await p1.locator('[data-testid="uttt-cell-0-2"]').click();
    await p2.waitForTimeout(500);

    // Turn 4: P2 (O) plays (2, 0) -> sends P1 to macro board 0
    await p2.locator('[data-testid="uttt-cell-2-0"]').click();
    await p1.waitForTimeout(500);

    // Turn 5: P1 (X) plays (0, 0) -> Sub-board 0 completed (0, 1, 2 = X)!
    await p1.locator('[data-testid="uttt-cell-0-0"]').click();
    await p1.waitForTimeout(800);

    // Sub-board 0 overlay displays winning X stamp on both screens
    await expect(p1.locator('div:has-text("X")').first()).toBeVisible({ timeout: 5000 });
    await expect(p2.locator('div:has-text("X")').first()).toBeVisible({ timeout: 5000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
