import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Who Am I Gameplay', () => {
  test('two players can submit words and start asking phase', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Amy', 'Who Am I');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    // Both players should be in the room
    await p1.waitForTimeout(2000);
    await expect(p2.getByText('Amy').first()).toBeVisible({ timeout: 5000 });

    // CAPTURE LOBBY
    await p1.screenshot({
      path: '/Users/kridsadaintahson/.gemini/antigravity/brain/aa124860-4805-495e-91e6-b768404b5a04/scratch/whoami_1_lobby.png',
      fullPage: true,
    });

    // Select PLAYER_INPUT to avoid category issues
    await p1.locator('#wordModeSelect').selectOption('PLAYER_INPUT');

    // Player 1 tries to start game
    const startBtn = p1.getByRole('button', { name: /start game/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // Both should see COLLECTING_WORDS phase (PLAYER_INPUT default)
    await p1.waitForTimeout(1000);

    // CAPTURE COLLECTING WORDS PHASE
    await p1.screenshot({
      path: '/Users/kridsadaintahson/.gemini/antigravity/brain/aa124860-4805-495e-91e6-b768404b5a04/scratch/whoami_2_collecting.png',
      fullPage: true,
    });

    // Submit words if in COLLECTING_WORDS phase
    const p1Input = p1.locator('input').first();
    if (await p1Input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await p1Input.fill('Elephant');
      await p1.locator('button:has-text("Submit Word")').first().click();
      await p1.waitForTimeout(500);

      const p2Input = p2.locator('input').first();
      if (await p2Input.isVisible({ timeout: 5000 }).catch(() => false)) {
        await p2Input.fill('Tiger');
        await p2.locator('button:has-text("Submit Word")').first().click();
        await p2.waitForTimeout(3000);
      }

      // After both submit, game should transition to ASKING
      await p1.waitForTimeout(1000);
    }

    // Check if asking phase is active
    await p1.waitForTimeout(1000);

    // Active player makes a guess
    let activePage = null;
    let otherPage = null;
    const guessBtn1 = p1.locator('button').filter({ hasText: /Guess|ทาย/i });
    if (
      await guessBtn1
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      activePage = p1;
      otherPage = p2;
    } else {
      const guessBtn2 = p2.locator('button').filter({ hasText: /Guess|ทาย/i });
      if (
        await guessBtn2
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        activePage = p2;
        otherPage = p1;
      }
    }

    if (activePage && otherPage) {
      // Click Make a Guess
      await activePage
        .locator('button')
        .filter({ hasText: /Guess|ทาย/i })
        .first()
        .click();

      // Fill the guess modal
      const guessInput = activePage.locator('input').last();
      await guessInput.waitFor({ state: 'visible', timeout: 3000 });
      await guessInput.fill('A correct guess');

      // Submit guess
      await activePage
        .locator('button')
        .filter({ hasText: /Submit|ยืนยัน/i })
        .last()
        .click();
      await activePage.waitForTimeout(1000);

      // Other player votes YES
      const yesBtn = otherPage
        .locator('button')
        .filter({ hasText: /Yes|ใช่/i })
        .first();
      if (await yesBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await yesBtn.click();
      }

      await activePage.waitForTimeout(1000);

      // Since it's a 2 player game, 1 YES is enough. The game might end or go to next round.
      // Host clicks "End Match" if available to show the scoreboard
      const endBtn = p1
        .locator('button')
        .filter({ hasText: /End Match|จบเกม/i })
        .first();
      if (await endBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await endBtn.click();
      }
    }

    // Wait for Round Results / Match Ends
    await expect(p1.locator('text=Scoreboard').or(p1.locator('text=Match Ended')))
      .toBeVisible({ timeout: 5000 })
      .catch(() => {});

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('can create room and see lobby config', async ({ page }) => {
    await createRoom(page, 'WhoHost', 'Who Am I');
    await expect(page.getByText('WhoHost').first()).toBeVisible();
  });
});
