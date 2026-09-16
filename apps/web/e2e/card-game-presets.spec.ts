import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('card game preset switching', () => {
  test('host can switch to Slave in the lobby and play a lead', async ({ browser }) => {
    test.setTimeout(120_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Pok Deng');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob')).toBeVisible();

    await host.getByTestId('card-game-preset-slave').click();
    await expect(host.getByTestId('card-game-preset-slave')).toHaveClass(/bg-lime-300/);

    await host.getByText(/Start Game|เริ่มเกม/i).click();
    await expect(host.getByText('⛓️ Slave')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText('⛓️ Slave')).toBeVisible({ timeout: 15000 });

    const hostActions = host.getByTestId('card-game-actions');
    const guestActions = guest.getByTestId('card-game-actions');
    await expect
      .poll(async () => (await hostActions.isVisible()) || (await guestActions.isVisible()), {
        timeout: 15000,
      })
      .toBe(true);

    if (await hostActions.isVisible().catch(() => false)) {
      await host.getByTestId('card-3-CLUBS').click();
      await hostActions.getByRole('button', { name: 'Play' }).click();
    } else {
      await guest.getByTestId('card-3-CLUBS').click();
      await guestActions.getByRole('button', { name: 'Play' }).click();
    }

    await expect(host.getByTestId('card-game-log')).toBeVisible({ timeout: 10000 });
    await expect(host.getByText(/played 1 card/)).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('host can switch to Sam Sip and discard after drawing', async ({ browser }) => {
    test.setTimeout(120_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Pok Deng');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob')).toBeVisible();

    await host.getByTestId('card-game-preset-sam_sip').click();
    await expect(host.getByTestId('card-game-preset-sam_sip')).toHaveClass(/bg-lime-300/);

    await host.getByText(/Start Game|เริ่มเกม/i).click();
    await expect(host.getByText('🀄 Sam Sip')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText('🀄 Sam Sip')).toBeVisible({ timeout: 15000 });

    // The first seated player (the host) is the starter and must draw before discarding
    const drawBtn = host.getByTestId('card-game-actions').getByRole('button', { name: 'Draw' });
    await expect(drawBtn).toBeVisible({ timeout: 15000 });
    await drawBtn.click();

    // After acquiring, pick any card from the hand to discard
    const firstCard = host.getByTestId('card-hand').locator('button').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.click();

    await expect(host.getByTestId('card-game-log')).toBeVisible({ timeout: 10000 });
    await expect(host.getByText(/drew a card/)).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('host can switch to Old Maid and take a face-down card', async ({ browser }) => {
    test.setTimeout(120_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const roomCode = await createRoom(host, 'Alice', 'Pok Deng');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'Bob');
    await expect(host.getByText('Bob')).toBeVisible();

    await host.getByTestId('card-game-preset-old_maid').click();
    await expect(host.getByTestId('card-game-preset-old_maid')).toHaveClass(/bg-lime-300/);

    await host.getByText(/Start Game|เริ่มเกม/i).click();
    await expect(host.getByText('🃏 Old Maid')).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText('🃏 Old Maid')).toBeVisible({ timeout: 15000 });

    const hostTake = host.getByTestId('old-maid-take-0');
    const guestTake = guest.getByTestId('old-maid-take-0');
    await expect
      .poll(async () => (await hostTake.isVisible()) || (await guestTake.isVisible()), {
        timeout: 15000,
      })
      .toBe(true);

    if (await hostTake.isVisible().catch(() => false)) {
      await hostTake.click();
    } else {
      await guestTake.click();
    }

    await expect(host.getByTestId('card-game-log')).toBeVisible({ timeout: 10000 });
    await expect(host.getByText(/took a card/)).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });
});
