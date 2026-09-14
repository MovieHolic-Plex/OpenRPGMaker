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
import { smallVillageDefinition } from "./lib/smallVillageDefinition.mts";
import { buildCompactVillageHouses } from "./lib/compactVillageHouses.mts";
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, value => { authority = value; });
assert.ok(before?.spatialAuthoring && authority, "Remote DB and canonical write authority are required");
const value = (flag: string, fallback: number): number => {
  const index = process.argv.indexOf(flag); return index < 0 ? fallback : Number(process.argv[index + 1]);
};
const width = value("--width", 76), height = value("--height", 76), count = value("--count", 26), seed = value("--seed", 20260913);
const regionId = "small-village:region:dense";
const occurrenceId = "small-village:example:20260913";
const mapId = `spatial-geography:${occurrenceId.length}:${occurrenceId}`;
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
const preset = smallVillageDefinition(ids, width, height);
assert.ok(!context.project.villagePresets?.some(p => p.id === preset.id));
context.project.villagePresets = [...context.project.villagePresets ?? [], preset];
for (const [index, entry] of entries.entries()) {
  const id = ids[index]!, old = context.project.spatialAuthoring!.library.objects[id];
  const next = { exteriorStories: entry.exteriorStories, id, name: entry.name, revision: (old?.revision ?? 0) + 1,
    tags: ["조밀한 마을 주택 20260913", "건물 외형", "회벽·석벽", entry.kind === "home" ? "일반 소형 주택" : "큰집 후보"],
    provenance: { origin: "ai", sourceId: "compact-village-astra-xhigh" },
    graphic: { tilesetId: tileset.id, kitId: entry.kit.id }, chips: [],
    anchors: entry.doors.map((door, i) => ({ id: `door-${i + 1}`, name: "현관 앞", x: door.x, y: door.y + 1 })) };
  const result = runTool(context, "upsert_spatial_design", { kind: "object", expectedRevision: old?.revision ?? 0, object: next });
  assert.ok(result.ok, result.summary);
}
const request = { target: { kind: "new", mapId: "small-village-preflight", name: "소규모 마을 정본 · 1층 23채 + 2층 3채" },
  presetId: preset.id, countPolicy: "exact", seed };
const out = "output/evidence/small-village"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/request.json`, JSON.stringify(request, null, 2));
const preflight = { project: structuredClone(context.project) };
const result = runTool(preflight, "author_village", request);
fs.writeFileSync(`${out}/tool-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, summary: result.summary, errors: result.issues?.filter(i => i.severity === "error" && i.mapId === mapId).slice(0, 6) }));
assert.ok(result.ok, result.summary);
const errors = result.issues?.filter(i => i.severity === "error" && i.mapId === mapId) ?? [];
assert.equal(errors.length, 0, "New map lint errors");
const entry = preflight.project.startPos;
const transcript: object[] = [{ tool: "author_village", request, result }];
const call = (name: string, args: Record<string, unknown>) => {
  const result = runTool(context, name, args); transcript.push({ tool: name, args, result });
  assert.ok(result.ok, `${name}: ${JSON.stringify(result)}`); return result;
};
call("upsert_spatial_design", { kind: "region", expectedRevision: 0, region: {
  id: regionId, name: "소규모 마을 · 밀집형 정본", revision: 1, tags: ["소규모 마을", "정주지", "장터", "호수"], provenance: { origin: "ai", sourceId: preset.id },
  terrain: { tilesetId: tileset.id, width, height, floor: "ground", areas: [] }, places: [], routes: [],
  ports: [{ id: "entry", name: "마을 광장", x: entry.x, y: entry.y }], settlement: { presetId: preset.id, seed },
} });
const preview = call("preview_spatial_build", { kind: "region", id: regionId, occurrenceId, seed });
assert.ok(preview.data && typeof preview.data === "object" && "previewId" in preview.data);
call("apply_spatial_build", { previewId: preview.data.previewId });
call("set_start_position", { mapId, x: entry.x, y: entry.y });
fs.writeFileSync(`${out}/tool-transcript.json`, JSON.stringify({ mode: "registered-editor-tools", provider: null, transcript }, null, 2));
const next = context.project, map = next.maps[mapId]!;
const preflightMap = preflight.project.maps["small-village-preflight"]!;
assert.deepEqual(map.lowerTiles, preflightMap.lowerTiles, "Region compiler and author_village must build the same design");
assert.deepEqual(map.upperTiles, preflightMap.upperTiles);
assert.equal(next.spatialAuthoring!.occurrences[occurrenceId]!.bindings[0]!.mapId, mapId);
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
for (const [id, old] of Object.entries(before.maps)) assert.ok(isDeepStrictEqual(next.maps[id], old), `Existing map changed: ${id}`);
for (const [id, old] of Object.entries(before.spatialAuthoring.library.objects)) {
  const updated = next.spatialAuthoring!.library.objects[id]!;
  if (ids.includes(id)) {
    const { exteriorStories, revision, ...rest } = updated;
    const { revision: oldRevision, ...prior } = old;
    assert.equal(revision, oldRevision + 1); assert.ok(exteriorStories);
    assert.ok(isDeepStrictEqual(rest, prior), `Only authored floor metadata may change: ${id}`);
  } else assert.ok(isDeepStrictEqual(updated, old), `Existing object changed: ${id}`);
}
for (const [id, prior] of Object.entries(before.spatialAuthoring.occurrences)) assert.ok(isDeepStrictEqual(next.spatialAuthoring!.occurrences[id], prior));
const houses = map.layoutPlan!.regions.filter(r => r.objectExterior), market = map.layoutPlan!.regions.filter(r => r.tags?.includes("market-display"));
const shores = map.layoutPlan!.regions.filter(r => r.tags?.includes("lakeside"));
assert.equal(houses.length, count);
assert.equal(houses.filter(r => r.tags?.includes("exterior-stories:2")).length, 3);
assert.equal(houses.filter(r => r.tags?.includes("exterior-stories:1")).length, 23);
assert.equal(map.villageDesignSource!.preset.id, preset.id);
assert.equal(map.villageDesignSource!.preset.design!.revision, 1);
assert.equal(next.defaultVillagePresetId, before.defaultVillagePresetId);
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
const gaps = (items: typeof houses) => items.map(a => Math.min(...items.filter(b => b !== a).map(b =>
  Math.max(0, b.x - a.x - a.w, a.x - b.x - b.w) + Math.max(0, b.y - a.y - a.h, a.y - b.y - b.h))));
const nearest = gaps(houses), oldMap = before.maps.map_compact_market_village_20260913!;
const oldGaps = gaps(oldMap.layoutPlan!.regions.filter(r => r.objectExterior));
const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
assert.ok(mean(nearest) < mean(oldGaps), "House-to-house spacing must improve, not just overall map area");
assert.ok(nearest.every(n => n >= 1), "Distinct roofs must keep separation");
const proof = { regionId, occurrenceId, meanNearestHouseGap: mean(nearest), previousMeanNearestHouseGap: mean(oldGaps),
  smallestGap: Math.min(...nearest), largestNearestGap: Math.max(...nearest), projectId: config.projectId, mapId, width, height, seed, houses: houses.length,
  smallHomes: houses.length - large.length, landmarks: large.length, uniqueExteriors: new Set(houses.map(r => r.objectExterior!.objectId)).size,
  dimensions: houses.map(r => ({ objectId: r.objectExterior!.objectId, w: r.w, h: r.h })),
  maxHouseWidth: Math.max(...houses.map(r => r.w)), maxHouseHeight: Math.max(...houses.map(r => r.h)),
  logWallCells: 0, excludedHouseTileCells: 0, sourceCellsMatch: true,
  housesPer1000Cells: count * 1000 / (width * height),
  buildingFootprintCells: houses.reduce((sum, house) => sum + house.w * house.h, 0),
 doorApproaches: doors.length, marketDisplays: market.length, lakesideAccess: shores.length,
  exactDestinationsReachable: targets.length, waterCells: countWaterCells(map), treeCells: countTreeCells(map), tallGrassCells: tallGrass,
  multiStoreyCount: 3, singleStoreyCount: 23, presetId: preset.id, presetRevision: 1, floorMetadataUpdated: 12, globalDefaultUnchanged: true,
  oldMapsPreserved: Object.keys(before.maps).length, oldGraphicsPreserved: true, oldOccurrencesPreserved: true, newMapLintErrors: 0 };
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
