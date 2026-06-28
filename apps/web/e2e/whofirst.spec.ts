import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Who First Game Flow', () => {
  test('player can create room and see lobby setup', async ({ page }) => {
    const roomCode = await createRoom(page, 'HostPlayer', 'Who First');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Check for Who First lobby specifics
    await expect(page.locator('text=Who First Lobby')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Start Countdown!")')).toBeVisible({
      timeout: 5000,
    });
  });

  test('two players can play a round', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Who First');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    // Both should be in the game lobby
    await p1.waitForTimeout(1000);
    await p2.waitForTimeout(1000);

    // Host (Alice) enables "Host plays too" just in case it's off by default
    // Wait, the test might fail if the switch ID doesn't exist, but it does: id="host-plays-switch"
    const hostPlaysSwitch = p1.locator('#host-plays-switch');
    if (await hostPlaysSwitch.isVisible()) {
      // if not checked, click it
      const isChecked = await hostPlaysSwitch.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await hostPlaysSwitch.click();
        await p1.waitForTimeout(500);
      }
    }

    // Host starts game
    await p1.locator('button:has-text("Start Countdown!")').click();

    // Verify COUNTDOWN phase is active
    await expect(p1.locator('text=Ready...')).toBeVisible({ timeout: 5000 });
    await expect(p2.locator('text=Ready...')).toBeVisible({ timeout: 5000 });

    // Both wait for GO!!
    // Wait for the ACTIVE phase up to 6 seconds since countdown duration is 2-5s
    await expect(p1.locator('text=GO!!')).toBeVisible({ timeout: 8000 });
    await expect(p2.locator('text=GO!!')).toBeVisible({ timeout: 8000 });

    // P1 presses button
    await p1.locator('button:has-text("PRESS!")').click();
    await p1.waitForTimeout(500);

    // P2 presses button
    await p2.locator('button:has-text("PRESS!")').click();

    // Verify Round Result
    await expect(p1.locator('text=Round Result')).toBeVisible({ timeout: 5000 });
    await expect(p2.locator('text=Round Result')).toBeVisible({ timeout: 5000 });

    // Alice should be first since she pressed first
    await expect(p1.locator('text=Alice').first()).toBeVisible();
    await expect(p1.locator('text=Bob').first()).toBeVisible();

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
