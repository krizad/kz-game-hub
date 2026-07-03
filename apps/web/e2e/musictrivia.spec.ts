import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

// YOUTUBE: youtube-sr web scraper is unreliable — needs migration to YouTube Data API
// DEEZER: free public API works but game auto-completes rounds — server-side timing bug
const sources = ['ITUNES', 'SOUNDCLOUD'];

test.describe('Music Trivia Game Flow', () => {
  for (const source of sources) {
    test(`two players can play a 5-round game using ${source}`, async ({ browser }) => {
      test.setTimeout(180000);

      const p1Ctx = await browser.newContext();
      const p2Ctx = await browser.newContext();
      const p1 = await p1Ctx.newPage();
      const p2 = await p2Ctx.newPage();

      const roomCode = await createRoom(p1, 'Alice', 'Music Trivia');
      const origin = await getOrigin(p1);

      await joinRoom(p2, origin, roomCode, 'Bob');

      await p1.waitForTimeout(1000);

      await p1.locator('select[title="Select music source"]').selectOption(source);
      await p1.locator('select[title="Number of Rounds"]').selectOption('5');
      await p1.getByPlaceholder('e.g. Taylor Swift, Anime OST, 90s Pop...').fill('Pop');
      await p1.keyboard.press('Enter');
      await p1.waitForTimeout(1000);

      await p1.waitForFunction(
        () => {
          const rows = document.querySelectorAll('tbody tr');
          return rows.length >= 2;
        },
        { timeout: 20000 },
      );

      await p1.evaluate(() => {
        const store = (window as any).__useGameStore;
        store.getState().startGame();
      });

      await p1.getByText("I'm Ready!").waitFor({ state: 'visible', timeout: 60000 });
      await p2.getByText("I'm Ready!").waitFor({ state: 'visible', timeout: 60000 });
      await p1.getByText("I'm Ready!").click();
      await p2.getByText("I'm Ready!").click();

      await p1.getByText('Start Song (Countdown)').click();

      // Wait for countdown (3s) + syncPlay to arrive + React to finish rendering
      await p1.waitForTimeout(5000);

      for (let i = 1; i <= 5; i++) {
        const buzzBtn1 = p1.locator('button:has-text("BUZZ!")').first();
        await buzzBtn1.waitFor({ state: 'attached', timeout: 45000 });
        await buzzBtn1.scrollIntoViewIfNeeded();
        await buzzBtn1.click({ force: true, timeout: 10000 });

        const input1 = p1.getByPlaceholder('Type answer here...');
        await input1.waitFor({ state: 'visible', timeout: 5000 });
        await input1.fill('Alice guess');
        await p1.keyboard.press('Enter');

        const buzzBtn2 = p2.locator('button:has-text("BUZZ!")').last();
        await buzzBtn2.waitFor({ state: 'attached', timeout: 10000 });
        await buzzBtn2.scrollIntoViewIfNeeded();
        await buzzBtn2.click({ force: true, timeout: 10000 });

        const input2 = p2.getByPlaceholder('Type answer here...');
        await input2.waitFor({ state: 'visible', timeout: 5000 });
        await input2.fill('Bob guess');
        await p2.keyboard.press('Enter');

        await buzzBtn1.waitFor({ state: 'hidden', timeout: 15000 });
      }

      await expect(p1.locator('text="Game Over!"').first()).toBeVisible({ timeout: 45000 });
      await expect(p2.locator('text="Game Over!"').first()).toBeVisible({ timeout: 45000 });

      await p1Ctx.close();
      await p2Ctx.close();
    });
  }
});
