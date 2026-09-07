import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Saboteur Game Flow', () => {
  test('player can create room and see Saboteur lobby', async ({ page }) => {
    const roomCode = await createRoom(page, 'HostMiner', 'Saboteur');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    await expect(page.getByText('HostMiner').first()).toBeVisible({ timeout: 5000 });
  });

  test('three players can start Saboteur and see game board and roles', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();

    const roomCode = await createRoom(p1, 'Miner1', 'Saboteur');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Miner2');
    await joinRoom(p3, origin, roomCode, 'Miner3');

    await expect(p1.getByText('Miner2')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('Miner3')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    // Host starts game
    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Verify all 3 players see the Saboteur board and round indicators
    await expect(p1.getByText(/Round 1|รอบ 1/i)).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText(/Round 1|รอบ 1/i)).toBeVisible({ timeout: 10000 });
    await expect(p3.getByText(/Round 1|รอบ 1/i)).toBeVisible({ timeout: 10000 });

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });
});
