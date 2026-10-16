import { test, expect } from '@playwright/test';
import { joinRoom, goToLobbyInEnglish } from './helpers';
import { setupSession } from './sim/play';
import {
  startRelay,
  guessPair,
  expectRelayResult,
  relaySnapshot,
  voteRelay,
} from './dog-relay-helpers';

const entry = (players: number) => ({
  id: `dog-relay-${players}p`,
  game: 'DOG_RELAY',
  lobbyButton: 'Who Barks',
  players,
  description: 'Who Barks multiplayer verification',
});

test.describe('Who Barks / DOG_RELAY', () => {
  test.setTimeout(240000);

  test('rules explain every role goal and open the complete character catalog', async ({
    page,
  }) => {
    await goToLobbyInEnglish(page);
    await page.getByRole('button', { name: 'Rules', exact: true }).first().click();
    await page.getByRole('button', { name: 'Who Barks', exact: true }).click();
    const roles = page.getByRole('region', { name: 'Roles and goals' });
    for (const name of ['Lead Dog', 'Mischief Dog', 'Loyal Dog']) {
      await expect(roles.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(roles.locator('strong', { hasText: 'Goal' })).toHaveCount(3);
    await expect(roles).toContainText('unique highest vote total');
    await page.getByTestId('dog-relay-open-catalog').click();
    await expect(
      page.getByTestId('dog-relay-catalog').locator('[data-testid^="dog-relay-card-"]'),
    ).toHaveCount(30);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dog-relay-catalog')).toHaveCount(0);
    await expect(roles).toBeVisible();
    await page.getByLabel('Close rules').click();
  });

  for (const count of [5, 9]) {
    test(`${count} players restore the ordered pair and start a fresh round`, async ({
      browser,
    }) => {
      const session = await setupSession(browser, entry(count), 1);
      try {
        const { host, players } = session;
        if (count === 5) {
          for (const page of players) await page.setViewportSize({ width: 360, height: 800 });
        }
        const seats = host.getByTestId('dog-relay-seat');
        if (count === 5) {
          await host.getByTestId('dog-relay-leader-selection').selectOption('ROUND_ROBIN');
          await expect(players[1].getByTestId('dog-relay-leader-selection')).toHaveValue(
            'ROUND_ROBIN',
          );
          await expect(players[1].getByTestId('dog-relay-leader-selection')).toBeDisabled();
          await host.getByTestId('dog-relay-open-catalog').click();
          const catalog = host.getByTestId('dog-relay-catalog');
          await expect(catalog.locator('[data-testid^="dog-relay-card-"]')).toHaveCount(30);
          await expect(catalog.getByTestId('dog-relay-card-dog-001')).toContainText('#001');
          await expect(catalog.getByTestId('dog-relay-card-dog-030')).toContainText('#030');
          await host.keyboard.press('Escape');
          await expect(catalog).toHaveCount(0);
          await expect(host.getByTestId('dog-relay-open-catalog')).toBeFocused();
        }
        await expect(seats).toHaveCount(count);
        await seats
          .nth(1)
          .getByRole('button', { name: /Move .* up/ })
          .click();
        await expect(seats.first()).toContainText('Bob');
        for (const page of players.slice(1)) {
          await expect(page.getByTestId('dog-relay-seat').first()).toContainText('Bob');
          await expect(page.getByTestId('dog-relay-seat').getByRole('button')).toHaveCount(0);
        }
        if (count === 9) {
          await players[8].getByText('TH', { exact: true }).click();
          await expect(players[8].getByText('หมาตัวไหน', { exact: true }).first()).toBeVisible();
        }
        const round = await startRelay(players);
        if (count === 5) {
          const initial = await relaySnapshot(host);
          expect(initial.public.leaderId).toBe(initial.public.seatOrder[0]);
          await round.final.getByTestId('dog-relay-open-catalog').click();
          await expect(
            round.final
              .getByTestId('dog-relay-catalog')
              .locator('[data-testid^="dog-relay-card-"]'),
          ).toHaveCount(30);
          await round.final.keyboard.press('Escape');
          expect(
            await round.final.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await round.final.screenshot({
            path: test.info().outputPath('who-barks-candidates-mobile.png'),
            fullPage: true,
          });
        }
        const firstRoundId = (await relaySnapshot(host)).public.roundId;
        await guessPair(round);
        await expectRelayResult(players, 'GOOD', 'CORRECT_PAIR');
        await host.getByRole('button', { name: /Next round/i }).click();
        await expect(host.getByTestId('dog-relay-role-reveal')).toBeVisible();
        const next = await relaySnapshot(host);
        expect(next.public.roundId).not.toBe(firstRoundId);
        expect(next.public.result).toBeNull();
        expect(next.public.roundNumber).toBe(2);
        if (count === 5) expect(next.public.leaderId).toBe(next.public.seatOrder[1]);
      } finally {
        await session.cleanup();
      }
    });
  }

  for (const tie of [false, true]) {
    test(
      tie
        ? 'a tied highest ballot lets Evil escape'
        : 'a wrong pair followed by a unique Evil vote wins for Good',
      async ({ browser }) => {
        const session = await setupSession(browser, entry(5), 1);
        try {
          const round = await startRelay(session.players);
          await guessPair(round, false);
          await expect(session.host.getByTestId('dog-relay-end-discussion')).toBeVisible();
          expect((await relaySnapshot(session.host)).public.result).toBeNull();
          await voteRelay(session.players, round, tie);
          await expectRelayResult(
            session.players,
            tie ? 'EVIL' : 'GOOD',
            tie ? 'EVIL_ESCAPED' : 'EVIL_CAUGHT',
          );
          const result = (await relaySnapshot(session.host)).public.result;
          expect(Object.keys(result.ballots)).toHaveLength(5);
          if (tie) {
            const counts = Object.values(result.ballots).reduce<Record<string, number>>(
              (tally, target) => {
                const id = target as string;
                tally[id] = (tally[id] ?? 0) + 1;
                return tally;
              },
              {},
            );
            expect(Object.values(counts).sort()).toEqual([1, 2, 2]);
          }
        } finally {
          await session.cleanup();
        }
      },
    );
  }

  test('late spectators receive no role or pair and do not pause the relay', async ({
    browser,
  }) => {
    const session = await setupSession(browser, entry(5), 1);
    const spectatorContext = await browser.newContext();
    try {
      await session.host.getByTestId('lobby-advanced-settings').locator('summary').click();
      await session.host.getByRole('button', { name: 'Allowed', exact: true }).click();
      await expect(
        session.host.getByRole('button', { name: 'Allowed', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      const round = await startRelay(session.players);
      const spectator = await spectatorContext.newPage();
      const code = await session.host.locator('span.text-indigo-400.tracking-widest').innerText();
      await joinRoom(spectator, session.origin, code.trim(), 'Observer');
      await expect(
        spectator.getByText('You are watching this round. Join a seat in the next lobby.'),
      ).toBeVisible();
      const snapshot = await relaySnapshot(spectator);
      expect(snapshot.own).toBeUndefined();
      expect(snapshot.public.result).toBeNull();
      expect(snapshot.public.truePair).toBeUndefined();
      await expect(spectator.getByTestId('dog-relay-role-reveal')).toHaveCount(0);
      await expect(spectator.locator('button[data-testid^="dog-relay-card-"]')).toHaveCount(0);
      await spectatorContext.close();
      await expect.poll(async () => (await relaySnapshot(session.host)).public.pause).toBeNull();
      await guessPair(round);
      await expectRelayResult(session.players, 'GOOD', 'CORRECT_PAIR');
    } finally {
      await spectatorContext.close();
      await session.cleanup();
    }
  });

  test('an active disconnect pauses discussion and reconnect keeps role and remaining time', async ({
    browser,
  }) => {
    const session = await setupSession(browser, entry(5), 1);
    try {
      const round = await startRelay(session.players);
      await guessPair(round, false);
      await expect(session.host.getByTestId('dog-relay-end-discussion')).toBeVisible();
      const guest = session.players[1];
      const before = await relaySnapshot(guest);
      await guest.evaluate(() => (window as any).__useGameStore.getState().socket.disconnect());
      await expect
        .poll(async () => (await relaySnapshot(session.host)).public.pause?.disconnectedIds)
        .toEqual([before.playerId]);
      const paused = (await relaySnapshot(session.host)).public.pause.remainingPhaseMs;
      await expect(session.host.getByTestId('dog-relay-end-discussion')).toBeDisabled();
      await expect(session.host.getByRole('alert').filter({ hasText: /paused/i })).toBeVisible();
      await guest.evaluate(() => (window as any).__useGameStore.getState().socket.connect());
      await expect.poll(async () => (await relaySnapshot(session.host)).public.pause).toBeNull();
      await expect(session.host.getByTestId('dog-relay-end-discussion')).toBeEnabled();
      const after = await relaySnapshot(guest);
      expect(after.playerId).toBe(before.playerId);
      expect(after.own.role).toBe(before.own.role);
      expect(after.public.roundId).toBe(before.public.roundId);
      expect(after.public.phase).toBe('DISCUSS');
      const remaining = after.public.phaseEndsAt - Date.now();
      expect(remaining).toBeLessThanOrEqual(paused + 1500);
      expect(remaining).toBeGreaterThan(paused - 5000);
      await voteRelay(session.players, round, false);
      await expectRelayResult(session.players, 'GOOD', 'EVIL_CAUGHT');
    } finally {
      await session.cleanup();
    }
  });
});
