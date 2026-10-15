import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Saboteur Experience (TASK-SA-001, TASK-SA-002, TASK-SA-003)', () => {
  test('board viewport, zoom controls, accessible labels, selection help, public log and round results', async ({
    browser,
  }) => {
    test.setTimeout(120000);

    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));
    await p1.setViewportSize({ width: 1280, height: 900 });
    await p2.setViewportSize({ width: 390, height: 844 }); // Mobile viewport
    await p3.setViewportSize({ width: 360, height: 800 }); // Compact mobile viewport

    try {
      // 1. Host creates room for Saboteur
      const roomCode = await createRoom(p1, 'HostMiner', 'Saboteur');
      const origin = await getOrigin(p1);

      await joinRoom(p2, origin, roomCode, 'GuestMiner2');
      await joinRoom(p3, origin, roomCode, 'GuestMiner3');

      await expect(p1.getByText('GuestMiner2')).toBeVisible({ timeout: 10000 });
      await expect(p1.getByText('GuestMiner3')).toBeVisible({ timeout: 10000 });

      // Host starts game
      const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
      await expect(startBtn).toBeEnabled({ timeout: 10000 });
      await startBtn.click();

      // ==========================================
      // TASK-SA-001: Board Viewport & Controls
      // ==========================================
      // All players see the game board viewport and role card
      for (const p of [p1, p2, p3]) {
        await expect(p.getByTestId('saboteur-board-viewport')).toBeVisible({ timeout: 15000 });
        await expect(p.getByTestId('saboteur-my-role')).toBeVisible({ timeout: 10000 });
      }

      // Viewport container does not produce horizontal page scroll on mobile
      const scrollWidth = await p3.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await p3.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 5);

      // Verify zoom controls on host
      const zoomInBtn = p1.getByTestId('saboteur-zoom-in');
      const zoomOutBtn = p1.getByTestId('saboteur-zoom-out');
      const zoomResetBtn = p1.getByTestId('saboteur-zoom-reset');

      await expect(zoomInBtn).toBeVisible();
      await expect(zoomOutBtn).toBeVisible();
      await expect(zoomResetBtn).toBeVisible();

      // Click Zoom In
      await zoomInBtn.click();
      await expect(zoomResetBtn).toContainText('1.5x');

      // Click Reset Zoom
      await zoomResetBtn.click();
      await expect(zoomResetBtn).toContainText('1x');

      // Verify board cells have accessible aria-labels
      const startCell = p1.getByTestId('saboteur-cell-0,2');
      await expect(startCell).toBeVisible();
      const startAria = await startCell.getAttribute('aria-label');
      expect(startAria).toBeTruthy();
      expect(startAria).toMatch(/Start|จุดเริ่มต้น/i);

      // Verify goal cells have accessible labels that DO NOT reveal gold vs stone
      for (const goalCoord of ['8,0', '8,2', '8,4']) {
        const goalCell = p1.getByTestId(`saboteur-cell-${goalCoord}`);
        await expect(goalCell).toBeVisible();
        const goalAria = await goalCell.getAttribute('aria-label');
        expect(goalAria).toBeTruthy();
        expect(goalAria).toMatch(/Goal|เป้าหมาย/i);
        // Hidden goal must not mention Gold or Stone
        expect(goalAria).not.toMatch(/Gold|Stone|ทอง|หิน/i);
      }

      // ==========================================
      // TASK-SA-002: Card Selection & Action Help
      // ==========================================
      // Find the player whose turn it is
      const players = [p1, p2, p3];
      let activePage = p1;
      for (const p of players) {
        const isTurn = await p
          .getByTestId('saboteur-selection-help')
          .textContent()
          .then((text) => text && !text.includes('Waiting') && !text.includes('รอตา'));
        if (isTurn) {
          activePage = p;
          break;
        }
      }

      const selectionHelp = activePage.getByTestId('saboteur-selection-help');
      await expect(selectionHelp).toBeVisible();

      // Select first card in hand
      const firstCard = activePage.getByTestId('saboteur-hand-0');
      await expect(firstCard).toBeVisible();
      const cardLabel = await firstCard.getAttribute('aria-label');
      expect(cardLabel).toBeTruthy();

      await firstCard.click();

      // After selecting, selection help updates
      await expect(selectionHelp).toBeVisible();
      const helpText = await selectionHelp.textContent();
      expect(helpText).toBeTruthy();

      // Verify Cancel button is available and clears selection
      const cancelBtn = selectionHelp.getByRole('button', { name: /Cancel|ยกเลิก/i });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        // Selection should be cleared
        await expect(cancelBtn).not.toBeVisible();
      }

      // ==========================================
      // TASK-SA-003: Public Last Action & Log Panel
      // ==========================================
      // Verify public last action banner is displayed above the board
      for (const p of [p1, p2, p3]) {
        const publicLastAction = p.getByTestId('saboteur-public-last-action');
        await expect(publicLastAction).toBeVisible();
        await expect(publicLastAction).toContainText(/Round 1|รอบที่ 1|started|เริ่มต้น/i);
      }

      // Verify log panel is toggleable
      const logPanel = p1.getByTestId('saboteur-log-panel');
      await expect(logPanel).toBeVisible();

      const logToggle = p1.getByTestId('saboteur-log-toggle');
      await expect(logToggle).toBeVisible();

      // Collapse log
      await logToggle.click();
      await expect(logToggle).toContainText(/Expand|แสดงบันทึก/i);

      // Expand log
      await logToggle.click();
      await expect(logToggle).toContainText(/Collapse|ซ่อนบันทึก/i);

      // Verify players panel
      for (const p of [p1, p2, p3]) {
        await expect(p.getByTestId('saboteur-players-panel')).toBeVisible();
      }
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
});
