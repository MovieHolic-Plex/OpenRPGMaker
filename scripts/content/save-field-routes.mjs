// Save tiledata/field-routes into its own canonical local project, reopen it and prove the reload is identical.
// The store lives in .oprn-projects/field-routes-20260923 (outside git); the reloaded export feeds prepare-field-routes-regions.
// Forest fields use the diverse forest-village tileset (forest_harmony + grafts 2550~2729); climate fields the bundled climate sheets.
// The same project also carries the outdoor places of tiledata/rpg-outdoors (their world map on the pink-keyed world copy).
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { worldKeyedTileset } from "./lib/rpg-outdoor-world.mjs";

const dir = process.cwd() + "/.oprn-projects/field-routes-20260923", out = "output/evidence/field-routes";
const c = JSON.parse(fs.readFileSync("tiledata/field-routes/catalog.json"));
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const outdoors = JSON.parse(fs.readFileSync("tiledata/rpg-outdoors/catalog.json"));
fs.mkdirSync(out, { recursive: true });
const project = await withTsModule("scripts/content/lib/field-routes-entry.ts", "field-routes-save.mjs", async (api) => {
  const p = api.createBlankProject();
  // The grafted forest-village tileset, carrying the shipped guidance of the bundled forest_harmony.
  p.tilesets.forest_harmony = { ...structuredClone(village.tileset), referenceDocuments: p.tilesets.forest_harmony.referenceDocuments };
  api.ensureBundledTilesets(p);
  const world = worldKeyedTileset(p.tilesets.easyrpg_chipset_world);
  p.tilesets[world.id] = world;
  p.maps = { ...structuredClone(c.maps), ...structuredClone(outdoors.maps) };
  const ids = Object.keys(c.maps);
  p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
  p.startMapId = ids[0];
  const entry = c.plans[0].entry;
  p.startPos = { x: entry[0], y: entry[1] };
  p.meta.title = "마을 사이 필드 · 야외 장소 · 숲·설원·화산·사막·가을·월드맵 (정본)";
  return JSON.parse(JSON.stringify(p));
});
for (const ts of ["forest_harmony", "forest_harmony_snow", "forest_harmony_volcano", "forest_harmony_desert", "forest_harmony_autumn", "easyrpg_chipset_world", "oprn_world_keyed"])
  assert(project.tilesets[ts]?.referenceDocuments?.some((k) => /^(field-routes|rpg-outdoors-world)-/.test(k.id)), "field guidance missing on " + ts);
// (ensureBundledTilesets may append the shared forest_harmony tail past the grafts — forestHarmonyExtension.ts, 2026-09-25)
assert(project.tilesets.forest_harmony.count >= village.tileset.count, "forest fields need the grafted tileset");
await withTsModule("electron/local-store/store.ts", "field-routes-store.mjs", async (api) => {
  let s = await api.initLocalProjectStore({ projectDir: dir }), id;
  try {
    const before = s.loadSnapshot();
    id = s.info().projectId;
    const r = await s.saveSerialized(JSON.stringify(project), before?.sha256 ?? null);
    assert.equal(r.kind, "saved");
  } finally { s.close(); }
  s = await api.openLocalProjectStore({ projectDir: dir });
  try {
    const a = s.loadSnapshot();
    assert(isDeepStrictEqual(JSON.parse(JSON.stringify(a.project)), project), "Reload differs");
    fs.writeFileSync(out + "/reloaded.json", JSON.stringify(a.project));
    const proof = { projectId: id, projectDir: ".oprn-projects/field-routes-20260923", revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps) };
    fs.writeFileSync("tiledata/field-routes/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(proof);
  } finally { s.close(); }
});
