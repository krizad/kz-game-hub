import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,
  expect: { timeout: 10000 },

  webServer: [
    {
      command:
        'pnpm -F @repo/database build && pnpm -F @repo/types build && PORT=3101 pnpm -F api dev',
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
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
