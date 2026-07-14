/**
 * 던전 테마별 자연 맵 3종 — 용암 / 석재 / 얼음.
 * 방 구조: 심연(천장) 공허 테두리 → 벽 링(암벽) → 뒤쪽 대각 절벽(전폭) → 바닥 → 소품.
 * 판자 다리는 상위 레이어(구덩이 위에 뜬 다리). 실행: npx tsx scripts/build-dungeon-themed-maps.mts
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

// ── 방 뼈대 ──────────────────────────────────────────────────
// 심연(천장) 공허 테두리: 바깥 x0 밖은 통짜, 안쪽 링만 성형.
function ceiling(g: Grid, key: "abyss-blue" | "abyss-gray", body: number, top = 0) {
  rect(g, 0, top, W - 1, H - 1, body, (x, y) => x >= 2 && x <= W - 3 && y >= 3 && y <= H - 3);
  const pts: { x: number; y: number }[] = [];
  for (let y = Math.max(top, 1); y <= H - 2; y += 1) for (let x = 1; x <= W - 2; x += 1)
    if (x === 1 || x === W - 2 || y === 2 || y === H - 2) pts.push({ x, y });
  shape(g, key, pts);
}
// 테마 벽 밴드로 방을 감싼다 — 좌우/하단은 [캡 상단 + 몸통 하단] 2단 느낌, 몸통 반복.
// cap = 벽 상단 3타일(좌·몸통·우), body = 벽 하단 3타일. 세로 벽은 몸통(body[1]) 반복.
function wallEnclosure(g: Grid, x0: number, y0: number, x1: number, y1: number, cap: readonly [number,number,number], body: readonly [number,number,number]) {
  const bodyMid = body[1];
  // 좌우 세로 벽 (몸통 반복)
  for (let y = y0; y <= y1; y += 1) { g.lower[idx(x0, y)] = bodyMid; g.lower[idx(x1, y)] = bodyMid; }
  // 하단 벽 (캡 위 + 몸통 아래 2단)
  for (let x = x0; x <= x1; x += 1) {
    const c = x === x0 ? 0 : x === x1 ? 2 : 1;
    g.lower[idx(x, y1 - 1)] = cap[c]!;
    g.lower[idx(x, y1)] = body[c]!;
  }
}
// 전폭 대각 절벽 벽 — 뒤쪽(북) 벽. 좌코너/직선 몸통/우코너 + 면 반복.
function redCliffWall(g: Grid, x0: number, x1: number, yTop: number, faceRows: number, face?: number) {
  for (let x = x0; x <= x1; x += 1) g.lower[idx(x, yTop)] = (x - x0) % 2 === 0 ? 17 : 16; // 톱니 능선
  for (let r = 1; r <= faceRows; r += 1) for (let x = x0; x <= x1; x += 1) g.lower[idx(x, yTop + r)] = (x - x0) % 2 === 0 ? 47 : 46;
  if (face) g.lower[idx(Math.floor((x0 + x1) / 2), yTop + 1)] = 75; // 얼굴 부조
}
function stoneCliffWall(g: Grid, x0: number, x1: number, yTop: number, faceRows: number) {
  for (let x = x0; x <= x1; x += 1) g.lower[idx(x, yTop)] = x === x0 ? 432 : x === x1 ? 433 : 434; // 좌코너·직선·우코너
  for (let r = 1; r <= faceRows; r += 1) for (let x = x0; x <= x1; x += 1) g.lower[idx(x, yTop + r)] = x === x0 ? 462 : x === x1 ? 464 : 463;
}
function iceCliffWall(g: Grid, x0: number, x1: number, yTop: number) {
  for (let x = x0; x <= x1; x += 1) { g.lower[idx(x, yTop)] = 286; g.lower[idx(x, yTop + 1)] = (x - x0) % 2 === 0 ? 316 : 317; g.lower[idx(x, yTop + 2)] = (x - x0) % 2 === 0 ? 346 : 347; }
}
// 판자 다리 — 구덩이 위에 상위 레이어로 얹는다(가로/세로).
function plankBridgeV(g: Grid, x: number, y0: number, y1: number) {
  g.upper[idx(x, y0)] = 171; for (let y = y0 + 1; y < y1; y += 1) g.upper[idx(x, y)] = 201; g.upper[idx(x, y1)] = 231;
}
function plankBridgeH(g: Grid, x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x += 1) g.upper[idx(x, y)] = x === x0 ? 252 : x === x1 ? 254 : 253;
}

// ───────────────────────── 용암 동굴 ─────────────────────────
function lavaMap(): Grid {
  const g = blank(301);
  ceiling(g, "pit-gold", 310);                   // 용암 지대 천장(금빛 테두리 어둠)
  wallEnclosure(g, 2, 2, W - 3, H - 3, [102, 103, 104], [132, 133, 134]); // 검붉은 벽돌 벽
  redCliffWall(g, 3, W - 4, 2, 2, 75);           // 뒤쪽 전폭 적암 대각 절벽 + 얼굴
  g.upper[idx(4, 2)] = 263; g.upper[idx(20, 2)] = 263; // 절벽 위 횃불
  // 용암 호수(적암 shore + 용암) — 왼쪽 아래, 판자 다리로 건넘
  shape(g, "redrock", rect(g, 3, 9, 12, 15, 301));
  shape(g, "lava", rect(g, 4, 10, 11, 14, 304));
  plankBridgeH(g, 4, 11, 12);                     // 상위 레이어 다리
  // 오른쪽 붉은 카펫 제단 + 왕좌
  shape(g, "red-carpet", rect(g, 17, 6, 21, 9, 169));
  g.upper[idx(18, 6)] = 447; g.upper[idx(19, 6)] = 448; g.upper[idx(20, 6)] = 449;
  g.upper[idx(18, 7)] = 477; g.upper[idx(19, 7)] = 478; g.upper[idx(20, 7)] = 479;
  g.upper[idx(17, 6)] = 446; g.upper[idx(17, 7)] = 476; g.upper[idx(21, 6)] = 446; g.upper[idx(21, 7)] = 476;
  for (let x = 18; x <= 20; x += 1) g.lower[idx(x, 10)] = 105 + (x - 18); // 제단 발치 계단
  // 소품
  g.upper[idx(15, 13)] = 293; g.upper[idx(15, 12)] = 208; // 모닥불
  g.upper[idx(18, 13)] = 299; g.upper[idx(20, 13)] = 320; g.upper[idx(21, 13)] = 321;
  return g;
}

// ───────────────────────── 석재 홀 ─────────────────────────
function stoneMap(): Grid {
  const g = blank(187);
  ceiling(g, "abyss-gray", 430);                 // 석재 지대 천장(회암 테두리 어둠)
  wallEnclosure(g, 2, 2, W - 3, H - 3, [21, 22, 23], [51, 52, 53]); // 갈색 암벽 벽
  stoneCliffWall(g, 3, W - 4, 2, 2);             // 뒤쪽 전폭 석재 대각 절벽
  g.upper[idx(13, 1)] = 268; g.upper[idx(14, 1)] = 269; // 천장 벽 균열
  // 균열 구덩이 + 판자 다리(상위 레이어, 구덩이 위)
  shape(g, "chasm", rect(g, 15, 8, 20, 14, 190));
  plankBridgeV(g, 17, 8, 14);
  // 마법진 + 수호상
  const cx = 5, cy = 9;
  const circle = [[441, 442, 443], [471, 472, 473], [27, 28, 29]];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) g.upper[idx(cx + dx, cy + dy)] = circle[dy]![dx]!;
  g.upper[idx(cx - 1, cy)] = 145; g.upper[idx(cx - 1, cy + 1)] = 175;
  g.upper[idx(cx + 3, cy)] = 146; g.upper[idx(cx + 3, cy + 1)] = 176;
  // 석조 돔(용광로)
  for (let dx = 0; dx < 3; dx += 1) { g.upper[idx(21 + dx, 5)] = 438 + dx; g.upper[idx(21 + dx, 6)] = 468 + dx; g.upper[idx(21 + dx, 7)] = 24 + dx; }
  // 서재
  g.upper[idx(4, 13)] = 329; g.upper[idx(4, 14)] = 359;
  g.upper[idx(5, 14)] = 385; g.upper[idx(6, 14)] = 386; g.upper[idx(7, 14)] = 387;
  g.upper[idx(9, 12)] = 294; g.upper[idx(9, 13)] = 324; g.upper[idx(9, 14)] = 354;
  g.upper[idx(8, 14)] = 356; g.upper[idx(6, 13)] = 357;
  // 감옥
  g.upper[idx(21, 12)] = 204; g.upper[idx(22, 12)] = 205; g.upper[idx(23, 12)] = 206;
  g.upper[idx(21, 13)] = 234; g.upper[idx(22, 13)] = 235; g.upper[idx(23, 13)] = 236;
  g.upper[idx(3, 8)] = 263; g.upper[idx(20, 11)] = 263;
  return g;
}

// ───────────────────────── 얼음 동굴 ─────────────────────────
function iceMap(): Grid {
  const g = blank(67);
  ceiling(g, "abyss-blue", 427);                 // 얼음 지대 천장(푸른 테두리 어둠)
  wallEnclosure(g, 2, 2, W - 3, H - 3, [372, 373, 374], [402, 403, 404]); // 푸른 빙벽
  iceCliffWall(g, 3, W - 4, 2);                   // 뒤쪽 전폭 대각 빙벽(얼음 폭포)
  for (let x = 3; x <= 21; x += 4) { g.upper[idx(x, 2)] = 237; g.upper[idx(x + 1, 2)] = 238; g.upper[idx(x + 2, 2)] = 239; } // 절벽 위 눈 캡
  // 얼음판 연못 + 부빙(수동)
  shape(g, "ice", rect(g, 3, 8, 11, 14, 70));
  const floe = [[282, 283, 284], [312, 313, 314], [342, 343, 344]];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) g.upper[idx(5 + dx, 9 + dy)] = floe[dy]![dx]!;
  // 오른쪽 급류(부빙 강) — 검푸른 깊은 물
  rect(g, 17, 6, 20, 14, 403);
  plankBridgeH(g, 16, 21, 10);                    // 급류 위 다리(상위 레이어)
  // 소품
  g.upper[idx(14, 12)] = 345; // 펭귄
  g.upper[idx(13, 8)] = 315;  // 눈뭉치
  g.upper[idx(14, 6)] = 350; g.upper[idx(23, 12)] = 351; // 얼음 수정 대/소
  g.upper[idx(22, 8)] = 292;  // 푸른 수정
  g.upper[idx(4, 15)] = 125; g.upper[idx(6, 15)] = 155;  // 얼음 마법 블록
  return g;
}

const MAPS = [
  { id: "map_lava", name: "용암 동굴", grid: lavaMap(), start: { x: 14, y: 8 }, dump: "output/map-lava.json" },
  { id: "map_stone", name: "석재 홀", grid: stoneMap(), start: { x: 10, y: 10 }, dump: "output/map-stone.json" },
  { id: "map_ice", name: "얼음 동굴", grid: iceMap(), start: { x: 13, y: 12 }, dump: "output/map-ice.json" },
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
