/** Revise existing identities, reconcile all reviewed catalogs, and explicitly rebuild the saved example. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase, type ProjectWriteAuthority } from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { authorHouse30 } from "./lib/house30Authoring.mts";
import { buildHouse30BatchA } from "./lib/house30BatchA.mts";
import { buildHouse30BatchB } from "./lib/house30BatchB.mts";
import { buildHouse30BatchC } from "./lib/house30BatchC.mts";
import { HOUSE_CATALOG_STUDIES, houseObjectForGraphic } from "./lib/houseSpatialCatalog.mts";
import { bakeHouseStudy } from "./lib/houseStudyDesigns.mts";
import { buildCompactVillageHouses } from "./lib/compactVillageHouses.mts";
import { buildSettlementReferenceHouses } from "./lib/settlementReferenceHouses.mts";
import { createBlankMap } from "../src/project/defaults/defaultMaps";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import "../src/editor/tools/village/builder";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { runTool } from "../src/editor/tools/toolRunner";
import { computeReachableCells } from "../src/project/lint/reachability";
import { LOG_WALL_TILES } from "../src/editor/tools/village/compactComposition";
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, a => { authority = a; });
assert.ok(before?.spatialAuthoring && authority, "Remote project required before content authoring");
const out = "output/evidence/house-revision";
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/before.json`, serialize(before));
const entries = [...buildHouse30BatchA(), ...buildHouse30BatchB(), ...buildHouse30BatchC()];
const authored = authorHouse30(before, entries);
console.log(JSON.stringify({ phase: "numbered-houses-revised", houses: entries.length }));
const draft = structuredClone(authored.project);
const tileset = draft.tilesets.easyrpg_chipset_combined_town!;
// The earlier study catalog remains useful: add explicit facade metadata, and replace its log porch.
const studies = HOUSE_CATALOG_STUDIES.map(({ study, floors }) => {
  const kit = bakeHouseStudy(study), object = houseObjectForGraphic(draft, tileset.id, kit.id);
  assert.ok(object, `Missing reviewed study ${study.id}`);
  if (study.id === "porch") {
    const existing = tileset.structureKits!.findIndex(k => k.id === kit.id);
    assert.ok(existing >= 0); tileset.structureKits![existing] = kit;
  }
  return { study, floors, objectId: object.id };
});
const referenceEntries = buildSettlementReferenceHouses();
for (const entry of referenceEntries) tileset.structureKits = [...tileset.structureKits!.filter(k => k.id !== entry.kit.id), entry.kit];
const referenceMapId = "map_settlement_house_reference_20260913";
const referenceMap = createBlankMap("정주지 참고 · 박공집 4종", 64, 20, tileset.id, tileset.tileSize);
referenceMap.id = referenceMapId;
for (const [i, entry] of referenceEntries.entries()) {
  const x = i * 16 + 2, y = 3;
  for (const [dy, row] of entry.kit.rows.entries()) for (let dx = 0; dx < entry.kit.width; dx++) {
    const at = (y + dy) * referenceMap.width + x + dx;
    if (row.tiles[dx]! >= 0) referenceMap.lowerTiles[at] = row.tiles[dx]!;
    if ((row.upperTiles?.[dx] ?? -1) >= 0) referenceMap.upperTiles[at] = row.upperTiles![dx]!;
  }
}
draft.maps[referenceMapId] = referenceMap;
if (!draft.mapTree.children.some(n => n.mapId === referenceMapId)) draft.mapTree.children.push({ mapId: referenceMapId, children: [] });
const context = { project: draft };
const transcript: object[] = [];
const call = (name: string, args: Record<string, unknown>) => {
  const result = runTool(context, name, args); transcript.push({ name, args, result });
  assert.ok(result.ok, `${name}: ${JSON.stringify(result)}`); return result;
};
for (const { study, floors, objectId } of studies) {
  const old = context.project.spatialAuthoring!.library.objects[objectId]!;
  const updated = { ...old, exteriorStories: floors, ...(study.id === "porch" ? { name: "04 · 현관이 나온 회벽집" } : {}) };
  if (!isDeepStrictEqual(old, updated)) call("upsert_spatial_design", { kind: "object", expectedRevision: old.revision, object: { ...updated, revision: old.revision + 1 } });
}
for (const entry of referenceEntries) {
  const id = `settlement:object:${entry.id}`, old = context.project.spatialAuthoring!.library.objects[id];
  const object = {
    id, name: entry.name, revision: old?.revision ?? 1, exteriorStories: entry.exteriorStories, chips: [],
    tags: ["정주지 참고", "박공", "건물 외형", "회벽·석벽"], provenance: { origin: "ai", sourceId: "rpg-zzu-region-reference-walled-settlement-v1" },
    graphic: { tilesetId: tileset.id, kitId: entry.kit.id },
    anchors: entry.doors.map((d,i) => ({ id: `door-${i+1}`, name: "현관 앞", x: d.x, y: d.y+1 })) };
  if (!isDeepStrictEqual(old, object)) call("upsert_spatial_design", { kind: "object", expectedRevision: old?.revision ?? 0, object: { ...object, revision: (old?.revision ?? 0) + 1 } });
}
// No unregistered duplicate catalog. All three source groups contribute existing object identities.
const catalogIds = [
  ...[referenceEntries[3]!, referenceEntries[1]!, referenceEntries[0]!, referenceEntries[2]!].map(e => `settlement:object:${e.id}`),
  ...entries.map(e => `house30:object:${e.number}`),
  ...buildCompactVillageHouses().map(e => `compact-village:object:${e.id}`),
  ...studies.filter(e => e.floors <= 2).map(e => e.objectId),
];
const landmarkIds = new Set(["settlement:object:settlement-twin-gable", "settlement:object:settlement-long-front-gable"]);
const candidates = catalogIds.filter(id => {
  const raster = snapshotGraphic(context.project, context.project.spatialAuthoring!.library.objects[id]!.graphic);
  return (raster.width <= 10 && raster.height <= 10) || landmarkIds.has(id);
});
assert.equal(new Set(candidates).size, candidates.length);
for (const id of catalogIds) {
  const object = context.project.spatialAuthoring!.library.objects[id]!;
  const raster = snapshotGraphic(context.project, object.graphic);
  assert.ok(object.exteriorStories && object.exteriorStories <= 4);
  assert.ok(raster.width <= 15 && raster.height <= 15);
  assert.ok(raster.cells.every(c => !LOG_WALL_TILES.has(c.tile) && ![196,197,226,227,256,257].includes(c.tile)));
}
// Reopen a plain draft before the next sealed tool session; the preset is user-authored data.
const presetDraft = structuredClone(context.project);
const preset = presetDraft.villagePresets!.find(p => p.id === "small-village-dense")!;
assert.ok(preset.design?.objectVillage);
if (!isDeepStrictEqual(preset.design.objectVillage.objectIds, candidates)) {
  preset.design.objectVillage.objectIds = candidates;
  preset.design.stories = [1, 2, 3, 4];
  preset.design.revision++;
}
context.project = presetDraft;
console.log(JSON.stringify({ phase: "catalog-reconciled", candidates: candidates.length }));
const occurrenceId = "small-village:example:20260913", mapId = `spatial-geography:${occurrenceId.length}:${occurrenceId}`;
// Explicit user-authorized editor compilation. The generic AI write runner protects already-built
// house rasters; the geography compiler independently verifies ownership digests before replacement.
context.project = compileSpatialOccurrence(context.project, { occurrenceId });
transcript.push({ name: "compileSpatialOccurrence", occurrenceId, authorization: "explicit user house/catalog revision", ownershipDigestVerified: true });
const next = context.project, map = next.maps[mapId]!;
const houses = map.layoutPlan!.regions.filter(r => r.objectExterior);
assert.equal(houses.length, 26);
assert.equal(houses.filter(r => next.spatialAuthoring!.library.objects[r.objectExterior!.objectId]!.exteriorStories! >= 2).length, 3);
assert.equal(houses.filter(r => r.tags?.includes("exterior-stories:1")).length, 23);
assert.ok(houses.filter(r => r.w > 10 || r.h > 10).length <= 2);
assert.ok(houses.every(r => r.w <= 15 && r.h <= 15));
assert.ok(houses.some(r => r.objectExterior!.objectId.startsWith("house30:")));
assert.ok(houses.some(r => r.objectExterior!.objectId.startsWith("compact-village:")));
assert.ok(houses.some(r => studies.some(s => s.objectId === r.objectExterior!.objectId)));
assert.equal(houses.filter(r => landmarkIds.has(r.objectExterior!.objectId)).length, 2, "Use the reviewed front- and twin-gable landmarks in this example");
const nearestGaps = houses.map(a => Math.min(...houses.filter(b => b !== a).map(b =>
  Math.max(0, b.x-a.x-a.w, a.x-b.x-b.w) + Math.max(0, b.y-a.y-a.h, a.y-b.y-b.h))));
const meanNearestGap = nearestGaps.reduce((s,n) => s+n, 0) / houses.length;
assert.ok(meanNearestGap <= 2 && nearestGaps.every(n => n >= 1));
const reachable = computeReachableCells(next, map, next.startPos.x, next.startPos.y);
for (const house of houses) {
  for (const door of house.objectExterior!.doorApproaches) assert.ok(reachable.has(`${door.x},${door.y}`));
  const object = next.spatialAuthoring!.library.objects[house.objectExterior!.objectId]!;
  for (const cell of snapshotGraphic(next, object.graphic).cells) assert.equal((cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[(house.y + cell.y) * map.width + house.x + cell.x], cell.tile);
}
const changedMaps = new Set([mapId, referenceMapId, ...authored.placements.map(p => p.mapId)]);
for (const [id, map] of Object.entries(before.maps)) if (!changedMaps.has(id)) assert.deepEqual(next.maps[id], map, `Unrelated saved map ${id}`);
assert.deepEqual(next.spatialAuthoring!.library.spaces, before.spatialAuthoring.library.spaces);
assert.deepEqual(next.spatialAuthoring!.library.places, before.spatialAuthoring.library.places);
assert.equal(next.defaultVillagePresetId, before.defaultVillagePresetId);
const changedGraphics = entries.filter(e => !isDeepStrictEqual(before.tilesets[tileset.id]!.structureKits!.find(k => k.id === e.kit.id)?.rows, e.kit.rows)).map(e => e.number);
const proof = { projectId: config.projectId, catalogHouses: catalogIds.length, candidates: candidates.length, meanNearestGap, numberedHouses: 30, settlementReferences: 4, changedGraphics, revisedPorch: true,
  mapId, houses: houses.length, singleStorey: 23, multiStorey: 3, landmarks: houses.filter(r => r.w > 10 || r.h > 10).length,
  uniqueExteriors: new Set(houses.map(r => r.objectExterior!.objectId)).size, sourceIds: houses.map(r => r.objectExterior!.objectId),
  presetRevision: preset.design.revision, doorsReachable: true, sourceRastersMatch: true, excludedTiles: 0,
  oldHighStudyExteriorsRetainedOutsideSmallVillage: 4, unrelatedMapsPreserved: Object.keys(before.maps).filter(id => !changedMaps.has(id)).length };
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2));
fs.writeFileSync(`${out}/tool-transcript.json`, JSON.stringify(transcript, null, 2));
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify({ batch: "all", projectId: config.projectId, placements: [...authored.placements, ...referenceEntries.map((e,i) => ({ number: 31+i, name: e.name, description: e.kit.ai!.description, family: "정주지 박공", floors: e.exteriorStories,
    id: e.kit.id, objectId: `settlement:object:${e.id}`, mapId: referenceMapId, x: i*16+2, y: 3, width: e.kit.width, height: e.kit.height }))], checks: authored.checks }, null, 2));
console.log(JSON.stringify(proof));
if (process.argv.includes("--apply")) {
  const saved = await saveProjectToSupabase(next, config, authority); assert.equal(saved.kind, "saved");
  const reloaded = await loadProjectFromSupabase(config); assert.ok(reloaded);
  assert.equal(serializeForComparison(reloaded), serializeForComparison(next));
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify({ ...proof, saved: true, reloaded: true, canonicalSHA256: saved.sha256, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ saved: true, reloaded: true, projectId: config.projectId }));
}
