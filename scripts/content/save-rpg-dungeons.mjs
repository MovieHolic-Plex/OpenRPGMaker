// Save tiledata/rpg-dungeons into its own canonical local project, reopen it and prove the reload is identical.
// The store lives in .oprn-projects/rpg-dungeons-20260924 (outside git); the reloaded export feeds prepare-rpg-dungeons-regions.
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const dir = process.cwd() + "/.oprn-projects/rpg-dungeons-20260924", out = "output/evidence/rpg-dungeons";
const c = JSON.parse(fs.readFileSync("tiledata/rpg-dungeons/catalog.json"));
const guidance = JSON.parse(fs.readFileSync("src/assets/sharedRpgDungeonReferences.json")).easyrpg_chipset_dungeon;
fs.mkdirSync(out, { recursive: true });
const project = await withTsModule("scripts/content/lib/rpg-dungeons-entry.ts", "rpg-dungeons-save.mjs", async (api) => {
  const p = api.createBlankProject();
  // The place tilesets are new ids (the dungeon sheet + grafts / repaints); they carry the same shipped guidance
  // the bundled dungeon sheet gets from the ensure path, so a downloaded place still explains itself.
  for (const [id, t] of Object.entries(c.tilesets)) p.tilesets[id] = { ...structuredClone(t), referenceDocuments: structuredClone(guidance) };
  p.maps = structuredClone(c.maps);
  const ids = Object.keys(c.maps);
  p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
  p.startMapId = ids[0];
  const entry = c.plans[0].entry;
  p.startPos = { x: entry[0], y: entry[1] };
  p.meta.title = "RPG 던전 · 동굴·탑·마왕성·피라미드·큰 던전 (정본)";
  return JSON.parse(JSON.stringify(p));
});
assert(project.tilesets.easyrpg_chipset_dungeon.referenceDocuments.some((k) => k.id === "rpg-dungeons-natural-v1"), "guidance missing on the bundled dungeon sheet");
await withTsModule("electron/local-store/store.ts", "rpg-dungeons-store.mjs", async (api) => {
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
    const proof = { projectId: id, projectDir: ".oprn-projects/rpg-dungeons-20260924", revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps) };
    fs.writeFileSync("tiledata/rpg-dungeons/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(proof);
  } finally { s.close(); }
});
