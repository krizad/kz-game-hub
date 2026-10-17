import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import type {
  CipherGridMode,
  CipherGridPicturePack,
  CipherGridState,
  RoomState,
} from '@repo/types';
import { createRoom, getOrigin, goToLobbyInEnglish, joinRoom } from './helpers';

interface BrowserStore {
  room: RoomState | null;
  privateState: Record<string, unknown>;
  socketId: string;
  setName: (name: string) => void;
  spectateJoin: (code: string) => void;
}

export async function readCipherState(page: Page): Promise<CipherGridState> {
  return page.evaluate(() => {
    const store = (
      window as unknown as { __useGameStore: { getState: () => BrowserStore } }
    ).__useGameStore.getState();
    return store.room!.cipherGridState!;
  });
}

async function expectNoPrivateKey(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = (
          window as unknown as { __useGameStore: { getState: () => BrowserStore } }
        ).__useGameStore.getState();
        return store.privateState?.cipherKeycard;
      }),
    )
    .toBeUndefined();
  await expect(page.getByTestId('peek-keycard-btn')).toHaveCount(0);
  await expect(page.locator('[data-card-type]')).toHaveCount(0);
}

async function selectAndReveal(page: Page, index: number) {
  const tile = page.getByTestId(`card-tile-${index}`);
  const isSelected = (await tile.getAttribute('data-selected')) === 'true';
  if (!isSelected) {
    await tile.click();
  }
  await page.getByTestId('reveal-card-btn').click();
  await page.getByTestId('confirm-reveal-btn').click();
  await expect(tile).toHaveAttribute('data-revealed', 'true');
}

export async function playCipherScenario(
  browser: Browser,
  mode: CipherGridMode,
  reason: 'VIRUS' | 'ALL_FOUND',
  info: TestInfo,
  picturePack: CipherGridPicturePack = 'MINIMAL',
) {
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  const [solarLead, solarTracker, lunarLead, lunarTracker, viewer] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  const pages = [solarLead, solarTracker, lunarLead, lunarTracker];
  const host = solarLead;
  const size = mode === 'PICTURES' ? 20 : 25;
  try {
    const code = await createRoom(host, 'PictureHost', 'CIPHER_GRID');
    await host.getByTestId('cipher-grid-mode').selectOption(mode);
    await expect(host.getByTestId('cipher-grid-mode')).toHaveValue(mode);
    if (mode === 'PICTURES') {
      await host.getByTestId('cipher-grid-picture-pack').selectOption(picturePack);
      await expect(host.getByTestId('cipher-grid-picture-pack')).toHaveValue(picturePack);
    }
    await host.getByTestId('lobby-advanced-settings').locator('summary').click();
    await host.getByRole('button', { name: 'Allowed', exact: true }).click();
    const origin = await getOrigin(host);
    await joinRoom(solarTracker, origin, code, 'SolarTracker');
    await joinRoom(lunarLead, origin, code, 'LunarLead');
    await joinRoom(lunarTracker, origin, code, 'LunarTracker');
    await expect(solarTracker.getByTestId('cipher-grid-mode')).toBeDisabled();
    await host.getByRole('button', { name: /Start Game|เริ่มเกม/ }).click();
    const seats = [
      'join-solar-lead-btn',
      'join-solar-tracker-btn',
      'join-lunar-lead-btn',
      'join-lunar-tracker-btn',
    ];
    for (let index = 0; index < pages.length; index++) {
      await pages[index].getByTestId(seats[index]).click();
    }
    await expect(host.getByTestId('start-match-btn')).toBeEnabled();
    await host.getByTestId('start-match-btn').click();
    for (const page of pages)
      await expect(page.locator('[data-testid^="card-tile-"]')).toHaveCount(size);
    expect((await readCipherState(host)).mode).toBe(mode);
    if (mode === 'PICTURES') {
      const expectedPackPath = picturePack === 'MINIMAL' ? 'pictures-minimal' : 'pictures-v1';
      await expect(host.locator('img[src*="/images/cipher-grid/"]').first()).toHaveAttribute(
        'src',
        new RegExp(expectedPackPath),
      );
    }
    await expectNoPrivateKey(solarTracker);
    await expectNoPrivateKey(lunarTracker);

    await goToLobbyInEnglish(viewer);
    await viewer.evaluate((roomCode) => {
      const store = (
        window as unknown as { __useGameStore: { getState: () => BrowserStore } }
      ).__useGameStore.getState();
      store.setName('PictureObserver');
      store.spectateJoin(roomCode);
    }, code);
    await expect(viewer.locator('[data-testid^="card-tile-"]')).toHaveCount(size);
    await expectNoPrivateKey(viewer);

    // Reconnect both roles before guessing and verify the key remains private.
    await lunarLead.reload();
    await expect(lunarLead.getByTestId('peek-keycard-btn')).toBeVisible();
    await solarTracker.reload();
    await expect(solarTracker.locator('[data-testid^="card-tile-"]')).toHaveCount(size);
    await expectNoPrivateKey(solarTracker);
    const currentTeam = (await readCipherState(host)).currentTeam!;
    const lead = currentTeam === 'SOLAR' ? solarLead : lunarLead;
    const tracker = currentTeam === 'SOLAR' ? solarTracker : lunarTracker;
    const opponent = currentTeam === 'SOLAR' ? lunarTracker : solarTracker;

    if (mode === 'PICTURES') {
      await viewer.getByTestId('picture-zoom-0').click();
      await expect(viewer.getByTestId('close-picture-zoom')).toBeVisible();
      await expect(viewer.getByTestId('reveal-card-btn')).toHaveCount(0);
      await viewer.getByTestId('close-picture-zoom').click();
    }
    await lead.getByTestId('clue-word-input').fill('two words');
    await lead.getByTestId('give-clue-btn').click();
    await expect(lead.getByTestId('clue-word-input')).toHaveValue('two words');
    await lead.getByTestId('clue-word-input').fill('SHAPES');
    await lead.getByTestId('clue-count-select').selectOption('0');
    await lead.getByTestId('give-clue-btn').click();
    await expect(tracker.getByTestId('current-clue-banner')).toContainText('SHAPES');
    await expect(tracker.getByTestId('current-clue-banner')).toContainText('∞');
    await expect(tracker.getByTestId('end-turn-btn')).toBeDisabled();
    await lead.getByTestId('peek-keycard-btn').click();
    await expect(lead.locator('[data-card-type]')).toHaveCount(size);
    await expectNoPrivateKey(tracker);
    await expectNoPrivateKey(viewer);

    if (reason === 'VIRUS') {
      await opponent.getByTestId('challenge-clue-btn').click();
      await opponent.getByTestId('confirm-challenge-btn').click();
      await expect(lead.getByTestId('reject-challenge-btn')).toBeVisible();
      expect((await readCipherState(lead)).board.every((card) => !card.revealed)).toBe(true);
      await lead.getByTestId('reject-challenge-btn').click();
      await expect(opponent.getByTestId('challenge-clue-btn')).toHaveCount(0);
    }

    const firstOwn = lead
      .locator(`[data-testid^="card-tile-"][data-card-type="${currentTeam}"]`)
      .first();
    const firstIndex = Number(
      (await firstOwn.getAttribute('data-testid'))!.replace('card-tile-', ''),
    );
    await tracker.getByTestId(`card-tile-${firstIndex}`).click();
    await tracker.getByTestId('ping-card-btn').click();
    await expect(tracker.getByTestId(`card-tile-${firstIndex}`)).toContainText('📍');

    if (mode === 'PICTURES') {
      for (const width of [360, 390, 1440]) {
        await tracker.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await expect
          .poll(() =>
            tracker.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);
        await tracker.screenshot({
          path: info.outputPath(`pictures-${width}.png`),
          fullPage: true,
        });
      }
      await tracker.getByTestId(`picture-zoom-${firstIndex}`).click();
      await expect(tracker.getByTestId('close-picture-zoom')).toBeVisible();
      await tracker.screenshot({ path: info.outputPath('pictures-zoom.png') });
      await tracker.keyboard.press('Escape');
      await expect(tracker.getByTestId('close-picture-zoom')).not.toBeVisible();
    }

    await selectAndReveal(tracker, firstIndex);
    await expect(tracker.getByTestId('end-turn-btn')).toBeEnabled();
    if (reason === 'VIRUS') {
      const virusTile = lead.locator('[data-testid^="card-tile-"][data-card-type="VIRUS"]');
      const virusIndex = Number(
        (await virusTile.getAttribute('data-testid'))!.replace('card-tile-', ''),
      );
      await selectAndReveal(tracker, virusIndex);
    } else {
      const ownTiles = await lead
        .locator(
          `[data-testid^="card-tile-"][data-card-type="${currentTeam}"][data-revealed="false"]`,
        )
        .evaluateAll((elements) =>
          elements.map((element) =>
            Number(element.getAttribute('data-testid')!.replace('card-tile-', '')),
          ),
        );
      for (const index of ownTiles) await selectAndReveal(tracker, index);
    }
    for (const page of pages) await expect(page.getByTestId('round-end-banner')).toBeVisible();
    const end = await readCipherState(host);
    expect(end.winReason).toBe(reason);
    expect(end.scores[end.winner!]).toBe(1);
    await expect(viewer.locator('[data-card-type]')).toHaveCount(size);
    await viewer.screenshot({
      path: info.outputPath(`${mode.toLowerCase()}-result.png`),
      fullPage: true,
    });

    let controller: Page | undefined;
    for (const page of pages) {
      if (await page.getByTestId('next-round-btn').isVisible()) controller = page;
    }
    expect(controller).toBeDefined();
    await controller!.getByTestId('next-round-btn').click();
    await expect(controller!.getByTestId('ciphergrid-team-setup')).toBeVisible();
    expect((await readCipherState(controller!)).mode).toBe(mode);
    await controller!.getByTestId('start-match-btn').click();
    await expect(controller!.locator('[data-testid^="card-tile-"]')).toHaveCount(size);
    const beforeCancel = await readCipherState(controller!);
    for (const page of [...pages.filter((page) => page !== controller), viewer]) {
      await expect(page.getByTestId('cancel-round-btn')).toHaveCount(0);
    }
    await controller!.getByTestId('cancel-round-btn').click();
    await controller!.getByTestId('keep-round-btn').click();
    expect((await readCipherState(controller!)).phase).toBe('CLUE_GIVING');
    await controller!.getByTestId('cancel-round-btn').click();
    await controller!.getByTestId('confirm-cancel-round-btn').click();
    for (const page of [...pages, viewer]) {
      await expect(page.getByTestId('ciphergrid-team-setup')).toBeVisible();
      await expectNoPrivateKey(page);
    }
    const cancelled = await readCipherState(controller!);
    expect(cancelled.scores).toEqual(beforeCancel.scores);
    expect(cancelled.teams).toEqual(beforeCancel.teams);
    expect(cancelled.cipherLeads).toEqual(beforeCancel.cipherLeads);
    expect(cancelled.round).toBe(beforeCancel.round);
    expect(cancelled.board).toEqual([]);
    expect(cancelled.turnEndsAt).toBeNull();
    await controller!.getByTestId('start-match-btn').click();
    await expect(controller!.locator('[data-testid^="card-tile-"]')).toHaveCount(size);
    expect((await readCipherState(controller!)).round).toBe(beforeCancel.round + 1);
    // Finish another scored round via the active team's authorized peek.
    const nextTeam = (await readCipherState(controller!)).currentTeam;
    const nextLead = nextTeam === 'SOLAR' ? solarLead : lunarLead;
    const nextTracker = nextTeam === 'SOLAR' ? solarTracker : lunarTracker;
    await nextLead.getByTestId('clue-word-input').fill('FINAL');
    await nextLead.getByTestId('give-clue-btn').click();
    await nextLead.getByTestId('peek-keycard-btn').click();
    const lastVirus = nextLead.locator('[data-card-type="VIRUS"]');
    const lastIndex = Number(
      (await lastVirus.getAttribute('data-testid'))!.replace('card-tile-', ''),
    );
    await selectAndReveal(nextTracker, lastIndex);
    await expect(controller!.getByTestId('reset-to-lobby-btn')).toBeVisible();
    await controller!.getByTestId('reset-to-lobby-btn').click();
    await expect(controller!.getByTestId('cipher-grid-mode')).toHaveValue(mode);
    await expect
      .poll(() =>
        controller!.evaluate(() => {
          const store = (
            window as unknown as { __useGameStore: { getState: () => BrowserStore } }
          ).__useGameStore.getState();
          return store.privateState?.cipherKeycard;
        }),
      )
      .toBeUndefined();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
}
