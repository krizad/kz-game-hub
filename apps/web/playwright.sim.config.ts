import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Play-to-completion simulation config. Runs only apps/web/e2e/sim.
 * Usage:
 *   pnpm -F web exec playwright test -c playwright.sim.config.ts
 *   E2E_SIM_PLAYS=3 E2E_SIM_GAMES=ttt-classic-2p pnpm -F web exec playwright test -c playwright.sim.config.ts
 */
export default defineConfig({
  testDir: './e2e/sim',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  timeout: 120000,
  expect: { timeout: 10000 },

  webServer: [
    {
      command:
        'pnpm -F @repo/database build && pnpm -F @repo/types build && DISABLE_GAME_SETTINGS_DB=1 PORT=3101 pnpm -F api dev',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3101 pnpm exec next dev -p 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
