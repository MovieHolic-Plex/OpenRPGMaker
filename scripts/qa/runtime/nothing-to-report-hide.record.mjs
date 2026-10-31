// 「이상 없음」 톤 시험 녹화 — 2층 첫 숨기 장면을 출하 player.html(내보내기 shim) 경로, 실제 키보드 입력, 소리 포함 1배 MP4 로.
// chase-ai.record.mjs 와 같은 방식(Xvfb 실제 픽셀 + 독립 Pulse 출력 모니터를 한 ffmpeg 로). 대체 소리 합성 없음.
// 대본: 새 게임 → 깨어남(방송) → 교탁 서랍 손전등 → 서쪽 문으로 복도 → 계단참 손전등 → 도구함에 숨기 → 혼잣말 → 지나간 뒤 나오기.
// 실행: unshare -rn bash -c "ip link set lo up; node scripts/qa/runtime/nothing-to-report-hide.record.mjs --project dist/demos/nothing-to-report.play.json --masks /tmp/fs2/nr/masks.json --out /tmp/fs2/nr/hide-run"
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, masks: { type: 'string' }, out: { type: 'string' }, read: { type: 'string', default: '2300' },
  opening: { type: 'boolean', default: false },
} });
if (!values.project || !values.masks || !values.out) throw new Error('--project --masks --out 가 필요합니다');
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const projectBody = await readFile(values.project, 'utf8');
const masks = JSON.parse(await readFile(values.masks, 'utf8'))['map_nr_2f'].masks;
const READ_MS = Number(values.read);
const temp = await mkdtemp('/tmp/oprn-nr-av-');
await mkdir(join(temp, 'runtime'), { mode: 0o700 });
let displayNumber = 210;
for (;; displayNumber++) { try { await access('/tmp/.X11-unix/X' + displayNumber); } catch { break; } }
const env = { ...process.env, XDG_RUNTIME_DIR: join(temp, 'runtime'), DISPLAY: ':' + displayNumber,
  PULSE_SERVER: 'unix:' + join(temp, 'runtime/pulse/native'), PULSE_SINK: 'nr_capture' };
process.env.VITE_CACHE_DIR ??= resolve('.vite-cache/nr-record');
process.env.VITE_BGM_CDN_BASE = '';
const report = { route: 'player.html + exportProjectStoreShim', beats: [], lines: [], errors: [], saeki: [], hidingAt: null, caught: false };
const processes = [];
let server, context, recorder, page, t0 = 0;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const mark = (what) => { const t = t0 ? Date.now() - t0 : 0; report.beats.push({ t, what }); console.log(`[${(t / 1000).toFixed(1)}s] ${what}`); };
function command(bin, args) {
  const result = spawnSync(bin, args, { env, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(bin + ': ' + result.stderr);
  return result.stdout;
}
function daemon(bin, args = []) {
  const child = spawn(bin, args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
  child.logs = ''; child.stderr.on('data', (b) => { child.logs = (child.logs + String(b)).slice(-5000); });
  processes.push(child); return child;
}
async function finishRecording() {
  if (!recorder) return;
  const child = recorder; recorder = null;
  child.stdin.end('q\n');
  const status = await child.done;
  if (status !== 0) throw new Error('ffmpeg capture failed: ' + child.logs.slice(-1800));
}

const DIRS = [['ArrowUp', 0, -1, 1, 'up'], ['ArrowDown', 0, 1, 2, 'down'], ['ArrowLeft', -1, 0, 4, 'left'], ['ArrowRight', 1, 0, 8, 'right']];
const can = (x, y, bit) => ((masks[y]?.[x] ?? 0) & bit) !== 0;
function bfs(from) {
  const dist = new Map([[`${from.x},${from.y}`, 0]]);
  let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const p of frontier) for (const [, dx, dy, bit] of DIRS) {
      const n = { x: p.x + dx, y: p.y + dy }, k = `${n.x},${n.y}`;
      if (dist.has(k) || !can(p.x, p.y, bit)) continue;
      dist.set(k, dist.get(`${p.x},${p.y}`) + 1); next.push(n);
    }
    frontier = next;
  }
  return dist;
}
const state = () => page.evaluate(() => {
  const st = window.__oprnDebug.readState();
  const box = document.querySelector("[data-testid='dialogue-box']");
  const text = box && box.offsetParent !== null ? (box.textContent ?? '').trim() : '';
  return { x: st.x, y: st.y, map: st.currentMapId, text, hiding: !!st.horror?.hiding, saeki: st.eventLocations?.ev_nr_saeki_2f ?? null,
    pursuing: !!st.horror?.pursuits?.ev_nr_saeki_2f?.active, gameOver: !!document.querySelector("[data-testid='game-over'], [data-testid='horror-game-over']") };
});
/** 대사가 떠 있으면 읽을 시간만큼 두고 넘긴다. 대사가 하나도 없을 때까지. */
async function readThrough(maxMs = 60000) {
  const end = Date.now() + maxMs;
  let quiet = 0;
  while (Date.now() < end) {
    const s = await state();
    if (s.text) {
      if (report.lines.at(-1)?.text !== s.text) { report.lines.push({ t: Date.now() - t0, text: s.text }); console.log('   「' + s.text.slice(0, 60) + '」'); }
      await delay(READ_MS);
      await page.keyboard.press('Enter');
      await delay(350);
      quiet = 0;
    } else {
      quiet += 1;
      if (quiet > 8) return;
      await delay(150);
    }
  }
}
let held = null;
async function hold(key) {
  if (held === key) return;
  if (held) await page.keyboard.up(held);
  held = key;
  if (key) await page.keyboard.down(key);
}
/** 걸어서 목표 칸까지(대사가 뜨면 멈추고 읽는다). */
async function goTo(target, label) {
  mark('걷기 → ' + label);
  const d = bfs(target);
  const end = Date.now() + 120000;
  let lastCell = '', since = Date.now();
  while (Date.now() < end) {
    const s = await state();
    if (s.text) { await hold(null); await readThrough(); continue; }
    if (s.x === target.x && s.y === target.y) { await hold(null); return true; }
    // 문은 밀어서 연다(#3973) — 한 칸에 오래 서 있으면 키를 뗐다 다시 누른다.
    const cell = `${s.x},${s.y}`;
    if (cell !== lastCell) { lastCell = cell; since = Date.now(); }
    else if (Date.now() - since > 2500) { await hold(null); await delay(120); since = Date.now(); }
    let key = null, best = d.get(`${s.x},${s.y}`) ?? 99;
    for (const [k, dx, dy, bit] of DIRS) { if (!can(s.x, s.y, bit)) continue; const v = d.get(`${s.x + dx},${s.y + dy}`); if (v !== undefined && v < best) { best = v; key = k; } }
    await hold(key);
    await delay(30);
  }
  await hold(null);
  report.errors.push('goTo timeout ' + label);
  return false;
}
const pos = () => page.evaluate(() => { const s = window.__oprnDebug.readState(); const sc = window.__oprnHooksScene; return { x: s.x, y: s.y, moving: !!sc?.moving }; });
/** 한 걸음 — 칸이 바뀌는 순간 키를 뗀다(문은 밀어서 열리므로 바뀔 때까지 누르고 있는다). */
async function step(dir) {
  const key = DIRS.find((d) => d[4] === dir)[0];
  const from = await pos();
  await page.keyboard.down(key);
  const end = Date.now() + 15000;
  let moved = false;
  while (Date.now() < end) { const p = await pos(); if (p.x !== from.x || p.y !== from.y) { moved = true; break; } await delay(20); }
  await page.keyboard.up(key);
  for (let i = 0; i < 40; i++) { const p = await pos(); if (!p.moving) break; await delay(40); }
  return moved;
}
/** 목표 칸까지 정확히 — 너비 우선 거리로 한 걸음씩, 지나치면 되돌아온다. 대사가 뜨면 읽는다. */
async function walkTo(target, label) {
  mark('걷기 → ' + label);
  const d = bfs(target);
  const end = Date.now() + 180000;
  while (Date.now() < end) {
    const s = await state();
    if (s.text) { await readThrough(); continue; }
    if (s.x === target.x && s.y === target.y) return true;
    let dir = null, best = d.get(`${s.x},${s.y}`) ?? 99;
    for (const [, dx, dy, bit, name] of DIRS) { if (!can(s.x, s.y, bit)) continue; const v = d.get(`${s.x + dx},${s.y + dy}`); if (v !== undefined && v < best) { best = v; dir = name; } }
    if (!dir) { report.errors.push(`no path ${label} at ${s.x},${s.y}`); return false; }
    if (!await step(dir)) report.errors.push(`blocked ${label} at ${s.x},${s.y} ${dir}`);
  }
  report.errors.push('walkTo timeout ' + label);
  return false;
}
async function faceAndAct(dir) {
  const key = DIRS.find((d) => d[4] === dir)[0];
  await page.evaluate((d) => window.__oprnInput.face(d), dir);
  await delay(200);
  void key;
  await page.keyboard.press('Enter');
  await delay(400);
}

try {
  const bus = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(bus);
  env.DBUS_SESSION_BUS_ADDRESS = await new Promise((r, j) => {
    const deadline = setTimeout(() => j(new Error('Private session bus did not start')), 4000);
    bus.stdout.once('data', (b) => { clearTimeout(deadline); r(String(b).trim()); }); bus.once('error', j);
  });
  daemon('Xvfb', [env.DISPLAY, '-screen', '0', '962x542x24', '-nolisten', 'tcp', '-ac']);
  daemon('pipewire'); daemon('pipewire-pulse');
  let ready = false;
  for (let i = 0; i < 60; i++) { await delay(100); if (spawnSync('pactl', ['info'], { env, stdio: 'ignore' }).status === 0) { ready = true; break; } }
  if (!ready) throw new Error('Private Pulse service did not start');
  daemon('wireplumber');
  command('pactl', ['load-module', 'module-null-sink', 'sink_name=nr_capture', 'rate=48000', 'channels=2']);
  for (let i = 0; i < 40; i++) { await delay(100); if (spawnSync('pactl', ['set-default-sink', 'nr_capture'], { env, stdio: 'ignore' }).status === 0) break; }
  server = await startPlayerQaServer({ logLevel: 'error' });
  await mkdir(join(temp, 'browser/Default'), { recursive: true });
  await writeFile(join(temp, 'browser/Default/Preferences'), JSON.stringify({ translate: { enabled: false } }));
  context = await chromium.launchPersistentContext(join(temp, 'browser'), {
    headless: false, viewport: null, env, ignoreDefaultArgs: ['--no-startup-window'],
    args: ['--no-sandbox', '--kiosk', '--app=about:blank', '--window-position=0,0', '--window-size=960,540',
      '--autoplay-policy=no-user-gesture-required', '--disable-features=Translate,TranslateUI', '--lang=ko', '--use-gl=swiftshader', '--disable-gpu'],
  });
  page = context.pages()[0] ?? await context.newPage();
  const cdp = await context.newCDPSession(page);
  const win = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'fullscreen' } });
  await delay(250);
  await page.setViewportSize({ width: 960, height: 540 });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__nr/project.json', saveNamespace: 'nr-record', qaInstrumentation: true }; });
  await page.route('**/__nr/project.json', (r) => r.fulfill({ contentType: 'application/json', body: projectBody }));
  await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 180000 });
  await delay(1500);
  recorder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y',
    '-thread_queue_size', '1024', '-use_wallclock_as_timestamps', '1', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', '960x540', '-i', env.DISPLAY + '.0+0,0',
    '-thread_queue_size', '1024', '-use_wallclock_as_timestamps', '1', '-f', 'pulse', '-sample_rate', '48000', '-i', 'nr_capture.monitor',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2',
    '-c:a', 'aac', '-b:a', '160k', '-af', 'aresample=async=1:first_pts=0', '-movflags', '+faststart', join(out, 'hide.mp4')],
  { env, stdio: ['pipe', 'ignore', 'pipe'] });
  recorder.logs = ''; recorder.stderr.on('data', (b) => { recorder.logs += String(b); });
  recorder.done = new Promise((r, j) => { recorder.on('exit', r); recorder.on('error', j); });
  t0 = Date.now();
  await delay(1800);
  mark('새 게임');
  // 타이틀 메뉴가 늦게 뜨면 첫 Enter 가 먹힌다 — 맵이 잡히거나 오프닝이 시작될 때까지 다시 누른다.
  for (let i = 0; i < 80; i++) {
    const started = await page.evaluate(() => !!window.__oprnDebug?.readState?.().currentMapId || !!document.querySelector('[data-testid="cinematic-sequence"]')).catch(() => false);
    if (started) break;
    const btn = page.getByText('새 게임', { exact: true });
    if (i % 3 === 2 && await btn.count()) await btn.first().click({ timeout: 2000 }).catch(() => {});
    else await page.keyboard.press('Enter');
    await delay(700);
  }
  await delay(1500);
  if (values.opening) {
    // --opening: 오프닝 애니메틱을 끝까지 보고 깨어나는 장면까지만 녹화한다.
    mark('오프닝');
    for (let i = 0; i < 400 && await page.locator('[data-testid="cinematic-sequence"]').count(); i++) await delay(250);
  } else {
    // 오프닝(새 게임 뒤 애니메틱)은 건너뛴다 — 이 녹화는 게임 안 첫 숨기의 톤 시험이다. 오프닝은 --opening 으로 따로.
    for (let i = 0; i < 60 && await page.locator('[data-testid="cinematic-sequence"]').count(); i++) { await page.keyboard.press('Escape'); await delay(250); await page.keyboard.press('Enter'); await delay(400); }
  }
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
  await page.evaluate(() => window.__oprnDebug.setSeed(1));
  await delay(1200);
  mark('깨어남');
  await readThrough();
  await delay(900);
  if (values.opening) throw Object.assign(new Error('opening-done'), { done: true });
  // 교탁 서랍(16,4) — (17,4) 에서 왼쪽.
  await walkTo({ x: 17, y: 4 }, '교탁');
  for (let tries = 0; tries < 3; tries++) {
    await faceAndAct('left');
    await readThrough();
    if ((await page.evaluate(() => window.__oprnDebug.readState().switches.sw_nr_flashlight))) break;
    report.errors.push('drawer retry'); await walkTo({ x: 17, y: 4 }, '교탁 다시');
  }
  await delay(700);
  // 서쪽 문으로 복도까지 — (13,15) 에서 첫 손전등.
  await walkTo({ x: 13, y: 15 }, '복도');
  await readThrough();
  mark('계단참 손전등');
  await delay(600);
  // 도구함(12,11) — (13,11) 에서 왼쪽.
  await walkTo({ x: 13, y: 11 }, '도구함 앞');
  await faceAndAct('left');
  await readThrough(4000);
  const sh = await state();
  report.hidingAt = sh.hiding ? Date.now() - t0 : null;
  mark(sh.hiding ? '숨음' : '숨기 실패');
  // 숨은 채로 사에키가 지나가길 기다린다(혼잣말은 bark 라 멈추지 않는다).
  const waitEnd = Date.now() + 26000;
  while (Date.now() < waitEnd) {
    const s = await state();
    if (s.saeki) { const last = report.saeki.at(-1); if (!last || last.x !== s.saeki.x || last.y !== s.saeki.y) report.saeki.push({ t: Date.now() - t0, ...s.saeki, pursuing: s.pursuing }); }
    if (s.gameOver) { report.caught = true; mark('붙잡힘'); break; }
    if (s.text) await readThrough(6000);
    await delay(200);
  }
  if (!report.caught) {
    mark('나오기');
    await page.keyboard.press('Enter');
    await delay(2500);
  }
  await delay(1500);
  await finishRecording();
  report.audio = (() => {
    const pcm = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(out, 'hide.mp4'), '-vn', '-ac', '1', '-ar', '12000', '-f', 'f32le', 'pipe:1'], { env, maxBuffer: 64 * 1024 * 1024 });
    let peak = 0, square = 0;
    for (let i = 0; i < pcm.stdout.length; i += 4) { const x = pcm.stdout.readFloatLE(i); peak = Math.max(peak, Math.abs(x)); square += x * x; }
    return { peak, rms: Math.sqrt(square / Math.max(1, pcm.stdout.length / 4)) };
  })();
  for (const b of report.beats) {
    const at = Math.max(0, b.t / 1000 + 1.2);
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-i', join(out, 'hide.mp4'), '-frames:v', '1', join(out, `beat-${Math.round(at * 10)}.png`)], { env });
  }
} catch (e) {
  if (e?.done) { await delay(800); await finishRecording().catch(() => {}); }
  else report.errors.push(String(e.stack ?? e));
} finally {
  await hold(null).catch(() => {});
  await finishRecording().catch((e) => report.errors.push(String(e)));
  await context?.close(); await server?.close();
  for (const child of processes.reverse()) child.kill('SIGTERM');
}
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ hidingAt: report.hidingAt, caught: report.caught, lines: report.lines.length, saekiSteps: report.saeki.length, audio: report.audio, errors: report.errors.map((e) => e.slice(0, 300)) }));
