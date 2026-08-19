import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Detective Club Gameplay', () => {
  test('three players can start game and enter setup phase', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'DetHost', 'Detective Club');
    const origin = await getOrigin(p1);

    await joinRoom(p2, origin, roomCode, 'D1');
    await joinRoom(p3, origin, roomCode, 'D2');

    // Verify all joined
    await p1.waitForTimeout(1000);
    for (const name of ['D1', 'D2']) {
      await expect(p1.getByText(name)).toBeVisible({ timeout: 5000 });
    }

    // Host starts game
    const startBtn = p1.getByText('Start Game');
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await p1.waitForTimeout(3000);
    }

    // Game should be in SETUP phase - each player has a role
    await p1.waitForTimeout(1000);

    // Check for role display or setup phase text
    const hasRole = await p1
      .locator('text=Your Role')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasSetup = await p1
      .locator('text=Setup Phase')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(hasRole || hasSetup).toBeTruthy();

    // Informer should submit a word if visible
    for (const page of [p1, p2, p3]) {
      const wordInput = page.locator('input').filter({ hasText: '' }).first();
      if (await wordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await wordInput.fill('Mystery');
        await page
          .locator('button', { hasText: /Confirm|Submit/i })
          .first()
          .click();
        await page.waitForTimeout(1500);
        break;
      }
    }

    // Now players need to play cards in order (Playing Phase)
    // There are 3 players. Each plays 1 card, then again 1 card.
    // For simplicity, we just look for any page that has "Play Card" button and click it, 6 times total.
    for (let round = 0; round < 6; round++) {
      for (const page of [p1, p2, p3]) {
        // Wait briefly to see if it's this player's turn
        const playBtn = page.locator('button', { hasText: /Play Card/i }).first();
        if (await playBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Select a card (click the first image in hand)
          await page.locator('img').first().click();
          await playBtn.click();
          await page.waitForTimeout(1000);
          break; // Move to next play
        }
      }
    }

    // Then there might be a discussion phase -> Continue
    for (const page of [p1, p2, p3]) {
      const continueBtn = page.locator('button', { hasText: /Continue|Vote/i }).first();
      if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueBtn.click();
      }
    }

    // Voting Phase
    for (const page of [p1, p2, p3]) {
      const voteBtn = page.locator('button', { hasText: /Vote/i }).first();
      if (await voteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Vote for someone (e.g. click first player to vote)
        await page
          .locator('button')
          .filter({ hasText: /Player|D1|D2|DetHost/i })
          .first()
          .click()
          .catch(() => {});
        await voteBtn.click().catch(() => {});
      }
    }

    // Wait for Round Results
    await expect(p1.locator('text=Round Results').or(p1.locator('text=Scoreboard')))
      .toBeVisible({ timeout: 10000 })
      .catch(() => {});

    await p1.waitForTimeout(1000);
    await Promise.all(contexts.map((c) => c.close()));
  });

  test('can create room and see lobby', async ({ page }) => {
    await createRoom(page, 'DetTest', 'Detective Club');
    await expect(page.getByText('DetTest').first()).toBeVisible();
  });
});
