// Save 버들항 v6 as-is (tiledata/beodeul-city/map.json, cut by build-beodeul-city.py) into its own canonical local project,
// reopen it and prove the reload is identical, carries the beodeul_city tileset with its bundled reference documents
// and animation strips, and that walkability in the editor map matches the Python occupancy grid.
// Store: .oprn-projects/beodeul-city-20260928 (outside git).   node scripts/content/save-beodeul-city.mjs
// Then: bun scripts/content/render-beodeul-city.mts (renders the reloaded map and diffs it against the original).
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const rel = ".oprn-projects/beodeul-city-20260928", dir = process.cwd() + "/" + rel;
const src = JSON.parse(fs.readFileSync("tiledata/beodeul-city/map.json", "utf8"));
const MAP_ID = "beodeul_v6";
const SHEETS = { People1: "tex_easyrpg_charset_people1", People2: "tex_easyrpg_charset_people2", People3: "tex_easyrpg_charset_people3",
  People4: "tex_easyrpg_charset_people4", People5: "tex_easyrpg_charset_people5" };
const DIRS = { u: "up", r: "right", d: "down", l: "left" };
const LINES = ["버들항에 온 걸 환영해요. 언덕 위가 귀족 저택, 북서쪽 바위 위가 왕성이에요.", "포룸 분수 옆 카페가 제일 붐벼요.",
  "배는 남쪽 잔교에서 타요.", "풍차는 서쪽 들판에 있어요. 날개가 쉬지 않고 돌지요.", "강 위 아치 다리는 세 개예요."];
let walkCheck = null;
const project = await withTsModule("scripts/content/lib/beodeul-city-entry.ts", "beodeul-save.mjs", async (api) => {
  const p = api.createBlankProject();
  api.ensureBundledTilesets(p);
  const ts = p.tilesets[api.BEODEUL_CITY_ID];
  assert(ts, "blank project lacks beodeul_city (bundled.ts)");
  assert(ts.referenceDocuments?.length, "beodeul_city is born without reference documents");
  const events = src.people.map(([sheet, k, d, x, y], i) => ({
    id: `ev_bd_townsfolk_${i + 1}`, name: `버들항 주민 ${i + 1}`, placementRole: "npc", x, y, trigger: { kind: "action" }, commands: [],
    pages: [{ id: `ev_bd_townsfolk_${i + 1}_p`, name: "주민", conditions: [],
      graphic: { sprite: { type: "bundled", id: SHEETS[sheet] }, direction: DIRS[d], pattern: api.charsetFrameIndex({ characterIndex: k, direction: DIRS[d], pattern: 1 }) },
      trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", speaker: "버들항 주민", body: LINES[i % LINES.length] }] }],
  }));
  p.maps = { [MAP_ID]: { id: MAP_ID, name: "버들항 v6 · 로마풍 항구 도시", width: src.width, height: src.height, tilesetId: api.BEODEUL_CITY_ID, tileSize: 16,
    lowerTiles: src.lowerTiles, upperTiles: src.upperTiles, events } };
  p.mapTree = { mapId: MAP_ID, children: [] };
  p.startMapId = MAP_ID;
  p.startPos = { x: 62, y: 33 };
  p.meta.title = "버들항 v6 (정본)";
  // walkability: the editor map vs the Python occupancy grid (every cell)
  const map = p.maps[MAP_ID];
  let same = 0, diff = [];
  for (let y = 0; y < src.height; y += 1) for (let x = 0; x < src.width; x += 1) {
    const a = api.isPassable(p, map, x, y), b = src.walkable[y][x];
    if (a === b) same += 1; else diff.push([x, y, b]);
  }
  walkCheck = { cells: src.width * src.height, same, mismatch: diff.length, samples: diff.slice(0, 10), walkable: src.walkable.flat().filter(Boolean).length };
  return JSON.parse(JSON.stringify(p));
});
await withTsModule("electron/local-store/store.ts", "beodeul-store.mjs", async (api) => {
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
    const reloaded = JSON.parse(JSON.stringify(a.project));
    assert(isDeepStrictEqual(reloaded, project), "Reload differs");
    const ts = reloaded.tilesets.beodeul_city, m = reloaded.maps[MAP_ID];
    assert(isDeepStrictEqual(m, project.maps[MAP_ID]) && isDeepStrictEqual(ts, project.tilesets.beodeul_city));
    fs.mkdirSync("verify-shots/beodeul-assistant", { recursive: true });
    fs.writeFileSync("verify-shots/beodeul-assistant/reloaded-map.json", JSON.stringify({ projectId: id, map: m }));
    const proof = { projectId: id, projectDir: rel, revision: a.revision, sha256: a.sha256, saved: true, reopened: true,
      deepEqual: { project: true, map: true, tileset: true },
      tileset: { id: ts.id, count: ts.count, image: ts.image, tilesPerRow: ts.tilesPerRow, animationStrips: ts.animationStrips.length,
        structureKits: ts.structureKits.length, tileGroups: ts.tileGroups.filter((g) => g.id.startsWith("beodeul:")).length,
        referenceDocuments: ts.referenceDocuments.map((d) => ({ id: d.id, docs: d.documents.length, images: d.images.length })) },
      map: { id: m.id, size: [m.width, m.height], lower: m.lowerTiles.filter((t) => t >= 0).length, upper: m.upperTiles.filter((t) => t >= 0).length,
        animatedCells: m.lowerTiles.concat(m.upperTiles).filter((t) => ts.animationStrips.some((st) => st.baseTile === t)).length, npcs: m.events.length },
      walkability: walkCheck };
    fs.writeFileSync("tiledata/beodeul-city/storage-proof.json", JSON.stringify(proof, null, 1) + "\n");
    console.log(JSON.stringify(proof));
  } finally { s.close(); }
});
