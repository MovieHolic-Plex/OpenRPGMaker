// Export-player pixel differential: resident tiles vs the complete-map render path.
// Synthetic fixtures only. No canonical project changes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { startPlayerQaServer, pauseRuntimeFrames, performObservedFrames } from '../lib/runtimeQaRun.mjs';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'verify-shots/runtime-tile-window-20261001');
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(resolve(root, 'test/fixtures/projects/editor-authored-demo-v3.json'), 'utf8'));
const tilesetId = 'easyrpg_chipset_combined_town';
project.tilesets = { [tilesetId]: project.tilesets[tilesetId] };
// Same native geometry/defaults as createSlates32Tileset, rather than putting
// 16px art in 32px cells (that existing mismatch leaves gaps in both renderers).
const slatesCount = 56 * 22;
project.tilesets.slates_32 = { id: 'slates_32', name: 'Slates 32px QA', kind: 'custom',
  image: { type: 'bundled', id: 'tex_slates_32' }, tileSize: 32, tilesPerRow: 56, count: slatesCount,
  passability: Array.from({ length: slatesCount }, () => ({ up: true, down: true, left: true, right: true })),
  priority: new Array(slatesCount).fill('lower'), terrain: new Array(slatesCount).fill(0),
  tileMeta: Array.from({ length: slatesCount }, () => ({ label: '', description: '', source: 'unknown' })), tileGroups: [] };
// Cover both a root y-sorted solid tree and an always-above decoration.
project.tilesets[tilesetId].passability[290] = { up: false, down: false, left: false, right: false };
project.tilesets[tilesetId].passability[288] = { up: true, down: true, left: true, right: true };
project.tilesets[tilesetId].priority[288] = 'upper';
project.tilesets.slates_32.passability[290] = { up: false, down: false, left: false, right: false };
project.tilesets.slates_32.priority[288] = 'upper';
const npc = structuredClone(project.maps[project.startMapId].events[0]);
npc.id = 'qa-npc'; npc.x = 22; npc.y = 20;
for (const page of npc.pages ?? []) { page.trigger = { kind: 'action' }; page.movement = { type: 'fixed', speed: 3, frequency: 3 }; }
function map(id, tileSize) {
  const size = 64, lowerTiles = [], lowerOverlayTiles = [], upperTiles = [], upperOverlayTiles = [], shadowBits = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    lowerTiles.push(y >= 10 && y <= 15 && x >= 15 && x <= 38 ? 120 : y % 9 === 0 ? 360 : 240);
    lowerOverlayTiles.push(x % 8 === 0 && y % 6 === 0 ? 288 : -1);
    upperTiles.push(y % 7 === 0 && x % 4 === 0 ? 290 : -1);
    upperOverlayTiles.push(y % 11 === 0 && x % 3 === 0 ? 288 : -1);
    shadowBits.push(x % 6 === 0 && y % 5 === 0 ? 15 : 0);
  }
  return { id, name: id, width: size, height: size, tileSize, tilesetId: tileSize === 32 ? 'slates_32' : tilesetId,
    lowerTiles, lowerOverlayTiles, upperTiles, upperOverlayTiles, shadowBits, events: [structuredClone(npc)] };
}
project.maps = { qa16: map('qa16', 16), qa32: map('qa32', 32) };
project.mapTree = { mapId: 'qa16', children: [{ mapId: 'qa32', children: [] }] };
project.mapConnections = []; project.commonEvents = []; project.villageInfoDocuments = [];
project.startMapId = 'qa16'; project.startPos = { x: 20, y: 20 };

const report = { path: 'player.html; export store shim', fixture: '64×64, native Combined Town 16px / Slates 32px, four layers, quarter terrain/water, shadows, NPC, farm and placeable', comparisons: [], errors: [] };
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:.*\/?\?token=/, socket => socket.send(JSON.stringify({ type: 'connected' })));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.endsWith('/__runtime-qa/project.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) });
    const response = await fetch(url);
    await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.addInitScript(() => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = { projectUrl: '/__runtime-qa/project.json', saveNamespace: 'tile-window-qa', qaInstrumentation: true };
  });
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60000 });
  } catch (error) {
    report.bootBody = await page.locator('body').innerText();
    await page.screenshot({ path: resolve(out, 'boot-failure.png') });
    console.log(JSON.stringify({ errors: report.errors, body: report.bootBody }));
    throw error;
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__oprnQaFrames && window.__oprnDebug?.readLive().currentMapId === 'qa16', null, { timeout: 60000 });
  await pauseRuntimeFrames(page);
  await page.evaluate(async () => {
    window.__tileWindowQaRuntime = await import('/src/player/playSceneMapRuntime.ts');
    const scene = window.__oprnHooksScene;
    scene.session.farmPlots = Object.fromEntries(['qa16', 'qa32'].map(id => [id, { '24,20': { tilled: true, watered: true } }]));
    scene.session.placeables = { 'qa-tree': { id: 'qa-tree', kind: 'tree', mapId: 'qa16', x: 26, y: 20 } };
    scene.renderTiles();
  });
  await performObservedFrames(page, { frames: 1, deltaMs: 16 });
  const waterBefore = await page.evaluate(() => {
    const image = window.__oprnHooksScene.tileLayer.list.find(object => object.visible && object.anims?.currentAnim);
    if (!image) throw new Error('No visible animated water');
    image.anims.setProgress(0); image.anims.accumulator = 0; image.anims.resume();
    window.__tileWindowQaWater = image;
    return image.frame.name;
  });
  await performObservedFrames(page, { frames: 4, deltaMs: 100 });
  const waterAfter = await page.evaluate(() => window.__tileWindowQaWater.frame.name);
  assert.notEqual(waterAfter, waterBefore, 'Batch-added resident sprites must tick in Phaser UpdateList');
  report.waterAnimation = { before: waterBefore, after: waterAfter, frames: 4, deltaMs: 100 };
  const freezeWater = () => page.evaluate(() => {
    const scene = window.__oprnHooksScene;
    for (const object of [...scene.tileLayer.list, ...scene.upperTileLayer.list, ...scene.children.list]) {
      if (object.anims?.currentAnim && object !== scene.player && ![...scene.eventSprites.values()].includes(object)) {
        object.anims.setProgress(0.5); object.anims.pause();
      }
    }
  });
  const compare = async id => {
    await performObservedFrames(page, { frames: 1, deltaMs: 16 });
    const state = await page.evaluate(() => {
      const scene = window.__oprnHooksScene, view = scene.cameras.main.worldView, size = scene.map.tileSize;
      const tiles = [...scene.tileLayer.list, ...scene.upperTileLayer.list];
      // Destination must be filled on the very first rendered frame after a jump.
      const terrain = scene.tileLayer.list.filter(object => String(object.frame?.name).startsWith('tile_') && object.depth < 1000);
      const inView = terrain.filter(object => object.x >= view.x && object.x < view.right && object.y >= view.y && object.y < view.bottom);
      return { mapId: scene.map.id, residentObjects: tiles.length, inView: inView.length, view: { x: view.x, y: view.y, width: view.width, height: view.height }, tileSize: size };
    });
    assert.ok(state.inView > 0, `${id}: first destination frame has terrain`);
    // New resident water may be created during that first frame. Freeze after
    // residency settles, then draw the common phase for the pixel comparison.
    await freezeWater();
    await performObservedFrames(page, { frames: 1, deltaMs: 16 });
    const actualBytes = await page.locator('canvas').screenshot({ path: resolve(out, `${id}-resident.png`) });
    await page.evaluate(() => {
      const scene = window.__oprnHooksScene, runtime = window.__tileWindowQaRuntime;
      runtime.invalidateTileLayer(scene);
      const full = Object.create(scene);
      Object.defineProperties(full, { sceneHost: { value: scene }, cameras: { value: undefined } });
      runtime.renderTiles(full);
    });
    await freezeWater();
    await performObservedFrames(page, { frames: 1, deltaMs: 16 });
    const expectedBytes = await page.locator('canvas').screenshot({ path: resolve(out, `${id}-complete.png`) });
    const actual = PNG.sync.read(actualBytes), expected = PNG.sync.read(expectedBytes);
    assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
    let changedPixels = 0;
    for (let i = 0; i < actual.data.length; i += 4) {
      if ([0, 1, 2, 3].some(channel => actual.data[i + channel] !== expected.data[i + channel])) changedPixels++;
    }
    report.comparisons.push({ id, ...state, changedPixels, totalPixels: actual.width * actual.height });
    console.log(JSON.stringify(report.comparisons.at(-1)));
    assert.equal(changedPixels, 0, `${id}: resident and complete rendering differ`);
    await page.evaluate(() => { const scene = window.__oprnHooksScene; window.__tileWindowQaRuntime.invalidateTileLayer(scene); scene.renderTiles(); });
  };
  for (const [id, mapId, x, y] of [['start16', 'qa16', 20, 20], ['front16', 'qa16', 20, 22], ['pan16', 'qa16', 24, 20],
    ['jump16', 'qa16', 48, 48], ['return16', 'qa16', 20, 20], ['transfer32', 'qa32', 20, 20]]) {
    await page.evaluate(({ mapId, x, y }) => window.__oprnDebug.teleport(mapId, x, y), { mapId, x, y });
    await compare(id);
  }
  await page.evaluate(() => window.__oprnHooksScene.cameras.main.setZoom(0.75));
  await compare('zoom32');
  await page.evaluate(() => {
    const scene = window.__oprnHooksScene;
    scene.map.lowerTiles[20 * scene.map.width + 21] = 288;
    scene.renderTiles();
  });
  await compare('changed32');
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(out, 'SUMMARY.md'), `# Runtime tile window QA\n\n- ${report.path}\n- ${report.fixture}\n- Native QA frame stepping, frozen water phase; exact RGBA comparison against complete-map rendering.\n- First destination frame checked for terrain before freezing the comparison phase.\n- Real water animation tick: ${JSON.stringify(report.waterAnimation)}\n\n| Beat | Changed pixels | Resident container objects |\n|---|---:|---:|\n${report.comparisons.map(row => `| ${row.id} | ${row.changedPixels} | ${row.residentObjects} |`).join('\n')}\n\n## 즉시 확인\n\n- start16-resident.png: layered field, water, NPC and farm/placeable.\n- transfer32-resident.png: settled destination at 32px; first frame also checked above.\n\nConsole/page errors: ${JSON.stringify(report.errors)}\n`);
  await browser?.close(); await server.close();
}
