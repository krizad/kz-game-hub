import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Pok Deng card game flow', () => {
  test('plays a round, rotates the dealer, and renders the rule summary', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Pok Deng');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob')).toBeVisible({ timeout: 10000 });

    // The rules modal renders the normalized preset config in the active language.
    await host.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(host.getByText('Standard 52 cards ×1')).toBeVisible({ timeout: 5000 });
    await expect(host.getByText('Start 100 chips · base stake 1')).toBeVisible({ timeout: 5000 });
    await host.getByLabel('Close rules').click();

    await host.getByText(/Start Game|เริ่มเกม/i).click();

    // The first seated player (the host) deals; the guest acts first.
    await expect(host.getByText(/Dealer: Alice/)).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText(/Dealer: Alice/)).toBeVisible({ timeout: 15000 });

    // The guest may be dealt a natural hand, in which case the round resolves immediately.
    const guestActions = guest.getByTestId('card-game-actions');
    const guestResult = guest.getByTestId('card-game-result');
    await expect(guestActions.or(guestResult).first()).toBeVisible({ timeout: 15000 });
    if (await guestActions.isVisible().catch(() => false)) {
      await guestActions.getByRole('button', { name: 'Stand' }).click();
    }

    await expect(guestResult).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText(/Dealer scored/)).toBeVisible({ timeout: 5000 });
    await expect(host.getByTestId('card-game-result')).toBeVisible({ timeout: 15000 });

    // One non-dealer seat always pays the dealer, so a balance in the 95..99 band appears.
    await expect(host.getByText(/9[5-9] chips/).first()).toBeVisible({ timeout: 5000 });

    // The host advances and the deal rotates to the second seat.
    await host.getByRole('button', { name: 'Next round' }).click();
    await expect(host.getByText(/Dealer: Bob/)).toBeVisible({ timeout: 10000 });
    await expect(guest.getByText(/Dealer: Bob/)).toBeVisible({ timeout: 10000 });

    await hostCtx.close();
    await guestCtx.close();
  });
});
