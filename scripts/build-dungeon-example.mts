/**
 * 던전 예시 프로젝트 빌더 — 던전 지형 오토타일(harness-dungeon-v1-terrain-*) 데모.
 * easyrpg_chipset_dungeon 타일셋 위에 석재 홀 + 왕좌의 방(카펫) + 용암 동굴 +
 * 구덩이/판자 다리 + 이끼 정원을 오토타일 성형으로 깔고 Supabase 에 저장한다.
 *
 * 실행: npx tsx scripts/build-dungeon-example.mts
 * 프로젝트 ID: rpg-zzu-dungeon-example (에디터 연결 폼에서 이 ID 로 전환해 확인)
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
const MAP_ID = "map_dungeon_example";
const MAP_NAME = "던전 예시 (오토타일 데모)";
const W = 36;
const H = 24;

// 브러시(몸통) 타일 — dungeonTerrainAutotiles.ts 블록 좌표에서 파생.
const STONE = 187; //   회록 석재 바닥 몸통
const DIRT = 421; //    흙바닥 몸통
const MOSS = 424; //    이끼 수풀 몸통
const REDROCK = 301; // 적암 바닥 몸통
const LAVA = 304; //    용암 몸통
const CHASM = 190; //   석재 균열 구덩이 몸통
const ABYSS = 427; //   심연(푸른 테두리) 몸통
const PIT_GOLD = 310; //어둠 구덩이(금장) 몸통
const CARPET = 169; //  붉은 카펫 몸통(9-슬라이스)
const PLANK_TOP = 171;
const PLANK_MID = 201;
const PLANK_BOTTOM = 231;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};

const project: Project = createEmptyToolProject("던전 예시");
project.meta.title = "던전 예시 — 지형 오토타일 데모";
ensureTilesetHarnesses(project);

const tileset = project.tilesets[TILESET_ID];
if (!tileset) throw new Error(`dungeon tileset missing: ${TILESET_ID}`);
const autotileGroups = tileset.autotileGroups ?? [];
if (!autotileGroups.some((group) => group.id.startsWith(DUNGEON_TERRAIN_AUTOTILE_PREFIX))) {
  throw new Error("dungeon terrain autotile groups not seeded");
}

const lower = new Array<number>(W * H).fill(STONE);
const upper = new Array<number>(W * H).fill(-1);
const at = (x: number, y: number) => y * W + x;
const paintRect = (tiles: number[], x0: number, y0: number, x1: number, y1: number, tile: number, skip?: (x: number, y: number) => boolean) => {
  const points: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (skip?.(x, y)) continue;
      tiles[at(x, y)] = tile;
      points.push({ x, y });
    }
  }
  return points;
};

const groups = createDungeonTerrainAutotileGroups();
const groupByKey = (key: string): AutotileGroup => {
  const group = groups.find((candidate) => candidate.id === `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
  if (!group) throw new Error(`autotile group missing: ${key}`);
  return group;
};
const mapView = { width: W, height: H, lowerTiles: lower };
const shape = (key: string, points: { x: number; y: number }[]) => shapeAutotileGroupAround(mapView, groupByKey(key), points);

// ── 1. 심연 테두리(두께 3) + 왕좌의 방 벽 ───────────────────────────────
// 성형 포인트는 안쪽 링만 — 바깥 두 링은 몸통(칠흑)으로 남겨 맵 가장자리가 매끈하다.
paintRect(lower, 0, 0, W - 1, H - 1, ABYSS, (x, y) => x >= 3 && x <= 32 && y >= 3 && y <= 20);
const abyssPoints: { x: number; y: number }[] = [];
for (let y = 2; y <= 21; y += 1) {
  for (let x = 2; x <= 33; x += 1) {
    if (x === 2 || x === 33 || y === 2 || y === 21) abyssPoints.push({ x, y });
  }
}
// 왕좌의 방 벽: 세로(x24~25) + 가로(y10~11, 남쪽 문 x28~29 개방)
abyssPoints.push(...paintRect(lower, 24, 3, 25, 11, ABYSS, (_x, y) => y === 6 || y === 7)); // 서쪽 문 y6~7
abyssPoints.push(...paintRect(lower, 26, 10, 32, 11, ABYSS, (x) => x === 28 || x === 29));
shape("abyss-blue", abyssPoints);

// ── 2. 이끼 정원(북서): 흙 패치 성형 후 이끼 blob 성형 ─────────────────
shape("dirt", paintRect(lower, 4, 4, 11, 9, DIRT));
shape("moss", paintRect(lower, 5, 5, 8, 8, MOSS));

// ── 3. 용암 동굴(남서): 적암 패치 성형 후 용암 blob 성형 ───────────────
shape("redrock", paintRect(lower, 4, 13, 12, 19, REDROCK));
shape("lava", paintRect(lower, 6, 15, 10, 18, LAVA));

// ── 4. 균열 구덩이(남중앙) + 판자 다리 ─────────────────────────────────
const chasmPoints = paintRect(lower, 15, 13, 20, 19, CHASM, (x) => x === 17);
lower[at(17, 13)] = PLANK_TOP;
for (let y = 14; y <= 18; y += 1) lower[at(17, y)] = PLANK_MID;
lower[at(17, 19)] = PLANK_BOTTOM;
shape("chasm", chasmPoints);

// ── 5. 금장 구덩이(남동) ───────────────────────────────────────────────
shape("pit-gold", paintRect(lower, 27, 14, 30, 17, PIT_GOLD));

// ── 6. 왕좌의 방(북동): 붉은 카펫 9-슬라이스 + 왕좌/석주/횃불 ──────────
shape("red-carpet", paintRect(lower, 27, 4, 31, 8, CARPET));
upper[at(28, 4)] = 448; upper[at(29, 4)] = 449; // 왕좌 상단
upper[at(28, 5)] = 478; upper[at(29, 5)] = 479; // 왕좌 하단
upper[at(26, 4)] = 446; upper[at(26, 5)] = 476; // 석주(서)
upper[at(32, 4)] = 446; upper[at(32, 5)] = 476; // 석주(동)
upper[at(27, 3)] = 263; upper[at(31, 3)] = 263; // 횃불

// ── 7. 홀 중앙 마법진(3×2, 441~443/471~473) + 소품 ─────────────────────
// 촛대 아치(27~29)는 별개 장식 — 마법진과 픽셀이 이어지지 않으므로 겹치지 않는다.
const CIRCLE = [
  [441, 442, 443],
  [471, 472, 473],
] as const;
for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 3; dx += 1) upper[at(13 + dx, 8 + dy)] = CIRCLE[dy]![dx]!;
upper[at(5, 11)] = 261; //  종유석
upper[at(21, 5)] = 262; //  푸른 수정
upper[at(20, 12)] = 299; // 해골
upper[at(30, 12)] = 417; // 나무통
upper[at(31, 12)] = 418; // 항아리
upper[at(18, 16)] = 267; // 구덩이 위 박쥐
upper[at(4, 3)] = 263; upper[at(11, 3)] = 263; // 홀 횃불

const map: GameMap = {
  id: MAP_ID,
  name: MAP_NAME,
  width: W,
  height: H,
  tilesetId: TILESET_ID,
  tileSize: 16,
  lowerTiles: lower,
  upperTiles: upper,
  events: [],
};
project.maps[MAP_ID] = map;
project.startMapId = MAP_ID;
project.startPos = { x: 13, y: 12 };
project.mapTree = { mapId: MAP_ID, children: [] };

console.log("[map]", MAP_ID, `${W}x${H}`, "tileset", TILESET_ID);
console.log("[autotile]", autotileGroups.filter((group) => group.id.startsWith(DUNGEON_TERRAIN_AUTOTILE_PREFIX)).length, "groups");

fs.mkdirSync("output", { recursive: true });
fs.writeFileSync("output/dungeon-example-map.json", JSON.stringify({ width: W, height: H, lowerTiles: lower, upperTiles: upper }, null, 0));
console.log("[dump] output/dungeon-example-map.json");

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
const verifyMap = verify?.maps[MAP_ID];
const verifyGroups = (verify?.tilesets[TILESET_ID]?.autotileGroups ?? []).filter((group) => group.id.startsWith(DUNGEON_TERRAIN_AUTOTILE_PREFIX));
console.log("[verify]", verify?.meta?.title, verifyMap ? `${verifyMap.width}x${verifyMap.height}` : null, "autotileGroups", verifyGroups.length);
if (!verifyMap || verifyMap.tilesetId !== TILESET_ID || verifyGroups.length !== 13) {
  throw new Error("dungeon example verify failed");
}
console.log("[done] 에디터 연결 폼에서 projectId 를", PROJECT_ID, "로 바꿔 열기");
