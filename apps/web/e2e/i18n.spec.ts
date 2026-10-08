import { test, expect } from '@playwright/test';
import { goToLobby, goToLobbyInEnglish, switchToEnglish } from './helpers';

/**
 * i18n coverage: Thai is the default language, the choice persists across
 * reloads, and the rules modal follows the active language.
 */

test('lobby defaults to Thai game names', async ({ page }) => {
  await goToLobby(page);
  // Default dictionary is th — Thai-only game labels must be visible
  await expect(page.locator('button:has-text("ลิงขโมยกล้วย")').first()).toBeVisible();
  await expect(page.locator('button:has-text("คำตอบพราง")').first()).toBeVisible();
});

test('switching to English persists across reload', async ({ page }) => {
  await goToLobby(page);
  await switchToEnglish(page);
  await expect(page.locator('button:has-text("Banana Thief")').first()).toBeVisible();

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  // Still English after reload (kz-language persisted)…
  await expect(page.locator('button:has-text("Banana Thief")').first()).toBeVisible({
    timeout: 20000,
  });
  // …and switching back to Thai restores the Thai labels
  await page.getByRole('button', { name: 'TH', exact: true }).click();
  await expect(page.locator('button:has-text("ลิงขโมยกล้วย")').first()).toBeVisible();
});

test('rules modal follows the active language', async ({ page }) => {
  await goToLobby(page);
  await switchToEnglish(page);
  await page.getByRole('button', { name: 'Rules', exact: true }).first().click();
  // English tab set (modal tabs share names with lobby buttons — use .first())
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Banana Thief', exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel('Close rules').click();

  // Thai tab set (the Rules button itself is Thai-labelled now)
  await page.getByRole('button', { name: 'TH', exact: true }).click();
  await page.getByRole('button', { name: 'กฎกติกา', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'ภาพรวม', exact: true })).toBeVisible();
  await page.getByLabel('Close rules').click();
});

test('goToLobbyInEnglish helper leaves the lobby in English', async ({ page }) => {
  await goToLobbyInEnglish(page);
  await expect(page.locator('button:has-text("Banana Thief")').first()).toBeVisible();
  await expect(page.locator('button:has-text("ลิงขโมยกล้วย")')).toHaveCount(0);
});
