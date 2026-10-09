import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Copy of playwright.config.ts on ports 3200/3201 for local runs when the
 * standard e2e ports are occupied by other apps. Not used by CI.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 10000 },

  webServer: [
    {
      command:
        'pnpm -F @repo/database build && pnpm -F @repo/types build && DISABLE_GAME_SETTINGS_DB=1 PORT=3201 pnpm -F api dev',
      url: 'http://127.0.0.1:3201/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3201 pnpm exec next dev -p 3200',
      url: 'http://127.0.0.1:3200',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],

  use: {
    baseURL: 'http://127.0.0.1:3200',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
