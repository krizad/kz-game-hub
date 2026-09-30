import { test, expect, type Page } from '@playwright/test';
import { createRoom, joinRoom, getOrigin, waitForAnyVisible } from './helpers';

/**
 * Detective Club: hard assertions at the deterministic gates (roles assigned,
 * word submitted, both playing rounds, voting, scoring). Roles are
 * server-random, so scoring asserts the phase controls, never an outcome.
 */
test.describe('Detective Club Gameplay', () => {
  test('three players play through to the scoring phase', async ({ browser }) => {
    test.setTimeout(180000);
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));
    const pages: Page[] = [p1, p2, p3];

    const roomCode = await createRoom(p1, 'DetHost', 'Detective Club');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'D1');
    await joinRoom(p3, origin, roomCode, 'D2');

    for (const name of ['D1', 'D2']) {
      await expect(p1.getByText(name).first()).toBeVisible({ timeout: 10000 });
    }

    // Start — hard: the lobby must hand over to the role/setup view
    const startBtn = p1.getByText('Start Game');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
    await expect(p1.getByText(/Your Role|Setup Phase/i).first()).toBeVisible({ timeout: 15000 });

    // Informer submits the secret word (whichever page holds the input)
    const wordInputs = pages.map((p) => p.locator('input#wordInput'));
    const wordInput = await waitForAnyVisible(wordInputs, 20000);
    expect(wordInput, 'the informer should see the word input').not.toBeNull();
    await wordInput!.fill('Mystery');
    await wordInput!
      .page()
      .locator('button')
      .filter({ hasText: /Confirm|Submit/i })
      .first()
      .click();

    // Drive both playing rounds, discussion, and voting like the sim driver:
    // force-click a hand card on the active player, confirm, start the vote,
    // pick a candidate and confirm. Scoring is the guaranteed end state.
    for (let i = 0; i < 60; i++) {
      const scoringBtn = p1
        .locator('button')
        .filter({ hasText: /Play Next Round|End Game/i })
        .first();
      if (await scoringBtn.isVisible({ timeout: 300 }).catch(() => false)) break;
      for (const page of pages) {
        const myTurn = await page
          .getByText(/Your Turn - Play a Card/i)
          .isVisible({ timeout: 150 })
          .catch(() => false);
        const hand = page.locator('img[alt="Hand Card"]').first();
        if (myTurn && (await hand.isVisible({ timeout: 150 }).catch(() => false))) {
          // force click: the hover overlay covers the img and blocks
          // actionability, but still fires the overlay's onClick
          await hand.click({ force: true, timeout: 2000 }).catch(() => {});
          const confirm = page
            .locator('button')
            .filter({ hasText: /^Play Card$/i })
            .last();
          if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) {
            await confirm.click({ timeout: 1500 }).catch(() => {});
          }
          continue;
        }
        const startVoting = page
          .locator('button')
          .filter({ hasText: /Start Voting/i })
          .first();
        if (await startVoting.isVisible({ timeout: 150 }).catch(() => false)) {
          await startVoting.click({ timeout: 1500 }).catch(() => {});
          continue;
        }
        const candidate = page
          .locator('button')
          .filter({ hasText: /DetHost|D1|D2/ })
          .first();
        if (await candidate.isVisible({ timeout: 150 }).catch(() => false)) {
          await candidate.click({ timeout: 1500 }).catch(() => {});
        }
        const confirmVote = page
          .locator('button')
          .filter({ hasText: /Confirm Vote/i })
          .first();
        if (await confirmVote.isVisible({ timeout: 150 }).catch(() => false)) {
          await confirmVote.click({ timeout: 1500 }).catch(() => {});
        }
      }
      await p1.waitForTimeout(800);
    }

    // Scoring reached — the deterministic completion for a random-role round
    await expect(
      p1
        .locator('button')
        .filter({ hasText: /Play Next Round|End Game/i })
        .first(),
    ).toBeVisible({ timeout: 15000 });

    await Promise.all(contexts.map((c) => c.close()));
  });

  test('can create room and see lobby', async ({ page }) => {
    await createRoom(page, 'DetTest', 'Detective Club');
    await expect(page.getByText('DetTest').first()).toBeVisible();
  });
});
