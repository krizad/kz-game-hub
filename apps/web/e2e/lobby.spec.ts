import { test, expect } from '@playwright/test';
import { goToLobby, goToLobbyInEnglish, createRoom } from './helpers';

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

  test('join room button is disabled without a display name', async ({ page }) => {
    await goToLobbyInEnglish(page);
    await page.locator('#roomCodeInput').fill('ABC123');
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
  });

  test('join room button enables with a name and valid code', async ({ page }) => {
    await goToLobbyInEnglish(page);
    await page.locator('#lobbyNameInput').fill('TestPlayer');
    await page.locator('#roomCodeInput').fill('ABC123');
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeEnabled({
      timeout: 5000,
    });
  });

  test('join room button stays disabled for short codes', async ({ page }) => {
    await goToLobbyInEnglish(page);
    await page.locator('#lobbyNameInput').fill('TestPlayer');
    await page.locator('#roomCodeInput').fill('AB');
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
  });

  test('public lobbies list shows created rooms with code', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const roomCode = await createRoom(host, 'LobbyHost', 'Who Know');

    // A fresh visitor sees the public lobby entry for the created room
    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await goToLobbyInEnglish(visitorPage);
    await expect(visitorPage.getByText('Public Lobbies')).toBeVisible({ timeout: 10000 });
    await expect(visitorPage.getByText(roomCode).first()).toBeVisible();
    await expect(visitorPage.getByText('LobbyHost').first()).toBeVisible();

    await hostCtx.close();
    await visitor.close();
  });
});
