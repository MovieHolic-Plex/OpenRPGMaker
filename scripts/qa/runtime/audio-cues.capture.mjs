// Proof (2026-10-31 audio-cues): shipping player.html plays a map BGS loop, message-window text blips,
// an emote sting and a questComplete jingle. Records WebAudio output, measures RMS per phase, logs channels.
// node scripts/qa/runtime/audio-cues.capture.mjs   (one headless browser, one vite QA server; both closed at the end)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname } from 'node:path';
import { runRuntimeQa, resumeRuntimeFrames } from '../../lib/runtimeQaRun.mjs';

// Serve the BUILT export player (npx vite build --config vite.player.config.ts) with public/ as the texture fallback,
// like the QA dev config. Vite dev boot takes >10 min on a loaded host; the built player boots in seconds.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.css': 'text/css', '.wasm': 'application/wasm', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
function startBuiltPlayerServer() {
  const roots = [resolve('dist/export-player'), resolve('public')];
  const srv = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    for (const root of roots) {
      const f = join(root, path);
      if (!f.startsWith(root)) break;
      try { if (statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); return; } } catch {}
    }
    res.writeHead(404); res.end();
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) })));
}

const A = process.env.AUDIO_DIR ?? `${process.env.HOME}/asset-mass/audio2/ogg`;
const evidence = resolve('verify-shots/runtime-qa/audio-cues'); await mkdir(evidence, { recursive: true });
const dataUrl = async (f) => `data:audio/ogg;base64,${(await readFile(join(A, f))).toString('base64')}`;
const project = JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json', 'utf8'));
const up = (id, name, kind, file, meta = {}) => ({ id, name, kind, dataUrl: file, meta });
project.assets.uploaded = {
  ...(project.assets.uploaded ?? {}),
  snd_rain: up('snd_rain', 'rain loop', 'sound', await dataUrl('bgs-rain-light.ogg'), { oprnSound: { version: 1, slots: [], group: 'ambient', loopable: true } }),
  snd_blip: up('snd_blip', 'blip', 'sound', await dataUrl('se-blip-mid-modern.ogg')),
  snd_emote: up('snd_emote', 'emote !', 'sound', await dataUrl('se-emote-surprise-modern.ogg')),
  snd_quest: up('snd_quest', 'quest complete', 'sound', await dataUrl('me-questcomplete-modern.ogg')),
};
project.system.seCues = { textBlip: 'snd_blip', 'emote-exclamation': 'snd_emote', questComplete: 'snd_quest' };
const map = project.maps[project.startMapId];
map.bgs = { mode: 'custom', resourceId: 'snd_rain' };
map.bgm = { mode: 'none' }; // isolate the BGS loop in the RMS phases
project.quests = [{ key: 'qa', title: 'QA', summary: 'QA quest', giver: { create: { name: 'QA' } }, steps: [] }];
const cmds = [
  { kind: 'text', body: 'The rain keeps falling over the harbor. Can you hear my voice?' },
  { kind: 'showEmote', target: 'player', emote: 'exclamation', durationMs: 900 },
  { kind: 'wait', ms: 1200 },
  { kind: 'setSwitch', switchId: 'sw_qa_done', value: true },
];
map.events = [...(map.events ?? []).filter((e) => e.id !== 'qa_audio'), { id: 'qa_audio', ...project.startPos, trigger: { kind: 'action' }, commands: cmds,
  pages: [{ id: 'qa_audio_page', name: 'audio proof', conditions: [], trigger: { kind: 'action' }, graphic: { transparent: true },
    movement: { type: 'fixed', speed: 3, frequency: 3 }, priority: 'below', commands: cmds }] }];
if (!project.switches.some((sw) => sw.id === 'sw_qa_done')) project.switches.push({ id: 'sw_qa_done', name: 'QA quest done' });
const fixture = join(evidence, 'project.json'); await writeFile(fixture, JSON.stringify(project));

const server = await startBuiltPlayerServer();
const resUrls = Object.fromEntries(Object.entries(project.assets.uploaded).filter(([id]) => id.startsWith('snd_')).map(([id, a]) => [id, a.dataUrl]));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
  const context = await browser.newContext({ viewport: { width: 640, height: 480 }, recordVideo: { dir: evidence, size: { width: 640, height: 480 } } });
  const page = await context.newPage();
  await page.addInitScript((u) => { window.__resUrls = u; }, resUrls);
  await page.addInitScript(() => {
    window.__plays = [];
    window.__tagOf = (src) => { for (const [id, url] of Object.entries(window.__resUrls ?? {})) if (src === url || src.endsWith(url.slice(-60))) return id; return null; };
    const t0 = performance.now();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) { window.__plays.push({ t: Math.round(performance.now() - t0), src: (this.src || '').slice(-60), res: window.__tagOf?.(this.src || '') ?? null, loop: this.loop, vol: Math.round(this.volume * 100) / 100, at: window.__cap ? Math.round(window.__cap.ctx.currentTime * 1000) / 1000 : null }); return play.apply(this, a); };
    // One recording graph for every media element the engine plays (it uses <audio>; WebAudio only for panning).
    let cap = null;
    const ensure = () => {
      if (cap) return cap;
      const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination(); const an = ctx.createAnalyser(); an.fftSize = 2048;
      const mix = ctx.createGain(); mix.connect(ctx.destination); mix.connect(dest); mix.connect(an);
      const chunks = []; const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
      rec.ondataavailable = (e) => chunks.push(e.data); rec.start(250);
      const rms = []; const buf = new Float32Array(2048);
      setInterval(() => { an.getFloatTimeDomainData(buf); let q = 0; for (const x of buf) q += x * x; rms.push(Math.round(Math.sqrt(q / buf.length) * 1e5) / 1e5); }, 50);
      cap = window.__cap = { ctx, mix, rec, chunks, rms, seen: new WeakSet() };
      return cap;
    };
    const play0 = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      const c = ensure();
      if (!c.seen.has(this)) { c.seen.add(this); try { this.crossOrigin = 'anonymous'; c.ctx.createMediaElementSource(this).connect(c.mix); } catch (e) { window.__plays.push({ err: String(e) }); } }
      return play0.apply(this, a);
    };
  });
  const report = await runRuntimeQa(page, { id: 'audio-cues', projectFixture: fixture, viewport: { width: 640, height: 480 },
    beats: [{ id: 'title', expect: { testidPresent: ['title-screen'] } },
      { id: 'map', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }], expect: { mapId: project.startMapId }, shot: true }] },
    { serverUrl: server.url, outDir: evidence });
  await resumeRuntimeFrames(page);
  // The engine routes through WebAudio only once a panner/context exists; force the context so the capture sees every channel.
  const mark = async (label) => page.evaluate((l) => { (window.__marks ??= []).push({ l, at: window.__cap ? Math.round(window.__cap.ctx.currentTime * 1000) / 1000 : null }); }, label);
  await page.waitForTimeout(4000); await mark('bgs-only');
  await page.waitForTimeout(2000); await mark('talk');
  await page.evaluate(() => window.__oprnInput.action());
  await page.waitForFunction(() => /harbor|voice/.test(document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? ''), null, { timeout: 120_000, polling: 300 }).catch(() => console.log('no dialogue'));
  await page.waitForFunction(() => /voice\?/.test(document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? ''), null, { timeout: 120_000, polling: 300 }).catch(() => console.log('text not fully typed'));
  await page.waitForTimeout(800); await mark('after-text');
  // close the message: press until the box is gone (a press during the last typed char is swallowed)
  for (let i = 0; i < 20; i++) {
    const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]'));
    if (!open) break;
    await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700);
  }
  await mark('closed');
  // wait on state, not time: the quest switch flips after the emote + 1.2 s wait (slow on a loaded host)
  await page.waitForFunction(() => { const s = window.__oprnDebug.readState(); const v = s.switches?.sw_qa_done ?? s.switches?.find?.((x) => x.id === 'sw_qa_done')?.value; return v === true; }, null, { timeout: 90_000, polling: 500 }).catch(() => console.log('switch did not turn on'));
  await mark('switch');
  await page.waitForTimeout(6000); await mark('end');
  await page.screenshot({ path: join(evidence, 'end.png') });
  const out = await page.evaluate(async () => {
    const c = window.__cap; const bytes = c ? await new Promise((res) => { c.rec.onstop = async () => res(Array.from(new Uint8Array(await new Blob(c.chunks).arrayBuffer()))); c.rec.stop(); }) : [];
    const st = window.__oprnDebug.readState(); return { stAudio: st.audio ?? st.session?.audio ?? null, switchesSample: JSON.stringify(st.switches ?? null).slice(0, 300), plays: window.__plays, marks: window.__marks, rms: c?.rms ?? [], bytes, audio: st.audio ?? null, sw: st.switches?.sw_qa_done ?? st.switches, keys: Object.keys(st).slice(0, 40), sfx: window.__qaSfx ?? null };
  });
  const video = await page.video().path(); await context.close();
  await writeFile(join(evidence, 'audio.webm'), Buffer.from(out.bytes));
  const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', join(evidence, 'audio.webm'), '-c:v', 'libvpx', '-b:v', '600k', '-c:a', 'libopus', '-shortest', join(evidence, 'proof.webm')]);
  if (mux.status) console.log('mux failed', mux.stderr.toString());
  delete out.bytes;
  await writeFile(join(evidence, 'receipt.json'), JSON.stringify({ ...out, errors: report.errors }, null, 1));
  console.log(JSON.stringify({ plays: out.plays, marks: out.marks, sw: out.sw, errors: report.errors, rmsN: out.rms.length }));
} finally { await browser?.close(); await server.close(); }
