// Focused shipping-player fixtures. Canonical gameplay is verified by live-first-game-player.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { webUploadedAssetPath } from '../../src/project/webUploadedAssetPath.ts';
const root = resolve('output/qa/opening-production/game-web');
const out = resolve('verify-shots/opening-production/edges'); await mkdir(out, { recursive: true });
const original = JSON.parse(await readFile(root + '/project.json', 'utf8'));
const images = original.system.opening.scenes.filter(s => s.kind === 'image');
const layerIds = [...new Set(images.flatMap(s => s.direction?.layers?.map(l => l.resourceId) ?? []))];
assert(layerIds.length >= 2);
const fixture = structuredClone(original);
fixture.system.titleScreen.effects = []; delete fixture.system.titleScreen.sequence;
const frames = [
  { at: 0, x: 0.3, y: 0.7, scale: 0.5, opacity: 0, rotation: -20 },
  { at: 0.5, x: 0.5, y: 0.5, scale: 1, opacity: 1, rotation: 15 },
  { at: 1, x: 0.7, y: 0.3, scale: 0.8, opacity: 0.9, rotation: 60 },
];
fixture.system.opening = { enabled: true, skippable: true, musicResourceId: original.system.opening.musicResourceId,
  scenes: images.slice(0, 2).map((s, i) => ({ id: 'edge-' + i, kind: 'image', resourceId: s.resourceId,
    narration: '독립 그림 · 저장된 실제 이미지', durationMs: i ? 1400 : 1800, motion: 'none',
    presentation: { preset: 'subtitle', text: { animation: 'fade', revealMs: 100, exitMs: 100 }, transition: { enter: 'cut', enterMs: 0, exitMs: 600 } },
    direction: { layers: [{ resourceId: layerIds[i], width: 0.3, depth: 'foreground', easing: 'linear', frames }] } })) };
const paths = layerIds.map(id => webUploadedAssetPath(fixture.assets.uploaded[id]));
const musicPath = webUploadedAssetPath(fixture.assets.uploaded[fixture.system.opening.musicResourceId]);
const requests = [], result = { mode: 'explicit isolated edge fixtures using real exported artwork/music; not canonical content', cases: [], errors: [] };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local'), path = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!path.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const bytes = url.pathname === '/project.json' ? JSON.stringify(fixture) : await readFile(path);
    requests.push({ path: url.pathname, at: Date.now() });
    res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let lastPage;
const open = async reduce => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); lastPage = page; page.on('pageerror', e => result.errors.push(e.message));
  const wait = page.waitForFunction.bind(page); page.waitForFunction = (fn, arg, opts) => wait(fn, arg, { polling: 50, ...opts });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.addInitScript(() => {
    window.__lateOpeningPlays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) { if (this.dataset.testid === 'cinematic-music') window.__lateOpeningPlays.push(Date.now()); return play.apply(this, args); };
  });
  return { ctx, page };
};
const title = async page => { await page.goto(base + '/player.html', { waitUntil: 'domcontentloaded' }); await page.getByTestId('title-screen').waitFor({ timeout: 120000 }); };
const ready = (page, i) => page.waitForFunction(id => { const r = document.querySelector('[data-testid="cinematic-sequence"]'); return r?.dataset.sceneId === id && r.dataset.mediaState === 'ready' && r.dataset.transitionState === 'playing'; }, 'edge-' + i, { timeout: 30000 });
const layer = page => page.locator('.cinematic-frame:not([data-previous-frame]) .cinematic-layer').evaluate(n => { const s = getComputedStyle(n); return { left: s.left, top: s.top, transform: s.transform, opacity: s.opacity, animations: n.getAnimations().length }; });
const playing = async page => { await page.getByTestId('cinematic-sequence').waitFor({ state: 'hidden', timeout: 30000 }); await page.getByTestId('play-loading-overlay').waitFor({ state: 'hidden', timeout: 45000 }); assert(await page.locator('canvas').count()); };
try {
  {
    const { ctx, page } = await open(false); const begin = requests.length;
    let releaseLayer, releaseEngine; const heldLayer = new Promise(r => { releaseLayer = r; }), heldEngine = new Promise(r => { releaseEngine = r; });
    await page.route('**/*', async route => { const p = new URL(route.request().url()).pathname; if (p.endsWith(paths[1])) await heldLayer; if (p.includes('/assets/phaser.min-')) await heldEngine; await route.continue().catch(() => {}); });
    await title(page); await page.keyboard.press('Enter'); await ready(page, 0);
    const first = await layer(page); await page.waitForTimeout(500); const moving = await layer(page);
    assert.notEqual(first.transform, moving.transform); assert.notEqual(first.top, moving.top);
    await page.waitForFunction(() => { const r = document.querySelector('[data-testid="cinematic-sequence"]'); return r?.dataset.pendingSceneId === 'edge-1' && r.dataset.mediaState === 'loading'; }, null, { timeout: 10000 });
    const frozen = await layer(page); await page.waitForTimeout(400); assert.deepEqual(await layer(page), frozen);
    assert.equal(frozen.animations, 0);
    await page.screenshot({ path: out + '/01-frozen-prior-layer.png' });
    releaseLayer(); await ready(page, 1); const began = Date.now();
    await page.getByTestId('cinematic-sequence').waitFor({ state: 'hidden', timeout: 10000 }); const elapsed = Date.now() - began;
    assert(elapsed >= 1100, 'Delayed artwork must receive its full authored scene clock');
    await page.getByTestId('play-loading-overlay').waitFor();
    const composition = await page.locator('.play-loading-backdrop').evaluate(async image => {
      await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const alpha = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]].map(([x,y]) => ctx.getImageData(x,y,1,1).data[3]);
      const stage = document.querySelector('.play-stage'), bounds = stage.getBoundingClientRect(); return { width: canvas.width, height: canvas.height, stageWidth: Math.round(bounds.width), stageHeight: Math.round(bounds.height), logicalWidth: stage.clientWidth, logicalHeight: stage.clientHeight, alpha, flattened: image.src.startsWith('data:image/png') };
    });
    assert(composition.flattened); assert.equal(composition.width, composition.stageWidth); assert.equal(composition.height, composition.stageHeight); assert.deepEqual(composition.alpha, [255,255,255,255]);
    const musicRequests = requests.slice(begin).filter(r => r.path.endsWith(musicPath)).length; assert.equal(musicRequests, 1);
    const musicHandoff = await page.getByTestId('cinematic-music').evaluate(audio => ({ paused: audio.paused, time: audio.currentTime, volume: audio.volume }));
    assert.equal(musicHandoff.paused, false); assert(musicHandoff.time > 1 && musicHandoff.volume > 0);
    await page.screenshot({ path: out + '/02-final-layer-handoff.png' }); releaseEngine(); await playing(page);
    await page.getByTestId('cinematic-music').waitFor({ state: 'hidden', timeout: 5000 });
    result.cases.push({ name: 'independent-motion/frozen-delay/full-clock/flattened-handoff/audio-cache', passed: true, first, moving, frozen, sceneElapsedMs: elapsed, composition, musicRequests, musicHandoff }); await ctx.close();
  }
  {
    const { ctx, page } = await open(true);
    let release; const held = new Promise(r => { release = r; });
    await page.route('**/*', async route => { const p = new URL(route.request().url()).pathname; if (p.endsWith(paths[1]) || p.endsWith(musicPath) || p.includes('/assets/phaser.min-')) await held; await route.continue().catch(() => {}); });
    await title(page); await page.keyboard.press('Enter'); await ready(page, 0);
    const visible = await layer(page); assert.equal(Number(visible.opacity), 1); assert.equal(visible.animations, 0);
    await page.waitForTimeout(400); assert.deepEqual(await layer(page), visible);
    assert.equal(await page.evaluate(() => Boolean(window.Phaser)), false);
    await page.keyboard.press('Escape'); release(); await playing(page); await page.waitForTimeout(600);
    assert.equal(await page.locator('.cinematic-layer, [data-testid="cinematic-music"]').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__lateOpeningPlays), []);
    await page.screenshot({ path: out + '/03-reduced-skip.png' });
    result.cases.push({ name: 'reduced-motion-visible-frame/skip-delayed-layer-and-music', passed: true, visible, lateMusicPlays: 0 }); await ctx.close();
  }
  {
    const { ctx, page } = await open(false); let missing = true;
    await page.route('**/*', async route => { if (new URL(route.request().url()).pathname.endsWith(paths[1]) && missing) await route.fulfill({ status: 404, body: 'Missing layer' }); else await route.continue(); });
    await title(page); await page.keyboard.press('Enter'); await ready(page, 0);
    await page.waitForFunction(() => document.querySelector('[data-testid="cinematic-sequence"]')?.dataset.mediaState === 'error', null, { timeout: 10000 });
    assert((await page.getByTestId('cinematic-status').innerText()).includes('R')); missing = false;
    await page.keyboard.press('r'); await ready(page, 1); await playing(page);
    result.cases.push({ name: 'missing-independent-layer/retry', passed: true }); await ctx.close();
  }
  assert.deepEqual(result.errors, []); result.passed = result.cases.length === 3;
} catch (e) { result.failure = e.message; result.passed = false; await lastPage?.screenshot({ path: out + '/failure.png', timeout: 5000 }).catch(() => {}); }
finally {
  await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r));
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile(out + '/SUMMARY.md', '# 출하 플레이어 경계 QA\n\n결과: ' + (result.passed ? 'PASS' : 'FAIL') + '\n\n' + result.cases.map(c => '- ' + c.name + ': PASS').join('\n') + '\n\n즉시 확인: 02-final-layer-handoff.png, 03-reduced-skip.png' + (result.passed ? '' : ', failure.png') + '\n\n' + (result.failure ?? '') + '\n');
}
console.log(JSON.stringify(result)); process.exitCode = result.passed ? 0 : 1;
