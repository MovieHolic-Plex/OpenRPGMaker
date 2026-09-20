import { defineConfig, devices } from '@playwright/test';
// Parent owns the existing real editor server. This config cannot start one.
if (!process.env.FEATURE16_BASE_URL) throw new Error('Set FEATURE16_BASE_URL to the parent-owned editor server.');
export default defineConfig({
  testDir: './test/e2e', testMatch: 'feature16-ai.spec.ts', workers: 1, retries: 0, timeout: 180000,
  use: { baseURL: process.env.FEATURE16_BASE_URL, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, launchOptions: { args: ['--no-sandbox', '--use-gl=swiftshader'] } } }],
});
