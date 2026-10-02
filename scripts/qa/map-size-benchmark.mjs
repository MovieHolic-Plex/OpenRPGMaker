// Reproduce with: node scripts/qa/map-size-benchmark.mjs
// Synthetic fixtures only; never writes a canonical project or changes the size limit.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cpus, totalmem, loadavg } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const root = resolve(import.meta.dirname, '../..');
const outIndex = process.argv.indexOf('--out');
const out = resolve(root, outIndex >= 0 ? process.argv[outIndex + 1] : `verify-shots/map-size-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const source = JSON.parse(await readFile(resolve(root, 'test/fixtures/projects/editor-authored-demo-v3.json'), 'utf8'));
const sizesIndex = process.argv.indexOf('--sizes');
const sizes = sizesIndex >= 0 ? process.argv[sizesIndex + 1]?.split(',').map(Number) : [256, 512];
assert.ok(sizes?.length === 2 && new Set(sizes).size === 2
  && sizes.every(size => Number.isInteger(size) && size >= 4 && size <= 2048), '--sizes requires two distinct dimensions, 4..2048');
const repetitions = 3;
const framesIndex = process.argv.indexOf('--frames');
const frames = framesIndex >= 0 ? Number(process.argv[framesIndex + 1]) : 180;
assert.ok(Number.isInteger(frames) && frames >= 60 && frames <= 3600, '--frames requires 60..3600');
const supportedDimension = Number((await readFile(resolve(root, 'src/project/mapSizeLimits.ts'), 'utf8'))
  .match(/MAX_TOOL_MAP_DIMENSION\s*=\s*(\d+)/)?.[1]);
assert.ok(supportedDimension > 0);
await mkdir(out, { recursive: true });

function makeMap(size, id) {
  return { id, name: `benchmark ${size}`, width: size, height: size,
    tilesetId: 'easyrpg_chipset_combined_town', tileSize: 16,
    lowerTiles: new Array(size * size).fill(360),
    upperTiles: new Array(size * size).fill(-1), events: [] };
}

function fixture(size) {
  const project = structuredClone(source);
  project.meta.title = 'Map size benchmark';
  project.maps = { base: makeMap(32, 'base'), target: makeMap(size, 'target') };
  project.tilesets = { easyrpg_chipset_combined_town: project.tilesets.easyrpg_chipset_combined_town };
  project.mapConnections = [];
  project.mapTree = { mapId: 'base', children: [{ mapId: 'target', children: [] }] };
  project.startMapId = 'base'; project.startPos = { x: 16, y: 16 };
  project.commonEvents = [];
  project.villageInfoDocuments = [];
  project.flags = {};
  project.system.titleScreen.title = 'Map size benchmark';
  return project;
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: values.length, median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1),
    mean: values.reduce((a, b) => a + b, 0) / values.length };
}

async function sample(page, moving) {
  return await page.evaluate(async ({ count, moving }) => {
    const scene = window.__oprnHooksScene;
    const game = scene.game;
    const before = window.__oprnDebug.readLive();
    let started, last, first;
    const cpu = [], intervals = [];
    const pre = () => { started = performance.now(); };
    window.__oprnInput.dir(moving ? 'right' : null);
    return await new Promise(resolveSample => {
      const post = () => {
        const now = performance.now();
        cpu.push(now - started);
        first ??= now;
        if (last !== undefined) intervals.push(now - last);
        last = now;
        if (cpu.length < count) return;
        clearTimeout(deadline);
        game.events.off('prestep', pre);
        game.events.off('postrender', post);
        window.__oprnInput.dir(null);
        resolveSample({ cpuMs: cpu, intervalsMs: intervals,
          elapsedMs: now - first, before, after: window.__oprnDebug.readLive(), perf: window.__oprnPerf() });
      };
      game.events.on('prestep', pre);
      game.events.on('postrender', post);
      const deadline = setTimeout(() => {
        game.events.off('prestep', pre); game.events.off('postrender', post);
        resolveSample({ error: 'Frame sampling exceeded its deadline', framesObserved: cpu.length });
      }, Math.max(45000, count * 40));
    });
  }, { count: frames, moving });
}

const launchArgs = ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--enable-precise-memory-info'];
const sourceHashes = Object.fromEntries(await Promise.all([
  'src/player/PlayScene.ts', 'src/player/playSceneMapRuntime.ts', 'src/player/runtimeTileWindow.ts',
  'scripts/qa/map-size-benchmark.mjs', 'src/project/mapSizeLimits.ts',
].map(async path => [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')])));
const result = {
  generatedAt: new Date().toISOString(),
  environment: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
    node: process.version, cpu: cpus()[0].model, logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(), loadStart: loadavg(), viewport: { width: 640, height: 480 },
    launchArgs, browser: null, sourceHashes },
  conditions: { sizes, supportedDimension, repetitions, framesPerPhase: frames, tileSize: 16,
    lowerTile: 360, upperTile: -1, events: 0, qaInstrumentation: true,
    path: 'player.html via startPlayerQaServer; export store shim',
    transport: 'Local module/asset HTTP requests fulfilled through Node fetch to avoid shared-host Chromium ERR_NETWORK_CHANGED. Vite development WebSocket receives a connected stub; no HMR is used.',
    note: 'Synthetic fixtures only. No NPC, water, shadows or authored game project. Frame CPU is Phaser prestep→postrender, excludes GPU completion. Heap is CDP used JS heap after forced GC, excludes GPU/native memory.' },
  runs: [],
};
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: launchArgs });
  result.environment.browser = browser.version();
  // Discard warmup before alternating size order to reduce first-run/order bias.
  const order = [{ size: sizes[0], warmup: true },
    ...Array.from({ length: repetitions }, (_, repeat) => (repeat % 2 ? [...sizes].reverse() : sizes)
      .map(size => ({ size, repeat: repeat + 1, warmup: false }))).flat()];
  for (const { size, repeat, warmup } of order) {
    console.log(JSON.stringify({ stage: 'boot', size, repeat, warmup }));
    const context = await browser.newContext({ viewport: result.environment.viewport });
    const page = await context.newPage();
    await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:.*\/?\?token=/, socket => {
      socket.send(JSON.stringify({ type: 'connected' }));
    });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const project = fixture(size);
    const json = JSON.stringify(project);
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.endsWith('/__runtime-qa/project.json')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: json });
        return;
      }
      const response = await fetch(url);
      await route.fulfill({ status: response.status,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        body: Buffer.from(await response.arrayBuffer()) });
    });
    await page.addInitScript(() => {
      localStorage.clear();
      window.__OPENRPG_BOOT__ = { projectUrl: '/__runtime-qa/project.json', saveNamespace: 'map-size-benchmark', qaInstrumentation: true };
    });
    await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    try {
      await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60000 });
    } catch (error) {
      await page.screenshot({ path: resolve(out, 'boot-failure.png') });
      console.log(JSON.stringify({ errors, body: await page.locator('body').innerText() }));
      throw error;
    }
    console.log(JSON.stringify({ stage: 'title', size }));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__oprnDebug && window.__oprnDebug.readLive().currentMapId === 'base', null, { timeout: 120000 });
    console.log(JSON.stringify({ stage: 'base-ready', size }));
    assert.equal((await sample(page, false)).error, undefined);
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    const heapBefore = await cdp.send('Runtime.getHeapUsage');
    const enter = await page.evaluate(async size => {
      const begin = performance.now();
      const firstRendered = new Promise(resolveFrame => window.__oprnHooksScene.game.events.once('postrender', () => resolveFrame(performance.now() - begin)));
      const before = window.__oprnPerf();
      window.__oprnDebug.teleport('target', size / 2, size / 2);
      const syncMs = performance.now() - begin;
      return { syncMs, firstPostrenderMs: await firstRendered, before, after: window.__oprnPerf(), state: window.__oprnDebug.readLive() };
    }, size);
    assert.equal(enter.state.currentMapId, 'target');
    console.log(JSON.stringify({ stage: 'entered', size, syncMs: enter.syncMs }));
    assert.equal((await sample(page, false)).error, undefined); // Discard first-frame upload and initial culling.
    await cdp.send('HeapProfiler.collectGarbage');
    const heapAfter = await cdp.send('Runtime.getHeapUsage');
    const geometry = await page.evaluate(() => {
      const scene = window.__oprnHooksScene;
      let total = 0, visible = 0;
      function walk(object) {
        if (object.list) { for (const child of object.list) walk(child); }
        else { total++; if (object.visible) visible++; }
      }
      walk(scene.tileLayer); walk(scene.upperTileLayer);
      const gl = scene.game.renderer.gl;
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return { tileObjects: total, visibleTileObjects: visible,
        canvas: { width: scene.game.canvas.width, height: scene.game.canvas.height },
        map: { width: scene.map.width, height: scene.map.height },
        renderer: gl ? gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'Canvas' };
    });
    assert.equal(geometry.map.width, size);
    const idle = await sample(page, false);
    const moving = await sample(page, true);
    assert.ok(moving.after.x > moving.before.x, 'Player must actually move');
    assert.equal(moving.perf.tileRebuilds, idle.perf.tileRebuilds, 'No tile rebuild during movement');
    if (!warmup && repeat === 1) await page.screenshot({ path: resolve(out, `${size}-field.png`) });
    const run = { size, repeat, warmup, fixtureBytes: Buffer.byteLength(json), errors,
      enter, heapBefore, heapAfter, heapDeltaBytes: heapAfter.usedSize - heapBefore.usedSize, geometry,
      idle: { ...idle, cpu: summarize(idle.cpuMs), intervals: summarize(idle.intervalsMs), fps: (idle.intervalsMs.length * 1000) / idle.elapsedMs },
      moving: { ...moving, cpu: summarize(moving.cpuMs), intervals: summarize(moving.intervalsMs), fps: (moving.intervalsMs.length * 1000) / moving.elapsedMs } };
    result.runs.push(run);
    await writeFile(resolve(out, 'raw-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ size, repeat, warmup, enterMs: enter.syncMs, heapMiB: run.heapDeltaBytes / 1048576,
      tiles: geometry.tileObjects, visible: geometry.visibleTileObjects, idleCpuMedian: run.idle.cpu.median,
      movingCpuMedian: run.moving.cpu.median, movingFps: run.moving.fps, errors }));
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser?.close(); await server.close();
}
result.environment.loadEnd = loadavg();
result.summary = Object.fromEntries(sizes.map(size => {
  const runs = result.runs.filter(run => !run.warmup && run.size === size);
  return [size, { enterMs: summarize(runs.map(run => run.enter.syncMs)),
    firstPostrenderMs: summarize(runs.map(run => run.enter.firstPostrenderMs)),
    heapDeltaMiB: summarize(runs.map(run => run.heapDeltaBytes / 1048576)),
    retainedHeapMiB: summarize(runs.map(run => run.heapAfter.usedSize / 1048576)),
    tileObjects: runs[0].geometry.tileObjects, visibleTileObjects: runs[0].geometry.visibleTileObjects,
    idleCpuMs: summarize(runs.map(run => run.idle.cpu.median)),
    movingCpuMs: summarize(runs.map(run => run.moving.cpu.median)),
    movingCpuP95Ms: summarize(runs.map(run => run.moving.cpu.p95)),
    movingCpuMaxMs: Math.max(...runs.map(run => run.moving.cpu.max)),
    movingFrameIntervalP95Ms: summarize(runs.map(run => run.moving.intervals.p95)),
    movingFps: summarize(runs.map(run => run.moving.fps)) }];
}));
await writeFile(resolve(out, 'raw-results.json'), JSON.stringify(result, null, 2));
const a = result.summary[sizes[0]], b = result.summary[sizes[1]];
const rows = [['Map-entry synchronous CPU, ms', a.enterMs.median, b.enterMs.median],
  ['Map-entry to first postrender, ms', a.firstPostrenderMs.median, b.firstPostrenderMs.median],
  ['Additional retained JS heap, MiB', a.heapDeltaMiB.median, b.heapDeltaMiB.median],
  ['Total retained JS heap, MiB', a.retainedHeapMiB.median, b.retainedHeapMiB.median],
  ['Tile GameObjects', a.tileObjects, b.tileObjects],
  ['Visible tile GameObjects', a.visibleTileObjects, b.visibleTileObjects],
  ['Idle frame CPU median, ms', a.idleCpuMs.median, b.idleCpuMs.median],
  ['Moving frame CPU median, ms', a.movingCpuMs.median, b.movingCpuMs.median],
  ['Moving frame CPU p95, ms', a.movingCpuP95Ms.median, b.movingCpuP95Ms.median],
  ['Moving frame CPU max, ms', a.movingCpuMaxMs, b.movingCpuMaxMs],
  ['Moving frame interval p95, ms', a.movingFrameIntervalP95Ms.median, b.movingFrameIntervalP95Ms.median],
  ['Moving FPS', a.movingFps.median, b.movingFps.median]];
const markdown = `# Map size benchmark — 2026-10-01\n\n## Conditions\n\n- ${result.environment.browser}, Linux, software WebGL (SwiftShader), viewport 640×480.\n- Actual export player path; QA hooks enabled. One discarded warmup then 3 repetitions per size, alternating order.\n- Static tile 360 everywhere, empty upper layer, no events. Same tile density, camera zoom, player and viewport.\n- Each idle/moving phase contains ${frames} real engine frames. Movement verified; no tile rebuild during movement.\n- Map entry measured inside the browser with performance.now around synchronous transfer (no fade). Texture already loaded on 32×32 base map. Includes base teardown and runtime initialization; excludes network/title boot and first GPU upload.\n- Heap delta: retained JS heap after forced GC, target minus base. Excludes native/GPU memory. CPU duration excludes GPU completion.\n- Supported authoring dimension in this run: ${supportedDimension}. Synthetic fixtures only; no canonical project writes.\n\n## Results\n\nMedians of 3 run statistics; p95 rows aggregate run p95s, CPU max is the maximum across all runs.\n\n| Metric | ${sizes[0]}×${sizes[0]} | ${sizes[1]}×${sizes[1]} | Ratio ${sizes[1]}/${sizes[0]} |\n|---|---:|---:|---:|\n${rows.map(([name, x, y]) => `| ${name} | ${x.toFixed(2)} | ${y.toFixed(2)} | ${(y / x).toFixed(2)}× |`).join('\n')}\n\n## Evidence\n\n- raw-results.json: all runs, every sampled frame, movement coordinates, heap counters, tile counters, environment and source commit.\n- ${sizes[0]}-field.png and ${sizes[1]}-field.png: immediate visual inspection.\n- Reproduce: node scripts/qa/map-size-benchmark.mjs --sizes ${sizes.join(',')} --frames ${frames}\n\n## Limits\n\nA controlled empty field measures size overhead, not the performance of every game. NPCs, layered art, animation, shadows, pathfinding and actual hardware can change the result. No memory-pressure threshold or general-purpose safe maximum was established.\n`;
await writeFile(resolve(out, 'SUMMARY.md'), markdown);
console.log(markdown);
