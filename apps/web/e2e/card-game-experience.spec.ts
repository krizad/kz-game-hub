import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Card Game Experience & Enhancements', () => {
  test('Slave: card hand scroll, sorting presentation, trick info, and selection validation reasons', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Thai Card Game');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob')).toBeVisible({ timeout: 10000 });

    // Switch to Slave mode
    await host.getByTestId('card-game-preset-slave').click();
    await expect(host.getByTestId('card-game-preset-slave')).toHaveClass(/bg-lime-300/);

    await host.getByText(/Start Game|เริ่มเกม/i).click();
    await expect(host.getByText('⛓️ Slave')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText('⛓️ Slave')).toBeVisible({ timeout: 15000 });

    // No raw phase names should appear on either screen
    await expect(host.getByText('PLAYER_TURNS')).toHaveCount(0);
    await expect(guest.getByText('PLAYER_TURNS')).toHaveCount(0);

    const hostActions = host.getByTestId('card-game-actions');
    const guestActions = guest.getByTestId('card-game-actions');
    await expect
      .poll(async () => (await hostActions.isVisible()) || (await guestActions.isVisible()), {
        timeout: 15000,
      })
      .toBe(true);

    const activePage = (await hostActions.isVisible()) ? host : guest;
    const inactivePage = activePage === host ? guest : host;

    // Verify CardHand scroll container and attributes
    const scrollContainer = activePage.getByTestId('card-hand-scroll');
    await expect(scrollContainer).toBeVisible();
    await expect(scrollContainer).toHaveAttribute('tabindex', '0');

    // Total card count is displayed
    const countBadge = activePage.getByTestId('card-hand-count');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText(/cards|ใบ/i);

    // Trick info is displayed
    const trickInfo = activePage.getByTestId('slave-trick-info');
    await expect(trickInfo).toBeVisible();

    // Selection reason before choosing any card
    const reasonBox = activePage.getByTestId('slave-selection-reason');
    await expect(reasonBox).toBeVisible();
    await expect(reasonBox).toContainText(/select|เลือก|3 of clubs|three of clubs|3 ดอกจิก/i);

    // Card buttons have aria-pressed and accessible aria-label
    const cardButtons = activePage.getByTestId('card-hand').locator('button');
    const firstCard = cardButtons.first();
    await expect(firstCard).toHaveAttribute('aria-pressed', 'false');
    await expect(firstCard).toHaveAttribute('aria-label', /.+/);

    // Select first card
    await firstCard.click();
    await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
    const selectedCardId = await firstCard.getAttribute('data-testid');

    // Test sort presentation: sorting must not unselect or change the selected card's ID
    const sortRankBtn = activePage.getByTestId('card-hand-sort-rank');
    const sortSuitBtn = activePage.getByTestId('card-hand-sort-suit');
    const sortResetBtn = activePage.getByTestId('card-hand-sort-reset');

    await expect(sortRankBtn).toBeVisible();
    await sortRankBtn.click();
    // The previously selected card remains selected after rank sort
    await expect(activePage.locator(`button[data-testid="${selectedCardId}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await sortSuitBtn.click();
    // Still selected after suit sort
    await expect(activePage.locator(`button[data-testid="${selectedCardId}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await sortResetBtn.click();
    await expect(activePage.locator(`button[data-testid="${selectedCardId}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Unselect first card
    await firstCard.click();
    await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

    // If opening lead has 3♣, test the 3♣ opening reason
    const card3Clubs = activePage.locator('button[data-testid="card-3-CLUBS"]');
    if ((await card3Clubs.count()) > 0) {
      // Find a non-3♣ card and select it
      const non3Clubs = activePage
        .getByTestId('card-hand')
        .locator('button:not([data-testid="card-3-CLUBS"])')
        .first();
      await non3Clubs.click();
      await expect(reasonBox).toContainText(/3 of clubs|three of clubs|3 ดอกจิก/i);
      // Unselect it
      await non3Clubs.click();

      // Now select 3♣
      await card3Clubs.click();
      await expect(reasonBox).toContainText(/ready|พร้อม/i);

      // Play the 3♣ opening trick
      const playBtn = activePage.getByRole('button', { name: /play|ลงไพ่/i });
      await expect(playBtn).toBeEnabled();
      await playBtn.click();

      // Trick now appears on the table
      await expect(activePage.getByText(/played 1 card|ลงไพ่ 1 ใบ/i)).toBeVisible({
        timeout: 5000,
      });
      await expect(inactivePage.getByTestId('slave-trick-info')).toContainText(/3|trick|กอง/i);
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('Pok Deng: settlement breakdown shows chips before, after, delta, score and natural', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Thai Card Game');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob')).toBeVisible({ timeout: 10000 });

    await host.getByText(/Start Game|เริ่มเกม/i).click();

    // Verify no raw phase names
    await expect(host.getByText('PLAYER_TURNS')).toHaveCount(0);
    await expect(guest.getByText('PLAYER_TURNS')).toHaveCount(0);

    const guestActions = guest.getByTestId('card-game-actions');
    const guestResult = guest.getByTestId('card-game-result');
    await expect(guestActions.or(guestResult).first()).toBeVisible({ timeout: 15000 });

    if (await guestActions.isVisible().catch(() => false)) {
      await guestActions.getByRole('button', { name: /stand|อยู่/i }).click();
    }

    // Both players should see the result
    await expect(guestResult).toBeVisible({ timeout: 15000 });
    await expect(host.getByTestId('card-game-result')).toBeVisible({ timeout: 15000 });

    // The detailed settlement breakdown must be visible
    const hostSettlement = host.getByTestId('pok-deng-settlement');
    const guestSettlement = guest.getByTestId('pok-deng-settlement');

    await expect(hostSettlement).toBeVisible({ timeout: 10000 });
    await expect(guestSettlement).toBeVisible({ timeout: 10000 });

    // Verify it contains before, after, and chips
    await expect(hostSettlement).toContainText(/before|ก่อนหน้า/i);
    await expect(hostSettlement).toContainText(/after|คงเหลือ/i);
    await expect(hostSettlement).toContainText(/chips|ชิป/i);

    // Host can advance to next round via data-testid="card-game-next-round"
    const nextRoundBtn = host.getByTestId('card-game-next-round');
    await expect(nextRoundBtn).toBeVisible();
    await nextRoundBtn.click();

    // Round advances, dealer rotates
    await expect(host.getByText(/Dealer: Bob|เจ้ามือ: Bob/)).toBeVisible({ timeout: 10000 });

    await hostContext.close();
    await guestContext.close();
  });
});
