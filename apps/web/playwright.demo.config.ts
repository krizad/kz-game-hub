import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { configureTestDatabase } from '../../scripts/test-database.mjs';

// Same rationale as playwright.config.ts: specs may read ADMIN_SECRET.
dotenv.config({ path: resolve(__dirname, '../../.env') });

configureTestDatabase();

/**
 * Demo-video recording config. Runs only e2e/demo.spec.ts, which writes the
 * tracked public/demo/*-demo.mp4 files (needs ffmpeg). The main
 * playwright.config.ts ignores demo.spec.ts, so a full `pnpm test:e2e` run
 * never records videos.
 * Usage:
 *   pnpm -F web exec playwright test -c playwright.demo.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/demo.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 10000 },

  webServer: [
    {
      command:
        'pnpm -F @repo/database build && pnpm -F @repo/types build && DISABLE_GAME_SETTINGS_DB=1 DISABLE_RATE_LIMIT=1 PORT=3101 pnpm -F api dev',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3101 pnpm exec next dev -p 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
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
