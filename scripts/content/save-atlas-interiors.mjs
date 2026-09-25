// Save tiledata/atlas-interiors into its own canonical local project, reopen it and prove the reload is identical.
// The store lives in .oprn-projects/atlas-interiors-20260925 (outside git); the reloaded export feeds
// publish-atlas-interiors-library.mjs.
// Usage: node scripts/content/save-atlas-interiors.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const rel = ".oprn-projects/atlas-interiors-20260925", dir = process.cwd() + "/" + rel, out = "output/evidence/atlas-interiors";
const c = JSON.parse(fs.readFileSync("tiledata/atlas-interiors/catalog.json"));
fs.mkdirSync(out, { recursive: true });
const project = await withTsModule("scripts/content/lib/rpg-places-entry.ts", "atlas-interiors-save.mjs", async (api) => {
  const p = api.createBlankProject();
  // The catalog carries the authored Tibo sheet definition (count 2160, rows 69~71); the bundled guidance stays.
  for (const [id, t] of Object.entries(c.tilesets)) { const docs = p.tilesets[id]?.referenceDocuments; p.tilesets[id] = { ...structuredClone(t), ...(docs ? { referenceDocuments: docs } : {}) }; }
  p.maps = structuredClone(c.maps);
  const ids = Object.keys(c.maps);
  p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
  p.startMapId = ids[0];
  const entry = c.plans[0].entry;
  p.startPos = { x: entry[0], y: entry[1] };
  p.meta.title = `atlas 실내 ${ids.length}곳 · 민가·상점·여관·길드·학교·공공시설·공방·성·성소·배·기후 (정본)`;
  return JSON.parse(JSON.stringify(p));
});
assert.equal(project.tilesets.tibo_interior_expanded.count, 2160, "Tibo sheet must carry rows 69~71");
await withTsModule("electron/local-store/store.ts", "atlas-interiors-store.mjs", async (api) => {
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
    fs.writeFileSync("tiledata/atlas-interiors/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log({ ...proof, maps: proof.maps.length });
  } finally { s.close(); }
});
