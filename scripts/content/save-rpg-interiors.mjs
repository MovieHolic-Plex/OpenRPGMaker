// Save tiledata/rpg-interiors into its own canonical local project, reopen it and prove the reload is identical.
// The store lives in .oprn-projects/rpg-interiors-20260924 (outside git); the reloaded export feeds prepare-rpg-interiors-regions.
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const rel = ".oprn-projects/rpg-interiors-20260924", dir = process.cwd() + "/" + rel, out = "output/evidence/rpg-interiors";
const c = JSON.parse(fs.readFileSync("tiledata/rpg-interiors/catalog.json"));
const shipped = JSON.parse(fs.readFileSync("src/assets/sharedRpgInteriorReferences.json"));
fs.mkdirSync(out, { recursive: true });
const project = await withTsModule("scripts/content/lib/rpg-places-entry.ts", "rpg-interiors-save.mjs", async (api) => {
  const p = api.createBlankProject();
  // Catalog tilesets carry the authored grafts/colour key; the shipped guidance comes from the bundle ensure path.
  for (const [id, t] of Object.entries(c.tilesets)) p.tilesets[id] = { ...structuredClone(t), referenceDocuments: p.tilesets[id].referenceDocuments };
  p.maps = structuredClone(c.maps);
  const ids = Object.keys(c.maps);
  p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
  p.startMapId = ids[0];
  const entry = c.plans[0].entry;
  p.startPos = { x: entry[0], y: entry[1] };
  p.meta.title = "RPG 실내 22곳 · 여관·민가·교회·길드·성·배·투기장·카지노 (정본)";
  return JSON.parse(JSON.stringify(p));
});
for (const { tilesetId, category } of shipped)
  assert(project.tilesets[tilesetId].referenceDocuments.some((k) => k.id === category.id), `guidance ${category.id} missing on ${tilesetId}`);
await withTsModule("electron/local-store/store.ts", "rpg-interiors-store.mjs", async (api) => {
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
    const proof = { projectId: id, projectDir: rel, revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps) };
    fs.writeFileSync("tiledata/rpg-interiors/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(proof);
  } finally { s.close(); }
});
