/**
 * 던전 테마별 자연 맵 3종 — 용암 / 석재 / 얼음.
 * 방 구조(2D 쿼터뷰): 테마 천장(공허)이 방을 감싸고, 벽 면은 천장 "하단"(남향)에만 보인다.
 * 좌/우/하단은 벽 면 없이 천장이 바닥과 바로 만난다. 천장 하단 벽은 직선 [좌끝·증식·우끝](대각 금지).
 * 판자 다리는 상위 레이어(구덩이/급류 위에 뜬 다리). 실행: npx tsx scripts/build-dungeon-themed-maps.mts
 */
import fs from "node:fs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { shapeAutotileGroupAround } from "../src/project/defaults/autotileEngine.ts";
import { createDungeonTerrainAutotileGroups, DUNGEON_TERRAIN_AUTOTILE_PREFIX } from "../src/project/defaults/dungeonTerrainAutotiles.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { AutotileGroup, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-dungeon-example";
const TILESET_ID = "easyrpg_chipset_dungeon";
const W = 26, H = 18;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const config = { url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY!, projectId: PROJECT_ID };

const project: Project = createEmptyToolProject("던전 테마 맵");
project.meta.title = "던전 테마 맵 — 용암/석재/얼음";
ensureTilesetHarnesses(project);
const groups = createDungeonTerrainAutotileGroups();

type Grid = { lower: number[]; upper: number[] };
function blank(fill: number): Grid { return { lower: new Array<number>(W * H).fill(fill), upper: new Array<number>(W * H).fill(-1) }; }
const idx = (x: number, y: number) => y * W + x;
function group(key: string): AutotileGroup {
  const g = groups.find((c) => c.id === `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
  if (!g) throw new Error(`missing group ${key}`);
  return g;
}
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, tile: number, skip?: (x: number, y: number) => boolean) {
  const pts: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) { if (skip?.(x, y)) continue; g.lower[idx(x, y)] = tile; pts.push({ x, y }); }
  return pts;
}
function shape(g: Grid, key: string, pts: { x: number; y: number }[]) { shapeAutotileGroupAround({ width: W, height: H, lowerTiles: g.lower }, group(key), pts); }

// ── 벽 세트: 천장(테마 공허) + 벽(윗선 성형) ─────────────────────
type WallSet = {
  ceilKey: "abyss-blue" | "abyss-gray" | "pit-gold";
  ceilBody: number;
  // 천장 아래 직선 벽(대각 금지): band = 윗줄 [좌끝·가로증식·우끝], bandBody = 아랫줄.
  band: readonly [number, number, number];
  bandBody: readonly [number, number, number];
};

// 천장 공허 테두리(바깥 2링) — 안쪽 링만 성형.
function ceiling(g: Grid, ws: WallSet) {
  rect(g, 0, 0, W - 1, H - 1, ws.ceilBody, (x, y) => x >= 2 && x <= W - 3 && y >= 3 && y <= H - 3);
  const pts: { x: number; y: number }[] = [];
  for (let y = 1; y <= H - 2; y += 1) for (let x = 1; x <= W - 2; x += 1)
    if (x === 1 || x === W - 2 || y === 2 || y === H - 2) pts.push({ x, y });
  shape(g, ws.ceilKey, pts);
}
// 천장 하단 벽 — 직선 [좌끝·가로증식·우끝] 2단(윗줄 band + 아랫줄 bandBody). 대각 타일 금지.
function backWall(g: Grid, x0: number, x1: number, yTop: number, ws: WallSet) {
  for (let x = x0; x <= x1; x += 1) {
    const c = x === x0 ? 0 : x === x1 ? 2 : 1;
    g.lower[idx(x, yTop)] = ws.band[c]!;
    g.lower[idx(x, yTop + 1)] = ws.bandBody[c]!;
  }
}
function plankV(g: Grid, x: number, y0: number, y1: number) { g.upper[idx(x, y0)] = 171; for (let y = y0 + 1; y < y1; y += 1) g.upper[idx(x, y)] = 201; g.upper[idx(x, y1)] = 231; }
function plankH(g: Grid, x0: number, x1: number, y: number) { for (let x = x0; x <= x1; x += 1) g.upper[idx(x, y)] = x === x0 ? 252 : x === x1 ? 254 : 253; }

const WS_LAVA: WallSet = { ceilKey: "pit-gold", ceilBody: 310, band: [102, 103, 104], bandBody: [132, 133, 134] };
const WS_STONE: WallSet = { ceilKey: "abyss-gray", ceilBody: 430, band: [21, 22, 23], bandBody: [51, 52, 53] };
const WS_ICE: WallSet = { ceilKey: "abyss-blue", ceilBody: 427, band: [372, 373, 374], bandBody: [402, 403, 404] };

// ───────────────────────── 용암 동굴 ─────────────────────────
function lavaMap(): Grid {
  const g = blank(301);
  ceiling(g, WS_LAVA);
  backWall(g, 2, W - 3, 2, WS_LAVA);
  g.lower[idx(13, 3)] = 75;
  g.upper[idx(5, 2)] = 263; g.upper[idx(20, 2)] = 263;
  shape(g, "redrock", rect(g, 4, 8, 12, 14, 301));
  shape(g, "lava", rect(g, 5, 9, 11, 13, 304));
  plankH(g, 5, 11, 11);
  shape(g, "red-carpet", rect(g, 17, 6, 21, 9, 169));
  g.upper[idx(18, 6)] = 447; g.upper[idx(19, 6)] = 448; g.upper[idx(20, 6)] = 449;
  g.upper[idx(18, 7)] = 477; g.upper[idx(19, 7)] = 478; g.upper[idx(20, 7)] = 479;
  g.upper[idx(17, 6)] = 446; g.upper[idx(17, 7)] = 476; g.upper[idx(21, 6)] = 446; g.upper[idx(21, 7)] = 476;
  g.upper[idx(15, 12)] = 293; g.upper[idx(15, 11)] = 208; g.upper[idx(18, 12)] = 299;
  return g;
}

// ───────────────────────── 석재 홀 ─────────────────────────
function stoneMap(): Grid {
  const g = blank(187);
  ceiling(g, WS_STONE);
  backWall(g, 2, W - 3, 2, WS_STONE);
  shape(g, "chasm", rect(g, 15, 6, 20, 13, 190));
  plankV(g, 17, 6, 13);
  const cx = 5, cy = 8;
  const circle = [[441, 442, 443], [471, 472, 473], [27, 28, 29]];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) g.upper[idx(cx + dx, cy + dy)] = circle[dy]![dx]!;
  g.upper[idx(cx - 1, cy)] = 145; g.upper[idx(cx - 1, cy + 1)] = 175;
  g.upper[idx(cx + 3, cy)] = 146; g.upper[idx(cx + 3, cy + 1)] = 176;
  g.upper[idx(4, 12)] = 329; g.upper[idx(4, 13)] = 359;
  g.upper[idx(5, 13)] = 385; g.upper[idx(6, 13)] = 386; g.upper[idx(7, 13)] = 387;
  g.upper[idx(9, 11)] = 294; g.upper[idx(9, 12)] = 324; g.upper[idx(9, 13)] = 354;
  g.upper[idx(8, 13)] = 356;
  g.upper[idx(21, 11)] = 204; g.upper[idx(22, 11)] = 205; g.upper[idx(23, 11)] = 206;
  g.upper[idx(21, 12)] = 234; g.upper[idx(22, 12)] = 235; g.upper[idx(23, 12)] = 236;
  g.upper[idx(20, 8)] = 263;
  return g;
}

// ───────────────────────── 얼음 동굴 ─────────────────────────
function iceMap(): Grid {
  const g = blank(67);
  ceiling(g, WS_ICE);
  backWall(g, 2, W - 3, 2, WS_ICE);
  shape(g, "ice", rect(g, 4, 8, 11, 13, 70));
  const floe = [[282, 283, 284], [312, 313, 314], [342, 343, 344]];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) g.upper[idx(6 + dx, 9 + dy)] = floe[dy]![dx]!;
  rect(g, 17, 6, 20, 13, 403);
  plankH(g, 16, 21, 9);
  g.upper[idx(14, 11)] = 345; g.upper[idx(13, 8)] = 315;
  g.upper[idx(15, 6)] = 350; g.upper[idx(22, 12)] = 351; g.upper[idx(23, 8)] = 292;
  return g;
}

const MAPS = [
  { id: "map_lava", name: "용암 동굴", grid: lavaMap(), start: { x: 14, y: 7 }, dump: "output/map-lava.json" },
  { id: "map_stone", name: "석재 홀", grid: stoneMap(), start: { x: 11, y: 9 }, dump: "output/map-stone.json" },
  { id: "map_ice", name: "얼음 동굴", grid: iceMap(), start: { x: 13, y: 11 }, dump: "output/map-ice.json" },
];

fs.mkdirSync("output", { recursive: true });
for (const m of MAPS) {
  project.maps[m.id] = { id: m.id, name: m.name, width: W, height: H, tilesetId: TILESET_ID, tileSize: 16, lowerTiles: m.grid.lower, upperTiles: m.grid.upper, events: [] };
  fs.writeFileSync(m.dump, JSON.stringify({ width: W, height: H, lowerTiles: m.grid.lower, upperTiles: m.grid.upper }));
  console.log("[map]", m.id, m.name, "->", m.dump);
}
project.startMapId = MAPS[0]!.id;
project.startPos = MAPS[0]!.start;
project.mapTree = { mapId: MAPS[0]!.id, children: MAPS.slice(1).map((m) => ({ mapId: m.id, children: [] })) };

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);
const verify = await loadProjectFromSupabase(config);
console.log("[verify]", verify?.meta?.title, "maps:", MAPS.filter((m) => verify?.maps[m.id]).length, "/", MAPS.length);
if (!MAPS.every((m) => verify?.maps[m.id]?.width === W)) throw new Error("verify failed");
console.log("[done]");
