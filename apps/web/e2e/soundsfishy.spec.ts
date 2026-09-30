import { test, expect, type Locator, type Page } from '@playwright/test';
import { createRoom, joinRoom, getOrigin, waitForAnyVisible } from './helpers';

/**
 * Sounds Fishy: hard assertions at every deterministic gate. Roles are
 * server-random, so completion is asserted as "Round Over reached", never a
 * specific winner (same contract as the sim driver).
 */
test.describe('Sounds Fishy Gameplay', () => {
  test('three players play a full round to Round Over', async ({ browser }) => {
    test.setTimeout(120000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));
    const pages: Page[] = [p1, p2, p3];

    const roomCode = await createRoom(p1, 'FishHost', 'Sounds Fishy');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'F1');
    await joinRoom(p3, origin, roomCode, 'F2');

    // Start — the Start button must exist for the host and clicking it must
    // leave the lobby
    const startBtn = p1.getByText('Start Game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // Answer phase: every non-picker page shows the answer input
    const answerInputs = pages.map((p) => p.locator('input#answerInput'));
    const firstInput = await waitForAnyVisible(answerInputs, 20000);
    expect(firstInput, 'at least one player should see the answer input').not.toBeNull();

    // Submit answers wherever the input is up, then keep driving whatever
    // control appears (reveal / eliminate / bank) until Round Over
    for (let i = 0; i < 40; i++) {
      if (
        await p1
          .getByText(/Round Over/i)
          .first()
          .isVisible()
          .catch(() => false)
      )
        break;
      for (const page of pages) {
        const input = page.locator('input#answerInput');
        if (await input.isVisible().catch(() => false)) {
          // The blue fish MUST submit the exact true answer shown on their
          // page; everyone else may lie. (Copied from the proven sim driver.)
          let text = 'This is the truth';
          if (
            await page
              .getByText(/You MUST enter the true answer exactly/i)
              .isVisible()
              .catch(() => false)
          ) {
            text =
              (await page
                .locator('span:has-text("The True Answer") + p')
                .textContent()
                .catch(() => null)) ?? '';
            text = text.trim();
          }
          if (text) {
            await input.fill(text).catch(() => {});
            await page
              .locator('button')
              .filter({ hasText: /Submit Answer/i })
              .first()
              .click({ timeout: 1500 })
              .catch(() => {});
          }
          continue;
        }
        const controls: Locator[] = [
          page
            .locator('button')
            .filter({ hasText: /Reveal Answer/i })
            .first(),
          page
            .locator('button')
            .filter({ hasText: /Eliminate \(Looks Fishy\)/i })
            .first(),
          page
            .locator('button')
            .filter({ hasText: /Bank Points & End Round/i })
            .first(),
        ];
        for (const control of controls) {
          if (await control.isVisible({ timeout: 150 }).catch(() => false)) {
            await control.click({ timeout: 1500 }).catch(() => {});
            break;
          }
        }
      }
      await p1.waitForTimeout(800);
    }

    await expect(p1.getByText(/Round Over/i).first()).toBeVisible({ timeout: 15000 });

    await Promise.all(contexts.map((c) => c.close()));
  });

  test('can create room and see lobby', async ({ page }) => {
    await createRoom(page, 'FishTest', 'Sounds Fishy');
    await expect(page.getByText('FishTest').first()).toBeVisible();
  });
});
