// Focused control for imported store terrain: explicit autotile layer wins over
// pixel-priority metadata, and the same material reaches the intended layer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBlankProject } from '../../src/project/defaults';
import { tileLayerHome } from '../../src/editor/tileLayerClassification';
import { runTool } from '../../src/editor/tools';
import type { TilesetDef } from '../../src/project/types';

const url = 'http://100.73.251.77:18320/api/v1/items/beodeulhang-jangso-bunggoe-hu-hwangpye-p-f78ef830/versions/1/manifest';
const response = await fetch(url); assert(response.ok);
const manifest = JSON.parse(await response.text());
const tileset = structuredClone(Object.values(manifest.content.tilesets)[0]) as TilesetDef;
const trail = tileset.tileGroups!.find((group) => group.name.includes('밟아 다진 흙길'))!;
assert(trail);
const pathTile = trail.tileIds[trail.tileIds.length - 1]!;
const p = createBlankProject();
tileset.id = 'store_layer_control';
p.tilesets[tileset.id] = tileset;
const map = p.maps[p.startMapId]!;
map.tilesetId = tileset.id;
map.width = 24;
map.height = 16;
map.lowerTiles = Array(map.width * map.height).fill(179);
map.upperTiles = Array(map.width * map.height).fill(-1);
const home = tileLayerHome(tileset, pathTile);
assert.equal(home, 'upper', `explicit trail group should route tile ${pathTile} to upper, got ${home}`);
const ctx = { project: p };
const result = runTool(ctx, 'fill_region', {
  mapId: map.id,
  material: trail.name,
  path: [{ x: 3, y: 8 }, { x: 18, y: 8 }],
  width: 2,
  layer: 'upper',
});
assert(result.ok, result.summary);
const after = ctx.project.maps[map.id]!;
assert(after.lowerTiles.every((tile) => tile === 179), 'upper path must preserve lower ground');
assert(after.upperTiles.some((tile) => trail.tileIds.includes(tile)), 'upper path must write trail members');
const receipt = {
  kind: 'store-layer-routing-control',
  source: url,
  checks: ['explicit autotile layer beats imported pixel priority', 'upper fill preserves lower ground', 'path writes trail members'],
  pathTile,
  home,
  changedUpper: after.upperTiles.filter((tile) => trail.tileIds.includes(tile)).length,
  passed: true,
  visualQuality: 'not evaluated',
};
fs.writeFileSync('verify-shots/asset-store/store-layer-routing-controls.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
