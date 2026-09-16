import { test, expect } from '@playwright/test';
import { createRoom } from './helpers';

test.describe('Tic-Tac-Toe Play vs Bot', () => {
  test('host can toggle vs Bot, choose God mode, and play as X (Bot plays optimal defense/offense)', async ({
    page,
  }) => {
    await createRoom(page, 'Alice', 'Classic Tic Tac Toe');
    await page.waitForTimeout(2000);

    // Verify opponent selector is visible
    const botToggleBtn = page.locator('[data-testid="ttt-opponent-bot"]');
    await expect(botToggleBtn).toBeVisible({ timeout: 5000 });

    // Click to enable vs Bot
    await botToggleBtn.click();
    await page.waitForTimeout(500);

    // Difficulty buttons should be visible
    const godBtn = page.locator('[data-testid="ttt-diff-god"]');
    const easyBtn = page.locator('[data-testid="ttt-diff-easy"]');
    await expect(godBtn).toBeVisible();
    await expect(easyBtn).toBeVisible();

    // Select God Mode
    await godBtn.click();
    await page.waitForTimeout(500);

    // Join as X
    const joinXBtn = page.locator('[data-testid="ttt-join-x"]');
    await expect(joinXBtn).toBeVisible();
    await joinXBtn.click();
    await page.waitForTimeout(1000);

    // Game should now be in PLAYING status
    const cells = page.locator('div.grid.grid-cols-3 button');
    await expect(cells).toHaveCount(9);

    // Alice places X at center (cell 4)
    await cells.nth(4).click();
    await page.waitForTimeout(800);

    // Bot should have immediately responded as O
    const cellsText = await cells.allInnerTexts();
    const xCount = cellsText.filter((t) => t.trim() === 'X').length;
    const oCount = cellsText.filter((t) => t.trim() === 'O').length;

    expect(xCount).toBe(1);
    expect(oCount).toBe(1);

    // Alice makes second move at cell 0 (corner)
    if (cellsText[0].trim() === '') {
      await cells.nth(0).click();
      await page.waitForTimeout(800);
    } else {
      await cells.nth(1).click();
      await page.waitForTimeout(800);
    }

    // Play until game ends
    for (let i = 0; i < 9; i++) {
      const isResultVisible = await page
        .locator('button:has-text("Play Again"), button:has-text("เล่นอีกครั้ง")')
        .isVisible()
        .catch(() => false);
      if (isResultVisible) break;

      const currentBoard = await cells.allInnerTexts();
      const emptyIndices = currentBoard
        .map((val, idx) => (val.trim() === '' ? idx : null))
        .filter((val): val is number => val !== null);

      if (emptyIndices.length > 0) {
        // Human attempts to play on the first available cell
        await cells
          .nth(emptyIndices[0])
          .click()
          .catch(() => {});
        await page.waitForTimeout(600);
      }
    }

    // Game should reach result
    const playAgainBtn = page.locator(
      'button:has-text("Play Again"), button:has-text("เล่นอีกครั้ง")',
    );
    await expect(playAgainBtn).toBeVisible({ timeout: 5000 });

    // God Mode bot must never lose: winner is either O (Bot) or DRAW
    const resultText = await page.locator('div.font-mono').innerText();
    expect(resultText).not.toMatch(/X (Wins|ชนะ)/);
  });

  test('host can join as O and Bot plays first move as X immediately', async ({ page }) => {
    await createRoom(page, 'Bob', 'Classic Tic Tac Toe');
    await page.waitForTimeout(2000);

    // Toggle vs Bot
    await page.locator('[data-testid="ttt-opponent-bot"]').click();
    await page.waitForTimeout(500);

    // Join as O
    const joinOBtn = page.locator('[data-testid="ttt-join-o"]');
    await expect(joinOBtn).toBeVisible();
    await joinOBtn.click();
    await page.waitForTimeout(1000);

    // Game is PLAYING and Bot (X) went first
    const cells = page.locator('div.grid.grid-cols-3 button');
    const cellsText = await cells.allInnerTexts();
    const xCount = cellsText.filter((t) => t.trim() === 'X').length;

    // Bot has already placed exactly 1 'X'
    expect(xCount).toBe(1);
  });

  test('host can choose Easy Mode and play against random bot', async ({ page }) => {
    await createRoom(page, 'Charlie', 'Classic Tic Tac Toe');
    await page.waitForTimeout(2000);

    // Toggle vs Bot
    await page.locator('[data-testid="ttt-opponent-bot"]').click();
    await page.waitForTimeout(500);

    // Select Easy Mode
    await page.locator('[data-testid="ttt-diff-easy"]').click();
    await page.waitForTimeout(500);

    // Join as X
    await page.locator('[data-testid="ttt-join-x"]').click();
    await page.waitForTimeout(1000);

    const cells = page.locator('div.grid.grid-cols-3 button');
    await cells.nth(0).click();
    await page.waitForTimeout(800);

    // Bot responded with random move
    const cellsText = await cells.allInnerTexts();
    const oCount = cellsText.filter((t) => t.trim() === 'O').length;
    expect(oCount).toBe(1);
  });
});
