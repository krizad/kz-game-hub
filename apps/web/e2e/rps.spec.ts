import { test, expect } from '@playwright/test';

async function waitForLobby(page: any) {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Connecting') && !document.body.innerText.includes('กำลังเชื่อมต่อ'),
    { timeout: 15000 },
  );
  await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
}

test.describe('RPS (Hand Duel) Game Flow', () => {
  test('can create RPS room and see lobby config', async ({ page }) => {
    await waitForLobby(page);
    await page.getByText('EN').click();
    await page.waitForTimeout(300);
    await page.locator('#lobbyNameInput').fill('RPSHost');
    await page.locator('button:has-text("Hand Duel")').first().click();

    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({ timeout: 15000 });
  });

  test('two players can join RPS room', async ({ browser }) => {
    const player1Ctx = await browser.newContext();
    const player2Ctx = await browser.newContext();
    const p1 = await player1Ctx.newPage();
    const p2 = await player2Ctx.newPage();

    // Player 1: Go to lobby and create RPS room
    await p1.goto('/');
    await p1.waitForFunction(
      () => !document.body.innerText.includes('Connecting') && !document.body.innerText.includes('กำลังเชื่อมต่อ'),
      { timeout: 15000 },
    );
    await expect(p1.locator('h1')).toBeVisible({ timeout: 15000 });
    await p1.getByText('EN').click();
    await p1.waitForTimeout(300);
    await p1.locator('#lobbyNameInput').fill('Rocky');
    await p1.locator('button:has-text("Hand Duel")').first().click();
    await p1.waitForTimeout(2000);

    // Extract room code from the page
    const roomText = await p1.locator('body').innerText();
    const match = roomText.match(/\b[A-Z0-9]{6}\b/);
    const roomCode = match ? match[0] : '';
    expect(roomCode).toBeTruthy();

    // Player 2 joins
    const baseUrl = await p1.evaluate(() => window.location.origin);
    await p2.goto(`${baseUrl}/?room=${roomCode}`);
    await expect(p2.locator('#inviteNameInput')).toBeVisible({ timeout: 15000 });
    await p2.locator('#inviteNameInput').fill('Paper');
    const enterBtn = p2.locator('button').filter({ hasText: /Enter Game|เข้าสู่เกม/ });
    await enterBtn.click();

    // Wait for both to see the room
    await p2.waitForTimeout(2000);

    await player1Ctx.close();
    await player2Ctx.close();
  });
});
