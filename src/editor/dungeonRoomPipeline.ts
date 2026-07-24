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
import {
  ICE_DIAGONAL_TILES,
  stampCanonicalIceRidge,
  validateIceDiagonalTerrain,
} from "@/project/defaults/iceDiagonalTerrain";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";
import type { RoomEvalReport, RoomLayerResult } from "@/editor/roomHarness/types";
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
  readonly hazardKind: "lava" | "chasm" | "ice-ridge";
  readonly hazardBody: number;                             // 오토타일 브러시(lava/chasm) 또는 단일 타일(rapids)
};

const THEME: Record<DungeonRoomTheme, ThemeSpec> = {
  lava: { ceilKey: "pit-gold", ceilBody: 310, floorKey: "redrock", floorBody: 301, wallTop: [102, 103, 104], wallBottom: [132, 133, 134], hazardKind: "lava", hazardBody: 304 },
  stone: { ceilKey: "abyss-gray", ceilBody: 430, floorKey: "stone", floorBody: 187, wallTop: [21, 22, 23], wallBottom: [51, 52, 53], hazardKind: "chasm", hazardBody: 190 },
  ice: { ceilKey: "abyss-blue", ceilBody: 427, floorKey: "snow", floorBody: 67, wallTop: [372, 373, 374], wallBottom: [402, 403, 404], hazardKind: "ice-ridge", hazardBody: 67 },
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

/** 던전 방 시공 레이어 순서 — 세션 체크리스트/advance 순서. */
export const DUNGEON_ROOM_BUILD_ORDER = ["plan", "ceiling", "wall", "floor", "hazard", "critique"] as const;
export type DungeonRoomLayer = (typeof DUNGEON_ROOM_BUILD_ORDER)[number];

function cloneDungeonMap(map: GameMap): GameMap {
  return { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles], events: [...(map.events ?? [])] };
}

function hazardRect(W: number, H: number): { hx0: number; hx1: number; hy0: number; hy1: number } {
  return { hx0: Math.floor(W / 2) - 3, hx1: Math.floor(W / 2) + 2, hy0: H - 7, hy1: H - 4 };
}

/** 던전 방 레이어 1개를 시공한다(맵 사본 반환). */
export function applyDungeonRoomLayer(map: GameMap, plan: DungeonRoomPlan, layer: string): RoomLayerResult {
  const W = plan.width, H = plan.height;
  const spec = THEME[plan.theme];
  const next = cloneDungeonMap(map);
  const lower = next.lowerTiles;
  const upper = next.upperTiles;
  const idx = (x: number, y: number) => y * W + x;
  const warnings: string[] = [];

  switch (layer) {
    case "plan": {
      if (W < 8 || H < 8) warnings.push(`방이 작습니다(${W}×${H}) — 8×8 이상 권장`);
      if (plan.theme === "ice" && plan.hazard !== false && (W < 16 || H < 18)) {
        warnings.push(`canonical ice ridge requires at least 16x18, received ${W}x${H}`);
      }
      return { map, ok: warnings.length === 0, summary: `plan ${plan.theme} ${W}×${H}`, warnings };
    }
    case "ceiling": {
      // 천장(공허) 프레임: 바깥 2링. 안쪽 링만 성형.
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        if (!(x >= 2 && x <= W - 3 && y >= 3 && y <= H - 3)) lower[idx(x, y)] = spec.ceilBody;
      }
      const ceilPts: { x: number; y: number }[] = [];
      for (let y = 1; y <= H - 2; y += 1) for (let x = 1; x <= W - 2; x += 1)
        if (x === 1 || x === W - 2 || y === 2 || y === H - 2) ceilPts.push({ x, y });
      shapeAutotileGroupAround({ width: W, height: H, lowerTiles: lower }, terrainGroup(spec.ceilKey), ceilPts);
      return { map: next, ok: true, summary: `ceiling ${spec.ceilKey} frame`, warnings };
    }
    case "wall": {
      // 천장 하단 벽: 직선 [좌끝·증식·우끝] 2단(대각 금지).
      const x0 = 2, x1 = W - 3, yTop = 2;
      for (let x = x0; x <= x1; x += 1) {
        const c = x === x0 ? 0 : x === x1 ? 2 : 1;
        lower[idx(x, yTop)] = spec.wallTop[c]!;
        lower[idx(x, yTop + 1)] = spec.wallBottom[c]!;
      }
      return { map: next, ok: true, summary: `wall band ${spec.wallTop.join("/")} below ceiling`, warnings };
    }
    case "floor": {
      // 바닥은 createEmptyMap이 이미 채움 — 방 안쪽(벽 아래)을 몸통으로 재확정.
      for (let y = 4; y <= H - 3; y += 1) for (let x = 2; x <= W - 3; x += 1) lower[idx(x, y)] = spec.floorBody;
      return { map: next, ok: true, summary: `floor ${spec.floorKey}`, warnings };
    }
    case "hazard": {
      if (plan.hazard === false) return { map, ok: true, summary: "hazard 생략", warnings };
      if (spec.hazardKind === "ice-ridge") {
        const ridge = stampCanonicalIceRidge(
          { width: W, height: H, lower },
          { x: Math.floor((W - 12) / 2), y: Math.floor((H - 9) / 2) + 1 },
        );
        if (!ridge.ok) {
          warnings.push(...ridge.issues.map((item) => `ice ridge ${item.code} at ${item.x},${item.y}`));
          return { map, ok: false, summary: "canonical ice ridge rejected", warnings };
        }
        lower.splice(0, lower.length, ...ridge.lower);
        return { map: next, ok: true, summary: "canonical user-authored ice ridge", warnings };
      }
      const { hx0, hx1, hy0, hy1 } = hazardRect(W, H);
      const pts: { x: number; y: number }[] = [];
      for (let y = hy0; y <= hy1; y += 1) for (let x = hx0; x <= hx1; x += 1) { lower[idx(x, y)] = spec.hazardBody; pts.push({ x, y }); }
      shapeAutotileGroupAround({ width: W, height: H, lowerTiles: lower }, terrainGroup(spec.hazardKind), pts);
      const bridgeY = Math.floor((hy0 + hy1) / 2);
      for (let x = hx0 - 1; x <= hx1 + 1; x += 1) upper[idx(x, bridgeY)] = x === hx0 - 1 ? PLANK_H.left : x === hx1 + 1 ? PLANK_H.right : PLANK_H.mid;
      return { map: next, ok: true, summary: `hazard ${spec.hazardKind} + plank bridge (upper layer)`, warnings };
    }
    case "critique": {
      const report = evaluateDungeonRoom(map, plan);
      return { map, ok: report.ok, summary: report.ok ? `critique 합격 (score ${report.score})` : `critique ${report.issues.length}건`, warnings: [...report.issues] };
    }
    default:
      warnings.push(`알 수 없는 레이어: ${layer}`);
      return { map, ok: false, summary: `unknown layer ${layer}`, warnings };
  }
}

/** 던전 방을 원샷 절차 생성한다(모든 레이어 순서 시공). */
export function runDungeonRoomPipeline(plan: DungeonRoomPlan): { map: GameMap; log: string[]; warnings: string[]; ok: boolean } {
  let map = createEmptyDungeonRoomMap(plan);
  const log: string[] = [];
  const warnings: string[] = [];
  for (const layer of DUNGEON_ROOM_BUILD_ORDER) {
    const r = applyDungeonRoomLayer(map, plan, layer);
    map = r.map;
    log.push(`[${layer}] ${r.summary}`);
    warnings.push(...r.warnings);
  }
  return { map, log, warnings, ok: warnings.length === 0 };
}

/** 완성 던전 방을 평가한다(실내 리포트 계약 정렬: ok/score/issues). */
export function evaluateDungeonRoom(map: GameMap, plan: DungeonRoomPlan, attempt = 1): RoomEvalReport {
  const W = map.width;
  const spec = THEME[plan.theme];
  const at = (x: number, y: number) => map.lowerTiles[y * W + x]!;
  const issues: string[] = [];

  // 1) 천장 프레임: 코너가 천장 그룹 멤버.
  const ceilSet = new Set(terrainGroup(spec.ceilKey).memberTileIds);
  if (!ceilSet.has(at(0, 0))) issues.push("천장 프레임 없음(코너 미시공)");

  // 2) 천장 하단 직선 벽(대각 금지).
  const diagonals = new Set([16, 17, 432, 433, 286, 287, 316, 317, 346, 347]);
  let wallStraight = true;
  for (let x = 2; x <= W - 3; x += 1) {
    const t = at(x, 2);
    if (diagonals.has(t)) issues.push(`천장 하단 벽에 대각 타일 (${x},2)`);
    if (!spec.wallTop.includes(t as never)) wallStraight = false;
  }
  if (!wallStraight) issues.push("천장 하단 직선 벽 미완");

  // 3) 바닥 몸통.
  if (at(Math.floor(W / 2), 5) !== spec.floorBody) issues.push("바닥 미완");

  // 4) hazard 시 상위 레이어 판자 다리.
  if (plan.hazard !== false) {
    if (plan.theme === "ice") {
      const expected = [
        ICE_DIAGONAL_TILES.left.cap,
        ICE_DIAGONAL_TILES.left.body,
        ICE_DIAGONAL_TILES.left.base,
        ICE_DIAGONAL_TILES.right.cap,
        ICE_DIAGONAL_TILES.right.body,
        ICE_DIAGONAL_TILES.right.base,
      ];
      if (expected.some((tile) => !map.lowerTiles.includes(tile))) issues.push("canonical ice ridge tiles missing");
      const terrainIssues = validateIceDiagonalTerrain({ width: map.width, height: map.height, lower: map.lowerTiles });
      issues.push(...terrainIssues.map((item) => `ice ridge ${item.code} at ${item.x},${item.y}`));
    } else {
      const hasPlank = map.upperTiles.some((t) => t === PLANK_H.left || t === PLANK_H.mid || t === PLANK_H.right);
      if (!hasPlank) issues.push("판자 다리 없음(위험지형 위)");
    }
  }

  const score = Math.max(0, 100 - issues.length * 25);
  const report = {
    ok: issues.length === 0,
    score,
    issues,
    metrics: { theme: plan.theme, attempt },
    feedbackForLlm: issues.length ? issues.join("; ") : "던전 방 구조 합격",
  };
  return report;
}

export const DUNGEON_ROOM_DEMO_PLANS: readonly DungeonRoomPlan[] = [
  { mapId: "map_dungeon_lava", name: "용암 동굴", width: 26, height: 18, theme: "lava" },
  { mapId: "map_dungeon_stone", name: "석재 홀", width: 26, height: 18, theme: "stone" },
  { mapId: "map_dungeon_ice", name: "얼음 동굴", width: 26, height: 18, theme: "ice" },
];
