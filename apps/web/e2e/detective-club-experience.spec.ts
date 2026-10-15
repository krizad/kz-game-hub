import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRoom, getOrigin, joinRoom, waitForAnyVisible } from './helpers';

async function startPlaying(
  browser: Browser,
  viewport: { width: number; height: number },
  touch: boolean,
) {
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () => browser.newContext({ viewport, hasTouch: touch })),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [host, guest1, guest2] = pages;
  const code = await createRoom(host, 'DetectHost', 'Cluecanvas');
  const origin = await getOrigin(host);
  await joinRoom(guest1, origin, code, 'DetectOne');
  await joinRoom(guest2, origin, code, 'DetectTwo');
  await host.getByRole('button', { name: 'Start Game' }).click();
  const input = await waitForAnyVisible(pages.map((page) => page.locator('#wordInput')));
  expect(input).not.toBeNull();
  await input!.fill('Mystery');
  await input!.page().getByRole('button', { name: 'Confirm Word' }).click();
  await expect(host.locator('img[alt="Hand Card"]').first()).toBeVisible();
  const turnPage = await waitForAnyVisible(
    pages.map((page) => page.getByText('Your Turn - Play a Card')),
  );
  expect(turnPage).not.toBeNull();
  return { contexts, turnPage: turnPage!.page() };
}

async function playedCount(page: Page) {
  return page.evaluate(() => {
    const state = (window as any).__useGameStore.getState().room.detectiveClubState;
    return Object.values(state.players).reduce(
      (sum: number, player: any) => sum + player.playedCards.length,
      0,
    );
  });
}

for (const { viewport, language } of [
  { viewport: { width: 360, height: 800 }, language: 'th' },
  { viewport: { width: 390, height: 844 }, language: 'en' },
] as const) {
  test(`touch can inspect and play at ${viewport.width}x${viewport.height} in ${language}`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180000);
    const { contexts, turnPage } = await startPlaying(browser, viewport, true);
    try {
      if (language === 'th') await turnPage.getByText('TH', { exact: true }).click();
      const inspect = turnPage.getByRole('button', {
        name: language === 'th' ? /ดูการ์ด.*1/ : /Inspect card 1/,
      });
      const play = turnPage.getByRole('button', {
        name: language === 'th' ? /วางการ์ด.*1/ : /Play card 1/,
      });
      await expect(inspect).toBeVisible();
      await expect(turnPage.getByTestId('cluecanvas-card-preview-0')).toBeVisible();
      await expect(play).toBeVisible();
      await turnPage.screenshot({
        path: testInfo.outputPath(
          `detective-club-controls-${language}-${viewport.width}x${viewport.height}.png`,
        ),
        fullPage: true,
      });
      await inspect.tap();
      await expect(turnPage.getByRole('dialog')).toBeVisible();
      await expect(
        turnPage.getByRole('img', {
          name: language === 'th' ? 'การ์ดภาพขยาย' : 'Enlarged picture card',
        }),
      ).toBeVisible();
      await turnPage.getByRole('button', { name: language === 'th' ? 'ปิด' : 'Close' }).tap();
      await expect(turnPage.getByRole('dialog')).toBeHidden();
      const before = await playedCount(turnPage);
      await play.tap();
      await expect(turnPage.getByRole('dialog')).toBeVisible();
      expect(await playedCount(turnPage)).toBe(before);
      await turnPage
        .getByRole('button', { name: language === 'th' ? 'วางการ์ด' : 'Play Card', exact: true })
        .tap();
      await expect.poll(() => playedCount(turnPage)).toBe(before + 1);
      await turnPage.screenshot({
        path: testInfo.outputPath(
          `detective-club-${language}-${viewport.width}x${viewport.height}.png`,
        ),
        fullPage: true,
      });
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

test('keyboard inspection and confirmation trap focus, Escape restores focus, and play reaches server', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const { contexts, turnPage } = await startPlaying(browser, { width: 1280, height: 900 }, false);
  try {
    const inspect = turnPage.getByRole('button', { name: 'Inspect card 1' });
    const play = turnPage.getByRole('button', { name: 'Play card 1' });
    await expect(turnPage.getByTestId('cluecanvas-card-preview-0')).toBeVisible();
    await turnPage.screenshot({
      path: testInfo.outputPath('detective-club-controls-en-1280x900.png'),
      fullPage: true,
    });
    await inspect.focus();
    await turnPage.keyboard.press('Enter');
    const dialog = turnPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await turnPage.keyboard.press('Tab');
      await expect
        .poll(() => turnPage.evaluate(() => document.activeElement?.closest('dialog') !== null))
        .toBe(true);
    }
    await turnPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(inspect).toBeFocused();
    await expect(turnPage.getByTestId('cluecanvas-card-preview-0')).toBeFocused();

    const before = await playedCount(turnPage);
    await play.focus();
    await turnPage.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await turnPage.keyboard.press(i === 3 ? 'Shift+Tab' : 'Tab');
      await expect
        .poll(() => turnPage.evaluate(() => document.activeElement?.closest('dialog') !== null))
        .toBe(true);
    }
    expect(await playedCount(turnPage)).toBe(before);
    await turnPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(play).toBeFocused();
    await turnPage.keyboard.press('Enter');
    await turnPage.getByRole('button', { name: 'Play Card', exact: true }).click();
    await expect.poll(() => playedCount(turnPage)).toBe(before + 1);
    await turnPage.screenshot({
      path: testInfo.outputPath('detective-club-en-1280x900.png'),
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
