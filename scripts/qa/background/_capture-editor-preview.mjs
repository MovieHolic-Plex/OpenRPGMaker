import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'fs';
import { join } from 'node:path';

const ROOT = '/home/main/.codex/worktrees/e2d4/rpg-zzu';
const OUT = '/tmp/unified-frames';
mkdirSync(OUT, { recursive: true });

// 편집기는 메인 vite 설정(vite.config.ts)으로 띄운다 — 워크트리 포트 9853.
const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  server: { port: 4630, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();
const BASE = 'http://127.0.0.1:4630';

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-testid="sidebar-maps"]', { timeout: 90000 });
await page.waitForTimeout(2000);

// 맵 속성 패널 열기
await page.click('[data-testid="sidebar-maps"]');
await page.waitForTimeout(900);
await page.click('[data-testid="map-sidebar-properties-tab"]');
await page.waitForTimeout(1400);

// 배경 탭/섹션 찾기
const bgSection = page.locator('[data-testid="map-props-section-background"]');
await bgSection.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(500);

// 배경 사용 체크
const enable = page.locator('[data-testid="map-bg-enable"]');
if (await enable.count()) {
  const checked = await enable.isChecked();
  if (!checked) { await enable.check().catch(() => {}); await page.waitForTimeout(900); }
}
await bgSection.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + '/03-editor-before.png' });

// CraftPix 세트 적용 (확인 대화상자 처리)
await page.click('[data-testid="map-bg-layer-set"]');
await page.waitForTimeout(800);
const card = page.locator('[data-testid="map-bg-layer-set-card-oga-craftpix-pines"]');
if (await card.count()) {
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/04-editor-picker.png' });
  await card.click();
  await page.waitForTimeout(600);
  const ok = page.locator('[data-testid="map-bg-layer-set-confirm-ok"]');
  if (await ok.count()) { await ok.click(); await page.waitForTimeout(800); }
  await page.screenshot({ path: OUT + '/05-editor-applied.png' });
}

// 캔버스 배경 미리보기 토글(줌 툴바) 찾아 켜기
const previewToggle = page.locator('[data-testid*="map-background-preview"], [data-testid*="bg-preview"]').first();
if (await previewToggle.count()) {
  await previewToggle.click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/06-editor-canvas-preview.png' });
}

await browser.close();
await server.close();
console.log('editor capture done');
