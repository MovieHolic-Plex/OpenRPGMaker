// Engine QA only: synthetic contract fixtures, no authored content or remote writes.
// TILE_EDITOR_URL=http://127.0.0.1:<worktree-port> node scripts/qa/tile-size-support.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const editorUrl = process.env.TILE_EDITOR_URL;
assert(editorUrl, 'Set TILE_EDITOR_URL to this worktree dev server');
const out = process.env.TILE_QA_OUT ?? 'verify-shots/tile-size-support';
await mkdir(out, { recursive: true });
const report = { date: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), editorUrl, editor: [], runtime: [], errors: [] };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
let server;
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => report.errors.push({ surface: 'editor', message: error.message }));
  // Only the local test server is needed; don't contact production services.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['data:', 'blob:'].includes(url.protocol) || url.origin === new URL(editorUrl).origin ? route.continue() : route.abort();
  });
  await page.goto(`${editorUrl}/?devProject=1&freshProject=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(async () => {
    const { getGame } = await import('/src/app/mode.ts');
    return getGame()?.scene.getScenes(true).some(scene => scene.sys.settings.key === 'EditScene');
  }, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/project/defaults/blankProject.ts');
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const project = createBlankProject();
    const base = project.maps[project.startMapId];
    project.meta.title = '16 / 32 / 48 tile geometry QA';
    project.maps = Object.fromEntries([16, 32, 48].map(size => {
      const id = `geometry${size}`;
      return [id, { ...structuredClone(base), id, name: `${size}×${size} QA`, width: 20, height: 15,
        lowerTiles: Array(300).fill(0), upperTiles: Array(300).fill(-1), events: [], encounters: [], bgm: { mode: 'none' } }];
    }));
    project.startMapId = 'geometry32';
    project.startPos = { x: 2, y: 2 };
    project.mapTree = { mapId: 'geometry32', children: [{ mapId: 'geometry48', children: [] }, { mapId: 'geometry16', children: [] }] };
    store.replaceProject(project);
    editorState.set({ currentMapId: 'geometry32', zoom: 1, layer: 'lower', tool: 'paint', brushSize: 1, paintShape: 'pen', selectedTile: 0, activePaletteStamp: null });
  });
  console.log('Editor ready; importing native PNGs through resource manager');
  for (const size of [16, 32, 48]) {
    const png = await page.evaluate(async size => {
      const { editorState } = await import('/src/editor/editorState.ts');
      const { openResourceModal } = await import('/src/editor/panels/resourceModal.ts');
      editorState.set({ currentMapId: `geometry${size}` });
      openResourceModal('chipset');
      const canvas = document.createElement('canvas');
      canvas.width = size * 3; canvas.height = size * 2;
      const ctx = canvas.getContext('2d');
      ['#467568', '#cb6254', '#e8c36a', '#548ab4', '#8955bb', '#dd963c'].forEach((color, index) => {
        const x = index % 3 * size, y = Math.floor(index / 3) * size;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = '#172e37'; ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
        ctx.fillStyle = '#ffffff'; ctx.font = `${size / 3}px sans-serif`;
        ctx.fillText(`${size}`, x + 2, y + size - 4);
      });
      return canvas.toDataURL().split(',')[1];
    }, size);
    const filename = `${out}/atlas-${size}.png`;
    await writeFile(filename, Buffer.from(png, 'base64'));
    await page.getByTestId('resource-file-input').setInputFiles(filename);
    await page.getByTestId(`chipset-import-${size}`).waitFor();
    if (size === 32) assert.equal(await page.getByTestId('chipset-import-48').count(), 0, 'Partial 48px cells must not be offered');
    await page.screenshot({ path: `${out}/import-${size}.png` });
    await page.getByTestId(`chipset-import-${size}`).click();
    await page.waitForFunction(async size => {
      const { store } = await import('/src/project/store.ts');
      return Object.values(store.getCurrent().assets.uploaded).some(asset => asset.name === `atlas-${size}`);
    }, size);
    const assetId = await page.evaluate(async size => {
      const { store } = await import('/src/project/store.ts');
      return Object.values(store.getCurrent().assets.uploaded).find(asset => asset.name === `atlas-${size}`).id;
    }, size);
    await page.getByTestId(`resource-upload-${assetId}`).click();
    await page.getByRole('button', { name: '🗺️ 현재 맵에 적용', exact: true }).click();
    await page.getByTestId('resource-modal-close').click();
    const imported = await page.evaluate(async ({ size, assetId }) => {
      const { store } = await import('/src/project/store.ts');
      const project = store.getCurrent(), map = project.maps[`geometry${size}`], tileset = project.tilesets[map.tilesetId];
      return { mapSize: map.tileSize, tileSize: tileset.tileSize, columns: tileset.tilesPerRow, count: tileset.count, assetSize: project.assets.uploaded[assetId].meta.tileSize, image: tileset.image };
    }, { size, assetId });
    assert.deepEqual({ ...imported, image: undefined }, { mapSize: size, tileSize: size, columns: 3, count: 6, assetSize: size, image: undefined });
    assert.equal(imported.image.id, assetId);
    await page.evaluate(async size => {
      const { editorState } = await import('/src/editor/editorState.ts');
      editorState.set({ currentMapId: `geometry${size}`, zoom: 1, tool: 'paint', layer: 'lower', selectedTile: 5, activePaletteStamp: null, showGrid: true });
    }, size);
    await page.waitForFunction(async ({ size, assetId }) => {
      const { getGame } = await import('/src/app/mode.ts');
      const game = getGame(), scene = game?.scene.getScenes(true).find(scene => scene.sys.settings.key === 'EditScene');
      return scene?.mapId() === `geometry${size}` && game.textures.exists(`uploaded_tileset:${encodeURIComponent(assetId)}:${size}:3:6`);
    }, { size, assetId });
    const geometryHandle = await page.waitForFunction(async ({ size, assetId }) => {
      const { getGame } = await import('/src/app/mode.ts');
      const game = getGame(), scene = game?.scene.getScenes(true).find(scene => scene.sys.settings.key === 'EditScene');
      const key = `uploaded_tileset:${encodeURIComponent(assetId)}:${size}:3:6`;
      if (!scene || scene.mapId() !== `geometry${size}` || !game.textures.exists(key) || scene.time.now < 1000) return false;
      const canvas = game.canvas.getBoundingClientRect(), camera = scene.cameras.main;
      const frame = game.textures.get(`uploaded_tileset:${encodeURIComponent(assetId)}:${size}:3:6`).get('tile_5');
      return { frame: { width: frame.width, height: frame.height, cutX: frame.cutX, cutY: frame.cutY },
        click: { x: canvas.left + (5.5 * size - camera.worldView.x) * camera.zoom, y: canvas.top + (4.5 * size - camera.worldView.y) * camera.zoom } };
    }, { size, assetId });
    const geometry = await geometryHandle.jsonValue();
    await geometryHandle.dispose();
    assert.deepEqual(geometry.frame, { width: size, height: size, cutX: size * 2, cutY: size });
    await page.mouse.click(geometry.click.x, geometry.click.y);
    async function requirePaint(tile) {
      await page.waitForFunction(async ({ size, tile }) => {
        const { store } = await import('/src/project/store.ts');
        return store.getCurrent().maps[`geometry${size}`].lowerTiles[4 * 20 + 5] === tile;
      }, { size, tile }, { timeout: 10000 });
    }
    await requirePaint(5);
    await page.keyboard.press('Control+z');
    await requirePaint(0);
    await page.keyboard.press('Control+y');
    await requirePaint(5);
    await page.screenshot({ path: `${out}/editor-${size}.png` });
    report.editor.push({ size, imported, geometry, paint: { x: 5, y: 4, tile: 5 }, undoRedo: 'passed' });
    console.log(`Editor ${size}: import, apply, slice, real pointer, undo/redo passed`);
  }
  // Cancellation must leave the project unchanged.
  await page.evaluate(async () => (await import('/src/editor/panels/resourceModal.ts')).openResourceModal('chipset'));
  const countAssets = () => page.evaluate(async () => Object.keys((await import('/src/project/store.ts')).store.getCurrent().assets.uploaded).length);
  const beforeCancel = await countAssets();
  await page.getByTestId('resource-file-input').setInputFiles(`${out}/atlas-48.png`);
  await page.getByTestId('chipset-import-48').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await countAssets(), beforeCancel);
  await page.getByTestId('resource-modal-close').click();
  report.cancelImport = 'passed';

  const wire = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
    const project = structuredClone(store.getCurrent());
    for (const [size, next] of [[32, 48], [48, 16], [16, 32]]) {
      const map = project.maps[`geometry${size}`], tileset = project.tilesets[map.tilesetId];
      tileset.passability[1] = { up: false, down: false, left: false, right: false };
      map.lowerTiles[2 * 20 + 4] = 1;
      map.upperTiles[6 * 20 + 5] = 4;
      map.events = [{ id: `door${size}`, x: 3, y: 3, trigger: { kind: 'action' }, commands: [], pages: [{
        id: `page${size}`, name: 'Size transition', conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' },
        priority: 'same', overlapForbidden: true, movement: { type: 'fixed', speed: 3, frequency: 3 },
        commands: [{ kind: 'transfer', mapId: `geometry${next}`, x: 2, y: 2, fade: 'none' }],
      }] }];
    }
    return serialize(deserialize(serialize(project)));
  });
  await writeFile(`${out}/fixture.json`, wire);
  const saved = JSON.parse(await readFile(`${out}/fixture.json`, 'utf8'));
  for (const size of [16, 32, 48]) {
    const map = saved.maps[`geometry${size}`], tileset = saved.tilesets[map.tilesetId];
    assert.equal(map.tileSize, size); assert.equal(tileset.tileSize, size);
    assert.equal(map.lowerTiles[4 * 20 + 5], 5); assert.equal(tileset.passability[1].right, false);
  }
  report.serializeReload = 'passed';
  await page.close();

  server = await startPlayerQaServer();
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on('pageerror', error => report.errors.push({ surface: 'player', message: error.message }));
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/geometry-fixture.json', saveNamespace: 'tile-size-support-qa', qaInstrumentation: true }; });
  await page.route('**/geometry-fixture.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) }));
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('title-screen').waitFor({ timeout: 120000 });
  await page.keyboard.press('Enter');
  async function position(size, x, y) {
    await page.waitForFunction(({ size, x, y }) => {
      const state = window.__oprnDebug?.readState(), sprite = window.__oprnPlayerSprite?.();
      return state?.currentMapId === `geometry${size}` && state.x === x && state.y === y && !sprite?.moving
        && sprite?.x === (x + .5) * size && sprite?.y === (y + 1) * size;
    }, { size, x, y }, { timeout: 30000 });
    return page.evaluate(() => ({ state: window.__oprnDebug.readState(), sprite: window.__oprnPlayerSprite(), camera: window.__oprnCamera() }));
  }
  for (const [size, next] of [[32, 48], [48, 16], [16, 32]]) {
    const start = await position(size, 2, 2);
    await page.evaluate(() => window.__oprnInput.dir('right'));
    await page.waitForFunction(() => window.__oprnDebug.readState().x === 3);
    await page.evaluate(() => window.__oprnInput.dir(null));
    const step = await position(size, 3, 2);
    assert.equal(step.sprite.x - start.sprite.x, size);
    await page.evaluate(() => window.__oprnInput.dir('right'));
    await page.waitForTimeout(800); // Repeated collision rejection has no movement completion event.
    await page.evaluate(() => window.__oprnInput.dir(null));
    const blocked = await position(size, 3, 2);
    await page.screenshot({ path: `${out}/runtime-${size}.png` });
    await page.evaluate(() => { window.__oprnInput.face('down'); window.__oprnInput.action(); });
    const transfer = await position(next, 2, 2);
    report.runtime.push({ size, start, step, blocked, transferTo: next, transfer });
    console.log(`Player ${size}: ${size}px movement, blocked cell, action transfer to ${next}px passed`);
  }
  assert.deepEqual(report.errors, [], 'No uncaught browser errors');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${out}/checks.json`, JSON.stringify(report, null, 2));
  await writeFile(`${out}/SUMMARY.md`, `# Tile size support QA\n\nStatus: ${report.status}\nDate: ${report.date}\nBase revision: ${report.revision} (working-tree changes included)\n\n${report.editor.map(row => `- ${row.size}px editor: actual PNG import, map application, source frame slicing, pointer paint at (5,4), undo/redo passed.`).join('\n')}\n${report.runtime.map(row => `- ${row.size}px player: one step = ${row.size}px; solid tile blocks movement; action transfer to ${row.transferTo}px passed.`).join('\n')}\n- Serialize → deserialize → disk reload: ${report.serializeReload ?? 'not reached'}.\n- Import cancel: ${report.cancelImport ?? 'not reached'}.\n- Uncaught browser errors: ${report.errors.length}.\n\n즉시 확인: import-48.png, editor-32.png, editor-48.png, runtime-32.png, runtime-48.png.\n\nSynthetic engine contract fixture only; no authored game content or remote persistence. Player runs through player.html/export store shim. This does not claim MV/MZ A1–E autotile format support or exhaustive feature coverage.\n${report.failure ? `\nFailure:\n\n\`\`\`\n${report.failure}\n\`\`\`\n` : ''}`);
  await browser.close();
  await server?.close();
}
