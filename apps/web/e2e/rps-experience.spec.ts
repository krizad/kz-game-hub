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
    await p1.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/rps/1280-en.png' });
    await p1.setViewportSize({ width: 390, height: 844 });
    await p1.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/rps/390-en.png' });
    await p1.setViewportSize({ width: 360, height: 800 });
    await p1.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/rps/360-en.png' });

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
    await p2.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/rps/360-th.png' });
    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/rps/390-th.png' });
    await p2.setViewportSize({ width: 1280, height: 900 });
    await p2.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/rps/1280-th.png' });

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
});
