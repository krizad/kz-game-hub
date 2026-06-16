import { test, expect } from '@playwright/test';

async function waitForLobby(page: any) {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Connecting') && !document.body.innerText.includes('กำลังเชื่อมต่อ'),
    { timeout: 15000 },
  );
  await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
}

async function switchToEnglish(page: any) {
  await waitForLobby(page);
  await page.getByText('EN').click();
  await page.waitForTimeout(300);
}

test.describe('Lobby Page', () => {
  test('displays the game lobby title', async ({ page }) => {
    await waitForLobby(page);
    await expect(page.locator('h1')).toContainText(/LOBBY|GAME LOBBY/i);
  });

  test('shows name input field', async ({ page }) => {
    await waitForLobby(page);
    const nameInput = page.locator('#lobbyNameInput');
    await expect(nameInput).toBeVisible();
  });

  test('create room buttons are disabled without name', async ({ page }) => {
    await switchToEnglish(page);
    const whoKnowBtn = page.locator('button:has-text("Who Know")');
    await expect(whoKnowBtn.first()).toBeDisabled();
  });

  test('can enter name and enable create buttons', async ({ page }) => {
    await switchToEnglish(page);
    await page.locator('#lobbyNameInput').fill('TestPlayer');
    const createButton = page.locator('button:has-text("Who Know")').first();
    await expect(createButton).toBeEnabled({ timeout: 5000 });
  });

  test('language switcher has EN and TH buttons', async ({ page }) => {
    await waitForLobby(page);
    await expect(page.getByText('EN')).toBeVisible();
    await expect(page.getByText('TH')).toBeVisible();
  });

  test('has leaderboard button', async ({ page }) => {
    await switchToEnglish(page);
    await expect(page.locator('button:has-text("Leaderboard")')).toBeVisible({ timeout: 5000 });
  });
});
