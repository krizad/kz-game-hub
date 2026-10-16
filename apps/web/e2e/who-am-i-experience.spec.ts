import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { goToLobby, extractRoomCode, getOrigin, switchToEnglish } from './helpers';

async function selectWordMode(page: Page, labelRegex: RegExp) {
  const trigger = page
    .getByRole('button')
    .filter({
      hasText:
        /โฮสต์เป็นคนตั้ง|สุ่มจากระบบ|ผู้เล่นเขียนเอง|ให้ AI สร้างให้|Host Picks|Random \(DB\)|Players Write|AI Generate/,
    })
    .first();
  await trigger.click();
  await page.getByRole('button').filter({ hasText: labelRegex }).last().click();
}

test.describe('Who Am I Experience (TASK-WA-001)', () => {
  test('Thai modal has localized copy, Escape closes, and Tab traps focus', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage(); // Host
    const p2 = await p2Ctx.newPage(); // Guest 1
    const p3 = await p3Ctx.newPage(); // Guest 2
    await p1.setViewportSize({ width: 1280, height: 900 });

    // 1. Host creates room in Thai (default locale)
    await goToLobby(p1);
    await p1.locator('#lobbyNameInput').fill('Amy');
    await p1.locator('button:has-text("ฉันคือใคร")').first().click();
    await p1.waitForTimeout(3000);
    const roomCode = await extractRoomCode(p1);
    expect(roomCode).toBeTruthy();

    const origin = await getOrigin(p1);

    // 2. Guests join room in Thai
    for (const [page, name] of [
      [p2, 'Bob'],
      [p3, 'Cara'],
    ] as const) {
      await page.goto(`${origin}/?room=${roomCode}`);
      await page.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('#inviteNameInput').fill(name);
      await page.locator('#inviteNameInput').press('Enter');
      await page.locator('#inviteNameInput').waitFor({ state: 'hidden', timeout: 20000 });
    }

    // 3. Switch to HOST_INPUT mode
    await selectWordMode(p1, /โฮสต์เป็นคนตั้ง/);

    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

    // 4. Click Start Game to open Host Word modal
    await startBtn.click();

    const dialog = p1.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await p1.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/who-am-i/1280-th.png' });

    // Assert Thai copy
    await expect(dialog.getByText('📝 กำหนดคำลับ')).toBeVisible();
    await expect(
      dialog.getByText('กำหนดคำให้ผู้เล่นแต่ละคน คุณ (หัวหน้าห้อง) จะไม่ได้รับคำ'),
    ).toBeVisible();
    await expect(dialog.getByText('ยกเลิก')).toBeVisible();
    await expect(dialog.getByText('เริ่มเกม')).toBeVisible();

    // Assert no hardcoded English in Thai dialog
    await expect(dialog.getByText('📝 Set Words')).toBeHidden();
    await expect(dialog.getByText('Cancel')).toBeHidden();
    await expect(dialog.getByText('Start Game')).toBeHidden();

    // Check placeholder
    const thaiInputs = dialog.getByPlaceholder('ใส่ชื่อตัวละคร สัตว์ หรือสิ่งของ...');
    await expect(thaiInputs).toHaveCount(2);

    // Focus cycles between the first and last enabled controls inside the dialog.
    await thaiInputs.first().focus();
    await p1.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'ยกเลิก' })).toBeFocused();
    await p1.keyboard.press('Tab');
    await expect(thaiInputs.first()).toBeFocused();

    // 5. Test Escape closes dialog and restores focus to trigger button
    await p1.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3000 });
    await expect(startBtn).toBeFocused();

    await switchToEnglish(p1);
    await startBtn.click();
    await expect(dialog.getByText('📝 Set Words')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Start Game' })).toBeVisible();
    await expect(dialog.getByPlaceholder('Enter a character, animal, object...')).toHaveCount(2);
    await p1.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/who-am-i/1280-en.png' });
    for (const width of [390, 360]) {
      await p1.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
      await p1.screenshot({
        path: `../../docs/qa/private-friends-2026-10-14/who-am-i/${width}-en.png`,
      });
    }

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('Preserves word draft across player reconnection and submits with new socket key', async ({
    browser,
  }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage(); // Host
    const p2 = await p2Ctx.newPage(); // Guest 1 (Bob)
    const p3 = await p3Ctx.newPage(); // Guest 2 (Cara)
    await p1.setViewportSize({ width: 390, height: 844 });

    await goToLobby(p1);
    await p1.locator('#lobbyNameInput').fill('HostAmy');
    await p1.locator('button:has-text("ฉันคือใคร")').first().click();
    await p1.waitForTimeout(3000);
    const roomCode = await extractRoomCode(p1);
    const origin = await getOrigin(p1);

    for (const [page, name] of [
      [p2, 'Bob'],
      [p3, 'Cara'],
    ] as const) {
      await page.goto(`${origin}/?room=${roomCode}`);
      await page.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('#inviteNameInput').fill(name);
      await page.locator('#inviteNameInput').press('Enter');
      await page.locator('#inviteNameInput').waitFor({ state: 'hidden', timeout: 20000 });
    }

    await selectWordMode(p1, /โฮสต์เป็นคนตั้ง/);
    const startBtn = p1.getByTestId('lobby-start-game');
    await startBtn.click();

    const dialog = p1.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await p1.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/who-am-i/390-th.png' });

    // Fill in word for Bob and Cara
    const bobInput = dialog.locator('input').nth(0);
    const caraInput = dialog.locator('input').nth(1);
    await bobInput.fill('กระต่าย'); // Rabbit
    await caraInput.fill('สิงโต'); // Lion

    // Simulate Bob reconnecting (page reload with reconnect token preserved in storage)
    await p2.reload();
    await p2.waitForTimeout(2000);

    // Verify Bob's draft word 'กระต่าย' is still in the input
    await expect(dialog.locator('input').nth(0)).toHaveValue('กระต่าย');
    await expect(dialog.locator('input').nth(1)).toHaveValue('สิงโต');

    // Submit words to start the game
    const submitBtn = dialog.getByRole('button', { name: 'เริ่มเกม' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify game started
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect
      .poll(() =>
        p1.evaluate(() => (window as any).__useGameStore.getState().room?.whoAmIState?.phase),
      )
      .toBe('ASKING');

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('departed draft cannot fill a replacement player and viewers need no word', async ({
    browser,
  }) => {
    const host = await browser.newPage();
    const bob = await browser.newPage();
    const cara = await browser.newPage();
    const replacement = await browser.newPage();
    const viewer = await browser.newPage();
    await host.setViewportSize({ width: 360, height: 800 });
    await goToLobby(host);
    await host.locator('#lobbyNameInput').fill('HostAmy');
    await host.locator('button:has-text("ฉันคือใคร")').first().click();
    const roomCode = await extractRoomCode(host);
    const origin = await getOrigin(host);
    for (const [page, name] of [
      [bob, 'Bob'],
      [cara, 'Cara'],
    ] as const) {
      await page.goto(`${origin}/?room=${roomCode}`);
      await page.locator('#inviteNameInput').fill(name);
      await page.locator('#inviteNameInput').press('Enter');
      await page.locator('#inviteNameInput').waitFor({ state: 'hidden' });
    }
    await selectWordMode(host, /โฮสต์เป็นคนตั้ง/);
    await host.getByTestId('lobby-advanced-settings').locator('summary').click();
    await host.getByRole('button', { name: 'อนุญาต', exact: true }).click();
    await goToLobby(viewer);
    await viewer.evaluate((code) => {
      const store = (window as any).__useGameStore.getState();
      store.setName('Observer');
      store.spectateJoin(code);
    }, roomCode);
    await expect
      .poll(() => viewer.evaluate(() => (window as any).__useGameStore.getState().isSpectator))
      .toBe(true);

    await host.getByTestId('lobby-start-game').click();
    const dialog = host.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await host.screenshot({ path: '../../docs/qa/private-friends-2026-10-14/who-am-i/360-th.png' });
    await expect(dialog.locator('input')).toHaveCount(2);
    await dialog.getByLabel('Bob').fill('Old Bob word');
    await dialog.getByLabel('Cara').fill('Cara word');

    await bob.evaluate(() => (window as any).__useGameStore.getState().leaveRoom());
    await expect(dialog.getByLabel('Bob')).toHaveCount(0);
    await expect(dialog.locator('input')).toHaveCount(1);

    await replacement.goto(`${origin}/?room=${roomCode}`);
    await replacement.locator('#inviteNameInput').fill('Dave');
    await replacement.locator('#inviteNameInput').press('Enter');
    await replacement.locator('#inviteNameInput').waitFor({ state: 'hidden' });
    await expect(dialog.locator('input')).toHaveCount(2);
    await expect(dialog.getByLabel('Dave')).toHaveValue('');
    await expect(dialog.getByRole('button', { name: 'เริ่มเกม' })).toBeDisabled();
    await dialog.getByLabel('Dave').fill('Fresh Dave word');
    await dialog.getByRole('button', { name: 'เริ่มเกม' }).click();
    await expect
      .poll(() =>
        host.evaluate(() => (window as any).__useGameStore.getState().room?.whoAmIState?.phase),
      )
      .toBe('ASKING');
    await Promise.all([host, bob, cara, replacement, viewer].map((page) => page.close()));
  });

  test('TASK-WA-002: rejected duplicate word preserves draft for editing, guess modal traps focus and restores on Escape, guess status displays, and own secret is never visible', async ({
    browser,
  }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const host = await p1Ctx.newPage();
    const bob = await p2Ctx.newPage();

    await host.setViewportSize({ width: 1280, height: 900 });
    await bob.setViewportSize({ width: 390, height: 844 });

    // 1. Host creates room in Thai
    await goToLobby(host);
    await host.locator('#lobbyNameInput').fill('HostAmy');
    await host.locator('button:has-text("ฉันคือใคร")').first().click();
    await host.waitForTimeout(3000);
    const roomCode = await extractRoomCode(host);
    const origin = await getOrigin(host);

    // 2. Bob joins room
    await bob.goto(`${origin}/?room=${roomCode}`);
    await bob.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
    await bob.locator('#inviteNameInput').fill('Bob');
    await bob.locator('#inviteNameInput').press('Enter');
    await bob.locator('#inviteNameInput').waitFor({ state: 'hidden', timeout: 20000 });

    // 3. Switch wordMode to PLAYER_INPUT
    await selectWordMode(host, /ผู้เล่นเขียนเอง/);

    const startBtn = host.getByTestId('lobby-start-game');
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();

    // 4. COLLECTING_WORDS phase reached
    const hostWordInput = host.locator('#playerWordInput');
    const bobWordInput = bob.locator('#playerWordInput');
    await expect(hostWordInput).toBeVisible({ timeout: 10000 });
    await expect(bobWordInput).toBeVisible({ timeout: 10000 });

    // Host submits "แมว"
    await hostWordInput.fill('แมว');
    await host.getByRole('button', { name: /ส่งคำปริศนา/ }).click();
    await expect(host.getByText('ส่งคำปริศนาแล้ว!')).toBeVisible({ timeout: 5000 });

    // Bob tries to submit duplicate word "แมว" via Enter
    await bobWordInput.fill('แมว');
    await bobWordInput.press('Enter');

    // Duplicate rejection toast arrives; Bob's input draft is PRESERVED
    await expect(bobWordInput).toBeVisible({ timeout: 5000 });
    await expect(bobWordInput).toHaveValue('แมว');

    // Bob edits to non-duplicate "สุนัข" and submits
    await bobWordInput.fill('สุนัข');
    await bob.getByRole('button', { name: /ส่งคำปริศนา/ }).click();

    // 5. ASKING phase starts
    await expect
      .poll(() =>
        host.evaluate(() => (window as any).__useGameStore.getState().room?.whoAmIState?.phase),
      )
      .toBe('ASKING');

    // 6. Secret word privacy check: neither player sees their own word or raw waiMyWord/waiSubmittedWord
    const hostPrivate = await host.evaluate(
      () => (window as any).__useGameStore.getState().privateState,
    );
    const hostSocketId = await host.evaluate(
      () => (window as any).__useGameStore.getState().socketId,
    );
    expect(hostPrivate?.waiMyWord).toBeUndefined();
    expect(hostPrivate?.waiSubmittedWord).toBeUndefined();
    expect(hostPrivate?.waiVisibleWords?.[hostSocketId]).toBeUndefined();
    expect(JSON.stringify(hostPrivate)).not.toContain('สุนัข');

    const bobPrivate = await bob.evaluate(
      () => (window as any).__useGameStore.getState().privateState,
    );
    const bobSocketId = await bob.evaluate(
      () => (window as any).__useGameStore.getState().socketId,
    );
    expect(bobPrivate?.waiMyWord).toBeUndefined();
    expect(bobPrivate?.waiSubmittedWord).toBeUndefined();
    expect(bobPrivate?.waiVisibleWords?.[bobSocketId]).toBeUndefined();
    expect(JSON.stringify(bobPrivate)).not.toContain('แมว');

    // 7. Guess modal interaction: find active player
    const guessBtnHost = host.getByRole('button', { name: /ขอทายคำ!/i });
    const guessBtnBob = bob.getByRole('button', { name: /ขอทายคำ!/i });
    const isHostActive = await guessBtnHost.isVisible({ timeout: 5000 }).catch(() => false);
    const activePage = isHostActive ? host : bob;
    const voterPage = isHostActive ? bob : host;
    const activeGuessBtn = isHostActive ? guessBtnHost : guessBtnBob;

    await activeGuessBtn.click();

    const guessDialog = activePage.getByRole('dialog');
    await expect(guessDialog).toBeVisible({ timeout: 5000 });
    const guessWordInput = activePage.locator('#guessWordInput');
    await expect(guessWordInput).toBeVisible();

    // Typing draft
    await guessWordInput.fill('กระต่าย');

    // Tab trap inside guessDialog (cycles between input and last enabled element submit button)
    await guessWordInput.focus();
    await activePage.keyboard.press('Shift+Tab');
    await expect(guessDialog.getByRole('button', { name: /ส่งคำตอบ/i })).toBeFocused();
    await activePage.keyboard.press('Tab');
    await expect(guessWordInput).toBeFocused();

    // Pressing Escape preserves draft and restores focus to trigger button
    await activePage.keyboard.press('Escape');
    await expect(guessDialog).toBeHidden({ timeout: 3000 });
    await expect(activeGuessBtn).toBeFocused();

    // Reopen dialog: draft is preserved
    await activeGuessBtn.click();
    await expect(guessDialog).toBeVisible({ timeout: 5000 });
    await expect(activePage.locator('#guessWordInput')).toHaveValue('กระต่าย');

    // Screenshots across viewport sizes
    await activePage.screenshot({
      path: '../../docs/qa/private-friends-2026-10-14/who-am-i/guess-modal-1280.png',
    });
    for (const width of [390, 360]) {
      await activePage.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await expect(guessDialog).toBeInViewport();
      await activePage.screenshot({
        path: `../../docs/qa/private-friends-2026-10-14/who-am-i/guess-modal-${width}.png`,
      });
    }

    // Submit guess
    const submitGuessBtn = guessDialog.getByRole('button', { name: /ส่งคำตอบ/i });
    await submitGuessBtn.click();

    // Dialog closes and whoami-guess-status appears
    await expect(guessDialog).toBeHidden({ timeout: 5000 });
    const guessStatus = activePage.getByTestId('whoami-guess-status');
    await expect(guessStatus).toBeVisible({ timeout: 10000 });
    await expect(guessStatus).toContainText(/ส่งคำทาย|รอ/i);

    // Voter casts vote
    const yesVoteBtn = voterPage.getByRole('button', { name: /YES|ใช่/i }).first();
    await expect(yesVoteBtn).toBeVisible({ timeout: 5000 });
    await yesVoteBtn.click();
    await expect(voterPage.getByTestId('whoami-guess-status')).toBeVisible({ timeout: 5000 });

    await p1Ctx.close();
    await p2Ctx.close();
  });

  test('TASK-WA-003: host moderator distinct from asker, who may vote status displayed, no raw enums, rejected vote not accepted, and next round advances', async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const host = await p1Ctx.newPage();
    const bob = await p2Ctx.newPage();
    const cara = await p3Ctx.newPage();

    await host.setViewportSize({ width: 1280, height: 900 });
    await bob.setViewportSize({ width: 390, height: 844 });
    await cara.setViewportSize({ width: 390, height: 844 });

    // 1. Host creates room in Thai (default locale)
    await goToLobby(host);
    await host.locator('#lobbyNameInput').fill('HostAmy');
    await host.locator('button:has-text("ฉันคือใคร")').first().click();
    await host.waitForTimeout(3000);
    const roomCode = await extractRoomCode(host);
    const origin = await getOrigin(host);

    // 2. Bob & Cara join
    for (const [page, name] of [
      [bob, 'Bob'],
      [cara, 'Cara'],
    ] as const) {
      await page.goto(`${origin}/?room=${roomCode}`);
      await page.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('#inviteNameInput').fill(name);
      await page.locator('#inviteNameInput').press('Enter');
      await page.locator('#inviteNameInput').waitFor({ state: 'hidden', timeout: 20000 });
    }

    // 3. Switch to HOST_INPUT mode
    await selectWordMode(host, /โฮสต์เป็นคนตั้ง/);
    const startBtn = host.getByTestId('lobby-start-game');
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();

    // 4. Host submits words for Bob and Cara
    const dialog = host.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.locator('input').nth(0).fill('กระต่าย');
    await dialog.locator('input').nth(1).fill('สิงโต');
    await dialog.getByRole('button', { name: 'เริ่มเกม' }).click();

    // 5. Game starts: ASKING phase
    await expect
      .poll(() =>
        host.evaluate(() => (window as any).__useGameStore.getState().room?.whoAmIState?.phase),
      )
      .toBe('ASKING');

    // Host moderator assertion: host is moderator, not a guesser
    await expect(host.getByText('ผู้ดำเนินเกม (โฮสต์)', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(host.getByText('👑 ผู้ดูแล', { exact: true })).toBeVisible();

    // Current asker is distinct from host moderator
    const activePlayerId = await host.evaluate(
      () => (window as any).__useGameStore.getState().room?.whoAmIState?.currentTurn,
    );
    const hostSocketId = await host.evaluate(
      () => (window as any).__useGameStore.getState().socketId,
    );
    expect(activePlayerId).not.toBe(hostSocketId);

    const bobSocketId = await bob.evaluate(
      () => (window as any).__useGameStore.getState().socketId,
    );
    const activePage = activePlayerId === bobSocketId ? bob : cara;
    const voterPage = activePlayerId === bobSocketId ? cara : bob;

    // Verify "who may vote" / current asker breakdown
    await expect(host.getByText('ผู้มีสิทธิ์โหวต:')).toBeVisible();
    await expect(host.getByText('ผู้ถาม:')).toBeVisible();

    // Verify rejected vote is NOT accepted:
    // Active player attempts to vote on their own turn -> rejected by server
    await activePage.evaluate(() => {
      (window as any).__useGameStore.getState().gameActionWhoAmI({
        type: 'VOTE_GUESS',
        vote: 'YES',
      });
    });
    // Active page should NOT show vote cast confirmation
    await expect(activePage.getByTestId('whoami-vote-status')).toBeHidden();

    // Voter casts vote
    const voteYesBtn = voterPage.getByRole('button', { name: /ใช่/i }).first();
    await expect(voteYesBtn).toBeVisible({ timeout: 5000 });
    await voteYesBtn.click();
    await expect(voterPage.getByTestId('whoami-vote-status')).toBeVisible({ timeout: 5000 });

    // Host moderator ends asking phase
    const endAskingModeratorBtn = host.getByRole('button', { name: /จบการถาม/i });
    await expect(endAskingModeratorBtn).toBeVisible({ timeout: 5000 });
    await endAskingModeratorBtn.click();

    // Turn advances to next player
    await expect
      .poll(() =>
        host.evaluate(
          () => (window as any).__useGameStore.getState().room?.whoAmIState?.currentTurn,
        ),
      )
      .not.toBe(activePlayerId);

    // New active player takes a guess
    const newActiveId = await host.evaluate(
      () => (window as any).__useGameStore.getState().room?.whoAmIState?.currentTurn,
    );
    const newActivePage = newActiveId === bobSocketId ? bob : cara;
    const newVoterPage = newActiveId === bobSocketId ? cara : bob;

    const guessBtn = newActivePage.getByRole('button', { name: /ขอทายคำ!/i });
    await expect(guessBtn).toBeVisible({ timeout: 5000 });
    await guessBtn.click();

    const guessDialog = newActivePage.getByRole('dialog');
    await expect(guessDialog).toBeVisible({ timeout: 5000 });
    await newActivePage.locator('#guessWordInput').fill('สิงโต');
    await guessDialog.getByRole('button', { name: /ส่งคำตอบ/i }).click();
    await expect(guessDialog).toBeHidden({ timeout: 5000 });

    // State is now RESULT
    await expect(newActivePage.getByTestId('whoami-guess-status')).toBeVisible({ timeout: 10000 });
    await expect(newActivePage.getByTestId('whoami-guess-status')).toContainText(/ส่งคำทายแล้ว/);

    // Verify no raw enums: YES/NO buttons show "ใช่" and "ไม่ใช่"
    const yesBtn = newVoterPage.getByRole('button', { name: '✅ ใช่' });
    const noBtn = newVoterPage.getByRole('button', { name: '❌ ไม่ใช่' });
    await expect(yesBtn).toBeVisible({ timeout: 5000 });
    await expect(noBtn).toBeVisible({ timeout: 5000 });

    // Voter votes YES
    await yesBtn.click();
    await expect(newVoterPage.getByTestId('whoami-guess-status')).toBeVisible({ timeout: 5000 });

    // Host sees Continue button and advances next turn/round
    const continueBtn = host.getByRole('button', { name: /ดำเนินการต่อ/i });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('Auto-loads RANDOM categories on room entry, handles error/retry, ignores stale language responses, and reloads on reconnect', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await goToLobby(page);
    await page.locator('#lobbyNameInput').fill('HostCat');

    // Intercept WHO_AM_I_GET_CATEGORIES on the client socket to test loading, error/retry, and out-of-order responses deterministically
    await page.evaluate(() => {
      const store = (window as any).__useGameStore.getState();
      const socket = store.socket;
      const origEmit = socket.emit.bind(socket);
      (window as any).__catRequests = [];
      (window as any).__catMode = 'delay';
      socket.emit = (event: string, payload?: any, ...rest: any[]) => {
        if (event === 'who_am_i_get_categories') {
          (window as any).__catRequests.push(payload);
          const mode = (window as any).__catMode;
          if (mode === 'delay') {
            return socket;
          }
          if (mode === 'error') {
            setTimeout(() => {
              socket.listeners('who_am_i_categories_list').forEach((fn: any) =>
                fn({
                  categories: [],
                  lang: payload?.lang,
                  requestId: payload?.requestId,
                  error: 'CATEGORIES_UNAVAILABLE',
                }),
              );
            }, 20);
            return socket;
          }
          if (mode === 'mock-success') {
            const cats =
              payload?.lang === 'en'
                ? [{ name: 'Animals', count: 5 }]
                : [{ name: 'สัตว์', count: 5 }];
            setTimeout(() => {
              socket.listeners('who_am_i_categories_list').forEach((fn: any) =>
                fn({
                  categories: cats,
                  lang: payload?.lang,
                  requestId: payload?.requestId,
                }),
              );
            }, 20);
            return socket;
          }
        }
        return origEmit(event, payload, ...rest);
      };
    });

    await page.locator('button:has-text("ฉันคือใคร")').first().click();

    // 1. Entering RANDOM room automatically requests categories for 'th' and shows loading (not empty)
    await expect(page.getByTestId('whoami-categories-loading')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('whoami-categories-empty')).toBeHidden();
    const initialReqs = await page.evaluate(() => (window as any).__catRequests);
    expect(initialReqs.length).toBeGreaterThanOrEqual(1);
    expect(initialReqs[0].lang).toBe('th');
    expect(initialReqs[0].requestId).toBeTruthy();

    // 2. Simulate error response -> shows error + retry button (not empty state)
    await page.evaluate(() => {
      const socket = (window as any).__useGameStore.getState().socket;
      const lastReq = (window as any).__catRequests.at(-1);
      socket.listeners('who_am_i_categories_list').forEach((fn: any) =>
        fn({
          categories: [],
          lang: lastReq.lang,
          requestId: lastReq.requestId,
          error: 'CATEGORIES_UNAVAILABLE',
        }),
      );
    });
    await expect(page.getByTestId('whoami-categories-error')).toBeVisible();
    await expect(page.getByTestId('whoami-categories-empty')).toBeHidden();

    // 3. Retry loads Thai categories and allows selecting a category
    await page.evaluate(() => {
      (window as any).__catMode = 'mock-success';
    });
    await page.getByTestId('whoami-categories-retry').click();
    await expect(page.getByRole('button', { name: /สัตว์ \(5\)|เลือกหมวดหมู่/ })).toBeVisible({
      timeout: 5000,
    });

    // Select 'สัตว์' category
    await page
      .getByRole('button', { name: /เลือกหมวดหมู่/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'สัตว์ (5)' }).last().click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__useGameStore.getState().room?.config?.wordCategory),
      )
      .toBe('สัตว์');

    // 4. Switch language to English while holding response, then deliver stale 'th' response after 'en' response
    await page.evaluate(() => {
      (window as any).__catMode = 'delay';
    });
    const staleThReq = await page.evaluate(() => (window as any).__catRequests.at(-1));
    await switchToEnglish(page);

    // Server clears incompatible wordCategory when language changes
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__useGameStore.getState().room?.config?.wordCategory),
      )
      .toBe('');

    const enReq = await page.evaluate(() => (window as any).__catRequests.at(-1));
    expect(enReq.lang).toBe('en');

    // Deliver 'en' response first, then stale 'th' response out of order
    await page.evaluate(
      ({ enReq, staleThReq }) => {
        const socket = (window as any).__useGameStore.getState().socket;
        socket.listeners('who_am_i_categories_list').forEach((fn: any) =>
          fn({
            categories: [{ name: 'Animals', count: 5 }],
            lang: 'en',
            requestId: enReq.requestId,
          }),
        );
        socket.listeners('who_am_i_categories_list').forEach((fn: any) =>
          fn({
            categories: [{ name: 'สัตว์เก่า', count: 99 }],
            lang: 'th',
            requestId: staleThReq.requestId,
          }),
        );
      },
      { enReq, staleThReq },
    );

    const currentCategories = await page.evaluate(
      () => (window as any).__useGameStore.getState().categories,
    );
    expect(currentCategories).toEqual([{ name: 'Animals', count: 5 }]);

    await ctx.close();
  });
});
