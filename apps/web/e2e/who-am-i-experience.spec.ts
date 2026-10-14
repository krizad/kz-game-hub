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

    // 6. Secret word privacy check: neither player sees their own word
    const hostVisible = await host.evaluate(
      () => (window as any).__useGameStore.getState().privateState?.waiVisibleWords,
    );
    const hostSocketId = await host.evaluate(
      () => (window as any).__useGameStore.getState().socketId,
    );
    expect(hostVisible?.[hostSocketId]).toBeUndefined();

    const bobVisible = await bob.evaluate(
      () => (window as any).__useGameStore.getState().privateState?.waiVisibleWords,
    );
    const bobSocketId = await bob.evaluate(
      () => (window as any).__useGameStore.getState().socketId,
    );
    expect(bobVisible?.[bobSocketId]).toBeUndefined();

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
});
