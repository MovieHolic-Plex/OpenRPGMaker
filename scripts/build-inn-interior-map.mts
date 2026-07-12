/**
 * 여관 1층(map_inn_ground_v1) 실내 맵 생성 + PNG 렌더.
 *
 * 셸은 villager-room-v1의 **하우스 셸 walls 레이어**(paintHouseShellWalls)를 그대로 사용:
 * 북벽 2줄 크림 벽면(74/75/76 + 104/105/106) + 457 캡 + 측면 428/426 + 남측 397 +
 * 코너 233/258/456/458 + 396/398 알코브 문. 가구만 이 스크립트에서 수작업 배치한다.
 *
 * 실행: npx tsx scripts/build-inn-interior-map.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  applyInteriorRoomLayer,
  createEmptyRoomMap,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { createInteriorWallFrameAutotileGroup } from "../src/project/tilesetHarness/themePacks.ts";
import type { GameMap } from "../src/project/types.ts";

const T = {
  COUNTER_A: 200,
  COUNTER_B: 201,
  BOTTLE_CUP: 237,
  MEAL: 207,
  STOVE_TOP: 21,
  STOVE_BOT: 51,
  PIANO_L: 358,
  PIANO_R: 359,
  CLOCK_TOP: 389,
  CLOCK_BOT: 419,
  TORCH: 24,
  INN_SIGN: 57,
  TAVERN_SIGN: 58,
  WINDOW: 56,
  STOOL: 266,
  TABLE_L: 325,
  TABLE_R: 326,
  CHAIR_RIGHT: 297,
  CHAIR_LEFT: 298,
  BARREL: 205,
  BUCKET: 265,
  CARPET: [
    [375, 376, 377],
    [405, 406, 407],
    [435, 436, 437],
  ],
} as const;

const plan: InteriorRoomPlan = {
  mapId: "map_inn_ground_v1",
  name: "실내 · 여관 1층",
  width: 22,
  height: 15,
  wings: [{ x: 3, y: 5, w: 16, h: 7 }], // 바닥 y5–11 → 벽면 y3–4, 캡 y2
  door: { x: 11, y: 11 },
  theme: "tavern",
  seed: 7,
};
const FACE_BOT_Y = plan.wings[0]!.y - 1; // 크림 벽면 아랫줄(키 큰 가구 상단이 겹치는 행)
const FACE_TOP_Y = plan.wings[0]!.y - 2; // 크림 벽면 윗줄(벽걸이 행 — 벽 중앙 높이)
const NORTH_Y = plan.wings[0]!.y; //        북측 바닥 행(가구 등받이 행)

// 파이프라인 레이어: floor → walls(하우스 셸) → entrance. furniture 레이어는 건너뛰고 수작업.
let map: GameMap = createEmptyRoomMap(plan);
map = applyInteriorRoomLayer(map, plan, "floor").map;
map = applyInteriorRoomLayer(map, plan, "walls").map;
map = applyInteriorRoomLayer(map, plan, "entrance").map;

function setL(x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
}
function setU(x: number, y: number, tile: number): void {
  map.upperTiles[y * map.width + x] = tile;
}

// 모서리/알코브는 셸 함수가 설계된 조인트(233/258/456/458)로 성형한다 — 덧칠하지 않는다.

// ── 가구/데코 ──────────────────────────────────────────────────────────────────
// 벽걸이는 벽면 **윗줄**(밝은 크림) — 벽 중앙 높이. 아랫줄은 키 큰 가구 상단이 겹치는 행.
setU(5, FACE_TOP_Y, T.TORCH);
setU(6, FACE_TOP_Y, T.TAVERN_SIGN);
setU(8, FACE_TOP_Y, T.WINDOW);
setU(12, FACE_TOP_Y, T.INN_SIGN); // 문 정면 여관 간판
setU(16, FACE_TOP_Y, T.TORCH);
// 키 큰 가구(상단은 벽면 아랫줄, 하단은 북측 바닥 행) — 벽에서 한 칸 안쪽
setU(4, FACE_BOT_Y, T.STOVE_TOP);
setL(4, NORTH_Y, T.STOVE_BOT); //  화덕 하단(통행 차단)
setU(15, FACE_BOT_Y, T.CLOCK_TOP);
setU(15, NORTH_Y, T.CLOCK_BOT);
// 북측 바닥 행 등받이 가구/소품
setU(3, NORTH_Y, T.BARREL); //     화덕 옆 구석 술통
setU(16, NORTH_Y, T.PIANO_L);
setU(17, NORTH_Y, T.PIANO_R);
setU(18, NORTH_Y, T.BUCKET);
// 바 카운터(전면 뷰, lower solid) + 카운터 위 소품 + 바 앞 스툴
setL(3, 7, T.COUNTER_A);
setL(4, 7, T.COUNTER_B);
setL(5, 7, T.COUNTER_A);
setL(6, 7, T.COUNTER_B);
setU(4, 7, T.BOTTLE_CUP);
setU(5, 7, T.MEAL);
setU(4, 8, T.STOOL);
setU(6, 8, T.STOOL);
// 홀: 긴 탁자(325|326 hard 쌍) 2세트 + 양옆 의자
setU(10, 7, T.TABLE_L);
setU(11, 7, T.TABLE_R);
setU(9, 7, T.CHAIR_RIGHT);
setU(12, 7, T.CHAIR_LEFT);
setU(14, 9, T.TABLE_L);
setU(15, 9, T.TABLE_R);
setU(13, 9, T.CHAIR_RIGHT);
setU(16, 9, T.CHAIR_LEFT);
// 입구 카펫(3×3) — 문(11,11)까지 이어짐
for (let ry = 0; ry < 3; ry += 1) {
  for (let rx = 0; rx < 3; rx += 1) setL(10 + rx, 9 + ry, T.CARPET[ry]![rx]!);
}

// ── 크리틱(파이프라인 공용 검증: hard 쌍 + 벽걸이가 셸 벽면 위인지) ─────────────────
const critique = applyInteriorRoomLayer(map, plan, "critique");
console.log("critique:", critique.ok ? "pass" : critique.warnings);
if (!critique.ok) process.exitCode = 1;

// 크리틱 통과 후: 입구 이벤트를 카펫 위(11,11)가 아닌 문지방 혀 타일(11,12)로 내린다
// (에디터의 Ⓔ 마커가 카펫 정중앙에 얹혀 어수선해 보이는 문제).
map.events = (map.events ?? []).map((event) =>
  event.id === `ev_entrance_${map.id}` ? { ...event, x: plan.door.x, y: plan.door.y + 1 } : event,
);

// ── 산출물: 맵 JSON + PNG ─────────────────────────────────────────────────────
const outDir = path.resolve("output/docs/interior-room-v1");
fs.mkdirSync(path.join(outDir, "vision"), { recursive: true });
fs.writeFileSync(path.join(outDir, "map_inn_ground_v1.json"), JSON.stringify(map, null, 2));

const TILE_PX = 16;
const COLS = 30;
const SCALE = 3;
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));
const tileset = createBlankProject().tilesets.easyrpg_chipset_interior!;
void createInteriorWallFrameAutotileGroup; // (참조 유지 — 셸 멤버 대조 디버깅용)

function blitTile(
  dst: PNG,
  tile: number,
  dx: number,
  dy: number,
  quarter?: { sx: number; sy: number; sw: number; sh: number },
): void {
  if (tile < 0) return;
  const sx0 = (tile % COLS) * TILE_PX + (quarter?.sx ?? 0);
  const sy0 = Math.floor(tile / COLS) * TILE_PX + (quarter?.sy ?? 0);
  const sw = quarter?.sw ?? TILE_PX;
  const sh = quarter?.sh ?? TILE_PX;
  for (let y = 0; y < sh * SCALE; y += 1) {
    for (let x = 0; x < sw * SCALE; x += 1) {
      const si = ((sy0 + Math.floor(y / SCALE)) * chip.width + sx0 + Math.floor(x / SCALE)) * 4;
      if (chip.data[si + 3] === 0) continue;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      dst.data[di] = chip.data[si]!;
      dst.data[di + 1] = chip.data[si + 1]!;
      dst.data[di + 2] = chip.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
}

const png = new PNG({ width: map.width * TILE_PX * SCALE, height: map.height * TILE_PX * SCALE });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 20;
  png.data[i + 1] = 18;
  png.data[i + 2] = 24;
  png.data[i + 3] = 255;
}
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const dx = x * TILE_PX * SCALE;
    const dy = y * TILE_PX * SCALE;
    const composition = chipsetQuarterComposition(map, tileset, x, y);
    if (composition) {
      blitTile(png, composition.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const src of composition.sources) {
        blitTile(png, src.tile, dx + src.offsetX * SCALE, dy + src.offsetY * SCALE, {
          sx: src.offsetX,
          sy: src.offsetY,
          sw: 8,
          sh: 8,
        });
      }
    } else if (map.lowerTiles[i]! >= 0) blitTile(png, map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blitTile(png, map.upperTiles[i]!, dx, dy);
  }
}
const pngPath = path.join(outDir, "vision", "inn.png");
fs.writeFileSync(pngPath, PNG.sync.write(png));
console.log("wrote", pngPath);
console.log("events:", (map.events ?? []).map((e) => `${e.id}@(${e.x},${e.y})`).join(", "));
