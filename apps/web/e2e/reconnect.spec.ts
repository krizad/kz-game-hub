import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

/**
 * Reconnection: localStorage reconnect tokens restore the seat on reload, and
 * host rotation hands control to a connected player when the host drops.
 *
 * Room views render no <h1>, so waitForConnection (a home-page helper) must
 * not be used after an in-room reload — wait for the room header instead.
 */

/** Wait until the reloaded page is back inside the room. */
async function waitForRoom(page: import('@playwright/test').Page) {
  await page.getByText('Room Host:').waitFor({ state: 'visible', timeout: 20000 });
}

test('tictactoe guest reloads mid-game and keeps their seat', async ({ page }) => {
  const guest = await page.context().browser()!.newContext();
  const bob = await guest.newPage();

  const code = await createRoom(page, 'Alice', 'Tic-Tac-Toe');
  const origin = await getOrigin(page);
  await joinRoom(bob, origin, code, 'Bob');

  // Both take sides; Alice opens with X in the corner
  await page.locator('[data-testid="ttt-join-x"]').click();
  await bob.locator('[data-testid="ttt-join-o"]').click();
  await page.locator('div.grid.grid-cols-3 button').nth(0).click();
  await expect(bob.locator('div.grid.grid-cols-3 button').nth(0)).toHaveText(/X/, {
    timeout: 10000,
  });

  // Bob reloads: the persisted reconnect token must restore his seat and the
  // board state, not drop him back to an empty lobby.
  await bob.reload();
  await waitForRoom(bob);
  await expect(bob.locator('div.grid.grid-cols-3 button').nth(0)).toHaveText(/X/, {
    timeout: 20000,
  });

  // His O seat still works — he answers on the board
  await bob.locator('div.grid.grid-cols-3 button').nth(4).click();
  await expect(page.locator('div.grid.grid-cols-3 button').nth(4)).toHaveText(/O/, {
    timeout: 10000,
  });
  await guest.close();
});

test('rps player reloads mid-round and can still throw', async ({ page }) => {
  const guest = await page.context().browser()!.newContext();
  const bob = await guest.newPage();

  const code = await createRoom(page, 'Alice', 'Hand Duel');
  const origin = await getOrigin(page);
  await joinRoom(bob, origin, code, 'Bob');
  await page.locator('button:has-text("Start Game")').first().click();

  await expect(page.locator('button', { hasText: '✊' }).first()).toBeVisible({
    timeout: 15000,
  });
  await page.reload();
  await waitForRoom(page);
  // The round is still live after reconnect — the throw buttons are back
  await expect(page.locator('button', { hasText: '✊' }).first()).toBeVisible({
    timeout: 20000,
  });
  // Both throw; the round resolving proves the reloaded guest's throw landed.
  await page.locator('button', { hasText: '✊' }).first().click();
  await bob.locator('button', { hasText: '✋' }).first().click();
  // Reloaded Alice is no longer host (host rotated to Bob on her disconnect),
  // so the Next Round control shows on Bob's page.
  await expect(bob.locator('button', { hasText: /Next Round|Play Again/i }).first()).toBeVisible({
    timeout: 15000,
  });
  await guest.close();
});

test('host tab close rotates host to a guest; original host token-rejoins', async ({ page }) => {
  const guestCtx = await page.context().browser()!.newContext();
  const bob = await guestCtx.newPage();

  const code = await createRoom(page, 'Alice', 'Tic-Tac-Toe');
  const origin = await getOrigin(page);
  await joinRoom(bob, origin, code, 'Bob');

  // Alice navigates away (socket drops, but her reconnect token survives in
  // this context's localStorage — a real "closed the tab, came back" flow)
  await page.goto('about:blank');

  // Bob inherits the host role inside the 60s disconnect grace
  await expect(bob.getByText(/Room Host:\s*Bob/)).toBeVisible({ timeout: 30000 });
  // …and Alice shows as offline while her seat is held
  await expect(bob.getByText(/OFFLINE/i)).toBeVisible({ timeout: 15000 });

  // Alice comes back in the same browser: the persisted token auto-rejoins
  // her held seat (a name-based invite join would be rejected as a duplicate).
  await page.goto(`${origin}/`);
  await waitForRoom(page);
  await expect(page.getByText('Alice').first()).toBeVisible({ timeout: 20000 });
  // The seat is live again on Bob's side — no offline badge left
  await expect(bob.getByText(/OFFLINE/i)).toHaveCount(0, { timeout: 20000 });
  await guestCtx.close();
});
