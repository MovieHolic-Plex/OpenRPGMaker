// Explicit owned-fixture config. Never starts a normal Vite server or reuses a fixed port.
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const origin = process.env.TASK8_ORIGIN, runId = process.env.TASK8_RUN_ID;
if (!origin || !runId || process.env.TASK8_QA !== '1') throw new Error('Use TASK8_QA=1 Task7 run-owned.py');
const url = new URL(origin);
if (url.hostname !== '127.0.0.1' || !url.port || ['9841', '19841'].includes(url.port)) throw new Error('Task8 requires its owned ephemeral origin');
export default defineConfig({
  testDir: fileURLToPath(new URL('../../../../test/e2e/', import.meta.url)),
  testMatch: 'ai-job-families.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 180000, expect: { timeout: 15000 }, reporter: 'line',
  outputDir: fileURLToPath(new URL(`./grok-results-${runId}/`, import.meta.url)),
  use: { baseURL: origin, browserName: 'chromium', headless: true, serviceWorkers: 'block' },
});
