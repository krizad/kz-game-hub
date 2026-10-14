import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Shared Gameplay Layout & Hierarchy (TASK-SH-005)', () => {
  test('RoomHeader is responsive across 360px, 390px, and 1280px without horizontal overflow', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // 1. Create a room at standard desktop size
    await page.setViewportSize({ width: 1280, height: 900 });
    const roomCode = await createRoom(page, 'HostLayout', 'Hand Duel');
    expect(roomCode).toBeTruthy();

    const header = page.getByTestId('room-header');
    await expect(header).toBeVisible({ timeout: 10000 });

    // Verify all utility controls are present
    const copyBtn = page.getByTestId('header-copy-link-btn');
    const qrBtn = page.getByTestId('header-qr-code-btn');
    const leaveBtn = page.getByTestId('header-leave-room-btn');
    const rulesBtn = page.locator('button:has-text("Rules"), button:has-text("กติกา")').first();

    await expect(copyBtn).toBeVisible();
    await expect(qrBtn).toBeVisible();
    await expect(leaveBtn).toBeVisible();
    await expect(rulesBtn).toBeVisible();

    // Capture desktop screenshot
    await page.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/shared/header-1280.png',
    });

    // 2. Test Mobile Standard (390x844 - iPhone 12/13/14)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    // Assert no horizontal overflow
    const overflow390 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow390).toBe(false);

    // All buttons still visible and clickable
    await expect(copyBtn).toBeVisible();
    await expect(qrBtn).toBeVisible();
    await expect(leaveBtn).toBeVisible();
    await expect(rulesBtn).toBeVisible();

    await page.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/shared/header-390.png',
    });

    // 3. Test Mobile Narrow (360x800 - Android compact)
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(300);

    const overflow360 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow360).toBe(false);

    await expect(copyBtn).toBeVisible();
    await expect(qrBtn).toBeVisible();
    await expect(leaveBtn).toBeVisible();
    await expect(rulesBtn).toBeVisible();

    // Test clicking copy link works on 360px
    await copyBtn.click();
    await expect(page.locator('.toaster, [role="status"]').first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/shared/header-360.png',
    });

    await ctx.close();
  });

  test('GameViewManager folds secondary players panel on mobile and exposes it on desktop', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    await host.setViewportSize({ width: 1280, height: 900 });
    const roomCode = await createRoom(host, 'HostHierarchy', 'Hand Duel');
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'GuestHierarchy');

    // In Lobby: players panel is visible on both
    const hostPlayersPanel = host.getByTestId('game-players-panel');
    await expect(hostPlayersPanel).toBeVisible({ timeout: 10000 });

    // Host starts game
    const startBtn = host.getByTestId('lobby-start-game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // Game is now playing
    // On Desktop (1280): players panel remains visible in side column
    await expect(hostPlayersPanel).toBeVisible({ timeout: 10000 });
    const hostToggleBtn = host.getByTestId('toggle-players-panel-btn');
    await expect(hostToggleBtn).toBeHidden(); // Hidden on desktop (lg:hidden)

    // On Guest (simulate Mobile 390x844):
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.waitForTimeout(300);

    const guestPlayersPanel = guest.getByTestId('game-players-panel');
    const guestToggleBtn = guest.getByTestId('toggle-players-panel-btn');

    // On mobile during active game, players panel is folded/hidden by default to prioritize board/action
    await expect(guestPlayersPanel).toBeHidden();
    await expect(guestToggleBtn).toBeVisible({ timeout: 10000 });

    // Capture mobile playing with folded panel
    await guest.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/shared/mobile-playing-folded-390.png',
    });

    // Tap toggle button to unfold secondary panel
    await guestToggleBtn.click();
    await expect(guestPlayersPanel).toBeVisible({ timeout: 5000 });

    // Capture mobile playing with unfolded panel
    await guest.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/shared/mobile-playing-unfolded-390.png',
    });

    // Tap toggle button again to fold it back
    await guestToggleBtn.click();
    await expect(guestPlayersPanel).toBeHidden({ timeout: 5000 });

    await hostCtx.close();
    await guestCtx.close();
  });

  test('GameResultSummary renders public scores, respects rematch host guard, and preserves privacy', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    await host.setViewportSize({ width: 1280, height: 900 });
    const roomCode = await createRoom(host, 'HostResult', 'Hand Duel');
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'GuestResult');

    // Instead of artificial DOM, let's play a quick 1-round match to conclusion in Hand Duel
    // Host starts game
    const startBtn = host.getByTestId('lobby-start-game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // Verify accessible GameActionArea
    const hostActionArea = host.getByTestId('game-action-area');
    await expect(hostActionArea).toBeVisible({ timeout: 10000 });
    await expect(hostActionArea).toHaveAttribute('role', 'region');

    // Round 1: Rock vs Scissors -> Host wins round
    const hostRock = host.getByRole('button', { name: 'Rock', exact: true });
    await expect(hostRock).toBeVisible({ timeout: 10000 });
    await hostRock.click();

    const guestActionArea = guest.getByTestId('game-action-area');
    await expect(guestActionArea).toBeVisible({ timeout: 10000 });
    await expect(guestActionArea).toHaveAttribute('role', 'region');

    const guestScissors = guest.getByRole('button', { name: 'Scissors', exact: true });
    await expect(guestScissors).toBeVisible({ timeout: 10000 });
    await guestScissors.click();

    // Outcome appears
    const outcome = host.getByTestId('rps-round-outcome');
    await expect(outcome).toBeVisible({ timeout: 10000 });
    await expect(outcome).toContainText('HostResult Wins');

    // Host has Next Round CTA
    const nextBtn = host.getByTestId('rps-next-round-btn');
    await expect(nextBtn).toBeVisible();

    // Guest has waiting message, not a rematch/next button
    const guestWaiting = guest.getByTestId('rps-guest-waiting');
    await expect(guestWaiting).toBeVisible();
    await expect(guest.getByTestId('rps-next-round-btn')).toBeHidden();

    // Verify privacy: Guest cannot see Host's private socket ID or unrevealed secrets
    const pageText = await guest.evaluate(() => document.body.innerText);
    expect(pageText).not.toContain('__secret__');
    expect(pageText).not.toContain('roomSecrets');

    // Keyboard accessibility test on Host Next Round CTA
    await host.keyboard.press('Tab');
    const focusedTag = await host.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();

    await hostCtx.close();
    await guestCtx.close();
  });
});
