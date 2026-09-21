import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4611, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage();
page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 200)));
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
const projectJson = readFileSync('/tmp/map-bg-craftpix-layers.json', 'utf8');
await page.route('file:///tmp/map-bg-craftpix-layers.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: projectJson }));
await page.addInitScript(() => {
  window.__OPENRPG_BOOT__ = { projectUrl: 'file:///tmp/map-bg-craftpix-layers.json', saveNamespace: 'probe', qaInstrumentation: true };
});
await page.goto('http://127.0.0.1:4611/player.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(15000);
const ids = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid]')).slice(0, 25).map(b => b.getAttribute('data-testid')));
console.log('testids:', JSON.stringify(ids));
await browser.close();
await server.close();
