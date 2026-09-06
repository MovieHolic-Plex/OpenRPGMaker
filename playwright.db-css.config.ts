import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  testMatch: '**/database-css-ownership.spec.ts',
  retries: 0,
  timeout: 120_000,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
