// 『폴른 스타』 왕도 아스텔 녹화 — 출하 player.html + export shim, 1배(480×270), 키보드·주인공 경로만.
// 실행: node scripts/qa/runtime/fallen-astel.record.mjs --fixture /tmp/astel/fs-new.json --out /tmp/astel/video [--walk '["left",...]']
// 산출: <out>/opening-city.mp4(오프닝 끝 → 왕도 도착), proclamation.mp4(포고), march.mp4(행렬이 성문으로), walk.mp4(광장 → 천문대 문), marks.json
// 오프닝은 건너뛰지 않고 끝까지 재생한다. 포고 대사는 읽을 만한 간격(1.8초)으로 넘긴다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: { fixture: { type: 'string' }, out: { type: 'string' }, walk: { type: 'string', default: '[]' } } });
const out = resolve(values.out ?? 'verify-shots/fallen-astel/video');
await mkdir(out, { recursive: true });
const body = await readFile(resolve(values.fixture), 'utf8');
const walk = JSON.parse(values.walk);
const viewport = { width: 480, height: 270 };
const id = (v) => `[data-testid="${v}"]`;
const marks = {};
const errors = [];

let server, browser;
try {
  server = await startPlayerQaServer({ logLevel: 'error' });
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const context = await browser.newContext({ viewport, recordVideo: { dir: join(out, 'raw'), size: viewport } });
  const wall0 = Date.now();
  const mark = (k) => { marks[k] = (Date.now() - wall0) / 1000; console.log(k, marks[k]); };
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__astel/project.json', saveNamespace: 'astel-record', qaInstrumentation: true }; });
  await page.route('**/__astel/project.json', (r) => r.fulfill({ contentType: 'application/json', body }));
  const state = () => page.evaluate(() => {
    const s = window.__oprnDebug?.readState?.();
    return { map: s?.currentMapId ?? null, x: s?.x, y: s?.y, marched: !!s?.switches?.sw_fs_valen_marched,
      dialogue: !!document.querySelector('[data-testid="dialogue-box"]'), cine: !!document.querySelector('[data-testid="cinematic-sequence"]') };
  });
  try {
    await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    for (let attempt = 0; ; attempt++) {
      try { await page.waitForSelector(id('title-screen'), { timeout: 60000 }); break; }
      catch (e) { if (attempt >= 2) throw e; await page.reload({ waitUntil: 'domcontentloaded' }); }
    }
    await page.waitForSelector(`${id('title-screen')}[data-seq-state="done"]`, { timeout: 30000 }).catch(() => {});
    for (let i = 0; i < 4 && !(await state()).cine; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(2500); }
    mark('openingStart');
    // 오프닝을 끝까지 본다(자동으로 넘어간다).
    for (let i = 0; i < 900 && (await state()).cine; i++) await page.waitForTimeout(250);
    mark('openingEnd');
    for (let i = 0; i < 480 && (await state()).map !== 'fs_hub'; i++) await page.waitForTimeout(250);
    mark('hub');
    // 포고: 대사가 뜨면 1.8초 읽고 넘긴다. 대사가 0.8초 넘게 없으면 행진이 시작된 것이다.
    let quiet = 0, lines = 0;
    for (let i = 0; i < 400; i++) {
      const s = await state();
      if (s.dialogue) { if (!marks.firstLine) { mark('firstLine'); marks.sprites = await page.evaluate(() => { const st = window.__oprnDebug.readState(); const c = window.__oprnCharacterSprites?.(); return { player: { x: st.x, y: st.y, facing: st.facing }, sprites: c }; }).catch(() => null); } quiet = 0; await page.waitForTimeout(1800); await page.keyboard.press('Enter'); lines += 1; await page.waitForTimeout(250); continue; }
      quiet += 1;
      if (lines > 0 && quiet >= 4) break;
      await page.waitForTimeout(200);
    }
    mark('marchStart');
    for (let i = 0; i < 480 && !(await state()).marched; i++) await page.waitForTimeout(250);
    mark('marched');
    // 엘레나 대사(행렬이 떠난 뒤)도 같은 간격으로 넘긴다.
    quiet = 0;
    for (let i = 0; i < 200; i++) {
      const s = await state();
      if (s.dialogue) { quiet = 0; await page.waitForTimeout(1800); await page.keyboard.press('Enter'); await page.waitForTimeout(250); continue; }
      quiet += 1;
      if (quiet >= 12) break;
      await page.waitForTimeout(250);
    }
    mark('afterElena');
    marks.posAfterElena = await state();
    if (walk.length) {
      mark('walkStart');
      await page.evaluate((moves) => window.__oprnDebug.playerRoute(moves.map((dir) => ({ kind: 'move', dir }))), walk);
      // 경로 끝(천문대 문 앞)에 닿을 때까지 — 자리가 1.5초 동안 그대로면 닿은 것이다.
      let last = '', still = 0;
      for (let i = 0; i < 400 && still < 6; i++) { const s = await state(); const k = `${s.x},${s.y}`; still = k === last ? still + 1 : 0; last = k; await page.waitForTimeout(250); }
      mark('walkArrived');
      // 문은 밟아 들어간다(경로 이동은 문 이벤트를 부르지 않는다) — 위 화살표를 누르고 있는다.
      await page.keyboard.down('ArrowUp');
      for (let i = 0; i < 40 && (await state()).map === 'fs_hub'; i++) await page.waitForTimeout(100);
      await page.keyboard.up('ArrowUp');
      await page.waitForTimeout(2000);
      mark('walkEnd');
      marks.posAfterWalk = await state();
    }
  } catch (e) { errors.push(String(e.stack ?? e)); await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {}); }
  const video = page.video();
  await context.close();
  const raw = await video.path();
  const clip = async (name, a, b) => {
    if (a == null || b == null || b <= a) return;
    await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, a)), '-t', String(b - a), '-i', raw,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'veryfast', '-an', '-movflags', '+faststart', join(out, `${name}.mp4`)]);
  };
  await clip('opening-city', marks.openingEnd - 14, (marks.firstLine ?? marks.hub) + 3);
  await clip('proclamation', marks.firstLine ?? marks.hub, marks.marchStart + 1);
  await clip('march', marks.marchStart - 0.5, marks.marched + 2.5);
  await clip('walk', marks.walkStart - 0.5, marks.walkEnd);
  await clip('opening-full', marks.openingStart - 0.5, (marks.firstLine ?? marks.hub) + 3);
  await writeFile(join(out, 'marks.json'), JSON.stringify({ marks, errors, raw }, null, 1));
  console.log(JSON.stringify({ marks, errors: errors.map((e) => e.slice(0, 300)) }));
} finally { await browser?.close(); await server?.close(); }
