/** Reproducible editor-tool village, sourced from the saved house catalog. Remote CAS + readback. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase, type ProjectWriteAuthority } from "../src/project/supabaseProjectSync";
import { serialize } from "../src/project/io";
import { runTool } from "../src/editor/tools/toolRunner";
import { countMarketCells, countTreeCells, countWaterCells } from "../src/editor/tools/villageEvaluate";
import { computeReachableCells } from "../src/project/lint/reachability";
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery", "Wrong publication target");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, value => { authority = value; });
assert.ok(before?.spatialAuthoring && authority, "Supabase connection and canonical write authority required");
const value = (flag: string, fallback: number): number => {
  const i = process.argv.indexOf(flag); return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const size = value("--size", 128), seed = value("--seed", 20260912);
const mapId = "map_lakeside_market_village_20260912";
assert.ok(!before.maps[mapId], "This publication creates a new map; a saved village is never silently rebuilt");
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 26, 30];
const ids = numbers.map(number => `house30:object:${number}`);
for (const id of ids) assert.ok(before.spatialAuthoring.library.objects[id], `Save house catalog first: ${id}`);
const request = { target: { kind: "new", mapId, name: "물빛 장터 마을 · 저장된 집 20종", width: size, height: size },
  houseCount: ids.length, houseObjectIds: ids, housePlans: ids.map(objectId => ({ objectId })),
  countPolicy: "exact", theme: "호수와 숲, 중앙 장터가 있는 다채로운 주택 마을", forestDensity: "normal",
  seed, interior: false, npcCount: 0, settlementLayout: "clusters" };
const out = "output/evidence/object-village"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/request.json`, JSON.stringify(request, null, 2));
const context = { project: structuredClone(before) };
const result = runTool(context, "author_village", request);
fs.writeFileSync(`${out}/tool-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, summary: result.summary,
  errors: result.issues?.filter(issue => issue.severity === "error" && issue.mapId === mapId).slice(0, 5), data: result.data }));
assert.ok(result.ok, "Actual registered author_village must succeed; see tool-result.json");
assert.equal(result.issues?.filter(issue => issue.severity === "error" && issue.mapId === mapId).length ?? 0, 0, "New village must have no map lint errors");
const next = context.project;
for (const [id, map] of Object.entries(before.maps)) assert.deepEqual(next.maps[id], map, `Existing map changed: ${id}`);
assert.deepEqual(next.spatialAuthoring, before.spatialAuthoring, "Library and existing occurrences stay unchanged");
assert.deepEqual(next.tilesets, before.tilesets, "Saved house tiles and graphics must not change");
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
const map = next.maps[mapId]!;
const regions = map.layoutPlan!.regions.filter(region => region.role === "house");
assert.equal(regions.length, ids.length);
const approaches = regions.flatMap(region => {
  const id = region.tags!.find(tag => tag.startsWith("object:"))!.slice("object:".length);
  const object = next.spatialAuthoring!.library.objects[id]!;
  const kit = next.tilesets[object.graphic.tilesetId]!.structureKits!.find(kit => kit.id === object.graphic.kitId)!;
  assert.equal(kit.kind, "section"); if (kit.kind !== "section") throw new Error("section required");
  kit.rows.forEach((row, y) => row.tiles.forEach((tile, x) => {
    const at = (region.y + y) * map.width + region.x + x;
    if (tile >= 0) assert.equal(map.lowerTiles[at], tile, `${id} lower ${x},${y}`);
    if ((row.upperTiles?.[x] ?? -1) >= 0) assert.equal(map.upperTiles[at], row.upperTiles![x], `${id} upper ${x},${y}`);
  }));
  return object.anchors.map(port => ({ x: region.x + port.x, y: region.y + port.y }));
});
const reachable = computeReachableCells(next, map, next.startPos.x, next.startPos.y);
const market = map.layoutPlan!.regions.filter(region => region.tags?.includes("market-display"));
const shores = map.layoutPlan!.regions.filter(region => region.tags?.includes("lakeside"));
assert.equal(market.length, 8); assert.equal(shores.length, 1);
for (const point of [...approaches, ...market.map(r => r.front!), ...shores.map(r => r.front!)]) {
  assert.ok(reachable.has(`${point.x},${point.y}`), `Exact destination blocked: ${point.x},${point.y}`);
}
const proof = { projectId: config.projectId, mapId, width: map.width, height: map.height, houses: regions.length,
  uniqueObjects: ids.length, doorApproaches: approaches.length, allDoorsReachable: true, sourceCellsMatch: true,
  marketDisplays: market.length, lakesideAccess: shores.length, allPublicDestinationsReachable: true, newMapLintErrors: 0,
  buildStages: ["houses", "roads", "trees", "decoration"], water: countWaterCells(map), trees: countTreeCells(map), market: countMarketCells(map),
  oldMapsPreserved: true, libraryPreserved: true, tilesetsPreserved: true,
  mapSHA256: createHash("sha256").update(JSON.stringify(map)).digest("hex"), seed, verifiedAt: new Date().toISOString() };
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
if (process.argv.includes("--apply")) {
  fs.writeFileSync(`${out}/before.json`, serialize(before));
  const saved = await saveProjectToSupabase(next, config, authority); assert.equal(saved.kind, "saved");
  const reloaded = await loadProjectFromSupabase(config); assert.deepEqual(reloaded, next, "Full Supabase readback mismatch");
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded!));
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify({ ...proof, saved: true, reloaded: true, mirror: saved.mirror?.status }, null, 2));
  console.log(JSON.stringify({ saved: true, reloaded: true, projectId: config.projectId, mapId }));
}
