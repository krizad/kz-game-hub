import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

/**
 * Full Game Demos — every demo plays its match to the REAL end state:
 * - Tic-Tac-Toe / Gobbler: victory banner for both players
 * - Hand Duel (RPS): best-of-3 played until "Wins the Match!"
 * - Who Am I: words collected -> guess -> RESULT verification -> Game Over reveal
 * - Who First: all configured rounds played -> Final Result
 * - Who Know: full insider round with real voting -> Game Results
 * - Sounds Fishy: answers -> eliminate -> Bank Points & End Round -> Round Over
 * - The Mind: Max Level 2 configured, cards played in ascending order -> You Win!
 * - Detective Club: word -> all cards played -> voting -> Round Over + Scoreboard
 * - Music Trivia: ready -> song -> buzz/answer -> skip -> End Game -> Game Over!
 * - Saboteur: 3 miners dig to the gold -> gold pick -> all 3 rounds -> Game Over
 *
 * SlowMo 600ms keeps the recorded videos human-readable.
 */
test.use({ launchOptions: { slowMo: 400 } });
// 4 minutes timeout per demo
test.setTimeout(240000);

const videoDir = 'test-results/demo-videos';

/**
 * Waits until one of the locators (possibly on DIFFERENT pages) is visible.
 * Locator.or() cannot combine locators across pages.
 */
async function waitForAnyVisible(locators: Locator[], timeoutMs = 10000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (let i = 0; i < locators.length; i++) {
      if (await locators[i].isVisible().catch(() => false)) return i;
    }
    await locators[0].page().waitForTimeout(150);
  } while (Date.now() < deadline);
  throw new Error('None of the locators became visible within timeout');
}

/** Returns the lowest enabled numeric card button value on the page (The Mind). */
async function lowestEnabledCard(page: Page): Promise<number | null> {
  const btns = page.locator('button').filter({ hasText: /^\d+$/ });
  const n = await btns.count();
  let best: number | null = null;
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    if (!(await b.isEnabled().catch(() => false))) continue;
    const v = parseInt((await b.innerText()).trim(), 10);
    if (!Number.isNaN(v) && (best === null || v < best)) best = v;
  }
  return best;
}

test.describe('Full Game Demos', () => {
  // ─── 1. Tic-Tac-Toe ──────────────────────────────────────────────────────
  test('Tic-Tac-Toe Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/tictactoe-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/tictactoe-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Classic Tic Tac Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await p1.waitForTimeout(1500);
    await p1.locator('button:has-text("Join as X")').click();
    await p2.locator('button:has-text("Join as O")').click();
    await p1.waitForTimeout(1000);

    // X wins top row: 0,1,2 / O plays 4,5
    const p1Cells = p1.locator('div.grid.grid-cols-3 button');
    const p2Cells = p2.locator('div.grid.grid-cols-3 button');
    const moves = [
      { page: p1, cells: p1Cells, index: 0 },
      { page: p2, cells: p2Cells, index: 4 },
      { page: p1, cells: p1Cells, index: 1 },
      { page: p2, cells: p2Cells, index: 5 },
      { page: p1, cells: p1Cells, index: 2 }, // X wins
    ];
    for (const move of moves) {
      await move.cells.nth(move.index).waitFor({ state: 'visible', timeout: 10000 });
      await move.cells.nth(move.index).click();
      await move.page.waitForTimeout(500);
    }

    // Match over — winner banner visible to BOTH players
    await expect(p1.getByText(/wins/i).first()).toBeVisible({ timeout: 8000 });
    await expect(p2.getByText(/wins/i).first()).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 2. Hand Duel (RPS) ──────────────────────────────────────────────────
  test('Hand Duel (RPS) Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/rps-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/rps-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Rocky', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Paper');

    // Host starts
    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    if (
      await startBtn
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await startBtn.click();
    }

    // Best of 3 -> first to 2 wins. Paper (P2) takes both rounds.
    // Round 1: Rock vs Paper
    await expect(p1.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 8000 });
    await p1.locator('button', { hasText: '✊' }).click();
    await p2.locator('button', { hasText: '✋' }).click();
    await expect(p1.getByText('Paper Wins the Round!')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Paper Wins the Round!')).toBeVisible({ timeout: 5000 });

    // Host advances to round 2
    const nextRound = p1.getByRole('button', { name: /Next Round/i });
    await expect(nextRound).toBeVisible({ timeout: 5000 });
    await nextRound.click();

    // Round 2: Scissors vs Rock -> match point
    await expect(p2.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 8000 });
    await p1.locator('button', { hasText: '✌️' }).click();
    await p2.locator('button', { hasText: '✊' }).click();

    // Match over — trophy banner on BOTH screens
    await expect(p1.getByText(/Wins the Match!/i)).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText(/Wins the Match!/i)).toBeVisible({ timeout: 5000 });
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 3. Gobbler ──────────────────────────────────────────────────────────
  test('Gobbler Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/gobbler-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/gobbler-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'P1', 'Gobbler Tic Tac Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P2');

    // Wait for players to sync
    await expect(p1.getByText('P2')).toBeVisible({ timeout: 10000 });

    await p1.waitForTimeout(1000);

    const joinX = p1.locator('button', { hasText: /Join X|เข้าร่วม X/i });
    await joinX.waitFor({ state: 'visible', timeout: 10000 });
    await joinX.click();

    const joinO = p2.locator('button', { hasText: /Join O|เข้าร่วม O/i });
    await joinO.waitFor({ state: 'visible', timeout: 10000 });
    await joinO.click();

    // Wait for board to render
    await expect(p1.locator('[data-testid="gobbler-cell-0"]')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    // Board:  0|1|2 / 3|4|5 / 6|7|8
    // Stacks: stack-0=SMALL, stack-1=MEDIUM, stack-2=LARGE
    // X wins diagonal 0->4->8
    await p1.locator('[data-testid="gobbler-inventory-X-stack-2"]').click();
    await p1.locator('[data-testid="gobbler-cell-0"]').click();

    await p2.locator('[data-testid="gobbler-inventory-O-stack-2"]').click();
    await p2.locator('[data-testid="gobbler-cell-1"]').click();

    await p1.locator('[data-testid="gobbler-inventory-X-stack-1"]').click();
    await p1.locator('[data-testid="gobbler-cell-4"]').click();

    await p2.locator('[data-testid="gobbler-inventory-O-stack-1"]').click();
    await p2.locator('[data-testid="gobbler-cell-2"]').click();

    await p1.locator('[data-testid="gobbler-inventory-X-stack-0"]').click();
    await p1.locator('[data-testid="gobbler-cell-8"]').click(); // X wins!

    // Match over — winner banner visible to BOTH players
    await p1.locator('[data-testid="winner-banner"]').waitFor({ state: 'visible', timeout: 10000 });
    await p2.locator('[data-testid="winner-banner"]').waitFor({ state: 'visible', timeout: 10000 });
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 4. Who Am I ─────────────────────────────────────────────────────────
  test('Who Am I Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/whoami-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/whoami-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Amy', 'Who Am I');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await p1.waitForTimeout(1500);

    // Switch to PLAYER_INPUT mode via the custom dropdown
    const modeTrigger = p1
      .getByRole('button')
      .filter({ hasText: /Host Picks|Random \(DB\)|Players Write|AI Generate/ })
      .first();
    await modeTrigger.click();
    await p1
      .getByRole('button')
      .filter({ hasText: /Players Write/i })
      .last()
      .click();

    // Start game
    const startBtn = p1.getByRole('button', { name: /Start Game/i }).first();
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();

    // Both submit secret words; last submission moves everyone into ASKING
    await expect(p1.locator('#playerWordInput')).toBeVisible({ timeout: 10000 });
    await expect(p2.locator('#playerWordInput')).toBeVisible({ timeout: 10000 });

    await p1.locator('#playerWordInput').fill('Elephant');
    await p1.getByRole('button', { name: /Submit Word/i }).click();
    await expect(p1.getByText('Word submitted!')).toBeVisible({ timeout: 5000 });

    await p2.locator('#playerWordInput').fill('Tiger');
    await p2.getByRole('button', { name: /Submit Word/i }).click();

    // Find who is the active guesser
    const guessBtnP1 = p1.getByRole('button', { name: /Guess the Word!/i });
    const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
    await waitForAnyVisible([guessBtnP1, guessBtnP2]);
    const activePage = (await guessBtnP1.isVisible().catch(() => false)) ? p1 : p2;
    const voterPage = activePage === p1 ? p2 : p1;

    // Active player opens the modal and guesses
    await activePage.getByRole('button', { name: /Guess the Word!/i }).click();
    const guessInput = activePage.locator('#guessWordInput');
    await guessInput.waitFor({ state: 'visible', timeout: 8000 });
    await guessInput.fill('My Secret Word');
    await activePage.getByRole('button', { name: /Submit Guess/i }).click();

    // RESULT phase: votes were wiped by the guess — voter verifies YES
    await expect(activePage.getByText('Word Guess')).toBeVisible({ timeout: 10000 });
    await voterPage.getByRole('button', { name: /YES/i }).click();

    // Majority YES ends the match -> Game Over with revealed words
    await activePage.getByRole('button', { name: /Continue/i }).click();
    await expect(p1.getByText('Game Over')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Game Over')).toBeVisible({ timeout: 5000 });
    await expect(p1.getByText('Elephant').first()).toBeVisible();
    await expect(p1.getByText('Tiger').first()).toBeVisible();
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 5. Who First ────────────────────────────────────────────────────────
  test('Who First Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/whofirst-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/whofirst-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Who First');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await p1.waitForTimeout(1000);

    // Fast 1s countdowns and exactly 2 rounds so the match finishes on screen
    await p1.getByLabel('Min Countdown (s)').fill('1');
    await p1.getByLabel('Max Countdown (s)').fill('1');
    await p1.getByLabel('Number of Rounds').fill('2');

    // Enable host plays so both players compete
    const hostPlaysSwitch = p1.locator('#host-plays-switch');
    if (
      await hostPlaysSwitch
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false)
    ) {
      const isChecked = await hostPlaysSwitch.getAttribute('aria-checked');
      if (isChecked !== 'true') await hostPlaysSwitch.click();
    }

    // Start game
    await p1.getByTestId('start-btn').click();

    // Play every configured round
    for (let round = 1; round <= 2; round++) {
      await p1.getByTestId('status-go').waitFor({ state: 'visible', timeout: 20000 });
      await p2.getByTestId('status-go').waitFor({ state: 'visible', timeout: 20000 });

      await p1.getByTestId('press-btn').click();
      await p1.waitForTimeout(400);
      await p2.getByTestId('press-btn').click();

      await expect(p1.getByTestId('round-result-title')).toBeVisible({ timeout: 8000 });
      await p1.waitForTimeout(1200);

      if (round < 2) {
        await p1.getByRole('button', { name: /Next Round/i }).click();
        await p1.waitForTimeout(1000);
      }
    }

    // After the final round the host advances to the scoreboard
    await p1.getByRole('button', { name: /Next Round/i }).click();
    await expect(p1.getByText('Final Result')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Final Result')).toBeVisible({ timeout: 5000 });
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 6. Who Know ─────────────────────────────────────────────────────────
  test('Who Know Demo', async ({ browser }) => {
    // Who Know requires minimum 4 players
    const ctxs = await Promise.all([
      browser.newContext({ recordVideo: { dir: `${videoDir}/whoknow-host` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/whoknow-p1` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/whoknow-p2` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/whoknow-p3` } }),
    ]);
    const [p1, p2, p3, p4] = await Promise.all(ctxs.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'Who Know');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');
    await joinRoom(p3, origin, roomCode, 'P2');
    await joinRoom(p4, origin, roomCode, 'P3');
    await p1.waitForTimeout(1500);

    // Set Host Selection to FIXED so room creator is always the host
    const hostSelWrapper = p1
      .getByText(/Host Selection|เลือกเจ้าของห้อง/i)
      .locator('..')
      .locator('button')
      .first();
    if (
      await hostSelWrapper
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await hostSelWrapper.click();
      await p1
        .locator('button', { hasText: /Fixed|คงที่/i })
        .first()
        .click();
    }

    // Short timer keeps the demo snappy
    const timerInput = p1.locator('input[name="timerMin"]');
    if (
      await timerInput
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await timerInput.fill('1');
    }

    // Start game
    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/i });
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();

    // Fill secret word modal
    const wordInputModal = p1.locator('#secretWordModalInput');
    await wordInputModal.waitFor({ state: 'visible', timeout: 8000 });
    await wordInputModal.fill('Banana');
    await wordInputModal.press('Enter');

    await p1.waitForTimeout(2000);

    // Host confirms the word was guessed -> straight to voting
    const endBtn = p1
      .locator('button')
      .filter({ hasText: /Word Guessed/i })
      .first();
    await endBtn.waitFor({ state: 'visible', timeout: 15000 });
    await endBtn.click();

    // Every non-host player votes for a suspect
    for (const page of [p2, p3, p4]) {
      const voteBtn = page
        .locator('button')
        .filter({ hasText: /^P[123]$/ })
        .first();
      if (
        await voteBtn
          .waitFor({ state: 'visible', timeout: 8000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await voteBtn.click().catch(() => {});
      }
    }

    // Voting complete -> results screen with insider verdict
    for (const page of [p1, p2, p3, p4]) {
      await expect(page.getByText('Game Results')).toBeVisible({ timeout: 15000 });
    }
    await expect(p1.getByText(/Insider Wins!|Commoners Win!/i).first()).toBeVisible({
      timeout: 10000,
    });
    await p1.waitForTimeout(2500);

    await Promise.all(ctxs.map((c) => c.close()));
  });

  // ─── 7. Sounds Fishy ─────────────────────────────────────────────────────
  test('Sounds Fishy Demo', async ({ browser }) => {
    // Sounds Fishy requires minimum 3 players
    const ctxs = await Promise.all([
      browser.newContext({ recordVideo: { dir: `${videoDir}/soundsfishy-host` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/soundsfishy-p1` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/soundsfishy-p2` } }),
    ]);
    const [p1, p2, p3] = await Promise.all(ctxs.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'FishHost', 'Sounds Fishy');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'F1');
    await joinRoom(p3, origin, roomCode, 'F2');

    // Wait for players to sync
    await expect(p1.getByText('F1')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('F2')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1000);

    // Start game
    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();
    await p1.waitForTimeout(2000);

    // Submit answers — the Blue Fish must type the exact true answer shown on screen
    for (const page of [p1, p2, p3]) {
      const input = page.locator('#answerInput');
      if (
        !(await input
          .waitFor({ state: 'visible', timeout: 5000 })
          .then(() => true)
          .catch(() => false))
      ) {
        continue; // Picker waits for the fish instead
      }

      let answerText = 'This is obviously a lie';
      if (
        await page
          .getByText(/MUST enter the true answer/i)
          .isVisible()
          .catch(() => false)
      ) {
        const block = page
          .locator('span')
          .filter({ hasText: 'The True Answer' })
          .first()
          .locator('..');
        answerText = (await block.locator('p').innerText()).trim();
      }
      await input.fill(answerText);
      await page
        .locator('button')
        .filter({ hasText: /Submit Answer/i })
        .first()
        .click();
      // Confirmed either by the panel, or by the game moving on to the reveal phase
      // once every fish has submitted (the panel is then replaced by "???" cards)
      await waitForAnyVisible(
        [page.getByText('Answer Submitted!'), page.getByText('???').first()],
        8000,
      );
    }
    await p1.waitForTimeout(2000);

    // Picker reveals each hidden answer, eliminates one, and banks the pot
    let pickerPage: Page | null = null;
    for (const page of [p1, p2, p3]) {
      const revealBtn = page
        .locator('button')
        .filter({ hasText: /Reveal Answer/i })
        .first();
      const eliminateBtn = page
        .locator('button')
        .filter({ hasText: /Eliminate|กำจัด/i })
        .first();
      if (
        (await revealBtn
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true)
          .catch(() => false)) ||
        (await eliminateBtn.isVisible().catch(() => false))
      ) {
        pickerPage = page;
        break;
      }
    }
    if (pickerPage) {
      // Answers stay hidden ("???") until the picker flips them one by one
      for (let i = 0; i < 5; i++) {
        const revealBtns = pickerPage.locator('button').filter({ hasText: /Reveal Answer/i });
        if ((await revealBtns.count()) === 0) break;
        await revealBtns.first().click();
        await pickerPage.waitForTimeout(1500);
      }

      const eliminateBtn = pickerPage
        .locator('button')
        .filter({ hasText: /Eliminate|กำจัด/i })
        .first();
      await expect(eliminateBtn).toBeVisible({ timeout: 10000 });
      await eliminateBtn.click();

      // Catching the last Red Herring auto-banks; otherwise bank manually
      const bankBtn = pickerPage
        .locator('button')
        .filter({ hasText: /Bank|รับคะแนน/i })
        .first();
      if (
        await bankBtn
          .waitFor({ state: 'visible', timeout: 4000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await bankBtn.click();
      }
    }

    // The single-round match always resolves after an elimination -> scoring
    for (const page of [p1, p2, p3]) {
      await expect(page.getByText('Round Over!')).toBeVisible({ timeout: 10000 });
    }
    await p1.waitForTimeout(2500);

    await Promise.all(ctxs.map((c) => c.close()));
  });

  // ─── 8. The Mind ─────────────────────────────────────────────────────────
  test('The Mind Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/themind-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/themind-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Host', 'The Mind');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');
    await p1.waitForTimeout(1000);

    // Configure Max Level = 2 so the match is winnable inside the demo
    const maxLevelTrigger = p1.locator('button', { hasText: /^Auto$/ }).first();
    if (
      await maxLevelTrigger
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await maxLevelTrigger.click();
      await p1.locator('button', { hasText: /^2$/ }).last().click();
    }

    // Start game
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    // SETUP phase: both players confirm they are ready
    for (const page of [p1, p2]) {
      const readyBtn = page.locator('button', { hasText: /^Ready$/ }).first();
      await readyBtn.waitFor({ state: 'visible', timeout: 10000 });
      await readyBtn.click();
    }
    await p1.waitForTimeout(1500);

    // PLAYING loop: always play the globally lowest card so no lives are lost.
    // Handles level transitions ("Next Level") and per-level Ready screens
    // until the match is won.
    for (let i = 0; i < 60; i++) {
      if (
        await p1
          .getByText('You Win!')
          .isVisible()
          .catch(() => false)
      )
        break;

      const nextLevelBtn = p1.locator('button', { hasText: /Next Level/i }).first();
      if (await nextLevelBtn.isVisible().catch(() => false)) {
        await nextLevelBtn.click();
        await p1.waitForTimeout(1500);
        continue;
      }

      // Every new level starts in SETUP — both players must ready up again
      for (const page of [p1, p2]) {
        const readyBtn = page.locator('button', { hasText: /^Ready$/ }).first();
        if (await readyBtn.isVisible().catch(() => false)) {
          await readyBtn.click();
        }
      }

      const c1 = await lowestEnabledCard(p1);
      const c2 = await lowestEnabledCard(p2);
      if (c1 === null && c2 === null) {
        await p1.waitForTimeout(700);
        continue;
      }
      if (c1 !== null && (c2 === null || c1 < c2)) {
        await p1
          .locator('button', { hasText: new RegExp(`^${c1}$`) })
          .first()
          .click();
      } else {
        await p2
          .locator('button', { hasText: new RegExp(`^${c2}$`) })
          .first()
          .click();
      }
      await p1.waitForTimeout(900);
    }

    // All levels cleared -> victory screen on BOTH players
    await expect(p1.getByText('You Win!')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('You Win!')).toBeVisible({ timeout: 5000 });
    await expect(p1.getByText('Final Scores')).toBeVisible({ timeout: 5000 });
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 9. Detective Club ───────────────────────────────────────────────────
  test('Detective Club Demo', async ({ browser }) => {
    // Detective Club requires minimum 3 players
    const ctxs = await Promise.all([
      browser.newContext({ recordVideo: { dir: `${videoDir}/detectiveclub-p1` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/detectiveclub-p2` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/detectiveclub-p3` } }),
    ]);
    const [p1, p2, p3] = await Promise.all(ctxs.map((c) => c.newPage()));

    const roomCode = await createRoom(p1, 'DetHost', 'Detective Club');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'D1');
    await joinRoom(p3, origin, roomCode, 'D2');
    await p1.waitForTimeout(1500);

    for (const name of ['D1', 'D2']) {
      await expect(p1.getByText(name, { exact: true })).toBeVisible({ timeout: 8000 });
    }

    // Start game
    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();
    await p1.waitForTimeout(3000);

    // Informer submits a word
    for (const page of [p1, p2, p3]) {
      const wordInput = page.locator('input').first();
      if (
        await wordInput
          .waitFor({ state: 'visible', timeout: 5000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await wordInput.fill('Mystery');
        const confirmBtn = page.locator('button', { hasText: /Confirm|Submit|ยืนยัน/i }).first();
        if (
          await confirmBtn
            .waitFor({ state: 'visible', timeout: 3000 })
            .then(() => true)
            .catch(() => false)
        ) {
          await confirmBtn.click();
        }
        break;
      }
    }
    await p1.waitForTimeout(2000);

    // Playing phase — keep playing turns until Discussion appears
    for (let turn = 0; turn < 15; turn++) {
      const discussionReady = p1.locator('button', { hasText: /Start Voting|เริ่มโหวต/i }).first();
      if (await discussionReady.isVisible().catch(() => false)) break;

      let played = false;
      for (const page of [p1, p2, p3]) {
        const activeIndicator = page.getByText(/Your Turn - Play a Card|ตาคุณ/i);
        if (
          await activeIndicator
            .waitFor({ state: 'visible', timeout: 2500 })
            .then(() => true)
            .catch(() => false)
        ) {
          // Click the overlay div that actually has the onClick handler
          const playOverlay = page
            .locator('div.absolute')
            .filter({ hasText: /^Play$|^วาง$/i })
            .first();
          await playOverlay.click({ force: true });

          const playBtn = page.locator('button', { hasText: /Play Card|วางการ์ด/i }).first();
          await playBtn.waitFor({ state: 'visible', timeout: 3000 });
          await playBtn.click();
          await page.waitForTimeout(1000);
          played = true;
          break;
        }
      }
      if (!played) await p1.waitForTimeout(800);
    }

    // Continue to voting (Discussion phase)
    for (const page of [p1, p2, p3]) {
      const continueBtn = page.locator('button', { hasText: /Start Voting|เริ่มโหวต/i }).first();
      if (
        await continueBtn
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await continueBtn.click();
      }
    }

    // Voting phase — everyone locks in a suspect
    for (const page of [p1, p2, p3]) {
      const playerBtn = page
        .locator('button')
        .filter({ hasText: /D1|D2|DetHost/i })
        .first();
      const voteBtn = page.locator('button', { hasText: /Confirm Vote|ยืนยันการโหวต/i }).first();
      if (
        (await playerBtn
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true)
          .catch(() => false)) &&
        (await voteBtn.isVisible().catch(() => false))
      ) {
        await playerBtn.click();
        await page.waitForTimeout(500);
        await voteBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // All votes in -> scoring screen with roles revealed and scoreboard
    for (const page of [p1, p2, p3]) {
      await expect(page.getByText(/Round Over/).first()).toBeVisible({ timeout: 15000 });
    }
    await expect(p1.getByText('Scoreboard').first()).toBeVisible({ timeout: 5000 });
    await p1.waitForTimeout(2500);

    await Promise.all(ctxs.map((c) => c.close()));
  });

  // ─── 10. Music Trivia ────────────────────────────────────────────────────
  test('Music Trivia Demo', async ({ browser }) => {
    const p1Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/musictrivia-p1` } });
    const p2Ctx = await browser.newContext({ recordVideo: { dir: `${videoDir}/musictrivia-p2` } });
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Music Trivia');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');
    await p1.waitForTimeout(1500);

    // Select ITUNES source and search
    const sourceSelect = p1.locator('select[title="Select music source"]');
    if (
      await sourceSelect
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await sourceSelect.selectOption('ITUNES');
    }
    const searchInput = p1.getByPlaceholder(/Taylor Swift|search|ค้นหา/i);
    if (
      await searchInput
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await searchInput.fill('Pop');
      await p1.keyboard.press('Enter');
    }

    // Wait for search results
    await p1
      .waitForFunction(() => document.querySelectorAll('tbody tr').length >= 2, { timeout: 20000 })
      .catch(() => {});
    await p1.waitForTimeout(1000);

    // Start game
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await startBtn.waitFor({ state: 'visible', timeout: 10000 });
    await startBtn.click();

    // Both players ready up
    for (const page of [p1, p2]) {
      const readyBtn = page.getByText(/I'm Ready!|ฉันพร้อมแล้ว/i);
      await readyBtn.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      await readyBtn.click().catch(() => {});
    }

    // Host starts song countdown
    const startSongBtn = p1.getByText('Start Song (Countdown)');
    await startSongBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await startSongBtn.click().catch(() => {});
    await p1.waitForTimeout(5000);

    // Guest buzzes and answers (host cannot buzz by default)
    const buzzBtn = p2.locator('button').filter({ hasText: /BUZZ!/i }).first();
    if (
      await buzzBtn
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await buzzBtn.click();
      const answerInput = p2.getByPlaceholder(/Type answer/i);
      await answerInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await answerInput.fill('Some Song Guess');
      await p2.keyboard.press('Enter');
    }

    // Wrong answer strikes the guest out; host reveals the answer to close the round
    const revealBtn = p1
      .locator('button')
      .filter({ hasText: /Skip Question/i })
      .first();
    if (
      await revealBtn
        .waitFor({ state: 'visible', timeout: 10000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await revealBtn.click();
    }

    // Host ends the match from the header -> FINISHED screen
    const endGameBtn = p1
      .locator('button')
      .filter({ hasText: /End Game/i })
      .first();
    await endGameBtn.waitFor({ state: 'visible', timeout: 10000 });
    await endGameBtn.click();

    await expect(p1.getByText('Game Over!')).toBeVisible({ timeout: 15000 });
    await expect(p2.getByText('Game Over!')).toBeVisible({ timeout: 5000 });
    await p1.waitForTimeout(2500);

    await p1Ctx.close();
    await p2Ctx.close();
  });

  // ─── 11. Saboteur ────────────────────────────────────────────────────────
  test('Saboteur Demo', async ({ browser }) => {
    test.setTimeout(600000); // three full rounds    // Saboteur requires minimum 3 players
    const ctxs = await Promise.all([
      browser.newContext({ recordVideo: { dir: `${videoDir}/saboteur-p1` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/saboteur-p2` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/saboteur-p3` } }),
    ]);
    const [p1, p2, p3] = await Promise.all(ctxs.map((c) => c.newPage()));
    const pages = [p1, p2, p3];

    const roomCode = await createRoom(p1, 'MinHost', 'Saboteur');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Digger');
    await joinRoom(p3, origin, roomCode, 'Sneaky');
    for (const name of ['Digger', 'Sneaky']) {
      await expect(p1.getByText(name, { exact: true })).toBeVisible({ timeout: 10000 });
    }

    // Start the match
    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();

    // Mine board renders with the start card at (0,2)
    await expect(p1.locator('[data-testid="saboteur-cell-0,2"]')).toBeVisible({ timeout: 20000 });
    await p1.waitForTimeout(1500);
    /** Clicks the enabled board cell closest to the middle goal row (8,2).
     *  Junk tiles (dead ends / pass-throughs) go to the LOW-x rear so they
     *  never block the frontier corridor. */
    async function clickBestCell(page: Page, junk: boolean): Promise<string | null> {
      // Single in-page pass: score cells and click the winner (fast under slowMo).
      const best = await page
        .evaluate(
          ({ junk }: { junk: boolean }) => {
            const cells = Array.from(
              document.querySelectorAll<HTMLButtonElement>(
                '[data-testid^="saboteur-cell-"]:not([disabled])',
              ),
            );
            if (cells.length === 0) return null;
            let winner: { id: string; score: number } | null = null;
            for (const el of cells) {
              const id = el.getAttribute('data-testid') ?? '';
              const [xs, ys] = id.replace('saboteur-cell-', '').split(',');
              const x = parseInt(xs ?? '0', 10);
              const y = parseInt(ys ?? '0', 10);
              const score = junk ? -x * 10 - Math.abs(y - 2) : x * 10 - Math.abs(y - 2);
              if (!winner || score > winner.score) winner = { id, score };
            }
            return winner?.id ?? null;
          },
          { junk },
        )
        .catch(() => null);
      if (!best) return null;
      await page.locator(`[data-testid="${best}"]`).click();
      return best;
    }

    /** Performs one board/hand action for whichever page currently has the turn. */
    async function playOneTurn(): Promise<boolean> {
      for (const page of pages) {
        const store = await page
          .evaluate(() => {
            const st = (window as any).__useGameStore?.getState?.();
            const s = st?.room?.saboteurState;
            if (!s) return null;
            return {
              me: st.socketId as string,
              active: s.activePlayerId as string,
              phase: s.currentPhase as string,
              hand: (st.privateState?.sbHand ?? []).map((c: any) => c.cardId) as string[],
              broken: (s.players?.[st.socketId]?.brokenTools ?? []) as string[],
              peeked: Object.keys((st.privateState?.sbPeekedGoals ?? {}) as object).length,
            };
          })
          .catch(() => null);
        if (!store || store.phase !== 'PLAYING' || store.active !== store.me) continue;
        if (store.hand.length === 0) continue;

        // Blocked? Repair our own tool first so we can build again.
        if (store.broken.length > 0) {
          const repairIdx = store.hand.findIndex((id) => {
            if (!id.startsWith('action-repair')) return false;
            const tools = id.replace('action-repair-', '').split('-');
            return store.broken.some((tool) =>
              tools.some((t) => t.toLowerCase().startsWith(tool.slice(0, 4).toLowerCase())),
            );
          });
          if (repairIdx >= 0) {
            await page.locator(`[data-testid="saboteur-hand-${repairIdx}"]`).click();
            await page.waitForTimeout(120);
            await page.locator(`[data-testid="saboteur-player-${store.me}"]`).click();
            console.log(`[act] ${store.me.slice(-4)} repair-self ${store.hand[repairIdx]}`);
            return true;
          }
        }

        // Try path cards first — building toward the gold is the fastest route.
        const order = store.hand
          .map((cardId, idx) => ({ cardId, idx }))
          .sort((a, b) => {
            const aPath = a.cardId.startsWith('path-') ? 0 : 1;
            const bPath = b.cardId.startsWith('path-') ? 0 : 1;
            return aPath - bPath;
          });

        const handBtns = page.locator('[data-testid^="saboteur-hand-"]');
        for (const { cardId, idx } of order) {
          // Never burn turns on redundant map peeks
          if (cardId === 'action-map' && store.peeked >= 3) continue;
          const junk = cardId.startsWith('path-') && !cardId.endsWith('c');
          const card = handBtns.nth(idx);
          if (!(await card.isEnabled().catch(() => false))) continue;
          await card.click();
          await page.waitForTimeout(120);

          const cellId = await clickBestCell(page, junk);
          if (cellId) {
            console.log(`[act] ${store.me.slice(-4)} card=${cardId} -> ${cellId}`);
            return true;
          }
          // Path cards may need the 180° rotation to fit anywhere
          const rotateBtn = page.locator('button', { hasText: /180°/ }).first();
          if (await rotateBtn.isVisible().catch(() => false)) {
            await rotateBtn.click();
            await page.waitForTimeout(100);
            const rotId = await clickBestCell(page, junk);
            if (rotId) {
              console.log(`[act] ${store.me.slice(-4)} card=${cardId} rot -> ${rotId}`);
              return true;
            }
          }
        }

        // Nothing placeable — discard the selected card instead
        const discardBtn = page
          .locator('button')
          .filter({ hasText: /Discard|ทิ้ง/i })
          .first();
        if (!(await discardBtn.isVisible().catch(() => false))) {
          await handBtns.first().click(); // select card 0 to reveal its actions
          await discardBtn.waitFor({ state: 'visible', timeout: 3000 });
        }
        await discardBtn.click();
        console.log(`[act] ${store.me.slice(-4)} discard ${store.hand[0]}`);
        return true;
      }
      return false;
    }

    /** Handles GOLD_PICK overlay; returns true when someone picked. */
    async function tryPickGold(): Promise<boolean> {
      for (const page of pages) {
        const goldBtn = page.locator('[data-testid^="saboteur-gold-"]').first();
        if (!(await goldBtn.isVisible().catch(() => false))) continue;
        if (!(await goldBtn.isEnabled().catch(() => false))) continue;
        await goldBtn.click();
        return true;
      }
      return false;
    }

    // Drive the whole match: 3 rounds of digging until Game Over
    let sameTurnStreak = 0;
    let lastActive = '';
    for (let step = 0; step < 400; step++) {
      if (
        await p1
          .getByText(/Game Over|จบเกม/i)
          .first()
          .isVisible()
          .catch(() => false)
      )
        break;

      if (await tryPickGold()) {
        await p1.waitForTimeout(400);
        continue;
      }

      const nextRoundBtn = p1
        .locator('button')
        .filter({ hasText: /Next Round|เริ่มรอบถัดไป/i })
        .first();
      if (await nextRoundBtn.isVisible().catch(() => false)) {
        await nextRoundBtn.click();
        await p1.waitForTimeout(700);
        continue;
      }

      if (!(await playOneTurn())) {
        await p1.waitForTimeout(600);
        continue;
      }

      await p1.waitForTimeout(300);
      const active = await p1
        .evaluate(() => {
          const st = (window as any).__useGameStore?.getState?.();
          return `${st?.room?.saboteurState?.activePlayerId}|${st?.room?.saboteurState?.stockCount}`;
        })
        .catch(() => 'eval-err');
      if (active === lastActive) {
        sameTurnStreak++;
        if (sameTurnStreak >= 6) {
          const dump = await p1
            .evaluate(() => {
              const st = (window as any).__useGameStore?.getState?.();
              const s = st?.room?.saboteurState;
              return {
                active: s?.activePlayerId,
                phase: s?.currentPhase,
                board: s?.board,
                lastAction: s?.lastAction,
                toasts: Array.from(document.querySelectorAll('[class*="toast"]')).map(
                  (t) => t.textContent,
                ),
              };
            })
            .catch(() => null);
          throw new Error(
            `Turn stalled on ${active} — server rejecting actions. Dump: ${JSON.stringify(dump)}`,
          );
        }
      } else {
        sameTurnStreak = 0;
        lastActive = active;
      }
    }

    // Match finished -> scoreboard visible to everyone
    for (const page of pages) {
      await expect(page.getByText(/Game Over|จบเกม/i).first()).toBeVisible({ timeout: 20000 });
    }
    await expect(p1.getByText(/Back to Lobby|กลับห้องล็อบบี้/i)).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2000);

    // Host wraps up the demo back in the lobby
    await p1
      .locator('button')
      .filter({ hasText: /Back to Lobby|กลับห้องล็อบบี้/i })
      .click();
    await expect(p1.getByText(/Waiting Room|ห้องรอ/i)).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(2500);

    await Promise.all(ctxs.map((c) => c.close()));
  });
});
