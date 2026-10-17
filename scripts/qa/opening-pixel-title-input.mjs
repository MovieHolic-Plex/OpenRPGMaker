// 타이틀 화면에서 Enter 가 «새 게임» 을 시작하는지 입력 경로를 직접 본다.
// 사용: node scripts/qa/opening-pixel-title-input.mjs <project.json>
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const project = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const log = [];
page.on('console', (m) => log.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => log.push(`pageerror: ${String(e.message).slice(0, 200)}`));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: '/__runtime-qa/project.json', saveNamespace: 'title-input', qaInstrumentation: true };
  window.__keys = [];
  for (const type of ['keydown', 'keyup']) document.addEventListener(type, (event) => window.__keys.push(`${type}:${event.key}:${event.target?.tagName ?? '?'}:${event.defaultPrevented}`), true);
});
await page.route('**/__runtime-qa/project.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) }));
await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
await page.waitForTimeout(3000);
const inspect = async (label) => {
  const info = await page.evaluate(() => {
    const title = document.querySelector("[data-testid='title-screen']");
    const canvases = [...document.querySelectorAll('canvas')].map((c) => ({ w: c.width, h: c.height, cls: c.className, pe: getComputedStyle(c).pointerEvents, z: getComputedStyle(c).zIndex }));
    return {
      title: !!title, titleClass: title?.className ?? null, titleHtml: (title?.innerHTML ?? '').slice(0, 400),
      canvases, keys: (window.__keys ?? []).slice(-6), active: document.activeElement?.tagName ?? null,
      bodyText: (document.body.innerText || '').replace(/\s+/gu, ' ').slice(0, 100),
      sequence: !!document.querySelector('.cinematic-sequence'), canvas: !!document.querySelector('canvas'),
    };
  });
  console.log(label, JSON.stringify({ ...info, titleHtml: info.titleHtml.slice(0, 160), canvases: info.canvases.length }));
  return info;
};
await inspect('before');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await inspect('after-enter');
await page.click('canvas').catch(() => undefined);
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
await inspect('after-click-enter');
await page.keyboard.press('Space');
await page.waitForTimeout(3000);
await inspect('after-space');
console.log('--- log ---'); console.log(log.slice(-25).join('\n'));
await browser.close();
await server.close();
