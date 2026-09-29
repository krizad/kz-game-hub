import { test, expect } from '@playwright/test';
import { goToLobbyInEnglish } from './helpers';

/**
 * Rules modal: every game tab opens, the card-game preset sub-tabs switch,
 * and the Banana Thief rules render the special-role (DLC) section.
 */

// Gobbler / Ultimate have no top-level tabs — they are mode sub-tabs inside
// the Tic-Tac-Toe tab since the TTT unify (ADR 0006).
const TABS = [
  'Who Know',
  'Tic Tac Toe',
  'Hand Duel',
  'Sounds Fishy',
  'Who Am I',
  'Detective Club',
  'Who First',
  'Music Trivia',
  'The Mind',
  'Saboteur',
  'Coup',
  'Thai Card Game',
  'Banana Thief',
];

async function openRules(page: import('@playwright/test').Page) {
  await goToLobbyInEnglish(page);
  await page.getByRole('button', { name: 'Rules', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
}

/** Tab buttons share names with lobby game buttons — scope to the modal. */
function modal(page: import('@playwright/test').Page) {
  return page.locator('div.fixed.inset-0.z-50');
}

test('every game tab opens in the rules modal', async ({ page }) => {
  await openRules(page);
  for (const tab of TABS) {
    const tabButton = modal(page).getByRole('button', { name: tab, exact: true });
    await tabButton.click();
    // The active tab is highlighted with a filled background class
    await expect(tabButton).toHaveClass(/bg-\w+-300/);
    // The modal stays open and usable (close control present)
    await expect(page.getByLabel('Close rules')).toBeVisible();
  }
  await page.getByLabel('Close rules').click();
  await expect(page.getByLabel('Close rules')).toBeHidden();
});

test('tic-tac-toe rules tab contains the gobbler and ultimate mode sub-content', async ({
  page,
}) => {
  await openRules(page);
  await modal(page).getByRole('button', { name: 'Tic Tac Toe', exact: true }).click();
  await expect(
    modal(page)
      .getByText(/Gobbler/i)
      .first(),
  ).toBeVisible();
  await expect(
    modal(page)
      .getByText(/Ultimate/i)
      .first(),
  ).toBeVisible();
});

test('card game rules expose the pok deng / slave sub-tabs', async ({ page }) => {
  await openRules(page);
  await modal(page).getByRole('button', { name: 'Thai Card Game', exact: true }).click();
  const slaveTab = page.getByTestId('card-game-rules-tab-slave');
  await expect(slaveTab).toBeVisible();
  await expect(page.getByTestId('card-game-rules-tab-pok_deng')).toBeVisible();
  await slaveTab.click();
  // The content container re-renders for the slave preset
  await expect(page.getByTestId('card-game-rules-content')).toBeVisible();
  await page.getByTestId('card-game-rules-tab-pok_deng').click();
  await expect(page.getByTestId('card-game-rules-content')).toBeVisible();
});

test('banana thief rules include the special-mice DLC section', async ({ page }) => {
  await openRules(page);
  await modal(page).getByRole('button', { name: 'Banana Thief', exact: true }).click();
  await expect(page.getByText(/Special Mice DLC/i)).toBeVisible();
  await expect(page.getByText(/Scapegoat/i).first()).toBeVisible();
});
