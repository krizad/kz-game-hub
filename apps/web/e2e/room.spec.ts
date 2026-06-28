import { test, expect } from '@playwright/test';
import { createRoom } from './helpers';

test.describe('Room Creation & Join Flow', () => {
  test('can create a Who Know room', async ({ page }) => {
    await createRoom(page, 'HostPlayer', 'Who Know');
    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Host Selection').or(page.getByText('การเลือกโฮสต์'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('can create Sounds Fishy room', async ({ page }) => {
    await createRoom(page, 'FishyHost', 'Sounds Fishy');
    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('can create Gobbler room', async ({ page }) => {
    await createRoom(page, 'GobblerHost', 'Gobbler Tic Tac Toe');
    await expect(page.locator('button:has-text("Join X")')).toBeVisible({ timeout: 5000 });
  });

  test('can create Detective Club room', async ({ page }) => {
    await createRoom(page, 'DetectiveHost', 'Detective Club');
    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('can create Who Am I room', async ({ page }) => {
    await createRoom(page, 'GuessHost', 'Who Am I');
    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('join with room code via URL param', async ({ page }) => {
    await page.goto('/?room=ABC123');
    await expect(page.locator('#inviteNameInput')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('ABC123')).toBeVisible();
    await page.locator('#inviteNameInput').fill('Joiner');
    const enterBtn = page.locator('button').filter({ hasText: /Enter Game|เข้าสู่เกม/ });
    await expect(enterBtn).toBeEnabled();
  });

  test('host can leave room and return to lobby', async ({ page }) => {
    await createRoom(page, 'TempHost', 'Who Know');
    await page.getByText('Leave').click();
    await expect(page.getByText('Leave Room?').or(page.getByText('ออกจากห้อง?'))).toBeVisible({
      timeout: 5000,
    });
    await page
      .locator('button')
      .filter({ hasText: /Leave Room|ออกจากห้อง/ })
      .click();
    await expect(page.locator('h1')).toContainText(/LOBBY/i, { timeout: 15000 });
  });
});
