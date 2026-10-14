import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Coup / Golden Sand House Experience (TASK-CP-001)', () => {
  test('unified action area, cost/claim preview, target selection, folded panels, and viewport responsiveness', async ({
    browser,
  }) => {
    const p1Ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p3Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();

    const roomCode = await createRoom(p1, 'Player1', 'Golden Sand House');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Player2');
    await joinRoom(p3, origin, roomCode, 'Player3');

    await expect(p1.getByText('Player2')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('Player3')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    // Host starts game
    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Verify all players see the playing phase
    await expect(p1.getByText(/Golden Sand House — Inheritance feud/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(p2.getByText(/Golden Sand House — Inheritance feud/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(p3.getByText(/Golden Sand House — Inheritance feud/i)).toBeVisible({
      timeout: 10000,
    });

    // 1. Folded Disclosures: Role explanations and Action history are collapsed by default
    for (const page of [p1, p2, p3]) {
      const roleDetails = page.locator('details[data-testid="coup-role-explanations"]');
      await expect(roleDetails).toBeVisible();
      // Collapsed by default (open attribute is not present)
      await expect(roleDetails).not.toHaveAttribute('open', '');

      const historyDetails = page.locator('details[data-testid="coup-action-history"]');
      await expect(historyDetails).toBeVisible();
      await expect(historyDetails).not.toHaveAttribute('open', '');

      // Can be opened by clicking summary
      await roleDetails.locator('summary').click();
      await expect(roleDetails).toHaveAttribute('open', '');
      await expect(page.getByText(/The Matriarch|คุณหญิงแม่/i).first()).toBeVisible();
      // Close it again
      await roleDetails.locator('summary').click();
      await expect(roleDetails).not.toHaveAttribute('open', '');
    }

    // 2. Secret role privacy: opponent unrevealed cards are masked ('?') and not revealed in DOM
    const p1CardText = await p1.locator('.w-6.h-8').allTextContents();
    // Opponent influences contain '?' and not revealed role names
    expect(p1CardText.some((t) => t.trim() === '?')).toBe(true);

    // 3. Find active turn player
    const pages = [p1, p2, p3];
    let activePage = p1;
    await expect
      .poll(
        async () => {
          for (const page of pages) {
            if (
              await page
                .getByText(/Your Turn|ตาของคุณ/i)
                .first()
                .isVisible()
                .catch(() => false)
            ) {
              activePage = page;
              return true;
            }
          }
          return false;
        },
        { timeout: 10000 },
      )
      .toBe(true);

    // 4. Unified Action Area & Previews on active player's screen
    const actionArea = activePage.locator('[data-testid="coup-action-area"]');
    await expect(actionArea).toBeVisible();

    // Check action preview summaries
    const incomeSummary = actionArea.locator('[data-testid="coup-action-summary-income"]');
    await expect(incomeSummary).toBeVisible();
    await expect(incomeSummary).toContainText(/Cost: 0|ค่าใช้จ่าย: 0/);
    await expect(incomeSummary).toContainText(/Claims: None|อ้างบทบาท: ไม่มี/);

    const taxSummary = actionArea.locator('[data-testid="coup-action-summary-tax"]');
    await expect(taxSummary).toBeVisible();
    await expect(taxSummary).toContainText(/Cost: 0|ค่าใช้จ่าย: 0/);
    await expect(taxSummary).toContainText(/Claims: The Matriarch|อ้างบทบาท: คุณหญิงแม่/);

    const assassinateSummary = actionArea.locator(
      '[data-testid="coup-action-summary-assassinate"]',
    );
    await expect(assassinateSummary).toBeVisible();
    await expect(assassinateSummary).toContainText(/Cost: 3|ค่าใช้จ่าย: 3/);
    await expect(assassinateSummary).toContainText(
      /Claims: The Fiery Heiress|อ้างบทบาท: คุณหนูขี้วีน/,
    );
    await expect(assassinateSummary).toContainText(/Target: None|เป้าหมาย: ไม่มี/);

    // 5. Target selection updates summary in the same unified visual area
    const assassinateSelect = actionArea.locator('select').nth(0);
    // Select first alive target
    await assassinateSelect.selectOption({ index: 1 });
    const selectedTargetText = await assassinateSelect.locator('option').nth(1).textContent();
    expect(selectedTargetText).toBeTruthy();
    await expect(assassinateSummary).toContainText(selectedTargetText!.trim());

    // 6. 360px viewport responsiveness: Check no horizontal overflow on 360px page
    const scrollWidth = await p1.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await p1.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // 7. Active player performs Income action
    const incomeBtn = activePage.getByRole('button', { name: /Polish stairs/i });
    await expect(incomeBtn).toBeEnabled({ timeout: 5000 });
    await incomeBtn.click();

    // Coins increase from 2 to 3
    await expect(activePage.getByText(/3 💰/).first()).toBeVisible({ timeout: 8000 });

    // Action history records the income action
    const historyDetails = activePage.locator('details[data-testid="coup-action-history"]');
    await historyDetails.locator('summary').click();
    await expect(historyDetails).toHaveAttribute('open', '');
    await expect(historyDetails).toContainText(/Polish stairs|ขัดบันได/);

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('response countdown, responder permissions, and exchange state protection (TASK-CP-002)', async ({
    browser,
  }) => {
    test.setTimeout(75000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p3Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();

    const roomCode = await createRoom(p1, 'Player1', 'Golden Sand House');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Player2');
    await joinRoom(p3, origin, roomCode, 'Player3');

    await expect(p1.getByText('Player2')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('Player3')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    await expect(p1.getByText(/Golden Sand House — Inheritance feud/i)).toBeVisible({
      timeout: 10000,
    });

    const pages = [p1, p2, p3];
    const findActive = async () => {
      let activeIdx = -1;
      await expect
        .poll(
          async () => {
            for (let i = 0; i < pages.length; i++) {
              if (
                await pages[i]
                  .getByText(/Your Turn|ตาของคุณ/i)
                  .first()
                  .isVisible()
                  .catch(() => false)
              ) {
                activeIdx = i;
                return true;
              }
            }
            return false;
          },
          { timeout: 10000 },
        )
        .toBe(true);
      return activeIdx;
    };

    // 1. Turn 1: Active player declares Foreign Aid (Ask garden house)
    let activeIdx = await findActive();
    const turn1Active = pages[activeIdx];
    const turn1Others = pages.filter((_, i) => i !== activeIdx);
    const responder1 = turn1Others[0];
    const responder2 = turn1Others[1];

    const foreignAidBtn = turn1Active.getByRole('button', {
      name: /Ask garden house|ขอเงินบ้านสวน/i,
    });
    await expect(foreignAidBtn).toBeEnabled({ timeout: 5000 });
    await foreignAidBtn.click();

    // 2. Countdown badge and eligible responders check in AWAITING_BLOCK
    for (const page of pages) {
      const countdown = page.locator('[data-testid="coup-countdown"]');
      await expect(countdown).toBeVisible({ timeout: 5000 });
      await expect(countdown).toContainText(/remaining|วินาที/i);

      const eligible = page.locator('[data-testid="coup-eligible-responders"]');
      await expect(eligible).toBeVisible();
      await expect(eligible).toContainText(/Any guest can block|แขกทุกคนในคฤหาสน์สามารถขวางได้/i);
    }

    // 3. Responder1 blocks Foreign Aid -> enters AWAITING_CHALLENGE for the block
    const blockBtn = responder1.locator('[data-testid="coup-block-button"]');
    await expect(blockBtn).toBeVisible({ timeout: 5000 });
    await blockBtn.click();

    // In AWAITING_CHALLENGE for the block:
    // Blocker (responder1) sees waiting text, others see challenge block button
    await expect(
      responder1.locator('[data-testid="coup-challenge-block-button"]'),
    ).not.toBeVisible();
    await expect(turn1Active.locator('[data-testid="coup-challenge-block-button"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(responder2.locator('[data-testid="coup-challenge-block-button"]')).toBeVisible({
      timeout: 5000,
    });

    const blockChallengeKind = turn1Active.locator('[data-testid="coup-challenge-kind"]');
    await expect(blockChallengeKind).toBeVisible();
    await expect(blockChallengeKind).toContainText(/Block Challenge|ท้าทายการยืนขวาง/i);

    const blockEligible = turn1Active.locator('[data-testid="coup-eligible-responders"]');
    await expect(blockEligible).toContainText(/Eligible to challenge block|ผู้มีสิทธิ์ท้าคนขวาง/i);

    // Turn 1 active player challenges the block!
    await turn1Active.locator('[data-testid="coup-challenge-block-button"]').click();

    // Challenge resolves immediately -> back to PLAYING phase
    await expect(turn1Active.locator('[data-testid="coup-countdown"]')).not.toBeVisible({
      timeout: 8000,
    });

    // Verify hidden and revealed influence cards
    const hiddenCards = turn1Active.locator('[data-testid="coup-card-hidden"]');
    await expect(hiddenCards.first()).toBeVisible();
    await expect(hiddenCards.first()).toHaveAttribute('aria-label', 'Hidden influence');
    const revealedCards = turn1Active.locator('[data-testid="coup-card-revealed"]');
    await expect(revealedCards.first()).toBeVisible();
    await expect(revealedCards.first()).toHaveAttribute('aria-label', /Revealed:/);

    // 4. Turn 2: New active player takes Exchange (Switch the wills)
    activeIdx = await findActive();
    const turn2Active = pages[activeIdx];

    const exchangeBtn = turn2Active.getByRole('button', {
      name: /Switch the wills|สลับพินัยกรรม/i,
    });
    await expect(exchangeBtn).toBeEnabled({ timeout: 5000 });
    await exchangeBtn.click();

    // In AWAITING_CHALLENGE for Exchange: countdown, badge & eligible challengers visible
    const exchangeCountdown = turn2Active.locator('[data-testid="coup-countdown"]');
    await expect(exchangeCountdown).toBeVisible({ timeout: 5000 });
    const actionChallengeKind = turn2Active.locator('[data-testid="coup-challenge-kind"]');
    await expect(actionChallengeKind).toBeVisible();
    await expect(actionChallengeKind).toContainText(/Action Challenge|ท้าทายการกระทำ/i);
    const exchangeEligible = turn2Active.locator('[data-testid="coup-eligible-responders"]');
    await expect(exchangeEligible).toContainText(/Eligible to challenge:|ผู้มีสิทธิ์ท้าทาย:/i);

    // Wait for challenge window to timeout (~7s) into AWAITING_EXCHANGE
    const exchangeCountIndicator = turn2Active.locator(
      '[data-testid="coup-exchange-selected-count"]',
    );
    await expect(exchangeCountIndicator).toBeVisible({ timeout: 12000 });
    await expect(exchangeCountIndicator).toContainText(/Selected: 0 \/|เลือกแล้ว: 0 \//i);

    // Submit button is disabled when not enough cards selected
    const submitExchange = turn2Active.locator('[data-testid="coup-exchange-submit"]');
    await expect(submitExchange).toBeDisabled();

    // 5. Test keyboard accessibility & selection
    const card0 = turn2Active.locator('[data-testid="coup-exchange-card-0"]');
    await expect(card0).toHaveAttribute('aria-pressed', 'false');
    await card0.focus();
    await turn2Active.keyboard.press('Space');
    await expect(card0).toHaveAttribute('aria-pressed', 'true');
    await expect(exchangeCountIndicator).toContainText(/1 \//);

    const countText = await exchangeCountIndicator.textContent();
    const isTotal2 = countText?.includes('/ 2');
    if (isTotal2) {
      const card1 = turn2Active.locator('[data-testid="coup-exchange-card-1"]');
      await expect(card1).toHaveAttribute('aria-pressed', 'false');
      await card1.focus();
      await turn2Active.keyboard.press('Enter');
      await expect(card1).toHaveAttribute('aria-pressed', 'true');
    } else {
      // Test Enter key toggle
      await card0.focus();
      await turn2Active.keyboard.press('Enter');
      await expect(card0).toHaveAttribute('aria-pressed', 'false');
      await turn2Active.keyboard.press('Space');
      await expect(card0).toHaveAttribute('aria-pressed', 'true');
    }

    // Count is met -> submit is enabled
    await expect(submitExchange).toBeEnabled();

    // Clicking submit submits the exchange and returns to PLAYING
    await submitExchange.click();
    await expect(exchangeCountIndicator).not.toBeVisible({ timeout: 8000 });

    // 6. Turn 3: Test Steal target-only block permission display
    activeIdx = await findActive();
    const turn3Active = pages[activeIdx];
    const turn3ActionArea = turn3Active.locator('[data-testid="coup-action-area"]');
    const stealSelect = turn3ActionArea.locator('select').nth(1);
    await stealSelect.selectOption({ index: 1 });
    const targetName = (await stealSelect.locator('option').nth(1).textContent())?.trim();
    const pageByName: Record<string, typeof p1> = {
      Player1: p1,
      Player2: p2,
      Player3: p3,
    };
    const targetPage = pageByName[targetName!];
    const thirdPartyPage = pages.find((p) => p !== turn3Active && p !== targetPage)!;

    const stealBtn = turn3Active.getByRole('button', { name: /Demand allowance|ไถเบี้ยเลี้ยง/i });
    await expect(stealBtn).toBeEnabled({ timeout: 5000 });
    await stealBtn.click();

    // Wait for Steal challenge window to timeout into AWAITING_BLOCK (~7s)
    await expect(thirdPartyPage.locator('[data-testid="coup-eligible-responders"]')).toContainText(
      /Only .* can block|เฉพาะ .* เท่านั้นที่ยืนขวางได้/i,
      { timeout: 12000 },
    );
    // Third-party guest cannot block
    await expect(thirdPartyPage.locator('[data-testid="coup-block-captain"]')).not.toBeVisible();
    await expect(thirdPartyPage.locator('[data-testid="coup-block-ambassador"]')).not.toBeVisible();

    // Target player can block as Captain or Ambassador
    await expect(targetPage.locator('[data-testid="coup-block-captain"]')).toBeVisible();
    await expect(targetPage.locator('[data-testid="coup-block-ambassador"]')).toBeVisible();

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('mandatory coup explanation banner, play-to-conclusion, and result rematch hostguard (TASK-CP-003)', async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p3Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();
    const p3 = await p3Ctx.newPage();

    const roomCode = await createRoom(p1, 'HostP1', 'Golden Sand House');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'GuestP2');
    await joinRoom(p3, origin, roomCode, 'GuestP3');

    await expect(p1.getByText('GuestP2')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('GuestP3')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    await expect(p1.getByText(/Golden Sand House — Inheritance feud/i)).toBeVisible({
      timeout: 10000,
    });

    const pages = [p1, p2, p3];
    const findActive = async () => {
      let activeIdx = -1;
      await expect
        .poll(
          async () => {
            for (let i = 0; i < pages.length; i++) {
              if (
                await pages[i]
                  .getByText(/Your Turn|ตาของคุณ/i)
                  .first()
                  .isVisible()
                  .catch(() => false)
              ) {
                activeIdx = i;
                return true;
              }
            }
            return false;
          },
          { timeout: 10000 },
        )
        .toBe(true);
      return activeIdx;
    };

    // 1. Fast Income cycles until someone reaches 10+ coins
    for (let r = 0; r < 35; r++) {
      const activeIdx = await findActive();
      const activePage = pages[activeIdx];
      const mandatoryBanner = activePage.locator('[data-testid="coup-mandatory-banner"]');
      if (await mandatoryBanner.isVisible().catch(() => false)) {
        break;
      }
      const incomeBtn = activePage.getByRole('button', { name: /Polish stairs/i });
      if (await incomeBtn.isEnabled().catch(() => false)) {
        await incomeBtn.click();
        await activePage.waitForTimeout(150);
      }
    }

    // 2. Active player now has 10 coins -> verify mandatory coup explanation banner
    const activeIdx = await findActive();
    const activePage = pages[activeIdx];
    const mandatoryBanner = activePage.locator('[data-testid="coup-mandatory-banner"]');
    await expect(mandatoryBanner).toBeVisible({ timeout: 5000 });
    await expect(mandatoryBanner).toContainText(
      /With 10 or more coins, you must reveal the real will|มีเหรียญตั้งแต่ 10 ต้องกางพินัยกรรมตัวจริง/i,
    );

    // Verify non-coup actions are disabled by forced coup
    const incomeBtn = activePage.getByRole('button', { name: /Polish stairs/i });
    await expect(incomeBtn).toBeDisabled();

    // 3. Perform Coup
    const actionArea = activePage.locator('[data-testid="coup-action-area"]');
    const coupSelect = actionArea.locator('select').last();
    await coupSelect.selectOption({ index: 1 });
    const coupBtn = activePage.getByRole('button', { name: /Reveal the real will/i });
    await expect(coupBtn).toBeEnabled({ timeout: 5000 });
    await coupBtn.click();

    // Coup executes immediately (-7 coins, target loses influence)
    await activePage.waitForTimeout(1000);
    const revealedCards = activePage.locator('[data-testid="coup-card-revealed"]');
    await expect(revealedCards.first()).toBeVisible({ timeout: 5000 });

    // 4. Eliminate remaining rivals purely via instant Income + Coup (no 7s challenge timers)
    for (let round = 0; round < 60; round++) {
      if (
        await p1
          .locator('[data-testid="coup-winner-banner"]')
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
      const curIdx = await findActive();
      const curPage = pages[curIdx];

      const cSelect = curPage.locator('[data-testid="coup-action-area"] select').last();
      const hasTarget = await cSelect
        .locator('option')
        .count()
        .then((c) => c > 1)
        .catch(() => false);
      if (hasTarget) {
        await cSelect.selectOption({ index: 1 }).catch(() => {});
      }
      const cBtn = curPage.getByRole('button', { name: /Reveal the real will/i });
      if (await cBtn.isEnabled().catch(() => false)) {
        await cBtn.click().catch(() => {});
        await curPage.waitForTimeout(150);
      } else {
        const inBtn = curPage.getByRole('button', { name: /Polish stairs/i });
        if (await inBtn.isEnabled().catch(() => false)) {
          await inBtn.click().catch(() => {});
          await curPage.waitForTimeout(150);
        }
      }
    }

    // 5. Verify game reached conclusion and test rematch host guard
    await expect(p1.locator('[data-testid="coup-winner-banner"]')).toBeVisible({ timeout: 10000 });
    // Host sees rematch button
    await expect(p1.locator('[data-testid="coup-rematch-button"]')).toBeVisible();
    // Guest sees waiting for host message and no rematch button
    await expect(p2.locator('[data-testid="coup-waiting-host"]')).toBeVisible();
    await expect(p2.locator('[data-testid="coup-rematch-button"]')).not.toBeVisible();

    // Host clicks rematch -> resets room to Lobby
    await p1.locator('[data-testid="coup-rematch-button"]').click();
    await expect(p1.getByText(/Start Game|เริ่มเกม/i)).toBeVisible({ timeout: 8000 });
    await expect(p2.getByText(/Waiting for Room Host|รอเจ้าของห้องเริ่มเกม/i)).toBeVisible({
      timeout: 8000,
    });

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });
});
