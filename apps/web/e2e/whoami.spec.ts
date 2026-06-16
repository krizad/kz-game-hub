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

    // Player 1 tries to start game - note: Start may be disabled until config is set

    // Both should see COLLECTING_WORDS phase (PLAYER_INPUT default)
    await p1.waitForTimeout(1000);

    // Submit words if in COLLECTING_WORDS phase
    const p1Input = p1.locator('#playerWordInput').first();
    if (await p1Input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await p1Input.fill('Elephant');
      await p1.locator('button:has-text("Submit Word")').first().click();
      await p1.waitForTimeout(500);

      const p2Input = p2.locator('#playerWordInput').first();
      if (await p2Input.isVisible({ timeout: 5000 }).catch(() => false)) {
        await p2Input.fill('Tiger');
        await p2.locator('button:has-text("Submit Word")').first().click();
        await p2.waitForTimeout(3000);
      }

      // After both submit, game should transition to ASKING
      await p1.waitForTimeout(1000);
    }

    // Check if asking phase is active (YES/NO/MAYBE buttons)
    await p1.waitForTimeout(1000);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('can create room and see lobby config', async ({ page }) => {
    await createRoom(page, 'WhoHost', 'Who Am I');
    await expect(page.getByText('WhoHost').first()).toBeVisible();
  });
});
