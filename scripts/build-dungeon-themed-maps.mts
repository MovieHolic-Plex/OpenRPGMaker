/**
 * 던전 테마별 자연 맵 3종 — 용암 / 석재 / 얼음.
 * 각 맵은 하나의 방처럼 구성한다: 천장(심연) 테두리 + 바닥 오토타일 + 대각 절벽/지형 + 소품.
 * 실행: npx tsx scripts/build-dungeon-themed-maps.mts
 * projectId: rpg-zzu-dungeon-example (맵 트리에 3맵), JSON 덤프: output/map-{lava,stone,ice}.json
 */
import fs from "node:fs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { shapeAutotileGroupAround } from "../src/project/defaults/autotileEngine.ts";
import { createDungeonTerrainAutotileGroups, DUNGEON_TERRAIN_AUTOTILE_PREFIX } from "../src/project/defaults/dungeonTerrainAutotiles.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { AutotileGroup, GameMap, Project } from "../src/project/types.ts";

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
function blank(fill: number): Grid {
  return { lower: new Array<number>(W * H).fill(fill), upper: new Array<number>(W * H).fill(-1) };
}
const idx = (x: number, y: number) => y * W + x;
function group(key: string): AutotileGroup {
  const g = groups.find((c) => c.id === `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
  if (!g) throw new Error(`missing group ${key}`);
  return g;
}
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, tile: number, skip?: (x: number, y: number) => boolean) {
  const pts: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    if (skip?.(x, y)) continue;
    g.lower[idx(x, y)] = tile; pts.push({ x, y });
  }
  return pts;
}
function shape(g: Grid, key: string, pts: { x: number; y: number }[]) {
  shapeAutotileGroupAround({ width: W, height: H, lowerTiles: g.lower }, group(key), pts);
}
// 심연(천장) 테두리 — 바깥 2링은 통짜, 안쪽 링만 성형
function ceilingBorder(g: Grid, key: "abyss-blue" | "abyss-gray", body: number) {
  rect(g, 0, 0, W - 1, H - 1, body, (x, y) => x >= 2 && x <= W - 3 && y >= 2 && y <= H - 3);
  const pts: { x: number; y: number }[] = [];
  for (let y = 1; y <= H - 2; y += 1) for (let x = 1; x <= W - 2; x += 1)
    if (x === 1 || x === W - 2 || y === 1 || y === H - 2) pts.push({ x, y });
  shape(g, key, pts);
}
// 대각 절벽(적암/석재) 배치 — 상단 능선 + 면 몸통 반복 + 발치
function redCliff(g: Grid, x0: number, x1: number, yTop: number, height: number) {
  for (let x = x0; x <= x1; x += 1) g.lower[idx(x, yTop)] = (x - x0) % 2 === 0 ? 17 : 16; // 톱니 능선
  for (let y = yTop + 1; y < yTop + height; y += 1) for (let x = x0; x <= x1; x += 1)
    g.lower[idx(x, y)] = (x - x0) % 2 === 0 ? 47 : 46; // 면 몸통
}
function stoneCliff(g: Grid, x0: number, x1: number, yTop: number, height: number) {
  for (let x = x0; x <= x1; x += 1) g.lower[idx(x, yTop)] = x === x0 ? 432 : x === x1 ? 434 : 433;
  for (let y = yTop + 1; y < yTop + height; y += 1) for (let x = x0; x <= x1; x += 1)
    g.lower[idx(x, y)] = x === x0 ? 462 : x === x1 ? 464 : 463;
}
function iceCliff(g: Grid, x0: number, x1: number, yTop: number) {
  for (let x = x0; x <= x1; x += 1) { g.lower[idx(x, yTop)] = 286; g.lower[idx(x, yTop + 1)] = (x - x0) % 2 === 0 ? 316 : 317; g.lower[idx(x, yTop + 2)] = (x - x0) % 2 === 0 ? 346 : 347; }
}

// ───────────────────────── 용암 동굴 ─────────────────────────
function lavaMap(): Grid {
  const g = blank(301); // 적암 바닥
  ceilingBorder(g, "abyss-blue", 427);
  // 뒤쪽 적암 대각 절벽(봉우리 능선 + 면) — 방 위쪽 벽
  redCliff(g, 3, 12, 2, 3);
  g.lower[idx(7, 3)] = 75; // 얼굴 부조를 면에 박음
  g.upper[idx(4, 2)] = 263; g.upper[idx(11, 2)] = 263; // 절벽 위 횃불
  // 용암 호수(적암 shore + 용암) — 중앙 하단
  shape(g, "redrock", rect(g, 3, 10, 14, 15, 301));
  shape(g, "lava", rect(g, 5, 11, 12, 14, 304));
  // 판자 다리 가로지름
  for (let x = 5; x <= 12; x += 1) g.lower[idx(x, 12)] = x === 5 ? 252 : x === 12 ? 254 : 253;
  // 오른쪽 붉은 카펫 제단 + 왕좌
  shape(g, "red-carpet", rect(g, 18, 5, 22, 8, 169));
  g.upper[idx(19, 5)] = 447; g.upper[idx(20, 5)] = 448; g.upper[idx(21, 5)] = 449;
  g.upper[idx(19, 6)] = 477; g.upper[idx(20, 6)] = 478; g.upper[idx(21, 6)] = 479;
  g.upper[idx(18, 5)] = 446; g.upper[idx(18, 6)] = 476; g.upper[idx(22, 5)] = 446; g.upper[idx(22, 6)] = 476;
  // 제단 발치 적암 계단
  for (let x = 19; x <= 21; x += 1) g.lower[idx(x, 9)] = 105 + (x - 19);
  // 소품
  g.upper[idx(16, 12)] = 293; g.upper[idx(16, 11)] = 208; // 모닥불
  g.upper[idx(19, 12)] = 299; // 해골
  g.upper[idx(21, 12)] = 320; g.upper[idx(22, 12)] = 321; // 수정
  g.upper[idx(3, 8)] = 261; // 종유석
  return g;
}

// ───────────────────────── 석재 홀 ─────────────────────────
function stoneMap(): Grid {
  const g = blank(187); // 석재 바닥
  ceilingBorder(g, "abyss-gray", 430);
  // 뒤쪽 석재 대각 절벽
  stoneCliff(g, 3, 10, 2, 3);
  // 균열 구덩이 + 판자 다리
  const pit = rect(g, 15, 9, 20, 14, 190, (x) => x === 17);
  g.lower[idx(17, 9)] = 171; for (let y = 10; y <= 13; y += 1) g.lower[idx(17, y)] = 201; g.lower[idx(17, 14)] = 231;
  shape(g, "chasm", pit);
  // 마법진 + 수호상(여신상/가고일)
  const cx = 6, cy = 9;
  const circle = [[441, 442, 443], [471, 472, 473], [27, 28, 29]];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) g.upper[idx(cx + dx, cy + dy)] = circle[dy]![dx]!;
  g.upper[idx(cx - 1, cy)] = 145; g.upper[idx(cx - 1, cy + 1)] = 175;
  g.upper[idx(cx + 3, cy)] = 146; g.upper[idx(cx + 3, cy + 1)] = 176;
  // 석조 돔(용광로)
  for (let dx = 0; dx < 3; dx += 1) { g.upper[idx(21 + dx, 4)] = 438 + dx; g.upper[idx(21 + dx, 5)] = 468 + dx; g.upper[idx(21 + dx, 6)] = 24 + dx; }
  // 서재
  g.upper[idx(11, 12)] = 329; g.upper[idx(11, 13)] = 359; // 책장
  g.upper[idx(12, 13)] = 385; g.upper[idx(13, 13)] = 386; g.upper[idx(14, 13)] = 387; // 긴 탁자
  g.upper[idx(9, 12)] = 294; g.upper[idx(9, 13)] = 324; g.upper[idx(9, 14)] = 354; // 세로 책상
  g.upper[idx(8, 13)] = 356; // 스툴
  g.upper[idx(13, 12)] = 357; // 의자
  // 감옥
  g.upper[idx(21, 12)] = 204; g.upper[idx(22, 12)] = 205; g.upper[idx(23, 12)] = 206;
  g.upper[idx(21, 13)] = 234; g.upper[idx(22, 13)] = 235; g.upper[idx(23, 13)] = 236;
  // 벽 갈라진 틈 + 횃불
  g.upper[idx(13, 1)] = 268; g.upper[idx(14, 1)] = 269;
  g.upper[idx(4, 8)] = 263; g.upper[idx(20, 8)] = 263;
  return g;
}

// ───────────────────────── 얼음 동굴 ─────────────────────────
function iceMap(): Grid {
  const g = blank(67); // 눈밭
  ceilingBorder(g, "abyss-blue", 427);
  // 벽 위 눈 캡(천장 링 아래)
  for (let x = 4; x <= 20; x += 3) { g.upper[idx(x, 1)] = 237; g.upper[idx(x + 1, 1)] = 238; g.upper[idx(x + 2, 1)] = 239; }
  // 대각 빙벽(얼음 폭포) — 뒤쪽 벽
  iceCliff(g, 3, 8, 2);
  // 얼음판 연못(오토타일) + 부빙 9-슬라이스 수동 배치
  shape(g, "ice", rect(g, 4, 9, 12, 13, 70));
  const floe = [[282,283,284],[312,313,314],[342,343,344]];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) g.upper[idx(6 + dx, 10 + dy)] = floe[dy]![dx]!;
  // 오른쪽 급류(부빙 강)
  shape(g, "snow", rect(g, 15, 6, 22, 15, 67));
  // 얼음 벽 기둥 — 빙벽 오른쪽 끝에 붙여 자연스럽게
  g.lower[idx(9, 2)] = 285; g.lower[idx(9, 3)] = 285;
  // 우측 급류 강(부빙 주변 검푸른 물)
  for (let y = 10; y <= 14; y += 1) for (let x = 18; x <= 20; x += 1) g.lower[idx(x, y)] = 403;
  // 소품
  g.upper[idx(17, 9)] = 345; // 펭귄
  g.upper[idx(19, 11)] = 315; // 눈뭉치
  g.upper[idx(20, 8)] = 350; g.upper[idx(21, 12)] = 351; // 얼음 수정 대/소
  g.upper[idx(16, 13)] = 262; g.upper[idx(18, 6)] = 292; // 푸른 수정
  // 얼음 마법 블록
  g.upper[idx(9, 15)] = 125; g.upper[idx(11, 15)] = 155;
  return g;
}

const MAPS: { id: string; name: string; grid: Grid; start: { x: number; y: number }; dump: string }[] = [
  { id: "map_lava", name: "용암 동굴", grid: lavaMap(), start: { x: 8, y: 8 }, dump: "output/map-lava.json" },
  { id: "map_stone", name: "석재 홀", grid: stoneMap(), start: { x: 6, y: 13 }, dump: "output/map-stone.json" },
  { id: "map_ice", name: "얼음 동굴", grid: iceMap(), start: { x: 13, y: 9 }, dump: "output/map-ice.json" },
];

fs.mkdirSync("output", { recursive: true });
for (const m of MAPS) {
  const map: GameMap = { id: m.id, name: m.name, width: W, height: H, tilesetId: TILESET_ID, tileSize: 16, lowerTiles: m.grid.lower, upperTiles: m.grid.upper, events: [] };
  project.maps[m.id] = map;
  fs.writeFileSync(m.dump, JSON.stringify({ width: W, height: H, lowerTiles: m.grid.lower, upperTiles: m.grid.upper }));
  console.log("[map]", m.id, m.name, "->", m.dump);
}
project.startMapId = MAPS[0]!.id;
project.startPos = MAPS[0]!.start;
project.mapTree = { mapId: MAPS[0]!.id, children: MAPS.slice(1).map((m) => ({ mapId: m.id, children: [] })) };

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);
const verify = await loadProjectFromSupabase(config);
const ok = MAPS.every((m) => verify?.maps[m.id]?.width === W);
console.log("[verify]", verify?.meta?.title, "maps:", MAPS.map((m) => m.id).filter((id) => verify?.maps[id]).length, "/", MAPS.length);
if (!ok) throw new Error("themed maps verify failed");
console.log("[done]");
