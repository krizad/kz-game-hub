import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin, waitForAnyVisible } from './helpers';

test.describe('Who Know Experience & Role Lifecycle', () => {
  test('role card flips on click, has aria-expanded, closes on blur/visibilitychange without auto-reopening', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [host, p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));

    try {
      const roomCode = await createRoom(host, 'HostUser', 'Knowguise');
      const origin = await getOrigin(host);

      await joinRoom(p1, origin, roomCode, 'Player1');
      await joinRoom(p2, origin, roomCode, 'Player2');
      await joinRoom(p3, origin, roomCode, 'Player3');

      // Set timer to 1 min
      const timerInput = host.locator('input[name="timerMin"]');
      if (await timerInput.isVisible()) {
        await timerInput.fill('1');
      }

      // Host starts game
      const startBtn = host.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
      await expect(startBtn).toBeVisible({ timeout: 10000 });
      await startBtn.click();

      // Non-keeper roles are dispatched only after the keeper submits the word.
      const players = [host, p1, p2, p3];
      const secretInput = await waitForAnyVisible(
        players.map((page) => page.locator('#secretWordModalInput')),
      );
      expect(secretInput).not.toBeNull();
      await secretInput!.fill('LifecycleSecret');
      await secretInput!.press('Enter');
      await expect
        .poll(() =>
          host.evaluate(() => (window as any).__useGameStore.getState().room.hostPlayerId),
        )
        .toBeTruthy();
      const keeperId = await host.evaluate(
        () => (window as any).__useGameStore.getState().room.hostPlayerId,
      );
      let page = p1;
      for (const candidate of players) {
        const socketId = await candidate.evaluate(
          () => (window as any).__useGameStore.getState().socketId,
        );
        if (socketId !== keeperId) {
          page = candidate;
          break;
        }
      }
      await page.bringToFront();
      await expect(page.getByTestId('role-card-flip')).toBeVisible();

      const flipBtn = page.locator('[data-testid="role-card-flip"]');
      const toggleBtn = page.locator('[data-testid="role-card-toggle"]');

      // Initial state: closed / hidden
      await expect(flipBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('[data-testid="role-card-hidden-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-card-revealed-content"]')).toHaveCount(0);

      // Click to reveal card
      await flipBtn.click();
      await expect(flipBtn).toHaveAttribute('aria-expanded', 'true');
      await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-testid="role-card-revealed-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-card-role-label"]')).toBeVisible();

      // Trigger window blur -> card must close
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect(flipBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('[data-testid="role-card-hidden-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-card-revealed-content"]')).toHaveCount(0);

      // Return focus -> card must NOT auto-reopen
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(flipBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('[data-testid="role-card-hidden-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-card-revealed-content"]')).toHaveCount(0);

      // Re-reveal via top toggle button
      await toggleBtn.click();
      await expect(flipBtn).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-testid="role-card-revealed-content"]')).toBeVisible();

      // Trigger visibilityState hidden -> card must close
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(flipBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('[data-testid="role-card-hidden-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-card-revealed-content"]')).toHaveCount(0);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

  test('spectators do not receive private role card and see spectator guidance', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [host, p1, p2, p3, viewer] = await Promise.all(contexts.map((c) => c.newPage()));

    try {
      const roomCode = await createRoom(host, 'HostUser', 'Knowguise');
      const origin = await getOrigin(host);

      await joinRoom(p1, origin, roomCode, 'Player1');
      await joinRoom(p2, origin, roomCode, 'Player2');
      await joinRoom(p3, origin, roomCode, 'Player3');

      await host.getByTestId('lobby-advanced-settings').locator('summary').click();
      await host.getByRole('button', { name: 'Allowed', exact: true }).click();

      // Viewer joins room as spectator
      await viewer.goto(`${origin}/?room=${roomCode}`);
      await viewer.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
      await viewer.evaluate((code) => {
        const store = (window as any).__useGameStore.getState();
        store.setName('Observer');
        store.spectateJoin(code);
      }, roomCode);
      await expect
        .poll(() => viewer.evaluate(() => (window as any).__useGameStore.getState().isSpectator))
        .toBe(true);

      // Host starts game
      const startBtn = host.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
      await expect(startBtn).toBeVisible({ timeout: 10000 });
      await startBtn.click();

      // Spectator must NOT have RoleCard rendered
      await expect(viewer.locator('[data-testid="role-card-flip"]')).toHaveCount(0);
      await expect(viewer.locator('[data-testid="role-card-target-word"]')).toHaveCount(0);

      // Spectator sees spectator guidance in WORD_SETTING
      await expect(viewer.getByRole('heading', { name: /Spectating|กำลังรับชม/i })).toBeVisible({
        timeout: 10000,
      });
      const input = await waitForAnyVisible(
        [host, p1, p2, p3].map((page) => page.locator('#secretWordModalInput')),
      );
      expect(input).not.toBeNull();
      await input!.fill('ViewerPrivacySecret');
      await input!.press('Enter');
      await expect
        .poll(() => viewer.evaluate(() => (window as any).__useGameStore.getState().room.status))
        .toBe('QUESTIONING');
      expect(
        await viewer.evaluate(() => (window as any).__useGameStore.getState().myRole),
      ).toBeNull();
      await expect(viewer.getByTestId('role-card-flip')).toHaveCount(0);
      await expect(viewer.getByText('ViewerPrivacySecret')).toHaveCount(0);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

  test('submitting vote displays confirmation without revealing target to other players and result shows win explanation', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [host, p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));

    try {
      const roomCode = await createRoom(host, 'HostUser', 'Knowguise');
      const origin = await getOrigin(host);

      await joinRoom(p1, origin, roomCode, 'Player1');
      await joinRoom(p2, origin, roomCode, 'Player2');
      await joinRoom(p3, origin, roomCode, 'Player3');

      // Host starts game
      const startBtn = host.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
      await expect(startBtn).toBeVisible({ timeout: 10000 });
      await startBtn.click();

      // Find Word Keeper modal and submit secret word
      const players = [host, p1, p2, p3];
      const wordInput = await waitForAnyVisible(
        players.map((page) => page.locator('#secretWordModalInput')),
      );
      expect(wordInput).not.toBeNull();
      const wordKeeperPage = wordInput!.page();
      await expect(wordInput!).toBeVisible({ timeout: 5000 });
      await wordInput!.fill('ExperienceSecretWord');
      await wordInput!.press('Enter');

      // Word keeper ends questioning phase
      const endBtn = wordKeeperPage
        .locator('button')
        .filter({ hasText: /Word Guessed|Time's Up/i })
        .first();
      await expect(endBtn).toBeVisible({ timeout: 15000 });
      await endBtn.click();

      // Now in VOTING phase: find eligible voters (non-word-keeper)
      const voters = players.filter((p) => p !== wordKeeperPage);
      const firstVoter = voters[0];

      // First voter submits vote for someone
      const targetBtn = firstVoter.locator('[data-testid^="wk-vote-target-"]').first();
      await expect(targetBtn).toBeVisible({ timeout: 10000 });
      await targetBtn.click();

      // First voter sees vote-submitted badge
      await expect(firstVoter.locator('[data-testid="wk-vote-submitted-badge"]')).toBeVisible({
        timeout: 10000,
      });

      // Other voters must NOT see first voter's target
      for (const other of voters.slice(1)) {
        await expect(other.getByText('ExperienceSecretWord')).toHaveCount(0);
        await expect(other.locator('[data-testid="who-know-voting-heading"]')).toBeVisible();
      }

      // Remaining voters cast votes to conclude round
      for (const remaining of voters.slice(1)) {
        const btn = remaining.locator('[data-testid^="wk-vote-target-"]').first();
        await expect(btn).toBeVisible({ timeout: 10000 });
        await btn.click();
      }

      // RESULT phase assertions
      await expect(host.locator('[data-testid="wk-winner-result"]')).toBeVisible({
        timeout: 15000,
      });
      await expect(host.locator('[data-testid="wk-winner-title"]')).toBeVisible();
      await expect(host.locator('[data-testid="wk-win-reason"]')).toBeVisible();

      // Secondary rules button is present
      await expect(
        host
          .getByRole('region', { name: 'Game Results' })
          .getByRole('button', { name: 'Rules', exact: true }),
      ).toBeVisible();

      // Room host has play again button; non-hosts have waiting message
      await expect(host.locator('[data-testid="wk-play-again-btn"]')).toBeVisible();
      for (const guest of [p1, p2, p3]) {
        await expect(guest.locator('[data-testid="wk-play-again-btn"]')).toHaveCount(0);
        await expect(guest.locator('[data-testid="wk-waiting-host-restart"]')).toBeVisible();
      }

      // Room host restarts to lobby
      await host.locator('[data-testid="wk-play-again-btn"]').click();

      // Start button is back in lobby for host
      await expect(host.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ })).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
});
