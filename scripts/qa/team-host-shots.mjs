// Visual evidence only; isolated empty host, no authored project or live user data.
import { withTsModule } from '../ontology-ts-loader.mjs';
import { resolve } from 'node:path';
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
const dir = await mkdtemp(tmpdir() + '/oprn-team-ui-');
const out = resolve('output/evidence/team-host');
await mkdir(out, { recursive: true });
try {
  await withTsModule(resolve('electron/serve/runtime.ts'), 'team-ui.mjs', async ({ startLocalProjectServer }) => {
    const host = await startLocalProjectServer({ projectDir: dir, distDir: resolve('dist'),
      browserBridgeSource: await readFile('dist-electron/browser-bridge.js', 'utf8'), publicOrigin: 'http://127.0.0.1:0' });
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on('pageerror', e => process.stdout.write('page error: ' + e.message + '\n'));
      await page.goto(host.url);
      await page.screenshot({ path: out + '/01-sign-in.png' });
      await page.locator('input[name=token]').fill(host.ownerAccessCode);
      await page.getByRole('button', { name: '작업실 들어가기' }).click();
      await page.waitForURL(host.url + '/');
      await page.goto(host.url + '/__oprn/team');
      await page.locator('#owner:not([hidden])').waitFor();
      await page.screenshot({ path: out + '/02-team-management.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: out + '/04-team-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(host.url);
      await page.locator('[aria-label="팀 연결 상태"]').waitFor({ timeout: 45000 }).catch(async e => { await page.screenshot({path: out + '/03-editor-failure.png'}); console.log((await page.locator('body').innerText()).slice(0,2000)); throw e; });
      await page.screenshot({ path: out + '/03-editor-team-status.png' });
      process.stdout.write('Rendered sign-in, owner team-management, and editor team status.\n');
    } finally { await browser.close(); await host.close(); }
  });
} finally { await rm(dir, { recursive: true, force: true }); }
