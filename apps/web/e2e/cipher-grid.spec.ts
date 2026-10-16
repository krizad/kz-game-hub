import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

test.describe('Ciphergrid (สายลับคำใบ้) E2E Playtest', () => {
  test('full 4-player match: lobby gating, team setup, private keycard, clue giving, pinging, revealing, challenge, and reconnect', async ({
    browser,
  }) => {
    // 1. Create 4 isolated browser contexts
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const ctx4 = await browser.newContext();

    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();
    const p4 = await ctx4.newPage();

    // 2. Host creates Ciphergrid room
    const roomCode = await createRoom(p1, 'AliceSolarLead', 'Ciphergrid');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    const origin = await getOrigin(p1);

    // Verify min 4 players gating
    const startBtn = p1.locator('button').filter({ hasText: /Waiting \(min 4\)|เริ่มเกม/ });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeDisabled();

    // 3. Other 3 players join
    await joinRoom(p2, origin, roomCode, 'BobSolarTracker');
    await joinRoom(p3, origin, roomCode, 'CharlieLunarLead');
    await joinRoom(p4, origin, roomCode, 'DianaLunarTracker');

    // Verify all players visible in lobby
    await expect(p1.getByText('DianaLunarTracker')).toBeVisible({ timeout: 10000 });

    // Start button now enabled
    const lobbyStartBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
    await expect(lobbyStartBtn).toBeEnabled({ timeout: 5000 });
    await lobbyStartBtn.click();

    // 4. Team Setup Phase
    await expect(p1.locator('[data-testid="ciphergrid-team-setup"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(p2.locator('[data-testid="ciphergrid-team-setup"]')).toBeVisible({
      timeout: 10000,
    });

    // Host sees randomize and start buttons; non-hosts do not
    const randomizeBtn = p1.locator('[data-testid="randomize-teams-btn"]');
    const startMatchBtn = p1.locator('[data-testid="start-match-btn"]');
    await expect(randomizeBtn).toBeVisible();
    await expect(startMatchBtn).toBeVisible();
    await expect(startMatchBtn).toBeDisabled();

    for (const guest of [p2, p3, p4]) {
      await expect(guest.locator('[data-testid="randomize-teams-btn"]')).toHaveCount(0);
      await expect(guest.locator('[data-testid="start-match-btn"]')).toHaveCount(0);
    }

    // Host reconnects in TEAM_SETUP; host rotates to an active player per server lifecycle
    await p1.reload();
    await expect(p1.locator('[data-testid="ciphergrid-team-setup"]')).toBeVisible({
      timeout: 15000,
    });

    const allPlayers = [p1, p2, p3, p4];
    // Find who currently has the host controls in TEAM_SETUP
    let currentHostPage = allPlayers[0];
    for (const p of allPlayers) {
      if (
        await p
          .locator('[data-testid="start-match-btn"]')
          .isVisible({ timeout: 1000 })
          .catch(() => false)
      ) {
        currentHostPage = p;
        break;
      }
    }

    const hostRandomizeBtn = currentHostPage.locator('[data-testid="randomize-teams-btn"]');
    const hostStartMatchBtn = currentHostPage.locator('[data-testid="start-match-btn"]');
    await expect(hostRandomizeBtn).toBeVisible();
    await expect(hostStartMatchBtn).toBeVisible();
    await expect(hostStartMatchBtn).toBeDisabled();

    // Verify non-hosts do not have host controls
    const nonHostPages = allPlayers.filter((p) => p !== currentHostPage);
    for (const nonHost of nonHostPages) {
      await expect(nonHost.locator('[data-testid="randomize-teams-btn"]')).toHaveCount(0);
      await expect(nonHost.locator('[data-testid="start-match-btn"]')).toHaveCount(0);
    }

    // Assign roles:
    // P1 -> Solar Lead
    await p1.locator('[data-testid="join-solar-lead-btn"]').click();
    await p1.waitForTimeout(400);

    // P2 -> Solar Tracker
    await p2.locator('[data-testid="join-solar-tracker-btn"]').click();
    await p2.waitForTimeout(400);

    // P3 -> Lunar Lead
    await p3.locator('[data-testid="join-lunar-lead-btn"]').click();
    await p3.waitForTimeout(400);

    // P4 -> Lunar Tracker
    await p4.locator('[data-testid="join-lunar-tracker-btn"]').click();
    await p4.waitForTimeout(400);

    // Now start match button should be enabled for host only
    await expect(hostStartMatchBtn).toBeEnabled({ timeout: 5000 });
    for (const nonHost of nonHostPages) {
      await expect(nonHost.locator('[data-testid="start-match-btn"]')).toHaveCount(0);
    }
    await hostStartMatchBtn.click();

    // 5. Board Grid & Active Game Phase
    await expect(p1.locator('[data-testid="ciphergrid-container"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(p2.locator('[data-testid="ciphergrid-container"]')).toBeVisible({
      timeout: 10000,
    });

    // 25 board tiles present
    const p1Tiles = p1.locator('[data-testid^="card-tile-"]');
    await expect(p1Tiles).toHaveCount(25);

    // 6. Security & Privacy Guarantees
    // Leads (P1 & P3) have peek button
    await expect(p1.locator('[data-testid="peek-keycard-btn"]')).toBeVisible({ timeout: 5000 });
    await expect(p3.locator('[data-testid="peek-keycard-btn"]')).toBeVisible({ timeout: 5000 });

    // Trackers (P2 & P4) must NEVER have peek keycard button
    await expect(p2.locator('[data-testid="peek-keycard-btn"]')).toHaveCount(0);
    await expect(p4.locator('[data-testid="peek-keycard-btn"]')).toHaveCount(0);

    // Lead can toggle peek
    await p1.locator('[data-testid="peek-keycard-btn"]').click();
    await p1.waitForTimeout(500);

    // 7. Clue Giving Phase
    // Check which team starts (Solar or Lunar)
    const isSolarStarting = await p1
      .locator('text=☀️ Solar Team')
      .first()
      .isVisible()
      .catch(() => false);
    const activeLead = isSolarStarting ? p1 : p3;
    const activeTracker = isSolarStarting ? p2 : p4;
    const opposingTracker = isSolarStarting ? p4 : p2;

    // Active lead enters clue
    const clueInput = activeLead.locator('[data-testid="clue-word-input"]');
    await expect(clueInput).toBeVisible({ timeout: 5000 });
    await clueInput.fill('SECRET');

    // Submit clue
    const giveClueBtn = activeLead.locator('[data-testid="give-clue-btn"]');
    await expect(giveClueBtn).toBeEnabled();
    await giveClueBtn.click();

    // 8. Decoding Phase
    await expect(activeTracker.locator('[data-testid="current-clue-banner"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(activeTracker.locator('[data-testid="current-clue-banner"]')).toContainText(
      'SECRET',
    );

    // 9. Card Pinging
    const firstTile = activeTracker.locator('[data-testid="card-tile-0"]');
    await firstTile.click();

    const pingBtn = activeTracker.locator('[data-testid="ping-card-btn"]');
    await expect(pingBtn).toBeVisible({ timeout: 5000 });
    await pingBtn.click();

    // Verify ping marker appears on first tile
    await expect(firstTile.locator('text=📍')).toBeVisible({ timeout: 5000 });

    // 10. Card Revealing
    const revealBtn = activeTracker.locator('[data-testid="reveal-card-btn"]');
    await expect(revealBtn).toBeVisible({ timeout: 5000 });
    await revealBtn.click();

    // Tile is now revealed and disabled
    await expect(firstTile).toHaveAttribute('data-revealed', 'true', { timeout: 5000 });

    // 11. Challenge Clue
    // If turn is still DECODING, test challenge clue from opposing team
    const challengeBtn = opposingTracker.locator('[data-testid="challenge-clue-btn"]');
    if (await challengeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await challengeBtn.click();
      const confirmChallengeBtn = opposingTracker.locator('[data-testid="confirm-challenge-btn"]');
      await expect(confirmChallengeBtn).toBeVisible({ timeout: 5000 });
      await confirmChallengeBtn.click();

      // Turn switches to challenging team
      await opposingTracker.waitForTimeout(1000);
    }

    // 12. Reconnect Resilience
    await p2.reload();
    await expect(p2.locator('[data-testid="ciphergrid-container"]')).toBeVisible({
      timeout: 15000,
    });
    // Still 25 cards
    await expect(p2.locator('[data-testid^="card-tile-"]')).toHaveCount(25);

    // 13. Finish round (reveal VIRUS if not already ended) and verify host-only next-round-btn
    const phaseNow = await p1.evaluate(
      () => (window as any).__useGameStore.getState().room?.cipherGridState?.phase,
    );
    if (phaseNow !== 'ROUND_END') {
      const currentTeam = await p1.evaluate(
        () => (window as any).__useGameStore.getState().room?.cipherGridState?.currentTeam,
      );
      const leadPage = currentTeam === 'SOLAR' ? p1 : p3;
      const trackerPage = currentTeam === 'SOLAR' ? p2 : p4;
      if (phaseNow === 'CLUE_GIVING') {
        await leadPage.locator('[data-testid="clue-word-input"]').fill('FINALCLUE');
        await leadPage.locator('[data-testid="give-clue-btn"]').click();
      }
      const virusIndex = await p1.evaluate(() => {
        const store = (window as any).__useGameStore.getState();
        const keycard = (store.privateState?.cipherKeycard ||
          store.privateState?.cipherGridKeycard) as string[] | undefined;
        return keycard ? keycard.indexOf('VIRUS') : -1;
      });
      if (virusIndex >= 0) {
        await trackerPage.locator(`[data-testid="card-tile-${virusIndex}"]`).click();
        await trackerPage.locator('[data-testid="reveal-card-btn"]').click();
      }
    }

    // Find who is current host at round end (since reconnects migrate host)
    let roundEndHostPage = allPlayers[0];
    for (const p of allPlayers) {
      if (
        await p
          .locator('[data-testid="next-round-btn"]')
          .isVisible({ timeout: 1500 })
          .catch(() => false)
      ) {
        roundEndHostPage = p;
        break;
      }
    }

    await expect(roundEndHostPage.locator('[data-testid="next-round-btn"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(roundEndHostPage.locator('[data-testid="reset-to-lobby-btn"]')).toBeVisible();
    const roundEndNonHosts = allPlayers.filter((p) => p !== roundEndHostPage);
    for (const guest of roundEndNonHosts) {
      await expect(guest.locator('[data-testid="next-round-btn"]')).toHaveCount(0);
      await expect(guest.locator('[data-testid="reset-to-lobby-btn"]')).toHaveCount(0);
    }

    await roundEndHostPage.locator('[data-testid="next-round-btn"]').click();
    await expect(roundEndHostPage.locator('[data-testid="ciphergrid-team-setup"]')).toBeVisible({
      timeout: 10000,
    });

    // Clean up browser contexts
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
    await ctx4.close();
  });
});
