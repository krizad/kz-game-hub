import { test, expect } from '@playwright/test';
import { createRoom } from './helpers';

/**
 * Lobby configuration panels: every game's host-facing option controls render
 * with the expected values. (Behavioral effects of these options are covered
 * by the sim matrix; this spec pins the option UI itself.)
 */

test('who know lobby offers all three host-selection modes', async ({ page }) => {
  await createRoom(page, 'Alice', 'Who Know!');
  const trigger = page.locator('button', { hasText: /^Round Robin$/ }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('button', { hasText: /^Random$/ }).first()).toBeVisible();
  await expect(page.locator('button', { hasText: /Room Creator/ }).first()).toBeVisible();
  await expect(page.locator('#timerMinInput')).toBeVisible();
});

test('hand duel lobby offers mode and best-of selects', async ({ page }) => {
  await createRoom(page, 'Alice', 'Hand Duel');
  await expect(page.locator('button', { hasText: /1v1 Round Robin/i }).first()).toBeVisible();
  const bestOf = page.locator('button', { hasText: /BO1|First to/i }).first();
  await expect(bestOf).toBeVisible();
  await bestOf.click();
  await expect(page.locator('button', { hasText: /BO3/i }).first()).toBeVisible();
  await expect(page.locator('button', { hasText: /BO5/i }).first()).toBeVisible();
});

test('the mind lobby exposes blind, time attack and extreme mode', async ({ page }) => {
  await createRoom(page, 'Alice', 'The Mind');
  await expect(page.getByText(/Time Attack/i).first()).toBeVisible();
  await expect(page.getByText(/Blind/i).first()).toBeVisible();
  await expect(
    page.locator('button', { hasText: /Normal \(Classic\)|Extreme/i }).first(),
  ).toBeVisible();
  await expect(page.locator('button', { hasText: /^Auto$/ }).first()).toBeVisible();
});

test('saboteur lobby exposes turn timer and stone toggle', async ({ page }) => {
  await createRoom(page, 'Alice', 'Saboteur');
  await expect(page.getByText(/^Turn timer$/i).first()).toBeVisible();
  await expect(page.getByText(/Stone ends the round instantly/i).first()).toBeVisible();
  // Both toggles render On/Off button pairs
  await expect(page.getByRole('button', { name: 'On', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Off', exact: true }).first()).toBeVisible();
});

test('card game lobby exposes presets, starter, tie and timer options', async ({ page }) => {
  await createRoom(page, 'Alice', 'Thai Card Game');
  await expect(page.getByTestId('card-game-preset-pok_deng')).toBeVisible();
  await expect(page.getByTestId('card-game-preset-slave')).toBeVisible();
  await expect(page.getByTestId('card-game-starter-RANDOM')).toBeVisible();
  await expect(page.getByTestId('card-game-starter-HOST_SELECT')).toBeVisible();
  // Tie + timer option groups (values come from the active preset's allow-list)
  const tieGroup = page.locator('[data-testid^="card-game-tie-"]');
  const timerGroup = page.locator('[data-testid^="card-game-timer-"]');
  if ((await tieGroup.count()) > 0) await expect(tieGroup.first()).toBeVisible();
  if ((await timerGroup.count()) > 0) await expect(timerGroup.first()).toBeVisible();
  await expect(page.getByTestId('card-game-deal-preview')).toBeVisible();
});

test('banana thief lobby exposes followers, specials, narrator and pacing', async ({ page }) => {
  await createRoom(page, 'Alice', 'Banana Thief');
  await expect(page.locator('#bananaThiefFollowerSelect')).toBeVisible();
  await expect(page.locator('#bananaThiefNarratorSelect')).toBeVisible();
  await expect(page.locator('#bananaThiefTickSelect')).toBeVisible();
  await expect(page.locator('#bananaThiefDiscussionSelect')).toBeVisible();
  await expect(page.locator('#bananaThiefVoteSelect')).toBeVisible();
  for (const special of ['Detective', 'Twins', 'Sycophant', 'Scapegoat']) {
    await expect(page.locator('button', { hasText: special }).first()).toBeVisible();
  }
  // Live min-player requirement badge
  await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible();
});

test('music trivia lobby offers artist presets and free search branches', async ({ page }) => {
  await createRoom(page, 'Alice', 'Music Trivia');
  // Default branch is artist preset; the free-search branch swaps in the source selects
  const modeTrigger = page.locator('button', { hasText: /Pick an Artist|Free Search/i }).first();
  await expect(modeTrigger).toBeVisible();
  await modeTrigger.click();
  await page
    .locator('button', { hasText: /Free Search/i })
    .last()
    .click();
  await expect(
    page.locator('button', { hasText: /Apple Music|SoundCloud|YouTube/i }).first(),
  ).toBeVisible();
  await expect(page.locator('#musicSearchTermInput')).toBeVisible();
});
