// Save tiledata/atlas-towns into its own canonical local project, reopen it and prove the reload is identical.
// The store lives in .oprn-projects/atlas-towns-20260925 (outside git); the reloaded export feeds the shared-library
// publisher and the object extractor. Forest towns use the full bundled forest_harmony (house parts, treetop and atlas
// town parts), climate towns the bundled climate sheets.
// Usage: node scripts/content/save-atlas-towns.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const dir = process.cwd() + "/.oprn-projects/atlas-towns-20260925", out = "output/evidence/atlas-towns";
const c = JSON.parse(fs.readFileSync("tiledata/atlas-towns/catalog.json"));
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
fs.mkdirSync(out, { recursive: true });
const project = await withTsModule("scripts/content/lib/atlas-towns-entry.ts", "atlas-towns-save.mjs", async (api) => {
  const p = api.createBlankProject();
  p.tilesets.forest_harmony = { ...structuredClone(village.tileset), referenceDocuments: p.tilesets.forest_harmony.referenceDocuments };
  api.ensureBundledTilesets(p);
  p.maps = structuredClone(c.maps);
  const ids = c.plans.map((q) => q.id);
  // Map tree: one folder-like root per category (the first map of each category), the rest under it.
  const byCat = new Map();
  for (const q of c.plans) { if (!byCat.has(q.category)) byCat.set(q.category, []); byCat.get(q.category).push(q.id); }
  p.mapTree = { mapId: ids[0], children: [...byCat.values()].map(([head, ...rest]) => head === ids[0] ? null : { mapId: head, children: rest.map((mapId) => ({ mapId, children: [] })) }).filter(Boolean) };
  p.mapTree.children.unshift(...(byCat.get(c.plans[0].category).slice(1).map((mapId) => ({ mapId, children: [] }))));
  p.startMapId = ids[0];
  const entry = c.plans[0].entry;
  p.startPos = { x: entry[0], y: entry[1] };
  p.meta.title = "마을·도시 지도첩 · 판타지 RPG 마을 (정본)";
  return JSON.parse(JSON.stringify(p));
});
assert(project.tilesets.forest_harmony.count >= 3491, "atlas town parts missing on forest_harmony");
for (const m of Object.values(project.maps)) assert(project.tilesets[m.tilesetId], "tileset missing " + m.tilesetId);
const inTree = new Set(); (function walk(n) { inTree.add(n.mapId); n.children.forEach(walk); })(project.mapTree);
assert.equal(inTree.size, Object.keys(project.maps).length, "map tree does not hold every map");
await withTsModule("electron/local-store/store.ts", "atlas-towns-store.mjs", async (api) => {
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
    const proof = { projectId: id, projectDir: ".oprn-projects/atlas-towns-20260925", revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps).length };
    fs.writeFileSync("tiledata/atlas-towns/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(proof);
  } finally { s.close(); }
});
