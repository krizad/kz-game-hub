import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Poker Experience Improvements (PK-1, PK-2, PK-3)', () => {
  test('PK-1 & PK-2: bet controls show label, chip preview, quick-allin, and pot breakdown at showdown', async ({
    browser,
  }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Poker');
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    const start = host.getByText(/Start Game|เริ่มเกม/i);
    await expect(start).toBeEnabled({ timeout: 5000 });
    await start.click();

    await expect(host.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });

    // Identify whoever acts first
    const actor = (await host
      .getByTestId('poker-action-panel')
      .isVisible()
      .catch(() => false))
      ? host
      : guest;

    // Check PK-1: input with associated label and chip preview
    const label = actor.locator('label[for="poker-bet-input"]');
    await expect(label).toBeVisible();
    const input = actor.locator('#poker-bet-input');
    await expect(input).toBeVisible();

    // Check PK-1: previews for additional chips and stack after
    await expect(actor.getByTestId('poker-bet-preview')).toBeVisible();
    await expect(actor.getByTestId('poker-bet-additional')).toBeVisible();
    await expect(actor.getByTestId('poker-bet-stack-after')).toBeVisible();

    // Check PK-2: quick all-in button with testid and localized label
    const quickAllIn = actor.getByTestId('poker-quick-allin');
    await expect(quickAllIn).toBeVisible();
    await expect(quickAllIn).toHaveText(/All-in|ออลอิน/i);

    // Play down to showdown
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
      const currentActor = (await host
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
      if (!currentActor) {
        await host.waitForTimeout(500);
        continue;
      }
      const check = currentActor.getByTestId('poker-check');
      const call = currentActor.getByTestId('poker-call');
      if (await check.isVisible().catch(() => false)) await check.click();
      else if (await call.isVisible().catch(() => false)) await call.click();
      await host.waitForTimeout(500);
    }
    expect(revealed).toBeTruthy();

    // Check PK-2: pot breakdown container visible at showdown / hand result
    await expect(host.getByTestId('poker-pot-breakdown')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByTestId('poker-pot-breakdown')).toBeVisible({ timeout: 15000 });

    await hostCtx.close();
    await guestCtx.close();
  });

  test('PK-3: CHIPS_LEDGER mode pot award with aria-pressed, winner count, host guard, and confirmation dialog', async ({
    browser,
  }) => {
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
    await expect(guest.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });

    // Check/call down to ledger showdown
    for (let i = 0; i < 40; i++) {
      if (
        await host
          .getByTestId('poker-award-confirm')
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
      const currentActor = (await host
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
      if (!currentActor) {
        await host.waitForTimeout(500);
        continue;
      }
      const check = currentActor.getByTestId('poker-check');
      const call = currentActor.getByTestId('poker-call');
      if (await check.isVisible().catch(() => false)) await check.click();
      else if (await call.isVisible().catch(() => false)) await call.click();
      await host.waitForTimeout(500);
    }

    // Host guard: guest does NOT have award controls
    await expect(guest.getByTestId('poker-award-confirm')).toHaveCount(0);

    const awardConfirmBtn = host.getByTestId('poker-award-confirm');
    await expect(awardConfirmBtn).toBeVisible({ timeout: 15000 });
    // Initially disabled when no player is selected
    await expect(awardConfirmBtn).toBeDisabled();

    // Check aria-pressed and selection count
    const candidateBtn = host
      .locator('button[data-testid^="poker-award-"]:not([data-testid="poker-award-confirm"])')
      .first();
    await expect(candidateBtn).toHaveAttribute('aria-pressed', 'false');

    await candidateBtn.click();
    await expect(candidateBtn).toHaveAttribute('aria-pressed', 'true');
    const countEl = host.getByTestId('poker-selected-count');
    await expect(countEl).toBeVisible();
    await expect(countEl).toContainText('1');
    await expect(awardConfirmBtn).toBeEnabled();

    // Clicking confirm opens the GameDialog
    await awardConfirmBtn.click();
    const dialogConfirm = host.getByTestId('poker-award-dialog-confirm');
    const dialogCancel = host.getByTestId('poker-award-dialog-cancel');
    await expect(dialogConfirm).toBeVisible();
    await expect(dialogCancel).toBeVisible();

    // Cancel dialog: selection must be maintained
    await dialogCancel.click();
    await expect(dialogConfirm).toBeHidden();
    await expect(candidateBtn).toHaveAttribute('aria-pressed', 'true');

    // Confirm dialog: awards pot and enters HAND_RESULT
    await awardConfirmBtn.click();
    await expect(dialogConfirm).toBeVisible();
    await dialogConfirm.click();

    await expect(host.getByTestId('poker-hand-result')).toBeVisible({ timeout: 15000 });
    await expect(host.getByTestId('poker-pot-breakdown')).toBeVisible({ timeout: 15000 });

    await hostCtx.close();
    await guestCtx.close();
  });
});
