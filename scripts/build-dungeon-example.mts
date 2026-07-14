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
    // 북쪽 링(y2) 중 벽면 밴드가 바로 아래 깔리는 구간(x3~23, 26~32)은 성형하지 않는다 —
    // 칠흑 몸통이 암벽 상단과 바로 맞닿아야 발광 테두리가 이중으로 생기지 않는다.
    if (y === 2 && x >= 3 && x <= 23) continue;
    if (y === 2 && x >= 26 && x <= 32) continue;
    if (x === 2 || x === 33 || y === 2 || y === 21) abyssPoints.push({ x, y });
  }
}
// 왕좌의 방 벽: 세로(x24~25) + 가로(y10~11, 남쪽 문 x28~29 개방)
abyssPoints.push(...paintRect(lower, 24, 3, 25, 11, ABYSS, (_x, y) => y === 6 || y === 7)); // 서쪽 문 y6~7
abyssPoints.push(...paintRect(lower, 26, 10, 32, 11, ABYSS, (x) => x === 28 || x === 29));
shape("abyss-blue", abyssPoints);

// ── 1.5 벽면 밴드(상단 2줄) — 심연이 아닌 실제 암벽 타일 사용 ───────────
// 잔해 벽(225~227 상 + 255~257 하)을 홀 북쪽에, 청록 석벽(18~20 상 + 48~50 하)을
// 왕좌의 방 북쪽에 깐다. 가로 반복은 3타일 주기, 얼굴 부조(20)는 포인트로 섞는다.
// 각 벽 계열은 [좌측 캡, 반복 몸통, 우측 캡] 3타일 구성 — 몸통만 반복해야 이음매가 없다.
const wallBand = (x0: number, x1: number, y0: number, top: readonly [number, number, number], bottom: readonly [number, number, number]) => {
  for (let x = x0; x <= x1; x += 1) {
    const pos = x === x0 ? 0 : x === x1 ? 2 : 1;
    lower[at(x, y0)] = top[pos];
    lower[at(x, y0 + 1)] = bottom[pos];
  }
};
wallBand(3, 23, 3, [225, 226, 227], [255, 256, 257]); // 홀 북벽 — 금갈색 잔해 암벽
// 왕좌의 방 북벽 — 갈색 암벽 상단(21~23) + 청록 뿌리 전이 하단(18/19 교차, 20 얼굴 부조)
for (let x = 26; x <= 32; x += 1) lower[at(x, 3)] = x === 26 ? 21 : x === 32 ? 23 : 22;
for (let x = 26; x <= 32; x += 1) lower[at(x, 4)] = (x - 26) % 2 === 0 ? 19 : 18;
lower[at(29, 4)] = 20; // 중앙 얼굴 부조
// 남쪽 용암지대 대각 절벽 — 봉우리 능선(17 좌하향＼ 만나 16 우하향, 봉우리 형태) 4폭 + 얼굴 부조 75 + 발치 계단
// 상단: [17 좌사면][16 우사면] 쌍을 반복해 톱니 능선. 가운데 열에 얼굴 부조(75)를 면 몸통에 박음.
const RED_TOP = [17, 16, 17, 16] as const;   // 대각 능선 톱니
for (let dx = 0; dx < 4; dx += 1) lower[at(21 + dx, 12)] = RED_TOP[dx]!;
for (let dx = 0; dx < 4; dx += 1) lower[at(21 + dx, 13)] = 47; // 면 몸통
lower[at(22, 13)] = 75;                        // 얼굴 부조를 면에 박음
for (let dx = 0; dx < 4; dx += 1) lower[at(21 + dx, 14)] = 107; // 절벽 발치 밴드
for (let dx = 0; dx < 4; dx += 1) lower[at(21 + dx, 15)] = 105 + (dx % 3); // 적암 계단

// ── 2. 이끼 정원(북서): 흙 패치 성형 후 이끼 blob 성형 ─────────────────
shape("dirt", paintRect(lower, 4, 6, 11, 10, DIRT));
shape("moss", paintRect(lower, 5, 7, 8, 9, MOSS));
// 설원 스팟(북서) — 눈밭 3×3 + 대각 빙벽(얼음 폭포) + 벽 위 눈(237~239) + 얼음 벽 1×2 + 펭귄 + 눈뭉치
shape("snow", paintRect(lower, 3, 5, 6, 7, 67));
// 잔해 벽 밴드(y3) 위에 쌓인 눈 캡 3연속
upper[at(3, 3)] = 237; upper[at(4, 3)] = 238; upper[at(5, 3)] = 239;
// 대각 빙벽(얼음 폭포) — 286 캡 위, 316(좌사면)+317(우사면) 아래로 뾰족
lower[at(3, 4)] = 286; lower[at(3, 5)] = 316; lower[at(3, 6)] = 346;
// 얼음 벽 1×2(설원 좌측 경계)
lower[at(2, 6)] = 285; lower[at(2, 7)] = 285;
upper[at(5, 6)] = 345; // 펭귄
upper[at(6, 7)] = 315; // 눈뭉치

// ── 3. 용암 동굴(남서): 적암 패치 성형 후 용암 blob 성형 ───────────────
shape("redrock", paintRect(lower, 4, 13, 12, 19, REDROCK));
shape("lava", paintRect(lower, 6, 15, 10, 18, LAVA));

// ── 4. 균열 구덩이(남중앙) + 판자 다리 ─────────────────────────────────
const chasmPoints = paintRect(lower, 15, 13, 20, 19, CHASM, (x) => x === 17);
lower[at(17, 13)] = PLANK_TOP;
for (let y = 14; y <= 18; y += 1) lower[at(17, y)] = PLANK_MID;
lower[at(17, 19)] = PLANK_BOTTOM;
shape("chasm", chasmPoints);

// ── 5. 금장 천장(남동) — 심연처럼 방 바깥을 채우는 미굴착 어둠 덩어리 ───
shape("pit-gold", paintRect(lower, 29, 15, 32, 20, PIT_GOLD));

// ── 6. 왕좌의 방(북동): 붉은 카펫 9-슬라이스 + 왕좌(3×2)/석주/횃불 ─────
shape("red-carpet", paintRect(lower, 27, 5, 31, 8, CARPET));
upper[at(28, 5)] = 447; upper[at(29, 5)] = 448; upper[at(30, 5)] = 449; // 왕좌 상단(왼팔걸이 447 포함)
upper[at(28, 6)] = 477; upper[at(29, 6)] = 478; upper[at(30, 6)] = 479; // 왕좌 하단
upper[at(26, 5)] = 446; upper[at(26, 6)] = 476; // 석주(서)
upper[at(32, 5)] = 446; upper[at(32, 6)] = 476; // 석주(동)
upper[at(27, 4)] = 263; upper[at(31, 4)] = 263; // 벽면 횃불 걸이
// 남쪽 문 발치 청록 계단(48~50) + 서쪽 문에 1×1 정면 계단(474/475)
lower[at(27, 12)] = 48; lower[at(28, 12)] = 49; lower[at(29, 12)] = 50;
upper[at(24, 6)] = 474; upper[at(25, 6)] = 475;

// ── 7. 홀 중앙 마법진(3×3) + 소품 ──────────────────────────────────────
// 팔레트 세로 순서가 파일 행과 다르다(상위레이어 6×8 블록 경계): 441~443 → 471~473 → 27~29.
const CIRCLE = [
  [441, 442, 443],
  [471, 472, 473],
  [27, 28, 29],
] as const;
for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) upper[at(13 + dx, 8 + dy)] = CIRCLE[dy]![dx]!;
// 마법진 좌우 수호상 — 여신상(145+175)·가고일(146+176) 세로쌍
upper[at(12, 8)] = 145; upper[at(12, 9)] = 175;
upper[at(16, 8)] = 146; upper[at(16, 9)] = 176;
// 석조 돔(3×3, 팔레트 순서 438~440/468~470/24~26) — 홀 동쪽
for (let dx = 0; dx < 3; dx += 1) {
  upper[at(18 + dx, 5)] = 438 + dx;
  upper[at(18 + dx, 6)] = 468 + dx;
  upper[at(18 + dx, 7)] = 24 + dx;
}
// 서재 코너 — 책장(329+359) + 긴 탁자(385~387) + 세로 책상(294+324+354) + 의자
upper[at(19, 9)] = 329; upper[at(19, 10)] = 359;
upper[at(20, 10)] = 385; upper[at(21, 10)] = 386; upper[at(22, 10)] = 387;
upper[at(21, 11)] = 357;
upper[at(23, 9)] = 294; upper[at(23, 10)] = 324; upper[at(23, 11)] = 354; // 세로 책상
upper[at(20, 11)] = 356; // 스툴
upper[at(22, 12)] = 293; upper[at(22, 11)] = 208; // 삼각 횃불 받침대 + 불꽃
// 침실 코너 — 가로 침대(415+416) + 통/항아리
upper[at(30, 12)] = 415; upper[at(31, 12)] = 416;
upper[at(32, 12)] = 417; upper[at(32, 13)] = 418;
// 홀 북벽에 어둠 통로(295+325, 용도 잠정) 부착
upper[at(14, 3)] = 295; upper[at(14, 4)] = 325;
upper[at(6, 4)] = 267; upper[at(19, 4)] = 268; upper[at(20, 4)] = 269; // 벽 갈라진 틈
// 광차 철로 — 세로(114+144)에서 곡선 85(북↔서)로 꺾어 가로(116+115)로 이어지는 L자 선로
upper[at(26, 13)] = 114;
for (let y = 14; y <= 18; y += 1) upper[at(26, y)] = 144;
upper[at(26, 19)] = 85; // 곡선 코너: 북에서 와서 서쪽으로
upper[at(20, 19)] = 115;
for (let x = 21; x <= 25; x += 1) upper[at(x, 19)] = 116;
// 판자 다리 양끝 1×1 계단(444 우측 오름 · 445 좌측 오름)
upper[at(17, 12)] = 444;
upper[at(17, 20)] = 445;
upper[at(9, 12)] = 261; //  종유석
upper[at(11, 15)] = 355; // 바닥 채광 입구(상위 레이어 — 투명부로 석재 바닥이 비쳐 빛 드는 느낌)
upper[at(23, 6)] = 262; //  푸른 수정
upper[at(20, 12)] = 299; // 해골
upper[at(12, 5)] = 297; //  벽 옆 사다리
upper[at(5, 4)] = 263; upper[at(11, 4)] = 263; upper[at(17, 4)] = 263; upper[at(22, 4)] = 263; // 홀 북벽 횃불 걸이

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
