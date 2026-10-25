// 전투 진입 그림 선적재 전/후 비교 — 출하 player.html(export shim), 키보드 입력만.
// 실행: node scripts/qa/runtime/battle-preload.record.mjs --out /tmp/bp/after [--only fast,slow-cold,slow-walk]
//   --play <path>  체크포인트 프로젝트로 쓸 구운 play.json (기본: 9888 의 dist/demos/chrono-bell.play.json)
// 산출: <out>/<scenario>.mp4 (무대 crop, 1배), <scenario>.json (reveal 순간 감사·시간), summary.json
// 감사: 전투 화면이 보이는 순간(overlay phase=reveal) 전투 무대 img 가 complete&naturalWidth>0 인지,
//       배경 그림(background-image·인라인 url)이 reveal 전에 도착했는지, reveal 뒤에 늦게 도착한 그림 수.
import { mkdir, writeFile, readFile, readdir, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import http from 'node:http';
import { readFile as readFileAsync, stat } from 'node:fs/promises';
import { extname } from 'node:path';

// 출하 플레이어(vite build 산출물)를 정적으로 서빙한다. dev 서버는 모듈 수십 개가 느린 회선에서 그림을 굶겨 대표성이 없다.
async function startStaticServer(buildDir) {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const roots = [resolve(buildDir), resolve('public')];
  const srv = http.createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    for (const root of roots) {
      const f = join(root, path);
      if (!f.startsWith(root)) continue;
      try {
        if (!(await stat(f)).isFile()) continue;
        res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
        res.end(await readFileAsync(f));
        return;
      } catch { /* next root */ }
    }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
import { loadCheckpointSet, checkpointBootState } from '../../lib/runtimeQaCheckpoints.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: {
  out: { type: 'string' }, only: { type: 'string' }, play: { type: 'string' }, checkpoint: { type: 'string', default: 'boss' },
  static: { type: 'string' }, pending: { type: 'boolean' }, kbps: { type: 'string', default: '1500' }, rtt: { type: 'string', default: '300' },
} });
const out = resolve(values.out ?? 'verify-shots/battle-preload/run');
await mkdir(out, { recursive: true });
const playPath = values.play ?? '/home/main/z-project/rpg-zzu-9888/dist/demos/chrono-bell.play.json';
const projectJson = await readFile(playPath);
const set = await loadCheckpointSet('fallen-star');
const cp = set.checkpoints.find((c) => c.id === values.checkpoint);
if (!cp) throw new Error(`checkpoint ${values.checkpoint} 없음`);
const SCENARIOS = {
  fast: { throttle: false, walkMs: 0 },
  'slow-cold': { throttle: true, walkMs: 0 },
  'slow-walk': { throttle: true, walkMs: 12000 },
};
const only = values.only ? values.only.split(',') : Object.keys(SCENARIOS);
const viewport = { width: 960, height: 540 };

const AUDIT_INIT = () => {
  performance.setResourceTimingBufferSize(20000);
  const st = (window.__bp = { phases: [], reveal: null, last: null });
  const urlsIn = (text) => [...String(text || '').matchAll(/url\((['"]?)(.*?)\1\)/g)].map((m) => m[2]).filter((u) => u && !u.startsWith('data:'));
  const snap = () => {
    const root = document.querySelector('[data-testid="battle-scene"]') ?? document.body;
    const imgs = [...root.querySelectorAll('img')].filter((i) => i.getAttribute('src') && !i.src.startsWith('data:'));
    const badImgs = imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.src);
    const bg = new Set();
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const u of urlsIn(getComputedStyle(el).backgroundImage)) bg.add(new URL(u, document.baseURI).href);
      for (const u of urlsIn(el.getAttribute('style'))) bg.add(new URL(u, document.baseURI).href);
    }
    const now = performance.now();
    const done = new Set(performance.getEntriesByType('resource').filter((e) => e.responseEnd > 0 && e.responseEnd <= now).map((e) => e.name));
    // 메모리 캐시에 올라 있으면 새 Image 가 즉시 complete 가 된다 — 그림이 이미 와 있다는 뜻.
    const loadedNow = (u) => { const im = new Image(); im.src = u; return im.complete && im.naturalWidth > 0; };
    const badBg = [...bg].filter((u) => !done.has(u) && !loadedNow(u));
    return { t: now, imgCount: imgs.length, badImgs, bgCount: bg.size, badBg };
  };
  const tick = () => {
    const ov = document.querySelector('[data-testid="battle-transition-overlay"]');
    const phase = ov?.getAttribute('data-battle-transition-phase') ?? null;
    if (phase && phase !== st.last) {
      st.last = phase;
      st.phases.push({ phase, t: performance.now(), wall: Date.now() });
      if (phase === 'reveal' && !st.reveal) st.reveal = snap();
    }
  };
  new MutationObserver(tick).observe(document, { attributes: true, childList: true, subtree: true });
};

const imageExt = /\.(png|webp|gif|jpe?g|svg)(\?|$)/i;
async function runScenario(name, serverUrl, browser) {
  const sc = SCENARIOS[name];
  const dir = join(out, `${name}-raw`);
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport, recordVideo: { dir, size: viewport } });
  const startedWall = Date.now();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message ?? e)));
  const gateLogs = [];
  const pend = new Map();
  page.on('request', (r) => pend.set(r, Date.now()));
  page.on('requestfinished', (r) => pend.delete(r));
  page.on('requestfailed', (r) => pend.delete(r));
  page.on('console', (m) => { const t = m.text(); if (t.includes('[battle-ready')) gateLogs.push(t.slice(0, 300)); });
  await page.route('**/__runtime-qa/project.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: projectJson }));
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint };
  }, ['/__runtime-qa/project.json', `battle-preload:${name}`, { checkpoint: checkpointBootState(cp) }]);
  await page.addInitScript(AUDIT_INIT);
  const bootStart = Date.now();
  const gotoOnce = async () => {
    await page.goto(`${serverUrl}/player.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  };
  try { await gotoOnce(); } catch (e) { await page.reload().catch(() => {}); await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 }); }
  const bootMs = Date.now() - bootStart;
  await page.waitForTimeout(1500);

  const cdp = await context.newCDPSession(page);
  if (sc.throttle) {
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: Number(values.rtt), downloadThroughput: (Number(values.kbps) * 1000) / 8, uploadThroughput: (Number(values.kbps) * 1000) / 8,
    });
  }
  if (sc.walkMs) await page.waitForTimeout(sc.walkMs);

  // 전투 트리거: 위를 보고 Enter 를 누르며 전투 무대가 뜰 때까지(대사 → 전투).
  const triggerWall = Date.now();
  await page.evaluate(() => window.__oprnInput.face('up'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__oprnInput.action());
  let sceneAt = null;
  for (let i = 0; i < 40 && !sceneAt; i += 1) {
    sceneAt = await page.evaluate(() => (document.querySelector('[data-testid="battle-scene"]') ? Date.now() : null));
    if (sceneAt) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
  }
  if (!sceneAt) throw new Error(`${name}: 전투 무대가 뜨지 않았다`);
  if (values.pending) await page.waitForTimeout(3500);
  if (values.pending) gateLogs.push('PENDING@3.5s ' + JSON.stringify([...pend.entries()].map(([r, t]) => [r.url().replace(serverUrl, '').slice(0, 70), Date.now() - t])));
  // reveal 이 올 때까지(느린 망 최대 40초) 기다린 뒤 reveal 후 3.5초 더 본다.
  await page.waitForFunction(() => window.__bp?.reveal, null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(3500);

  const result = await page.evaluate((exts) => {
    const re = new RegExp(exts.source, exts.flags);
    const st = window.__bp;
    const revealT = st.reveal?.t ?? null;
    const late = revealT == null ? [] : performance.getEntriesByType('resource')
      .filter((e) => re.test(e.name) && e.responseEnd > revealT).map((e) => ({ url: e.name.replace(location.origin, ''), afterMs: Math.round(e.responseEnd - revealT) }));
    let battleEntryMs = null;
    try { battleEntryMs = JSON.parse(document.querySelector("[data-testid='perf-metrics-json']")?.textContent ?? '{}')?.metrics?.battleEntryMs ?? null; } catch {}
    return { phases: st.phases, reveal: st.reveal, late, battleEntryMs };
  }, { source: imageExt.source, flags: imageExt.flags });
  const flash = result.phases[0];
  const reveal = result.phases.find((p) => p.phase === 'reveal');
  const report = {
    scenario: name, throttle: sc.throttle ? { kbps: Number(values.kbps), rttMs: Number(values.rtt), cacheDisabled: true } : null,
    bootMs, errors: errors.slice(0, 5), gateLogs,
    phases: result.phases.map((p) => ({ phase: p.phase, atMs: Math.round(p.t - (flash?.t ?? p.t)) })),
    entryMs: flash && reveal ? Math.round(reveal.t - flash.t) : null,
    battleEntryMs: result.battleEntryMs,
    atReveal: result.reveal && { imgCount: result.reveal.imgCount, missingImgs: result.reveal.badImgs.length, bgCount: result.reveal.bgCount, missingBg: result.reveal.badBg.length,
      missingImgUrls: result.reveal.badImgs.map((u) => u.replace(serverUrl, '')).slice(0, 12), missingBgUrls: result.reveal.badBg.map((u) => u.replace(serverUrl, '')).slice(0, 12) },
    lateImagesAfterReveal: result.late.length, lateSample: result.late.slice(0, 12),
  };
  const videoPath = await page.video().path();
  const flashRel = flash ? (flash.wall - startedWall) / 1000 : (triggerWall - startedWall) / 1000;
  const spanS = report.entryMs != null ? report.entryMs / 1000 : 2;
  report.video = { ss: Math.max(0, flashRel - 2.0), seconds: spanS + 2.0 + 4.0 };
  await context.close();
  const box = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const mp4 = join(out, `${name}.mp4`);
  await run('/usr/bin/ffmpeg', ['-y', '-ss', String(report.video.ss), '-t', String(report.video.seconds), '-i', videoPath,
    '-vf', `crop=${box.w}:${box.h}:${box.x}:${box.y}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', '-an', mp4]);
  await writeFile(join(out, `${name}.json`), JSON.stringify(report, null, 1));
  return report;
}

const server = values.static ? await startStaticServer(values.static) : await startPlayerQaServer();
const summary = {};
try {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  try {
    for (const name of only) {
      try { summary[name] = await runScenario(name, server.url, browser); }
      catch (e) { summary[name] = { error: String(e?.message ?? e).split('\n')[0] }; }
      console.log(JSON.stringify({ [name]: summary[name] }));
    }
  } finally { await browser.close(); }
} finally { await server.close(); }
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
