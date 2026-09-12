/** Register new compact exteriors, then ask the actual editor tool to place the village. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase, type ProjectWriteAuthority } from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { runTool } from "../src/editor/tools/toolRunner";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { computeReachableCells } from "../src/project/lint/reachability";
import { countTreeCells, countWaterCells } from "../src/editor/tools/villageEvaluate";
import { LOG_WALL_TILES } from "../src/editor/tools/village/compactComposition";
import { buildCompactVillageHouses } from "./lib/compactVillageHouses.mts";
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, value => { authority = value; });
assert.ok(before?.spatialAuthoring && authority, "Remote DB and canonical write authority are required");
const value = (flag: string, fallback: number): number => {
  const index = process.argv.indexOf(flag); return index < 0 ? fallback : Number(process.argv[index + 1]);
};
const width = value("--width", 80), height = value("--height", 80), count = value("--count", 26), seed = value("--seed", 20260913);
const mapId = "map_compact_market_village_20260913";
assert.ok(!before.maps[mapId], "The saved compact village is never silently rebuilt");
const entries = buildCompactVillageHouses();
const context = { project: structuredClone(before) };
const tileset = context.project.tilesets.easyrpg_chipset_combined_town!;
for (const entry of entries) {
  const old = tileset.structureKits?.find(kit => kit.id === entry.kit.id);
  if (old) assert.ok(isDeepStrictEqual(old, entry.kit), "Existing compact graphic differs");
  else tileset.structureKits = [...tileset.structureKits ?? [], entry.kit];
}
// Raw kit preparation ends before the first guarded tool mutation.
const ids = entries.map(entry => `compact-village:object:${entry.id}`);
for (const [index, entry] of entries.entries()) {
  const id = ids[index]!, old = context.project.spatialAuthoring!.library.objects[id];
  const next = { id, name: entry.name, revision: (old?.revision ?? 0) + 1,
    tags: ["조밀한 마을 주택 20260913", "건물 외형", "회벽·석벽", entry.kind === "home" ? "일반 소형 주택" : "큰집 후보"],
    provenance: { origin: "ai", sourceId: "compact-village-astra-xhigh" },
    graphic: { tilesetId: tileset.id, kitId: entry.kit.id }, chips: [],
    anchors: entry.doors.map((door, i) => ({ id: `door-${i + 1}`, name: "현관 앞", x: door.x, y: door.y + 1 })) };
  const result = runTool(context, "upsert_spatial_design", { kind: "object", expectedRevision: old?.revision ?? 0, object: next });
  assert.ok(result.ok, result.summary);
}
const request = { target: { kind: "new", mapId, name: `오밀조밀 장터 마을 · 작은 집 ${count}채`, width, height },
  houseCount: count, houseObjectIds: ids, composition: "compact", countPolicy: "exact",
  theme: "작은 집이 조밀하고 숲과 풀밭, 비대칭 호수와 장터가 있는 마을", forestDensity: "dense", seed,
  interior: false, npcCount: 0, settlementLayout: "clusters" };
const out = "output/evidence/compact-village"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/request.json`, JSON.stringify(request, null, 2));
const result = runTool(context, "author_village", request);
fs.writeFileSync(`${out}/tool-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, summary: result.summary, errors: result.issues?.filter(i => i.severity === "error" && i.mapId === mapId).slice(0, 6) }));
assert.ok(result.ok, result.summary);
const errors = result.issues?.filter(i => i.severity === "error" && i.mapId === mapId) ?? [];
assert.equal(errors.length, 0, "New map lint errors");
const next = context.project, map = next.maps[mapId]!;
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
for (const [id, old] of Object.entries(before.maps)) assert.ok(isDeepStrictEqual(next.maps[id], old), `Existing map changed: ${id}`);
for (const [id, old] of Object.entries(before.spatialAuthoring.library.objects)) assert.ok(isDeepStrictEqual(next.spatialAuthoring!.library.objects[id], old), `Existing object changed: ${id}`);
assert.ok(isDeepStrictEqual(next.spatialAuthoring!.occurrences, before.spatialAuthoring.occurrences));
const houses = map.layoutPlan!.regions.filter(r => r.objectExterior), market = map.layoutPlan!.regions.filter(r => r.tags?.includes("market-display"));
const shores = map.layoutPlan!.regions.filter(r => r.tags?.includes("lakeside"));
assert.equal(houses.length, count);
assert.ok(houses.every(r => r.w <= 15 && r.h <= 15));
const large = houses.filter(r => r.w > 10 || r.h > 10); assert.ok(large.length <= 2);
assert.ok(countWaterCells(map) >= 25, "Requested lake missing");
assert.ok(shores.length >= 1, "Connected lakeside rest area missing");
const excludedHouseTiles = new Set([196, 197, 226, 227, 256, 257]);
for (const region of houses) {
  const object = next.spatialAuthoring!.library.objects[region.objectExterior!.objectId]!;
  const raster = snapshotGraphic(next, object.graphic);
  for (const cell of raster.cells) {
    assert.ok(!LOG_WALL_TILES.has(cell.tile));
    assert.ok(!excludedHouseTiles.has(cell.tile), "Excluded balcony/roof chip in house");
    assert.equal((cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[(region.y + cell.y) * map.width + region.x + cell.x], cell.tile);
  }
}
const doors = houses.flatMap(r => r.objectExterior!.doorApproaches);
const targets = [...doors, ...market.map(r => r.front!), ...shores.map(r => r.front!)];
const reachable = computeReachableCells(next, map, next.startPos.x, next.startPos.y);
assert.ok(targets.every(p => reachable.has(`${p.x},${p.y}`)));
const tallGrassTiles = new Set([243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335]);
const tallGrass = map.lowerTiles.filter(t => tallGrassTiles.has(t)).length;
assert.ok(tallGrass > 100, "Tall-grass patches missing");
assert.ok(countTreeCells(map) / (width * height) > 0.16, "Insufficient tree coverage");
const proof = { projectId: config.projectId, mapId, width, height, seed, houses: houses.length,
  smallHomes: houses.length - large.length, landmarks: large.length, uniqueExteriors: new Set(houses.map(r => r.objectExterior!.objectId)).size,
  dimensions: houses.map(r => ({ objectId: r.objectExterior!.objectId, w: r.w, h: r.h })),
  maxHouseWidth: Math.max(...houses.map(r => r.w)), maxHouseHeight: Math.max(...houses.map(r => r.h)),
  logWallCells: 0, excludedHouseTileCells: 0, sourceCellsMatch: true,
  housesPer1000Cells: count * 1000 / (width * height),
  buildingFootprintCells: houses.reduce((sum, house) => sum + house.w * house.h, 0),
 doorApproaches: doors.length, marketDisplays: market.length, lakesideAccess: shores.length,
  exactDestinationsReachable: targets.length, waterCells: countWaterCells(map), treeCells: countTreeCells(map), tallGrassCells: tallGrass,
  oldMapsPreserved: Object.keys(before.maps).length, oldObjectsPreserved: true, oldOccurrencesPreserved: true, newMapLintErrors: 0 };
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
if (process.argv.includes("--apply")) {
  fs.writeFileSync(`${out}/before.json`, serialize(before));
  const saved = await saveProjectToSupabase(next, config, authority); assert.equal(saved.kind, "saved");
  const reloaded = await loadProjectFromSupabase(config); assert.ok(reloaded);
  assert.equal(serializeForComparison(reloaded), serializeForComparison(next), "Full normalized Supabase readback mismatch");
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify({ ...proof, saved: true, reloaded: true, canonicalSHA256: saved.sha256, mirror: saved.mirror?.status, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ saved: true, reloaded: true, projectId: config.projectId, mapId }));
}
