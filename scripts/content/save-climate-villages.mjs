// Save tiledata/climate-villages into its own canonical local project, reopen it and prove the reload is identical.
// The store lives in .oprn-projects/climate-villages-20260923 (outside git); the reloaded export feeds prepare-climate-regions.
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const dir = process.cwd() + "/.oprn-projects/climate-villages-20260923", out = "output/evidence/climate-villages";
const c = JSON.parse(fs.readFileSync("tiledata/climate-villages/catalog.json"));
fs.mkdirSync(out, { recursive: true });
const project = await withTsModule("scripts/content/lib/rpg-places-entry.ts", "climate-villages-save.mjs", async (api) => {
  // The climate tilesets (with their shipped guidance) come from the bundle ensure path of a blank project.
  const p = api.createBlankProject();
  p.maps = structuredClone(c.maps);
  const ids = Object.keys(c.maps);
  p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
  p.startMapId = ids[0];
  const entry = c.plans[0].entry;
  p.startPos = { x: entry[0], y: entry[1] };
  p.meta.title = "기후 마을 · 설원·화산 (정본)";
  return JSON.parse(JSON.stringify(p));
});
for (const ts of ["forest_harmony_snow", "forest_harmony_volcano"])
  assert(project.tilesets[ts]?.referenceDocuments?.some((k) => k.id.startsWith("climate-")), "guidance missing on " + ts);
await withTsModule("electron/local-store/store.ts", "climate-villages-store.mjs", async (api) => {
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
    const proof = { projectId: id, projectDir: ".oprn-projects/climate-villages-20260923", revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps) };
    fs.writeFileSync("tiledata/climate-villages/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(proof);
  } finally { s.close(); }
});
