/**
 * villager-room-v1 procedural interior pipeline (village-session style layers).
 *
 * Layers (multi-turn / one-shot):
 *   plan → floor (bbox) → walls → furniture → entrance → critique
 *
 * Walls: **하우스 셸(벽 프레임)** — 실내 하네스 벽 프레임 오토타일(105 브러시)로 링을 성형한 뒤
 * 북벽을 2줄 크림 벽면(위 74/75/76 + 아래 104/105/106)으로 올리고 457 캡을 얹는다.
 * 문은 남벽 개구부 + 396/398 알코브 기둥. (구 다크월 366 링은 동굴식 셸이라 집 실내에 쓰지 않는다.)
 *
 * Furniture surfaces:
 *   wallFace | againstWallFloor | cornerFloor | openFloor | floorDebris
 * Hard cluster: bed 355 left-of 356 (upper) — openwiki hard adjacency contract.
 */
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { DEFAULT_TILE_SIZE, TILE } from "@/project/defaults/constants";
import {
  createDarkWallAutotileGroup,
  DARK_WALL_AUTOTILE_GROUP_ID,
  DARK_WALL_TILE,
} from "@/project/defaults/darkWallAutotile";
import { createInteriorWallFrameAutotileGroup } from "@/project/tilesetHarness/themePacks";
import type {
  ClusterRule,
  GameEvent,
  GameMap,
  MapId,
  Project,
  TileGroupMetadata,
} from "@/project/types";

export const INTERIOR_ROOM_KIT_ID = "villager-room-v1" as const;
export const INTERIOR_ROOM_TILESET_ID = "easyrpg_chipset_interior";
/** @deprecated multi-row cream face; walls are now 366 dark-wall autotile ring */
export const INTERIOR_ROOM_FACE_ROWS = 1;
export const INTERIOR_ROOM_HARNESS_PREFIX = "harness-interior-house-v1-";

/** Brush for dark wall terrain — paint 366, autotile shapes edges/corners. */
export const WALL_BRUSH = DARK_WALL_TILE.BODY; // 366

/** House-shell wall brush — 벽 프레임 오토타일 몸통(크림 벽면). */
export const HOUSE_WALL_BRUSH = 105;

/**
 * 하우스 셸 타일 — map_interior_blank 골드 기준.
 * 크림 벽면은 위·아래 줄 모두 104(좌)/105(중)/106(우) 세트를 세로로 쌓는다.
 * 문은 남벽 트림 개구부: 서쪽 플랭크 398, 동쪽 플랭크 396(골드 좌우 방향),
 * 개구부 아래 행은 397 계단 + 양옆 257 기둥 받침(렌더 시 368 쿼터가 감쌈).
 */
export const HOUSE_WALL_FACE = {
  L: 104,
  M: 105,
  R: 106,
  /** 북벽 최상단 캡(트림) — 오토타일 edgeN. void로 끝나는 캡 끝은 233/258 조인트. */
  CAP: 457,
  DOOR_WEST: 398,
  DOOR_EAST: 396,
  DOOR_STEP: 397,
  DOOR_POST_BASE: 257,
} as const;

export const VR = {
  VOID: 430,
  FLOOR: 72,
  FLOOR_HOLE: 73,
  /** Dark wall body / brush (autotile). */
  BODY: DARK_WALL_TILE.BODY,
  INNER_L: 104,
  INNER_R: 106,
  EDGE_W: DARK_WALL_TILE.EDGE_WEST,
  EDGE_E: DARK_WALL_TILE.EDGE_EAST,
  EDGE_N: DARK_WALL_TILE.EDGE_NORTH,
  EDGE_S: DARK_WALL_TILE.EDGE_SOUTH,
  CORNER_NW: DARK_WALL_TILE.CORNER_NORTH_WEST,
  CORNER_NE: DARK_WALL_TILE.CORNER_NORTH_EAST,
  BEAM_SW: DARK_WALL_TILE.CORNER_SOUTH_WEST,
  BEAM_SE: DARK_WALL_TILE.CORNER_SOUTH_EAST,
  ALCOVE_L: 396,
  ALCOVE_R: 398,
  // 책장은 3×3 세트(좌 18/48/78 · 중 19/49/79 가로 반복 · 우 20/50/80) — 2026-07-12 fable 감사 확정.
  // 2×3 조립은 좌+우 열을 쓴다. (구버그: 하단을 78+79(좌+중)로 조립해 우측 프레임이 사라졌었음)
  BOOK_TL: 18,
  BOOK_TR: 20,
  BOOK_ML: 48,
  BOOK_MR: 50,
  BOOK_BL: 78,
  BOOK_BR: 80,
  WINDOW: 56,
  RELIGIOUS: 59,
  PICTURE_L: 114,
  PICTURE_R: 115,
  CABINET_U: 148,
  CABINET_L: 178,
  SWORD_RACK: 260,
  PLANT: 289,
  TABLE_TOP: 264,
  TABLE_BOT: 294,
  BOX: 295,
  CHAIR_RIGHT: 297,
  CHAIR_LEFT: 298,
  BED_L: 355,
  BED_R: 356,
  BROKEN_GLASS: 417,
  GRAIN: 471,
  STAIRS_DOWN: 475,
  // 2026-07-12 vision 감사로 추가된 가구 — kitchen/storage/tavern 테마용.
  /** 화덕 오븐 상단(21)+하단(51) — 불투명 lower 세로쌍, 북벽에 붙여 배치. */
  STOVE_TOP: 21,
  STOVE_BOT: 51,
  CAULDRON: 323,
  KETTLE: 235,
  BUCKET: 265,
  JARS: 350,
  FRUIT_SHELF: 25,
  SHELF_JARS: 320,
  CRATE: 55,
  BARREL: 205,
  TAVERN_SIGN: 58,
  LADDER: 472,
  /** 가로 긴 탁자 좌(325)|우(326) — 침대와 같은 hard 좌우쌍. */
  TABLE_L: 325,
  TABLE_R: 326,
  STOOL: 266,
  // 2026-07-12 감사 어휘 확장 — "소재 부족" 리뷰 해소. 전부 tileSemanticsInterior 정본 대조 완료.
  TABLE_R3: 327, //        긴 탁자 오른끝(325|326*|327 3칸 세트)
  PIANO_L: 357, //         보완 작화된 왼쪽 측판
  PIANO_M: 358,
  PIANO_R: 359,
  MIRROR_T: 269, //        대형 거울(세로 2칸, 벽 걸침)
  MIRROR_B: 299,
  CLOCK_T: 389, //         괘종시계(세로 2칸, 벽 걸침)
  CLOCK_B: 419,
  BUST_T: 88, //           흉상(석상, 세로 2칸)
  BUST_B: 118,
  ARMOR_T: 87, //          갑옷 전시대(세로 2칸)
  ARMOR_B: 117,
  DISPLAY_T: 263, //       물약·검 진열대(세로 2칸)
  DISPLAY_B: 293,
  SQUARE_TABLE: 328, //    사각 탁자(1칸) — 의자 짝 규칙의 기준 가구
  CRYSTAL_BALL: 329, //    수정구 점술대
  STAIRS_L: 465, //        가로 계단(좌·몸통 반복·우)
  STAIRS_M: 466,
  STAIRS_R: 467,
} as const;

// 3×3 러그(lower 카펫) — 청록/붉은 카펫 오토타일 세트의 테두리+몸통.
const RUG_TEAL: readonly (readonly number[])[] = [
  [279, 280, 281],
  [309, 310, 311],
  [339, 340, 341],
];
const RUG_RED: readonly (readonly number[])[] = [
  [375, 376, 377],
  [405, 406, 407],
  [435, 436, 437],
];
// 러그 위도 보행 가능 — isWalkFloor가 러그를 바닥으로 취급하지 않으면 러그가 가구 후보지를 잠식한다.
const RUG_TILE_SET = new Set<number>([...RUG_TEAL.flat(), ...RUG_RED.flat()]);

/** Where a prop may be placed. */
export type PropSurface =
  | "wallFace"
  | "againstWallFloor"
  | "cornerFloor"
  | "openFloor"
  | "floorDebris";

export const PROP_SURFACE: Readonly<Record<number, PropSurface>> = {
  [VR.WINDOW]: "wallFace",
  [VR.PICTURE_L]: "wallFace",
  [VR.PICTURE_R]: "wallFace",
  [VR.RELIGIOUS]: "wallFace",
  [VR.SWORD_RACK]: "wallFace",
  [VR.BED_L]: "againstWallFloor",
  [VR.BED_R]: "againstWallFloor",
  [VR.BOOK_TL]: "againstWallFloor",
  [VR.CABINET_U]: "againstWallFloor",
  [VR.PLANT]: "cornerFloor",
  [VR.GRAIN]: "cornerFloor",
  [VR.BOX]: "cornerFloor",
  [VR.TABLE_TOP]: "openFloor",
  [VR.TABLE_BOT]: "openFloor",
  [VR.CHAIR_LEFT]: "openFloor",
  [VR.CHAIR_RIGHT]: "openFloor",
  [VR.BROKEN_GLASS]: "floorDebris",
  [VR.FLOOR_HOLE]: "floorDebris",
  [VR.STAIRS_DOWN]: "floorDebris",
  // kitchen/storage/tavern 테마 가구.
  [VR.FRUIT_SHELF]: "wallFace",
  [VR.SHELF_JARS]: "wallFace",
  [VR.TAVERN_SIGN]: "wallFace",
  [VR.LADDER]: "wallFace",
  [VR.BUCKET]: "cornerFloor",
  [VR.JARS]: "cornerFloor",
  [VR.CRATE]: "cornerFloor",
  [VR.BARREL]: "cornerFloor",
  [VR.CAULDRON]: "openFloor",
  [VR.KETTLE]: "openFloor",
  [VR.TABLE_L]: "openFloor",
  [VR.TABLE_R]: "openFloor",
  [VR.TABLE_R3]: "openFloor",
  [VR.STOOL]: "openFloor",
  [VR.SQUARE_TABLE]: "openFloor",
  [VR.CRYSTAL_BALL]: "openFloor",
  [VR.MIRROR_T]: "againstWallFloor",
  [VR.CLOCK_T]: "againstWallFloor",
  [VR.BUST_T]: "againstWallFloor",
  [VR.ARMOR_T]: "againstWallFloor",
  [VR.DISPLAY_T]: "againstWallFloor",
  [VR.PIANO_L]: "againstWallFloor",
};

export type RoomLayer =
  | "plan"
  | "floor"
  | "walls"
  | "furniture"
  | "entrance"
  | "critique";

export const INTERIOR_ROOM_BUILD_ORDER: readonly RoomLayer[] = [
  "plan",
  "floor",
  "walls",
  "furniture",
  "entrance",
  "critique",
] as const;

export type Wing = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type DoorSpec = { readonly x: number; readonly y: number };

/**
 * 방 bbox — 골드 map_interior_blank의 "구역" 개념.
 * 상하 인접 방은 **3행 간격**(파티션: 트림 397 + 크림 벽면 ×2)을 두고 배치한다.
 * theme 생략 시 플랜 전체 테마를 따른다.
 */
export type RoomSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly theme?: InteriorRoomTheme;
  // 방별 바닥 재질(예: 돌바닥 12, 널 바닥 102, 돗자리 139). 미지정이면 plan.floorTile → 나무 바닥 72.
  readonly floorTile?: number;
};

export type InteriorRoomTheme = "bedroom" | "study" | "dining" | "kitchen" | "storage" | "tavern";

export const INTERIOR_ROOM_THEMES: readonly InteriorRoomTheme[] = [
  "bedroom",
  "study",
  "dining",
  "kitchen",
  "storage",
  "tavern",
] as const;

export type InteriorRoomPlan = {
  readonly mapId: MapId;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly wings: readonly Wing[];
  readonly door: DoorSpec;
  readonly theme: InteriorRoomTheme;
  readonly seed?: number;
  // 방 구조(bbox) — 지정 시 wings 대신 rooms 합집합이 바닥이 되고, 방마다 테마 가구를 배치한다.
  readonly rooms?: readonly RoomSpec[];
  // 방 사이 파티션 개구부 — 파티션 최상단(트림 행) 좌표. 세로로 바닥까지(최대 3칸) 뚫린다.
  readonly innerDoors?: readonly DoorSpec[];
  // 기본 바닥 재질 — 파이프라인 내부 표현은 72로 유지하고 가구 배치 후 리틴트한다.
  readonly floorTile?: number;
};

export type InteriorRoomSession = {
  readonly id: string;
  readonly plan: InteriorRoomPlan;
  readonly checklist: Record<RoomLayer, "open" | "done" | "failed">;
  readonly mapId: MapId;
  readonly log: string[];
};

export type BuildPhaseResult = {
  readonly map: GameMap;
  readonly layer: RoomLayer;
  readonly summary: string;
  readonly warnings: string[];
  readonly ok: boolean;
};

/** Hard adjacency: bed left 355 must sit immediately left of bed right 356 (upper). */
export function interiorBedHardRule(): ClusterRule {
  return {
    id: "r_interior_bed_h_pair",
    kind: "adjacency",
    strength: "hard",
    message: "가로 침대 좌(355)는 우(356) 바로 왼쪽에 있어야 합니다 (hard cluster).",
    params: { a: VR.BED_L, b: VR.BED_R, relation: "aLeftOfB" },
  };
}

/** Hard adjacency: long table left 325 must sit immediately left of right 326 (upper). */
export function interiorLongTableHardRule(): ClusterRule {
  return {
    id: "r_interior_long_table_h_pair",
    kind: "adjacency",
    strength: "hard",
    message: "긴 탁자 좌(325)는 우(326) 바로 왼쪽에 있어야 합니다 (hard cluster).",
    params: { a: VR.TABLE_L, b: VR.TABLE_R, relation: "aLeftOfB" },
  };
}

/** Hard adjacency: stove top 21 must sit immediately above bottom 51 (lower). */
export function interiorStoveHardRule(): ClusterRule {
  return {
    id: "r_interior_stove_v_pair",
    kind: "adjacency",
    strength: "hard",
    message: "화덕 오븐 상단(21)은 하단(51) 바로 위에 있어야 합니다 (hard cluster).",
    params: { a: VR.STOVE_TOP, b: VR.STOVE_BOT, relation: "aAboveB" },
  };
}

/** Hard adjacency: clock top 389 must sit immediately above bottom 419. */
export function interiorClockHardRule(): ClusterRule {
  return {
    id: "r_interior_clock_v_pair",
    kind: "adjacency",
    strength: "hard",
    message: "괘종시계 상단(389)은 하단(419) 바로 위에 있어야 합니다 (hard cluster).",
    params: { a: 389, b: 419, relation: "aAboveB" },
  };
}

export function interiorRoomTileGroups(): TileGroupMetadata[] {
  const bedRule = interiorBedHardRule();
  const tableRule = interiorLongTableHardRule();
  return [
    group("floor-wood", "실내 나무 바닥", "terrain", "lower", [VR.FLOOR, VR.FLOOR_HOLE], "floor bbox 채우기", {
      rules: [],
    }),
    group("house-shell", "하우스 셸(크림 벽면)", "wall", "lower", [
      HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R,
      HOUSE_WALL_FACE.CAP, HOUSE_WALL_FACE.DOOR_WEST, HOUSE_WALL_FACE.DOOR_EAST, HOUSE_WALL_FACE.DOOR_POST_BASE,
      233, 258, 456, 458, 426, 428, 397,
    ], "집 실내 표준 벽(골드 map_interior_blank 문법): 크림 면 104/105/106 ×2줄 + 457 캡 + 428/426 포스트 + 397 트림, 문은 398|72|396 + 아래 257·397·257"),
    group("wall-frame", "실내 벽 프레임(레거시 다크월)", "wall", "lower", [
      VR.BODY, VR.INNER_L, VR.INNER_R, VR.EDGE_W, VR.EDGE_E, VR.EDGE_N, VR.EDGE_S,
      VR.CORNER_NW, VR.CORNER_NE, VR.BEAM_SW, VR.BEAM_SE, VR.ALCOVE_L, VR.ALCOVE_R,
    ], "동굴/지하 셸 전용 — 집 실내는 house-shell 사용"),
    group("bed-horizontal", "가로 침대", "prop", "upper", [VR.BED_L, VR.BED_R], "북벽 안쪽 floor, 좌우 한 쌍", {
      layerHome: "upper",
      rules: [bedRule],
      patternGrammar: {
        kind: "horizontal_expandable",
        axis: "horizontal",
        minWidth: 2,
        minHeight: 1,
        preserveCaps: true,
        repeat: "source_order",
        parts: [
          { role: "leftCap", tileIds: [VR.BED_L] },
          { role: "rightCap", tileIds: [VR.BED_R] },
        ],
      },
    }),
    group("wall-mount", "벽면 장식", "prop", "upper", [
      VR.WINDOW, VR.PICTURE_L, VR.PICTURE_R, VR.RELIGIOUS, VR.SWORD_RACK,
    ], "wallFace upper only — 바닥 금지", { layerHome: "upper" }),
    group("corner-props", "구석 소품", "prop", "upper", [VR.GRAIN, VR.BOX, VR.PLANT, VR.BUCKET, VR.JARS, VR.CRATE, VR.BARREL], "cornerFloor only", {
      layerHome: "upper",
    }),
    group("floor-debris", "바닥 잔해", "prop", "mixed", [VR.BROKEN_GLASS, VR.FLOOR_HOLE, VR.STAIRS_DOWN], "floor only — 벽면 금지"),
    group("counter-top-props", "카운터 위 소품", "prop", "upper", [237, 235, 238], "술병/주전자/식기 — 카운터·탁자(lower 불투명) 위에만 배치", {
      layerHome: "upper",
    }),
    group("clock", "괘종시계", "prop", "upper", [389, 419], "상단 389는 벽면 행, 하단 419는 북측 바닥 행 — 세로 hard 쌍", {
      layerHome: "upper",
      rules: [interiorClockHardRule()],
      patternGrammar: {
        kind: "vertical_expandable",
        axis: "vertical",
        minWidth: 1,
        minHeight: 2,
        preserveCaps: true,
        repeat: "source_order",
        parts: [
          { role: "topCap", tileIds: [389] },
          { role: "bottomCap", tileIds: [419] },
        ],
      },
    }),
    group("kitchen-stove", "화덕 오븐", "building", "mixed", [VR.STOVE_TOP, VR.STOVE_BOT], "세로 2칸 쌍 — 상단 21은 벽면 행 upper, 하단 51은 북측 바닥 행 lower(통행 차단)", {
      rules: [interiorStoveHardRule()],
      patternGrammar: {
        kind: "vertical_expandable",
        axis: "vertical",
        minWidth: 1,
        minHeight: 2,
        preserveCaps: true,
        repeat: "source_order",
        parts: [
          { role: "topCap", tileIds: [VR.STOVE_TOP] },
          { role: "bottomCap", tileIds: [VR.STOVE_BOT] },
        ],
      },
    }),
    group("kitchen-props", "주방 소품", "prop", "upper", [VR.CAULDRON, VR.KETTLE, VR.FRUIT_SHELF, VR.SHELF_JARS], "가마솥/주전자는 openFloor, 선반은 wallFace", {
      layerHome: "upper",
    }),
    group("tavern-table", "긴 탁자", "prop", "upper", [VR.TABLE_L, VR.TABLE_R], "openFloor, 좌우 한 쌍", {
      layerHome: "upper",
      rules: [tableRule],
      patternGrammar: {
        kind: "horizontal_expandable",
        axis: "horizontal",
        minWidth: 2,
        minHeight: 1,
        preserveCaps: true,
        repeat: "source_order",
        parts: [
          { role: "leftCap", tileIds: [VR.TABLE_L] },
          { role: "rightCap", tileIds: [VR.TABLE_R] },
        ],
      },
    }),
    group("tavern-props", "선술집/창고 소품", "prop", "upper", [VR.STOOL, VR.TAVERN_SIGN, VR.LADDER], "간판/사다리는 wallFace, 스툴은 openFloor", {
      layerHome: "upper",
    }),
  ];
}

function group(
  suffix: string,
  name: string,
  role: TileGroupMetadata["role"],
  defaultLayer: TileGroupMetadata["defaultLayer"],
  tileIds: number[],
  placementRules: string,
  extra: Partial<TileGroupMetadata> = {},
): TileGroupMetadata {
  return {
    id: `${INTERIOR_ROOM_HARNESS_PREFIX}${suffix}`,
    name,
    role,
    defaultLayer,
    tileIds,
    description: placementRules,
    placementRules,
    confidence: "high",
    source: "bundled-default",
    ...extra,
  };
}

export function ensureInteriorRoomHarness(project: Project): boolean {
  const ts = project.tilesets[INTERIOR_ROOM_TILESET_ID];
  if (!ts) return false;
  let changed = false;

  // Dark wall 366 brush autotile (primary wall terrain).
  const dark = createDarkWallAutotileGroup();
  const existing = ts.autotileGroups ?? [];
  const idx = existing.findIndex((g) => g.id === DARK_WALL_AUTOTILE_GROUP_ID);
  if (idx < 0) {
    ts.autotileGroups = [...existing, dark];
    changed = true;
  } else if (JSON.stringify(existing[idx]!.variantMap) !== JSON.stringify(dark.variantMap)) {
    const next = [...existing];
    next[idx] = dark;
    ts.autotileGroups = next;
    changed = true;
  }

  const desired = interiorRoomTileGroups();
  const byId = new Map((ts.tileGroups ?? []).map((g) => [g.id, g]));
  for (const g of desired) {
    const prev = byId.get(g.id);
    if (!prev || JSON.stringify(prev.rules) !== JSON.stringify(g.rules) || prev.tileIds.join() !== g.tileIds.join()) {
      byId.set(g.id, g);
      changed = true;
    }
  }
  if (changed) ts.tileGroups = [...byId.values()];
  return changed;
}

// ── Phased build ────────────────────────────────────────────────────────────

export function createEmptyRoomMap(plan: InteriorRoomPlan): GameMap {
  return {
    id: plan.mapId,
    name: plan.name,
    width: plan.width,
    height: plan.height,
    tilesetId: INTERIOR_ROOM_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array(plan.width * plan.height).fill(VR.VOID),
    upperTiles: new Array(plan.width * plan.height).fill(TILE.EMPTY),
    events: [],
  };
}

export function runInteriorRoomPipeline(plan: InteriorRoomPlan): {
  readonly map: GameMap;
  readonly log: string[];
  readonly ok: boolean;
  readonly warnings: string[];
} {
  let map = createEmptyRoomMap(plan);
  const log: string[] = [];
  const warnings: string[] = [];
  for (const layer of INTERIOR_ROOM_BUILD_ORDER) {
    const result = applyInteriorRoomLayer(map, plan, layer);
    map = result.map;
    log.push(`[${layer}] ${result.summary}`);
    warnings.push(...result.warnings);
    if (!result.ok && layer === "critique") {
      return { map, log, ok: false, warnings };
    }
  }
  return { map, log, ok: true, warnings };
}

export function applyInteriorRoomLayer(
  map: GameMap,
  plan: InteriorRoomPlan,
  layer: RoomLayer,
): BuildPhaseResult {
  const warnings: string[] = [];
  switch (layer) {
    case "plan":
      return {
        map,
        layer,
        summary: `plan wings=${plan.wings.length} door=(${plan.door.x},${plan.door.y}) theme=${plan.theme}`,
        warnings,
        ok: true,
      };
    case "floor": {
      const next = cloneMap(map);
      paintFloorBboxes(next, plan);
      return { map: next, layer, summary: "floor bbox filled (72)", warnings, ok: true };
    }
    case "walls": {
      const next = cloneMap(map);
      const floor = floorMaskFromMap(next);
      paintHouseShellWalls(next, floor, plan.door, plan.innerDoors ?? []);
      return { map: next, layer, summary: "walls raised (house shell: cream face ×2 + cap)", warnings, ok: true };
    }
    case "furniture": {
      const next = cloneMap(map);
      const floor = floorMaskFromPlan(plan);
      paintFurniture(next, floor, plan);
      // 배치가 끝난 뒤 바닥 재질 교체 — 벽 문법·성형·러그는 72 기준으로 이미 완료된 상태.
      retintFloorMaterials(next, plan);
      return { map: next, layer, summary: `furniture theme=${plan.theme}`, warnings, ok: true };
    }
    case "entrance": {
      const next = cloneMap(map);
      placeEntranceEvent(next, plan.door);
      return {
        map: next,
        layer,
        summary: `entrance event at (${plan.door.x},${plan.door.y})`,
        warnings,
        ok: true,
      };
    }
    case "critique": {
      const issues = critiqueRoom(map, plan);
      return {
        map,
        layer,
        summary: issues.length === 0 ? "critique pass" : `critique ${issues.length} issue(s)`,
        warnings: issues,
        ok: issues.length === 0,
      };
    }
  }
}

// ── Floor then walls ────────────────────────────────────────────────────────

function paintFloorBboxes(map: GameMap, plan: InteriorRoomPlan): void {
  map.lowerTiles.fill(VR.VOID);
  map.upperTiles.fill(TILE.EMPTY);
  const floor = floorMaskFromPlan(plan);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (floor[y * map.width + x]) setL(map, x, y, VR.FLOOR);
    }
  }
}

/** rooms가 있으면 rooms 합집합, 없으면 wings 합집합. innerDoors는 파티션을 세로로 뚫는다. */
function floorMaskFromPlan(plan: InteriorRoomPlan): boolean[] {
  const floor = new Array(plan.width * plan.height).fill(false) as boolean[];
  const boxes: readonly Wing[] = plan.rooms && plan.rooms.length > 0 ? plan.rooms : plan.wings;
  const mark = (x: number, y: number) => {
    if (inBounds(x, y, plan.width, plan.height)) floor[y * plan.width + x] = true;
  };
  for (const box of boxes) {
    for (let dy = 0; dy < box.h; dy += 1) {
      for (let dx = 0; dx < box.w; dx += 1) mark(box.x + dx, box.y + dy);
    }
  }
  // 내부 문:
  //  - 수직 파티션(1열, 좌우가 이미 바닥) → 1칸만 뚫는다
  //  - 수평 파티션 → 트림 행에서 아래로 바닥에 닿을 때까지(최대 3칸 = 트림+벽면 2줄) 뚫는다
  for (const innerDoor of plan.innerDoors ?? []) {
    const idx = (dx: number, dy: number) => (innerDoor.y + dy) * plan.width + innerDoor.x + dx;
    const sideBySide =
      inBounds(innerDoor.x - 1, innerDoor.y, plan.width, plan.height)
      && inBounds(innerDoor.x + 1, innerDoor.y, plan.width, plan.height)
      && floor[idx(-1, 0)] === true
      && floor[idx(1, 0)] === true;
    if (sideBySide) {
      mark(innerDoor.x, innerDoor.y);
      continue;
    }
    for (let dy = 0; dy < 3; dy += 1) {
      const y = innerDoor.y + dy;
      if (!inBounds(innerDoor.x, y, plan.width, plan.height)) break;
      if (floor[y * plan.width + innerDoor.x]) break;
      mark(innerDoor.x, y);
    }
  }
  mark(plan.door.x, plan.door.y);
  return floor;
}

/** 방 bbox 내부로 제한한 바닥 마스크(방별 가구 배치용). */
function roomFloorMask(plan: InteriorRoomPlan, room: RoomSpec, floor: boolean[]): boolean[] {
  const mask = new Array(plan.width * plan.height).fill(false) as boolean[];
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const x = room.x + dx;
      const y = room.y + dy;
      if (inBounds(x, y, plan.width, plan.height) && floor[y * plan.width + x]) mask[y * plan.width + x] = true;
    }
  }
  return mask;
}

function floorMaskFromMap(map: GameMap): boolean[] {
  return map.lowerTiles.map((t) => t === VR.FLOOR);
}

/**
 * 바닥 재질 리틴트 — 나무 바닥(72)으로 완성된 셀만 room.floorTile/plan.floorTile로 교체한다.
 * 러그(카펫)·문턱·가구 하단(setL 조각)은 72가 아니므로 자동으로 보존된다.
 * 방 사이 복도 carve 셀은 어느 방 마스크에도 안 속해 기본 나무 바닥으로 남는다(의도).
 */
function retintFloorMaterials(map: GameMap, plan: InteriorRoomPlan): void {
  const retint = (mask: boolean[], tile: number | undefined) => {
    if (tile === undefined || tile === VR.FLOOR) return;
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i] && map.lowerTiles[i] === VR.FLOOR) map.lowerTiles[i] = tile;
    }
  };
  const rooms = plan.rooms ?? [];
  if (rooms.length > 0) {
    const floor = floorMaskFromPlan(plan);
    for (const room of rooms) {
      retint(roomFloorMask(plan, room, floor), room.floorTile ?? plan.floorTile);
    }
    return;
  }
  retint(floorMaskFromPlan(plan), plan.floorTile);
}

/**
 * 하우스 셸(벽 프레임) — map_interior_blank 골드의 벽 문법:
 * 1) Keep floor cells as 72
 * 2) Shell = 바닥 4-인접 링(대각 제외 — 남쪽 볼록 코너는 void로 남겨 렌더 쿼터가 감싼다)
 *    + 벽면 2줄(위/아래 모두 104/105/106) + 캡(457, void로 끝나면 233/258 조인트)
 * 3) Paint brush **105** → wall-frame autotile 성형 후 결정적 덮어쓰기:
 *    포스트(바닥/벽면 옆) 428/426, 남측 트림(바닥 아래) 397 — 마스크 오판으로 기둥이
 *    중간에 코너 타일로 바뀌는 것을 막는다
 * 4) 문: 남벽 트림 개구부(바닥) + 서 398 / 동 396 플랭크 + 아래 행 257·397·257 받침
 */
export function paintHouseShellWalls(
  map: GameMap,
  floor: boolean[],
  door: DoorSpec,
  innerDoors: readonly DoorSpec[] = [],
): void {
  const w = map.width;
  const h = map.height;
  const F = (x: number, y: number) =>
    inBounds(x, y, w, h) && floor[y * w + x] === true;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (F(x, y)) setL(map, x, y, VR.FLOOR);
    }
  }

  const shell: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number) => {
    if (!inBounds(x, y, w, h) || F(x, y)) return;
    const k = `${x},${y}`;
    if (seen.has(k)) return;
    seen.add(k);
    shell.push({ x, y });
  };
  // 링(두께 1, 대각 제외) — 골드는 남쪽 대각 코너를 void(430)로 남긴다(렌더 368 쿼터가 감쌈).
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!F(x, y)) continue;
      add(x, y - 1);
      add(x, y + 1);
      add(x - 1, y);
      add(x + 1, y);
    }
  }
  // 수직 파티션의 1칸 문 개구부는 벽면 트리거에서 제외 — 문 위 셀은 벽면이 아니라
  // 파티션 기둥(428)이 계속 이어져야 한다.
  const doorGapKeys = new Set<string>();
  for (const innerDoor of innerDoors) {
    if (F(innerDoor.x, innerDoor.y) && F(innerDoor.x - 1, innerDoor.y) && F(innerDoor.x + 1, innerDoor.y)) {
      doorGapKeys.add(`${innerDoor.x},${innerDoor.y}`);
    }
  }

  // 북벽면(바닥 바로 위 셸 행) 위로 2줄(벽면 윗줄 + 캡) + 그 줄들의 좌우 마감 셀
  const faceBottom: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!F(x, y) && F(x, y + 1) && !doorGapKeys.has(`${x},${y + 1}`)) faceBottom.push({ x, y });
    }
  }
  for (const c of faceBottom) {
    add(c.x - 1, c.y);
    add(c.x + 1, c.y);
    add(c.x, c.y - 1);
    add(c.x, c.y - 2);
    add(c.x - 1, c.y - 1);
    add(c.x + 1, c.y - 1);
    add(c.x - 1, c.y - 2);
    add(c.x + 1, c.y - 2);
  }

  for (const cell of shell) setL(map, cell.x, cell.y, HOUSE_WALL_BRUSH);
  setL(map, door.x, door.y, VR.FLOOR);
  // 남벽 개구부 — 문 아래 셸 셀을 바닥으로 뚫는다
  const doorWallY = door.y + 1;
  const doorOpened = doorWallY < h && !F(door.x, doorWallY);
  if (doorOpened) setL(map, door.x, doorWallY, VR.FLOOR);
  shapeAutotileGroupAround(map, createInteriorWallFrameAutotileGroup(), [...shell, door, { x: door.x, y: doorWallY }]);

  // 벽면 2줄 덮어쓰기 — 위/아래 모두 104(좌)/105(중)/106(우), 가로 run 단위 마감 (골드 문법)
  // 벽면 판정은 "좌표 집합"으로 추적한다 — 오토타일이 파티션 트림 자리를 105 몸통으로
  // 성형할 수 있어 타일 값으로 판정하면 마감 패스가 그 셀을 벽면으로 오인한다.
  const faceKeys = new Set<string>();
  for (const run of horizontalRuns(faceBottom)) {
    for (let i = 0; i < run.cells.length; i += 1) {
      const c = run.cells[i]!;
      const tile = run.cells.length === 1
        ? HOUSE_WALL_FACE.M
        : i === 0 ? HOUSE_WALL_FACE.L : i === run.cells.length - 1 ? HOUSE_WALL_FACE.R : HOUSE_WALL_FACE.M;
      setL(map, c.x, c.y, tile);
      faceKeys.add(`${c.x},${c.y}`);
      if (c.y - 1 >= 0 && !F(c.x, c.y - 1)) {
        setL(map, c.x, c.y - 1, tile);
        faceKeys.add(`${c.x},${c.y - 1}`);
      }
    }
  }

  // 결정적 마감 — 오토타일 마스크가 기둥/트림을 코너로 오판한 셀을 골드 문법으로 강제:
  //   바닥·벽면의 동쪽 이웃 → 서포스트 428, 서쪽 이웃 → 동포스트 426, 바닥 북쪽 이웃 → 남측 트림 397.
  //   (캡 행과 빔 조인트는 오토타일 결과 유지 — 233/258/456/458은 그 자리 전용 조인트.)
  const floorOrFace = (x: number, y: number): boolean => F(x, y) || faceKeys.has(`${x},${y}`);
  for (const cell of shell) {
    if (getL(map, cell.x, cell.y) === VR.FLOOR) continue; // 문 개구부(뚫은 셀)는 유지
    if (faceKeys.has(`${cell.x},${cell.y}`)) continue; //   벽면은 확정
    if (F(cell.x, cell.y - 1) && !doorGapKeys.has(`${cell.x},${cell.y - 1}`)) {
      setL(map, cell.x, cell.y, 397); // 남측 트림(바닥 아래 — 단, 위가 문 개구부면 기둥 유지)
    } else if (floorOrFace(cell.x + 1, cell.y)) {
      setL(map, cell.x, cell.y, 428); // 서쪽 포스트(양면 파티션 포함 — 렌더가 426|428 반반 합성)
    } else if (floorOrFace(cell.x - 1, cell.y)) {
      setL(map, cell.x, cell.y, 426); // 동쪽 포스트
    } else if (getL(map, cell.x, cell.y) === HOUSE_WALL_BRUSH) {
      // 사방이 벽인 몸통 잔재 = 수직 파티션이 캡/트림 지대를 관통하는 T-교차 — 기둥으로 잇는다.
      setL(map, cell.x, cell.y, 428);
    }
  }

  // 문 마감 — 골드: 트림 행에서 서쪽 플랭크 398 / 동쪽 플랭크 396, 아래 행 257·397·257.
  if (doorOpened) {
    if (!F(door.x - 1, doorWallY) && seen.has(`${door.x - 1},${doorWallY}`)) setL(map, door.x - 1, doorWallY, HOUSE_WALL_FACE.DOOR_WEST);
    if (!F(door.x + 1, doorWallY) && seen.has(`${door.x + 1},${doorWallY}`)) setL(map, door.x + 1, doorWallY, HOUSE_WALL_FACE.DOOR_EAST);
    const stepY = doorWallY + 1;
    if (stepY < h && !F(door.x, stepY)) {
      setL(map, door.x, stepY, HOUSE_WALL_FACE.DOOR_STEP);
      if (!F(door.x - 1, stepY) && !seen.has(`${door.x - 1},${stepY}`)) setL(map, door.x - 1, stepY, HOUSE_WALL_FACE.DOOR_POST_BASE);
      if (!F(door.x + 1, stepY) && !seen.has(`${door.x + 1},${stepY}`)) setL(map, door.x + 1, stepY, HOUSE_WALL_FACE.DOOR_POST_BASE);
    }
  }

  // 내부 문 플랭크 — 파티션 트림 행(개구부 최상단) 양옆이 397이면 398|396으로 마감.
  for (const innerDoor of innerDoors) {
    if (getL(map, innerDoor.x - 1, innerDoor.y) === 397) setL(map, innerDoor.x - 1, innerDoor.y, HOUSE_WALL_FACE.DOOR_WEST);
    if (getL(map, innerDoor.x + 1, innerDoor.y) === 397) setL(map, innerDoor.x + 1, innerDoor.y, HOUSE_WALL_FACE.DOOR_EAST);
  }
}

type HorizontalRun = { readonly cells: readonly { x: number; y: number }[] };

/** 같은 행에서 x가 연속인 셀 묶음. */
function horizontalRuns(cells: readonly { x: number; y: number }[]): HorizontalRun[] {
  const byRow = new Map<number, number[]>();
  for (const c of cells) {
    const xs = byRow.get(c.y) ?? [];
    xs.push(c.x);
    byRow.set(c.y, xs);
  }
  const runs: HorizontalRun[] = [];
  for (const [y, xs] of byRow) {
    const sorted = [...new Set(xs)].sort((a, b) => a - b);
    let start = 0;
    for (let i = 1; i <= sorted.length; i += 1) {
      if (i === sorted.length || sorted[i]! !== sorted[i - 1]! + 1) {
        runs.push({ cells: sorted.slice(start, i).map((x) => ({ x, y })) });
        start = i;
      }
    }
  }
  return runs;
}

/** 벽 프레임 멤버(성형 결과) + 문 받침(257)을 포함한 "벽 셸" 판정. */
export function houseShellWallMembers(): ReadonlySet<number> {
  return new Set<number>([
    ...createInteriorWallFrameAutotileGroup().memberTileIds,
    HOUSE_WALL_FACE.DOOR_POST_BASE,
  ]);
}


// ── Furniture with surface rules + bed hard pair ────────────────────────────

function paintFurniture(map: GameMap, floor: boolean[], plan: InteriorRoomPlan): void {
  // 방 구조(bbox): 방마다 자기 바닥 마스크 + 자기 테마로 배치한다.
  if (plan.rooms && plan.rooms.length > 0) {
    for (const room of plan.rooms) {
      const mask = roomFloorMask(plan, room, floor);
      paintThemeFurniture(map, mask, room.theme ?? plan.theme, plan.door, room);
    }
    return;
  }
  paintThemeFurniture(map, floor, plan.theme, plan.door);
}

function paintThemeFurniture(
  map: GameMap,
  floor: boolean[],
  theme: InteriorRoomTheme,
  door: DoorSpec,
  room?: RoomSpec,
): void {
  const wallFace = listWallFace(map, floor).filter(
    (c) => !room || (c.y === room.y - 2 && c.x >= room.x && c.x < room.x + room.w),
  );
  const northFloor = listNorthFloor(floor, map);
  const corners = listCorners(floor, map, door);
  const open = listOpenFloor(floor, map, door);
  const wallSnap = listWallSnapFloor(floor, map, door);
  const area = floor.filter(Boolean).length;
  // 장식 로테이션 — 같은 테마 방이 복붙으로 보이지 않게 방 위치 기반으로 세트를 바꾼다.
  const variant = ((room?.x ?? door.x) + (room?.y ?? door.y)) % 3;
  const plan = { theme, door } as const;
  // No indoor plants (user rule).

  if (plan.theme === "bedroom") {
    placeBedPair(map, northFloor, plan.door);
    placeTallPairU(map, northFloor, plan.door, VR.MIRROR_T, VR.MIRROR_B);
    if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW]);
    else if (variant === 1) placePicturePair(map, wallFace);
    else placeTallPairU(map, northFloor, plan.door, VR.CLOCK_T, VR.CLOCK_B);
    const tableSet = placeTableChairSet(map, open, plan.door);
    // 러그 앵커링: 위에 얹힌 가구가 있을 때만(탁자 세트 발밑) + 방이 넓을 때만 + 방마다 남발 금지.
    if (tableSet && area >= 24 && variant !== 2) placeRugUnder(map, tableSet.x, tableSet.y, RUG_TEAL);
    placeCorner(map, corners, [VR.BOX]);
    return;
  }
  if (plan.theme === "study") {
    // 서가 열: 방 폭에 비례해 책장 반복 배치 + 반드시 '읽을 자리'(책상+의자)를 만든다.
    const bboxW = floorBboxWidth(floor, map);
    const shelvesPerRow = Math.max(1, Math.floor(bboxW / 6));
    placeBookshelfRow(map, northFloor, plan.door, shelvesPerRow);
    // 대형 서재(도서관)는 방을 가로지르는 프리스탠딩 서가 열을 한 줄 더 깐다.
    if (area >= 80 && northFloor.length > 0) {
      const rowY = Math.min(...northFloor.map((c) => c.y)) + 4;
      const midRow: Array<{ x: number; y: number }> = [];
      for (let x = 0; x < map.width; x += 1) {
        if (floor[rowY * map.width + x]) midRow.push({ x, y: rowY });
      }
      placeBookshelfRow(map, midRow, plan.door, shelvesPerRow);
    }
    placeTableChairSet(map, open, plan.door);
    placeOpen(map, open, [VR.CRYSTAL_BALL]);
    placeTallPairU(map, northFloor, plan.door, VR.CLOCK_T, VR.CLOCK_B);
    if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW, VR.RELIGIOUS]);
    else placePicturePair(map, wallFace);
    placeCorner(map, corners, [VR.BOX, VR.GRAIN]);
    if (corners[0] && isWalkFloor(map, corners[0].x, corners[0].y) && isUpperEmpty(map, corners[0].x, corners[0].y)) {
      setU(map, corners[0].x, corners[0].y, VR.CABINET_U);
      if (isWalkFloor(map, corners[0].x, corners[0].y + 1)) {
        setL(map, corners[0].x, corners[0].y + 1, VR.CABINET_L);
      }
    }
    return;
  }
  if (plan.theme === "kitchen") {
    // 화덕(21+51 세로쌍)을 북벽에 붙이고, 솥은 화덕 옆(바닥 산포 금지).
    const stove = placeStovePair(map, northFloor, plan.door);
    if (stove) {
      const cx = stove.x + 1;
      if (isWalkFloor(map, cx, stove.y) && isUpperEmpty(map, cx, stove.y)) setU(map, cx, stove.y, VR.CAULDRON);
      if (isWalkFloor(map, cx + 1, stove.y) && isUpperEmpty(map, cx + 1, stove.y)) setU(map, cx + 1, stove.y, VR.KETTLE);
    }
    placeWallMount(map, wallFace, [VR.WINDOW, VR.FRUIT_SHELF, VR.SHELF_JARS]);
    placeCorner(map, corners, [VR.BUCKET, VR.JARS, VR.GRAIN]);
    placeAgainstWall(map, wallSnap, [VR.BARREL, VR.JARS]);
    return;
  }
  if (plan.theme === "storage") {
    // 창고: 적재물은 벽 스냅이 기본(중앙 부유 금지) — 물량은 면적 비례.
    placeWallMount(map, wallFace, [VR.LADDER, VR.WINDOW]);
    placeCorner(map, corners, [VR.CRATE, VR.BARREL, VR.GRAIN, VR.BOX, VR.JARS]);
    const loads = Math.max(4, Math.floor(area / 8));
    placeAgainstWall(map, wallSnap, repeatTiles([VR.BARREL, VR.CRATE, VR.JARS, VR.BOX], loads));
    return;
  }
  if (plan.theme === "tavern") {
    // 선술집/홀: 긴 탁자(3칸) 면적 비례 + 의자는 탁자 인접만, 피아노·진열대·술통.
    const tables = Math.max(1, Math.floor(area / 45));
    let placedTable: { x: number; y: number } | null = null;
    for (let i = 0; i < tables; i += 1) {
      const t = placeLongTable3(map, open, plan.door);
      if (t && !placedTable) placedTable = t;
    }
    // 필수 가구 보장: 긴 탁자가 전부 실패하면 사각 탁자 세트라도 반드시 놓는다.
    if (!placedTable) placeTableChairSet(map, open, plan.door);
    placePianoTriple(map, northFloor, plan.door);
    placeTallPairU(map, northFloor, plan.door, VR.DISPLAY_T, VR.DISPLAY_B);
    placeWallMount(map, wallFace, [VR.TAVERN_SIGN, VR.WINDOW, VR.SWORD_RACK]);
    placeCorner(map, corners, [VR.BARREL, VR.BUCKET, VR.JARS]);
    placeAgainstWall(map, wallSnap, [VR.BARREL, VR.BARREL]);
    return;
  }
  // dining — 장탁자(3칸) 면적 비례, 러그는 상석 탁자 발밑에만, 잔해류(깨진 유리/바닥 구멍)는 금지.
  const tables = Math.max(1, Math.floor(area / 40));
  let headTable: { x: number; y: number } | null = null;
  for (let i = 0; i < tables; i += 1) {
    const t = placeLongTable3(map, open, plan.door);
    if (t && !headTable) headTable = t;
  }
  // 필수 가구 보장: 식탁 없는 식당 금지 — 긴 탁자가 안 들어가면 사각 탁자 세트로 대체.
  if (!headTable) headTable = placeTableChairSet(map, open, plan.door);
  if (headTable && area >= 24) placeRugUnder(map, headTable.x, headTable.y, RUG_RED);
  placeTallPairU(map, northFloor, plan.door, VR.DISPLAY_T, VR.DISPLAY_B);
  if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW]);
  else placePicturePair(map, wallFace);
  placeCorner(map, corners, [VR.JARS, VR.BOX]);
}

// ── 배치 규칙 헬퍼(2026-07-12): 짝 가구·벽 스냅·밀도 ─────────────────────────

/**
 * 벽에 붙은 바닥 셀 목록(문 행/문 열 제외) — 통·궤짝·짐의 벽 스냅 배치용.
 * "북벽 일렬 진열"을 막기 위해 서/동/남/북 그룹을 라운드로빈으로 섞어 반환한다.
 */
function listWallSnapFloor(
  floor: boolean[],
  map: GameMap,
  door: DoorSpec,
): Array<{ x: number; y: number }> {
  const F = (x: number, y: number) =>
    inBounds(x, y, map.width, map.height) && floor[y * map.width + x] === true;
  const west: Array<{ x: number; y: number }> = [];
  const east: Array<{ x: number; y: number }> = [];
  const south: Array<{ x: number; y: number }> = [];
  const north: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!F(x, y) || y === door.y || x === door.x) continue;
      if (!F(x - 1, y)) west.push({ x, y });
      else if (!F(x + 1, y)) east.push({ x, y });
      else if (!F(x, y + 1)) south.push({ x, y });
      else if (!F(x, y - 1)) north.push({ x, y });
    }
  }
  const groups = [west, east, south, north];
  const mixed: Array<{ x: number; y: number }> = [];
  const longest = Math.max(...groups.map((g) => g.length));
  for (let i = 0; i < longest; i += 1) {
    for (const g of groups) if (g[i]) mixed.push(g[i]!);
  }
  return mixed;
}

/** 벽 스냅 셀에 소품을 차례로 놓는다(통행 가능한 upper 소품 전제). */
function placeAgainstWall(
  map: GameMap,
  cells: Array<{ x: number; y: number }>,
  tiles: readonly number[],
): void {
  let ci = 0;
  for (const tile of tiles) {
    while (
      ci < cells.length
      && (!isWalkFloor(map, cells[ci]!.x, cells[ci]!.y) || !isUpperEmpty(map, cells[ci]!.x, cells[ci]!.y))
    ) {
      ci += 1;
    }
    if (ci >= cells.length) break;
    setU(map, cells[ci]!.x, cells[ci]!.y, tile);
    ci += 2; // 다닥다닥 붙지 않게 한 칸 간격
  }
}

function repeatTiles(pattern: readonly number[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push(pattern[i % pattern.length]!);
  return out;
}

/** 키 큰 세로쌍(거울/시계/흉상/갑옷/진열대) — 상단은 벽면 행 upper, 하단은 북측 바닥 upper. */
function placeTallPairU(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
  top: number,
  bottom: number,
): boolean {
  const wall = houseShellWallMembers();
  for (const c of northFloor) {
    if (c.x === door.x) continue;
    if (!isWalkFloor(map, c.x, c.y)) continue;
    if (!wall.has(getL(map, c.x, c.y - 1))) continue;
    if (!isUpperEmpty(map, c.x, c.y) || !isUpperEmpty(map, c.x, c.y - 1)) continue;
    // hard pair — 절대 반쪽 배치 금지
    setU(map, c.x, c.y - 1, top);
    setU(map, c.x, c.y, bottom);
    return true;
  }
  return false;
}

/** 중심에서 가까운 순서로 후보를 정렬 — 좌상단 우선 순회가 만드는 '북벽 몰림'을 막는다. */
function sortByCenter(
  open: Array<{ x: number; y: number }>,
  center: { x: number; y: number } | null,
): Array<{ x: number; y: number }> {
  if (!center) return open;
  const d2 = (c: { x: number; y: number }) => (c.x - center.x) ** 2 + (c.y - center.y) ** 2;
  return [center, ...[...open].sort((a, b) => d2(a) - d2(b))];
}

/** 사각 탁자(328) + 인접 의자 — 의자는 탁자 없이 단독 배치 금지 규칙의 기준 구현. */
function placeTableChairSet(
  map: GameMap,
  open: Array<{ x: number; y: number }>,
  door: DoorSpec,
): { x: number; y: number } | null {
  const candidates = sortByCenter(open, centroid(open));
  for (const c of candidates) {
    if (c.y === door.y) continue;
    if (!isWalkFloor(map, c.x, c.y) || !isUpperEmpty(map, c.x, c.y)) continue;
    if (!isWalkFloor(map, c.x + 1, c.y) || !isUpperEmpty(map, c.x + 1, c.y)) continue;
    setU(map, c.x, c.y, VR.SQUARE_TABLE);
    setU(map, c.x + 1, c.y, VR.CHAIR_LEFT);
    if (isWalkFloor(map, c.x - 1, c.y) && isUpperEmpty(map, c.x - 1, c.y)) setU(map, c.x - 1, c.y, VR.CHAIR_RIGHT);
    return { x: c.x, y: c.y };
  }
  return null;
}

/** 긴 탁자 3칸(325|326|327) + 양끝 의자 + 위아래 스툴 — 의자·스툴은 탁자 인접만. */
function placeLongTable3(
  map: GameMap,
  open: Array<{ x: number; y: number }>,
  door: DoorSpec,
): { x: number; y: number } | null {
  const candidates = sortByCenter(open, centroid(open));
  for (const c of candidates) {
    if (c.y === door.y || c.y + 1 === door.y) continue;
    // 좌석군 간 통로 확보: 탁자 행(5칸 밴드)은 완전히 비어야 하고,
    // 위아래 행도 바닥인 칸은 비어 있어야 한다(다른 탁자·의자와 맞물림 금지).
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy += 1) {
      for (let dx = -1; dx <= 3 && ok; dx += 1) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (dy === 0) {
          if (!isWalkFloor(map, x, y) || !isUpperEmpty(map, x, y)) ok = false;
        } else if (isWalkFloor(map, x, y) && !isUpperEmpty(map, x, y)) {
          ok = false;
        }
      }
    }
    if (!ok) continue;
    setU(map, c.x, c.y, VR.TABLE_L);
    setU(map, c.x + 1, c.y, VR.TABLE_R);
    setU(map, c.x + 2, c.y, VR.TABLE_R3);
    setU(map, c.x - 1, c.y, VR.CHAIR_RIGHT);
    setU(map, c.x + 3, c.y, VR.CHAIR_LEFT);
    if (isWalkFloor(map, c.x + 1, c.y - 1) && isUpperEmpty(map, c.x + 1, c.y - 1)) setU(map, c.x + 1, c.y - 1, VR.STOOL);
    if (isWalkFloor(map, c.x + 1, c.y + 1) && isUpperEmpty(map, c.x + 1, c.y + 1)) setU(map, c.x + 1, c.y + 1, VR.STOOL);
    return { x: c.x + 1, y: c.y };
  }
  return null;
}

/** 피아노 3칸(357|358|359) — 북벽에 붙여 배치. 357은 2026-07-12 보완 작화로 완성. */
function placePianoTriple(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
): boolean {
  const byY = new Map<number, Array<{ x: number; y: number }>>();
  for (const c of northFloor) {
    const row = byY.get(c.y) ?? [];
    row.push(c);
    byY.set(c.y, row);
  }
  for (const [y, row] of byY) {
    const xs = new Set(row.map((c) => c.x));
    for (const c of [...row].sort((a, b) => a.x - b.x)) {
      if (!xs.has(c.x + 1) || !xs.has(c.x + 2)) continue;
      if ([0, 1, 2].some((dx) => c.x + dx === door.x)) continue;
      if ([0, 1, 2].some((dx) => !isWalkFloor(map, c.x + dx, y) || !isUpperEmpty(map, c.x + dx, y))) continue;
      setU(map, c.x, y, VR.PIANO_L);
      setU(map, c.x + 1, y, VR.PIANO_M);
      setU(map, c.x + 2, y, VR.PIANO_R);
      return true;
    }
  }
  return false;
}

/** 3×3 러그를 가구군 발밑에 깐다(앵커링) — 위에 얹힌 가구 없는 단독 러그 금지 규칙. */
function placeRugUnder(
  map: GameMap,
  cx: number,
  cy: number,
  rug: readonly (readonly number[])[],
): boolean {
  for (let dy = 0; dy < 3; dy += 1) {
    for (let dx = 0; dx < 3; dx += 1) {
      const x = cx - 1 + dx;
      const y = cy - 1 + dy;
      if (!inBounds(x, y, map.width, map.height) || getL(map, x, y) !== VR.FLOOR) return false;
    }
  }
  for (let dy = 0; dy < 3; dy += 1) {
    for (let dx = 0; dx < 3; dx += 1) {
      setL(map, cx - 1 + dx, cy - 1 + dy, rug[dy]![dx]!);
    }
  }
  return true;
}

/** 바닥 마스크의 가로 폭(bbox) — 서가 열 개수 산정용. */
function floorBboxWidth(floor: boolean[], map: GameMap): number {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!floor[y * map.width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  return maxX >= minX ? maxX - minX + 1 : 0;
}

/** 서가 열 — 북벽을 따라 책장(2×3)을 최대 count개, 1칸 간격으로 배치. */
function placeBookshelfRow(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
  count: number,
): void {
  const sorted = [...northFloor].sort((a, b) => a.x - b.x || a.y - b.y);
  let placed = 0;
  let minNextX = Number.NEGATIVE_INFINITY;
  for (const c of sorted) {
    if (placed >= count) break;
    if (c.x < minNextX) continue;
    if ([0, 1].some((dx) => c.x + dx === door.x)) continue;
    let ok = true;
    for (let dy = 0; dy < 3 && ok; dy += 1) {
      for (let dx = 0; dx < 2 && ok; dx += 1) {
        if (!isWalkFloor(map, c.x + dx, c.y + dy)) ok = false;
      }
    }
    if (!ok) continue;
    setL(map, c.x, c.y, VR.BOOK_TL);
    setL(map, c.x + 1, c.y, VR.BOOK_TR);
    setL(map, c.x, c.y + 1, VR.BOOK_ML);
    setL(map, c.x + 1, c.y + 1, VR.BOOK_MR);
    setL(map, c.x, c.y + 2, VR.BOOK_BL);
    setL(map, c.x + 1, c.y + 2, VR.BOOK_BR);
    placed += 1;
    minNextX = c.x + 3; // 책장 2칸 + 통로 1칸
  }
}

/**
 * Stove as atomic vertical pair 21(top)/51(bottom):
 * RM tall-furniture depth grammar — 하단(51)은 북측 바닥 행 lower(통행 차단),
 * 상단(21)은 바로 위 크림 벽면 행 upper(벽에 겹쳐 세움). 시계/피아노와 같은 깊이 문법.
 */
function placeStovePair(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
): { x: number; y: number } | null {
  const wall = houseShellWallMembers();
  for (const c of northFloor) {
    if (c.x === door.x) continue;
    if (!isWalkFloor(map, c.x, c.y)) continue;
    if (!wall.has(getL(map, c.x, c.y - 1))) continue; // 상단이 겹칠 벽면이 있어야 함
    if (!isUpperEmpty(map, c.x, c.y) || !isUpperEmpty(map, c.x, c.y - 1)) continue;
    // hard pair — never place half stove (21 must be immediately above 51)
    setU(map, c.x, c.y - 1, VR.STOVE_TOP);
    setL(map, c.x, c.y, VR.STOVE_BOT);
    return { x: c.x, y: c.y };
  }
  return null;
}

/** Place bed as atomic hard pair 355|356 on against-wall floor. */
function placeBedPair(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
): boolean {
  for (const c of northFloor) {
    if (c.x === door.x || c.x + 1 === door.x) continue;
    if (!isWalkFloor(map, c.x, c.y) || !isWalkFloor(map, c.x + 1, c.y)) continue;
    if (!isUpperEmpty(map, c.x, c.y) || !isUpperEmpty(map, c.x + 1, c.y)) continue;
    // hard pair — never place half bed (355 must be immediately left of 356)
    setU(map, c.x, c.y, VR.BED_L);
    setU(map, c.x + 1, c.y, VR.BED_R);
    return true;
  }
  return false;
}

/** Picture is a horizontal pair 114|115 on the same wall-face row — never split vertically. */
function placePicturePair(map: GameMap, wallFace: Array<{ x: number; y: number }>): void {
  // group by y (face row), find two consecutive face cells
  const byY = new Map<number, number[]>();
  for (const c of wallFace) {
    const xs = byY.get(c.y) ?? [];
    xs.push(c.x);
    byY.set(c.y, xs);
  }
  for (const [y, xs] of [...byY.entries()].sort((a, b) => b[0] - a[0])) {
    const sorted = [...new Set(xs)].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const x0 = sorted[i]!;
      const x1 = sorted[i + 1]!;
      if (x1 !== x0 + 1) continue;
      if (!isUpperEmpty(map, x0, y) || !isUpperEmpty(map, x1, y)) continue;
      setU(map, x0, y, VR.PICTURE_L);
      setU(map, x1, y, VR.PICTURE_R);
      return;
    }
  }
}

function placeWallMount(
  map: GameMap,
  wallFace: Array<{ x: number; y: number }>,
  tiles: readonly number[],
): void {
  // skip picture tiles — handled as pair
  const singles = tiles.filter((t) => t !== VR.PICTURE_L && t !== VR.PICTURE_R);
  let wi = 0;
  for (const tile of singles) {
    if (PROP_SURFACE[tile] !== "wallFace") continue;
    while (wi < wallFace.length) {
      const cell = wallFace[wi]!;
      wi += 1;
      if (!isUpperEmpty(map, cell.x, cell.y)) continue;
      setU(map, cell.x, cell.y, tile);
      break;
    }
  }
}

function placeCorner(
  map: GameMap,
  corners: Array<{ x: number; y: number }>,
  tiles: readonly number[],
): void {
  let ci = 0;
  for (const tile of tiles) {
    if (PROP_SURFACE[tile] !== "cornerFloor") continue;
    while (
      ci < corners.length
      && (!isWalkFloor(map, corners[ci]!.x, corners[ci]!.y) || !isUpperEmpty(map, corners[ci]!.x, corners[ci]!.y))
    ) {
      ci += 1;
    }
    if (ci >= corners.length) break;
    setU(map, corners[ci]!.x, corners[ci]!.y, tile);
    ci += 1;
  }
}

function placeOpen(
  map: GameMap,
  open: Array<{ x: number; y: number }>,
  tiles: readonly number[],
): void {
  let oi = Math.floor(open.length / 3);
  for (const tile of tiles) {
    if (PROP_SURFACE[tile] !== "openFloor") continue;
    while (
      oi < open.length
      && (!isWalkFloor(map, open[oi]!.x, open[oi]!.y) || !isUpperEmpty(map, open[oi]!.x, open[oi]!.y))
    ) {
      oi += 1;
    }
    if (oi >= open.length) break;
    setU(map, open[oi]!.x, open[oi]!.y, tile);
    oi += 2;
  }
}

function isUpperEmpty(map: GameMap, x: number, y: number): boolean {
  const u = getU(map, x, y);
  return u < 0 || u === TILE.EMPTY;
}

// ── Entrance event ──────────────────────────────────────────────────────────

function placeEntranceEvent(map: GameMap, door: DoorSpec): void {
  const exitY = Math.min(map.height - 1, door.y + 1);
  // Valid command shape: text uses `body` (not `lines`) — invalid shape was dropped on save.
  const event: GameEvent = {
    id: `ev_entrance_${map.id}`,
    name: "입구",
    x: door.x,
    y: door.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `ev_entrance_${map.id}_page`,
        name: "입구",
        conditions: [],
        // Visible enough for editor event layer (not fully transparent).
        graphic: { transparent: false },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "[입구] 문을 열고 밖으로 나간다." },
          {
            kind: "transfer",
            mapId: map.id,
            x: door.x,
            y: exitY,
            fade: "black",
          },
        ],
      },
    ],
  };
  map.events = [...(map.events ?? []).filter((e) => e.id !== event.id && !(e.x === door.x && e.y === door.y)), event];
}

// ── Critique ────────────────────────────────────────────────────────────────

function critiqueRoom(map: GameMap, plan: InteriorRoomPlan): string[] {
  const issues: string[] = [];
  const floor = floorMaskFromPlan(plan);

  // bed hard pair
  const bedsL: Array<{ x: number; y: number }> = [];
  const bedsR: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const u = getU(map, x, y);
      if (u === VR.BED_L) bedsL.push({ x, y });
      if (u === VR.BED_R) bedsR.push({ x, y });
    }
  }
  for (const b of bedsL) {
    if (getU(map, b.x + 1, b.y) !== VR.BED_R) {
      issues.push(`hard bed: 355 at (${b.x},${b.y}) missing 356 to the right`);
    }
  }
  for (const b of bedsR) {
    if (getU(map, b.x - 1, b.y) !== VR.BED_L) {
      issues.push(`hard bed: 356 at (${b.x},${b.y}) missing 355 to the left`);
    }
  }

  // long table hard pair 325|326 (upper)
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const u = getU(map, x, y);
      if (u === VR.TABLE_L && getU(map, x + 1, y) !== VR.TABLE_R) {
        issues.push(`hard table: 325 at (${x},${y}) missing 326 to the right`);
      }
      if (u === VR.TABLE_R && getU(map, x - 1, y) !== VR.TABLE_L) {
        issues.push(`hard table: 326 at (${x},${y}) missing 325 to the left`);
      }
    }
  }

  // stove hard vertical pair — 21 upper(벽면 행) 바로 아래 51 lower(바닥 행)
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (getU(map, x, y) === VR.STOVE_TOP && getL(map, x, y + 1) !== VR.STOVE_BOT) {
        issues.push(`hard stove: 21(upper) at (${x},${y}) missing 51(lower) below`);
      }
      if (getL(map, x, y) === VR.STOVE_BOT && getU(map, x, y - 1) !== VR.STOVE_TOP) {
        issues.push(`hard stove: 51(lower) at (${x},${y}) missing 21(upper) above`);
      }
    }
  }

  // wall-mount only on house-shell wall cells (cream face / frame members)
  const wallMount = new Set<number>([VR.WINDOW, VR.PICTURE_L, VR.PICTURE_R, VR.RELIGIOUS, VR.SWORD_RACK, VR.FRUIT_SHELF, VR.SHELF_JARS, VR.TAVERN_SIGN, VR.LADDER]);
  const wallMembers = houseShellWallMembers();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const u = getU(map, x, y);
      if (!wallMount.has(u)) continue;
      if (!wallMembers.has(getL(map, x, y))) {
        issues.push(`wall-mount tile ${u} at (${x},${y}) not on dark-wall face`);
      }
    }
  }

  // broken glass only on floor, never on wall
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (getU(map, x, y) !== VR.BROKEN_GLASS) continue;
      if (getL(map, x, y) !== VR.FLOOR) {
        issues.push(`broken glass not on floor at (${x},${y})`);
      }
    }
  }

  // entrance event
  const entrance = (map.events ?? []).find((e) => e.x === plan.door.x && e.y === plan.door.y);
  if (!entrance) issues.push(`missing entrance event at door (${plan.door.x},${plan.door.y})`);

  // floor must exist
  if (!floor.some(Boolean)) issues.push("no floor cells");

  // room bbox 검증: 겹침 금지, 상하 인접 방은 파티션 3행(트림+벽면×2) 간격
  const rooms = plan.rooms ?? [];
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      const xOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
      const yOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
      if (xOverlap && yOverlap) {
        issues.push(`rooms overlap: ${a.id} ↔ ${b.id}`);
        continue;
      }
      if (xOverlap) {
        const upper = a.y < b.y ? a : b;
        const lower = a.y < b.y ? b : a;
        const gap = lower.y - (upper.y + upper.h);
        if (gap > 0 && gap < 3) {
          issues.push(`rooms ${upper.id}/${lower.id} vertical gap ${gap} — 파티션은 3행(트림+벽면×2) 필요`);
        }
      }
    }
  }

  return issues;
}

// ── Spatial helpers ─────────────────────────────────────────────────────────

function listWallFace(map: GameMap, floor: boolean[]): Array<{ x: number; y: number }> {
  const members = houseShellWallMembers();
  // 벽걸이는 크림 벽면 **윗줄**에 건다 — 아랫줄에 걸면 벽 하단부에 붙어 낮아 보인다.
  // 벽면은 위/아래 모두 104/105/106이므로, "아래 셀도 벽면인 벽면 셀"이 윗줄이다.
  // (키 큰 가구 상단은 여전히 아랫줄에 겹친다: placeStovePair 등.)
  const faceTiles = new Set<number>([HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R]);
  const top: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (faceTiles.has(getL(map, x, y)) && faceTiles.has(getL(map, x, y + 1))) top.push({ x, y });
    }
  }
  if (top.length > 0) {
    // 긴 벽면 구간 우선 — 내부 문으로 쪼개진 좁은 구간(2칸 이하)에 간판/창문이 몰리면 벽장처럼 보인다.
    const runs = horizontalRuns(top).map((run) => [...run.cells]);
    runs.sort((a, b) => b.length - a.length || a[0]!.y - b[0]!.y || a[0]!.x - b[0]!.x);
    return runs.flat();
  }
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!members.has(getL(map, x, y))) continue;
      // prefer cells immediately north of floor (inner face of shell)
      const belowFloor =
        inBounds(x, y + 1, map.width, map.height) && floor[(y + 1) * map.width + x];
      if (belowFloor) out.push({ x, y });
    }
  }
  // fallback: any wall adjacent to floor
  if (out.length === 0) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!members.has(getL(map, x, y))) continue;
        const adj =
          (inBounds(x, y + 1, map.width, map.height) && floor[(y + 1) * map.width + x])
          || (inBounds(x, y - 1, map.width, map.height) && floor[(y - 1) * map.width + x])
          || (inBounds(x + 1, y, map.width, map.height) && floor[y * map.width + x + 1])
          || (inBounds(x - 1, y, map.width, map.height) && floor[y * map.width + x - 1]);
        if (adj) out.push({ x, y });
      }
    }
  }
  return out.sort((a, b) => b.y - a.y || a.x - b.x);
}

function listNorthFloor(floor: boolean[], map: GameMap): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!floor[y * map.width + x]) continue;
      if (y > 0 && floor[(y - 1) * map.width + x]) continue;
      if (!isWalkFloor(map, x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function listCorners(
  floor: boolean[],
  map: GameMap,
  door: DoorSpec,
): Array<{ x: number; y: number }> {
  const F = (x: number, y: number) =>
    inBounds(x, y, map.width, map.height) && floor[y * map.width + x] === true;
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!F(x, y) || !isWalkFloor(map, x, y)) continue;
      if (x === door.x && y === door.y) continue;
      if (!F(x, y + 1)) continue; // skip south rim
      const n = !F(x, y - 1);
      const e = !F(x + 1, y);
      const west = !F(x - 1, y);
      if ((n || !F(x, y + 1)) && (e || west)) out.push({ x, y });
    }
  }
  return out;
}

function listOpenFloor(
  floor: boolean[],
  map: GameMap,
  door: DoorSpec,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!floor[y * map.width + x] || !isWalkFloor(map, x, y)) continue;
      if (x === door.x && y === door.y) continue;
      if (Math.abs(x - door.x) + Math.abs(y - door.y) < 2) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function centroid(cells: Array<{ x: number; y: number }>): { x: number; y: number } | null {
  if (cells.length === 0) return null;
  const cx = Math.round(cells.reduce((a, c) => a + c.x, 0) / cells.length);
  const cy = Math.round(cells.reduce((a, c) => a + c.y, 0) / cells.length);
  let best = cells[0]!;
  let bestD = Infinity;
  for (const c of cells) {
    const d = Math.abs(c.x - cx) + Math.abs(c.y - cy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function isWalkFloor(map: GameMap, x: number, y: number): boolean {
  const tile = getL(map, x, y);
  return tile === VR.FLOOR || RUG_TILE_SET.has(tile);
}

function cloneMap(map: GameMap): GameMap {
  return {
    ...map,
    lowerTiles: [...map.lowerTiles],
    upperTiles: [...map.upperTiles],
    events: [...(map.events ?? [])],
  };
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function getL(map: GameMap, x: number, y: number): number {
  if (!inBounds(x, y, map.width, map.height)) return VR.VOID;
  return map.lowerTiles[y * map.width + x]!;
}

function getU(map: GameMap, x: number, y: number): number {
  if (!inBounds(x, y, map.width, map.height)) return TILE.EMPTY;
  return map.upperTiles[y * map.width + x]!;
}

function setL(map: GameMap, x: number, y: number, tile: number): void {
  if (!inBounds(x, y, map.width, map.height)) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function setU(map: GameMap, x: number, y: number, tile: number): void {
  if (!inBounds(x, y, map.width, map.height)) return;
  map.upperTiles[y * map.width + x] = tile;
}

/** Demo plans for gallery — one per theme. */
export const INTERIOR_ROOM_DEMO_PLANS: readonly InteriorRoomPlan[] = [
  {
    mapId: "map_interior_bedroom_v1",
    name: "실내 · 침실 (직사각)",
    width: 16,
    height: 13,
    wings: [{ x: 2, y: 5, w: 12, h: 5 }],
    door: { x: 8, y: 9 },
    theme: "bedroom",
    seed: 1,
  },
  {
    mapId: "map_interior_study_v1",
    name: "실내 · 서재 (ㄱ자)",
    width: 16,
    height: 15,
    wings: [
      { x: 2, y: 5, w: 7, h: 7 },
      { x: 9, y: 9, w: 5, h: 3 },
    ],
    door: { x: 5, y: 11 },
    theme: "study",
    seed: 2,
  },
  {
    mapId: "map_interior_dining_v1",
    name: "실내 · 식탁방 (홀+포켓)",
    width: 17,
    height: 14,
    // Main hall + west pocket sharing the same south line (y=9), door on hall south.
    // Avoid mid-room EDGE_S bars (old (6,9)/(9,9) bug).
    wings: [
      { x: 2, y: 5, w: 13, h: 5 }, // main y5–9
      { x: 2, y: 5, w: 4, h: 7 }, // west pocket deeper south y5–11
    ],
    door: { x: 10, y: 9 },
    theme: "dining",
    seed: 3,
  },
  {
    mapId: "map_interior_kitchen_v1",
    name: "실내 · 주방 (직사각 넓음)",
    width: 16,
    height: 13,
    wings: [{ x: 2, y: 4, w: 11, h: 6 }], // y4–9
    door: { x: 7, y: 9 },
    theme: "kitchen",
    seed: 4,
  },
  {
    mapId: "map_interior_storage_v1",
    name: "실내 · 창고 (작은 방)",
    width: 13,
    height: 11,
    wings: [{ x: 3, y: 4, w: 7, h: 5 }], // y4–8
    door: { x: 6, y: 8 },
    theme: "storage",
    seed: 5,
  },
  {
    mapId: "map_interior_tavern_v1",
    name: "실내 · 선술집 (넓은 홀)",
    width: 18,
    height: 14,
    wings: [{ x: 2, y: 4, w: 14, h: 7 }], // y4–10
    door: { x: 9, y: 10 },
    theme: "tavern",
    seed: 6,
  },
  {
    mapId: "map_interior_inn_rooms_v1",
    name: "실내 · 여관 1층 (방 5개: 창고·객실×2·주방·홀)",
    width: 23,
    height: 19,
    wings: [],
    rooms: [
      { id: "pantry", x: 3, y: 4, w: 5, h: 3, theme: "storage" }, //  x3–7, 바닥 y4–6
      { id: "guest1", x: 9, y: 4, w: 5, h: 3, theme: "bedroom" }, //  x9–13 (수직 파티션 x8)
      { id: "guest2", x: 15, y: 4, w: 5, h: 3, theme: "bedroom" }, // x15–19 (수직 파티션 x14)
      { id: "kitchen", x: 3, y: 10, w: 5, h: 6, theme: "kitchen" }, // 바닥 y10–15 (수평 파티션 y7–9)
      { id: "hall", x: 9, y: 10, w: 11, h: 6, theme: "tavern" }, //   x9–19 (수직 파티션 x8)
    ],
    innerDoors: [
      { x: 5, y: 7 }, //  창고 → 주방 (수평 파티션)
      { x: 11, y: 7 }, // 객실1 → 홀
      { x: 17, y: 7 }, // 객실2 → 홀
      { x: 8, y: 12 }, // 주방 ↔ 홀 (수직 파티션, 1칸 문)
    ],
    door: { x: 12, y: 15 },
    theme: "tavern",
    seed: 8,
  },
] as const;
