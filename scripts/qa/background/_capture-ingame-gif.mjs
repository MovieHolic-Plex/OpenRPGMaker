import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const OUT = '/tmp/ingame-frames';
mkdirSync(OUT, { recursive: true });

const projectJson = readFileSync('/tmp/map-bg-craftpix-layers.json', 'utf8');
const PROJECT_ROUTE = '**/__runtime-qa/project.json';

const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4610, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();
const BASE = 'http://127.0.0.1:4610';

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.addInitScript(([projectUrl]) => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: 'ingame-gif', qaInstrumentation: true };
}, ['/__runtime-qa/project.json']);
await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: projectJson }));

await page.goto(BASE + '/player.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });

let frame = 0;
async function snap() {
  await page.screenshot({ path: OUT + '/g' + String(frame).padStart(3, '0') + '.png' });
  frame++;
}

await page.waitForTimeout(1200);
await snap(); await page.waitForTimeout(300); await snap();

await page.keyboard.press('Enter');
await page.waitForTimeout(3500);

for (let i = 0; i < 8; i++) { await snap(); await page.waitForTimeout(400); }

await browser.close();
await server.close();
console.log('frames:', frame);
