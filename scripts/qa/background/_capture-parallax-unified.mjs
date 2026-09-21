import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const OUT = '/tmp/unified-frames';
mkdirSync(OUT, { recursive: true });

const projectJson = readFileSync('/tmp/map-bg-craftpix-layers.json', 'utf8');
const PROJECT_ROUTE = '**/__runtime-qa/project.json';

const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.player-qa.config.ts'),
  server: { port: 4620, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();
const BASE = 'http://127.0.0.1:4620';

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });

// ── A) 인게임(출하 플레이어) ──
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.addInitScript(([projectUrl]) => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: 'unified-evidence', qaInstrumentation: true };
}, ['/__runtime-qa/project.json']);
await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: projectJson }));
await page.goto(BASE + '/player.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/01-title.png' });
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + '/02-ingame-parallax.png' });
await page.close();

// ── B) 편집기(맵 배경 미리보기 토글) ──
const page2 = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page2.waitForTimeout(2000);
// 편집기는 메인 vite 설정이 필요하므로 player-qa 서버에서 루트는 다를 수 있다 — 실패하면 무시(별도 서버로 재시도).
let editorOk = false;
try {
  await page2.waitForSelector('[data-testid="sidebar-maps"]', { timeout: 8000 });
  editorOk = true;
} catch {}
if (!editorOk) {
  console.log('editor on player-qa server unavailable, will retry separately');
  await page2.close();
} else {
  await page2.click('[data-testid="sidebar-maps"]');
  await page2.waitForTimeout(900);
  await page2.click('[data-testid="map-sidebar-properties-tab"]');
  await page2.waitForTimeout(1200);
  const bgSection = page2.locator('[data-testid="map-props-section-background"]');
  await bgSection.scrollIntoViewIfNeeded().catch(() => {});
  await page2.waitForTimeout(400);
  // 미리보기 토글 켜기 (줌 툴바의 bg-preview 버튼)
  const toggle = page2.locator('[data-testid*="bg-preview"], button[aria-label*="배경"]').first();
  if (await toggle.count()) { await toggle.click().catch(() => {}); await page2.waitForTimeout(1500); }
  await page2.screenshot({ path: OUT + '/03-editor-preview.png' });
  await page2.close();
}

await browser.close();
await server.close();
console.log('unified capture done');
