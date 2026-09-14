/** Rebuild the saved reference field from native tile/quarter recipes, never screenshot pixels. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { configFromEnv } from './supabase-resource-root/supabaseRest.mjs';
import type { ProjectWriteAuthority } from '../src/project/supabaseProjectSync';
import type { GameMap, GameEvent, TilesetDef } from '../src/project/types';
const sourceRoot = process.env.RPG_ZZU_SOURCE_ROOT ?? process.cwd();
const source = (file: string) => pathToFileURL(path.join(sourceRoot, 'src', file)).href;
const { loadProjectFromSupabase, saveProjectToSupabase } = await import(source('project/supabaseProjectSync.ts'));
const { serialize, deserialize, serializeForComparison } = await import(source('project/io.ts'));
const { computeReachableCells } = await import(source('project/lint/reachability.ts'));
const { canMove } = await import(source('project/collision.ts'));
const out = 'output/evidence/emerald-fields';
const config = await configFromEnv();
assert.equal(config.projectId, 'rpg-zzu-house-template-gallery');
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, (value: ProjectWriteAuthority) => authority = value);
assert.ok(before && authority, 'A readable canonical project and write authority are mandatory');
const receipt = deserialize(fs.readFileSync(`${out}/reloaded-project.json`, 'utf8'));
const mapId = 'map_field_twinfalls_20260913';
const forestId = 'map_field_fernwood_20260913';
const bendId = 'map_field_riverbend_20260913';
for (const id of [mapId, forestId, bendId]) assert.deepEqual(before.maps[id], receipt.maps[id], `Edited after receipt: ${id}`);
const tsId = 'tileset_twinfalls_reference_20260914';
const assetId = 'asset_twinfalls_native_quarters_20260914';
if (before.tilesets[tsId]) assert.deepEqual(before.tilesets[tsId], receipt.tilesets[tsId]);
if (before.assets.uploaded[assetId]) assert.deepEqual(before.assets.uploaded[assetId], receipt.assets.uploaded[assetId]);
const next = structuredClone(before);
const layout = JSON.parse(fs.readFileSync('scripts/lib/emeraldFieldReference.json', 'utf8'));
const sourceBytes = fs.readFileSync('public/assets/easyrpg-chipset-world-transparent.png');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(sourceBytes), layout.sourceAtlasSHA256);
const original = PNG.sync.read(sourceBytes);
const waterfallBase = Math.ceil((480 + layout.variants.length) / 30) * 30;
const count = waterfallBase + 30;
const atlas = new PNG({ width: 480, height: count / 30 * 16 });
function copy(sourceTile: number, sx: number, sy: number, targetTile: number, dx: number, dy: number, size: number) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = ((Math.floor(sourceTile / 30) * 16 + sy + y) * original.width + sourceTile % 30 * 16 + sx + x) * 4;
    const b = ((Math.floor(targetTile / 30) * 16 + dy + y) * atlas.width + targetTile % 30 * 16 + dx + x) * 4;
    for (let c = 0; c < 4; c++) atlas.data[b + c] = original.data[a + c];
    if (original.data[a] === 255 && original.data[a + 1] === 103 && original.data[a + 2] === 139) atlas.data[b + 3] = 0;
  }
}
for (let tile = 0; tile < 480; tile++) copy(tile, 0, 0, tile, 0, 0, 16);
for (const variant of layout.variants) {
  assert.equal(variant.sources.length, 4);
  variant.sources.forEach(([tile, x, y]: number[], index: number) => copy(tile, x, y, variant.tile, index % 2 * 8, Math.floor(index / 2) * 8, 8));
}
[123, 153, 183, 213].forEach((tile, frame) => copy(tile, 0, 0, waterfallBase + frame, 0, 0, 16));
const atlasBytes = PNG.sync.write(atlas);
fs.mkdirSync(`${out}/fidelity`, { recursive: true });
fs.writeFileSync(`${out}/fidelity/reference-field-atlas.png`, atlasBytes);
next.assets.uploaded[assetId] = { id: assetId, name: '쌍폭포 원본 타일 · 물가 연결 조각', kind: 'tileset', dataUrl: `data:image/png;base64,${atlasBytes.toString('base64')}`, meta: { tileSize: 16, width: atlas.width, height: atlas.height } };
const water = new Set([0, 30, 60, 90, 120, 150, 180, 210, 123, 153, 183, 213]);
const cliffs = new Set([18, 19, 48, 49, 78, 79, 80, 108, 110, 138, 139, 140, 171, 172, 173, 201, 202, 203, 231, 232]);
const obstacles = new Set([57, 59, 89, 119, 261, 348, 349]);
const tops = new Set([318, 319]);
const variants = new Map<number, number[]>(layout.variants.map((v: { tile: number; sources: number[][] }) => [v.tile, v.sources.map(s => s[0])]));
const blocked = (tile: number) => {
  if (tile >= waterfallBase && tile < waterfallBase + 4) return true;
  if (water.has(tile) || cliffs.has(tile) || obstacles.has(tile)) return true;
  return variants.get(tile)?.some(t => water.has(t) || cliffs.has(t)) ?? false;
};
const ts: TilesetDef = {
  id: tsId, name: '쌍폭포 계곡 · 원본 구도', kind: 'custom', image: { type: 'uploaded', id: assetId }, tileSize: 16, tilesPerRow: 30, count,
  passability: Array.from({ length: count }, (_, tile) => { const pass = !blocked(tile); return { up: pass, down: pass, left: pass, right: pass }; }),
  priority: Array.from({ length: count }, (_, tile) => tops.has(tile) || tile === 117 || tile === 288 ? 'upper' : 'lower'),
  terrain: Array(count).fill(0), autotileGroups: [],
  animationStrips: [{ baseTile: waterfallBase, frames: 4, fps: 4 }, { baseTile: 120, frames: 3, fps: 3 }],
  tileMeta: Array.from({ length: count }, (_, tile) => ({ source: 'user', userLocked: true,
    defaultLayer: tops.has(tile) || tile === 117 || tile === 288 ? 'upper' : 'lower',
    passage: blocked(tile) ? 'solid' : tops.has(tile) || tile === 117 || tile === 288 ? 'star' : 'passable',
    description: tile < 480 ? `World 원본 ${tile}번. 참조 이미지와 같은 위치·방향으로 배치.` : tile < waterfallBase
      ? `World 8×8 원본 조각 조립: ${JSON.stringify(layout.variants.find((v: { tile: number }) => v.tile === tile)?.sources ?? [])}`
      : 'World 폭포 4프레임을 가로로 재배열한 애니메이션.',
  })),
};
next.tilesets[tsId] = ts;
const map: GameMap = {
  ...next.maps[mapId], width: layout.width, height: layout.height, tilesetId: tsId, tileSize: 16,
  lowerTiles: layout.lowerTiles.map((tile: number) => tile === 123 ? waterfallBase : tile),
  upperTiles: [...layout.upperTiles], events: [],
  layoutPlan: { version: 1, kind: 'reference-authored-field', regions: [], notes: '원본 쌍폭포 이미지를 25×20 타일로 복원. 스크린샷 픽셀은 리소스에 포함하지 않으며 World 원본 타일과 8×8 물가 조각만 사용.' },
};
next.maps[mapId] = map;
function exit(id: string, x: number, y: number, target: string, tx: number, ty: number): GameEvent {
  return { id, name: '필드 이동', x, y, trigger: { kind: 'playerTouch' }, commands: [], pages: [{ id: `${id}_page`, name: '필드 이동', conditions: [], graphic: { transparent: true }, trigger: { kind: 'playerTouch' }, priority: 'below', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'transfer', mapId: target, x: tx, y: ty, fade: 'black' }] }] };
}
map.events.push(exit(`${mapId}_west`, 1, 19, forestId, 41, 27), exit(`${mapId}_east`, 24, 15, bendId, 2, 27));
// Change only the destination coordinates in existing neighboring field transfers.
for (const id of [forestId, bendId]) for (const event of next.maps[id].events) for (const page of event.pages ?? []) for (const command of page.commands) {
  if (command.kind === 'transfer' && command.mapId === mapId) {
    command.x = id === forestId ? 2 : 23;
    command.y = id === forestId ? 18 : 15;
  }
}
const normalized = deserialize(serialize(next));
const savedMap = normalized.maps[mapId];
const reachable = computeReachableCells(normalized, savedMap, 2, 18);
for (const [x, y] of [[1, 19], [24, 15], [23, 15], [7, 14], [11, 14]]) assert.ok(reachable.has(`${x},${y}`), `Field route blocked: ${x},${y}`);
assert.equal(canMove(normalized, savedMap, 8, 15, 8, 16), false, 'The bridge must not allow stepping into the river');
for (const [id, old] of Object.entries(before.maps)) if (![mapId, forestId, bendId].includes(id)) assert.deepEqual(normalized.maps[id], old, `Unrelated map changed ${id}`);
for (const id of [forestId, bendId]) {
  assert.deepEqual(normalized.maps[id].lowerTiles, before.maps[id].lowerTiles);
  assert.deepEqual(normalized.maps[id].upperTiles, before.maps[id].upperTiles);
}
assert.equal(normalized.startMapId, before.startMapId); assert.deepEqual(normalized.startPos, before.startPos);
fs.writeFileSync(`${out}/preview-project.json`, serialize(normalized));
const proof = { projectId: config.projectId, mapId, width: map.width, height: map.height, quarterVariants: layout.variants.length, sourceAtlasSHA256: sha(sourceBytes), compiledAtlasSHA256: sha(atlasBytes), referenceSHA256: layout.referenceSHA256, reachableCells: reachable.size, exits: map.events.length, existingMapsPreserved: true, neighboringTerrainPreserved: true, startPositionPreserved: true };
fs.writeFileSync(`${out}/fidelity/author-checks.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
if (process.argv.includes('--apply')) {
  fs.writeFileSync(`${out}/fidelity/before-refinement.json`, serialize(before));
  const saved = await saveProjectToSupabase(normalized, config, authority); assert.equal(saved.kind, 'saved', JSON.stringify(saved));
  const reloaded = await loadProjectFromSupabase(config); assert.ok(reloaded);
  assert.equal(serializeForComparison(reloaded), serializeForComparison(normalized), 'Canonical save/readback differs');
  assert.equal(sha(Buffer.from(reloaded.assets.uploaded[assetId].dataUrl.split(',')[1], 'base64')), sha(atlasBytes));
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify({ ...proof, saved: true, reloaded: true, sha256: saved.sha256 }, null, 2));
  console.log(JSON.stringify({ saved: true, reloaded: true, projectId: config.projectId, mapId }));
}
