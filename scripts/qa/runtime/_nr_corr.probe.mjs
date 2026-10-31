// 「이상 없음」 첫 손전등 직후 무엇이 히어로를 잡는지 — 13,14 에서 한 칸 내려가 대사를 넘기고 20초 상태를 적는다.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
process.env.VITE_CACHE_DIR ??= resolve('.vite-cache/nr-record');
process.env.VITE_BGM_CDN_BASE = '';
const { startPlayerQaServer } = await import('../../lib/runtimeQaRun.mjs');
const body = await readFile('dist/demos/nothing-to-report.play.json', 'utf8');
const server = await startPlayerQaServer({ logLevel: 'error' });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
const sx = Number(process.env.SX ?? 13), sy = Number(process.env.SY ?? 14);
await page.addInitScript(([x, y]) => { window.__OPENRPG_BOOT__ = { projectUrl: '/__nr/p.json', saveNamespace: 'nr-corr' + Date.now(), qaInstrumentation: true, qaCheckpoint: { id: 'w', mapId: 'map_nr_2f', x, y, facing: 'down', variables: { var_nr_stage: Number(new URLSearchParams(location.search).get('stage') ?? 2) }, switches: { sw_nr_flashlight: true, sw_nr_saeki_2f: new URLSearchParams(location.search).get('saeki') === '1' }, items: { item_nr_flashlight: 1 } } }; }, [sx, sy]);
await page.route('**/__nr/p.json', (r) => r.fulfill({ contentType: 'application/json', body }));
await page.goto(server.url + '/player.html?stage=' + (process.env.STAGE ?? 2) + '&saeki=' + (process.env.SAEKI ?? 0), { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 600000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const st = () => page.evaluate(() => { const s = window.__oprnDebug.readState(); const box = document.querySelector("[data-testid='dialogue-box']");
  return { x: s.x, y: s.y, stage: s.variables.var_nr_stage, text: box && box.offsetParent !== null ? box.textContent.trim().slice(0, 30) : '',
    saeki: s.eventLocations?.ev_nr_saeki_2f, pur: s.horror?.pursuits?.ev_nr_saeki_2f ?? null, hiding: !!s.horror?.hiding,
    go: !!document.querySelector("[data-testid='game-over-screen']"), title: !!document.querySelector("[data-testid='title-screen']") }; });
await wait(3000);
console.log('start', JSON.stringify(await st()));
for (const K of (process.env.KEYS ?? process.env.KEY ?? 'ArrowDown').split(',')) {
  const from = await st(); await page.keyboard.down(K); const t1 = Date.now();
  while (Date.now() - t1 < 3000) { const p = await st(); if (p.x !== from.x || p.y !== from.y) break; await wait(20); }
  await page.keyboard.up(K); await wait(Number(process.env.GAP ?? 400));
  console.log('key', K, JSON.stringify(await st()));
}
let last = '';
const end = Date.now() + Number(process.env.SECS ?? 25) * 1000;
while (Date.now() < end) {
  const s = await st();
  const line = JSON.stringify(s);
  if (line !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1), line); last = line; }
  if (s.text) { await wait(900); await page.keyboard.press('Enter'); }
  if (s.go) break;
  await wait(150);
}
await page.screenshot({ path: '/tmp/fs2/nr/corr.png' });
await browser.close(); await server.close();
