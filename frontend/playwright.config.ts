import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 1100 },
    trace: 'retain-on-failure',
  },
  workers: 1,
  reporter: 'list',
});
