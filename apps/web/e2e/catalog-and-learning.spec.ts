import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Game Catalog, Filters, Lobby Connected Summary, and First-Round Learning Guide (TASK-SH-004)', () => {
  test('HomeView filters catalog by group size, style, audio, text, and shows clear filters and empty states', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/');

    const filterBar = page.getByTestId('catalog-filter-bar');
    await expect(filterBar).toBeVisible({ timeout: 10000 });

    // 1. Filter by audio requirement (Needs audio)
    const audioSelect = page.getByTestId('filter-audio');
    await audioSelect.selectOption('REQUIRED');

    // Only Music Trivia should be displayed
    await expect(page.getByTestId('catalog-card-MUSIC_TRIVIA')).toBeVisible();
    await expect(page.getByTestId('catalog-card-TIC_TAC_TOE')).toBeHidden();
    await expect(page.getByTestId('catalog-card-RPS')).toBeHidden();

    // Clear filters button should be visible
    const clearBtn = page.getByTestId('catalog-clear-filters-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // All games back
    await expect(page.getByTestId('catalog-card-TIC_TAC_TOE')).toBeVisible();
    await expect(page.getByTestId('catalog-card-RPS')).toBeVisible();

    // 2. Filter by style: Cooperative
    const styleSelect = page.getByTestId('filter-style');
    await styleSelect.selectOption('cooperative');

    // The Mind should be visible, others hidden
    await expect(page.getByTestId('catalog-card-THE_MIND')).toBeVisible();
    await expect(page.getByTestId('catalog-card-RPS')).toBeHidden();

    // Reset style filter
    await styleSelect.selectOption('ALL');

    // 3. Filter by text requirement (Needs typing)
    const textSelect = page.getByTestId('filter-text');
    await textSelect.selectOption('REQUIRED');

    await expect(page.getByTestId('catalog-card-WHO_KNOW')).toBeVisible();
    await expect(page.getByTestId('catalog-card-SOUNDS_FISHY')).toBeVisible();
    await expect(page.getByTestId('catalog-card-WHO_AM_I')).toBeVisible();
    await expect(page.getByTestId('catalog-card-TIC_TAC_TOE')).toBeHidden();

    // Reset text filter
    await textSelect.selectOption('ALL');

    // 4. Filter by group size: 5+ players
    const groupSizeSelect = page.getByTestId('filter-group-size');
    await groupSizeSelect.selectOption('5+');

    // Tic-Tac-Toe (max 2) and The Mind (max 4) should be hidden
    await expect(page.getByTestId('catalog-card-TIC_TAC_TOE')).toBeHidden();
    await expect(page.getByTestId('catalog-card-THE_MIND')).toBeHidden();
    // RPS (max 10) and Sounds Fishy (max 10) should be visible
    await expect(page.getByTestId('catalog-card-RPS')).toBeVisible();
    await expect(page.getByTestId('catalog-card-SOUNDS_FISHY')).toBeVisible();

    // 5. Empty State: contradictory filters
    await styleSelect.selectOption('cooperative'); // The Mind is cooperative (max 4), but group size is 5+
    const noGames = page.getByTestId('catalog-no-games');
    await expect(noGames).toBeVisible();

    // Clear filters from empty state button
    const noGamesClearBtn = page.getByTestId('catalog-no-games-clear-btn');
    await expect(noGamesClearBtn).toBeVisible();
    await noGamesClearBtn.click();

    // Both filters reset
    await expect(page.getByTestId('catalog-card-TIC_TAC_TOE')).toBeVisible();
  });

  test('Lobby displays connected summary badge and advanced settings are collapsed by default', async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    // Host creates Hand Duel room
    const roomCode = await createRoom(host, 'HostSummary', 'Hand Duel');
    expect(roomCode).toBeTruthy();

    // Verify Advanced Settings details is collapsed by default
    const advancedSettings = host.getByTestId('lobby-advanced-settings');
    await expect(advancedSettings).toBeVisible({ timeout: 10000 });
    const isOpen = await advancedSettings.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpen).toBe(false);

    // Expand Advanced Settings
    await advancedSettings.locator('summary').click();
    const isNowOpen = await advancedSettings.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isNowOpen).toBe(true);

    // Verify Connected Summary for Host (1 connected, min 2)
    const hostSummary = host.getByTestId('lobby-connected-summary');
    await expect(hostSummary).toBeVisible();
    await expect(hostSummary).toContainText('1/2');

    // Start button should be disabled for lack of players
    const hostStartBtn = host.getByTestId('lobby-start-game');
    await expect(hostStartBtn).toBeDisabled();

    // Verify Invite Link copied has no reconnect token
    const copyBtn = host.getByTestId('header-copy-link-btn');
    await copyBtn.click();

    // Guest joins room
    const origin = await getOrigin(host);
    await joinRoom(guest, origin, roomCode, 'GuestSummary');

    // Host connected summary updates to 2/2
    await expect(hostSummary).toContainText('2/2');
    await expect(hostStartBtn).toBeEnabled();

    // Guest also sees connected summary (2/2)
    const guestSummary = guest.getByTestId('lobby-connected-summary');
    await expect(guestSummary).toBeVisible({ timeout: 10000 });
    await expect(guestSummary).toContainText('2/2');

    await hostCtx.close();
    await guestCtx.close();
  });

  test('FirstRoundGuide shows Goal, First Action, Expected Result, and interactive local practice for Hand Duel and Tic-Tac-Toe', async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const hostCtx = await browser.newContext();
    const host = await hostCtx.newPage();

    // 1. Test in Hand Duel Lobby
    const roomCode = await createRoom(host, 'GuideUser', 'Hand Duel');
    expect(roomCode).toBeTruthy();

    const guideBtn = host.getByTestId('first-round-guide-btn');
    await expect(guideBtn).toBeVisible({ timeout: 10000 });
    await guideBtn.click();

    // Dialog appears
    const guideDialog = host.getByRole('dialog');
    await expect(guideDialog).toBeVisible();
    await expect(host.getByTestId('first-round-guide-title')).toBeVisible();

    // 3 Steps: Goal -> First Action -> Expected Result
    await expect(host.getByTestId('guide-step-goal')).toBeVisible();
    await expect(host.getByTestId('guide-step-action')).toBeVisible();
    await expect(host.getByTestId('guide-step-result')).toBeVisible();

    // Interactive practice (Local, no socket emissions)
    const practiceRock = host.getByTestId('guide-practice-rock');
    await expect(practiceRock).toBeVisible();
    await practiceRock.click();

    // Practice feedback appears
    const practiceFeedback = host.getByTestId('guide-practice-feedback');
    await expect(practiceFeedback).toBeVisible();
    await expect(practiceFeedback).toContainText('ROCK');

    // Dismiss with dismiss button
    const dismissBtn = host.getByTestId('first-round-guide-dismiss');
    await dismissBtn.click();
    await expect(guideDialog).toBeHidden();

    // 2. Open again and dismiss with Escape key
    await guideBtn.click();
    await expect(guideDialog).toBeVisible();
    await host.keyboard.press('Escape');
    await expect(guideDialog).toBeHidden();

    await hostCtx.close();
  });

  test('Tic-Tac-Toe lobby provides FirstRoundGuide with interactive 3x3 local practice grid', async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const hostCtx = await browser.newContext();
    const host = await hostCtx.newPage();

    // Create Tic-Tac-Toe room
    await createRoom(host, 'TttGuideUser', 'Tic-Tac-Toe');

    const guideBtn = host.getByTestId('first-round-guide-btn');
    await expect(guideBtn).toBeVisible({ timeout: 10000 });
    await guideBtn.click();

    const guideDialog = host.getByRole('dialog');
    await expect(guideDialog).toBeVisible();

    // Practice cell clicking
    const cell0 = host.getByTestId('guide-practice-cell-0');
    await expect(cell0).toBeVisible();
    await cell0.click();
    await expect(cell0).toHaveText('X');

    // Feedback appears
    const feedback = host.getByTestId('guide-practice-feedback');
    await expect(feedback).toBeVisible();

    // Dismiss
    await host.getByTestId('first-round-guide-dismiss').click();
    await expect(guideDialog).toBeHidden();

    await hostCtx.close();
  });
});
