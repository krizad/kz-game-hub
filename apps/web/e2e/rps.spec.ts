import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('RPS (Hand Duel) Game Flow', () => {
  test('can create RPS room and see lobby config', async ({ page }) => {
    await createRoom(page, 'RPSHost', 'Hand Duel');
    await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('two players can play a round of RPS', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Rocky', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Paper');

    // Host starts the game
    const startBtn = p1.getByText('Start Game');
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
    }

    // Both players should see choices
    await expect(p1.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 5000 });
    await expect(p2.locator('button', { hasText: '✋' })).toBeVisible({ timeout: 5000 });

    // P1 chooses ROCK
    await p1.locator('button', { hasText: '✊' }).click();
    // P2 chooses PAPER
    await p2.locator('button', { hasText: '✋' }).click();

    // Verify results
    const nextBtn = p1
      .locator('button', { hasText: /Next Round|Play Again|เล่นอีกครั้ง|รอบต่อไป/i })
      .first();
    await expect(nextBtn).toBeVisible({ timeout: 10000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('recovers to lobby when opponent leaves after host locks a choice', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Rocky', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Leaver');

    await p1.getByTestId('lobby-start-game').click();
    await expect(p1.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 10000 });

    // P1 locks ROCK and waits for P2
    await p1.locator('button', { hasText: '✊' }).click();
    await expect(p1.getByTestId('rps-choice-locked')).toBeVisible({ timeout: 5000 });

    // P2 explicitly leaves the room mid-round
    await p2.getByRole('button', { name: /Leave|ออกจากห้อง/i }).click();

    // P1 recovers back to the waiting room instead of being stuck on "Waiting for Leaver"
    await expect(p1.getByText('Waiting Room').or(p1.getByText('ห้องรอ'))).toBeVisible({
      timeout: 10000,
    });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
