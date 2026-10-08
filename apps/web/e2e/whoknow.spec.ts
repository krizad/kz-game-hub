import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Knowguise Gameplay', () => {
  test('four players can start game flow', async ({ browser }) => {
    test.setTimeout(120000); // 2 minutes for Knowguise
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'Knowguise');
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
    await expect(
      p1.getByRole('navigation', { name: /ช่วงต่างๆ ของเกม|Knowguise game phases/i }),
    ).toBeVisible();

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
    await expect(
      hostPage.getByRole('heading', {
        name: /ตอบคำถาม|ถามคำถาม.*คนถือคำ|Answer the players|Ask the Word Keeper/i,
      }),
    ).toBeVisible({ timeout: 15000 });

    // In-game host ends the questioning phase
    const endBtn = hostPage
      .locator('button')
      .filter({ hasText: /Word Guessed|Time's Up/i })
      .first();
    await expect(endBtn).toBeVisible({ timeout: 15000 });
    await endBtn.click();

    // Wait for Voting Phase
    await p1.waitForTimeout(2000);

    // Vote with one player first. Their own page must show the private receipt,
    // while everyone else still sees the sealed-vote phase and no result breakdown.
    const voters = players.filter((page) => page !== hostPage);
    const firstVoter = voters[0];
    const firstVoteButton = firstVoter
      .locator('button')
      .filter({ hasText: /P1|P2|P3|Host/i })
      .first();
    await expect(firstVoteButton).toBeVisible({ timeout: 10000 });
    await firstVoteButton.click();
    await expect(firstVoter.getByText(/ล็อกคะแนนของคุณแล้ว|Your vote is locked/i)).toBeVisible({
      timeout: 10000,
    });
    for (const page of players.filter((page) => page !== hostPage && page !== firstVoter)) {
      await expect(page.getByText(/Voting Results|ผลการโหวต/i)).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: /ใครคือคนที่แอบชี้นำกลุ่ม|Who was secretly guiding/i }),
      ).toBeVisible({ timeout: 10000 });
    }

    // Finish the round and verify the authorized reveal is understandable.
    for (const page of voters.slice(1)) {
      const voteButton = page
        .locator('button')
        .filter({ hasText: /P1|P2|P3|Host/i })
        .first();
      await expect(voteButton).toBeVisible({ timeout: 10000 });
      await voteButton.click();
    }
    await expect(p1.getByRole('heading', { name: /ผลเกม|Game Results/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(p1.getByText(/เฉลยบทบาทและคะแนน|Roles and scores/i)).toBeVisible();

    await Promise.all(contexts.map((c) => c.close()));
  });

  test('host sees lobby config options', async ({ page }) => {
    await createRoom(page, 'SoloHost', 'Knowguise');
    await expect(page.getByText('SoloHost').first()).toBeVisible();
    await expect(page.getByText('Host Selection').or(page.getByText('การเลือกโฮสต์'))).toBeVisible({
      timeout: 5000,
    });
  });
});
