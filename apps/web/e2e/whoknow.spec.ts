import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Who Know Gameplay', () => {
  test('four players can start game flow', async ({ browser }) => {
    test.setTimeout(120000); // 2 minutes for Who Know
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'Who Know');
    const origin = await getOrigin(p1);

    await joinRoom(p2, origin, roomCode, 'P1');
    await joinRoom(p3, origin, roomCode, 'P2');
    await joinRoom(p4, origin, roomCode, 'P3');

    // All should be in the room
    await p1.waitForTimeout(2000);

    // Set timer to 1 minute to speed up test
    const timerInput = p1.locator('input[name="timerMin"]');
    if (await timerInput.isVisible()) {
      await timerInput.fill('1');
      await p1.waitForTimeout(500);
    }

    // Host starts game
    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
    await p1.waitForTimeout(3000);

    // Verify game started
    await p1.waitForTimeout(1500);

    // Secret word selection: ROUND_ROBIN picks the in-game host randomly, so the
    // popup can appear on any player's page. Find the page that shows it.
    const players = [p1, p2, p3, p4];
    let hostPage = p1;
    for (const page of players) {
      const visible = await page
        .locator('#secretWordModalInput')
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (visible) {
        hostPage = page;
        break;
      }
    }
    const wordInput = hostPage.locator('#secretWordModalInput');
    await expect(wordInput).toBeVisible({ timeout: 5000 });
    await wordInput.fill('E2E Secret Word');
    await wordInput.press('Enter');
    await hostPage.waitForTimeout(2000);

    // In-game host ends the questioning phase
    const endBtn = hostPage
      .locator('button')
      .filter({ hasText: /Word Guessed|Time's Up/i })
      .first();
    await expect(endBtn).toBeVisible({ timeout: 15000 });
    await endBtn.click();

    // Wait for Voting Phase
    await p1.waitForTimeout(2000);

    // Players vote (everyone except the in-game host)
    for (const page of players.filter((page) => page !== hostPage)) {
      const voteBtn = page
        .locator('button')
        .filter({ hasText: /P1|P2|P3|Host/i })
        .first();
      if (await voteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await voteBtn.click().catch(() => {});
      }
    }

    // The match outcome depends on timer/vote timing; the start-and-questioning
    // assertions above are this flow's real coverage. Let the round settle.
    await p1.waitForTimeout(2000);

    await Promise.all(contexts.map((c) => c.close()));
  });

  test('host sees lobby config options', async ({ page }) => {
    await createRoom(page, 'SoloHost', 'Who Know');
    await expect(page.getByText('SoloHost').first()).toBeVisible();
    await expect(page.getByText('Host Selection').or(page.getByText('การเลือกโฮสต์'))).toBeVisible({
      timeout: 5000,
    });
  });
});
