import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { configureTestDatabase } from '../../scripts/test-database.mjs';

// Specs read ADMIN_SECRET from process.env; locally the root .env holds the
// same secret the API's dotenv loads. CI (no root .env) injects ADMIN_SECRET
// as a job-level env instead, and configureTestDatabase below pins DATABASE_URL.
dotenv.config({ path: resolve(__dirname, '../../.env') });

configureTestDatabase();

export default defineConfig({
  testDir: './e2e',
  // Demo recording runs explicitly (`playwright test demo`) and the
  // play-to-completion sims run via playwright.sim.config.ts. Keeping both out
  // of the default suite keeps a full `pnpm test:e2e` run inside CI timeouts —
  // and avoids demo recording overwriting the tracked public/demo/*.mp4 files.
  testIgnore: ['**/demo.spec.ts', '**/sim/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['html', { open: 'never' }], ['list']],
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
