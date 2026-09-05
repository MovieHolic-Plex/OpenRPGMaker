/** Exercise the shipped registry on several maps, then persist a separate verification project. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createBlankProject } from "../src/project/defaults/defaultProject";
import { createBlankMap } from "../src/project/defaults/defaultMaps";
import { runTool } from "../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../src/project/io";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";

const out = "reports/world-structure-tools";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  return match ? [[match[1], match[2].trim().replace(/^["']|["']$/g, "")]] : [];
}));
assert(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
const config = { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY, projectId: "rpg-zzu-world-structure-tools-20260906" };
const before = await loadProjectFromSupabase(config);
const recoverSaved = process.argv.includes("--recover-saved");
if (before && !recoverSaved) {
  assert(fs.existsSync(`${out}/project.json`), "Existing remote verification project has no local receipt");
  assert.deepEqual(before, deserialize(fs.readFileSync(`${out}/project.json`, "utf8")), "Remote verification project changed");
}
const ctx = { project: createBlankProject() };
ctx.project.meta.title = "World 산과 다리 · 공통 저작 도구 검증";
ctx.project.maps = {};
const receipts = [];
for (const [i, surface] of ["grass", "dirt", "snow"].entries()) {
  const map = createBlankMap(`${surface} · 도구 검증`, 64, 56, "easyrpg_chipset_world");
  map.id = `world_tools_${surface}`;
  // 247 is the plain snow sample, pixel-identical to 190 but not an autotile.
  // A full-canvas test ground should not grow grass borders against the canvas edge.
  map.lowerTiles.fill(surface === "snow" ? 247 : 240);
  map.upperTiles.fill(-1);
  for (let y = 8; y <= 14; y++) for (let x = 42; x <= 48; x++) map.lowerTiles[y * map.width + x] = 120;
  for (let y = 30; y <= 32; y++) for (let x = 40; x <= 47; x++) map.lowerTiles[y * map.width + x] = 120;
  ctx.project.maps[map.id] = map;
  if (i === 0) {
    ctx.project.startMapId = map.id;
    ctx.project.startPos = { x: 1, y: 1 };
    ctx.project.mapTree = { mapId: map.id, children: [] };
  } else ctx.project.mapTree.children.push({ mapId: map.id, children: [] });
  const frontOffsets = Array.from({ length: 27 }, (_, x) => x >= 15 && x <= 22 ? 1 : 0);
  const mountainArgs = { mapId: map.id, surface, tiers: [
    { x: 8, y: 5, width: 27, height: 26, stairX: 12, frontOffsets },
    { x: 12, y: 8, width: 18, height: 16, stairX: 26 },
    { x: 16, y: 11, width: 9, height: 7, stairX: 19 },
  ] };
  for (const [name, args] of [
    ["author_world_mountain", mountainArgs],
    ["author_world_bridge", { mapId: map.id, x: 45, y: 8, length: 7, orientation: "vertical" }],
    ["author_world_bridge", { mapId: map.id, x: 40, y: 31, length: 8, orientation: "horizontal" }],
  ] as const) {
    const result = runTool(ctx, name, args);
    assert(result.ok, JSON.stringify(result));
    receipts.push({ name, args, data: result.data, summary: result.summary });
  }
}
const expected = deserialize(serialize(ctx.project));
if (recoverSaved) {
  assert(before, "No remote save to recover");
  assert.deepEqual(before.maps, expected.maps, "Saved map differs from the generated verification maps");
  assert.deepEqual(before.tilesets, expected.tilesets, "Saved tilesets differ from the generated verification tilesets");
}
assert.deepEqual(await loadProjectFromSupabase(config), before, "Remote changed before save");
const savedResult = recoverSaved ? { kind: "verified-existing" } : await saveProjectToSupabase(expected, config);
const saved = { kind: savedResult.kind, sha256: "sha256" in savedResult ? savedResult.sha256 : null };
const loaded = await loadProjectFromSupabase(config);
assert(loaded);
assert.deepEqual(loaded.maps, expected.maps);
assert.deepEqual(loaded.tilesets, expected.tilesets);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/project.json`, serialize(loaded));
fs.writeFileSync(`${out}/verification.json`, JSON.stringify({
  projectId: config.projectId, saved, reloadedAt: new Date().toISOString(),
  mapsMatch: true, tilesetsMatch: true, receipts,
}, null, 2));
console.log(JSON.stringify({ projectId: config.projectId, maps: Object.keys(loaded.maps).length, toolCalls: receipts.length, saved, reloaded: true }));
