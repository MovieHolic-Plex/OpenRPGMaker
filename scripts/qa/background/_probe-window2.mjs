import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const OUT = '/tmp/window-cover2';
mkdirSync(OUT, { recursive: true });
const json = readFileSync('/tmp/map-bg-window2.json', 'utf8');

const server = await createServer({
  root: ROOT, configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4742, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn',
});
await server.listen();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.addInitScript(([url]) => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: 'window-cover', qaInstrumentation: true };
}, ['/__runtime-qa/project.json']);
await page.route('**/__runtime-qa/project.json', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: json }));
await page.goto('http://127.0.0.1:4742/player.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
await page.screenshot({ path: OUT + '/view.png' });
await browser.close();
await server.close();
console.log('done');
