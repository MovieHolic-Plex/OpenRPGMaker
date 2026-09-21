import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const OUT = '/tmp/fit-evidence';
mkdirSync(OUT, { recursive: true });

const projectJson = readFileSync('/tmp/map-bg-craftpix-fit.json', 'utf8');
const PROJECT_ROUTE = '**/__runtime-qa/project.json';

// ── A) 인게임: 출하 플레이어 ──
const playerServer = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4640, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await playerServer.listen();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });

const p1 = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await p1.addInitScript(([url]) => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: 'fit-evidence', qaInstrumentation: true };
}, ['/__runtime-qa/project.json']);
await p1.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: projectJson }));
await p1.goto('http://127.0.0.1:4640/player.html', { waitUntil: 'domcontentloaded' });
await p1.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
await p1.waitForTimeout(1500);
await p1.screenshot({ path: OUT + '/ingame-01-title.png' });
await p1.keyboard.press('Enter');
await p1.waitForTimeout(4500);
await p1.screenshot({ path: OUT + '/ingame-02-parallax.png' });
// 이동해서 배경이 따라오는지 (스크롤 있는 레이어)
for (const key of ['ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
  await p1.keyboard.press(key);
  await p1.waitForTimeout(450);
}
await p1.screenshot({ path: OUT + '/ingame-03-after-move.png' });
await p1.close();
await playerServer.close();

// ── B) 편집기: 메인 vite ──
const editorServer = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  server: { port: 4641, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await editorServer.listen();
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p2.goto('http://127.0.0.1:4641/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p2.waitForSelector('[data-testid="sidebar-maps"]', { timeout: 90000 });
await p2.waitForTimeout(2500);
await p2.click('[data-testid="sidebar-maps"]');
await p2.waitForTimeout(900);
await p2.click('[data-testid="map-sidebar-properties-tab"]');
await p2.waitForTimeout(1400);
const bgSection = p2.locator('[data-testid="map-props-section-background"]');
await bgSection.scrollIntoViewIfNeeded().catch(() => {});
await p2.waitForTimeout(500);
const enable = p2.locator('[data-testid="map-bg-enable"]');
if (await enable.count()) {
  const checked = await enable.isChecked();
  if (!checked) { await enable.check().catch(() => {}); await p2.waitForTimeout(900); }
}
await bgSection.scrollIntoViewIfNeeded().catch(() => {});
await p2.waitForTimeout(400);
await p2.screenshot({ path: OUT + '/editor-01-panel.png' });

// 세트 적용
await p2.click('[data-testid="map-bg-layer-set"]');
await p2.waitForTimeout(900);
const card = p2.locator('[data-testid="map-bg-layer-set-card-oga-craftpix-pines"]');
if (await card.count()) {
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: OUT + '/editor-02-picker.png' });
  await card.click();
  await p2.waitForTimeout(700);
  const ok = p2.locator('[data-testid="map-bg-layer-set-confirm-ok"]');
  if (await ok.count()) { await ok.click(); await p2.waitForTimeout(1000); }
  await p2.screenshot({ path: OUT + '/editor-03-applied.png' });
}

// 캔버스 미리보기 토글
const toggle = p2.locator('[data-testid="map-background-preview-toggle"]');
if (await toggle.count()) {
  await toggle.click().catch(() => {});
  await p2.waitForTimeout(3000);
  await p2.screenshot({ path: OUT + '/editor-04-canvas.png' });
}
await p2.close();
await editorServer.close();
await browser.close();
console.log('fit evidence captured');
