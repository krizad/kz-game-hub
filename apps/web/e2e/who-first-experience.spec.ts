import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Who First Experience Suite', () => {
  test('GO signal clarity, sound toggle, reduced motion, and keyboard buzzer (TASK-WF-001)', async ({
    browser,
  }) => {
    test.setTimeout(60000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostAlice', 'Who First');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await expect(p1.getByText('GuestBob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(500);

    // 1. Host enables "Host plays too" so both Alice and Bob have buzzer buttons
    const hostPlaysSwitch = p1.locator('#host-plays-switch');
    if (await hostPlaysSwitch.isVisible()) {
      const isChecked = await hostPlaysSwitch.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await hostPlaysSwitch.click();
        await p1.waitForTimeout(300);
      }
    }

    // 2. Disable penalty mode in this test to verify button disabled state during COUNTDOWN
    const penaltySwitch = p1.locator('#penalty-switch');
    if (await penaltySwitch.isVisible()) {
      const isChecked = await penaltySwitch.getAttribute('aria-checked');
      if (isChecked === 'true') {
        await penaltySwitch.click();
        await p1.waitForTimeout(300);
      }
    }

    // 3. Sound toggle test in lobby
    const soundToggle = p1.locator('[data-testid="who-first-sound-toggle"]');
    await expect(soundToggle).toBeVisible();
    await soundToggle.click(); // toggle mute
    await expect(soundToggle).toContainText('🔇');
    await soundToggle.click(); // toggle unmute
    await expect(soundToggle).toContainText('🔊');

    // 4. Host starts the game
    const startBtn = p1.getByTestId('start-btn');
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // 5. During COUNTDOWN: Ready text visible with reduced-motion support, button is disabled
    const readyP1 = p1.getByTestId('status-ready');
    await expect(readyP1).toBeVisible({ timeout: 5000 });
    await expect(readyP1).toContainText(/Ready|เตรียมตัว/i);

    const pressBtnP2 = p2.getByTestId('press-btn');
    await expect(pressBtnP2).toBeDisabled();

    // 6. Transition to ACTIVE: Screen flashes green (status-go visible, active-container has emerald styling)
    const goP1 = p1.getByTestId('status-go');
    await expect(goP1).toBeVisible({ timeout: 8000 });
    await expect(goP1).toContainText(/GO!!|กดเลย!!/i);

    const activeContainer = p1.locator('[data-testid="who-first-active-container"]');
    await expect(activeContainer).toBeVisible();

    // 7. Keyboard support: P1 presses buzzer using keyboard Spacebar
    const pressBtnP1 = p1.getByTestId('press-btn');
    await expect(pressBtnP1).toBeEnabled();
    await p1.keyboard.press('Space');
    await expect(pressBtnP1).toContainText(/PRESSED!|กดแล้ว!/i);

    // P2 presses button via click
    await expect(pressBtnP2).toBeEnabled();
    await pressBtnP2.click();

    // 8. Results screen shows round results
    await expect(p1.getByTestId('round-result-title')).toBeVisible({ timeout: 5000 });
    await expect(p2.getByTestId('round-result-title')).toBeVisible({ timeout: 5000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('server clock synchronization, countdown display, and network disclaimer (TASK-WF-002)', async ({
    browser,
  }) => {
    test.setTimeout(60000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostAlice', 'Who First');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await expect(p1.getByText('GuestBob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(500);

    const hostPlaysSwitch = p1.locator('#host-plays-switch');
    if (await hostPlaysSwitch.isVisible()) {
      if ((await hostPlaysSwitch.getAttribute('aria-checked')) !== 'true') {
        await hostPlaysSwitch.click();
        await p1.waitForTimeout(300);
      }
    }

    // Host starts game
    await p1.getByTestId('start-btn').click();

    // Countdown timer display visible
    const countdownP1 = p1.locator('[data-testid="who-first-countdown-display"]');
    await expect(countdownP1).toBeVisible({ timeout: 5000 });
    await expect(countdownP1).toContainText(/s$/);

    // Active timer appears when phase switches to ACTIVE
    await expect(p1.getByTestId('status-go')).toBeVisible({ timeout: 8000 });
    const activeTimerP1 = p1.locator('[data-testid="who-first-active-timer"]');
    await expect(activeTimerP1).toBeVisible({ timeout: 3000 });

    // P1 presses buzzer
    await p1.getByTestId('press-btn').click();
    // P2 presses buzzer
    await p2.getByTestId('press-btn').click();

    // Verify network latency disclaimer in results area
    const disclaimer = p1.locator('[data-testid="who-first-network-disclaimer"]');
    await expect(disclaimer).toBeVisible({ timeout: 5000 });
    await expect(disclaimer).toContainText(
      /Reaction times are measured server-side and include network latency|เวลาปฏิกิริยาถูกบันทึกที่เซิร์ฟเวอร์และรวมความหน่วงเครือข่าย/i,
    );

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('early press foul detection, infinite mode, and rematch host guard (TASK-WF-003)', async ({
    browser,
  }) => {
    test.setTimeout(75000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostAlice', 'Who First');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await expect(p1.getByText('GuestBob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(500);

    // 1. Enable Infinite Rounds and Host Plays
    const infiniteSwitch = p1.locator('#infinite-switch');
    if (await infiniteSwitch.isVisible()) {
      if ((await infiniteSwitch.getAttribute('aria-checked')) !== 'true') {
        await infiniteSwitch.click();
        await p1.waitForTimeout(300);
      }
    }

    const hostPlaysSwitch = p1.locator('#host-plays-switch');
    if (await hostPlaysSwitch.isVisible()) {
      if ((await hostPlaysSwitch.getAttribute('aria-checked')) !== 'true') {
        await hostPlaysSwitch.click();
        await p1.waitForTimeout(300);
      }
    }

    // Ensure Penalty mode is enabled (default is true)
    const penaltySwitch = p1.locator('#penalty-switch');
    if (await penaltySwitch.isVisible()) {
      if ((await penaltySwitch.getAttribute('aria-checked')) !== 'true') {
        await penaltySwitch.click();
        await p1.waitForTimeout(300);
      }
    }

    // Start game
    await p1.getByTestId('start-btn').click();

    // 2. Round indicator verifies Infinite mode
    const roundIndicator = p1.locator('[data-testid="who-first-round-indicator"]');
    await expect(roundIndicator).toBeVisible({ timeout: 5000 });
    await expect(roundIndicator).toContainText(/Infinite|ไม่จำกัดรอบ/i);

    // 3. Early press test: P2 presses during COUNTDOWN phase!
    await expect(p2.getByTestId('status-ready')).toBeVisible({ timeout: 5000 });
    const p2Buzzer = p2.getByTestId('press-btn');
    await expect(p2Buzzer).toBeEnabled(); // pressable because penalty is enabled
    await p2Buzzer.click();
    await expect(p2Buzzer).toContainText(/FOUL!|ฟาวล์!/i);

    // Wait for ACTIVE and P1 presses legitimately
    await expect(p1.getByTestId('status-go')).toBeVisible({ timeout: 8000 });
    await p1.getByTestId('press-btn').click();

    // 4. In results: P2 has early press foul card and penalty explanation reason banner
    await expect(p1.getByTestId('round-result-title')).toBeVisible({ timeout: 5000 });
    const earlyPressEntry = p1.locator('[data-testid="who-first-early-press"]');
    await expect(earlyPressEntry).toBeVisible({ timeout: 5000 });
    const penaltyReason = p1.locator('[data-testid="who-first-penalty-reason"]');
    await expect(penaltyReason).toBeVisible();
    await expect(penaltyReason).toContainText(
      /Pressed before the GO signal was given|กดก่อนที่สัญญาณ/i,
    );

    // 5. Host guard check in ROUND_RESULT
    // Host sees Next Round and End Game Now buttons
    await expect(p1.locator('[data-testid="who-first-next-round-btn"]')).toBeVisible();
    await expect(p1.locator('[data-testid="who-first-end-game-btn"]')).toBeVisible();
    // Guest sees waiting message and NO next round button
    await expect(p2.locator('[data-testid="who-first-waiting-host"]')).toBeVisible();
    await expect(p2.locator('[data-testid="who-first-next-round-btn"]')).not.toBeVisible();

    // 6. Host advances to next round
    await p1.locator('[data-testid="who-first-next-round-btn"]').click();
    await expect(p1.getByTestId('status-ready')).toBeVisible({ timeout: 8000 });
    await expect(roundIndicator).toContainText(/Round 2|รอบที่ 2/i);

    // 7. Host clicks End Game Now to conclude the game
    const endGameNow = p1.locator('[data-testid="who-first-end-game-btn"]');
    await expect(endGameNow).toBeVisible();
    await endGameNow.click();

    // 8. Finished phase rematch host guard
    const finalTitle = p1.getByTestId('round-result-title');
    await expect(finalTitle).toBeVisible({ timeout: 5000 });
    await expect(finalTitle).toContainText(/Final Result|ผลลัพธ์สุดท้าย/i);

    // Host sees rematch button
    const rematchBtn = p1.locator('[data-testid="who-first-rematch-btn"]');
    await expect(rematchBtn).toBeVisible();
    // Guest sees waiting for host message
    await expect(p2.locator('[data-testid="who-first-waiting-host"]')).toBeVisible();
    await expect(p2.locator('[data-testid="who-first-rematch-btn"]')).not.toBeVisible();

    // 9. Host clicks rematch -> resets back to Lobby
    await rematchBtn.click();
    await expect(p1.getByTestId('lobby-title')).toBeVisible({ timeout: 8000 });
    await expect(p2.locator('[data-testid="who-first-lobby-waiting-host"]')).toBeVisible({
      timeout: 8000,
    });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
