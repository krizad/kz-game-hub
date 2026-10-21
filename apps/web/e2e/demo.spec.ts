import { test, expect } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';
import { readCipherState } from './cipher-grid-helpers';
import { relaySnapshot } from './dog-relay-helpers';
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Full Game Demos — records every game & mode (all 18) from lobby to completion,
 * capturing:
 * 1. Multiple player perspectives & every secret role simultaneously
 * 2. Full gameplay through at least 1 complete round
 * 3. Synchronized Result Reveal (เฉลยเกม) with role/hand/board opening & winner banner
 * 4. Post-reveal final scoreboard / summary screen
 * 5. Multi-view split-screen MP4 output in `apps/web/public/demo/<slug>-demo.mp4`
 */
test.use({ launchOptions: { slowMo: 350 } });
test.setTimeout(300000);

const videoDir = 'test-results/demo-videos';
const VIEWPORT = { width: 1280, height: 720 };

async function createRecordedPlayers(browser: any, slug: string, count: number) {
  const ctxs: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: {
        dir: `${videoDir}/${slug}-p${i + 1}`,
        size: VIEWPORT,
      },
    });
    ctxs.push(ctx);
    pages.push(await ctx.newPage());
  }
  await Promise.all(pages.map((p) => p.goto('/')));
  return { ctxs, pages };
}

/**
 * Renders a Neobrutalist perspective & role badge onto a pure `<canvas>` overlay.
 * Using `<canvas>` with `pointer-events: none` ensures zero DOM text nodes, so
 * Playwright text locators and clicks are never affected while the recorded video
 * clearly displays each pane's player name and secret role.
 */
async function setPerspectiveBadge(page: Page, text: string, bg = '#fde047') {
  await page
    .evaluate(
      ({ text, bg }) => {
        let canvas = document.getElementById('__demo_badge_canvas__') as HTMLCanvasElement | null;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.id = '__demo_badge_canvas__';
          canvas.style.position = 'fixed';
          canvas.style.bottom = '12px';
          canvas.style.left = '12px';
          canvas.style.zIndex = '2147483647';
          canvas.style.pointerEvents = 'none';
          document.body.appendChild(canvas);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const font = '900 15px system-ui, -apple-system, sans-serif';
        ctx.font = font;
        const metrics = ctx.measureText(text);
        const padX = 14;
        const w = Math.ceil(metrics.width + padX * 2 + 6);
        const h = 36;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#000000';
        ctx.fillRect(4, 4, w - 4, h - 4);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w - 4, h - 4);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(1.5, 1.5, w - 7, h - 7);
        ctx.font = font;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, padX, (h - 4) / 2 + 1);
      },
      { text, bg },
    )
    .catch(() => {});
}

/**
 * Watches the synchronized `ResultRevealBoundary` (`data-testid="result-reveal"`)
 * through its full lifecycle:
 * - Intro & Evidence (secret word / true answer / true pair / board)
 * - Player-by-player role/hand/score cards (clicking `result-reveal-mine` when active)
 * - Winner announcement (`data-testid="result-reveal-winner"`)
 * - Completion transition into the game's final summary screen
 */
async function watchResultReveal(pages: Page[], timeoutMs = 45000): Promise<void> {
  const primary = pages[0];
  const revealSection = primary.getByTestId('result-reveal');
  const appeared = await revealSection
    .waitFor({ state: 'visible', timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stillVisible = await revealSection.isVisible().catch(() => false);
    if (!stillVisible) break;

    let clickedMine = false;
    for (const page of pages) {
      const mineBtn = page.getByTestId('result-reveal-mine');
      if (await mineBtn.isVisible().catch(() => false)) {
        await page.waitForTimeout(300);
        await mineBtn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(1200);
        clickedMine = true;
        break;
      }
    }
    if (!clickedMine) {
      await primary.waitForTimeout(350);
    }
  }
}

/**
 * Closes all browser contexts and stitches their recorded `.webm` files into a
 * multi-perspective split-screen `.mp4` in `public/demo/<slug>-demo.mp4` and
 * `test-results/demo-videos/<slug>-demo.mp4`.
 */
async function finalizeDemoVideo(
  slug: string,
  ctxs: BrowserContext[],
  pages: Page[],
  selectedIndices?: number[],
) {
  const videos = pages.map((p) => p.video());
  await Promise.all(ctxs.map((c) => c.close().catch(() => {})));
  const rawPaths = await Promise.all(videos.map((v) => v?.path().catch(() => '') ?? ''));
  const ordered = (selectedIndices ?? rawPaths.map((_, i) => i))
    .map((i) => rawPaths[i])
    .filter((p): p is string => Boolean(p && existsSync(p)));

  if (ordered.length === 0) return;

  const pubDir = resolve(process.cwd(), 'public/demo');
  const outDir = resolve(process.cwd(), videoDir);
  mkdirSync(pubDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const outMp4 = resolve(pubDir, `${slug}-demo.mp4`);
  const copyMp4 = resolve(outDir, `${slug}-demo.mp4`);

  if (ordered.length === 1) {
    execSync(
      `ffmpeg -y -i "${ordered[0]}" -c:v libx264 -pix_fmt yuv420p -r 30 -crf 23 -movflags +faststart "${outMp4}"`,
      { stdio: 'pipe' },
    );
  } else if (ordered.length === 2) {
    execSync(
      `ffmpeg -y -i "${ordered[0]}" -i "${ordered[1]}" -filter_complex "[0:v]scale=960:540[v0];[1:v]scale=960:540[v1];[v0][v1]hstack=inputs=2[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -r 30 -crf 23 -movflags +faststart "${outMp4}"`,
      { stdio: 'pipe' },
    );
  } else if (ordered.length === 3) {
    execSync(
      `ffmpeg -y -i "${ordered[0]}" -i "${ordered[1]}" -i "${ordered[2]}" -filter_complex "[0:v]scale=960:540[v0];[1:v]scale=960:540[v1];[2:v]scale=960:540,pad=1920:540:480:0:color=#0f172a[v2];[v0][v1]hstack=inputs=2[top];[top][v2]vstack=inputs=2[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -r 30 -crf 23 -movflags +faststart "${outMp4}"`,
      { stdio: 'pipe' },
    );
  } else {
    const p = ordered.slice(0, 4);
    execSync(
      `ffmpeg -y -i "${p[0]}" -i "${p[1]}" -i "${p[2]}" -i "${p[3]}" -filter_complex "[0:v]scale=960:540[v0];[1:v]scale=960:540[v1];[2:v]scale=960:540[v2];[3:v]scale=960:540[v3];[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -r 30 -crf 23 -movflags +faststart "${outMp4}"`,
      { stdio: 'pipe' },
    );
  }
  copyFileSync(outMp4, copyMp4);
}

/**
 * Waits until one of the locators (possibly on DIFFERENT pages) is visible.
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

/** Returns the lowest enabled numeric card button value on the page (Countaline). */
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
  // ─── 1. Tic-Tac-Toe (Classic) ────────────────────────────────────────────
  test('Tic-Tac-Toe Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'tictactoe', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Alice', 'Tic-Tac-Toe');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await setPerspectiveBadge(p1, '🎥 Alice — Role: Player X', '#a5f3fc');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Player O', '#fbcfe8');

    await p1.waitForTimeout(1000);
    await p1.locator('button:has-text("Join as X")').click();
    await p2.locator('button:has-text("Join as O")').click();
    await p1.waitForTimeout(800);

    const p1Cells = p1.locator('div.grid.grid-cols-3 button');
    const p2Cells = p2.locator('div.grid.grid-cols-3 button');
    const moves = [
      { page: p1, cells: p1Cells, index: 0 },
      { page: p2, cells: p2Cells, index: 4 },
      { page: p1, cells: p1Cells, index: 1 },
      { page: p2, cells: p2Cells, index: 5 },
      { page: p1, cells: p1Cells, index: 2 }, // X wins top row
    ];
    for (const move of moves) {
      await move.cells.nth(move.index).waitFor({ state: 'visible', timeout: 10000 });
      await move.cells.nth(move.index).click();
      await move.page.waitForTimeout(500);
    }

    await watchResultReveal(pages);
    await expect(p1.getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('tictactoe', ctxs, pages);
  });

  // ─── 2. Ultimate Tic-Tac-Toe ─────────────────────────────────────────────
  test('Ultimate Tic-Tac-Toe Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'ultimate-ttt', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Alice', 'Tic-Tac-Toe', 'ULTIMATE');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await setPerspectiveBadge(p1, '🎥 Alice — Role: Player X (Ultimate)', '#a5f3fc');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Player O (Ultimate)', '#fbcfe8');

    await p1.waitForTimeout(1000);
    await p1.locator('[data-testid="uttt-join-x"]').click();
    await p2.locator('[data-testid="uttt-join-o"]').click();
    await p1.waitForTimeout(800);

    const moves = [
      { page: p1, macro: 0, micro: 1 },
      { page: p2, macro: 1, micro: 0 },
      { page: p1, macro: 0, micro: 2 },
      { page: p2, macro: 2, micro: 0 },
      { page: p1, macro: 0, micro: 0 }, // X wins Sub-board 0
      { page: p2, macro: 3, micro: 1 }, // Bob takes Free Move in board 3
      { page: p1, macro: 1, micro: 4 },
      { page: p2, macro: 4, micro: 1 },
      { page: p1, macro: 1, micro: 2 },
      { page: p2, macro: 2, micro: 1 },
      { page: p1, macro: 1, micro: 6 }, // X wins Sub-board 1
      { page: p2, macro: 6, micro: 2 },
      { page: p1, macro: 2, micro: 3 },
      { page: p2, macro: 3, micro: 2 },
      { page: p1, macro: 2, micro: 4 },
      { page: p2, macro: 4, micro: 2 },
      { page: p1, macro: 2, micro: 5 }, // X wins Sub-board 2 -> Macro 0,1,2 win!
    ];

    for (const move of moves) {
      const cell = move.page.locator(`[data-testid="uttt-cell-${move.macro}-${move.micro}"]`);
      await cell.waitFor({ state: 'visible', timeout: 10000 });
      await cell.click();
      await move.page.waitForTimeout(450);
    }

    await watchResultReveal(pages);
    await expect(p1.getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('ultimate-ttt', ctxs, pages);
  });

  // ─── 3. Gobbler Tic-Tac-Toe ──────────────────────────────────────────────
  test('Gobbler Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'gobbler', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'P1', 'Tic-Tac-Toe', 'GOBBLER');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P2');

    await setPerspectiveBadge(p1, '🎥 P1 — Role: Gobbler X', '#fde047');
    await setPerspectiveBadge(p2, '🎥 P2 — Role: Gobbler O', '#86efac');

    await expect(p1.getByText('P2')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(800);

    await p1.locator('button', { hasText: /Join X|เข้าร่วม X/i }).click();
    await p2.locator('button', { hasText: /Join O|เข้าร่วม O/i }).click();

    await expect(p1.locator('[data-testid="gobbler-cell-0"]')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(800);

    // Showcase signature Gobbler mechanic (larger piece gobbling smaller piece on cell 4)
    // followed by diagonal 0 -> 4 -> 8 victory for X:
    await p1.locator('[data-testid="gobbler-inventory-X-stack-0"]').click(); // Small X
    await p1.locator('[data-testid="gobbler-cell-4"]').click();

    await p2.locator('[data-testid="gobbler-inventory-O-stack-1"]').click(); // Medium O gobbles Small X!
    await p2.locator('[data-testid="gobbler-cell-4"]').click();

    await p1.locator('[data-testid="gobbler-inventory-X-stack-2"]').click(); // Large X gobbles Medium O!
    await p1.locator('[data-testid="gobbler-cell-4"]').click();

    await p2.locator('[data-testid="gobbler-inventory-O-stack-2"]').click(); // Large O on 1
    await p2.locator('[data-testid="gobbler-cell-1"]').click();

    await p1.locator('[data-testid="gobbler-inventory-X-stack-2"]').click(); // Large X on 0
    await p1.locator('[data-testid="gobbler-cell-0"]').click();

    await p2.locator('[data-testid="gobbler-inventory-O-stack-2"]').click(); // Large O on 2
    await p2.locator('[data-testid="gobbler-cell-2"]').click();

    await p1.locator('[data-testid="gobbler-inventory-X-stack-1"]').click(); // Medium X on 8 -> X wins!
    await p1.locator('[data-testid="gobbler-cell-8"]').click();

    await watchResultReveal(pages);
    await p1.locator('[data-testid="winner-banner"]').waitFor({ state: 'visible', timeout: 10000 });
    await p2.locator('[data-testid="winner-banner"]').waitFor({ state: 'visible', timeout: 10000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('gobbler', ctxs, pages);
  });

  // ─── 4. Hand Duel (RPS) ──────────────────────────────────────────────────
  test('Hand Duel (RPS) Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'rps', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Rocky', 'Hand Duel');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Paper');

    await setPerspectiveBadge(p1, '🎥 Rocky — Role: Challenger (Host)', '#fde047');
    await setPerspectiveBadge(p2, '🎥 Paper — Role: Contender', '#a5f3fc');

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    // Round 1: Rock vs Paper
    await expect(p1.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 8000 });
    await p1.locator('button', { hasText: '✊' }).click();
    await p2.locator('button', { hasText: '✋' }).click();
    await expect(p1.getByText('Paper Wins the Round!')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(1200);

    // Advance to Round 2
    const nextRound = p1.getByRole('button', { name: /Next Round/i });
    await expect(nextRound).toBeVisible({ timeout: 5000 });
    await nextRound.click();

    // Round 2: Scissors vs Rock -> Match Point
    await expect(p2.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 8000 });
    await p1.locator('button', { hasText: '✌️' }).click();
    await p2.locator('button', { hasText: '✊' }).click();

    await watchResultReveal(pages);
    await expect(p1.getByText(/Wins the Match!/i)).toBeVisible({ timeout: 12000 });
    await expect(p2.getByText(/Wins the Match!/i)).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('rps', ctxs, pages);
  });

  // ─── 5. Who Am I ─────────────────────────────────────────────────────────
  test('Who Am I Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'whoami', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Amy', 'Who Am I');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await setPerspectiveBadge(p1, '🎥 Amy — Role: Word Writer & Guesser', '#f9a8d4');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Word Writer & Voter', '#a5f3fc');

    await p1.waitForTimeout(1000);

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

    const startBtn = p1.getByRole('button', { name: /Start Game/i }).first();
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();

    await expect(p1.locator('#playerWordInput')).toBeVisible({ timeout: 10000 });
    await expect(p2.locator('#playerWordInput')).toBeVisible({ timeout: 10000 });

    await p1.locator('#playerWordInput').fill('Elephant');
    await p1.getByRole('button', { name: /Submit Word/i }).click();
    await expect(p1.getByText('Word submitted!')).toBeVisible({ timeout: 5000 });

    await p2.locator('#playerWordInput').fill('Tiger');
    await p2.getByRole('button', { name: /Submit Word/i }).click();

    // Pause so viewer sees that Amy sees Bob's word and Bob sees Amy's word (own word is ???)
    await p1.waitForTimeout(1800);

    const guessBtnP1 = p1.getByRole('button', { name: /Guess the Word!/i });
    const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
    await waitForAnyVisible([guessBtnP1, guessBtnP2]);
    const activePage = (await guessBtnP1.isVisible().catch(() => false)) ? p1 : p2;
    const voterPage = activePage === p1 ? p2 : p1;

    await setPerspectiveBadge(
      activePage,
      `🎥 ${activePage === p1 ? 'Amy' : 'Bob'} — Role: Active Guesser (Word Hidden: ???)`,
      '#fde047',
    );
    await setPerspectiveBadge(
      voterPage,
      `🎥 ${voterPage === p1 ? 'Amy' : 'Bob'} — Role: Judge / Voter (Sees True Word)`,
      '#86efac',
    );

    await activePage.getByRole('button', { name: /Guess the Word!/i }).click();
    const guessInput = activePage.locator('#guessWordInput');
    await guessInput.waitFor({ state: 'visible', timeout: 8000 });
    await guessInput.fill(activePage === p1 ? 'Tiger' : 'Elephant');
    await activePage.getByRole('button', { name: /Submit Guess/i }).click();

    await expect(activePage.getByText('Word Guess')).toBeVisible({ timeout: 10000 });
    await voterPage.waitForTimeout(1000);
    await voterPage.getByRole('button', { name: /YES/i }).click();

    await activePage.getByRole('button', { name: /Continue/i }).click();

    await watchResultReveal(pages);
    await expect(p1.getByText('Game Over').first()).toBeVisible({ timeout: 12000 });
    await expect(p2.getByText('Game Over').first()).toBeVisible({ timeout: 8000 });
    await expect(p1.getByText('Elephant').first()).toBeVisible();
    await expect(p1.getByText('Tiger').first()).toBeVisible();
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('whoami', ctxs, pages);
  });

  // ─── 6. Who First ────────────────────────────────────────────────────────
  test('Who First Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'whofirst', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Alice', 'Who First');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await setPerspectiveBadge(p1, '🎥 Alice — Role: Host & Reflex Competitor', '#6ee7b7');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Reflex Competitor', '#a5f3fc');

    await p1.waitForTimeout(800);

    await p1.getByLabel('Min Countdown (s)').fill('1');
    await p1.getByLabel('Max Countdown (s)').fill('1');
    await p1.getByLabel('Number of Rounds').fill('2');

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

    await p1.getByTestId('start-btn').click();

    for (let round = 1; round <= 2; round++) {
      await p1.getByTestId('status-go').waitFor({ state: 'visible', timeout: 20000 });
      await p2.getByTestId('status-go').waitFor({ state: 'visible', timeout: 20000 });

      if (round === 1) {
        await p1.getByTestId('press-btn').click();
        await p1.waitForTimeout(250);
        await p2.getByTestId('press-btn').click();
      } else {
        await p2.getByTestId('press-btn').click();
        await p2.waitForTimeout(250);
        await p1.getByTestId('press-btn').click();
      }

      await watchResultReveal(pages);
      await expect(p1.getByTestId('round-result-title')).toBeVisible({ timeout: 12000 });
      await p1.waitForTimeout(1000);

      if (round < 2) {
        await p1.getByRole('button', { name: /Next Round/i }).click();
        await p1.waitForTimeout(800);
      }
    }

    await p1.getByRole('button', { name: /Next Round/i }).click();
    await watchResultReveal(pages);
    await expect(p1.getByText('Final Result')).toBeVisible({ timeout: 12000 });
    await expect(p2.getByText('Final Result')).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('whofirst', ctxs, pages);
  });

  // ─── 7. Knowguise (Who Know) ─────────────────────────────────────────────
  test('Knowguise Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'whoknow', 4);
    const [p1, p2, p3, p4] = pages;

    const roomCode = await createRoom(p1, 'Host', 'Knowguise');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');
    await joinRoom(p3, origin, roomCode, 'P2');
    await joinRoom(p4, origin, roomCode, 'P3');

    await setPerspectiveBadge(p1, '🎥 Host — Role: Lobby Host', '#c4b5fd');
    await setPerspectiveBadge(p2, '🎥 P1 — Waiting for Role...', '#e2e8f0');
    await setPerspectiveBadge(p3, '🎥 P2 — Waiting for Role...', '#e2e8f0');
    await setPerspectiveBadge(p4, '🎥 P3 — Waiting for Role...', '#e2e8f0');
    await p1.waitForTimeout(1000);

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
        .locator('button', { hasText: /Fixed|Room Creator|คงที่/i })
        .first()
        .click();
    }

    const timerInput = p1.locator('input[name="timerMin"]');
    if (await timerInput.isVisible().catch(() => false)) {
      await timerInput.fill('1');
    }

    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/i });
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();

    const wordInputModal = p1.locator('#secretWordModalInput');
    await wordInputModal.waitFor({ state: 'visible', timeout: 8000 });
    await wordInputModal.fill('Banana');
    await wordInputModal.press('Enter');

    await p1.waitForTimeout(1500);

    // Label each player's secret role on their badge and find the Insider
    let insiderSocketId = '';
    let seekerSocketId = '';
    const names = ['Host', 'P1', 'P2', 'P3'];
    for (let i = 0; i < pages.length; i++) {
      const info = await pages[i].evaluate(() => {
        const st = (window as any).__useGameStore.getState();
        return { role: st.myRole as string, socketId: st.socketId as string };
      });
      if (info.role === 'Host') {
        await setPerspectiveBadge(pages[i], `🎥 ${names[i]} — Role: Word Keeper (Host)`, '#fde047');
      } else if (info.role === 'Know') {
        insiderSocketId = info.socketId;
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Hidden Guide / Insider (Knows "Banana")`,
          '#fca5a5',
        );
      } else {
        seekerSocketId = info.socketId;
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Seeker (Word Hidden)`,
          '#86efac',
        );
      }
    }

    // Hold so viewer sees Questioning phase across all 3 role types
    await p1.waitForTimeout(2000);

    const endBtn = p1
      .locator('button')
      .filter({ hasText: /Word Guessed/i })
      .first();
    await endBtn.waitFor({ state: 'visible', timeout: 15000 });
    await endBtn.click();

    // Non-host players vote (Seekers catch the Insider!)
    for (const page of [p2, p3, p4]) {
      const mySocket = await page.evaluate(
        () => (window as any).__useGameStore.getState().socketId,
      );
      const targetId = mySocket === insiderSocketId ? seekerSocketId : insiderSocketId;
      const specificBtn = page.getByTestId(`wk-vote-target-${targetId}`);
      if (await specificBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await specificBtn.click();
      } else {
        const fallback = page.locator('[data-testid^="wk-vote-target-"]').first();
        if (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fallback.click();
        }
      }
    }

    await watchResultReveal(pages);
    for (const page of pages) {
      await expect(page.getByText('Game Results')).toBeVisible({ timeout: 15000 });
    }
    await expect(p1.getByText(/Hidden Guide Wins!|Seekers Win!/i).first()).toBeVisible({
      timeout: 10000,
    });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('whoknow', ctxs, pages);
  });

  // ─── 8. GuiseGuess (Sounds Fishy) ────────────────────────────────────────
  test('GuiseGuess Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'soundsfishy', 3);
    const [p1, p2, p3] = pages;
    const names = ['FishHost', 'F1', 'F2'];

    const roomCode = await createRoom(p1, 'FishHost', 'GuiseGuess');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'F1');
    await joinRoom(p3, origin, roomCode, 'F2');

    // Switch room language to TH so Thai DB trivia questions are loaded
    await p1.getByText('TH', { exact: true }).click();

    await expect(p1.getByText('F1')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('F2')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(800);

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();
    await p1.waitForTimeout(1800);

    // Label each player's role (Picker, Blue Fish, Red Herring)
    for (let i = 0; i < pages.length; i++) {
      const roleInfo = await pages[i].evaluate(() => {
        const st = (window as any).__useGameStore.getState();
        const sf = st.room?.soundsFishyState;
        const me = st.socketId;
        if (sf?.pickerId === me) return 'PICKER';
        if (sf?.blueFishId === me) return 'BLUE_FISH';
        return 'RED_HERRING';
      });
      if (roleInfo === 'PICKER') {
        await setPerspectiveBadge(pages[i], `🎥 ${names[i]} — Role: Picker (นักสืบ)`, '#fde047');
      } else if (roleInfo === 'BLUE_FISH') {
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Blue Fish (ปลาฟ้า - คำตอบจริง)`,
          '#7dd3fc',
        );
      } else {
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Red Herring (ปลาแดง - คำตอบหลอก)`,
          '#fca5a5',
        );
      }
    }

    // Blue Fish submits true answer; Red Herring writes fake answer
    for (const page of pages) {
      const trueBtn = page.getByTestId('fishy-submit-true-answer');
      if (await trueBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await trueBtn.click();
        continue;
      }
      const input = page.locator('#answerInput');
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) {
        await input.fill('คำตอบหลอกๆ ที่แต่งขึ้นมาเอง');
        await page
          .locator('button')
          .filter({ hasText: /Submit Answer|ส่งคำตอบ/i })
          .first()
          .click();
      }
    }
    await p1.waitForTimeout(1500);

    // Picker flips all hidden answers, eliminates one, and banks points
    let pickerPage: Page = p1;
    for (const page of pages) {
      const isPicker = await page.evaluate(() => {
        const st = (window as any).__useGameStore.getState();
        return st.room?.soundsFishyState?.pickerId === st.socketId;
      });
      if (isPicker) {
        pickerPage = page;
        break;
      }
    }

    for (let i = 0; i < 4; i++) {
      const revealBtns = pickerPage
        .locator('button')
        .filter({ hasText: /Reveal Answer|เปิดคำตอบ/i });
      if ((await revealBtns.count()) === 0) break;
      await revealBtns.first().click();
      await pickerPage.waitForTimeout(1200);
    }

    const eliminateBtn = pickerPage
      .locator('button')
      .filter({ hasText: /Reject this answer|คัดคำตอบนี้ออก/i })
      .first();
    await expect(eliminateBtn).toBeVisible({ timeout: 10000 });
    await eliminateBtn.click();

    const bankBtn = pickerPage
      .locator('button')
      .filter({ hasText: /Bank|รับคะแนน/i })
      .first();
    if (
      await bankBtn
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await bankBtn.click();
    }

    await watchResultReveal(pages);
    for (const page of pages) {
      await expect(page.getByText(/Round Over|จบรอบ/i).first()).toBeVisible({ timeout: 15000 });
    }
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('soundsfishy', ctxs, pages);
  });

  // ─── 9. Countaline (The Mind) ────────────────────────────────────────────
  test('Countaline Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'themind', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Host', 'Countaline');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');

    await setPerspectiveBadge(p1, '🎥 Host — Role: Telepathic Partner 1', '#fed7aa');
    await setPerspectiveBadge(p2, '🎥 P1 — Role: Telepathic Partner 2', '#bbf7d0');
    await p1.waitForTimeout(800);

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

    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    for (const page of pages) {
      const readyBtn = page.locator('button', { hasText: /^Ready$/ }).first();
      await readyBtn.waitFor({ state: 'visible', timeout: 10000 });
      await readyBtn.click();
    }
    await p1.waitForTimeout(1200);

    for (let i = 0; i < 60; i++) {
      if (
        (await p1
          .getByTestId('result-reveal')
          .isVisible()
          .catch(() => false)) ||
        (await p1
          .getByText('You Win!')
          .isVisible()
          .catch(() => false))
      )
        break;

      const nextLevelBtn = p1.locator('button', { hasText: /Next Level/i }).first();
      if (await nextLevelBtn.isVisible().catch(() => false)) {
        await nextLevelBtn.click();
        await p1.waitForTimeout(1200);
        continue;
      }

      for (const page of pages) {
        const readyBtn = page.locator('button', { hasText: /^Ready$/ }).first();
        if (await readyBtn.isVisible().catch(() => false)) {
          await readyBtn.click();
        }
      }

      const c1 = await lowestEnabledCard(p1);
      const c2 = await lowestEnabledCard(p2);
      if (c1 === null && c2 === null) {
        await p1.waitForTimeout(600);
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
      await p1.waitForTimeout(800);
    }

    await watchResultReveal(pages);
    await expect(p1.getByText('You Win!')).toBeVisible({ timeout: 12000 });
    await expect(p2.getByText('You Win!')).toBeVisible({ timeout: 8000 });
    await expect(p1.getByText('Final Scores')).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('themind', ctxs, pages);
  });

  // ─── 10. Cluecanvas (Detective Club) ─────────────────────────────────────
  test('Cluecanvas Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'detectiveclub', 3);
    const [p1, p2, p3] = pages;
    const names = ['DetHost', 'D1', 'D2'];

    const roomCode = await createRoom(p1, 'DetHost', 'Cluecanvas');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'D1');
    await joinRoom(p3, origin, roomCode, 'D2');
    await p1.waitForTimeout(1000);

    for (const name of ['D1', 'D2']) {
      await expect(p1.getByText(name, { exact: true })).toBeVisible({ timeout: 8000 });
    }

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();
    await p1.waitForTimeout(2000);

    // Informer submits the secret word
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const wordInput = page.locator('input').first();
      if (await wordInput.isVisible({ timeout: 2500 }).catch(() => false)) {
        await setPerspectiveBadge(
          page,
          `🎥 ${names[i]} — Role: Informer (ผู้ให้เบาะแส - ตั้งคำลับ)`,
          '#fde047',
        );
        await wordInput.fill('Mystery');
        const confirmBtn = page.locator('button', { hasText: /Confirm|Submit|ยืนยัน/i }).first();
        await confirmBtn.click();
        break;
      }
    }
    await p1.waitForTimeout(1500);

    // Label Detective vs Conspirator based on whether they received the secret word
    let conspiratorName = '';
    for (let i = 0; i < pages.length; i++) {
      const info = await pages[i].evaluate(() => {
        const st = (window as any).__useGameStore.getState();
        const dc = st.room?.detectiveClubState;
        const me = st.socketId;
        const isInformer = dc?.informerId === me;
        const bodyText = document.body.innerText;
        const seesWord = bodyText.includes('Mystery');
        return { isInformer, seesWord };
      });
      if (info.isInformer) {
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Informer (Word: "Mystery")`,
          '#fde047',
        );
      } else if (info.seesWord) {
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Detective (Word: "Mystery")`,
          '#86efac',
        );
      } else {
        conspiratorName = names[i];
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: Conspirator (No Word! Must Bluff)`,
          '#fca5a5',
        );
      }
    }

    // Play 2 rounds of illustration cards until Discussion phase
    for (let turn = 0; turn < 15; turn++) {
      const discussionReady = p1.locator('button', { hasText: /Start Voting|เริ่มโหวต/i }).first();
      if (await discussionReady.isVisible().catch(() => false)) break;

      let played = false;
      for (const page of pages) {
        const activeIndicator = page.getByText(/Your Turn - Play a Card|ตาคุณ/i);
        if (await activeIndicator.isVisible({ timeout: 800 }).catch(() => false)) {
          const handCard = page
            .getByRole('button', { name: /Play card \d+|เล่นการ์ด \d+/i })
            .first();
          if (await handCard.isVisible({ timeout: 1500 }).catch(() => false)) {
            await handCard.click().catch(() => {});
          }
          const playBtn = page.locator('button', { hasText: /Play Card|วางการ์ด/i }).last();
          await playBtn.waitFor({ state: 'visible', timeout: 3000 });
          await playBtn.click();
          await page.waitForTimeout(800);
          played = true;
          break;
        }
      }
      if (!played) await p1.waitForTimeout(500);
    }

    // Start Voting
    for (const page of pages) {
      const continueBtn = page.locator('button', { hasText: /Start Voting|เริ่มโหวต/i }).first();
      if (await continueBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueBtn.click();
        break;
      }
    }

    // Detectives vote for the Conspirator
    for (const page of pages) {
      const targetBtn = conspiratorName
        ? page
            .locator('button')
            .filter({ hasText: new RegExp(conspiratorName, 'i') })
            .first()
        : page
            .locator('button')
            .filter({ hasText: /D1|D2|DetHost/i })
            .first();
      const voteBtn = page.locator('button', { hasText: /Confirm Vote|ยืนยันการโหวต/i }).first();
      if (
        (await targetBtn.isVisible({ timeout: 2500 }).catch(() => false)) &&
        (await voteBtn.isVisible().catch(() => false))
      ) {
        await targetBtn.click();
        await page.waitForTimeout(400);
        await voteBtn.click();
        await page.waitForTimeout(400);
      } else {
        const fallback = page
          .locator('button')
          .filter({ hasText: /D1|D2|DetHost/i })
          .first();
        if (
          (await fallback.isVisible().catch(() => false)) &&
          (await voteBtn.isVisible().catch(() => false))
        ) {
          await fallback.click();
          await page.waitForTimeout(400);
          await voteBtn.click();
        }
      }
    }

    await watchResultReveal(pages);
    for (const page of pages) {
      await expect(page.getByText(/Round Over/).first()).toBeVisible({ timeout: 15000 });
    }
    await expect(p1.getByText('Scoreboard').first()).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('detectiveclub', ctxs, pages);
  });

  // ─── 11. Music Trivia ────────────────────────────────────────────────────
  test('Music Trivia Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'musictrivia', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Alice', 'Music Trivia');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await setPerspectiveBadge(p1, '🎥 Alice — Role: Host / DJ', '#c4b5fd');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Contestant (Buzzer)', '#fde047');
    await p1.waitForTimeout(1000);

    // Use the seeded E2E artist preset (`e2e-artist`) in GAME_MASTER mode for fast, deterministic play
    await p1.evaluate(() => {
      (window as any).__useGameStore.getState().updateConfig({
        musicTriviaArtistPresetId: 'e2e-artist',
        musicTriviaMode: 'GAME_MASTER',
        musicTriviaHostPlays: false,
        musicTriviaRounds: 1,
      });
    });
    await p1.waitForTimeout(800);

    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await startBtn.waitFor({ state: 'visible', timeout: 10000 });
    await startBtn.click();

    const readyBtn = p2.getByRole('button', { name: /I'm Ready!|ฉันพร้อมแล้ว/i });
    await readyBtn.waitFor({ state: 'visible', timeout: 15000 });
    await readyBtn.click();

    const startSongBtn = p1.getByRole('button', { name: /Start Song \(Countdown\)/i });
    await startSongBtn.waitFor({ state: 'visible', timeout: 15000 });
    await startSongBtn.click();

    // Wait for countdown to enter PLAYING phase, then Contestant buzzes in
    const buzzBtn = p2.locator('button').filter({ hasText: /BUZZ!/i }).first();
    await buzzBtn.waitFor({ state: 'visible', timeout: 15000 });
    await p2.waitForTimeout(1200);
    await buzzBtn.click();

    // Host judges the answer Correct!
    const correctBtn = p1
      .locator('button')
      .filter({ hasText: /Correct|ถูกต้อง/i })
      .first();
    if (await correctBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await p1.waitForTimeout(800);
      await correctBtn.click();
    } else {
      await p1.evaluate(() => {
        (window as any).__useGameStore
          .getState()
          .musicTriviaGameAction({ type: 'HOST_JUDGE', correct: true });
      });
    }

    // Watch round answer reveal
    await watchResultReveal(pages);
    await p1.waitForTimeout(1200);

    // Advance to final match result (1 round configured -> Finish / End Game)
    const nextOrFinish = p1.getByTestId('music-next-round');
    if (await nextOrFinish.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextOrFinish.click();
    } else {
      const endGameBtn = p1
        .locator('button')
        .filter({ hasText: /End Game/i })
        .first();
      if (await endGameBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await endGameBtn.click();
      }
    }

    await watchResultReveal(pages);
    await expect(p1.getByText('Game Over!')).toBeVisible({ timeout: 15000 });
    await expect(p2.getByText('Game Over!')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('musictrivia', ctxs, pages);
  });

  // ─── 12. Saboteur ────────────────────────────────────────────────────────
  test('Saboteur Demo', async ({ browser }) => {
    // 5 players guarantees at least 1 Saboteur and at least 3 Miners in the 6-card pool
    const { ctxs, pages } = await createRecordedPlayers(browser, 'saboteur', 5);
    const [p1, p2, p3, p4, p5] = pages;
    const names = ['MinHost', 'Digger', 'Sneaky', 'Pickaxe', 'Lantern'];

    const roomCode = await createRoom(p1, 'MinHost', 'Saboteur');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Digger');
    await joinRoom(p3, origin, roomCode, 'Sneaky');
    await joinRoom(p4, origin, roomCode, 'Pickaxe');
    await joinRoom(p5, origin, roomCode, 'Lantern');

    for (const name of names.slice(1)) {
      await expect(
        p1.getByTestId('game-players-panel').getByText(name, { exact: true }),
      ).toBeVisible({ timeout: 10000 });
    }

    const startBtn = p1
      .locator('button')
      .filter({ hasText: /Start Game|เริ่มเกม/i })
      .first();
    await startBtn.waitFor({ state: 'visible', timeout: 8000 });
    await startBtn.click();

    await expect(p1.locator('[data-testid="saboteur-cell-0,2"]')).toBeVisible({ timeout: 20000 });
    await p1.waitForTimeout(1000);

    // Label each player's secret role (Gold Miner vs Saboteur) and pick 4 panes (including Saboteur)
    const saboteurIndices: number[] = [];
    const minerIndices: number[] = [];
    for (let i = 0; i < pages.length; i++) {
      const role = await pages[i].evaluate(() => {
        return (window as any).__useGameStore?.getState?.()?.privateState?.sbRole as string;
      });
      if (role === 'SABOTEUR') {
        saboteurIndices.push(i);
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: 💣 Saboteur (ผู้ขัดขวาง)`,
          '#fca5a5',
        );
      } else {
        minerIndices.push(i);
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: ⛏️ Gold Miner (คนขุดทอง)`,
          '#fde047',
        );
      }
    }

    async function clickBestCell(page: Page, junk: boolean): Promise<string | null> {
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
            return true;
          }
        }

        const order = store.hand
          .map((cardId, idx) => ({ cardId, idx }))
          .sort((a, b) => {
            const aPath = a.cardId.startsWith('path-') ? 0 : 1;
            const bPath = b.cardId.startsWith('path-') ? 0 : 1;
            return aPath - bPath;
          });

        const handBtns = page.locator('[data-testid^="saboteur-hand-"]');
        for (const { cardId, idx } of order) {
          if (cardId === 'action-map' && store.peeked >= 3) continue;
          const junk = cardId.startsWith('path-') && !cardId.endsWith('c');
          const card = handBtns.nth(idx);
          if (!(await card.isEnabled().catch(() => false))) continue;
          await card.click();
          await page.waitForTimeout(120);

          const cellId = await clickBestCell(page, junk);
          if (cellId) return true;

          const rotateBtn = page.locator('button', { hasText: /180°/ }).first();
          if (await rotateBtn.isVisible().catch(() => false)) {
            await rotateBtn.click();
            await page.waitForTimeout(100);
            const rotId = await clickBestCell(page, junk);
            if (rotId) return true;
          }
        }

        const discardBtn = page
          .locator('button')
          .filter({ hasText: /Discard|ทิ้ง/i })
          .first();
        if (!(await discardBtn.isVisible().catch(() => false))) {
          await handBtns.first().click();
          await discardBtn.waitFor({ state: 'visible', timeout: 3000 });
        }
        await discardBtn.click();
        return true;
      }
      return false;
    }

    async function tryPickGold(): Promise<boolean> {
      for (const page of pages) {
        const goldBtn = page
          .locator('button[data-testid^="saboteur-gold-"]:not([disabled])')
          .first();
        if (!(await goldBtn.isVisible().catch(() => false))) continue;
        await goldBtn.click();
        return true;
      }
      return false;
    }

    // Play 1 full round from start (0,2) to Gold Pick -> Round End Role Reveal
    for (let step = 0; step < 160; step++) {
      const phase = await p1
        .evaluate(
          () => (window as any).__useGameStore?.getState?.()?.room?.saboteurState?.currentPhase,
        )
        .catch(() => '');
      if (phase === 'ROUND_END' || phase === 'GAME_OVER') break;

      if (await tryPickGold()) {
        await p1.waitForTimeout(400);
        continue;
      }
      if (!(await playOneTurn())) {
        await p1.waitForTimeout(400);
      }
    }

    // Watch synchronized ROLES reveal (shows who was Miner and who was Saboteur!)
    await watchResultReveal(pages);
    await expect(p1.getByTestId('saboteur-round-result')).toBeVisible({ timeout: 15000 });
    await p1.waitForTimeout(3000);

    const selected = [...new Set([0, ...saboteurIndices, ...minerIndices])].slice(0, 4);
    await finalizeDemoVideo('saboteur', ctxs, pages, selected);
  });

  // ─── 13. Golden Sand House (Coup) ────────────────────────────────────────
  test('Golden Sand House Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'coup', 3);
    const [p1, p2, p3] = pages;
    const names = ['Alice', 'Bob', 'Charlie'];

    const roomCode = await createRoom(p1, 'Alice', 'Golden Sand House');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');
    await joinRoom(p3, origin, roomCode, 'Charlie');

    await expect(p1.getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText('Charlie')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(800);

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    await expect(p1.getByText(/Golden Sand House — Inheritance feud/i)).toBeVisible({
      timeout: 10000,
    });

    // Update each player's badge with their secret character influences
    const updateCoupBadges = async () => {
      for (let i = 0; i < pages.length; i++) {
        const info = await pages[i].evaluate(() => {
          const st = (window as any).__useGameStore?.getState?.();
          const hand = (st?.privateState?.coupHand ?? []) as string[];
          const count = st?.room?.coupState?.influences?.[st.socketId]?.count ?? 0;
          return { hand, count };
        });
        const label =
          info.count > 0
            ? `🎥 ${names[i]} — Influences (${info.count}): ${info.hand.join(' & ')}`
            : `🎥 ${names[i]} — Eliminated 💀`;
        await setPerspectiveBadge(pages[i], label, info.count > 0 ? '#fecdd3' : '#cbd5e1');
      }
    };
    await updateCoupBadges();
    await p1.waitForTimeout(1200);

    // Play a complete match using Income, Tax, Challenges, and Coup until 1 heir remains
    let turnCount = 0;
    for (let step = 0; step < 120; step++) {
      const phase = await p1
        .evaluate(() => (window as any).__useGameStore?.getState?.()?.room?.coupState?.phase)
        .catch(() => '');
      if (phase === 'RESULT') break;

      // Resolve any pending Challenge / Block immediately so the match finishes briskly
      let responded = false;
      for (const page of pages) {
        const chBtn = page
          .locator(
            '[data-testid="coup-challenge-button"], [data-testid="coup-challenge-block-button"]',
          )
          .first();
        if (await chBtn.isVisible().catch(() => false)) {
          await page.waitForTimeout(500);
          await chBtn.click().catch(() => {});
          await updateCoupBadges();
          responded = true;
          break;
        }
      }
      if (responded) {
        await p1.waitForTimeout(500);
        continue;
      }

      // Find the player whose turn it is
      let turnPage: Page | null = null;
      for (const page of pages) {
        if (
          await page
            .locator('[data-testid="coup-action-area"]')
            .getByText(/Your turn|ตาของคุณ/i)
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          turnPage = page;
          break;
        }
      }
      if (!turnPage) {
        await p1.waitForTimeout(300);
        continue;
      }

      turnCount++;
      const actionArea = turnPage.locator('[data-testid="coup-action-area"]');
      const selects = actionArea.locator('select');

      // Turn 1: show basic Income ("Polish stairs")
      if (turnCount === 1) {
        const incBtn = actionArea.getByRole('button', { name: /Polish stairs|ขัดบันได/i });
        if (await incBtn.isEnabled().catch(() => false)) {
          await incBtn.click();
          await p1.waitForTimeout(600);
          continue;
        }
      }

      // If 7+ coins, perform Coup ("Reveal the real will")
      const coupSelect = selects.last();
      const optionCount = await coupSelect.locator('option').count();
      if (optionCount > 1) {
        await coupSelect.selectOption({ index: 1 });
      }
      const coupBtn = actionArea.getByRole('button', {
        name: /Reveal the real will|กางพินัยกรรมตัวจริง/i,
      });
      if (await coupBtn.isEnabled().catch(() => false)) {
        await coupBtn.click();
        await updateCoupBadges();
        await p1.waitForTimeout(600);
        continue;
      }

      // Otherwise declare Tax ("Maintenance fee") which triggers a Challenge!
      const taxBtn = actionArea.getByRole('button', {
        name: /Maintenance fee|ค่าบำรุงบ้าน/i,
      });
      if (await taxBtn.isEnabled().catch(() => false)) {
        await taxBtn.click();
        await p1.waitForTimeout(600);
      }
    }

    await updateCoupBadges();
    await watchResultReveal(pages);
    await expect(p1.locator('[data-testid="coup-winner-banner"]')).toBeVisible({ timeout: 15000 });
    await expect(p2.locator('[data-testid="coup-winner-banner"]')).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('coup', ctxs, pages);
  });

  // ─── 14. Banana Thief ────────────────────────────────────────────────────
  test('Banana Thief Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'banana-thief', 4);
    const [p1, p2, p3, p4] = pages;
    const names = ['Alice', 'Bob', 'Carol', 'Dave'];

    const roomCode = await createRoom(p1, 'Alice', 'Banana Thief');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');
    await joinRoom(p3, origin, roomCode, 'Carol');
    await joinRoom(p4, origin, roomCode, 'Dave');
    await expect(p1.getByText('Bob').first()).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(800);

    // Configure Fast Night Clock (3s per tick)
    const tickSelect = p1.locator('#bananaThiefTickSelect');
    if (await tickSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tickSelect.click();
      await p1
        .locator('button')
        .filter({ hasText: /Fast|เร็ว/i })
        .last()
        .click();
      await p1.waitForTimeout(400);
    }

    const startBtn = p1
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await startBtn.click().catch(() => {});
      await p1.waitForTimeout(800);
      if (!(await startBtn.isVisible().catch(() => false))) break;
    }

    // SETUP: everyone rolls their wake hour
    for (const p of pages) {
      const rollBtn = p.getByTestId('banana-thief-roll');
      await expect(rollBtn).toBeVisible({ timeout: 15000 });
      await rollBtn.click();
    }
    await p1.waitForTimeout(600);
    const rerollBtn = p1.getByTestId('banana-thief-reroll');
    if (await rerollBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rerollBtn.click();
    }

    // Update badges with each player's secret role (Banana Thief vs Monkey)
    const updateBtBadges = async () => {
      for (let i = 0; i < pages.length; i++) {
        const info = await pages[i].evaluate(() => {
          const st = (window as any).__useGameStore?.getState?.();
          const btPriv = st?.privateState?.btPlayer;
          return {
            isThief: Boolean(btPriv?.isThief),
            isFollower: Boolean(btPriv?.isFollower),
            trueHour: btPriv?.trueHour,
          };
        });
        if (info.isThief) {
          await setPerspectiveBadge(
            pages[i],
            `🎥 ${names[i]} — Role: 🍌 Banana Thief (Wake ${info.trueHour ?? '?'}:00)`,
            '#fde047',
          );
        } else if (info.isFollower) {
          await setPerspectiveBadge(
            pages[i],
            `🎥 ${names[i]} — Role: 🤝 Thief Follower (Wake ${info.trueHour ?? '?'}:00)`,
            '#fca5a5',
          );
        } else {
          await setPerspectiveBadge(
            pages[i],
            `🎥 ${names[i]} — Role: 🐒 Guard Monkey (Wake ${info.trueHour ?? '?'}:00)`,
            '#bef264',
          );
        }
      }
    };
    await updateBtBadges();

    for (const p of pages) {
      const readyBtn = p.getByTestId('banana-thief-ready');
      await expect(readyBtn).toBeVisible({ timeout: 15000 });
      await readyBtn.click();
    }

    // During Night: when the Thief's follower picker appears, pick a Follower immediately!
    const startVoteBtn = p1.getByRole('button', { name: /Start the vote now/i });
    for (let step = 0; step < 60; step++) {
      if (await startVoteBtn.isVisible().catch(() => false)) break;
      for (const p of pages) {
        const followerChoice = p.locator('button:has-text("แตะเพื่อเลือก")').first();
        if (await followerChoice.isVisible().catch(() => false)) {
          await p.waitForTimeout(600);
          await followerChoice.click().catch(() => {});
          await updateBtBadges();
          break;
        }
      }
      await p1.waitForTimeout(500);
    }

    await expect(startVoteBtn).toBeVisible({ timeout: 45000 });
    await updateBtBadges();
    await p1.waitForTimeout(1200);
    await startVoteBtn.click();

    // Every player votes
    for (const p of pages) {
      const voteButton = p.locator('[data-testid^="banana-thief-vote-"]').first();
      await expect(voteButton).toBeVisible({ timeout: 15000 });
      await voteButton.click();
    }

    await watchResultReveal(pages);
    await expect(
      p1.getByText(/The monkeys win|The thief and Followers win|The thief fled/i).first(),
    ).toBeVisible({ timeout: 20000 });
    for (const p of pages) {
      await expect(p.getByText(/The Banana Thief was|The thief was/i).first()).toBeVisible({
        timeout: 15000,
      });
      await expect(p.getByText(/Everyone's real dice/i)).toBeVisible({ timeout: 15000 });
    }
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('banana-thief', ctxs, pages);
  });

  // ─── 15. Thai Card Game (Pok Deng) ───────────────────────────────────────
  test('Thai Card Game Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'card-game', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Alice', 'Thai Card Game');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    await setPerspectiveBadge(p1, '🎥 Alice — Role: Dealer (เจ้ามือป๊อกเด้ง)', '#fbbf24');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Player (ลูกขา)', '#6ee7b7');

    const startBtn = p1
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await startBtn.click().catch(() => {});
      await p1.waitForTimeout(800);
      if (!(await startBtn.isVisible().catch(() => false))) break;
    }
    await expect(p1.getByText(/Dealer: Alice/)).toBeVisible({ timeout: 15000 });
    await p1.waitForTimeout(1000);

    let totalActionsTaken = 0;
    for (let hand = 0; hand < 3; hand++) {
      for (let i = 0; i < 30; i++) {
        if (
          (await p1
            .getByTestId('result-reveal')
            .isVisible()
            .catch(() => false)) ||
          (await p1
            .getByTestId('card-game-result')
            .isVisible()
            .catch(() => false))
        )
          break;
        const actor = (await p1
          .getByTestId('card-game-actions')
          .isVisible({ timeout: 250 })
          .catch(() => false))
          ? p1
          : (await p2
                .getByTestId('card-game-actions')
                .isVisible({ timeout: 250 })
                .catch(() => false))
            ? p2
            : null;
        if (!actor) {
          await p1.waitForTimeout(300);
          continue;
        }
        const panel = actor.getByTestId('card-game-actions');
        const drawBtn = panel.getByRole('button', { name: 'Draw' });
        const standBtn = panel.getByRole('button', { name: 'Stand' });
        if (totalActionsTaken === 0 && (await drawBtn.isEnabled().catch(() => false))) {
          await drawBtn.click({ timeout: 1500 }).catch(() => {});
        } else {
          await standBtn.click({ timeout: 1500 }).catch(() => {});
        }
        totalActionsTaken++;
        await p1.waitForTimeout(600);
      }

      await watchResultReveal(pages);
      await expect(p1.getByTestId('card-game-result')).toBeVisible({ timeout: 20000 });
      await expect(p2.getByTestId('card-game-result')).toBeVisible({ timeout: 10000 });
      await p1
        .getByTestId('card-game-result')
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      await p2
        .getByTestId('card-game-result')
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      await p1.waitForTimeout(2200);

      // If the hand was an instant Natural Pok 8/9 (0 player decisions), play one more hand to also showcase Draw/Stand
      if (totalActionsTaken > 0) break;
      const nextRoundBtn = p1.getByTestId('card-game-next-round');
      if (await nextRoundBtn.isVisible().catch(() => false)) {
        await nextRoundBtn.click();
        await p1.waitForTimeout(1000);
      } else {
        break;
      }
    }

    await finalizeDemoVideo('card-game', ctxs, pages);
  });

  // ─── 16. Poker (Texas Hold'em) ───────────────────────────────────────────
  test('Poker Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'poker', 2);
    const [p1, p2] = pages;

    const roomCode = await createRoom(p1, 'Alice', 'Poker');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');
    await expect(p1.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    await setPerspectiveBadge(p1, '🎥 Alice — Role: Dealer / Small Blind', '#6ee7b7');
    await setPerspectiveBadge(p2, '🎥 Bob — Role: Big Blind', '#fde047');

    const startBtn = p1.getByText(/Start Game|เริ่มเกม/i);
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();

    await expect(p1.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });
    await expect(p2.getByTestId('poker-table')).toBeVisible({ timeout: 15000 });
    await expect(p1.getByTestId('poker-my-cards')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByTestId('poker-my-cards')).toBeVisible({ timeout: 10000 });

    // Show Hand Rankings reference briefly
    await p1.getByTestId('poker-rankings-toggle').click();
    await expect(p1.getByTestId('poker-rankings-panel')).toBeVisible();
    await p1.waitForTimeout(1500);
    await p1.getByTestId('poker-rankings-toggle').click();

    // Play through Pre-flop, Flop, Turn, River -> Showdown -> Hand Reveal
    for (let i = 0; i < 40; i++) {
      if (
        await p1
          .getByTestId('result-reveal')
          .isVisible()
          .catch(() => false)
      )
        break;

      const revealer = (await p1
        .getByTestId('poker-reveal-panel')
        .isVisible()
        .catch(() => false))
        ? p1
        : (await p2
              .getByTestId('poker-reveal-panel')
              .isVisible()
              .catch(() => false))
          ? p2
          : null;
      if (revealer) {
        await revealer.waitForTimeout(600);
        await revealer
          .getByTestId('poker-show')
          .click({ timeout: 1500 })
          .catch(() => {});
        await p1.waitForTimeout(500);
        continue;
      }

      if (
        await p1
          .getByTestId('poker-next-hand')
          .isVisible()
          .catch(() => false)
      )
        break;

      const actor = (await p1
        .getByTestId('poker-action-panel')
        .isVisible()
        .catch(() => false))
        ? p1
        : (await p2
              .getByTestId('poker-action-panel')
              .isVisible()
              .catch(() => false))
          ? p2
          : null;
      if (!actor) {
        await p1.waitForTimeout(400);
        continue;
      }
      const check = actor.getByTestId('poker-check');
      const call = actor.getByTestId('poker-call');
      if (await check.isVisible().catch(() => false)) await check.click();
      else if (await call.isVisible().catch(() => false)) await call.click();
      await p1.waitForTimeout(600);
    }

    await watchResultReveal(pages);
    await expect(p1.getByTestId('poker-hand-result')).toBeVisible({ timeout: 20000 });
    await expect(p2.getByTestId('poker-hand-result')).toBeVisible({ timeout: 10000 });
    await p1
      .getByTestId('poker-hand-result')
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await p2
      .getByTestId('poker-hand-result')
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await p1.waitForTimeout(2500);

    await finalizeDemoVideo('poker', ctxs, pages);
  });

  // ─── 17. Cipher Grid ─────────────────────────────────────────────────────
  test('Cipher Grid Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'cipher-grid', 4);
    const [solarLead, solarTracker, lunarLead, lunarTracker] = pages;

    const roomCode = await createRoom(solarLead, 'Solar Lead', 'CIPHER_GRID');
    const origin = await getOrigin(solarLead);

    await solarLead.getByTestId('cipher-grid-mode').selectOption('PICTURES');
    await solarLead.getByTestId('cipher-grid-picture-pack').selectOption('MINIMAL');

    await joinRoom(solarTracker, origin, roomCode, 'Solar Operative');
    await joinRoom(lunarLead, origin, roomCode, 'Lunar Lead');
    await joinRoom(lunarTracker, origin, roomCode, 'Lunar Operative');

    await setPerspectiveBadge(
      solarLead,
      '🎥 Solar Lead — Role: ☀️ Spymaster (Sees Keycard)',
      '#fde047',
    );
    await setPerspectiveBadge(
      solarTracker,
      '🎥 Solar Operative — Role: ☀️ Field Agent (Guesser)',
      '#fed7aa',
    );
    await setPerspectiveBadge(
      lunarLead,
      '🎥 Lunar Lead — Role: 🌙 Spymaster (Sees Keycard)',
      '#c4b5fd',
    );
    await setPerspectiveBadge(
      lunarTracker,
      '🎥 Lunar Operative — Role: 🌙 Field Agent (Guesser)',
      '#bae6fd',
    );

    await solarLead.waitForTimeout(800);
    await solarLead.getByRole('button', { name: /Start Game|เริ่มเกม/ }).click();
    await solarLead.locator('[data-testid="ciphergrid-team-setup"]').waitFor({ state: 'visible' });

    await solarLead.getByTestId('join-solar-lead-btn').click();
    await solarTracker.getByTestId('join-solar-tracker-btn').click();
    await lunarLead.getByTestId('join-lunar-lead-btn').click();
    await lunarTracker.getByTestId('join-lunar-tracker-btn').click();
    await solarLead.waitForTimeout(800);

    await expect(solarLead.getByTestId('start-match-btn')).toBeEnabled();
    await solarLead.getByTestId('start-match-btn').click();

    await expect(solarLead.locator('[data-testid="ciphergrid-container"]')).toBeVisible();
    await expect(solarLead.locator('[data-testid^="card-tile-"]')).toHaveCount(20);
    await solarLead.waitForTimeout(1200);

    // Both Spymasters peek their Secret Keycards so their panes show the color-coded grid
    await solarLead.getByTestId('peek-keycard-btn').click();
    await lunarLead.getByTestId('peek-keycard-btn').click();
    await solarLead.waitForTimeout(1500);

    const state = await readCipherState(solarLead);
    const keycard = await solarLead.evaluate(() => {
      const store = (window as any).__useGameStore.getState();
      return store.privateState?.cipherKeycard as string[] | undefined;
    });

    const solarIndices: number[] = [];
    const lunarIndices: number[] = [];
    let assassinIdx = 0;
    keycard?.forEach((type, idx) => {
      if (type === 'SOLAR') solarIndices.push(idx);
      else if (type === 'LUNAR') lunarIndices.push(idx);
      else if (type === 'VIRUS') assassinIdx = idx;
    });

    const solarStarts = state?.currentTeam === 'SOLAR';
    const firstLead = solarStarts ? solarLead : lunarLead;
    const firstTracker = solarStarts ? solarTracker : lunarTracker;
    const firstIndices = solarStarts ? solarIndices : lunarIndices;
    const secondLead = solarStarts ? lunarLead : solarLead;
    const secondTracker = solarStarts ? lunarTracker : solarTracker;
    const secondIndices = solarStarts ? lunarIndices : solarIndices;

    // Turn 1: Starting team Spymaster gives clue -> Operative zooms, pins, reveals 1 card, then ends turn
    await firstLead.getByTestId('clue-word-input').fill('Nature');
    await firstLead.getByTestId('clue-count-select').selectOption('2');
    await firstLead.getByTestId('give-clue-btn').click();

    await expect(firstTracker.getByTestId('current-clue-banner')).toBeVisible();
    await firstTracker.getByTestId(`picture-zoom-${firstIndices[0]}`).click();
    await expect(firstTracker.getByTestId('close-picture-zoom')).toBeVisible();
    await firstTracker.waitForTimeout(1500);
    await firstTracker.getByTestId('close-picture-zoom').click();

    await firstTracker.getByTestId(`card-tile-${firstIndices[0]}`).click();
    await firstTracker.getByTestId('ping-card-btn').click();
    await firstTracker.waitForTimeout(600);
    await firstTracker.getByTestId('reveal-card-btn').click();
    await firstTracker.getByTestId('confirm-reveal-btn').click();
    await firstTracker.waitForTimeout(1200);

    // End first team's turn so the second team also demonstrates Spymaster + Operative play
    await firstTracker.getByTestId('end-turn-btn').click();
    await secondLead.waitForTimeout(800);

    // Turn 2: Second team Spymaster gives clue -> Operative reveals 1 team card, then hits the Assassin!
    await secondLead.getByTestId('clue-word-input').fill('Orbit');
    await secondLead.getByTestId('clue-count-select').selectOption('2');
    await secondLead.getByTestId('give-clue-btn').click();

    await expect(secondTracker.getByTestId('current-clue-banner')).toBeVisible();
    await secondTracker.getByTestId(`card-tile-${secondIndices[0]}`).click();
    await secondTracker.getByTestId('reveal-card-btn').click();
    await secondTracker.getByTestId('confirm-reveal-btn').click();
    await secondTracker.waitForTimeout(1200);

    // Second guess hits the Assassin tile -> dramatic instant victory!
    await secondTracker.getByTestId(`card-tile-${assassinIdx}`).click();
    await secondTracker.getByTestId('reveal-card-btn').click();
    await secondTracker.getByTestId('confirm-reveal-btn').click();

    await watchResultReveal(pages);
    await expect(solarLead.getByTestId('round-end-banner')).toBeVisible({ timeout: 15000 });
    await solarLead.waitForTimeout(2500);

    await finalizeDemoVideo('cipher-grid', ctxs, pages);
  });

  // ─── 18. Who Barks / Dog Relay ───────────────────────────────────────────
  test('Who Barks Demo', async ({ browser }) => {
    const { ctxs, pages } = await createRecordedPlayers(browser, 'dog-relay', 5);
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];

    const roomCode = await createRoom(pages[0], 'Alice', 'Who Barks');
    const origin = await getOrigin(pages[0]);
    for (let i = 1; i < pages.length; i++) {
      await joinRoom(pages[i], origin, roomCode, names[i]);
    }
    await expect(pages[0].getByTestId('dog-relay-seat')).toHaveCount(5);

    // Briefly open the 30-dog character catalog in the lobby
    await pages[0].getByTestId('dog-relay-open-catalog').click();
    await expect(pages[0].getByTestId('dog-relay-catalog')).toBeVisible();
    await pages[0].waitForTimeout(1500);
    await pages[0].keyboard.press('Escape');

    // Start Game -> Secret Role Reveal
    await pages[0].getByRole('button', { name: /Start Game|เริ่มเกม/ }).click();

    let leaderIdx = 0;
    let evilIdx = 1;
    const goodIndices: number[] = [];

    for (let i = 0; i < pages.length; i++) {
      await pages[i].getByTestId('dog-relay-role-reveal').click();
      await expect(pages[i].getByTestId('dog-relay-own-role')).toBeVisible();
      const snap = await relaySnapshot(pages[i]);
      const role = snap.own.role as string;
      if (role === 'LEADER') {
        leaderIdx = i;
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: 👑 Lead Dog (หมาจ่าฝูง - เห็นคู่จริง)`,
          '#fde047',
        );
      } else if (role === 'EVIL') {
        evilIdx = i;
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: 😈 Mischief Dog (หมาป่วน - สลับการ์ดหลอก)`,
          '#fca5a5',
        );
      } else {
        goodIndices.push(i);
        await setPerspectiveBadge(
          pages[i],
          `🎥 ${names[i]} — Role: 🐾 Loyal Dog (หมาซื่อสัตย์)`,
          '#86efac',
        );
      }
    }

    // Hold so viewer sees all 3 secret role cards open simultaneously
    await pages[0].waitForTimeout(1800);

    for (const page of pages) {
      await page.getByTestId('dog-relay-role-ack').click();
    }

    const leader = pages[leaderIdx];
    await expect(leader.getByTestId('dog-relay-begin')).toBeVisible();
    const cards = leader.locator('[data-testid^="dog-relay-card-"]');
    await expect(cards).toHaveCount(2);
    const ids = await cards.evaluateAll((elements) =>
      elements.map((el) => el.getAttribute('data-testid')!.replace('dog-relay-card-', '')),
    );
    const truePair: [string, string] = [ids[0], ids[1]];
    await leader.waitForTimeout(1500);
    await leader.getByTestId('dog-relay-begin').click();

    // Relay handoff through all seats
    let finalIdx = 0;
    for (let step = 0; step < pages.length - 1; step++) {
      const idx = await waitForAnyVisible(
        pages.map((p) => p.getByTestId('dog-relay-handoff')),
        15000,
      );
      finalIdx = idx;
      await pages[idx].waitForTimeout(600);
      await pages[idx].getByTestId('dog-relay-handoff').click();
    }

    const finalPage = pages[finalIdx];
    await expect(finalPage.locator('button[data-testid^="dog-relay-card-"]')).toHaveCount(10);
    await finalPage.waitForTimeout(1200);

    // Final dog submits the reversed pair (wrong order) so the demo also showcases Discussion & Voting!
    await finalPage.getByTestId(`dog-relay-card-${truePair[1]}`).click();
    await finalPage.getByTestId(`dog-relay-card-${truePair[0]}`).click();
    await finalPage.waitForTimeout(800);
    await finalPage.getByTestId('dog-relay-confirm-guess').click();

    // Discussion phase -> Host opens voting
    await expect(pages[0].getByTestId('dog-relay-end-discussion')).toBeVisible({ timeout: 10000 });
    await pages[0].waitForTimeout(1200);
    await pages[0].getByTestId('dog-relay-end-discussion').click();

    // Pack votes to catch the Mischief Dog!
    const evilId = (await relaySnapshot(pages[evilIdx])).playerId;
    const goodTargetId = (await relaySnapshot(pages[goodIndices[0]])).playerId;
    for (let i = 0; i < pages.length; i++) {
      await expect(pages[i].getByTestId('dog-relay-confirm-vote')).toBeVisible({ timeout: 15000 });
      const targetId = i === evilIdx ? goodTargetId : evilId;
      await pages[i].getByTestId(`dog-relay-vote-${targetId}`).click();
      await pages[i].getByTestId('dog-relay-confirm-vote').click();
    }

    // Watch synchronized Result Reveal (True Pair cards + Role reveals + Winner)
    await watchResultReveal(pages, 60000);
    for (const page of pages) {
      await expect(page.getByTestId('dog-relay-result')).toBeVisible({ timeout: 15000 });
    }
    await pages[0].waitForTimeout(2500);

    // Include Leader, Mischief Dog, Final Guesser, and a Loyal Dog in the 2x2 video
    const selected = [...new Set([leaderIdx, evilIdx, finalIdx, ...goodIndices])].slice(0, 4);
    await finalizeDemoVideo('dog-relay', ctxs, pages, selected);
  });
});
