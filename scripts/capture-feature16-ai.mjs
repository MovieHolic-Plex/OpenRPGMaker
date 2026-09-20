import { spawnSync } from 'node:child_process';
// Usage: node scripts/capture-feature16-ai.mjs http://127.0.0.1:<parent-port>
const baseURL = process.argv[2] ?? process.env.FEATURE16_BASE_URL;
if (!baseURL) throw new Error('Supply the parent-owned editor URL; this script never starts a server.');
const url = new URL(baseURL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Capture requires a local parent-owned test server.');
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.feature16.config.ts'], {
  stdio: 'inherit', env: { ...process.env, FEATURE16_BASE_URL: url.origin },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
