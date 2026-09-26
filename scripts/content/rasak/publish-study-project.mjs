// Save Rasak preview reconstructions into a NEW local study project (SQLite canonical store).
// The Rasak pack may not be redistributed: the study folder, baked atlases and maps all
// stay on the user's machine. Nothing here writes into the repository.
//   node scripts/content/rasak/publish-study-project.mjs --baked ~/third-party-assets/rasak/baked \
//     --maps ~/third-party-assets/rasak/maps --project-dir ~/third-party-assets/rasak/study-project
// --layers loads stack_to_layers.py output instead (four layers + shadow, *.layers.map.json).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { atlasCoverage, tilesetFor } from './study-tileset.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const home = (p) => p && p.replace(/^~(?=\/)/, os.homedir());
const bakedDir = home(arg('--baked')), mapsDir = home(arg('--maps')), projectDir = home(arg('--project-dir'));
if (!bakedDir || !mapsDir || !projectDir) throw Error('--baked, --maps and --project-dir are required');
// Folded (fold_layers.py): two layers of scene composites. Layers (stack_to_layers.py): the MZ stack
// split over layers 1-4 + shadowBits, composites only for cells that overflow those slots.
const variant = process.argv.includes('--layers') ? 'layers' : 'folded';
const EXTRA_LAYER_KEYS = ['lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits'];
if (fs.existsSync(path.join(projectDir, 'project.sqlite'))) throw Error('Study store already exists; refuse to overwrite it');

const bundles = JSON.parse(fs.readFileSync('tiledata/rasak-fantasy/bundles.json', 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rasak-publish-'));
async function load(file) {
  const outfile = path.join(temp, path.basename(file) + '.mjs');
  await build({ entryPoints: [file], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', logLevel: 'warning', tsconfig: path.resolve('tsconfig.json') });
  return import(pathToFileURL(outfile).href);
}

try {
  const { createBlankProject } = await load(path.resolve('src/project/defaults/blankProject.ts'));
  const { initLocalProjectStore, openLocalProjectStore } = await load(path.resolve('electron/local-store/store.ts'));
  const project = createBlankProject();
  project.meta.title = 'Rasak Fantasy · 제작자 프리뷰 재현 (로컬 전용)';
  project.tilesets = {};
  project.assets.uploaded = {};
  const maps = {};
  const manifests = {};
  const scores = [];
  for (const b of bundles.bundles) {
    const dir = path.join(bakedDir, b.id);
    // The atlas variant carries the composites its maps reference.
    if (!fs.existsSync(path.join(dir, `manifest.${variant}.json`))) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, `manifest.${variant}.json`), 'utf8'));
    const atlasBytes = fs.readFileSync(path.join(dir, `atlas.${variant}.png`));
    const coverage = atlasCoverage(manifest, atlasBytes);
    const { asset, tileset } = tilesetFor(manifest, atlasBytes, coverage);
    manifests[tileset.id] = manifest;
    project.assets.uploaded[asset.id] = asset;
    project.tilesets[tileset.id] = tileset;
  }
  for (const file of fs.readdirSync(mapsDir).filter((f) => f.endsWith(`.${variant}.map.json`)).sort()) {
    const m = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf8'));
    if (!project.tilesets[m.tilesetId]) continue;
    if (m.lowerTileStacks || m.upperTileStacks) throw Error(`${m.id}: tile stacks are not drawn by OPRN; run fold_layers.py or stack_to_layers.py`);
    maps[m.id] = m;
    const score = path.join(mapsDir, file.replace(`.${variant}.map.json`, '.score.json'));
    if (fs.existsSync(score)) scores.push(JSON.parse(fs.readFileSync(score, 'utf8')));
  }
  if (!Object.keys(maps).length) throw Error('No reconstructed maps found');
  // 4층 통행은 위에서부터 ★ 를 건너뛰고 처음 만난 타일이 정한다. A 시트 장식(휴리스틱상 통과)이 2층에 있으면
  // 막힌 1층(물·벽) 칸을 열어 버린다 — 합성 판은 「구성 중 하나라도 막히면 막힘」이었다. 그래서 2층에 쓰인
  // 통과 A 타일은 ★(우선순위 upper)로 둬 아래층이 칸을 정하게 한다. 1·2층 그리기는 우선순위를 보지 않는다.
  if (variant === 'layers') {
    for (const m of Object.values(maps)) {
      const tileset = project.tilesets[m.tilesetId];
      const entries = manifests[m.tilesetId].entries;
      for (const t of m.lowerOverlayTiles ?? []) {
        if (t < 0 || !/^A[1-5]$/.test(entries[t]?.slot ?? '') || tileset.tileMeta[t].passage !== 'passable') continue;
        if (tileset.priority[t] === 'upper') continue;
        tileset.priority[t] = 'upper';
        tileset.tileMeta[t].description += ' · 2층 장식은 ★ — 아래층이 통행을 정한다';
      }
    }
  }
  const ids = Object.keys(maps);
  project.maps = maps;
  project.startMapId = ids[0];
  project.startPos = { x: Math.floor(maps[ids[0]].width / 2), y: Math.floor(maps[ids[0]].height / 2) };
  project.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
  fs.mkdirSync(projectDir, { recursive: true });
  const store = await initLocalProjectStore({ projectDir });
  const saved = await store.saveProject(project);
  if (saved.kind !== 'saved') throw Error('Study save conflict');
  store.close();
  const reopened = await openLocalProjectStore({ projectDir });
  const reload = reopened.loadSnapshot();
  if (!reload) throw Error('Study reload failed');
  for (const [id, m] of Object.entries(maps)) {
    const r = reload.project.maps[id];
    for (const k of ['lowerTiles', 'upperTiles', ...EXTRA_LAYER_KEYS])
      if (JSON.stringify(r[k] ?? {}) !== JSON.stringify(m[k] ?? {})) throw Error(`Map ${id} ${k} reload mismatch`);
  }
  reopened.close();
  console.log(JSON.stringify({ projectDir, projectId: store.projectId, variant,
    layers: Object.fromEntries(Object.entries(maps).map(([id, m]) => [id, EXTRA_LAYER_KEYS.filter((k) => m[k])])), sha256: saved.sha256, tilesets: Object.keys(project.tilesets), maps: ids, scores }, null, 1));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
