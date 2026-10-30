// 「사냥꾼 계약」 세계 지도 스냅숏 — edit_world_terrain(shared-v9 판타지)으로 짓고 서쪽 대륙만 잘라
// 쓰지 않는 고을 아이콘을 걷어 내고 갈대늪·회색봉 아이콘을 찍어 src/project/flagship/hunter/worldmap.json 으로 얼린다.
// 데모 빌더는 동기라 키트(파이썬)를 못 부른다 — 이 스냅숏을 읽는다. 지형을 바꿀 때만 다시 돌린다.
//   node --max-old-space-size=8000 node_modules/.bin/vite-node scripts/content/hunter/bake-worldmap.mts [--png out.png]
import { writeFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import "../../../src/editor/tools/toolRegistry";
import { prepareTool } from "../../../src/editor/tools/asyncToolRunner";
import { setWorldmapBuilder } from "../../../src/editor/worldmap/worldmapBuild";
import { buildWorldmap } from "../../lib/worldmapBuild.mjs";
import { canMove } from "../../../src/project/collision";
import { renderMapPng } from "../../qa-game/render.mts";
import type { GameMap, Project } from "../../../src/project/types";

setWorldmapBuilder(buildWorldmap as never);
const project: Project = createBlankProject();
const exec = (name: string, args: Record<string, unknown>) => {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name}: ${res.summary} ${JSON.stringify(res.issues ?? []).slice(0, 300)}`);
  Object.assign(project, ctx.project);
  return res as { data?: Record<string, unknown> };
};
const ID = "hc_world";
const args = { theme: "fantasy", base: "shared-v9", ops: [], newMapId: ID, name: "서쪽 변경" };
await prepareTool("edit_world_terrain", args, project);
exec("edit_world_terrain", args);
const full = project.maps[ID]!;

// ── 자르기: 서쪽 대륙(원래 칸 x4..59, y12..49)
const X0 = 4, Y0 = 12, W = 56, H = 38;
const crop = (arr: number[] | undefined) => {
  if (!arr) return arr;
  const out: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.push(arr[(y + Y0) * full.width + x + X0] ?? -1);
  return out;
};
const map: GameMap = {
  ...full, width: W, height: H,
  lowerTiles: crop(full.lowerTiles)!, upperTiles: crop(full.upperTiles)!,
  events: [], locations: [],
} as GameMap;
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits", "lowerTileStacks", "upperTileStacks", "worldmapSource", "relief"] as const) delete (map as unknown as Record<string, unknown>)[k];
project.maps[ID] = map;

// ── 걷어 낼 고을(원래 좌표): 대성 · 강가 마을 · 고원 마을 · 거대한 탑 · 고갯길 요새(회색봉 폐성으로 바꿔 찍는다)
const erase = (ox: number, oy: number, w: number, h: number) => {
  for (let y = oy - Y0; y < oy - Y0 + h; y++) for (let x = ox - X0; x < ox - X0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) map.upperTiles[y * W + x] = -1;
};
erase(25, 21, 6, 6); erase(38, 26, 3, 3); erase(15, 21, 2, 2); erase(49, 30, 2, 4); erase(45, 24, 3, 3);

const stamp = (iconId: string, cands: { x: number; y: number }[]) => {
  for (const at of cands) {
    try {
      const r = exec("stamp_worldmap_icon", { mapId: ID, iconId, at });
      return r.data as { entrance: { x: number; y: number }; approach: { x: number; y: number } };
    } catch (e) { console.warn("stamp miss", iconId, at, (e as Error).message.slice(0, 80)); }
  }
  throw new Error(`no spot for ${iconId}`);
};
// 원래 좌표 → 잘린 좌표
const o = (x: number, y: number) => ({ x: x - X0, y: y - Y0 });
const castle = stamp("fantasy/castle_dark", [o(45, 24), o(45, 23), o(44, 24)]);
const swamp = stamp("fantasy/stilt_village", [o(10, 34), o(9, 34), o(11, 33), o(9, 36), o(12, 37), o(8, 32)]);
// 버들항 = 원래 지도의 내해 항구 아이콘(40,30 5×4) 그대로. 입구 42,33.
const harbor = { entrance: o(42, 33), approach: o(42, 34) };
const start = o(28, 26); // 옛 대성 성문 자리 — 길이 다 모이는 갈림길

// 걸어서 닿는가
const reach = (from: { x: number; y: number }) => {
  const seen = new Set([`${from.x},${from.y}`]); const q = [from];
  while (q.length) { const c = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = { x: c.x + dx, y: c.y + dy }; const k = `${n.x},${n.y}`;
    if (seen.has(k) || n.x < 0 || n.y < 0 || n.x >= W || n.y >= H || !canMove(project, final, c.x, c.y, n.x, n.y)) continue;
    seen.add(k); q.push(n); } }
  return seen;
};
// 도구는 사본(draft)에 쓴다 — 찍은 뒤의 맵은 다시 꺼낸다.
const final = project.maps[ID]!;
const seen = reach(start);
const places = { start, swamp, harbor, castle };
for (const [k, v] of Object.entries(places)) {
  const c = "approach" in v ? v.approach : v;
  console.log(k, JSON.stringify(v), "reach", seen.has(`${c.x},${c.y}`), "entrance reach", "entrance" in v ? seen.has(`${v.entrance.x},${v.entrance.y}`) : "-");
}
const tileset = project.tilesets[final.tilesetId]!;
const materials = tileset.image.type === "uploaded" ? project.assets.uploaded[tileset.image.id]! : undefined;
if (!materials) throw new Error("materials asset missing");
const png = process.argv.indexOf("--png");
if (png > 0) writeFileSync(process.argv[png + 1]!, renderMapPng(project, final).png);
writeFileSync(new URL("../../../src/project/flagship/hunter/worldmap.json", import.meta.url),
  JSON.stringify({ map: final, tileset, asset: materials, places }));
console.log("written", W, H, final.tilesetId, (JSON.stringify(materials).length / 1e6).toFixed(2), "MB asset");
