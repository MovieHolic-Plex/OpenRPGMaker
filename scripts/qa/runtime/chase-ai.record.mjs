// 필드 추격 AI 실제 플레이 녹화 — 출하 player.html(내보내기 shim) 경로, 실제 키보드 입력, 소리 포함 MP4.
// Xvfb 의 실제 브라우저 픽셀과 독립 Pulse 출력 모니터를 같은 ffmpeg 로 녹화한다(monster-battle-av.mjs 와 같은 방식 — 대체 소리 합성 없음).
// 주인공은 같은 «도망 봇»이 몬다: 홀로 걸어 들어가 추격자에게 들킨 뒤, 가장 가까운 추격자와의 걸음 거리가 가장 멀어지는 쪽으로 달아난다.
// 실행(체크아웃마다 그 체크아웃의 런타임으로 돈다 — 전/후 비교는 두 체크아웃에서 같은 픽스처로):
//   node scripts/qa/runtime/chase-ai.record.mjs --project /tmp/chase-ai/fixture.json --meta /tmp/chase-ai/fixture-meta.json --out /tmp/chase-ai/after-run [--label 후]
// 산출: <out>/chase.mp4(H.264+AAC), report.json(잡힌 시각·추격자 걸음 기록), first-frame.png
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, meta: { type: 'string' }, out: { type: 'string' }, label: { type: 'string', default: '' },
  timeout: { type: 'string', default: '30000' }, bgm: { type: 'string', default: 'cc0-bgm-rtp-dng-001' },
} });
if (!values.project || !values.meta || !values.out) throw new Error('--project --meta --out 가 필요합니다');
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(values.project, 'utf8'));
const meta = JSON.parse(await readFile(values.meta, 'utf8'));
project.maps[meta.mapId].bgm = { mode: 'custom', resourceId: values.bgm };
const temp = await mkdtemp('/tmp/oprn-chase-av-');
await mkdir(join(temp, 'runtime'), { mode: 0o700 });
let displayNumber = 190;
for (;; displayNumber++) { try { await access('/tmp/.X11-unix/X' + displayNumber); } catch { break; } }
const env = { ...process.env, XDG_RUNTIME_DIR: join(temp, 'runtime'), DISPLAY: ':' + displayNumber,
  PULSE_SERVER: 'unix:' + join(temp, 'runtime/pulse/native'), PULSE_SINK: 'chase_capture' };
process.env.VITE_CACHE_DIR ??= resolve('.vite-cache/chase-ai-record');
process.env.VITE_BGM_CDN_BASE = '';
const report = { label: values.label, route: 'player.html + exportProjectStoreShim', caughtAtMs: null, chaseStartMs: null, steps: [], chasers: {}, errors: [] };
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
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__chase-ai/project.json', saveNamespace: 'chase-ai-record', qaInstrumentation: true }; });
  await page.route('**/__chase-ai/project.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
  await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
  for (let i = 0; i < 40 && await page.locator('[data-testid="cinematic-sequence"]').count(); i++) { await page.keyboard.press('Enter'); await delay(300); }
  await page.evaluate(() => window.__oprnDebug.setSeed(1));
  await delay(2600); // 페이드인·시작 은총 시간(2초)
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
  // 그림 좌표 추적(매 rAF): 이벤트 실행(scene.running)이 켜지는 그 프레임 = 접촉 판정 순간. 앞 40프레임과 함께 남긴다.
  await page.evaluate(({ ids }) => {
    const start = performance.now();
    const ring = [];
    window.__chaseContact = { ring, fired: null, tile: 16 };
    const tick = () => {
      const sc = window.__oprnHooksScene;
      const ps = window.__oprnPlayerSprite?.();
      const cs = window.__oprnCharacterSprites?.();
      if (sc && ps && cs) {
        const tile = sc.map?.tileSize ?? sc.tileSize ?? 16;
        window.__chaseContact.tile = tile;
        const f = { t: Math.round(performance.now() - start), running: !!sc.running,
          player: { x: Math.round(ps.x * 10) / 10, y: Math.round(ps.y * 10) / 10, tileX: sc.tileX, tileY: sc.tileY, moving: !!sc.moving, to: sc.movingTo ? { x: sc.movingTo.x, y: sc.movingTo.y } : null, progress: sc.moveProgress ?? null },
          chasers: ids.map((id) => { const e = cs.events?.[id]; const p = sc.eventPositions?.get?.(id) ?? sc.eventPositions?.[id];
            return e ? { id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, logical: p ? { x: p.x, y: p.y } : null } : { id }; }) };
        ring.push(f); if (ring.length > 40) ring.shift();
        if (f.running && !window.__chaseContact.fired && window.__chaseContact.armed) window.__chaseContact.fired = { at: f, before: ring.slice() };
      }
      if (!window.__chaseContact.fired) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { ids: meta.chasers });
  const deadline = t0 + Number(values.timeout);
  let held = null, phase = 'approach', lastTile = '';
  const hold = async (key) => {
    if (held === key) return;
    if (held) await page.keyboard.up(held);
    held = key;
    if (key) await page.keyboard.down(key);
  };
  // 홀로 들어가 들킬 자리: 픽스처 시작에서 동쪽 통로 끝.
  const lure = meta.lure ?? { x: 13, y: 11 };
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="battle-scene"]').count()) { report.caughtAtMs = Date.now() - t0; break; }
    const s = await page.evaluate((ids) => {
      const st = window.__oprnDebug.readState();
      return { x: st.x, y: st.y, chasers: ids.map((id) => ({ id, ...(st.eventLocations?.[id] ?? {}), active: !!st.horror?.pursuits?.[id]?.active })) };
    }, meta.chasers).catch(() => null);
    if (!s) break;
    const t = Date.now() - t0;
    const tile = `${s.x},${s.y}`;
    for (const c of s.chasers) {
      const list = report.chasers[c.id] ??= [];
      const last = list[list.length - 1];
      if (!last || last.x !== c.x || last.y !== c.y) list.push({ t, x: c.x, y: c.y });
    }
    if (phase === 'approach' && s.chasers.some((c) => c.active)) { phase = 'flee'; report.chaseStartMs = t; await page.evaluate(() => { window.__chaseContact.armed = true; }); }
    if (tile !== lastTile || !held) {
      lastTile = tile;
      report.steps.push({ t, x: s.x, y: s.y, phase });
      let key = null;
      if (phase === 'approach') {
        const d = bfs(lure);
        let best = d.get(tile) ?? 99;
        for (const [k, dx, dy, bit] of DIRS) { if (!can(s.x, s.y, bit)) continue; const v = d.get(`${s.x + dx},${s.y + dy}`); if (v !== undefined && v < best) { best = v; key = k; } }
        if (!key) phase = 'flee';
      }
      if (phase === 'flee') {
        const fields = s.chasers.filter((c) => Number.isFinite(c.x)).map((c) => bfs({ x: c.x, y: c.y }));
        const score = (x, y) => Math.min(...fields.map((f) => f.get(`${x},${y}`) ?? 99));
        let best = score(s.x, s.y) - 0.5;
        for (const [k, dx, dy, bit] of DIRS) {
          if (!can(s.x, s.y, bit) || s.chasers.some((c) => c.x === s.x + dx && c.y === s.y + dy)) continue;
          const v = score(s.x + dx, s.y + dy) + (k === held ? 0.25 : 0);
          if (v > best) { best = v; key = k; }
        }
      }
      await hold(key);
    }
    await delay(30);
  }
  await hold(null);
  report.contact = await page.evaluate(() => {
    const c = window.__chaseContact; if (!c?.fired) return null;
    const gap = (f) => Math.min(...f.chasers.filter((e) => e.x !== undefined).map((e) => Math.hypot(e.x - f.player.x, e.y - f.player.y) / c.tile));
    return { tile: c.tile, firedAtPageMs: c.fired.at.t, gapCellsAtFire: Math.round(gap(c.fired.at) * 100) / 100,
      frames: c.fired.before.map((f) => ({ ...f, gapCells: Math.round(gap(f) * 100) / 100 })) };
  }).catch((e) => ({ error: String(e) }));
  await delay(report.caughtAtMs !== null ? 3200 : 600);
  await finishRecording();
  report.audio = (() => {
    const pcm = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(out, 'chase.mp4'), '-vn', '-ac', '1', '-ar', '12000', '-f', 'f32le', 'pipe:1'], { env, maxBuffer: 32 * 1024 * 1024 });
    let peak = 0, square = 0;
    for (let i = 0; i < pcm.stdout.length; i += 4) { const x = pcm.stdout.readFloatLE(i); peak = Math.max(peak, Math.abs(x)); square += x * x; }
    return { peak, rms: Math.sqrt(square / Math.max(1, pcm.stdout.length / 4)) };
  })();
  command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.5', '-i', join(out, 'chase.mp4'), '-frames:v', '1', join(out, 'first-frame.png')]);
} catch (e) {
  report.errors.push(String(e.stack ?? e));
} finally {
  await finishRecording().catch((e) => report.errors.push(String(e)));
  await context?.close(); await server?.close();
  for (const child of processes.reverse()) child.kill('SIGTERM');
}
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ label: report.label, contactGapCells: report.contact?.gapCellsAtFire ?? null, caughtAtMs: report.caughtAtMs, chaseStartMs: report.chaseStartMs, audio: report.audio, errors: report.errors.map((e) => e.slice(0, 300)) }));
