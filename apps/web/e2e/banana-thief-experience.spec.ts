import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Banana Thief Experience (TASK-BT-001, TASK-BT-002, TASK-BT-003)', () => {
  test('end-to-end banana thief experience with force-start dialog, wake cues, vote persistence, and result breakdown', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180000);

    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));
    await p1.setViewportSize({ width: 1280, height: 900 });

    try {
      // 1. Host creates room for Banana Thief
      const roomCode = await createRoom(p1, 'HostMonkey', 'Banana Thief');
      const origin = await getOrigin(p1);

      await joinRoom(p2, origin, roomCode, 'MouseTwo');
      await joinRoom(p3, origin, roomCode, 'MouseThree');
      await joinRoom(p4, origin, roomCode, 'MouseFour');

      // Configure in lobby: 0 followers and HOST narrator for deterministic test execution
      const followerSelect = p1.locator('#bananaThiefFollowerSelect');
      await expect(followerSelect).toBeVisible({ timeout: 10000 });
      await followerSelect.click();
      await followerSelect
        .locator('..')
        .getByRole('button', { name: /None \(0\)|ไม่มี/i })
        .click();

      const narratorSelect = p1.locator('#bananaThiefNarratorSelect');
      await expect(narratorSelect).toBeVisible({ timeout: 10000 });
      await narratorSelect.click();
      await narratorSelect
        .locator('..')
        .getByRole('button', { name: /The host narrates|โฮสต์พากย์เอง/i })
        .click();

      // Start game from lobby
      const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
      await expect(startBtn).toBeEnabled({ timeout: 10000 });
      await startBtn.click();

      // ==========================================
      // Phase: SETUP (TASK-BT-001)
      // ==========================================
      // All players see SETUP phase and audio status cue
      for (const p of [p1, p2, p3, p4]) {
        await expect(p.locator('body')).toContainText(/Audio|เสียง/i);
      }

      // Guest rolls die
      await p2.getByTestId('banana-thief-roll').click();
      // Guest can ready
      await p2.getByTestId('banana-thief-ready').click();

      // Host sees force start button because not all players are ready
      const forceStartBtn = p1.getByTestId('banana-thief-force-start');
      await expect(forceStartBtn).toBeVisible({ timeout: 10000 });

      // Host clicks force-start -> dialog opens
      await forceStartBtn.click();

      // Dialog must be visible and have confirm button
      const confirmBtn = p1.getByTestId('banana-thief-force-start-confirm');
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });

      // Dialog shows unready player names (MouseThree, MouseFour, or HostMonkey)
      await expect(p1.getByRole('dialog')).toContainText(/MouseThree|MouseFour/i);

      // Verify Cancel button closes dialog without starting
      const cancelBtn = p1.getByRole('dialog').getByRole('button', { name: /Cancel|ยกเลิก/i });
      await cancelBtn.click();
      await expect(confirmBtn).toBeHidden({ timeout: 5000 });

      // Game is still in SETUP
      await expect(p1.getByTestId('banana-thief-force-start')).toBeVisible();

      // Screenshots for SETUP in 3 viewports
      await p1.screenshot({
        path: testInfo.outputPath('setup-1280.png'),
      });
      await p1.setViewportSize({ width: 390, height: 844 });
      await p1.screenshot({
        path: testInfo.outputPath('setup-390.png'),
      });
      await p1.setViewportSize({ width: 360, height: 800 });
      await p1.screenshot({
        path: testInfo.outputPath('setup-360.png'),
      });
      await p1.setViewportSize({ width: 1280, height: 900 });

      // Now host confirms force-start
      await p1.getByTestId('banana-thief-force-start').click();
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();

      // ==========================================
      // Phase: NIGHT (TASK-BT-002)
      // ==========================================
      // All players transition to NIGHT and see wake status
      await expect(p1.getByTestId('banana-thief-awake-status')).toBeVisible({ timeout: 10000 });
      await expect(p2.getByTestId('banana-thief-awake-status')).toBeVisible({ timeout: 10000 });

      // Status text must match /awake|sleeping/i in all locales
      await expect(p1.getByTestId('banana-thief-awake-status')).toContainText(/awake|sleeping/i);
      await expect(p2.getByTestId('banana-thief-awake-status')).toContainText(/awake|sleeping/i);

      // Screenshots for NIGHT
      await p1.screenshot({
        path: testInfo.outputPath('night-1280.png'),
      });
      await p1.setViewportSize({ width: 390, height: 844 });
      await p1.screenshot({
        path: testInfo.outputPath('night-390.png'),
      });
      await p1.setViewportSize({ width: 360, height: 800 });
      await p1.screenshot({
        path: testInfo.outputPath('night-360.png'),
      });
      await p1.setViewportSize({ width: 1280, height: 900 });

      // Host paces night hours via next-hour button
      for (let hour = 1; hour <= 6; hour++) {
        const nextHourBtn = p1.getByTestId('banana-thief-next-hour');
        if (await nextHourBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nextHourBtn.click();
          await p1.waitForTimeout(400);
        }
      }

      // ==========================================
      // Phase: DISCUSSION & VOTING (TASK-BT-003)
      // ==========================================
      // With 0 followers, night transitions to DISCUSSION
      // Host can start vote
      const startVoteBtn = p1.locator('button').filter({ hasText: /Start.*Vote|เริ่ม.*โหวต/i });
      await expect(startVoteBtn).toBeVisible({ timeout: 15000 });
      await startVoteBtn.click();

      // All players enter VOTING phase
      for (const p of [p1, p2, p3, p4]) {
        await expect(p.getByTestId('banana-thief-vote-status')).toBeVisible({ timeout: 10000 });
        await expect(p.getByTestId('banana-thief-vote-status')).toContainText(/waiting/i);
      }

      // A non-thief reload preserves its ballot; the thief leaving intentionally forfeits.
      let voter = p2;
      for (const page of [p2, p3, p4]) {
        const role = await page.evaluate(
          () => (window as any).__useGameStore.getState().privateState.ctRole,
        );
        if (role !== 'THIEF') {
          voter = page;
          break;
        }
      }
      // Cast vote for first candidate
      const candidateBtn = voter.locator('button[data-testid^="banana-thief-vote-"]').first();
      await expect(candidateBtn).toBeVisible();
      await candidateBtn.click();

      // The voter sees their submitted ballot
      await expect(voter.getByTestId('banana-thief-vote-status')).toContainText(/submitted/i);

      // Candidate buttons are now disabled for this voter
      await expect(candidateBtn).toBeDisabled();

      // Reload this voter during voting
      await voter.reload();
      await expect(voter.getByTestId('banana-thief-vote-status')).toBeVisible({ timeout: 15000 });
      await expect(voter.getByTestId('banana-thief-vote-status')).toContainText(/submitted/i);
      await expect(
        voter.locator('button[data-testid^="banana-thief-vote-"]').first(),
      ).toBeDisabled();

      // Screenshots for VOTING
      await p1.screenshot({
        path: testInfo.outputPath('voting-1280.png'),
      });

      // Remaining players cast their votes
      for (const p of [p1, p2, p3, p4].filter((page) => page !== voter)) {
        const btn = p.locator('button[data-testid^="banana-thief-vote-"]').first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await expect
            .poll(() =>
              p.evaluate(() => {
                const state = (window as any).__useGameStore.getState();
                return (
                  state.privateState.ctVote != null ||
                  state.room.bananaThiefState.phase === 'RESULT'
                );
              }),
            )
            .toBe(true);
        }
      }

      // ==========================================
      // Phase: RESULT
      // ==========================================
      // When all votes are in, game enters RESULT
      for (const p of [p1, p2, p3, p4]) {
        await expect
          .poll(() =>
            p.evaluate(() => (window as any).__useGameStore.getState().room.bananaThiefState.phase),
          )
          .toBe('RESULT');
      }

      // Screenshots for RESULT
      await p1.screenshot({
        path: testInfo.outputPath('result-1280.png'),
      });
      await p1.setViewportSize({ width: 390, height: 844 });
      await p1.screenshot({
        path: testInfo.outputPath('result-390.png'),
      });
      await p1.setViewportSize({ width: 360, height: 800 });
      await p1.screenshot({
        path: testInfo.outputPath('result-360.png'),
      });
    } finally {
      await Promise.all(contexts.map((c) => c.close().catch(() => {})));
    }
  });
});
