import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';
import { applyLobbyConfig } from './sim/play';

test.describe('The Mind Experience Suite', () => {
  test('readiness clarity, lives/stars counts, extreme piles, and hidden teammate hand numbers (TASK-TM-001)', async ({
    browser,
  }) => {
    test.setTimeout(60000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostAlice', 'Countaline');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await expect(p1.getByText('GuestBob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(500);

    // Configure Extreme mode in lobby
    await applyLobbyConfig(p1, ['the-mind-extreme']);

    // Host starts the game
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // 1. SETUP phase: Check lives and shurikens counts
    const p1Lives = p1.locator('[data-testid="the-mind-lives"]').first();
    const p1Shurikens = p1.locator('[data-testid="the-mind-shurikens"]').first();
    await expect(p1Lives).toBeVisible({ timeout: 5000 });
    await expect(p1Shurikens).toBeVisible({ timeout: 5000 });
    await expect(p1Lives).toContainText('2'); // 2 lives for 2 players
    await expect(p1Shurikens).toContainText('1'); // 1 starting shuriken

    // 2. Bob (P2) clicks Ready, but Alice (P1) does not click Ready yet
    const p2ReadyBtn = p2.locator('[data-testid="the-mind-ready-btn"]');
    await expect(p2ReadyBtn).toBeVisible({ timeout: 5000 });
    await p2ReadyBtn.click();

    // Bob now sees ready status and unready players banner showing Alice
    const p2ReadyStatus = p2.locator('[data-testid="the-mind-ready-status"]');
    await expect(p2ReadyStatus).toBeVisible({ timeout: 5000 });
    const p2UnreadyPlayers = p2.locator('[data-testid="the-mind-unready-players"]');
    await expect(p2UnreadyPlayers).toBeVisible({ timeout: 5000 });
    await expect(p2UnreadyPlayers).toContainText('HostAlice');

    // 3. Alice clicks Ready -> Game transitions to PLAYING phase
    const p1ReadyBtn = p1.locator('[data-testid="the-mind-ready-btn"]');
    await expect(p1ReadyBtn).toBeVisible({ timeout: 5000 });
    await p1ReadyBtn.click();

    // 4. In PLAYING phase: Check Extreme piles
    const upPile = p1.locator('[data-testid="the-mind-pile-up"]');
    const downPile = p1.locator('[data-testid="the-mind-pile-down"]');
    await expect(upPile).toBeVisible({ timeout: 5000 });
    await expect(downPile).toBeVisible({ timeout: 5000 });

    // Verify pile labels (Ascending / Descending)
    await expect(upPile).toContainText(/UP|ขึ้น/i);
    await expect(downPile).toContainText(/DOWN|ลง/i);

    // 5. Teammates card count: Alice sees Bob's card count (1 card) but NEVER Bob's secret hand numbers
    const teammates = p1.locator('[data-testid="the-mind-teammates"]');
    await expect(teammates).toBeVisible({ timeout: 5000 });
    await expect(teammates).toContainText('GuestBob');
    const teammateHandCount = p1.locator('[data-testid="the-mind-teammate-hand-count"]').first();
    await expect(teammateHandCount).toBeVisible();
    await expect(teammateHandCount).toHaveText('1');

    // Get Bob's own card number from Bob's screen
    const bobCard = (
      await p2.locator('[data-testid="the-mind-hand-card"]').first().innerText()
    ).trim();
    expect(bobCard.length).toBeGreaterThan(0);

    // Ensure Bob's secret card number is NOT rendered in Alice's teammates section
    const teammatesText = await teammates.innerText();
    expect(teammatesText).not.toContain(`[${bobCard}]`);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('blind mode skip reveal immediately displays all revealed cards without waiting for timer (TASK-TM-002)', async ({
    browser,
  }) => {
    test.setTimeout(60000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostAlice', 'Countaline');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await expect(p1.getByText('GuestBob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(500);

    // Apply blind mode and 2 max levels
    await applyLobbyConfig(p1, ['the-mind-blind', 'the-mind-maxlevel:2']);

    // Host starts game
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Both players click Ready in SETUP
    await p1.locator('[data-testid="the-mind-ready-btn"]').click({ timeout: 5000 });
    await p2.locator('[data-testid="the-mind-ready-btn"]').click({ timeout: 5000 });

    // PLAYING phase: Both players play their dealt cards into the blind pile
    const p1Hand = p1.locator('[data-testid="the-mind-hand-card"]').first();
    await expect(p1Hand).toBeVisible({ timeout: 5000 });
    await p1Hand.click();

    const p2Hand = p2.locator('[data-testid="the-mind-hand-card"]').first();
    await expect(p2Hand).toBeVisible({ timeout: 5000 });
    await p2Hand.click();

    // In blind mode, after PLAYING completes (2s transition delay), blind reveal appears
    const blindReveal = p1.locator('[data-testid="the-mind-blind-reveal"]');
    await expect(blindReveal).toBeVisible({ timeout: 8000 });

    // Verify Skip Reveal button is visible
    const skipBtn = p1.locator('[data-testid="the-mind-skip-reveal-btn"]');
    await expect(skipBtn).toBeVisible({ timeout: 3000 });

    // Click Skip Reveal
    await skipBtn.click();

    // All revealed cards immediately display numbers and the skip button is gone
    await expect(skipBtn).not.toBeVisible({ timeout: 2000 });
    const revealedCards = p1.locator('[data-testid="the-mind-revealed-card"]');
    await expect(revealedCards).toHaveCount(2);

    // Check that cards show actual numbers (not '?')
    const firstCardText = await revealedCards.first().innerText();
    expect(firstCardText).not.toContain('?');
    const secondCardText = await revealedCards.nth(1).innerText();
    expect(secondCardText).not.toContain('?');

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('shuriken proposal, voter tracking, rejection resume, and host next-level guard (TASK-TM-003)', async ({
    browser,
  }) => {
    test.setTimeout(60000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostAlice', 'Countaline');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestBob');

    await expect(p1.getByText('GuestBob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(500);

    // Host starts game
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Both players click Ready
    await p1.locator('[data-testid="the-mind-ready-btn"]').click({ timeout: 5000 });
    await p2.locator('[data-testid="the-mind-ready-btn"]').click({ timeout: 5000 });

    // Wait for PLAYING phase
    const shurikenBtnP1 = p1.locator('[data-testid="the-mind-use-shuriken-btn"]');
    await expect(shurikenBtnP1).toBeVisible({ timeout: 5000 });

    // 1. Propose Shuriken
    await shurikenBtnP1.click();

    // Dialog appears on both screens
    const dialogP1 = p1.locator('[data-testid="the-mind-shuriken-vote-dialog"]');
    const dialogP2 = p2.locator('[data-testid="the-mind-shuriken-vote-dialog"]');
    await expect(dialogP1).toBeVisible({ timeout: 3000 });
    await expect(dialogP2).toBeVisible({ timeout: 3000 });

    // Alice is proposer, sees pending voters banner with Bob's name
    const pendingVoters = p1.locator('[data-testid="the-mind-pending-voters"]');
    await expect(pendingVoters).toBeVisible();
    await expect(pendingVoters).toContainText('GuestBob');

    // Alice also sees cancel proposal button
    const cancelBtn = p1.locator('[data-testid="the-mind-cancel-shuriken-btn"]');
    await expect(cancelBtn).toBeVisible();

    // Bob sees Agree and Disagree buttons
    const agreeBtn = p2.locator('[data-testid="the-mind-vote-agree-btn"]');
    const disagreeBtn = p2.locator('[data-testid="the-mind-vote-disagree-btn"]');
    await expect(agreeBtn).toBeVisible();
    await expect(disagreeBtn).toBeVisible();

    // 2. Bob votes Disagree -> Proposal is rejected, dialog closes, returns to PLAYING
    await disagreeBtn.click();
    await expect(dialogP1).not.toBeVisible({ timeout: 3000 });
    await expect(dialogP2).not.toBeVisible({ timeout: 3000 });

    // Shuriken count is still 1
    const p1Shurikens = p1.locator('[data-testid="the-mind-shurikens"]').first();
    await expect(p1Shurikens).toContainText('1');

    // 3. Propose again and cancel via cancel button
    await shurikenBtnP1.click();
    await expect(dialogP1).toBeVisible({ timeout: 3000 });
    await cancelBtn.click();
    await expect(dialogP1).not.toBeVisible({ timeout: 3000 });

    // 4. Play remaining cards to complete the level
    // Get card values and play lowest first
    const p1CardVal = parseInt(
      (await p1.locator('[data-testid="the-mind-hand-card"]').innerText()).trim(),
      10,
    );
    const p2CardVal = parseInt(
      (await p2.locator('[data-testid="the-mind-hand-card"]').innerText()).trim(),
      10,
    );

    if (p1CardVal < p2CardVal) {
      await p1.locator('[data-testid="the-mind-hand-card"]').click();
      await p1.waitForTimeout(400);
      await p2.locator('[data-testid="the-mind-hand-card"]').click();
    } else {
      await p2.locator('[data-testid="the-mind-hand-card"]').click();
      await p1.waitForTimeout(400);
      await p1.locator('[data-testid="the-mind-hand-card"]').click();
    }

    // Wait for level result screen
    const levelResultP1 = p1.locator('[data-testid="the-mind-level-result"]');
    await expect(levelResultP1).toBeVisible({ timeout: 8000 });

    // Alice (host) sees next level button
    const nextLevelBtn = p1.locator('[data-testid="the-mind-next-level-btn"]');
    await expect(nextLevelBtn).toBeVisible();

    // Bob (guest) sees waiting for host message
    const waitingHostP2 = p2.locator('[data-testid="the-mind-waiting-host"]');
    await expect(waitingHostP2).toBeVisible();

    // Alice clicks next level -> both enter SETUP for level 2
    await nextLevelBtn.click();
    await expect(p1.locator('[data-testid="the-mind-ready-btn"]')).toBeVisible({ timeout: 5000 });
    await expect(p2.locator('[data-testid="the-mind-ready-btn"]')).toBeVisible({ timeout: 5000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
