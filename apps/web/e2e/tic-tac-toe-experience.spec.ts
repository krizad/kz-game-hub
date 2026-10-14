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
  }, testInfo) => {
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
        // O's large piece cannot cover X's equal-size large piece.
        await expect(guest.getByTestId(firstCell)).toBeDisabled();
        await expect(guest.getByTestId(firstCell)).toHaveAccessibleName(
          'Row 1, Column 1: Large X (Choose a larger piece to cover this piece)',
        );
        await guest.screenshot({ path: testInfo.outputPath('gobbler-equal-size-en-390x844.png') });
      }
      await expect(guest.getByTestId(secondCell)).toBeEnabled();
    } finally {
      await host.close();
      await guest.close();
      await observer.close();
    }
  });
}

test('ULTIMATE: touch/focus next-board preview, disabled reasons, and 360px viewport fit', async ({
  browser,
}, testInfo) => {
  const host = await browser.newPage({ viewport: { width: 360, height: 800 } });
  const guest = await browser.newPage({ viewport: { width: 360, height: 800 } });

  try {
    const code = await createRoom(host, 'HostU', 'Tic-Tac-Toe', 'ULTIMATE');
    const origin = await getOrigin(host);
    await host.getByRole('button', { name: 'Allowed', exact: true }).click();
    await joinRoom(guest, origin, code, 'GuestU');

    await host.getByTestId('uttt-join-x').click();
    await guest.getByTestId('uttt-join-o').click();

    // Mode badge visible
    await expect(host.getByTestId('ttt-current-mode-badge')).toBeVisible();
    await expect(host.getByTestId('ttt-current-mode-badge')).toContainText(/Ultimate/);

    // 360px viewport check: zero horizontal overflow
    const hasHorizontalOverflow = await host.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Initial state: free move, no cell focused, so target preview banner is not visible
    await expect(host.getByTestId('uttt-target-preview')).toBeHidden();

    // Focus cell in macro 4, micro 2 (Board #5, micro cell #3)
    // Moving at micro 2 routes opponent to macro board 2 (Board #3)
    await host.getByTestId('uttt-cell-4-2').focus();

    // Target preview banner and highlighted target macro board appear without hovering
    await expect(host.getByTestId('uttt-target-preview')).toBeVisible();
    await expect(host.getByTestId('uttt-target-preview')).toHaveText(/Board #3/);
    await expect(host.getByTestId('uttt-target-board-preview')).toBeVisible();
    await expect(host.getByTestId('uttt-target-board-preview')).toHaveText(/#3/);

    await host.screenshot({ path: testInfo.outputPath('uttt-360-preview.png') });

    // Host plays cell 4-2
    await host.getByTestId('uttt-cell-4-2').click();

    // Opponent (Guest) is routed to Board #3 (macro index 2)
    // Macro index 0 cells are disabled for guest with specific reason
    await expect(guest.getByTestId('uttt-cell-0-0')).toBeDisabled();
    await expect(guest.getByTestId('uttt-cell-0-0')).toHaveAttribute(
      'aria-label',
      /Must play in Board #3/,
    );

    // Guest focuses cell 2-7 in Board #3, which routes back to Board #8
    await guest.getByTestId('uttt-cell-2-7').focus();
    await expect(guest.getByTestId('uttt-target-preview')).toBeVisible();
    await expect(guest.getByTestId('uttt-target-preview')).toHaveText(/Board #8/);
  } finally {
    await host.close();
    await guest.close();
  }
});

test('Unified results, rematch mode/bot persistence, and change mode', async ({ browser }) => {
  const host = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    // 1. Classic vs Bot: plays with God bot, tests rematch mode & difficulty persistence
    const code = await createRoom(host, 'HostBot', 'Tic-Tac-Toe');
    await host.getByTestId('ttt-opponent-bot').click();
    await host.getByTestId('ttt-diff-god').click();
    await host.getByTestId('ttt-join-x').click();

    // Bot is seated as O and game starts
    await expect(host.getByTestId('ttt-current-mode-badge')).toBeVisible();
    await expect(host.getByTestId('ttt-current-mode-badge')).toContainText(/Classic/);
    await expect(host.getByText('BOT (God)')).toBeVisible();

    // Play moves until result
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const cell = host.getByTestId(`ttt-cell-${i}`);
      if (await cell.isEnabled()) {
        await cell.click();
        await host.waitForTimeout(350);
        const hasResult = await host
          .locator('[data-testid="ttt-result-winner"], [data-testid="ttt-result-draw"]')
          .isVisible();
        if (hasResult) break;
      }
    }

    // Result screen in Classic
    await expect(
      host.locator('[data-testid="ttt-result-winner"], [data-testid="ttt-result-draw"]'),
    ).toBeVisible();
    await expect(host.getByTestId('ttt-rematch-btn')).toBeVisible();
    await expect(host.getByTestId('ttt-change-mode-btn')).toBeVisible();

    // Rematch: click rematch button
    await host.getByTestId('ttt-rematch-btn').click();

    // Should restart playing immediately, keeping vs Bot and God difficulty
    await expect(host.getByTestId('ttt-cell-0')).toBeVisible();
    await expect(host.getByText('BOT (God)')).toBeVisible();
    await expect(host.getByTestId('ttt-current-mode-badge')).toContainText(/Classic/);

    // 2. Change mode: host clicks change mode to return to lobby
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const cell = host.getByTestId(`ttt-cell-${i}`);
      if (await cell.isEnabled()) {
        await cell.click();
        await host.waitForTimeout(350);
        const hasResult = await host
          .locator('[data-testid="ttt-result-winner"], [data-testid="ttt-result-draw"]')
          .isVisible();
        if (hasResult) break;
      }
    }

    await expect(host.getByTestId('ttt-change-mode-btn')).toBeVisible();
    await host.getByTestId('ttt-change-mode-btn').click();

    // Returned to lobby, still in Classic mode
    await expect(host.getByTestId('ttt-mode-classic')).toBeVisible();

    // Switch to Gobbler mode
    await host.getByTestId('ttt-mode-gobbler').click();
    await host.waitForTimeout(1000);

    // Guest joins Gobbler room
    const origin = await getOrigin(host);
    await host.getByRole('button', { name: 'Allowed', exact: true }).click();
    await joinRoom(guest, origin, code, 'GuestGobbler');

    // Both join seats
    await host.getByRole('button', { name: 'Join X' }).click();
    await guest.getByRole('button', { name: 'Join O' }).click();

    // Mode badge visible in Gobbler
    await expect(host.getByTestId('ttt-current-mode-badge')).toBeVisible();
    await expect(host.getByTestId('ttt-current-mode-badge')).toContainText(/Gobbler/);
    await expect(guest.getByTestId('ttt-current-mode-badge')).toBeVisible();

    // Fast-forward to result by having host and guest play 3 cells in a row
    // X places at 0
    await host.getByTestId('gobbler-inventory-X-stack-2').click();
    await host.getByTestId('gobbler-cell-0').click();
    // O places at 3
    await guest.getByTestId('gobbler-inventory-O-stack-2').click();
    await guest.getByTestId('gobbler-cell-3').click();
    // X places at 1
    await host.getByTestId('gobbler-inventory-X-stack-2').click();
    await host.getByTestId('gobbler-cell-1').click();
    // O places at 4
    await guest.getByTestId('gobbler-inventory-O-stack-2').click();
    await guest.getByTestId('gobbler-cell-4').click();
    // X places at 2 (X wins row 0-1-2!)
    await host.getByTestId('gobbler-inventory-X-stack-1').click();
    await host.getByTestId('gobbler-cell-2').click();

    // Result banner in Gobbler
    await expect(host.getByTestId('ttt-result-winner')).toBeVisible();
    await expect(guest.getByTestId('ttt-result-winner')).toBeVisible();

    // Rematch and Change Mode controls
    await expect(host.getByTestId('ttt-rematch-btn')).toBeVisible();
    await expect(host.getByTestId('ttt-change-mode-btn')).toBeVisible();
    // Guest sees waiting message
    await expect(guest.getByTestId('ttt-waiting-host')).toBeVisible();

    // Host clicks rematch: stays in GOBBLER mode!
    await host.getByTestId('ttt-rematch-btn').click();
    await expect(host.getByTestId('gobbler-cell-0')).toBeVisible();
    await expect(host.getByTestId('ttt-current-mode-badge')).toContainText(/Gobbler/);
  } finally {
    await host.close();
    await guest.close();
  }
});
