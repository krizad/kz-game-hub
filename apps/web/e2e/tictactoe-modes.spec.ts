import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Tic-Tac-Toe Unified Modes', () => {
  test('host can switch modes in the lobby and each mode renders its lobby', async ({
    browser,
  }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    // Create room with Classic mode
    const roomCode = await createRoom(p1, 'HostAlice', 'Classic Tic Tac Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await p1.waitForTimeout(2000);
    await p2.waitForTimeout(1000);

    // Verify mode selector is visible on host screen
    await expect(p1.locator('[data-testid="ttt-mode-classic"]')).toBeVisible({ timeout: 5000 });
    await expect(p1.locator('[data-testid="ttt-mode-gobbler"]')).toBeVisible();
    await expect(p1.locator('[data-testid="ttt-mode-ultimate"]')).toBeVisible();

    // Both players join seats in Classic mode
    await p1.locator('button:has-text("Join as X")').click();
    await p2.locator('button:has-text("Join as O")').click();
    await p1.waitForTimeout(1000);
    await p2.waitForTimeout(1000);

    // Play a quick game to get to RESULT
    const p1Cells = p1.locator('div.grid.grid-cols-3 button');
    const p2Cells = p2.locator('div.grid.grid-cols-3 button');

    // X: 0, 1, 2 (X wins)
    await p1Cells.nth(0).click();
    await p1.waitForTimeout(400);
    await p2Cells.nth(4).click();
    await p1.waitForTimeout(400);
    await p1Cells.nth(1).click();
    await p1.waitForTimeout(400);
    await p2Cells.nth(5).click();
    await p1.waitForTimeout(400);
    await p1Cells.nth(2).click();

    // Result screen appears
    await expect(p1.getByText('wins', { exact: false }).first()).toBeVisible({ timeout: 5000 });

    // Host clicks "Change Mode / Return to Lobby"
    const changeModeBtn = p1.locator(
      'button:has-text("Change Mode / Return to Lobby"), button:has-text("เปลี่ยนโหมด / กลับไปล็อบบี้")',
    );
    await expect(changeModeBtn).toBeVisible({ timeout: 5000 });
    await changeModeBtn.click();

    // Verify returned to lobby: returning to the lobby clears the seats, so the
    // classic lobby offers the X seat again
    await expect(p1.locator('[data-testid="ttt-mode-classic"]')).toBeVisible({ timeout: 5000 });
    await expect(p1.locator('[data-testid="ttt-mode-classic"]')).toHaveClass(/bg-yellow-300/);
    await expect(p1.locator('[data-testid="ttt-join-x"]')).toBeVisible({ timeout: 5000 });

    // Host switches mode to Gobbler
    await p1.locator('[data-testid="ttt-mode-gobbler"]').click();
    await p1.waitForTimeout(1500);

    // The lobby reflects the Gobbler mode and both players stay in the room
    await expect(p1.locator('[data-testid="ttt-mode-gobbler"]')).toHaveClass(/bg-cyan-300/, {
      timeout: 5000,
    });
    await expect(
      p1.getByText('Larger pieces can gobble smaller ones!', { exact: false }),
    ).toBeVisible();
    await expect(p1.locator('[data-testid="ttt-join-x"]')).toBeHidden();
    await expect(p1.getByText('HostAlice').first()).toBeVisible();
    await expect(p1.getByText('GuestBob').first()).toBeVisible();

    // Host switches mode to Ultimate
    await p1.locator('[data-testid="ttt-mode-ultimate"]').click();
    await p1.waitForTimeout(1500);

    // The lobby reflects the Ultimate mode with its own seat pickers
    await expect(p1.locator('[data-testid="ttt-mode-ultimate"]')).toHaveClass(/bg-pink-300/, {
      timeout: 5000,
    });
    await expect(p1.locator('[data-testid="uttt-join-x"]')).toBeVisible({ timeout: 5000 });
    await expect(p1.getByText('HostAlice').first()).toBeVisible();
    await expect(p1.getByText('GuestBob').first()).toBeVisible();

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
