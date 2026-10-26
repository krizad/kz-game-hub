import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Battleship (ยุทธการเรือรบ)', () => {
  test('catalog card and room creation', async ({ page }) => {
    const roomCode = await createRoom(page, 'AdmiralAlice', 'Battleship');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Host should see Battleship settings
    await expect(page.getByText('ตั้งค่ายุทธการเรือรบ')).toBeVisible({ timeout: 10000 });
  });

  test('two players can start and enter placement phase', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const roomCode = await createRoom(p1, 'CommanderA', 'Battleship');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'CommanderB');

    // Both players see each other in lobby
    await expect(p1.getByText('CommanderB')).toBeVisible({ timeout: 10000 });

    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();

    // Both players enter placement phase
    await expect(p1.getByText('จัดวางกองเรือของคุณ')).toBeVisible({ timeout: 15000 });
    await expect(p2.getByText('จัดวางกองเรือของคุณ')).toBeVisible({ timeout: 15000 });

    // Click auto-randomize on p1 and p2
    const randomizeBtn1 = p1.getByRole('button', { name: /สุ่มตำแหน่งทั้งหมด/i });
    await expect(randomizeBtn1).toBeVisible();
    await randomizeBtn1.click();

    const randomizeBtn2 = p2.getByRole('button', { name: /สุ่มตำแหน่งทั้งหมด/i });
    await expect(randomizeBtn2).toBeVisible();
    await randomizeBtn2.click();

    // Confirm placement
    const confirmBtn1 = p1.getByRole('button', { name: /ยืนยันตำแหน่งกองเรือ/i });
    await expect(confirmBtn1).toBeEnabled();
    await confirmBtn1.click();

    const confirmBtn2 = p2.getByRole('button', { name: /ยืนยันตำแหน่งกองเรือ/i });
    await expect(confirmBtn2).toBeEnabled();
    await confirmBtn2.click();

    // Both enter playing phase with active target ocean
    await expect(p1.getByText('น่านน้ำเป้าหมาย')).toBeVisible({ timeout: 15000 });
    await expect(p2.getByText('น่านน้ำเป้าหมาย')).toBeVisible({ timeout: 15000 });

    await ctx1.close();
    await ctx2.close();
  });
});
