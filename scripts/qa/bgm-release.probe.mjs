import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

// Test-only project and real player media proof; never writes authored Supabase content.
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const mode = process.argv[2] ?? 'red';
const production = mode.startsWith('production');
const { chromium, firefox } = await import(`${root}/node_modules/@playwright/test/index.mjs`);
const browserName = process.env.QA_BROWSER ?? 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName), 'QA_BROWSER must be chromium or firefox');
const { startPlayerQaServer, runRuntimeQa } = await import(`${root}/scripts/lib/runtimeQaRun.mjs`);
const evidence = process.env.QA_EVIDENCE_DIR ?? `${root}/output/evidence/bgm-release-pack`;
const out = `${evidence}/browser-${mode}${browserName === 'firefox' ? '-firefox' : ''}`;
await mkdir(out, { recursive: true });
const source = JSON.parse(await readFile(`${root}/test/fixtures/projects/editor-authored-demo-v3.json`, 'utf8'));
const fileName = 'rtp-twn-001-lantern-street_9fdb11f6.mp3';
const id = 'cc0-bgm-rtp-twn-001';
source.meta.title = 'BGM Release pack playback proof';
source.system.defaultBgmResourceId = id;
source.maps[source.startMapId].bgm = { mode: 'custom', resourceId: id };
source.maps[source.startMapId].encounterRate = 0;
source.maps[source.startMapId].events = [];
// Only the tested map/tileset belongs to this audio fixture. Unrelated demo maps
// otherwise preload interior/world textures and can exhaust a busy browser host.
const map = source.maps[source.startMapId];
source.maps = { [source.startMapId]: map };
source.mapTree = { mapId: source.startMapId, children: [] };
source.tilesets = { [map.tilesetId]: source.tilesets[map.tilesetId] };
source.villageInfoDocuments = [];
const fixture = `${out}/project.json`;
await writeFile(fixture, JSON.stringify(source));
const requests = [];
const responses = [];
const failures = [];
let server;
let browser;
let context;
let page;
try {
  if (production) {
    const staticRoot = `${root}/dist`;
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png' };
    const http = createServer(async (req, res) => {
      try {
        const path = new URL(req.url, 'http://localhost').pathname;
        const audio = path.startsWith('/export-player/assets/') && !/\.(js|css)$/.test(path);
        const rel = audio ? path.replace('/export-player/', '/') : path;
        const disk = resolve(staticRoot, `.${decodeURIComponent(rel)}`);
        if (!disk.startsWith(`${staticRoot}/`)) { res.writeHead(403).end(); return; }
        const body = await readFile(disk);
        res.writeHead(200, { 'Content-Type': mime[extname(disk)] ?? 'application/octet-stream', 'Content-Length': body.length });
        res.end(body);
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((ok, fail) => { http.once('error', fail); http.listen(0, '127.0.0.1', ok); });
    server = { port: http.address().port, url: `http://127.0.0.1:${http.address().port}/export-player`, close: () => new Promise(ok => http.close(ok)) };
  } else {
    server = await startPlayerQaServer();
  }
  browser = await (browserName === 'firefox' ? firefox : chromium).launch({
    headless: true,
    ...(browserName === 'chromium' ? { args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] } : {}),
  });
  context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true });
  page = await context.newPage();
  page.on('pageerror', error => failures.push({ kind: 'pageerror', message: error.message }));
  page.on('requestfailed', request => failures.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('console', message => {
    if (message.type() === 'error') failures.push({ kind: 'console', message: message.text() });
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      requests.push({ external: url.origin, path: url.pathname });
    }
  });
  page.on('response', response => {
    if (response.url().includes(fileName)) responses.push({ url: response.url(), status: response.status(), headers: response.headers() });
  });
  await page.addInitScript(({ fileName }) => {
    window.__packAudioProgress = new Promise(resolve => {
      let finished = false;
      let deadline;
      let firstTime;
      const startDeadline = () => { deadline = setTimeout(() => finish({ error: 'no native playback progress' }), 45000); };
      const finish = value => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        document.removeEventListener('timeupdate', onTime, true);
        document.removeEventListener('error', onError, true);
        document.removeEventListener('keydown', startDeadline, true);
        resolve(value);
      };
      const onTime = event => {
        const audio = event.target;
        if (!(audio instanceof HTMLAudioElement) || !audio.src.endsWith(fileName)) return;
        if (event.isTrusted && !audio.paused && audio.currentTime > 0 && audio.volume > 0 && !audio.muted && audio.readyState >= 2) {
          if (audio.error) { finish({ error: `media-error:${audio.error.code}` }); return; }
          if (firstTime === undefined) { firstTime = audio.currentTime; return; }
          if (audio.currentTime <= firstTime) return;
          finish({ src: audio.currentSrc, currentTime: audio.currentTime, volume: audio.volume, muted: audio.muted, paused: audio.paused, readyState: audio.readyState, trusted: event.isTrusted });
        }
      };
      const onError = event => {
        const audio = event.target;
        if (audio instanceof HTMLAudioElement && audio.src.endsWith(fileName)) finish({ error: `media-error:${audio.error?.code}` });
      };
      document.addEventListener('timeupdate', onTime, true);
      document.addEventListener('error', onError, true);
      document.addEventListener('keydown', startDeadline, { capture: true, once: true });
    });
  }, { fileName });
  const sourcePath = `${production ? '/export-player' : ''}/assets/cc0/audio/catalog/${fileName}`;
  const scenario = {
    id: `bgm-release-${mode}`, projectFixture: fixture,
    beats: [
      { id: 'title', expect: { testidPresent: ['title-screen'] } },
      { id: 'non-starter', ops: [{ kind: 'audioAction', action: 'start', resourceId: id, sourcePath, loop: true, timeoutMs: 30000 }],
        expect: { testidAbsent: ['title-screen'], audioObservedIncludes: [id] }, shot: true },
    ],
  };
  const report = await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: `${out}/report` });
  let progress = null;
  if (mode !== 'red') progress = await page.evaluate(() => window.__packAudioProgress);
  const media = await page.locator('audio[data-oprn-audio]').evaluateAll(nodes => nodes.map(a => ({ src: a.src, error: a.error?.code, paused: a.paused, readyState: a.readyState })));
  const proof = { mode, browserName, requests, responses, media, progress, errors: report.errors, beats: report.beats.map(b => ({ id: b.id, failures: b.failures, audio: b.observed?.audio })) };
  await writeFile(`${out}/proof.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
  assert.equal(requests.length, 0, 'no external requests');
  if (mode === 'red') {
    assert.ok(media.some(m => m.src.endsWith(fileName) && m.error), 'RED must be missing audio media failure');
    assert.ok(report.beats.some(b => b.failures.length), 'RED must fail the real audio scenario');
    console.log('RED_CAPTURED: missing non-starter audio prevents native playback');
  } else {
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.beats.flatMap(b => b.failures), []);
    assert.ok(media.some(m => m.src.endsWith(fileName) && !m.error && !m.paused && m.readyState >= 2), 'final media state must be playing without decode errors');
    assert.ok(progress.currentTime > 0 && progress.volume > 0 && !progress.paused && progress.readyState >= 2);
    assert.ok(responses.some(r => r.status === 200 || r.status === 206));
    console.log('GREEN_CAPTURED: local non-starter audio has native playback progress');
  }
} catch (error) {
  let body = '';
  try {
    if (page) {
      body = await page.locator('body').innerText();
      await page.screenshot({ path: `${out}/failure.png` });
    }
  } catch (captureError) {
    failures.push({ kind: 'capture', message: captureError.message });
  }
  await writeFile(`${out}/failure.json`, JSON.stringify({ message: error.message, failures, requests, responses, body }, null, 2));
  throw error;
} finally {
  try {
    if (context) await context.tracing.stop({ path: `${out}/trace.zip` });
  } finally {
    try { await browser?.close(); } finally { await server?.close(); }
  }
  await writeFile(`${out}/cleanup.json`, JSON.stringify({ browserClosed: true, serverClosed: true, port: server?.port }));
  console.log(`QA_CLEANUP: browser and server closed port=${server?.port}`);
}
