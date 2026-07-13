/**
 * '방 연습' 프로젝트 생성 — 실내 10종(다양한 테마/사이즈, 40×40 대저택 포함).
 * - 산출물: output/docs/room-practice/project.json + 맵별 렌더 PNG(vision 검수용)
 * - --save 플래그: Supabase에 새 프로젝트(rpg-zzu-room-practice)로 업서트
 * 실행: npx tsx scripts/build-room-practice-project.mts [--save]
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  INTERIOR_ROOM_DEMO_PLANS,
  evaluateInteriorRoom,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapId } from "../src/project/types.ts";

void INTERIOR_ROOM_DEMO_PLANS;

const PLANS: readonly InteriorRoomPlan[] = [
  {
    mapId: "map_rp_hut_v1",
    name: "연습 · 오두막 (10×9)",
    width: 10,
    height: 9,
    wings: [{ x: 2, y: 4, w: 5, h: 3 }],
    door: { x: 4, y: 6 },
    theme: "storage",
    floorTile: 139, // 짚 돗자리
    seed: 11,
  },
  {
    mapId: "map_rp_bedroom_v1",
    name: "연습 · 아담한 침실 (12×10)",
    width: 12,
    height: 10,
    wings: [{ x: 2, y: 4, w: 8, h: 4 }],
    door: { x: 5, y: 7 },
    theme: "bedroom",
    seed: 12,
  },
  {
    mapId: "map_rp_study_l_v1",
    name: "연습 · ㄱ자 서재 (15×13)",
    width: 15,
    height: 13,
    // 남쪽 라인(y9)을 공유하는 본체+동측 포켓 — mid-room EDGE_S 버그 회피 관례.
    wings: [
      { x: 2, y: 4, w: 7, h: 6 },
      { x: 9, y: 7, w: 4, h: 3 },
    ],
    door: { x: 6, y: 9 },
    theme: "study",
    seed: 13,
  },
  {
    mapId: "map_rp_kitchen_dining_v1",
    name: "연습 · 주방+식당 (18×12, 방 2개)",
    width: 18,
    height: 12,
    wings: [],
    rooms: [
      { id: "kitchen", x: 3, y: 4, w: 5, h: 4, theme: "kitchen", floorTile: 12 }, // 주방은 돌바닥
      { id: "dining", x: 9, y: 4, w: 6, h: 4, theme: "dining" }, //  x9–14 (나무 바닥 유지)
    ],
    innerDoors: [{ x: 8, y: 5 }],
    door: { x: 11, y: 7 },
    theme: "dining",
    seed: 14,
  },
  {
    mapId: "map_rp_shop_v1",
    name: "연습 · 상점 홀 (14×11)",
    width: 14,
    height: 11,
    wings: [{ x: 2, y: 4, w: 10, h: 5 }],
    door: { x: 7, y: 8 },
    theme: "tavern",
    seed: 15,
  },
  {
    mapId: "map_rp_inn_floor_v1",
    name: "연습 · 여관 2층 (20×17, 객실 3+복도)",
    width: 20,
    height: 17,
    wings: [],
    rooms: [
      { id: "g1", x: 3, y: 4, w: 4, h: 3, theme: "bedroom" }, //  x3–6
      { id: "g2", x: 8, y: 4, w: 4, h: 3, theme: "bedroom" }, //  x8–11 (파티션 x7)
      { id: "g3", x: 13, y: 4, w: 4, h: 3, theme: "bedroom" }, // x13–16 (파티션 x12)
      { id: "hall", x: 3, y: 10, w: 14, h: 3, theme: "corridor" }, // 객실 앞 복도 — 공간 역할 분리(카운터 금지)
    ],
    innerDoors: [
      { x: 4, y: 7 },
      { x: 9, y: 7 },
      { x: 14, y: 7 },
    ],
    door: { x: 9, y: 12 },
    theme: "tavern",
    seed: 16,
  },
  {
    mapId: "map_rp_library_v1",
    name: "연습 · 대서재 (19×14)",
    width: 19,
    height: 14,
    wings: [{ x: 2, y: 4, w: 15, h: 7 }],
    door: { x: 9, y: 10 },
    theme: "study",
    floorTile: 102, // 나무 널 바닥
    seed: 17,
  },
  {
    mapId: "map_rp_cellar_v1",
    name: "연습 · 저장 창고 (17×10, 가로 홀)",
    width: 17,
    height: 10,
    wings: [{ x: 2, y: 4, w: 13, h: 3 }],
    door: { x: 8, y: 6 },
    theme: "storage",
    floorTile: 12, // 돌바닥 — 창고 재질 차별화(리뷰 반영)
    seed: 18,
  },
  {
    mapId: "map_rp_feast_hall_v1",
    name: "연습 · 연회장 ㄴ자 (18×15)",
    width: 18,
    height: 15,
    wings: [
      { x: 2, y: 4, w: 9, h: 8 },
      { x: 11, y: 9, w: 5, h: 3 },
    ],
    door: { x: 6, y: 11 },
    theme: "dining",
    wallMaterial: "gold-brick", // 연회장 — 금장 벽 + 붉은 카펫 상석 + 탁자 열 정렬(luxury 문법)
    seed: 19,
  },
  // ── 확장 10종 (2026-07-12, 20종 라운드): 도서관·저택 1층·창고·길드·병영·공방·안방·만찬장·골목 상점·여관 1층 ──
  {
    mapId: "map_rp_library_hall_v1",
    name: "연습 · 도서관 (24×16)",
    width: 24,
    height: 16,
    wings: [{ x: 2, y: 4, w: 20, h: 8 }],
    door: { x: 11, y: 11 },
    theme: "study",
    floorTile: 102, // 널 바닥
    seed: 21,
  },
  {
    mapId: "map_rp_manor_ground_v1",
    name: "연습 · 저택 1층 (30×26, 방 6개)",
    width: 30,
    height: 26,
    wings: [],
    rooms: [
      { id: "study", x: 3, y: 4, w: 9, h: 5, theme: "study" }, //     x3–11
      { id: "bedroom", x: 13, y: 4, w: 6, h: 5, theme: "bedroom" }, // x13–18 (파티션 x12)
      { id: "storage", x: 20, y: 4, w: 7, h: 5, theme: "storage", floorTile: 12 }, // x20–26 (파티션 x19)
      { id: "kitchen", x: 3, y: 12, w: 9, h: 5, theme: "kitchen", floorTile: 12 }, // y12–16 (수평 파티션 y9–11)
      { id: "dining", x: 13, y: 12, w: 14, h: 5, theme: "dining" }, // x13–26
      { id: "hall", x: 3, y: 20, w: 24, h: 3, theme: "corridor" }, //  저택 복도 — 흉상·갑옷 전시, 바닥 점유물 없음
    ],
    innerDoors: [
      { x: 6, y: 9 }, //   서재 → 주방
      { x: 15, y: 9 }, //  침실 → 식당
      { x: 22, y: 9 }, //  창고 → 식당
      { x: 12, y: 14 }, // 주방 ↔ 식당 (수직 1칸)
      { x: 7, y: 17 }, //  주방 → 홀
      { x: 18, y: 17 }, // 식당 → 홀
    ],
    door: { x: 14, y: 22 },
    theme: "tavern",
    wallMaterial: "gold-brick", // 귀족 저택 — 금장 벽돌 면 + 붉은 카펫
    seed: 22,
  },
  {
    mapId: "map_rp_warehouse_v1",
    name: "연습 · 대형 창고 (20×14)",
    width: 20,
    height: 14,
    wings: [{ x: 2, y: 4, w: 16, h: 6 }],
    door: { x: 9, y: 9 },
    theme: "storage",
    floorTile: 12,
    seed: 23,
  },
  {
    mapId: "map_rp_guildhall_v1",
    name: "연습 · 길드 홀 (22×15)",
    width: 22,
    height: 15,
    wings: [{ x: 2, y: 4, w: 18, h: 8 }],
    door: { x: 10, y: 11 },
    theme: "tavern",
    seed: 24,
  },
  {
    mapId: "map_rp_barracks_v1",
    name: "연습 · 병영 숙소 (21×16, 침상 3+홀)",
    width: 21,
    height: 16,
    wings: [],
    rooms: [
      { id: "bunk1", x: 3, y: 4, w: 4, h: 3, theme: "bedroom", floorTile: 139 },
      { id: "bunk2", x: 8, y: 4, w: 4, h: 3, theme: "bedroom", floorTile: 139 }, //  파티션 x7
      { id: "bunk3", x: 13, y: 4, w: 4, h: 3, theme: "bedroom", floorTile: 139 }, // 파티션 x12
      { id: "hall", x: 3, y: 10, w: 15, h: 3, theme: "dining" }, // 병영 식당(mess hall) — 술집 카운터 금지
    ],
    innerDoors: [
      { x: 4, y: 7 },
      { x: 9, y: 7 },
      { x: 14, y: 7 },
    ],
    door: { x: 10, y: 12 },
    theme: "tavern",
    seed: 25,
  },
  {
    mapId: "map_rp_atelier_v1",
    name: "연습 · 연금술 공방 (14×12)",
    width: 14,
    height: 12,
    wings: [{ x: 2, y: 4, w: 10, h: 5 }],
    door: { x: 6, y: 8 },
    theme: "kitchen", // 연금술 공방: 화덕+솥+단지 키트가 공방 문법에 가장 근접(3차 리뷰 "테마 전멸" 해소)
    floorTile: 12,
    seed: 26,
  },
  {
    mapId: "map_rp_master_bedroom_v1",
    name: "연습 · 안방 (15×12)",
    width: 15,
    height: 12,
    wings: [{ x: 2, y: 4, w: 11, h: 5 }],
    door: { x: 7, y: 8 },
    theme: "bedroom",
    seed: 27,
  },
  {
    mapId: "map_rp_dining_hall_v1",
    name: "연습 · 만찬장 (19×13)",
    width: 19,
    height: 13,
    wings: [{ x: 2, y: 4, w: 15, h: 6 }],
    door: { x: 9, y: 9 },
    theme: "dining",
    wallMaterial: "stone-brick", // 석재 벽 만찬장 — 벽 재질 변주 데모
    seed: 28,
  },
  {
    mapId: "map_rp_shop_small_v1",
    name: "연습 · 골목 상점 (12×10)",
    width: 12,
    height: 10,
    wings: [{ x: 2, y: 4, w: 8, h: 4 }],
    door: { x: 5, y: 7 },
    theme: "tavern",
    floorTile: 102,
    seed: 29,
  },
  {
    mapId: "map_rp_inn_ground_v1",
    name: "연습 · 여관 1층 (23×19, 방 5개)",
    width: 23,
    height: 19,
    wings: [],
    rooms: [
      { id: "pantry", x: 3, y: 4, w: 5, h: 3, theme: "storage", floorTile: 12 },
      { id: "guest1", x: 9, y: 4, w: 5, h: 3, theme: "bedroom" },
      { id: "guest2", x: 15, y: 4, w: 5, h: 3, theme: "bedroom" },
      { id: "kitchen", x: 3, y: 10, w: 5, h: 6, theme: "kitchen", floorTile: 12 },
      { id: "hall", x: 9, y: 10, w: 11, h: 6, theme: "tavern" },
    ],
    innerDoors: [
      { x: 5, y: 7 },
      { x: 11, y: 7 },
      { x: 17, y: 7 },
      { x: 8, y: 12 },
    ],
    door: { x: 12, y: 15 },
    theme: "tavern",
    seed: 30,
  },
  {
    mapId: "map_rp_manor_v1",
    name: "연습 · 대저택 층 (40×40, 방 13개)",
    width: 40,
    height: 40,
    wings: [],
    rooms: [
      // Row A — 바닥 y4–9
      { id: "a1", x: 3, y: 4, w: 8, h: 6, theme: "bedroom" }, //  x3–10
      { id: "a2", x: 12, y: 4, w: 8, h: 6, theme: "study" }, //   x12–19 (파티션 x11)
      { id: "a3", x: 21, y: 4, w: 7, h: 6, theme: "bedroom" }, // x21–27 (파티션 x20)
      { id: "a4", x: 29, y: 4, w: 8, h: 6, theme: "storage", floorTile: 12 }, // 창고는 돌바닥
      // Row B — 바닥 y13–18 (수평 파티션 y10–12)
      { id: "b1", x: 3, y: 13, w: 8, h: 6, theme: "kitchen", floorTile: 12 },
      { id: "b2", x: 12, y: 13, w: 8, h: 6, theme: "dining" },
      { id: "b3", x: 21, y: 13, w: 7, h: 6, theme: "study", floorTile: 102 },
      { id: "b4", x: 29, y: 13, w: 8, h: 6, theme: "bedroom" },
      // Row C — 바닥 y22–27 (수평 파티션 y19–21)
      { id: "c1", x: 3, y: 22, w: 8, h: 6, theme: "storage", floorTile: 12 },
      { id: "c2", x: 12, y: 22, w: 8, h: 6, theme: "bedroom" },
      { id: "c3", x: 21, y: 22, w: 7, h: 6, theme: "kitchen" },
      { id: "c4", x: 29, y: 22, w: 8, h: 6, theme: "study" },
      // Row D — 대연회 홀, 바닥 y31–34 (수평 파티션 y28–30)
      { id: "hall", x: 3, y: 31, w: 34, h: 4, theme: "tavern" },
    ],
    innerDoors: [
      // A→B 수평 문 (y10)
      { x: 5, y: 10 },
      { x: 14, y: 10 },
      { x: 23, y: 10 },
      { x: 31, y: 10 },
      // B행 수직 문
      { x: 11, y: 15 },
      { x: 20, y: 16 },
      { x: 28, y: 15 },
      // B→C 수평 문 (y19)
      { x: 6, y: 19 },
      { x: 15, y: 19 },
      { x: 24, y: 19 },
      { x: 32, y: 19 },
      // C행 수직 문
      { x: 11, y: 24 },
      { x: 28, y: 25 },
      // C→홀 수평 문 (y28)
      { x: 5, y: 28 },
      { x: 14, y: 28 },
      { x: 23, y: 28 },
      { x: 31, y: 28 },
    ],
    door: { x: 19, y: 34 },
    theme: "tavern",
    wallMaterial: "gold-brick", // 귀족 저택 — 금장 벽돌 면 + 붉은 카펫
    seed: 20,
  },
];

// ── 빌드 ─────────────────────────────────────────────────────────────────────
const outDir = path.resolve("output/docs/room-practice");
fs.mkdirSync(outDir, { recursive: true });

// --reroll N: 전 플랜 시드를 밀어 완전히 새 배치 판을 뽑는다(구조/테마는 유지).
const rerollIdx = process.argv.indexOf("--reroll");
const reroll = rerollIdx >= 0 ? Number(process.argv[rerollIdx + 1] ?? "1") : 0;

// 시드 재추첨 루프: 평가 불합격이면 시드를 밀어 다시 뽑는다(최대 12회). 합격 판만 채택.
const MAX_TRIES = 12;
const maps: GameMap[] = [];
const failed: string[] = [];
for (const plan of PLANS) {
  const baseSeed = (plan.seed ?? 1) + reroll * 97;
  let best: { map: GameMap; report: ReturnType<typeof evaluateInteriorRoom>; seed: number; tries: number } | null = null;
  for (let k = 0; k < MAX_TRIES; k += 1) {
    const rolled = { ...plan, seed: baseSeed + k * 131 };
    const result = runInteriorRoomPipeline(rolled);
    const report = evaluateInteriorRoom(result.map, rolled);
    if (!best || report.score > best.report.score) best = { map: result.map, report, seed: rolled.seed, tries: k + 1 };
    if (report.ok) break;
  }
  const { map, report, seed, tries } = best!;
  maps.push(map);
  const grade = report.ok ? "합격" : "불합격";
  console.log(
    `built ${plan.mapId} (${plan.width}×${plan.height}, theme=${plan.theme}, seed=${seed}, tries=${tries}) — ${grade} score=${report.score}${report.issues.length ? ` | ${report.issues.join(" / ")}` : ""}`,
  );
  if (!report.ok) failed.push(plan.mapId);
}

// 계단 스탬프 — 파이프라인 이후에 찍으므로 그 칸의 가구를 걷어낸다.
// 465~467 붉은 카펫 대계단은 귀족 전용(사용자 확정)이라 서민 여관에는 쓰지 않는다:
// 하행은 어둠 하강 계단 474|475 쌍, 상행은 대각 계단 444 한 칸(전형적 쯔꾸르 문법).
const TALL_PAIR_TOPS = new Set([263, 269, 389, 88, 87]);
function stampStairs(map: GameMap, cells: ReadonlyArray<{ x: number; y: number; tile: number }>): void {
  for (const { x, y, tile } of cells) {
    map.lowerTiles[y * map.width + x] = tile;
    map.upperTiles[y * map.width + x] = -1;
    const above = (y - 1) * map.width + x;
    if (TALL_PAIR_TOPS.has(map.upperTiles[above]!)) map.upperTiles[above] = -1;
  }
}

// 여관 '2층' 설정 보정: 남쪽 출구를 아래층으로 내려가는 어둠 계단참으로 표현(474|475 쌍).
{
  const inn = maps.find((m) => m.id === "map_rp_inn_floor_v1");
  const plan = PLANS.find((p) => p.mapId === "map_rp_inn_floor_v1");
  if (inn && plan) {
    stampStairs(inn, [
      { x: plan.door.x, y: plan.door.y, tile: 474 },
      { x: plan.door.x + 1, y: plan.door.y, tile: 475 },
    ]);
    console.log(`inn descending stairs (474|475) at (${plan.door.x}~${plan.door.x + 1}, ${plan.door.y})`);
  }
}

// 여관 1층: 2층으로 올라가는 대각 계단 한 칸(444)을 홀 동쪽 끝 벽에 붙임.
{
  const inn = maps.find((m) => m.id === "map_rp_inn_ground_v1");
  if (inn) {
    stampStairs(inn, [{ x: 18, y: 10, tile: 444 }]);
    console.log(`inn-ground ascending stair (444) at (18, 10)`);
  }
}

const project = createBlankProject();
const startMapId: MapId = maps[0]!.id;
(project as { maps: Record<MapId, GameMap> }).maps = Object.fromEntries(maps.map((m) => [m.id, m])) as Record<MapId, GameMap>;
(project as { mapTree: unknown }).mapTree = {
  mapId: startMapId,
  children: maps.slice(1).map((m) => ({ mapId: m.id, children: [] })),
};
(project as { startMapId: MapId }).startMapId = startMapId;
(project as { startPos: { x: number; y: number } }).startPos = { x: PLANS[0]!.door.x, y: PLANS[0]!.door.y };
project.meta = { ...project.meta, title: "방 연습" };

fs.writeFileSync(path.join(outDir, "project.json"), JSON.stringify(project));
console.log(`project.json written — maps=${Object.keys(project.maps).length}, title=${project.meta.title}`);

// ── 렌더(vision 검수용) ───────────────────────────────────────────────────────
const T = 16;
const COLS = 30;
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));
const tileset = project.tilesets.easyrpg_chipset_interior!;
const { chipsetQuarterComposition } = await import("../src/project/defaults/terrainQuarterAutotile.ts");

function blitTile(dst: PNG, tile: number, dx: number, dy: number, scale: number, q?: { sx: number; sy: number; sw: number; sh: number }): void {
  if (tile < 0) return;
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  const sx0 = col * T + (q?.sx ?? 0);
  const sy0 = row * T + (q?.sy ?? 0);
  const sw = q?.sw ?? T;
  const sh = q?.sh ?? T;
  for (let y = 0; y < sh * scale; y += 1) {
    for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      dst.data[di] = chip.data[si]!;
      dst.data[di + 1] = chip.data[si + 1]!;
      dst.data[di + 2] = chip.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
}

for (const map of maps) {
  const scale = map.width >= 30 ? 2 : 3;
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 20; png.data[i + 1] = 18; png.data[i + 2] = 24; png.data[i + 3] = 255;
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const lower = map.lowerTiles[i]!;
      const upper = map.upperTiles[i]!;
      const dx = x * T * scale;
      const dy = y * T * scale;
      const composition = chipsetQuarterComposition(map, tileset, x, y);
      if (composition) {
        blitTile(png, composition.underlayTile ?? lower, dx, dy, scale);
        for (const src of composition.sources) {
          blitTile(png, src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
        }
      } else if (lower >= 0) blitTile(png, lower, dx, dy, scale);
      if (upper >= 0) blitTile(png, upper, dx, dy, scale);
    }
  }
  const file = path.join(outDir, `${map.id}.png`);
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log("rendered", file);
}

// ── Supabase 저장 (--save) ────────────────────────────────────────────────────
if (process.argv.includes("--save")) {
  if (failed.length) {
    console.error(`저장 중단 — 평가 불합격 ${failed.length}건: ${failed.join(", ")}`);
    process.exit(1);
  }
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  const config = {
    url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
    anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
    projectId: "rpg-zzu-room-practice",
  };
  if (!config.url || !config.anonKey) throw new Error(".env.local에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필요");
  const result = await saveProjectToSupabase(project, config);
  console.log(`Supabase 저장: ${result.kind} — projectId=${config.projectId}`);
}
