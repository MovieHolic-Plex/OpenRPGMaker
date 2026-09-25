// Engine QA only: a synthetic two-map project (16px village reference + small 32px Slates meadow)
// driven through the shipped player.html. Records frames of one door transition and the camera /
// character numbers on each side. No authored project writes.
//   MIXED_QA_LABEL=before node scripts/qa/mixed-tile-size-transition.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const label = process.env.MIXED_QA_LABEL ?? 'current';
const out = `verify-shots/mixed-tile-size/${label}`;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const project = JSON.parse(await readFile('verify-shots/tile-size-support/fixture.json', 'utf8'));
const village = JSON.parse(await readFile('src/project/regionReferences/hill-forest-village.json', 'utf8'));
const template = project.maps.geometry16;

// 16px: a real shared village. Residents stay put (schedules removed) so both runs match.
const village16 = {
  ...structuredClone(template), ...village.map, id: 'village16', name: '16px 마을',
  events: village.map.events.map(({ schedule, ...event }) => event),
  encounters: [], bgm: { mode: 'none' },
};
village16.events.push({
  id: 'door16', name: '문', x: 27, y: 19, trigger: { kind: 'action' }, commands: [],
  pages: [{ id: 'door16_p', name: '문', conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' },
    priority: 'same', overlapForbidden: true, movement: { type: 'fixed', speed: 3, frequency: 3 },
    commands: [{ kind: 'transfer', mapId: 'meadow32', x: 10, y: 13, direction: 'up', fade: 'black' }] }],
});
project.tilesets[village.tileset.id] = village.tileset;

// 32px: Slates meadow. Grass 57, dirt 65, pine (cols 8-11) and broadleaf (cols 12-15) trees, 4 wide × 3 tall on rows 13-15 (row 16 is a hedge row).
const W = 22, H = 16;
const lower = Array(W * H).fill(57);
const upper = Array(W * H).fill(-1);
for (let y = 0; y < H; y++) for (const x of [10, 11]) lower[y * W + x] = 65;
for (let x = 0; x < W; x++) for (const y of [6, 7]) lower[y * W + x] = 65;
const tree = (x, y, col) => {
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) upper[(y + j) * W + x + i] = (13 + j) * 56 + col + i;
};
for (const [x, y, col] of [[1, 0, 12], [5, 1, 8], [14, 0, 8], [17, 1, 12], [1, 9, 8], [5, 10, 12], [14, 10, 12], [17, 9, 8]]) tree(x, y, col);
const meadow32 = {
  ...structuredClone(project.maps.geometry32), id: 'meadow32', name: '32px 초원', width: W, height: H,
  tilesetId: 'slates_32', tileSize: 32, lowerTiles: lower, upperTiles: upper, encounters: [], bgm: { mode: 'none' },
  events: [{
    id: 'npc32', name: '주민', x: 12, y: 9, trigger: { kind: 'action' }, commands: [],
    pages: [{ id: 'npc32_p', name: '주민', conditions: [], graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_people4' }, direction: 'down', pattern: 79 },
      trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true, movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [] }],
  }],
};
project.maps = { village16, meadow32 };
project.mapTree = { mapId: 'village16', children: [{ mapId: 'meadow32', children: [] }] };
project.mapConnections = [];
project.startMapId = 'village16';
project.startPos = { x: 27, y: 23 };
project.meta.title = 'Mixed tile size QA';

const report = { label, date: new Date().toISOString(), observations: {}, errors: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'],
});
const context = await browser.newContext({ viewport: { width: 640, height: 480 }, recordVideo: { dir: out, size: { width: 640, height: 480 } } });
const page = await context.newPage();
const videoStart = Date.now();
page.on('pageerror', error => report.errors.push(error.message));
if (process.env.MIXED_QA_CONSOLE) page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 400)));
try {
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/mixed-tile-fixture.json', saveNamespace: 'mixed-tile-qa', qaInstrumentation: true }; });
  await page.route('**/mixed-tile-fixture.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('title-screen').waitFor({ timeout: 120000 });
  await page.keyboard.press('Enter');
  const settled = (mapId, x, y) => page.waitForFunction(({ mapId, x, y }) => {
    const s = window.__oprnHooksScene;
    return s?.session.currentMapId === mapId && s.tileX === x && s.tileY === y && !s.moving;
  }, { mapId, x, y }, { timeout: 60000 });
  const observe = () => page.evaluate(() => {
    const s = window.__oprnHooksScene, c = s.cameras.main, tile = s.map.tileSize ?? 16;
    return {
      map: s.map.id, tileSize: tile, canvas: { width: c.width, height: c.height }, zoom: c.zoom,
      visibleTiles: { x: +(c.width / c.zoom / tile).toFixed(2), y: +(c.height / c.zoom / tile).toFixed(2) },
      player: { scale: s.player.scaleX, frame: [s.player.width, s.player.height], screenPx: [s.player.displayWidth * c.zoom * 320 / c.width, s.player.displayHeight * c.zoom * 320 / c.width] },
      npcs: [...s.eventSprites.values()].slice(0, 3).map(n => n.scaleX),
    };
  });
  // tileX/Y change on arrival and a held key starts the next step in that same frame, so release
  // in the page as soon as the step *toward* the target begins (movingTo), not from Node.
  const walk = async (dir, mapId, x, y) => {
    await page.evaluate(({ dir, x, y }) => new Promise(resolve => {
      window.__oprnInput.dir(dir);
      const tick = () => {
        const s = window.__oprnHooksScene;
        const last = s.moving && s.movingTo?.x === x && s.movingTo?.y === y;
        if (last || (s.tileX === x && s.tileY === y)) { window.__oprnInput.dir(null); resolve(); } else requestAnimationFrame(tick);
      };
      tick();
    }), { dir, x, y });
    await settled(mapId, x, y);
  };
  await settled('village16', 27, 23);
  await page.waitForTimeout(400);
  report.observations.village16 = await observe();

  // The video is the record; the segment marks the walk → door → walk part of it (seconds).
  report.segment = { start: (Date.now() - videoStart) / 1000 };
  await page.screenshot({ path: `${out}/village16.png` });
  await page.waitForTimeout(500);
  await walk('up', 'village16', 27, 20);
  await page.evaluate(() => { window.__oprnInput.face('up'); window.__oprnInput.action(); });
  await settled('meadow32', 10, 13);
  await page.waitForTimeout(700);
  report.observations.meadow32 = await observe();
  await page.screenshot({ path: `${out}/meadow32.png` });
  await walk('up', 'meadow32', 10, 9);
  await page.waitForTimeout(900);
  report.segment.end = (Date.now() - videoStart) / 1000;
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await context.close();
  const video = await page.video()?.path();
  if (video) await rename(video, `${out}/run.webm`);
  await writeFile(`${out}/checks.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(report.observations, null, 2));
console.log(`video ${report.segment?.start}s–${report.segment?.end}s → ${out}/run.webm`);
