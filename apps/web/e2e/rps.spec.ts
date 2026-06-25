import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('RPS (Hand Duel) Game Flow', () => {
  test('can create RPS room and see lobby config', async ({ page }) => {
    await createRoom(page, 'RPSHost', 'Hand Duel');
    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({ timeout: 5000 });
  });

  test('two players can join RPS room', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Rocky', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Paper');

    // Host starts the game
    const startBtn = p1.getByText('Start Game');
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await p1.waitForTimeout(2000);
    }

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
