import { test, expect } from '@playwright/test';
import { createRoom, getOrigin, goToLobbyInEnglish, joinRoom } from './helpers';

test('unlisted room stays out of catalog, accepts code joins and reconnects, and enforces spectator policy', async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const code = await createRoom(page, 'PolicyHost', 'Knowguise');
  await expect(page.getByRole('button', { name: 'Unlisted', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Disabled', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy Link' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${await getOrigin(page)}/?room=${code}`,
  );

  const catalog = await browser.newPage();
  await goToLobbyInEnglish(catalog);
  await expect(catalog.getByRole('button', { name: new RegExp(code) })).toHaveCount(0);

  await page.getByRole('button', { name: 'Public', exact: true }).click();
  await expect(catalog.getByRole('button', { name: new RegExp(code) })).toBeVisible();
  await page.getByRole('button', { name: 'Unlisted', exact: true }).click();
  await expect(catalog.getByRole('button', { name: new RegExp(code) })).toHaveCount(0);

  const origin = await getOrigin(page);
  const guest = await browser.newPage();
  await joinRoom(guest, origin, code, 'PolicyGuest');
  await expect(guest.getByRole('button', { name: 'Public', exact: true })).toBeDisabled();
  const playerId = await guest.evaluate(
    () => (window as any).__useGameStore.getState().playerId as string,
  );
  await guest.reload();
  await expect
    .poll(() => guest.evaluate(() => (window as any).__useGameStore.getState().playerId))
    .toBe(playerId);
  await expect
    .poll(() => page.evaluate(() => (window as any).__useGameStore.getState().room.players.length))
    .toBe(2);

  const observer = await browser.newPage();
  await goToLobbyInEnglish(observer);
  await observer.evaluate((roomCode) => {
    const store = (window as any).__useGameStore.getState();
    store.setName('PolicyObserver');
    store.spectateJoin(roomCode);
  }, code);
  await expect(observer.getByText('This room does not allow spectators.')).toBeVisible();
  await expect
    .poll(() => observer.evaluate(() => (window as any).__useGameStore.getState().room))
    .toBeNull();

  await page.getByRole('button', { name: 'Allowed', exact: true }).click();
  await observer.evaluate(
    (roomCode) => (window as any).__useGameStore.getState().spectateJoin(roomCode),
    code,
  );
  await expect
    .poll(() => observer.evaluate(() => (window as any).__useGameStore.getState().room?.code))
    .toBe(code);
  await expect
    .poll(() => observer.evaluate(() => (window as any).__useGameStore.getState().isSpectator))
    .toBe(true);

  await catalog.close();
  await guest.close();
  await observer.close();
});

test('a denied spectator request keeps the current seated room and session', async ({
  browser,
  page,
}) => {
  const originalCode = await createRoom(page, 'CurrentHost', 'Knowguise');
  const otherHost = await browser.newPage();
  const deniedCode = await createRoom(otherHost, 'OtherHost', 'Knowguise');
  const before = await page.evaluate(() => {
    const state = (window as any).__useGameStore.getState();
    return {
      playerId: state.playerId,
      reconnectToken: localStorage.getItem('kz-reconnectToken'),
    };
  });
  expect(before.playerId).toBeTruthy();
  expect(before.reconnectToken).toBeTruthy();

  await page.evaluate(
    (code) => (window as any).__useGameStore.getState().spectateJoin(code),
    deniedCode,
  );
  await expect(page.getByText('This room does not allow spectators.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__useGameStore.getState().room?.code))
    .toBe(originalCode);
  expect(await page.evaluate(() => (window as any).__useGameStore.getState().playerId)).toBe(
    before.playerId,
  );
  expect(await page.evaluate(() => (window as any).__useGameStore.getState().isSpectator)).toBe(
    false,
  );
  expect(await page.evaluate(() => localStorage.getItem('kz-reconnectToken'))).toBe(
    before.reconnectToken,
  );
  await otherHost.close();
});

for (const { width, height, language } of [
  { width: 360, height: 800, language: 'th' },
  { width: 390, height: 844, language: 'en' },
] as const) {
  test(`room policy controls remain usable at ${width}x${height} in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await createRoom(page, `Host${width}`, 'Knowguise');
    if (language === 'th') await page.getByText('TH', { exact: true }).click();
    const publicLabel = language === 'th' ? 'สาธารณะ' : 'Public';
    const unlistedLabel = language === 'th' ? 'ไม่แสดงในรายการ' : 'Unlisted';
    await expect(page.getByRole('button', { name: unlistedLabel, exact: true })).toBeVisible();
    await page.getByRole('button', { name: publicLabel, exact: true }).click();
    await expect(page.getByRole('button', { name: publicLabel, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
