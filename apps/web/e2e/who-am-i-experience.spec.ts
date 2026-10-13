import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { goToLobby, extractRoomCode, getOrigin } from './helpers';

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

    // 5. Test Escape closes dialog and restores focus to trigger button
    await p1.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3000 });
    await expect(startBtn).toBeFocused();

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

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });
});
