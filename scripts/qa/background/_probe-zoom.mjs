import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const cases = [
  { name: 'A-event-zoom', file: '/tmp/map-bg-optimal.json' },
  { name: 'B-system-zoom', file: '/tmp/map-bg-systemzoom.json' },
];

const server = await createServer({
  root: ROOT, configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4721, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn',
});
await server.listen();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });

for (const c of cases) {
  const json = readFileSync(c.file, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  await page.addInitScript(([url, ns]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: ns, qaInstrumentation: true };
  }, ['/__runtime-qa/project.json', c.name]);
  await page.route('**/__runtime-qa/project.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: json }));
  await page.goto('http://127.0.0.1:4721/player.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    // Phaser 게임 인스턴스에서 카메라 줌 읽기
    const game = window.Phaser?.GAMES?.[0] ?? null;
    let zoom = null, sceneKey = null;
    try {
      const scenes = game?.scene?.getScenes?.(true) ?? [];
      for (const s of scenes) {
        if (s?.cameras?.main) { zoom = s.cameras.main.zoom; sceneKey = s.scene?.key ?? '?'; break; }
      }
    } catch (e) { zoom = 'err:' + e.message; }
    return { canvas: canvas ? { w: canvas.width, h: canvas.height } : null, zoom, sceneKey };
  });
  console.log(c.name, JSON.stringify(info));
  await page.close();
}
await browser.close();
await server.close();
