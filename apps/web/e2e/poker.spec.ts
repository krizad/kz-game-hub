import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Poker (ADR 0009: ONLINE + CHIPS_LEDGER modes)', () => {
  test('room creation shows lobby settings with both modes and min-player gate', async ({
    page,
  }) => {
    const roomCode = await createRoom(page, 'PokerHost', 'Poker');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    await expect(page.getByTestId('poker-settings')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('poker-mode-ONLINE')).toHaveClass(/bg-lime-300/);
    await expect(page.getByTestId('poker-mode-CHIPS_LEDGER')).toBeVisible();

    // Switch to the chips ledger mode in the waiting room.
    await page.getByTestId('poker-mode-CHIPS_LEDGER').click();
    await expect(page.getByTestId('poker-mode-CHIPS_LEDGER')).toHaveClass(/bg-lime-300/);

    // Blinds/stack inputs are editable by the host.
    const stack = page.getByTestId('poker-stack');
    await stack.fill('2000');
    await expect(stack).toHaveValue('2000');
  });

  test('heads-up ONLINE hand reaches showdown and shows reveal + results', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Poker');
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    // Start button is enabled at 2 players (poker min).
    const start = host.getByText(/Start Game|เริ่มเกม/i);
    await expect(start).toBeEnabled({ timeout: 5000 });
    await start.click();

    await expect(host.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });
    // Blinds are posted and hole cards are dealt privately.
    await expect(host.getByTestId('poker-pot')).toContainText('30');
    await expect(host.getByTestId('poker-my-cards')).toBeVisible({ timeout: 10000 });
    await expect(guest.getByTestId('poker-my-cards')).toBeVisible({ timeout: 10000 });

    // The winning-hands reference is viewable at any time with example cards.
    await host.getByTestId('poker-rankings-toggle').click();
    await expect(host.getByTestId('poker-rankings-panel')).toBeVisible();
    await expect(host.getByTestId('poker-hand-rankings').first()).toContainText('A');
    await host.getByTestId('poker-rankings-toggle').click();
    await expect(host.getByTestId('poker-rankings-panel')).toHaveCount(0);

    // Check/call down; at showdown one player reveals via show/muck buttons.
    let revealed = false;
    for (let i = 0; i < 40 && !revealed; i++) {
      const reveal = (await host
        .getByTestId('poker-reveal-panel')
        .isVisible()
        .catch(() => false))
        ? host
        : (await guest
              .getByTestId('poker-reveal-panel')
              .isVisible()
              .catch(() => false))
          ? guest
          : null;
      if (reveal) {
        await reveal.getByTestId('poker-show').click();
        revealed = true;
        break;
      }
      const actor = (await host
        .getByTestId('poker-action-panel')
        .isVisible()
        .catch(() => false))
        ? host
        : (await guest
              .getByTestId('poker-action-panel')
              .isVisible()
              .catch(() => false))
          ? guest
          : null;
      if (!actor) {
        await host.waitForTimeout(700);
        continue;
      }
      const check = actor.getByTestId('poker-check');
      const call = actor.getByTestId('poker-call');
      if (await check.isVisible().catch(() => false)) await check.click();
      else if (await call.isVisible().catch(() => false)) await call.click();
      await host.waitForTimeout(700);
    }
    expect(revealed).toBeTruthy();

    await expect(host.getByTestId('poker-hand-result')).toBeVisible({ timeout: 15000 });
    // Host can deal the next hand after the result.
    await host.getByTestId('poker-next-hand').click();
    await expect(host.getByTestId('poker-phase')).toContainText(/Pre-flop|พรีฟลอป/, {
      timeout: 10000,
    });

    await hostCtx.close();
    await guestCtx.close();
  });

  test('CHIPS_LEDGER mode settles via host pot award', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Poker');
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    await host.getByTestId('poker-mode-CHIPS_LEDGER').click();
    await expect(host.getByTestId('poker-mode-CHIPS_LEDGER')).toHaveClass(/bg-lime-300/);
    await host.getByText(/Start Game|เริ่มเกม/i).click();

    await expect(host.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });
    // No cards anywhere in ledger mode.
    await expect(host.getByTestId('poker-my-cards')).toHaveCount(0);
    await expect(host.getByTestId('poker-board')).toHaveCount(0);

    // Check/call down to the ledger showdown, then the host awards the pot.
    for (let i = 0; i < 40; i++) {
      if (
        await host
          .getByTestId('poker-award-confirm')
          .isVisible()
          .catch(() => false)
      )
        break;
      const actor = (await host
        .getByTestId('poker-action-panel')
        .isVisible()
        .catch(() => false))
        ? host
        : (await guest
              .getByTestId('poker-action-panel')
              .isVisible()
              .catch(() => false))
          ? guest
          : null;
      if (!actor) {
        await host.waitForTimeout(700);
        continue;
      }
      const check = actor.getByTestId('poker-check');
      const call = actor.getByTestId('poker-call');
      if (await check.isVisible().catch(() => false)) await check.click();
      else if (await call.isVisible().catch(() => false)) await call.click();
      await host.waitForTimeout(700);
    }

    const confirm = host.getByTestId('poker-award-confirm');
    await expect(confirm).toBeVisible({ timeout: 15000 });
    // Pick the first eligible player then confirm the award.
    await host.locator('[data-testid^="poker-award-"]').first().click();
    await confirm.click();
    await expect(host.getByTestId('poker-hand-result')).toBeVisible({ timeout: 15000 });

    // Host ends the match: standings appear from the recorded scores.
    // END_MATCH confirms via a native dialog — accept it on the host page.
    host.on('dialog', (dialog) => void dialog.accept());
    await host.getByTestId('poker-end-match').click();
    await expect(host.getByTestId('poker-result')).toBeVisible({ timeout: 15000 });

    await hostCtx.close();
    await guestCtx.close();
  });
});
