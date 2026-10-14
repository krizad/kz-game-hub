import { expect, test, type Page } from '@playwright/test';
import { createRoom, getOrigin, goToLobbyInEnglish, joinRoom } from './helpers';

type Mode = 'CLASSIC' | 'GOBBLER' | 'ULTIMATE';

const modes: Array<{
  mode: Mode;
  viewport: { width: number; height: number };
  language: 'en' | 'th';
  cellPrefix: string;
  firstCell: string;
  secondCell: string;
}> = [
  {
    mode: 'CLASSIC',
    viewport: { width: 360, height: 800 },
    language: 'th',
    cellPrefix: 'ttt-cell-',
    firstCell: 'ttt-cell-0',
    secondCell: 'ttt-cell-1',
  },
  {
    mode: 'GOBBLER',
    viewport: { width: 390, height: 844 },
    language: 'en',
    cellPrefix: 'gobbler-cell-',
    firstCell: 'gobbler-cell-0',
    secondCell: 'gobbler-cell-1',
  },
  {
    mode: 'ULTIMATE',
    viewport: { width: 1280, height: 900 },
    language: 'th',
    cellPrefix: 'uttt-cell-',
    firstCell: 'uttt-cell-0-0',
    secondCell: 'uttt-cell-0-1',
  },
];

async function tabTo(page: Page, testId: string) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await page.getByTestId(testId).evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`Tab did not reach ${testId}`);
}

for (const { mode, viewport, language, cellPrefix, firstCell, secondCell } of modes) {
  test(`${mode}: keyboard moves, unique localized names, and disabled non-player controls`, async ({
    browser,
  }) => {
    const host = await browser.newPage({ viewport });
    const guest = await browser.newPage({ viewport });
    const observer = await browser.newPage({ viewport });

    try {
      const code = await createRoom(host, `Host${mode}`, 'Tic-Tac-Toe', mode);
      const origin = await getOrigin(host);
      await host.getByRole('button', { name: 'Allowed', exact: true }).click();
      await joinRoom(guest, origin, code, `Guest${mode}`);

      if (mode === 'CLASSIC') {
        await host.getByTestId('ttt-join-x').click();
        await guest.getByTestId('ttt-join-o').click();
      } else if (mode === 'GOBBLER') {
        await host.getByRole('button', { name: 'Join X' }).click();
        await guest.getByRole('button', { name: 'Join O' }).click();
      } else {
        await host.getByTestId('uttt-join-x').click();
        await guest.getByTestId('uttt-join-o').click();
      }

      await expect(host.getByTestId(firstCell)).toBeVisible();
      await goToLobbyInEnglish(observer);
      await observer.evaluate((roomCode) => {
        const store = (window as any).__useGameStore.getState();
        store.setName('KeyboardObserver');
        store.spectateJoin(roomCode);
      }, code);
      await expect(observer.getByTestId(firstCell)).toBeVisible();

      if (language === 'th') {
        await host.getByText('TH', { exact: true }).click();
        await guest.getByText('TH', { exact: true }).click();
        await observer.getByText('TH', { exact: true }).click();
      }

      const hostCells = host.locator(`[data-testid^="${cellPrefix}"]`);
      const names = await hostCells.evaluateAll((cells) =>
        cells.map((cell) => cell.getAttribute('aria-label')),
      );
      expect(names.length).toBe(mode === 'ULTIMATE' ? 81 : 9);
      expect(names.every(Boolean)).toBe(true);
      expect(new Set(names).size).toBe(names.length);
      expect(names[0]).toContain(
        language === 'th'
          ? mode === 'ULTIMATE'
            ? 'กระดาน'
            : 'แถว'
          : mode === 'ULTIMATE'
            ? 'Board'
            : 'Row',
      );
      expect(names[0]).toContain(language === 'th' ? 'ว่าง' : 'Empty');

      await expect(guest.getByTestId(firstCell)).toBeDisabled();
      await expect(observer.getByTestId(firstCell)).toBeDisabled();
      await expect(guest.getByTestId(firstCell)).toHaveAttribute(
        'aria-label',
        new RegExp(language === 'th' ? 'ไม่ใช่ตาของคุณ' : 'Not your turn'),
      );
      await expect(observer.getByTestId(firstCell)).toHaveAttribute(
        'aria-label',
        new RegExp(language === 'th' ? 'กำลังรับชม' : 'Spectating'),
      );

      if (mode === 'GOBBLER') {
        const inventory = host.getByTestId('gobbler-inventory-X-stack-2');
        await expect(inventory).toHaveAttribute('type', 'button');
        await expect(inventory).toHaveAttribute('aria-pressed', 'false');
        await expect(inventory).toHaveAccessibleName(
          language === 'th' ? /หมาก X ขนาด ใหญ่/ : /X Large piece/,
        );
        await expect(guest.getByTestId('gobbler-inventory-X-stack-2')).toBeDisabled();
        await expect(observer.getByTestId('gobbler-inventory-X-stack-2')).toBeDisabled();
        await tabTo(host, 'gobbler-inventory-X-stack-2');
        await host.keyboard.press('Enter');
        await expect(inventory).toHaveAttribute('aria-pressed', 'true');
      }

      // A pending socket action disables an otherwise legal cell and explains why.
      await host.evaluate(() => (window as any).__useGameStore.setState({ actionLoading: true }));
      await expect(host.getByTestId(firstCell)).toBeDisabled();
      await expect(host.getByTestId(firstCell)).toHaveAttribute(
        'aria-label',
        new RegExp(language === 'th' ? 'โปรดรอ' : 'Please wait'),
      );
      await host.evaluate(() => (window as any).__useGameStore.setState({ actionLoading: false }));

      await tabTo(host, firstCell);
      await expect(host.getByTestId(firstCell)).toBeEnabled();
      await host.keyboard.press('Enter');
      await expect(host.getByTestId(firstCell)).toHaveAttribute('aria-label', /X/);
      await expect(guest.getByTestId(firstCell)).toHaveAttribute('aria-label', /X/);
      await expect(observer.getByTestId(firstCell)).toHaveAttribute('aria-label', /X/);
      await expect(host.getByTestId(secondCell)).toBeDisabled();
      await expect(observer.getByTestId(secondCell)).toBeDisabled();
      if (mode === 'GOBBLER') {
        await expect(guest.getByTestId(secondCell)).toBeDisabled();
        await guest.getByTestId('gobbler-inventory-O-stack-2').click();
      }
      await expect(guest.getByTestId(secondCell)).toBeEnabled();
    } finally {
      await host.close();
      await guest.close();
      await observer.close();
    }
  });
}
