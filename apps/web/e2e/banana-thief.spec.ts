import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Banana Thief Lobby', () => {
  test('host can create a Banana Thief room and header shows the correct game name', async ({
    page,
  }) => {
    const roomCode = await createRoom(page, 'HostMonkey', 'Banana Thief');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // The header must show the localized Banana Thief name, not fall through to "Who Know!"
    await expect(page.locator('body')).toContainText('Banana Thief');
    await expect(page.locator('body')).not.toContainText('Who Know');

    // Host sees themselves in the player list
    await expect(page.getByText('HostMonkey').first()).toBeVisible({ timeout: 5000 });
  });

  test('lobby settings update required player count and start button stays gated', async ({
    page,
  }) => {
    await createRoom(page, 'HostMonkey', 'Banana Thief');

    // Default config: 1 follower + 2 plain mice + thief = 4 min
    const followerSelect = page.locator('#bananaThiefFollowerSelect');
    await expect(followerSelect).toBeVisible({ timeout: 5000 });

    // Switch to 2 followers: 1 + 2 + 2 = 5 required
    await followerSelect.selectOption('2');
    await expect(page.getByText(/Requires at least 5 players/i)).toBeVisible({
      timeout: 5000,
    });

    // Toggle the Detective special: 1 + 2 + 1 + 2 = 6 required
    await page
      .getByRole('button', { name: /Detective/ })
      .first()
      .click();
    await expect(page.getByText(/Requires at least 6 players/i)).toBeVisible({
      timeout: 5000,
    });

    // Only one player is in the room, so Start must be disabled and show the min count
    const startBtn = page.locator('button').filter({ hasText: /Waiting \(min 6\)|เริ่มเกม/ });
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await expect(startBtn).toBeDisabled();
  });

  test('start button enables at minimum player count', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const p4Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();
    const p4 = await p4Ctx.newPage();

    // Default config (1 follower, no specials) requires 4 players
    const roomCode = await createRoom(p1, 'HostMonkey', 'Banana Thief');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Mouse2');
    await joinRoom(p3, origin, roomCode, 'Mouse3');
    await joinRoom(p4, origin, roomCode, 'Mouse4');

    await expect(p1.getByText('Mouse4')).toBeVisible({ timeout: 10000 });

    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled();

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
    await p4Ctx.close();
  });
});
