// 실제 player.html 부팅 진단 — 타이틀에서 Enter 를 눌렀을 때 오프닝으로 들어가는지 단계별로 본다.
// 사용: node scripts/qa/opening-pixel-player-diagnose.mjs <project.json> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const [projectPath, outDirRaw] = process.argv.slice(2);
const outDir = path.resolve(outDirRaw ?? '/tmp/opening-player-diagnose');
fs.mkdirSync(outDir, { recursive: true });
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--disable-gpu', '--disable-features=NetworkChangeNotifier'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const events = [];
page.on('pageerror', (e) => events.push({ t: Date.now(), kind: 'pageerror', text: String(e.message ?? e).slice(0, 300) }));
page.on('console', (m) => events.push({ t: Date.now(), kind: `console:${m.type()}`, text: m.text().slice(0, 300) }));
page.on('requestfailed', (r) => events.push({ t: Date.now(), kind: 'requestfailed', text: `${r.url().slice(-90)} ${r.failure()?.errorText}` }));
page.on('response', (r) => { if (r.status() >= 400) events.push({ t: Date.now(), kind: `http:${r.status()}`, text: r.url().slice(-110) }); });
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } window.__OPENRPG_BOOT__ = { projectUrl: '/__runtime-qa/project.json', saveNamespace: 'diag', qaInstrumentation: true }; });
await page.route('**/__runtime-qa/project.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) }));
const t0 = Date.now();
const snap = async (label) => { await page.screenshot({ path: path.join(outDir, `${String(Date.now() - t0).padStart(6, '0')}-${label}.png`) }); };
const probe = async (label) => {
  const dom = await page.evaluate(() => ({
    title: !!document.querySelector("[data-testid='title-screen']"),
    titleScreen: document.querySelector("[data-testid='title-screen']")?.getAttribute('data-screen') ?? null,
    loadPanel: !!document.querySelector(".oprn-load-panel"),
    animatic: !!document.querySelector("[data-testid='opening-animatic-stage']"),
    sequence: !!document.querySelector('.cinematic-sequence'),
    sceneKind: document.querySelector('.cinematic-sequence')?.getAttribute('data-scene-kind') ?? null,
    mediaState: document.querySelector('.cinematic-sequence')?.getAttribute('data-media-state') ?? null,
    canvas: !!document.querySelector('canvas'),
    state: (() => { try { return JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? 'null'); } catch { return null; } })(),
    bodyText: (document.body.innerText || '').slice(0, 120).replace(/\s+/gu, ' '),
  }));
  events.push({ t: Date.now() - t0, kind: 'probe', label, dom: { ...dom, state: dom.state ? { mapId: dom.state.mapId, running: dom.state.running, inputEnabled: dom.state.inputEnabled } : null } });
  console.log(label, JSON.stringify({ title: dom.title, screen: dom.titleScreen, animatic: dom.animatic, sequence: dom.sequence, canvas: dom.canvas, state: dom.state ? dom.state.mapId : null }));
  return dom;
};
await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
await probe('title-ready');
await page.waitForTimeout(1500);
await probe('title-settled');
await page.keyboard.press('Enter');
for (const ms of [500, 1500, 4000, 10000]) {
  await page.waitForTimeout(ms);
  await probe(`after-enter+${ms}ms`);
  await snap(`after-enter`);
}
fs.writeFileSync(path.join(outDir, 'diagnose.json'), JSON.stringify(events, null, 1));
await browser.close();
await server.close();
console.log('events', events.filter(e => e.kind !== 'probe').slice(-12));
