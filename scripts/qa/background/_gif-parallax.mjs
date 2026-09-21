import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const OUT = '/tmp/gif-frames';
mkdirSync(OUT, { recursive: true });

const projectJson = readFileSync('/tmp/map-bg-craftpix-fit.json', 'utf8');

const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4661, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.addInitScript(([url]) => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: 'gif-parallax', qaInstrumentation: true };
}, ['/__runtime-qa/project.json']);
await page.route('**/__runtime-qa/project.json', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: projectJson }));
await page.goto('http://127.0.0.1:4661/player.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });

let n = 0;
async function snap() {
  await page.screenshot({ path: OUT + '/f' + String(n).padStart(3, '0') + '.png' });
  n++;
}

// 타이틀
await page.waitForTimeout(1500);
await snap();
await page.waitForTimeout(500);
await snap();

// 새 게임
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);
await snap();
await page.waitForTimeout(600);
await snap();

// 이동하면서 배경 스크롤 (구름은 느리게, 나무는 고정 → 깊이감)
for (let i = 0; i < 12; i++) {
  await page.keyboard.press(i % 4 === 3 ? 'ArrowUp' : 'ArrowRight');
  await page.waitForTimeout(500);
  await snap();
}

await browser.close();
await server.close();
console.log('frames:', n);
