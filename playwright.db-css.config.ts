import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  testMatch: '**/database-css-ownership.spec.ts',
  retries: 0,
  // This QA task owns an explicitly started, cwd-verified worktree server.
  webServer: [],
  timeout: 120_000,
  // The matrix records JSON and PNGs; tracing every Vite module adds 100MB per case.
  use: { ...base.use, trace: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
