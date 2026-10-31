// 입구 곁 경비 실제 플레이 녹화 — 출하 player.html(내보내기 shim), 실제 키보드 입력, 1배 MP4(소리 포함).
// 주인공은 방에서 문으로 걸어 들판에 들어선 뒤, 도착 칸에 --stand(기본 2000)ms 서 있다가(들어서자마자 덮치는가) 아래로 6칸·동쪽으로 걸어
// 경비에서 6칸 떨어진 줄로 지나간다(지나가는 주인공을 보는가). 픽스처: chaser-entrance-fixture.mts.
//   node scripts/qa/runtime/chaser-entrance.record.mjs --project fixture.json --meta meta.json --out <dir> [--label 후]
// 산출: <out>/chase.mp4, report.json(도착 시각·경비가 알아챈 시각·전투 시각), first-frame.png
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, meta: { type: 'string' }, out: { type: 'string' }, label: { type: 'string', default: '' },
  timeout: { type: 'string', default: '30000' }, stand: { type: 'string', default: '2000' }, bgm: { type: 'string', default: 'cc0-bgm-rtp-dng-001' },
} });
if (!values.project || !values.meta || !values.out) throw new Error('--project --meta --out 가 필요합니다');
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(values.project, 'utf8'));
const meta = JSON.parse(await readFile(values.meta, 'utf8'));
project.maps[meta.fieldId].bgm = { mode: 'custom', resourceId: values.bgm };
const temp = await mkdtemp('/tmp/oprn-chaser-entrance-');
await mkdir(join(temp, 'runtime'), { mode: 0o700 });
let displayNumber = 190;
for (;; displayNumber++) { try { await access('/tmp/.X11-unix/X' + displayNumber); } catch { break; } }
const env = { ...process.env, XDG_RUNTIME_DIR: join(temp, 'runtime'), DISPLAY: ':' + displayNumber,
  PULSE_SERVER: 'unix:' + join(temp, 'runtime/pulse/native'), PULSE_SINK: 'chase_capture' };
process.env.VITE_CACHE_DIR ??= resolve('.vite-cache/chaser-entrance-record');
process.env.VITE_BGM_CDN_BASE = '';
const report = { label: values.label, route: 'player.html + exportProjectStoreShim', sight: meta.sight, arrivedAtMs: null, noticedAtMs: null, noticedAfterArrivalMs: null, noticedPhase: null, battleAtMs: null, steps: [], errors: [] };
const processes = [];
let server, context, recorder;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
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

// 통행 격자(픽스처가 canMove 로 찍은 그림)에서 너비 우선 거리.
const masks = meta.masks;
const DIRS = [['ArrowUp', 0, -1, 1], ['ArrowDown', 0, 1, 2], ['ArrowLeft', -1, 0, 4], ['ArrowRight', 1, 0, 8]];
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

try {
  const bus = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(bus);
  env.DBUS_SESSION_BUS_ADDRESS = await new Promise((r, j) => {
    const deadline = setTimeout(() => j(new Error('Private session bus did not start')), 4000);
    bus.stdout.once('data', (b) => { clearTimeout(deadline); r(String(b).trim()); }); bus.once('error', j);
  });
  daemon('Xvfb', [env.DISPLAY, '-screen', '0', '962x722x24', '-nolisten', 'tcp', '-ac']);
  daemon('pipewire'); daemon('pipewire-pulse');
  let ready = false;
  for (let i = 0; i < 60; i++) { await delay(100); if (spawnSync('pactl', ['info'], { env, stdio: 'ignore' }).status === 0) { ready = true; break; } }
  if (!ready) throw new Error('Private Pulse service did not start');
  daemon('wireplumber');
  command('pactl', ['load-module', 'module-null-sink', 'sink_name=chase_capture', 'rate=48000', 'channels=2']);
  for (let i = 0; i < 40; i++) { await delay(100); if (spawnSync('pactl', ['set-default-sink', 'chase_capture'], { env, stdio: 'ignore' }).status === 0) break; }
  server = await startPlayerQaServer({ logLevel: 'error' });
  await mkdir(join(temp, 'browser/Default'), { recursive: true });
  await writeFile(join(temp, 'browser/Default/Preferences'), JSON.stringify({ translate: { enabled: false } }));
  context = await chromium.launchPersistentContext(join(temp, 'browser'), {
    headless: false, viewport: null, env, ignoreDefaultArgs: ['--no-startup-window'],
    args: ['--no-sandbox', '--kiosk', '--app=about:blank', '--window-position=0,0', '--window-size=960,720',
      '--autoplay-policy=no-user-gesture-required', '--disable-features=Translate,TranslateUI', '--lang=ko', '--use-gl=swiftshader', '--disable-gpu'],
  });
  const page = context.pages()[0] ?? await context.newPage();
  const cdp = await context.newCDPSession(page);
  const win = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'fullscreen' } });
  await delay(250);
  await page.setViewportSize({ width: 960, height: 720 });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__chaser-entrance/project.json', saveNamespace: 'chaser-entrance-record', qaInstrumentation: true }; });
  await page.route('**/__chaser-entrance/project.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
  await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
  for (let i = 0; i < 40 && await page.locator('[data-testid="cinematic-sequence"]').count(); i++) { await page.keyboard.press('Enter'); await delay(300); }
  await page.evaluate(() => window.__oprnDebug.setSeed(1));
  await delay(2600);
  recorder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y',
    '-thread_queue_size', '1024', '-use_wallclock_as_timestamps', '1', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', '960x720', '-i', env.DISPLAY + '.0+0,0',
    '-thread_queue_size', '1024', '-use_wallclock_as_timestamps', '1', '-f', 'pulse', '-sample_rate', '48000', '-i', 'chase_capture.monitor',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2',
    '-c:a', 'aac', '-b:a', '160k', '-af', 'aresample=async=1:first_pts=0', '-movflags', '+faststart', join(out, 'chase.mp4')],
  { env, stdio: ['pipe', 'ignore', 'pipe'] });
  recorder.logs = ''; recorder.stderr.on('data', (b) => { recorder.logs += String(b); });
  recorder.done = new Promise((r, j) => { recorder.on('exit', r); recorder.on('error', j); });
  await delay(800);

  const t0 = Date.now();
  const deadline = t0 + Number(values.timeout);
  let held = null, phase = 'to-door', standUntil = 0;
  const hold = async (key) => {
    if (held === key) return;
    if (held) await page.keyboard.up(held);
    held = key;
    if (key) await page.keyboard.down(key);
  };
  const DIRS = [['ArrowUp', 0, -1, 1], ['ArrowDown', 0, 1, 2], ['ArrowLeft', -1, 0, 4], ['ArrowRight', 1, 0, 8]];
  let arrival = null, lastTile = '';
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="battle-scene"]').count()) { report.battleAtMs = Date.now() - t0; break; }
    const s = await page.evaluate((id) => {
      const st = window.__oprnDebug.readState();
      return { map: st.currentMapId, x: st.x, y: st.y, guard: st.eventLocations?.[id] ?? null, active: !!st.horror?.pursuits?.[id]?.active };
    }, meta.guard).catch(() => null);
    if (!s) break;
    const t = Date.now() - t0;
    if (`${s.map}:${s.x},${s.y}` !== lastTile) { lastTile = `${s.map}:${s.x},${s.y}`; report.steps.push({ t, map: s.map, x: s.x, y: s.y, phase, guard: s.guard, active: s.active }); }
    if (s.map === meta.fieldId && report.arrivedAtMs === null) {
      report.arrivedAtMs = t; arrival = { x: s.x, y: s.y }; phase = 'stand'; standUntil = t + Number(values.stand);
      await hold(null);
    }
    if (s.active && report.noticedAtMs === null) {
      report.noticedAtMs = t; report.noticedPhase = phase;
      report.noticedAfterArrivalMs = report.arrivedAtMs === null ? null : t - report.arrivedAtMs;
      report.noticedAt = { player: { x: s.x, y: s.y }, guard: s.guard };
    }
    if (phase === 'to-door') await hold('ArrowRight');
    else if (phase === 'stand') { if (t >= standUntil) phase = 'down'; }
    else if (phase === 'down') { if (s.y >= arrival.y + 6) phase = 'east'; else await hold('ArrowDown'); }
    if (phase === 'east') {
      if (s.x >= meta.guardAt.x + 8) { await hold(null); phase = 'done'; }
      else await hold('ArrowRight');
    }
    if (phase === 'done' && t > (report.noticedAtMs ?? t) + 6000) break;
    await delay(30);
  }
  void DIRS;
  await hold(null);
  await delay(report.battleAtMs !== null ? 2500 : 600);
  await finishRecording();
  report.audio = (() => {
    const pcm = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(out, 'chase.mp4'), '-vn', '-ac', '1', '-ar', '12000', '-f', 'f32le', 'pipe:1'], { env, maxBuffer: 32 * 1024 * 1024 });
    let peak = 0, square = 0;
    for (let i = 0; i < pcm.stdout.length; i += 4) { const x = pcm.stdout.readFloatLE(i); peak = Math.max(peak, Math.abs(x)); square += x * x; }
    return { peak, rms: Math.sqrt(square / Math.max(1, pcm.stdout.length / 4)) };
  })();
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.5', '-i', join(out, 'chase.mp4'), '-frames:v', '1', join(out, 'first-frame.png')]);
} catch (e) {
  report.errors.push(String(e.stack ?? e));
} finally {
  await finishRecording().catch((e) => report.errors.push(String(e)));
  await context?.close(); await server?.close();
  for (const child of processes.reverse()) child.kill('SIGTERM');
}
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ label: report.label, sight: report.sight, arrivedAtMs: report.arrivedAtMs, noticedAfterArrivalMs: report.noticedAfterArrivalMs, noticedPhase: report.noticedPhase, noticedAt: report.noticedAt, battleAtMs: report.battleAtMs, errors: report.errors.map((e) => e.slice(0, 300)) }));
