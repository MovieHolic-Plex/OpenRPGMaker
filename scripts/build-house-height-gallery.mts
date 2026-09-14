/** Author four new 3/4-storey exteriors beside the reviewed 2-storey references. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { serialize } from "../src/project/io";
import { createBlankMap } from "../src/project/defaults/defaultMaps";
import { DEFAULT_TILESET_ID } from "../src/project/defaults/constants";
import { bakeHouseStudy } from "./lib/houseStudyDesigns.mts";
import { HOUSE_HEIGHT_STUDIES, houseHeightFacades } from "./lib/houseHeightStudies.mts";
import { reviewHouseRoofDepth } from "./lib/houseHeightDepthReview.mts";
import type { ProjectWriteAuthority } from "../src/project/spatial/saveRouting";

const out = "output/evidence/house-heights";
fs.mkdirSync(out, { recursive: true });
const config = await configFromEnv();
let authority: ProjectWriteAuthority | undefined;
const base = await loadProjectFromSupabase(config, value => { authority = value; });
assert.ok(base, "Supabase must be available before authoring");
const next = structuredClone(base);
const tileset = next.tilesets[DEFAULT_TILESET_ID]!;
assert.ok(tileset);
const map = createBlankMap("집 층수 연구 · 2층에서 4층까지", 88, 60, tileset.id, tileset.tileSize);
map.id = "map_house_heights_20260912";
assert.ok(!base.maps[map.id] || process.argv.includes("--replace-study"), "Height gallery already exists");
const kits = HOUSE_HEIGHT_STUDIES.map(item => bakeHouseStudy(item.study));
const placements: object[] = [];
const roofIds = new Set([354,355,356,357,374,376,377,384,385,386,387,404,405,406,407,467]);
const excluded = new Set([196,197,226,227,256,257]);
for (const [i, item] of HOUSE_HEIGHT_STUDIES.entries()) {
  const kit = kits[i]!;
  const depthReview=reviewHouseRoofDepth(kit);
  assert.equal(depthReview.visibleFloors,item.floors);
  assert.deepEqual(depthReview.issues,[],`${kit.id}: roof depth review rejected`);
  if (item.floors === 2) assert.deepEqual(kit, tileset.structureKits?.find(entry => entry.id === kit.id), "Reviewed 2-storey reference changed");
  const roofs = new Set<string>();
  kit.rows.forEach((row, y) => row.tiles.forEach((tile, x) => {
    const layers = [tile, row.upperTiles?.[x] ?? -1];
    assert.ok(layers.every(value => !excluded.has(value)), "Excluded material");
    if (layers.some(value => roofIds.has(value))) roofs.add(`${x},${y}`);
  }));
  assert.ok(roofs.size);
  const reached = new Set<string>(), queue = [roofs.values().next().value!];
  while (queue.length) {
    const key = queue.pop()!;
    if (reached.has(key)) continue;
    reached.add(key);
    const [x = 0, y = 0] = key.split(",").map(Number);
    for (const n of [`${x+1},${y}`,`${x-1},${y}`,`${x},${y+1}`,`${x},${y-1}`]) if (roofs.has(n) && !reached.has(n)) queue.push(n);
  }
  assert.equal(reached.size, roofs.size, `${kit.id}: disconnected roof`);
  const facades = houseHeightFacades(item.study);
  assert.equal(facades.length, item.floors);
  // Confirm every upper facade survives later roof passes in the actual baked cells.
  for (const facade of facades.slice(0,-1)) for (let dy = 0; dy < facade.h; dy++) for (let dx = 0; dx < facade.w; dx++) {
    const expected = (dy === 0 ? [15,16,17] : facade.bottomBand && dy===facade.h-1 ? [75,76,77] : [45,46,47])[dx === 0 ? 0 : dx === facade.w-1 ? 2 : 1];
    assert.equal(kit.rows[facade.y+dy]!.tiles[facade.x+dx], expected, `${kit.id}: hidden floor`);
  }
  // Connectivity alone accepted the old flat sheet. Every roof plane must retain
  // both eave corners after upper buildings have occluded its middle.
  const slate=item.family===12;
  for(const facade of facades.slice(1)) {
    const eave=kit.rows[facade.y-1]!;
    assert.equal(eave.upperTiles?.[facade.x],slate?386:384,`${kit.id}: lost left eave corner`);
    assert.equal(eave.upperTiles?.[facade.x+facade.w-1],slate?387:385,`${kit.id}: lost right eave corner`);
  }
  const x = 2 + (i % 3) * 28 + Math.floor((28-kit.width)/2);
  const y = 2 + Math.floor(i/3) * 28 + 23-kit.height;
  placements.push({ id: kit.id, name: `${item.family}번 구조 · ${item.floors}층`, family: item.family, floors: item.floors,
    note: item.study.note, x, y, width: kit.width, height: kit.height });
  kit.rows.forEach((row, dy) => row.tiles.forEach((tile, dx) => {
    const at = (y+dy)*map.width+x+dx;
    if (tile >= 0) map.lowerTiles[at] = tile;
    if ((row.upperTiles?.[dx] ?? -1) >= 0) map.upperTiles[at] = row.upperTiles![dx]!;
  }));
  for (const door of item.study.doors) {
    const at = (y+door.y+1)*map.width+x+door.x;
    assert.equal(map.lowerTiles[at], map.lowerTiles[0]);
    assert.equal(map.upperTiles[at], -1);
  }
}
next.maps[map.id] = map;
if (!next.mapTree.children.some(node => node.mapId === map.id)) next.mapTree.children.push({ mapId: map.id, children: [] });
const newKits = kits.filter((_, i) => HOUSE_HEIGHT_STUDIES[i]!.floors > 2);
tileset.structureKits = [...(tileset.structureKits ?? []).filter(kit => !newKits.some(added => added.id === kit.id)), ...newKits];
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
fs.writeFileSync(`${out}/studies.json`, JSON.stringify({ mapId: map.id, placements }, null, 2));
console.log(JSON.stringify({ projectId: config.projectId, mapId: map.id, newHouses: 4, comparedHouses: 6, mode: "preview" }));
if (process.argv.includes("--apply")) {
  assert.deepEqual(await loadProjectFromSupabase(config), base, "Concurrent edit; refusing to overwrite");
  fs.writeFileSync(`${out}/before.json`, serialize(base));
  const saved = await saveProjectToSupabase(next, config, authority);
  assert.equal(saved.kind, "saved");
  const loaded = await loadProjectFromSupabase(config);
  assert.ok(loaded);
  assert.deepEqual(loaded.maps[map.id], map);
  for (const [id, old] of Object.entries(base.maps)) if (id !== map.id) assert.deepEqual(loaded.maps[id], old);
  for (const kit of kits) assert.deepEqual(loaded.tilesets[tileset.id]!.structureKits?.find(entry => entry.id === kit.id), kit);
  assert.equal(loaded.startMapId, base.startMapId);
  assert.deepEqual(loaded.startPos, base.startPos);
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(loaded));
  const proof = { projectId: config.projectId, mapId: map.id, saved: true, reloaded: true, newHouses: 4, comparedHouses: 6,
    visibleFloors: HOUSE_HEIGHT_STUDIES.map(item => item.floors), connectedRoofs: 6, excludedTileUses: 0, oldMapsPreserved: true,
    roofPlaneCorners:"both sides preserved at every tier", sideSlopeWidth:2,
    mapSha256: createHash("sha256").update(JSON.stringify(loaded.maps[map.id])).digest("hex"), verifiedAt: new Date().toISOString() };
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
