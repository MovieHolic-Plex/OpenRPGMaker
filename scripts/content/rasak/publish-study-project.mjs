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

// Heuristic passage until per-tile flags are authored: water and walls block, floors pass,
// objects block when they cover most of the cell. Documented in tiledata/rasak-fantasy/README.md.
function passageOf(entry, coverage, entries = [], covers = []) {
  if (!entry || entry.empty) return 'passable';
  if (entry.slot === 'composite')
    return entry.partTiles.some((t) => passageOf(entries[t], covers[t]) === 'solid') ? 'solid' : 'passable';
  if (entry.slot === 'A1') return 'solid';
  if (entry.slot === 'A3' || entry.slot === 'A4') return 'solid';
  if (entry.slot === 'A2' || entry.slot === 'A5' || entry.slot === 'shadow') return 'passable';
  return coverage > 0.5 ? 'solid' : 'passable';
}

function tilesetFor(manifest, atlasBytes, coverage) {
  const assetId = `${manifest.bundle}_image`;
  const cells = manifest.entries.map((e, i) => ({ e, passage: passageOf(e, coverage[i], manifest.entries, coverage) }));
  const asset = { id: assetId, name: manifest.name, kind: 'tileset', dataUrl: 'data:image/png;base64,' + atlasBytes.toString('base64'),
    meta: { tileSize: manifest.tileSize, width: manifest.tilesPerRow * manifest.tileSize, height: Math.ceil(manifest.count / manifest.tilesPerRow) * manifest.tileSize } };
  const isUpper = (e) => !!e && (e.slot === 'composite' ? e.layer === 'upper' : /^[B-E]$|^X\d+$/.test(e.slot));
  const tileset = {
    id: manifest.bundle, name: manifest.name, image: { type: 'uploaded', id: assetId }, kind: 'custom',
    tileSize: manifest.tileSize, tilesPerRow: manifest.tilesPerRow, count: manifest.count,
    passability: cells.map(({ passage }) => { const p = passage === 'passable'; return { up: p, down: p, left: p, right: p }; }),
    priority: cells.map(({ e }) => (isUpper(e) ? 'upper' : 'lower')),
    terrain: cells.map(() => 0),
    animationStrips: manifest.animationStrips,
    tileMeta: cells.map(({ e, passage }, tile) => ({
      label: !e ? `빈칸 ${tile}` : e.slot === 'composite' ? `프리뷰 합성 ${e.layer} ${tile}` : e.slot === 'shadow' ? `MZ 그림자 ${e.bits}` : e.n !== undefined ? `${e.slot} ${e.n}` : `${e.slot} kind ${e.kind} shape ${e.shape}${e.frame ? ` f${e.frame}` : ''}`,
      description: !e ? '' : e.slot === 'composite'
        ? `프리뷰 재현용 합성 칸(OPRN 은 칸당 2층). 구성 atlas ${e.partTiles.join('+')} · MZ ${e.parts.map((p) => p ?? '그림자').join('+')}`
        : `Rasak ${manifest.bundle} · MZ tileId ${e.mzTileId ?? '-'} · 원본 ${manifest.sections.find((s) => s.slot === e.slot)?.file ?? '합성 그림자'}`,
      defaultLayer: isUpper(e) ? 'upper' : 'lower', passage, source: 'imported',
    })),
    tileGroups: [],
  };
  return { asset, tileset };
}

try {
  const { createBlankProject } = await load(path.resolve('src/project/defaults/blankProject.ts'));
  const { initLocalProjectStore, openLocalProjectStore } = await load(path.resolve('electron/local-store/store.ts'));
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
  const project = createBlankProject();
  project.meta.title = 'Rasak Fantasy · 제작자 프리뷰 재현 (로컬 전용)';
  project.tilesets = {};
  project.assets.uploaded = {};
  const maps = {};
  const scores = [];
  for (const b of bundles.bundles) {
    const dir = path.join(bakedDir, b.id);
    // The atlas variant carries the composites its maps reference.
    if (!fs.existsSync(path.join(dir, `manifest.${variant}.json`))) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, `manifest.${variant}.json`), 'utf8'));
    const atlasBytes = fs.readFileSync(path.join(dir, `atlas.${variant}.png`));
    let coverage = manifest.entries.map(() => 0);
    if (PNG) {
      const png = PNG.sync.read(atlasBytes);
      coverage = manifest.entries.map((_, i) => {
        const tx = (i % manifest.tilesPerRow) * 48, ty = Math.floor(i / manifest.tilesPerRow) * 48;
        if (ty + 48 > png.height) return 0;
        let n = 0;
        for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (png.data[((ty + y) * png.width + tx + x) * 4 + 3] > 200) n++;
        return n / 2304;
      });
    }
    const { asset, tileset } = tilesetFor(manifest, atlasBytes, coverage);
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
