import { test, expect, type Locator } from '@playwright/test';
import { goToLobbyInEnglish } from './helpers';
import { setupSession } from './sim/play';
import { GAME_MATRIX } from './sim/matrix';

async function withinMobile(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
}
const entry = (id: string) => GAME_MATRIX.find((e) => e.id === id)!;

test('mobile Join remains accessible in both languages', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await goToLobbyInEnglish(page);
  await page.locator('#lobbyNameInput').fill('Alice');
  await page.locator('#roomCodeInput').fill('ABC123');
  await withinMobile(page.getByTestId('hub-join-room'));
  await page.getByRole('button', { name: 'TH', exact: true }).click();
  await expect(page.getByTestId('hub-join-room')).not.toContainText('Join');
  await withinMobile(page.getByTestId('hub-join-room'));
});

test('Rules traps keyboard focus and Escape returns focus to its trigger', async ({ page }) => {
  await goToLobbyInEnglish(page);
  const trigger = page.getByRole('button', { name: 'Rules', exact: true }).first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('Slave mobile hand reaches all 26 cards inside its own scroll area', async ({ browser }) => {
  const session = await setupSession(browser, entry('card-pok-deng'), 1);
  try {
    await session.host.getByTestId('card-game-preset-slave').click();
    await session.host.getByTestId('lobby-start-game').click();
    await session.host.setViewportSize({ width: 360, height: 800 });
    const hand = session.host.getByTestId('card-hand');
    await expect(hand.locator(':scope > *')).toHaveCount(26);
    const scroll = session.host.getByTestId('card-hand-scroll');
    await scroll.focus();
    await hand.locator(':scope > *').last().scrollIntoViewIfNeeded();
    await withinMobile(hand.locator(':scope > *').last());
    expect(await scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  } finally {
    await session.cleanup();
  }
});

test('Coup mobile header and target actions stay on screen', async ({ browser }) => {
  const session = await setupSession(browser, entry('coup-3p'), 1);
  try {
    await session.host.getByTestId('lobby-start-game').click();
    await session.host.setViewportSize({ width: 360, height: 800 });
    await withinMobile(session.host.getByTestId('coup-return-lobby'));
    await withinMobile(session.host.getByTestId('coup-action-assassinate'));
  } finally {
    await session.cleanup();
  }
});

test('Music artist preset starts without a query, but empty difficulty is explained', async ({
  browser,
}) => {
  const session = await setupSession(
    browser,
    { ...entry('music-trivia-typing'), configure: [] },
    1,
  );
  try {
    await session.host.locator('#musicSearchTermInput').fill('');
    await expect(session.host.getByTestId('lobby-start-game')).toBeDisabled();
    await session.host.getByRole('button', { name: /Free search/i }).click();
    await session.host
      .getByRole('button', { name: /Pick an Artist/i })
      .last()
      .click();
    await expect(session.host.getByTestId('lobby-start-game')).toBeEnabled();
    await session.host.getByRole('button', { name: /^Easy/i }).click();
    await session.host.getByRole('button', { name: /^Hard/i }).last().click();
    await expect(session.host.getByTestId('lobby-start-game')).toBeDisabled();
    await expect(session.host.getByTestId('lobby-start-reason')).toContainText('no tracks');
    await session.host.getByRole('button', { name: /^Hard/i }).click();
    await session.host.getByRole('button', { name: /^Easy/i }).last().click();
    await session.host.getByTestId('lobby-start-game').click();
    await expect(session.host.getByRole('button', { name: /Ready/i }).first()).toBeVisible();
  } finally {
    await session.cleanup();
  }
});

test('Poker both modes offer a full minimum and preserve chip totals after raising', async ({
  browser,
}) => {
  for (const id of ['poker-online', 'poker-ledger']) {
    const session = await setupSession(browser, entry(id), 1);
    try {
      await session.host.getByTestId('lobby-start-game').click();
      await expect(session.host.getByTestId('poker-table')).toBeVisible();
      const actor = (await session.host.getByTestId('poker-action-panel').isVisible())
        ? session.host
        : session.players[1];
      await actor.setViewportSize({ width: 360, height: 800 });
      await expect(actor.getByTestId('poker-bet-input')).toHaveValue('40');
      await expect(actor.getByTestId('poker-quick-allin')).toHaveText('All-in');
      await withinMobile(actor.getByTestId('poker-bet-confirm'));
      await actor.getByTestId('poker-bet-confirm').click();
      await expect(session.host.getByTestId('poker-pot')).toContainText('60');
      const opponent = actor === session.host ? session.players[1] : session.host;
      await expect(opponent.getByTestId('poker-bet-input')).toHaveValue('60');
    } finally {
      await session.cleanup();
    }
  }
});

test('offline player recovers the same seat with no stale move', async ({ browser }) => {
  const session = await setupSession(browser, entry('ttt-classic-2p'), 1);
  try {
    const bob = session.players[1];
    await session.host.getByTestId('ttt-join-x').click();
    await bob.getByTestId('ttt-join-o').click();
    await session.host.getByTestId('ttt-cell-0').click();
    await expect(bob.getByTestId('ttt-cell-0')).toHaveText('X');
    await bob.context().setOffline(true);
    await expect(bob.getByTestId('connection-status')).toBeVisible({ timeout: 15000 });
    await expect(bob.getByRole('button', { name: 'Retry connection' })).toBeVisible();
    await expect(bob.getByTestId('ttt-cell-4')).toHaveCount(0);
    await bob.context().setOffline(false);
    await bob.getByRole('button', { name: 'Retry connection' }).click();
    await expect(bob.getByTestId('connection-status')).toHaveCount(0);
    await expect(bob.getByTestId('ttt-cell-0')).toHaveText('X');
    await expect(bob.getByTestId('ttt-cell-4')).toHaveText('');
    await bob.getByTestId('ttt-cell-4').click();
    await expect(session.host.getByTestId('ttt-cell-4')).toHaveText('O');
  } finally {
    await session.cleanup();
  }
});
