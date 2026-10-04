// 손 도트 실내 v5 예제 26맵을 정본 로컬 SQLite 프로젝트에 저장 → 다시 열어 deepEqual. 번들 경로도 증명한다:
//   새 프로젝트는 atlas_biome_interior(v5, 참고문서 「손 도트 실내」)와 atlas_biome_dungeon 을 갖고 태어난다.
//   옛 저장본(Tibo 번호 기반 atlas_biome_interior + 그 칩셋 맵)은 새 정의로 바뀌고, 그 맵은 그대로 남으며 경고가 남는다.
// 사용: bun scripts/content/hand-interior/save.mts   (저장소 .oprn-projects/hand-interior-v5-20260929, git 밖)
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { atlasBiomeInteriorReplacementWarnings, ATLAS_BIOME_INTERIOR_COUNT } from "../../../src/project/defaults/atlasBiomeInterior.ts";
import { canMove } from "../../../src/project/collision.ts";
import { initLocalProjectStore, openLocalProjectStore } from "../../../electron/local-store/store.ts";
import type { Project } from "../../../src/project/types.ts";

const rel = ".oprn-projects/hand-interior-v5-20260929", dir = `${process.cwd()}/${rel}`;
const c = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/maps.json", "utf8"));
const bundle: Record<string, unknown> = {};

// new project
const p = createBlankProject() as Project;
const t = p.tilesets.atlas_biome_interior!;
assert(t && t.family === "oprn-atlas" && t.count === ATLAS_BIOME_INTERIOR_COUNT && t.tilesPerRow === 48, "new project lacks the v5 interior tileset");
assert(t.referenceDocuments?.some((k) => k.id === "hand-interior-v5"), "new project: 손 도트 실내 guidance missing");
assert(p.tilesets.atlas_biome_dungeon?.family === "oprn-atlas", "new project lacks atlas_biome_dungeon");
bundle.newProject = { tilesetId: t.id, family: t.family, count: t.count, categories: t.referenceDocuments!.map((k) => k.id), dungeon: p.tilesets.atlas_biome_dungeon!.count };
// older save: the retired (Tibo-numbered) definition + a map drawn with it
const oldDef = JSON.parse(execFileSync("git", ["show", "8e02e8e4e:src/assets/atlasBiomeInteriorTileset.json"], { maxBuffer: 1 << 28 }).toString());
const old = createBlankProject() as Project;
old.tilesets.atlas_biome_interior = { ...structuredClone(old.tilesets.atlas_biome_interior!), count: oldDef.count, tilesPerRow: 30,
  structureKits: [{ id: "tibo-bed", kind: "section", name: "옛 침대", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [700] }], learnedFrom: "atlas-interior" } as never],
  referenceDocuments: [{ id: "atlas-interior-guide-v1", name: "옛 안내", description: "", documents: [], images: [] }, { id: "my-notes", name: "저자 메모", description: "", documents: [], images: [] }] };
const oldMap = { id: "old-room", name: "옛 실내", width: 3, height: 3, tilesetId: "atlas_biome_interior", tileSize: 16, lowerTiles: [1, 2, 3, 4, 5, 6, 7, 8, 9], upperTiles: new Array(9).fill(-1), events: [] };
old.maps["old-room"] = structuredClone(oldMap) as never;
const warnBefore = atlasBiomeInteriorReplacementWarnings.length;
assert(ensureBundledTilesets(old), "older save not upgraded");
const nt = old.tilesets.atlas_biome_interior!;
assert(nt.count === ATLAS_BIOME_INTERIOR_COUNT && nt.tilesPerRow === 48 && nt.structureKits!.every((k) => k.id.startsWith("hand-interior:")), "old definition not replaced");
assert(nt.referenceDocuments!.some((k) => k.id === "my-notes") && !nt.referenceDocuments!.some((k) => k.id === "atlas-interior-guide-v1"), "authored notes lost or retired guide kept");
assert(isDeepStrictEqual(old.maps["old-room"], oldMap), "old map touched");
assert(atlasBiomeInteriorReplacementWarnings.length === warnBefore + 1 && atlasBiomeInteriorReplacementWarnings.at(-1)!.includes("old-room"), "no warning for the old map");
bundle.olderSave = { replaced: true, kept: nt.referenceDocuments!.map((k) => k.id), oldMapUntouched: true, warning: atlasBiomeInteriorReplacementWarnings.at(-1) };

// the 26 example maps
p.maps = structuredClone(c.maps);
const ids = Object.keys(c.maps);
p.mapTree = { mapId: ids[0]!, children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
p.startMapId = ids[0]!;
p.startPos = { x: c.plans[0].entry[0], y: c.plans[0].entry[1] };
p.meta.title = `손 도트 실내 v5 ${ids.length}맵 · atlas_biome_interior (정본)`;
// engine passage: every example's entrance reaches its stairs cells (canMove, the runtime rule)
const bfs = (m: Project["maps"][string], sx: number, sy: number) => {
  const seen = new Set([`${sx},${sy}`]); const q = [[sx, sy]];
  while (q.length) { const [x, y] = q.pop()!; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const X = x! + dx, Y = y! + dy; if (!seen.has(`${X},${Y}`) && canMove(p, m, x!, y!, X, Y)) { seen.add(`${X},${Y}`); q.push([X, Y]); } } }
  return seen;
};
const reach: Record<string, number> = {};
for (const plan of c.plans) {
  const m = p.maps[plan.id]!; const seen = bfs(m, plan.entry[0], plan.entry[1]);
  reach[plan.id] = seen.size;
  for (const e of m.events) assert(seen.has(`${e.x},${e.y}`), `${plan.id}: stairs event (${e.x},${e.y}) unreachable`);
}
const project = JSON.parse(JSON.stringify(p));
let s = await initLocalProjectStore({ projectDir: dir }); let id: string;
try {
  const before = s.loadSnapshot(); id = s.info().projectId;
  const r = await s.saveSerialized(JSON.stringify(project), before?.sha256 ?? null);
  assert.equal(r.kind, "saved");
} finally { s.close(); }
s = await openLocalProjectStore({ projectDir: dir });
try {
  const a = s.loadSnapshot()!;
  const reloaded = JSON.parse(JSON.stringify(a.project));
  assert(isDeepStrictEqual(reloaded, project), "Reload differs");
  const proof = { projectId: id, projectDir: rel, revision: a.revision, sha256: a.sha256, saved: true, reopened: true, deepEqual: true,
    tileset: "atlas_biome_interior", maps: ids.length, engineReach: reach, bundle, mapIds: ids };
  fs.writeFileSync("tiledata/hand-interior/v5-maps/storage-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify({ ...proof, engineReach: undefined, mapIds: undefined }, null, 1));
} finally { s.close(); }
