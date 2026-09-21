import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const cases = [
  { name: 'A-320-zoom1', file: '/tmp/exp-A-320-zoom1.json' },
  { name: 'B-1280-zoom4', file: '/tmp/exp-B-1280-zoom4.json' },
  { name: 'C-1280-zoom4-cover', file: '/tmp/exp-C-1280-zoom4-cover.json' },
];

const server = await createServer({
  root: ROOT, configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4691, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn',
});
await server.listen();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });

for (const c of cases) {
  const json = readFileSync(c.file, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.addInitScript(([url, ns]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: ns, qaInstrumentation: true };
  }, ['/__runtime-qa/project.json', c.name]);
  await page.route('**/__runtime-qa/project.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: json }));
  await page.goto('http://127.0.0.1:4691/player.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const out = {};
    const canvas = document.querySelector('canvas');
    out.canvasAttr = canvas ? { w: canvas.width, h: canvas.height } : null;
    out.canvasCss = canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null;
    const stage = document.querySelector('[data-testid="play-stage"]');
    if (stage) {
      const cs = getComputedStyle(stage);
      out.stage = { transform: cs.transform, w: stage.clientWidth, h: stage.clientHeight };
    }
    const dbg = window.__oprnDebug;
    if (dbg && typeof dbg.readState === 'function') {
      const st = dbg.readState();
      out.camera = st.camera ?? st.session?.camera ?? null;
      out.mapId = st.mapId ?? null;
      out.playResolution = st.playResolution ?? null;
    }
    return out;
  });
  console.log(c.name, JSON.stringify(info));
  await page.close();
}
await browser.close();
await server.close();
