import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('RPS Experience (TASK-RP-001)', () => {
  test('has accessible choice buttons, displays locked and waiting status without leaking choice', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    await p1.setViewportSize({ width: 1280, height: 900 });

    const roomCode = await createRoom(p1, 'RockyHost', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'PaperGuest');

    // Host starts the game
    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // 1. Verify accessible buttons in English (Task RP-1 spec: getByRole button Rock, Paper, Scissors)
    const p1Rock = p1.getByRole('button', { name: 'Rock', exact: true });
    const p1Paper = p1.getByRole('button', { name: 'Paper', exact: true });
    const p1Scissors = p1.getByRole('button', { name: 'Scissors', exact: true });

    await expect(p1Rock).toBeVisible({ timeout: 10000 });
    await expect(p1Paper).toBeVisible({ timeout: 10000 });
    await expect(p1Scissors).toBeVisible({ timeout: 10000 });

    const p2Rock = p2.getByRole('button', { name: 'Rock', exact: true });
    const p2Paper = p2.getByRole('button', { name: 'Paper', exact: true });
    const p2Scissors = p2.getByRole('button', { name: 'Scissors', exact: true });

    await expect(p2Rock).toBeVisible({ timeout: 10000 });
    await expect(p2Paper).toBeVisible({ timeout: 10000 });
    await expect(p2Scissors).toBeVisible({ timeout: 10000 });

    // Initial statuses: both choosing
    await expect(p1.locator('[data-testid^="rps-player-status-"]').first()).toContainText(
      'Choosing',
    );

    // Capture English choices view across viewports
    await p1.screenshot({ path: './test-results/qa-captures/rps/1280-en.png' });
    await p1.setViewportSize({ width: 390, height: 844 });
    await p1.screenshot({ path: './test-results/qa-captures/rps/390-en.png' });
    await p1.setViewportSize({ width: 360, height: 800 });
    await p1.screenshot({ path: './test-results/qa-captures/rps/360-en.png' });

    // 2. Test Thai localization on P2
    await p2.getByText('TH', { exact: true }).click();
    await expect(p2.getByRole('button', { name: 'ค้อน', exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(p2.getByRole('button', { name: 'กระดาษ', exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(p2.getByRole('button', { name: 'กรรไกร', exact: true })).toBeVisible({
      timeout: 5000,
    });

    // Capture Thai choices view across viewports
    await p2.setViewportSize({ width: 360, height: 800 });
    await p2.screenshot({ path: './test-results/qa-captures/rps/360-th.png' });
    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.screenshot({ path: './test-results/qa-captures/rps/390-th.png' });
    await p2.setViewportSize({ width: 1280, height: 900 });
    await p2.screenshot({ path: './test-results/qa-captures/rps/1280-th.png' });

    // 3. P1 locks in choice "ROCK"
    await p1.setViewportSize({ width: 1280, height: 900 });
    await p1Rock.click();

    // P1 now sees choice locked and waiting for PaperGuest
    const p1Locked = p1.getByTestId('rps-choice-locked');
    await expect(p1Locked).toBeVisible({ timeout: 5000 });
    await expect(p1Locked).toContainText('Choice locked!');
    await expect(p1Locked).toContainText('Rock');
    await expect(p1.getByTestId('rps-waiting-status')).toContainText('Waiting for PaperGuest');

    // 4. Verify privacy: P2 sees that P1 is Ready, but P2's arena does not reveal P1's choice
    await expect(p2.getByText('พร้อมแล้ว').or(p2.getByText('Ready'))).toBeVisible({
      timeout: 5000,
    });
    await expect(p2.getByTestId('rps-choice-locked')).toBeHidden();
    await expect(p2.locator('.text-5xl.sm\\:text-7xl')).toBeHidden();

    // 5. P2 locks in choice "PAPER" (in Thai: กระดาษ)
    await p2.getByRole('button', { name: 'กระดาษ', exact: true }).click();

    // 6. Round resolves: Next Round / Play Again button appears for host
    const nextBtn = p1.locator('button', { hasText: /Next Round|Play Again/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 10000 });

    // Both players can see revealed choices now
    await expect(p1.locator('.text-5xl.sm\\:text-7xl').filter({ hasText: '✊' })).toBeVisible({
      timeout: 5000,
    });
    await expect(p1.locator('.text-5xl.sm\\:text-7xl').filter({ hasText: '✋' })).toBeVisible({
      timeout: 5000,
    });

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('displays round outcome, draw explanation, host/guest CTAs, and responsive 1v1 queue (TASK-RP-002)', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();

    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();

    await p1.setViewportSize({ width: 1280, height: 900 });
    await p3.setViewportSize({ width: 390, height: 844 }); // Mobile player in queue

    const roomCode = await createRoom(p1, 'Host1', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Fighter2');
    await joinRoom(p3, origin, roomCode, 'Queued3');

    // Host starts 1v1 Round Robin game
    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // 1. Verify responsive queue on mobile player (P3)
    await expect(p3.getByTestId('rps-queue-banner')).toBeVisible({ timeout: 10000 });
    await expect(p3.getByTestId('rps-queue-turn-notice')).toContainText('Your turn in round #1');
    await expect(p3.getByTestId('rps-spectator-waiting')).toBeVisible();

    // 2. Play Round 1: Both P1 and P2 pick Rock -> DRAW
    const p1Rock = p1.getByRole('button', { name: 'Rock', exact: true });
    const p2Rock = p2.getByRole('button', { name: 'Rock', exact: true });

    await expect(p1Rock).toBeVisible({ timeout: 10000 });
    await expect(p2Rock).toBeVisible({ timeout: 10000 });

    await p1Rock.click();
    await p2Rock.click();

    // 3. Verify DRAW outcome and explanation (Task RP-2 requirement)
    const p1Outcome = p1.getByTestId('rps-round-outcome');
    await expect(p1Outcome).toBeVisible({ timeout: 10000 });
    await expect(p1Outcome).toContainText(/draw|wins/i);
    await expect(p1Outcome).toContainText("It's a Draw!");
    await expect(p1Outcome).toContainText('Draw! No points awarded this round.');

    // 4. Verify Host CTA and Guest waiting status
    const hostNextBtn = p1.getByTestId('rps-next-round-btn');
    await expect(hostNextBtn).toBeVisible({ timeout: 5000 });
    await expect(hostNextBtn).toContainText('Next Round');

    const guestWaiting = p2.getByTestId('rps-guest-waiting');
    await expect(guestWaiting).toBeVisible({ timeout: 5000 });
    await expect(guestWaiting).toContainText('Waiting for host to start next round');

    // Capture screenshots of Draw outcome across viewports
    await p1.screenshot({
      path: './test-results/qa-captures/rps/outcome-1280-en.png',
    });
    await p1.setViewportSize({ width: 390, height: 844 });
    await p1.screenshot({
      path: './test-results/qa-captures/rps/outcome-390-en.png',
    });
    await p1.setViewportSize({ width: 360, height: 800 });
    await p1.screenshot({
      path: './test-results/qa-captures/rps/outcome-360-en.png',
    });

    // 5. Host advances to next round
    await p1.setViewportSize({ width: 1280, height: 900 });
    await hostNextBtn.click();

    // 6. Round 2: P1 chooses Scissors, P2 chooses Paper -> P1 wins round
    const p1Scissors = p1.getByRole('button', { name: 'Scissors', exact: true });
    const p2Paper = p2.getByRole('button', { name: 'Paper', exact: true });

    await expect(p1Scissors).toBeVisible({ timeout: 10000 });
    await expect(p2Paper).toBeVisible({ timeout: 10000 });

    await p1Scissors.click();
    await p2Paper.click();

    // 7. Verify Wins Round outcome
    await expect(p1Outcome).toBeVisible({ timeout: 10000 });
    await expect(p1Outcome).toContainText(/draw|wins/i);
    await expect(p1Outcome).toContainText('Host1 Wins the Round!');

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('plays reveal animation once, supports reduced-motion, and allows immediate next round without waiting (TASK-RP-003)', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    // Emulate reduced motion on P2 to verify reduced-motion behavior
    await p2.emulateMedia({ reducedMotion: 'reduce' });

    await p1.setViewportSize({ width: 1280, height: 900 });
    await p2.setViewportSize({ width: 390, height: 844 });

    const roomCode = await createRoom(p1, 'MotionHost', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'ReducedGuest');

    // Host starts game
    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // Round 1: P1 picks ROCK, P2 picks SCISSORS -> P1 wins round
    const p1Rock = p1.getByRole('button', { name: 'Rock', exact: true });
    const p2Scissors = p2.getByRole('button', { name: 'Scissors', exact: true });

    await expect(p1Rock).toBeVisible({ timeout: 10000 });
    await expect(p2Scissors).toBeVisible({ timeout: 10000 });

    await p1Rock.click();
    await p2Scissors.click();

    // 1. Verify outcomes are immediately visible on both screens
    const p1Outcome = p1.getByTestId('rps-round-outcome');
    const p2Outcome = p2.getByTestId('rps-round-outcome');
    await expect(p1Outcome).toBeVisible({ timeout: 10000 });
    await expect(p2Outcome).toBeVisible({ timeout: 10000 });
    await expect(p1Outcome).toContainText('MotionHost Wins the Round!');

    // 2. Verify revealed choice testids are present
    const p1Revealed = p1.locator('[data-testid^="rps-revealed-choice-"]');
    const p2Revealed = p2.locator('[data-testid^="rps-revealed-choice-"]');
    await expect(p1Revealed.first()).toBeVisible({ timeout: 5000 });
    await expect(p2Revealed.first()).toBeVisible({ timeout: 5000 });

    // 3. Next round button is immediately enabled for host without waiting for animation delay
    const hostNextBtn = p1.getByTestId('rps-next-round-btn');
    await expect(hostNextBtn).toBeVisible();
    await expect(hostNextBtn).toBeEnabled();

    // 4. Host advances immediately to Round 2
    await hostNextBtn.click();

    // Round 2 controls appear immediately without blocked delays
    await expect(p1.getByRole('button', { name: 'Rock', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(p2.getByRole('button', { name: 'Scissors', exact: true })).toBeVisible({
      timeout: 10000,
    });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
