import { test, expect } from '@playwright/test';
import { goToLobby, goToLobbyInEnglish } from './helpers';

test.describe('Lobby Page', () => {
  test('displays the game lobby title', async ({ page }) => {
    await goToLobby(page);
    await expect(page.locator('h1')).toContainText(/LOBBY|GAME LOBBY/i);
  });

  test('shows name input field', async ({ page }) => {
    await goToLobby(page);
    await expect(page.locator('#lobbyNameInput')).toBeVisible();
  });

  test('create room buttons are disabled without name', async ({ page }) => {
    await goToLobbyInEnglish(page);
    await expect(page.locator('button:has-text("Who Know")').first()).toBeDisabled();
  });

  test('can enter name and enable create buttons', async ({ page }) => {
    await goToLobbyInEnglish(page);
    await page.locator('#lobbyNameInput').fill('TestPlayer');
    await expect(page.locator('button:has-text("Who Know")').first()).toBeEnabled({
      timeout: 5000,
    });
  });

  test('language switcher has EN and TH buttons', async ({ page }) => {
    await goToLobby(page);
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'TH', exact: true })).toBeVisible();
  });

  test('has leaderboard button', async ({ page }) => {
    await goToLobbyInEnglish(page);
    await expect(page.locator('button:has-text("Leaderboard")')).toBeVisible({ timeout: 5000 });
  });
});
