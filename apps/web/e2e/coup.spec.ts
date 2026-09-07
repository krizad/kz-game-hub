import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Coup Game Flow', () => {
  test('player can create room and see Coup lobby', async ({ page }) => {
    const roomCode = await createRoom(page, 'HostDuke', 'Coup');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    await expect(page.getByText('HostDuke').first()).toBeVisible({ timeout: 5000 });
  });

  test('three players can start game and take Income action', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Coup');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');
    await joinRoom(p3, origin, roomCode, 'Charlie');

    await expect(p1.getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('Charlie')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    // Host starts the game
    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Verify Coup view renders with PLAYING phase
    await expect(p1.getByText(/Coup — PLAYING/i)).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText(/Coup — PLAYING/i)).toBeVisible({ timeout: 10000 });
    await expect(p3.getByText(/Coup — PLAYING/i)).toBeVisible({ timeout: 10000 });

    // Identify which player has the current turn
    const pages = [p1, p2, p3];
    let activePage = p1;
    for (const page of pages) {
      const isTurn = await page
        .getByText(/Your Turn|ตาของคุณ/i)
        .isVisible()
        .catch(() => false);
      if (isTurn) {
        activePage = page;
        break;
      }
    }

    // Active player takes Income
    const incomeBtn = activePage.getByRole('button', { name: /Income/i });
    await expect(incomeBtn).toBeEnabled({ timeout: 5000 });
    await incomeBtn.click();

    // Coins increase from 2 to 3
    await expect(activePage.getByText(/3 💰/).first()).toBeVisible({ timeout: 8000 });

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });
});
