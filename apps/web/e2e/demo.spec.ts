import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

// SlowMo 600ms for human-readable demo videos
test.use({ launchOptions: { slowMo: 600 } });
// 4 minutes timeout per demo
test.setTimeout(240000);

const videoDir = 'test-results/demo-videos';

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

    // Wait for winner banner
    await expect(p1.getByText('wins', { exact: false }).first()).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(2000);

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
    if (await startBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await startBtn.click();
    }

    // Both players choose — P2 (Paper) beats P1 (Rock)
    await expect(p1.locator('button', { hasText: '✊' })).toBeVisible({ timeout: 8000 });
    await p1.locator('button', { hasText: '✊' }).click();
    await p2.locator('button', { hasText: '✋' }).click();

    // Wait for result + Next Round button
    const nextBtn = p1.locator('button', { hasText: /Next Round|Play Again|เล่นอีกครั้ง|รอบต่อไป/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 10000 });
    await p1.waitForTimeout(2000);

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

    // Wait for winner banner
    await p1.locator('[data-testid="winner-banner"]').waitFor({ state: 'visible', timeout: 10000 });
    await p1.waitForTimeout(2000);

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

    // Switch to PLAYER_INPUT mode (custom select: click wrapper button then option)
    await p1.locator('text=Word Mode').or(p1.locator('text=โหมด')).locator('..').locator('button').first().click();
    await p1.locator('button', { hasText: /Player|ผู้เล่น/i }).click();

    // Start game
    const startBtn = p1.locator('button', { hasText: /start game|เริ่มเกม/i }).first();
    await startBtn.waitFor({ state: 'visible', timeout: 10000 });
    await startBtn.click();

    // Both submit words
    const p1Input = p1.locator('input').first();
    await p1Input.waitFor({ state: 'visible', timeout: 10000 });
    await p1Input.fill('Elephant');
    await p1.locator('button', { hasText: /Submit Word|ส่งคำปริศนา/i }).first().click();

    const p2Input = p2.locator('input').first();
    await p2Input.waitFor({ state: 'visible', timeout: 10000 });
    await p2Input.fill('Tiger');
    await p2.locator('button', { hasText: /Submit Word|ส่งคำปริศนา/i }).first().click();

    await p1.waitForTimeout(2000);

    // Find who is the active guesser
    let activePage = p1;
    let otherPage = p2;
    const p2IsActive = await p2.locator('button').filter({ hasText: /Guess|ทาย/i }).first()
      .waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (p2IsActive) { activePage = p2; otherPage = p1; }

    // Make a guess
    await activePage.locator('button').filter({ hasText: /Guess|ทาย/i }).first().click();
    const guessInput = activePage.locator('input').last();
    await guessInput.waitFor({ state: 'visible', timeout: 8000 });
    await guessInput.fill('Tiger');
    await activePage.locator('button').filter({ hasText: /Submit|ส่งคำตอบ/i }).last().click();

    // Other player votes Yes
    const yesBtn = otherPage.locator('button').filter({ hasText: /Yes|ใช่/i }).first();
    await yesBtn.waitFor({ state: 'visible', timeout: 10000 });
    await yesBtn.click();

    // Host ends match
    const endBtn = p1.locator('button').filter({ hasText: /End Match|จบเกม/i }).first();
    if (await endBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await endBtn.click();
    }

    // Wait for scoreboard
    await p1.locator('text=Scoreboard').or(p1.locator('text=Match Ended'))
      .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await p1.waitForTimeout(2000);

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

    // Enable host plays if needed
    const hostPlaysSwitch = p1.locator('#host-plays-switch');
    if (await hostPlaysSwitch.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      const isChecked = await hostPlaysSwitch.getAttribute('aria-checked');
      if (isChecked !== 'true') await hostPlaysSwitch.click();
    }

    // Start game
    await p1.getByTestId('start-btn').click();

    // Wait for GO!! signal
    await p1.getByTestId('status-go').waitFor({ state: 'visible', timeout: 10000 });
    await p2.getByTestId('status-go').waitFor({ state: 'visible', timeout: 10000 });

    // Both press button
    await p1.getByTestId('press-btn').click();
    await p1.waitForTimeout(300);
    await p2.getByTestId('press-btn').click();

    // Wait for round result
    await expect(p1.getByTestId('round-result-title')).toBeVisible({ timeout: 8000 });
    await p1.waitForTimeout(1000);

    // End game to show scoreboard
    const endBtn = p1.locator('button').filter({ hasText: /End|จบ/i }).first();
    if (await endBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await endBtn.click();
    }

    // Wait for scoreboard
    await p1.getByText(/Scoreboard|Game Over|ตารางคะแนน|จบเกม/i)
      .waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await p1.waitForTimeout(2000);

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
    const [p1, p2, p3, p4] = await Promise.all(ctxs.map(c => c.newPage()));

    const roomCode = await createRoom(p1, 'Host', 'Who Know');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'P1');
    await joinRoom(p3, origin, roomCode, 'P2');
    await joinRoom(p4, origin, roomCode, 'P3');
    await p1.waitForTimeout(1500);

    // Set Host Selection to FIXED so room creator is always the host
    const hostSelWrapper = p1.getByText(/Host Selection|เลือกเจ้าของห้อง/i).locator('..').locator('button').first();
    if (await hostSelWrapper.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await hostSelWrapper.click();
      await p1.locator('button', { hasText: /Fixed|คงที่/i }).first().click();
    }

    // Set timer to 1 min
    const timerInput = p1.locator('input[name="timerMin"]');
    if (await timerInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
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

    // Host ends round
    const endBtn = p1.locator('button').filter({ hasText: /Word Guessed|Time's Up|ทายถูกแล้ว|หมดเวลา/i }).first();
    await endBtn.waitFor({ state: 'visible', timeout: 15000 });
    await endBtn.click();
    await p1.waitForTimeout(2000);

    // Players vote
    for (const page of [p2, p3, p4]) {
      const voteBtn = page.locator('button').filter({ hasText: /P1|P2|P3|Host/i }).first();
      if (await voteBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
        await voteBtn.click().catch(() => {});
      }
    }

    // Wait for result
    await p1.getByText(/Game Over|Scoreboard|Commoners|Insider|จบเกม|ตารางคะแนน|คนทั่วไป|คนวงใน/i)
      .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await p1.waitForTimeout(2000);

    await Promise.all(ctxs.map(c => c.close()));
  });

  // ─── 7. Sounds Fishy ─────────────────────────────────────────────────────
  test('Sounds Fishy Demo', async ({ browser }) => {
    // Sounds Fishy requires minimum 3 players
    const ctxs = await Promise.all([
      browser.newContext({ recordVideo: { dir: `${videoDir}/soundsfishy-host` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/soundsfishy-p1` } }),
      browser.newContext({ recordVideo: { dir: `${videoDir}/soundsfishy-p2` } }),
    ]);
    const [p1, p2, p3] = await Promise.all(ctxs.map(c => c.newPage()));

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

    // Submit answers
    for (const page of [p1, p2, p3]) {
      const input = page.locator('input').first();
      if (await input.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
        await input.fill('This is the truth');
        const submitBtn = page.locator('button').filter({ hasText: /Submit/ }).first();
        if (await submitBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
          await submitBtn.click();
        }
      }
    }
    await p1.waitForTimeout(2000);

    // Picker eliminates + banks
    let pickerPage = null;
    for (const page of [p1, p2, p3]) {
      const eliminateBtn = page.locator('button').filter({ hasText: /Eliminate|กำจัด/i }).first();
      if (await eliminateBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
        pickerPage = page;
        break;
      }
    }
    if (pickerPage) {
      await pickerPage.locator('button').filter({ hasText: /Eliminate|กำจัด/i }).first().click();
      await pickerPage.waitForTimeout(1500);
      const bankBtn = pickerPage.locator('button').filter({ hasText: /Bank|รับคะแนน/i }).first();
      if (await bankBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
        await bankBtn.click();
      }
    }

    // Wait for round results
    await p1.getByText(/Round Results|Scoreboard|ผลลัพธ์รอบนี้|ตารางคะแนน/i)
      .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await p1.waitForTimeout(2000);

    await Promise.all(ctxs.map(c => c.close()));
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

    // Click Ready for both
    for (const page of [p1, p2]) {
      const readyBtn = page.locator('button').filter({ hasText: /Ready|พร้อม/i }).first();
      if (await readyBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
        await readyBtn.click();
      }
    }

    // Start game
    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/i }).first();
    if (await startBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await startBtn.click();
    }
    await p1.waitForTimeout(2000);

    // Play cards until Game Over or You Won
    for (let i = 0; i < 20; i++) {
      const isOver = await p1.getByText(/Game Over|You Win|จบเกม|คุณชนะ/i).isVisible().catch(() => false);
      if (isOver) break;

      const nextLvlBtn = p1.locator('button').filter({ hasText: /Next Level|ระดับถัดไป/i }).first();
      if (await nextLvlBtn.isVisible().catch(() => false)) {
        await nextLvlBtn.click().catch(() => {});
      }

      for (const page of [p1, p2]) {
        const cardBtns = page.locator('button').filter({ hasText: /^[0-9]+$/ });
        if (await cardBtns.count() > 0) {
          await cardBtns.first().click().catch(() => {});
          await page.waitForTimeout(400);
          const playCardBtn = page.locator('button').filter({ hasText: /Play Card|ลงไพ่/i }).first();
          if (await playCardBtn.isVisible().catch(() => false)) {
            await playCardBtn.click().catch(() => {});
          }
        }
      }
      await p1.waitForTimeout(800);
    }

    // Wait for end screen
    await p1.locator('text=Game Over').or(p1.locator('text=You Won'))
      .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await p1.waitForTimeout(2000);

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
    const [p1, p2, p3] = await Promise.all(ctxs.map(c => c.newPage()));

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
      if (await wordInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
        await wordInput.fill('Mystery');
        const confirmBtn = page.locator('button', { hasText: /Confirm|Submit|ยืนยัน/i }).first();
        if (await confirmBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
          await confirmBtn.click();
        }
        break;
      }
    }
    await p1.waitForTimeout(2000);

    // Playing phase — players take turns
    for (let round = 0; round < 6; round++) {
      for (const page of [p1, p2, p3]) {
        const activeIndicator = page.getByText(/Your Turn - Play a Card|ตาคุณ/i);
        if (await activeIndicator.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
          // Click the overlay div that actually has the onClick handler
          const playOverlay = page.locator('div.absolute').filter({ hasText: /^Play$|^วาง$/i }).first();
          await playOverlay.click({ force: true });
          
          const playBtn = page.locator('button', { hasText: /Play Card|วางการ์ด/i }).first();
          await playBtn.waitFor({ state: 'visible', timeout: 3000 });
          await playBtn.click();
          await page.waitForTimeout(1000);
          break;
        }
      }
    }

    // Continue to voting (Discussion phase)
    for (const page of [p1, p2, p3]) {
      const continueBtn = page.locator('button', { hasText: /Start Voting|เริ่มโหวต/i }).first();
      if (await continueBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
        await continueBtn.click();
      }
    }

    // Voting phase
    for (const page of [p1, p2, p3]) {
      const voteBtn = page.locator('button', { hasText: /Confirm Vote|ยืนยันการโหวต/i }).first();
      if (await voteBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
        const playerBtn = page.locator('button').filter({ hasText: /D1|D2|DetHost/i }).first();
        await playerBtn.click();
        await page.waitForTimeout(500);
        await voteBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Wait for round results
    await p1.getByText(/Round Results|Scoreboard|ผลลัพธ์รอบนี้|ตารางคะแนน/i)
      .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await p1.waitForTimeout(2000);

    await Promise.all(ctxs.map(c => c.close()));
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
    if (await sourceSelect.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await sourceSelect.selectOption('ITUNES');
    }
    const searchInput = p1.getByPlaceholder(/Taylor Swift|search|ค้นหา/i);
    if (await searchInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await searchInput.fill('Pop');
      await p1.keyboard.press('Enter');
    }

    // Wait for search results
    await p1.waitForFunction(
      () => document.querySelectorAll('tbody tr').length >= 2,
      { timeout: 20000 },
    ).catch(() => {});
    await p1.waitForTimeout(1000);

    // Start game
    const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/i }).first();
    await startBtn.waitFor({ state: 'visible', timeout: 10000 });
    await startBtn.click();

    // Both players ready
    await p1.getByText(/I'm Ready!|ฉันพร้อมแล้ว/i).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await p2.getByText(/I'm Ready!|ฉันพร้อมแล้ว/i).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await p1.getByText(/I'm Ready!|ฉันพร้อมแล้ว/i).click().catch(() => {});
    await p2.getByText(/I'm Ready!|ฉันพร้อมแล้ว/i).click().catch(() => {});

    // Host starts song
    const startSongBtn = p1.getByText('Start Song (Countdown)');
    await startSongBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await startSongBtn.click().catch(() => {});
    await p1.waitForTimeout(5000);

    // P1 buzzes and answers
    const buzzBtn = p1.locator('button').filter({ hasText: /BUZZ!|X/i }).first();
    if (await buzzBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
      await buzzBtn.click();
      const answerInput = p1.getByPlaceholder(/Type answer/i);
      if (await answerInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
        await answerInput.fill('My Pop Answer');
        await p1.keyboard.press('Enter');
      }
    }

    // Wait for result
    await p1.getByText(/Scoreboard|Round|Correct|ตารางคะแนน|รอบ|ถูกต้อง/i)
      .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await p1.waitForTimeout(3000);

    await p1Ctx.close();
    await p2Ctx.close();
  });
});
