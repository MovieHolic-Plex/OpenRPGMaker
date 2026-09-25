// Save the elf treetop village (tiledata/elf-treetop) into its own canonical local project, reopen it and prove the
// reload is identical. The store lives in .oprn-projects/elf-treetop-20260925 (outside git); the reloaded export feeds
// prepare-elf-treetop-regions.mjs. The map is drawn on the bundled forest_harmony with the treetop parts (3131~).
// Usage: node scripts/content/save-elf-treetop.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { reachable } from "./lib/climate-edits.mjs";

const dir = process.cwd() + "/.oprn-projects/elf-treetop-20260925", out = "output/evidence/elf-treetop";
const c = JSON.parse(fs.readFileSync("tiledata/elf-treetop/catalog.json"));
const plan = c.plan;
fs.mkdirSync(out, { recursive: true });
const { project, report } = await withTsModule("scripts/content/lib/elf-treetop-entry.ts", "elf-treetop-save.mjs", async (api) => {
  const p = api.createBlankProject();
  api.ensureBundledTilesets(p);
  const tileset = p.tilesets.forest_harmony;
  assert(api.tilesetHasTreetopParts(tileset), "forest_harmony lacks the treetop parts (3131~)");
  const map = api.createBlankMap(plan.name, plan.width, plan.height, "forest_harmony");
  map.id = plan.id;
  map.lowerTiles = [...c.map.lowerTiles];
  map.upperTiles = [...c.map.upperTiles];
  assert.equal(map.lowerTiles.length, plan.width * plan.height);
  for (const t of [...map.lowerTiles, ...map.upperTiles]) assert(t < tileset.count, `tile ${t} past the sheet (${tileset.count})`);
  p.maps = { [map.id]: map };
  p.mapTree = { mapId: map.id, children: [] };
  p.startMapId = map.id;
  p.startPos = { x: plan.entry[0], y: plan.entry[1] };
  p.meta.title = "엘프 나무 위 마을 (정본)";
  // Walk check with the runtime move rule: from the ladder foot to every door front and the east bridge end.
  const seen = reachable(api.canMove, p, map, plan.entry);
  const at = (x, y) => y * map.width + x;
  const targets = [...plan.doors.map((d) => d.front), ...plan.exits.map((e) => [e.x, e.y])];
  const blocked = targets.filter(([x, y]) => !seen.has(at(x, y)));
  assert.equal(blocked.length, 0, "Blocked: " + JSON.stringify(blocked));
  return { project: JSON.parse(JSON.stringify(p)), report: { entry: plan.entry, targets, reachable: seen.size, blocked } };
});
fs.writeFileSync("tiledata/elf-treetop/validation.json", JSON.stringify(report, null, 2) + "\n");
await withTsModule("electron/local-store/store.ts", "elf-treetop-store.mjs", async (api) => {
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
    const proof = { projectId: id, projectDir: ".oprn-projects/elf-treetop-20260925", revision: a.revision, sha256: a.sha256, saved: true, reopened: true, maps: Object.keys(project.maps) };
    fs.writeFileSync("tiledata/elf-treetop/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(proof, report);
  } finally { s.close(); }
});
