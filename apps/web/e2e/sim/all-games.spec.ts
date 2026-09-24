import { test } from '@playwright/test';
import { filterMatrix, GAME_MATRIX, type MatrixEntry } from './matrix';
import { playToCompletion, setupSession } from './play';

/**
 * Simulated playthrough suite: one test per matrix entry per playthrough.
 *
 * Env knobs:
 * - E2E_SIM_PLAYS      number of playthroughs per entry (default 1)
 * - E2E_SIM_GAMES      comma-separated matrix ids or prefixes (e.g. "ttt,rps-bestof1")
 * - E2E_SIM_INCLUDE_EXTERNAL  set to 1 to include entries needing flaky external services
 *
 * Run:  E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
 */

const plays = Math.max(1, Number.parseInt(process.env.E2E_SIM_PLAYS ?? '1', 10) || 1);
const includeExternal = process.env.E2E_SIM_INCLUDE_EXTERNAL === '1';
const gameFilter = (process.env.E2E_SIM_GAMES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const entries: MatrixEntry[] = filterMatrix(gameFilter);

if (gameFilter.length > 0 && entries.length === 0) {
  console.warn(
    `[sim] E2E_SIM_GAMES="${process.env.E2E_SIM_GAMES}" matched no matrix entries. Valid ids:`,
    GAME_MATRIX.map((e) => e.id).join(', '),
  );
}

for (const entry of entries) {
  test.describe(`sim/${entry.id} — ${entry.description}`, () => {
    for (let playIndex = 1; playIndex <= plays; playIndex++) {
      test(`playthrough ${playIndex}/${plays} reaches completion`, async ({ browser }) => {
        test.setTimeout(entry.timeout ?? 120000);
        test.skip(
          Boolean(entry.external) && !includeExternal,
          'entry depends on external services; set E2E_SIM_INCLUDE_EXTERNAL=1 to include',
        );
        const session = await setupSession(browser, entry, playIndex);
        try {
          await playToCompletion(session, entry);
        } finally {
          await session.cleanup();
        }
      });
    }
  });
}
