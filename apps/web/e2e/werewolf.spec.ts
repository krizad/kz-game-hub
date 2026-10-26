import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

const NAMES = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eli', 'Fon'];

test.describe('Werewolf (มนุษย์หมาป่า)', () => {
  test('catalog card and room creation', async ({ page }) => {
    const roomCode = await createRoom(page, 'HostWolf', 'Werewolf');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    // Lobby settings panel for Werewolf is visible to the host
    await expect(page.getByTestId('werewolf-settings')).toBeVisible({ timeout: 10000 });
  });

  test('start is blocked below the 6-player minimum', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const roomCode = await createRoom(p1, 'Alice', 'Werewolf');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');

    const startBtn = p1.getByTestId('lobby-start-game');
    await expect(startBtn).toBeDisabled({ timeout: 10000 });
    await expect(startBtn).toContainText(/6/i);
  });

  test('six players receive secret roles, night screen and narrator', async ({ browser }) => {
    const pages = [];
    for (let i = 0; i < NAMES.length; i++) {
      const ctx = await browser.newContext();
      pages.push(await ctx.newPage());
    }

    const roomCode = await createRoom(pages[0], NAMES[0], 'Werewolf');
    const origin = await getOrigin(pages[0]);
    for (let i = 1; i < NAMES.length; i++) {
      await joinRoom(pages[i], origin, roomCode, NAMES[i]);
    }
    await expect(pages[0].getByText(NAMES[5])).toBeVisible({ timeout: 10000 });

    // Lobby composition hint reflects the 6-player default table
    await expect(pages[0].getByTestId('werewolf-composition')).toContainText(/2/);

    const startBtn = pages[0].getByTestId('lobby-start-game');
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();

    // Everyone is in the night phase
    for (const page of pages) {
      await expect(page.getByTestId('werewolf-night-screen')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByTestId('werewolf-role-card')).toBeVisible();
    }

    // Roles are dealt privately: exactly two wolves across six phones
    let wolfCount = 0;
    let seerCount = 0;
    for (const page of pages) {
      const roleText = await page.getByTestId('werewolf-role-card').innerText();
      if (/Werewolf|หมาป่า/i.test(roleText)) wolfCount++;
      if (/Seer|ทำนาย/i.test(roleText)) seerCount++;
    }
    expect(wolfCount).toBe(2);
    expect(seerCount).toBe(1);

    // Narrator screen opens from any device, captions only, and closes again
    await pages[3].getByTestId('werewolf-narrator-btn').click();
    await expect(pages[3].getByTestId('werewolf-narrator-screen')).toBeVisible();
    await expect(pages[3].getByTestId('werewolf-narrator-caption')).toBeVisible();
    await expect(pages[3].getByTestId('werewolf-narrator-test')).toBeVisible();
    await pages[3].getByTestId('werewolf-narrator-close').click();
    await expect(pages[3].getByTestId('werewolf-narrator-screen')).toBeHidden();

    // Public state never carries another player's secret role
    const body = await pages[0].content();
    expect(body).not.toContain('wwNight');
    expect(body).not.toContain('wwWolves');
  });
});
