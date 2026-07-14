/**
 * dungeon-room-v1 절차 던전 방 하네스 — 테마별(용암/석재/얼음) 던전 방을 한 번에 시공한다.
 * (interiorRoomPipeline.ts의 던전판. 룸 세션 파이프라인 = 이 에디터의 "하네싱" 패턴.)
 *
 * 방 구조(2D 쿼터뷰, 2026-07-14 사용자 확정):
 *   테마 천장(공허)이 방을 감싸고, 벽 면은 천장 "하단"(남향)에만 보인다.
 *   좌/우/하단은 벽 면 없이 천장이 바닥과 바로 만난다.
 *   천장 하단 벽은 직선 [좌끝·가로증식·우끝] 2단(대각 금지).
 *
 * 레이어: ceiling(천장 프레임) → wall(천장 하단 직선 벽) → floor(바닥 오토타일) → hazard(용암/구덩이/급류 + 판자 다리).
 */
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { DEFAULT_TILE_SIZE, TILE } from "@/project/defaults/constants";
import { createDungeonTerrainAutotileGroups, DUNGEON_TERRAIN_AUTOTILE_PREFIX } from "@/project/defaults/dungeonTerrainAutotiles";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";
import type { AutotileGroup, GameMap, Project } from "@/project/types";

export const DUNGEON_ROOM_KIT_ID = "dungeon-room-v1" as const;
export const DUNGEON_ROOM_TILESET_ID = "easyrpg_chipset_dungeon";

export type DungeonRoomTheme = "lava" | "stone" | "ice";
export const DUNGEON_ROOM_THEMES: readonly DungeonRoomTheme[] = ["lava", "stone", "ice"];

export type DungeonRoomPlan = {
  readonly mapId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly theme: DungeonRoomTheme;
  /** 중앙 위험지형(용암/구덩이/급류) + 판자 다리 배치 여부. 기본 true. */
  readonly hazard?: boolean;
};

// 테마별 벽 세트 — 천장(공허 오토타일) + 천장 하단 직선 벽 밴드[좌끝·증식·우끝]/아랫줄 + 바닥 브러시 + 위험지형.
type ThemeSpec = {
  readonly ceilKey: "abyss-blue" | "abyss-gray" | "pit-gold";
  readonly ceilBody: number;
  readonly floorKey: "redrock" | "stone" | "snow";
  readonly floorBody: number;
  readonly wallTop: readonly [number, number, number];    // 천장 하단 벽 윗줄 [좌끝·증식·우끝]
  readonly wallBottom: readonly [number, number, number];  // 아랫줄
  readonly hazardKind: "lava" | "chasm" | "rapids";
  readonly hazardBody: number;                             // 오토타일 브러시(lava/chasm) 또는 단일 타일(rapids)
};

const THEME: Record<DungeonRoomTheme, ThemeSpec> = {
  lava: { ceilKey: "pit-gold", ceilBody: 310, floorKey: "redrock", floorBody: 301, wallTop: [102, 103, 104], wallBottom: [132, 133, 134], hazardKind: "lava", hazardBody: 304 },
  stone: { ceilKey: "abyss-gray", ceilBody: 430, floorKey: "stone", floorBody: 187, wallTop: [21, 22, 23], wallBottom: [51, 52, 53], hazardKind: "chasm", hazardBody: 190 },
  ice: { ceilKey: "abyss-blue", ceilBody: 427, floorKey: "snow", floorBody: 67, wallTop: [372, 373, 374], wallBottom: [402, 403, 404], hazardKind: "rapids", hazardBody: 403 },
};

// 판자 다리(상위 레이어) — 위험지형 위에 뜬다.
const PLANK_H = { left: 252, mid: 253, right: 254 } as const;

/** 던전 타일셋에 던전 테마 팩(지형 오토타일 포함)이 시드됐는지 보장한다. */
export function ensureDungeonRoomHarness(project: Project): boolean {
  const ts = project.tilesets[DUNGEON_ROOM_TILESET_ID];
  if (!ts) return false;
  return applyEasyRpgThemeMetadataPacks(ts);
}

export function createEmptyDungeonRoomMap(plan: DungeonRoomPlan): GameMap {
  const spec = THEME[plan.theme];
  return {
    id: plan.mapId,
    name: plan.name,
    width: plan.width,
    height: plan.height,
    tilesetId: DUNGEON_ROOM_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array(plan.width * plan.height).fill(spec.floorBody),
    upperTiles: new Array(plan.width * plan.height).fill(TILE.EMPTY),
    events: [],
  };
}

function terrainGroup(key: string): AutotileGroup {
  const g = createDungeonTerrainAutotileGroups().find((c) => c.id === `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
  if (!g) throw new Error(`dungeon terrain group missing: ${key}`);
  return g;
}

/** 던전 방을 원샷 절차 생성한다. */
export function runDungeonRoomPipeline(plan: DungeonRoomPlan): { map: GameMap; log: string[]; warnings: string[]; ok: boolean } {
  const W = plan.width, H = plan.height;
  const spec = THEME[plan.theme];
  const map = createEmptyDungeonRoomMap(plan);
  const lower = map.lowerTiles;
  const upper = map.upperTiles;
  const idx = (x: number, y: number) => y * W + x;
  const log: string[] = [];
  const warnings: string[] = [];

  if (W < 8 || H < 8) warnings.push(`방이 작습니다(${W}×${H}) — 8×8 이상 권장`);

  // ── 1. 천장(공허) 프레임: 바깥 2링. 안쪽 링만 성형. ─────────────
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!(x >= 2 && x <= W - 3 && y >= 3 && y <= H - 3)) lower[idx(x, y)] = spec.ceilBody;
  }
  const ceilPts: { x: number; y: number }[] = [];
  for (let y = 1; y <= H - 2; y += 1) for (let x = 1; x <= W - 2; x += 1)
    if (x === 1 || x === W - 2 || y === 2 || y === H - 2) ceilPts.push({ x, y });
  shapeAutotileGroupAround({ width: W, height: H, lowerTiles: lower }, terrainGroup(spec.ceilKey), ceilPts);
  log.push(`ceiling ${spec.ceilKey} frame`);

  // ── 2. 천장 하단 벽: 직선 [좌끝·증식·우끝] 2단(대각 금지). ────────
  const x0 = 2, x1 = W - 3, yTop = 2;
  for (let x = x0; x <= x1; x += 1) {
    const c = x === x0 ? 0 : x === x1 ? 2 : 1;
    lower[idx(x, yTop)] = spec.wallTop[c]!;
    lower[idx(x, yTop + 1)] = spec.wallBottom[c]!;
  }
  log.push(`wall band ${spec.wallTop.join("/")} below ceiling`);

  // ── 3. 바닥은 blank가 이미 채움. (오토타일 성형 불필요 — 전면 몸통) ─
  log.push(`floor ${spec.floorKey}`);

  // ── 4. 위험지형 + 판자 다리(상위 레이어). ────────────────────────
  if (plan.hazard !== false) {
    const hx0 = Math.floor(W / 2) - 3, hx1 = Math.floor(W / 2) + 2;
    const hy0 = H - 7, hy1 = H - 4;
    const pts: { x: number; y: number }[] = [];
    for (let y = hy0; y <= hy1; y += 1) for (let x = hx0; x <= hx1; x += 1) { lower[idx(x, y)] = spec.hazardBody; pts.push({ x, y }); }
    if (spec.hazardKind !== "rapids") {
      shapeAutotileGroupAround({ width: W, height: H, lowerTiles: lower }, terrainGroup(spec.hazardKind), pts);
    }
    const bridgeY = Math.floor((hy0 + hy1) / 2);
    for (let x = hx0 - 1; x <= hx1 + 1; x += 1) upper[idx(x, bridgeY)] = x === hx0 - 1 ? PLANK_H.left : x === hx1 + 1 ? PLANK_H.right : PLANK_H.mid;
    log.push(`hazard ${spec.hazardKind} + plank bridge (upper layer)`);
  }

  return { map, log, warnings, ok: warnings.length === 0 };
}

export const DUNGEON_ROOM_DEMO_PLANS: readonly DungeonRoomPlan[] = [
  { mapId: "map_dungeon_lava", name: "용암 동굴", width: 26, height: 18, theme: "lava" },
  { mapId: "map_dungeon_stone", name: "석재 홀", width: 26, height: 18, theme: "stone" },
  { mapId: "map_dungeon_ice", name: "얼음 동굴", width: 26, height: 18, theme: "ice" },
];
