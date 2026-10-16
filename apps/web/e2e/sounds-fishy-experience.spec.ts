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

  test('TASK-SF-002: Blue Fish submits true answer directly without typing mistakes, Red Herring types fake answer with 200 char limit', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));
    const pages = [p1, p2, p3];

    try {
      const roomCode = await createRoom(p1, 'FishHost', 'GuiseGuess');
      const origin = await getOrigin(p1);
      await joinRoom(p2, origin, roomCode, 'Guise1');
      await joinRoom(p3, origin, roomCode, 'Guise2');

      await p1.getByText('TH', { exact: true }).click();
      await p1.waitForTimeout(300);

      const startBtn = p1.getByTestId('lobby-start-game');
      await expect(startBtn).toBeVisible({ timeout: 10000 });
      await startBtn.click();

      // Wait for question phase
      let pickerPage = p1;
      let blueFishPage = p2;
      let redHerringPage = p3;

      // Identify each player's role page
      for (let i = 0; i < 20; i++) {
        let foundBlue = false;
        let foundRed = false;
        let foundPicker = false;
        for (const p of pages) {
          if (
            await p
              .getByTestId('fishy-submit-true-answer')
              .isVisible()
              .catch(() => false)
          ) {
            blueFishPage = p;
            foundBlue = true;
          } else if (
            await p
              .locator('input#answerInput')
              .isVisible()
              .catch(() => false)
          ) {
            redHerringPage = p;
            foundRed = true;
          } else if (
            await p
              .getByText(/รอคนในวงส่งคำตอบ|Waiting for the circle/i)
              .isVisible()
              .catch(() => false)
          ) {
            pickerPage = p;
            foundPicker = true;
          }
        }
        if (foundBlue && foundRed && foundPicker) break;
        await p1.waitForTimeout(500);
      }

      // Assertions on Picker page:
      // Picker does NOT have true answer or submit-true button leaked
      await expect(pickerPage.getByTestId('fishy-submit-true-answer')).toHaveCount(0);
      await expect(pickerPage.locator('input#answerInput')).toHaveCount(0);
      await expect(pickerPage.getByText(/รอคนในวงส่งคำตอบ|Waiting for the circle/i)).toBeVisible();

      // Assertions on Blue Fish page:
      // Blue Fish has the one-click submit true answer button
      const blueSubmitBtn = blueFishPage.getByTestId('fishy-submit-true-answer');
      await expect(blueSubmitBtn).toBeVisible();
      await expect(blueSubmitBtn).toBeEnabled();

      // Capture Blue Fish setup screenshots across viewports
      await blueFishPage.setViewportSize({ width: 1280, height: 900 });
      await blueFishPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf2-setup-blue-1280.png',
      });
      await blueFishPage.setViewportSize({ width: 390, height: 844 });
      await blueFishPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf2-setup-blue-390.png',
      });
      await blueFishPage.setViewportSize({ width: 360, height: 800 });
      await blueFishPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf2-setup-blue-360.png',
      });

      // Blue Fish clicks submit true answer button
      await blueSubmitBtn.click();
      await expect(blueFishPage.getByTestId('fishy-answer-submitted')).toBeVisible({
        timeout: 10000,
      });

      // Assertions on Red Herring page:
      const fakeInput = redHerringPage.locator('input#answerInput');
      await expect(fakeInput).toBeVisible();
      await expect(fakeInput).toHaveAttribute('maxlength', '200');

      // Red Herring types fake answer
      const fakeAnswerText = 'คำตอบพรางของปลาลวง';
      await fakeInput.fill(fakeAnswerText);
      await redHerringPage
        .locator('button')
        .filter({ hasText: /ส่งคำตอบ|Submit Answer/i })
        .click();
      // Since all non-pickers have submitted answers, round moves to THE_PITCH / THE_HUNT
      await expect(redHerringPage.locator('[data-testid^="fishy-row-"]')).toHaveCount(2, {
        timeout: 10000,
      });
      await expect(fakeInput).toBeHidden();
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

  test('TASK-SF-003: Row-based reveal to eliminate, sticky bank summary, and round over score breakdown', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    // 4 players: 1 Picker, 1 Blue Fish, 2 Red Herrings (allowing bank before second herring elimination)
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));
    const pages = [p1, p2, p3, p4];

    try {
      const roomCode = await createRoom(p1, 'FishHost', 'GuiseGuess');
      const origin = await getOrigin(p1);
      await joinRoom(p2, origin, roomCode, 'Guise1');
      await joinRoom(p3, origin, roomCode, 'Guise2');
      await joinRoom(p4, origin, roomCode, 'Guise3');

      await p1.getByText('TH', { exact: true }).click();
      await p1.waitForTimeout(300);

      const startBtn = p1.getByTestId('lobby-start-game');
      await expect(startBtn).toBeVisible({ timeout: 10000 });
      await startBtn.click();

      // Identify seats
      let pickerPage = p1;
      let blueFishPage = p2;
      const redHerringPages: (typeof p1)[] = [];

      for (let i = 0; i < 20; i++) {
        let foundBlue = false;
        let foundPicker = false;
        redHerringPages.length = 0;
        for (const p of pages) {
          if (
            await p
              .getByTestId('fishy-submit-true-answer')
              .isVisible()
              .catch(() => false)
          ) {
            blueFishPage = p;
            foundBlue = true;
          } else if (
            await p
              .locator('input#answerInput')
              .isVisible()
              .catch(() => false)
          ) {
            redHerringPages.push(p);
          } else if (
            await p
              .getByText(/รอคนในวงส่งคำตอบ|Waiting for the circle/i)
              .isVisible()
              .catch(() => false)
          ) {
            pickerPage = p;
            foundPicker = true;
          }
        }
        if (foundBlue && redHerringPages.length === 2 && foundPicker) break;
        await p1.waitForTimeout(500);
      }

      // Blue fish submits true answer
      await blueFishPage.getByTestId('fishy-submit-true-answer').click();

      // Red herrings submit fake answers
      const fakeAnswer1 = 'คำตอบพรางหนึ่ง';
      const fakeAnswer2 = 'คำตอบพรางสอง';
      await redHerringPages[0].locator('input#answerInput').fill(fakeAnswer1);
      await redHerringPages[0]
        .locator('button')
        .filter({ hasText: /ส่งคำตอบ|Submit Answer/i })
        .click();

      await redHerringPages[1].locator('input#answerInput').fill(fakeAnswer2);
      await redHerringPages[1]
        .locator('button')
        .filter({ hasText: /ส่งคำตอบ|Submit Answer/i })
        .click();

      // Phase transitions to THE_PITCH / THE_HUNT for picker
      const rows = pickerPage.locator('[data-testid^="fishy-row-"]');
      await expect(rows).toHaveCount(3, { timeout: 15000 });

      // Answers start hidden with ???
      const hiddenPlaceholders = pickerPage.locator('[data-testid^="fishy-hidden-"]');
      await expect(hiddenPlaceholders).toHaveCount(3);

      // Reveal buttons exist for each non-picker
      const revealBtns = pickerPage.locator('[data-testid^="fishy-reveal-"]');
      await expect(revealBtns).toHaveCount(3);

      // Picker cannot eliminate before everyone is revealed
      await expect(pickerPage.locator('[data-testid^="fishy-eliminate-"]')).toHaveCount(0);

      // Step 1: Reveal first answer
      await revealBtns.first().click();
      await expect(pickerPage.locator('[data-testid^="fishy-reveal-"]')).toHaveCount(2, {
        timeout: 5000,
      });

      // Still only 1 revealed, cannot eliminate yet
      await expect(pickerPage.locator('[data-testid^="fishy-eliminate-"]')).toHaveCount(0);

      // Reveal second and third answers
      await pickerPage.locator('[data-testid^="fishy-reveal-"]').first().click();
      await pickerPage.locator('[data-testid^="fishy-reveal-"]').first().click();

      // Now all 3 are revealed -> eliminate buttons appear!
      const eliminateBtns = pickerPage.locator('[data-testid^="fishy-eliminate-"]');
      await expect(eliminateBtns).toHaveCount(3, { timeout: 5000 });

      // Bank summary is visible
      const bankSummary = pickerPage.getByTestId('fishy-bank-summary');
      await expect(bankSummary).toBeVisible();
      await expect(bankSummary).toContainText(/points|คะแนน/i);

      // Capture screenshots of Hunt phase with bank summary
      await pickerPage.setViewportSize({ width: 1280, height: 900 });
      await pickerPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf3-hunt-picker-1280.png',
      });
      await pickerPage.setViewportSize({ width: 390, height: 844 });
      await pickerPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf3-hunt-picker-390.png',
      });
      await pickerPage.setViewportSize({ width: 360, height: 800 });
      await pickerPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf3-hunt-picker-360.png',
      });

      // Step 2: Picker eliminates the first Red Herring row
      const fakeRow = pickerPage.locator('[data-testid^="fishy-row-"]', {
        hasText: fakeAnswer1,
      });
      await expect(fakeRow).toBeVisible();
      await fakeRow.locator('[data-testid^="fishy-eliminate-"]').click();

      // Pot is now 1 point! Bank button is enabled and visible because 1 red herring remains
      const bankButton = pickerPage.getByTestId('fishy-bank-button');
      await expect(bankButton).toBeVisible({ timeout: 5000 });
      await expect(bankSummary).toContainText('1');

      // Picker banks points and ends round
      await bankButton.click();

      // Transitions to RESULT (Round Over)
      for (const p of pages) {
        await expect(p.getByText(/Round Over|จบรอบ/i).first()).toBeVisible({ timeout: 10000 });
        await expect(p.getByTestId('fishy-result-breakdown')).toBeVisible();
        await expect(p.getByTestId('fishy-result-outcome')).toBeVisible();
      }

      // Assert on breakdown details: each player has card and role badge
      await expect(pickerPage.locator('[data-testid^="fishy-result-player-"]')).toHaveCount(4);

      // Capture Round Over result screenshots
      await pickerPage.setViewportSize({ width: 1280, height: 900 });
      await pickerPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf3-result-1280.png',
      });
      await pickerPage.setViewportSize({ width: 390, height: 844 });
      await pickerPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf3-result-390.png',
      });
      await pickerPage.setViewportSize({ width: 360, height: 800 });
      await pickerPage.screenshot({
        path: '../../docs/qa/private-friends-2026-10-14/sounds-fishy/sf3-result-360.png',
      });

      // Host clicks Play Next Round
      const nextRoundBtn = p1
        .locator('button')
        .filter({ hasText: /เริ่มรอบต่อไป|Play Next Round/i });
      await expect(nextRoundBtn).toBeVisible();
      await nextRoundBtn.click();

      // Room returns to LOBBY
      for (const p of pages) {
        await expect(p.getByText(/Waiting Room|ห้องรอ/i).first()).toBeVisible({
          timeout: 10000,
        });
      }
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
});
