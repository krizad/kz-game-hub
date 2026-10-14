import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Sounds Fishy Experience (TASK-SF-001)', () => {
  test('handles unavailable questions gracefully, unlocks loading, displays error, and recovers in Thai', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));
    await p1.setViewportSize({ width: 1280, height: 900 });

    // 1. Host creates room and sets room language to English where question repository has 0 questions
    const roomCode = await createRoom(p1, 'FishHost', 'GuiseGuess');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Guise1');
    await joinRoom(p3, origin, roomCode, 'Guise2');

    // Host selects EN in room lobby so room.config.language is 'en'
    await p1.getByText('EN', { exact: true }).click();
    await p1.waitForTimeout(500);

    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled({ timeout: 10000 });

    // 2. Click Start Game — English questions are unavailable in repository
    await startBtn.click();

    // 3. Verify game-start-error appears and button loading state is unlocked
    const errorEl = p1.getByTestId('game-start-error');
    await expect(errorEl).toBeVisible({ timeout: 10000 });
    await expect(errorEl).toContainText('Questions are unavailable');

    // Button must NOT remain disabled or stuck in Starting...
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await expect(startBtn).not.toHaveText(/Starting/i);

    // 4. Room remains in LOBBY and no secret answer or role is leaked
    for (const page of [p1, p2, p3]) {
      await expect(page.locator('input#answerInput')).toBeHidden();
      await expect(page.getByText('Waiting Room', { exact: false })).toBeVisible();
    }

    // Capture English error screenshots across viewports
    await p1.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/1280-en.png',
    });
    await p1.setViewportSize({ width: 390, height: 844 });
    await p1.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/390-en.png',
    });
    await p1.setViewportSize({ width: 360, height: 800 });
    await p1.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/360-en.png',
    });

    // 5. Test Thai localization: switch UI language to Thai while error is shown
    await p1.getByText('TH', { exact: true }).click();
    await expect(errorEl).toContainText('คลังคำถามยังใช้งานไม่ได้ ลองใหม่หรือเลือกเกมอื่น');

    // Capture Thai error screenshots across viewports
    await p1.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/360-th.png',
    });
    await p1.setViewportSize({ width: 390, height: 844 });
    await p1.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/390-th.png',
    });
    await p1.setViewportSize({ width: 1280, height: 900 });
    await p1.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/1280-th.png',
    });

    // 6. Recovery: In Thai mode, clicking start button begins a round because Thai trivia exists in DB
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // The game successfully starts in Thai! Error is dismissed and question phase begins
    await expect(errorEl).toBeHidden({ timeout: 10000 });

    // Non-pickers see answer input; picker does not see true answer leaked
    const answerInputs = [p1, p2, p3].map((p) => p.locator('input#answerInput'));
    let anyVisible = false;
    for (let i = 0; i < 20; i++) {
      for (const inp of answerInputs) {
        if (await inp.isVisible().catch(() => false)) {
          anyVisible = true;
          break;
        }
      }
      if (anyVisible) break;
      await p1.waitForTimeout(500);
    }
    expect(anyVisible).toBe(true);

    for (const ctx of contexts) {
      await ctx.close();
    }
  });
});
