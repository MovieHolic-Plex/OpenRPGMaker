import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:9853';
const OUT = '/tmp/layer-picker-frames2';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3500);

await page.click('[data-testid="sidebar-maps"]');
await page.waitForTimeout(900);
await page.click('[data-testid="map-sidebar-properties-tab"]');
await page.waitForTimeout(1200);

const bgSection = page.locator('[data-testid="map-props-section-background"]');
await bgSection.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(500);

const enable = page.locator('[data-testid="map-bg-enable"]');
if (await enable.count()) {
  const checked = await enable.isChecked();
  if (!checked) { await enable.check().catch(() => {}); await page.waitForTimeout(900); }
}
await bgSection.scrollIntoViewIfNeeded().catch(() => {});

let frame = 0;
async function snap() {
  await page.screenshot({ path: OUT + '/f' + String(frame).padStart(3, '0') + '.png' });
  frame++;
}
async function snapEvery(ms, step) {
  const end = Date.now() + ms;
  while (Date.now() < end) { await snap(); await page.waitForTimeout(step || 260); }
}

await snapEvery(900);

const pickerBtn = page.locator('[data-testid="map-bg-layer-set"]');
await pickerBtn.click();
await page.waitForTimeout(700);
await snapEvery(1400);

const card = page.locator('[data-testid="map-bg-layer-set-card-oga-craftpix-pines"]');
if (await card.count()) {
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.hover();
  await page.waitForTimeout(600);
  await snap();
}

await card.click();
await page.waitForTimeout(600);
await snapEvery(900);

const ok = page.locator('[data-testid="map-bg-layer-set-confirm-ok"]');
if (await ok.count()) {
  await ok.click();
  await page.waitForTimeout(700);
  await snapEvery(2600);
}

await browser.close();
console.log('frames:', frame);
