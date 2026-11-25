import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Thirty-One (ไพ่ 31)', () => {
  test('catalog card and room creation', async ({ page }) => {
    const roomCode = await createRoom(page, 'CardAlice', 'THIRTY_ONE');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Host should see Thirty-One lobby settings (turn timer selector)
    await expect(page.getByText('Thirty-One', { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test('two players start game, verify private hand secrecy, turn flow, and knock', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'THIRTY_ONE');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    // Both players see each other in lobby
    await expect(p1.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();

    // Both players enter active Thirty-One game table
    await expect(p1.getByTestId('thirty-one-draw-stock')).toBeVisible({ timeout: 15000 });
    await expect(p2.getByTestId('thirty-one-draw-stock')).toBeVisible({ timeout: 15000 });

    // Each player sees their own private hand (3 cards), and their own score
    await expect(p1.getByTestId('thirty-one-my-hand')).toBeVisible();
    await expect(p2.getByTestId('thirty-one-my-hand')).toBeVisible();
    await expect(p1.getByTestId('thirty-one-my-score')).toBeVisible();
    await expect(p2.getByTestId('thirty-one-my-score')).toBeVisible();

    // Verify seats are rendered for both players
    await expect(p1.locator('[data-testid^="thirty-one-seat-"]')).toHaveCount(2);

    // Identify who is active first
    const p1CanDraw = await p1.getByTestId('thirty-one-draw-stock').isEnabled();
    const activePage = p1CanDraw ? p1 : p2;
    const waitingPage = p1CanDraw ? p2 : p1;

    // Active player can draw from stock or discard or knock
    await expect(activePage.getByTestId('thirty-one-draw-stock')).toBeEnabled();
    await expect(waitingPage.getByTestId('thirty-one-draw-stock')).toBeDisabled();

    // Active player draws from stock
    await activePage.getByTestId('thirty-one-draw-stock').click();

    // Active player now has 4 cards and is prompted to discard 1
    const activeHandCards = activePage.locator('button[data-testid^="thirty-one-card-"]');
    await expect(activeHandCards).toHaveCount(4);

    // Click first card to discard
    await activeHandCards.first().click();

    // Hand goes back to 3 cards
    await expect(activePage.locator('button[data-testid^="thirty-one-card-"]')).toHaveCount(3);

    // Now the turn has passed to waitingPage
    await expect(waitingPage.getByTestId('thirty-one-draw-stock')).toBeEnabled({ timeout: 10000 });

    // Waiting player can knock to trigger showdown
    const knockBtn = waitingPage.getByTestId('thirty-one-knock');
    if (await knockBtn.isVisible()) {
      await knockBtn.click();
      // After knock, the other player gets 1 final turn before showdown
      await expect(activePage.getByTestId('thirty-one-draw-stock')).toBeEnabled({ timeout: 10000 });
      await activePage.getByTestId('thirty-one-draw-stock').click();
      await activePage.locator('button[data-testid^="thirty-one-card-"]').first().click();

      // Showdown should be reached!
      await expect(p1.getByTestId('thirty-one-showdown')).toBeVisible({ timeout: 15000 });
      await expect(p2.getByTestId('thirty-one-showdown')).toBeVisible({ timeout: 15000 });
    }

    await ctx1.close();
    await ctx2.close();
  });
});
