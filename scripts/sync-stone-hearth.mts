/** Update reviewed definitions only; --apply saves and reloads the existing inn project. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { deserialize, serialize } from "../src/project/io";
import { interiorObjectById } from "../src/editor/interiorObjectCatalog";
import { bakeInteriorObject } from "../src/editor/harnessSuggestion/structureKitRasterModel";
import { applyEasyRpgThemeMetadataPacks } from "../src/project/tilesetHarness/themePacks";
import { runTool } from "../src/editor/tools/toolRunner";
import { createBlankProject } from "../src/project/defaults";
import { renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";

const out = "output/evidence/stone-hearth";
const config = { ...await configFromEnv(), projectId: "rpg-zzu-inn-exploration-v4" };
const base = await loadProjectFromSupabase(config);
assert.ok(base);
const next = structuredClone(base);
const tileset = next.tilesets.easyrpg_chipset_interior;
assert.ok(tileset);
applyEasyRpgThemeMetadataPacks(tileset);
for (const id of ["kettle", "stairs_horizontal", "stone_hearth_unlit", "stone_hearth_lit"]) {
  const object = interiorObjectById(id);
  assert.ok(object);
  const kit = { ...bakeInteriorObject(object, id, object.label), learnedFrom: "interior-catalog" as const };
  tileset.structureKits = [...(tileset.structureKits ?? []).filter(entry => entry.id !== id), kit];
}
function correctDescriptions(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && ["label","name","description","body","placeLabel"].includes(key)) {
      Reflect.set(value,key,item.replaceAll("주전자","항아리").replaceAll("목제 계단","돌계단"));
    } else correctDescriptions(item);
  }
}
correctDescriptions(tileset.scratchConceptBundles);
for (const map of Object.values(next.maps)) {
  if (map.tilesetId === tileset.id) correctDescriptions(map);
}
const ctx = { project: createBlankProject() };
ctx.project.tilesets[tileset.id] = structuredClone(tileset);
const built = runTool(ctx, "place_concept", {
  query: "화로 검증", mapId: "map_hearth_qa", name: "화로 꺼짐·켜짐 검증", seed: 7,
  plan: {
    places: [{ id: "hall", role: "entrance", size: "l" }],
    things: [
      { id: "cold", objectId: "stone_hearth_unlit", placeIds: ["hall"], chips: ["block","event"], required: true },
      { id: "hot", objectId: "stone_hearth_lit", placeIds: ["hall"], chips: ["block","event"], required: true },
    ],
  },
}, { dryRun: false });
assert.ok(built.ok,built.summary);
assert.deepEqual([...(built.warnings ?? []),...(built.diff?.warnings ?? [])],[]);
const map = ctx.project.maps.map_hearth_qa;
assert.ok(map);
const entry = map.events.find(event => event.id === `ev_entrance_${map.id}`);
assert.ok(entry);
ctx.project.startMapId = map.id;
ctx.project.startPos = { x: entry.x, y: entry.y - 1 };
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/qa-project.json`,serialize(ctx.project));
writePng(renderInteriorMapPng(map,tileset,{scale:6}),`${out}/hearth-states.png`);
const query = runTool({project:next},"get_concept_facility",{query:"inn"});
assert.ok(query.ok);
fs.writeFileSync(`${out}/ai-vocabulary.json`,JSON.stringify(query.data,null,2));
console.log(JSON.stringify({projectId:config.projectId,preview:true,qaMap:map.id}));
if (process.argv.includes("--apply") || process.argv.includes("--verify")) {
  if (process.argv.includes("--apply")) {
    assert.deepEqual(await loadProjectFromSupabase(config),base,"Concurrent edit: no overwrite");
    fs.writeFileSync(`${out}/before.json`,serialize(base));
    const saved = await saveProjectToSupabase(next,config);
    assert.equal(saved.kind,"saved");
  }
  const loaded = await loadProjectFromSupabase(config);
  assert.ok(loaded);
  const loadedTileset = loaded.tilesets[tileset.id];
  assert.ok(loadedTileset);
  for (const id of ["kettle","stairs_horizontal","stone_hearth_unlit","stone_hearth_lit"]) {
    assert.deepEqual(loadedTileset.structureKits?.find(kit=>kit.id===id),tileset.structureKits?.find(kit=>kit.id===id));
  }
  for (const tile of [235,141,111,171,402,403,404,432,433,434,462,463,464]) {
    assert.deepEqual(loadedTileset.tileMeta?.[tile],JSON.parse(JSON.stringify(tileset.tileMeta?.[tile])));
  }
  const before = deserialize(fs.readFileSync(`${out}/before.json`,"utf8"));
  for (const [id,map] of Object.entries(before.maps)) {
    assert.deepEqual(loaded.maps[id]?.lowerTiles,map.lowerTiles);
    assert.deepEqual(loaded.maps[id]?.upperTiles,map.upperTiles);
  }
  assert.deepEqual(Object.keys(loaded.maps),Object.keys(before.maps),"QA fixture must not become authored content");
  const proof = {projectId:config.projectId,saved:true,appReload:true,geometryPreserved:true,qaMapSaved:false,verifiedAt:new Date().toISOString()};
  fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
}
