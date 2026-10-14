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
});
