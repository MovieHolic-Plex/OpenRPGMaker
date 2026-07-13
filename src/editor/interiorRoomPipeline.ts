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
  BED_V_HEAD: 324, //      세로 침대(머리 북쪽) — 침대 방향 변주
  BED_V_FOOT: 354,
  COUNTER_L: 408, //       카운터 일자 런(경로 키트 v1): 좌·몸통 반복·우
  COUNTER_M: 409,
  COUNTER_R: 410,
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
// 짚 돗자리 3×3 — 서민 식당/침상용 러그(붉은 카펫은 귀족 전용 — 사용자 지정).
const RUG_MAT: readonly (readonly number[])[] = [
  [108, 109, 110],
  [138, 139, 140],
  [168, 169, 170],
];
// 러그 위도 보행 가능 — isWalkFloor가 러그를 바닥으로 취급하지 않으면 러그가 가구 후보지를 잠식한다.
const RUG_TILE_SET = new Set<number>([...RUG_TEAL.flat(), ...RUG_RED.flat(), ...RUG_MAT.flat()]);
// 바닥 재질 변주로 리틴트될 수 있는 하부 타일(돌 12·13·42·43, 나무 72·73, 널 102·103, 짚 돗자리 139).
// 통행·점유 판정은 재질과 무관해야 한다 — 리틴트 후 맵을 평가할 때 돌바닥 방이 벽으로 오판되지 않도록.
const FLOOR_MATERIAL_TILES = new Set<number>([12, 13, 42, 43, 72, 73, 102, 103, 139]);

// 벽면 재질(하우스 셸의 크림 면 104|105|106을 방 완성 후 리틴트) — "저택 느낌은 벽부터" 지적.
// 상단 행/하단 행이 다른 아트(하단은 걸레받이 몰딩)를 쓰는 2단 면.
export type InteriorWallMaterial = "cream" | "gold-brick" | "stone-brick";
const WALL_FACE_RETINT: Record<string, { upper: readonly number[]; lower: readonly number[] }> = {
  "gold-brick": { upper: [314, 315, 316], lower: [344, 345, 346] }, // 자주+금장 벽돌(귀족 저택)
  "stone-brick": { upper: [134, 135, 136], lower: [164, 165, 166] }, // 밝은 석재 벽돌
};

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

// corridor는 '공간 역할'로서의 복도 — 통행이 주인이라 바닥 점유물이 없고, 벽 장식·전시물만 허용.
export type InteriorRoomTheme = "bedroom" | "study" | "dining" | "kitchen" | "storage" | "tavern" | "corridor";

export const INTERIOR_ROOM_THEMES: readonly InteriorRoomTheme[] = [
  "bedroom",
  "study",
  "dining",
  "kitchen",
  "storage",
  "tavern",
  "corridor",
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
  // 벽면 재질 — 크림 면(104|105|106)을 완성 후 리틴트. "gold-brick"은 귀족 저택(식당 러그도 붉은 카펫).
  readonly wallMaterial?: InteriorWallMaterial;
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
      warnings.push(...paintFurniture(next, floor, plan));
      // 통행 연결성 강제 — 리틴트 전(바닥이 아직 72/러그일 때) 문 기준 BFS로 막힌 길을 뚫는다.
      warnings.push(...enforceWalkability(next, floor, plan.door));
      // 사분면 공백 보정 — 통행이 확보된 상태에서 공백 사분면에 벽 스냅 소품(놓고-검증-되돌리기).
      fillSparseQuadrants(next, floor, plan);
      // 배치가 끝난 뒤 바닥/벽 재질 교체 — 벽 문법·성형·러그·벽걸이는 72/크림 기준으로 이미 완료된 상태.
      retintFloorMaterials(next, plan);
      retintWallFace(next, plan);
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
export function floorMaskFromPlan(plan: InteriorRoomPlan): boolean[] {
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

/** 벽면 재질 리틴트 — 크림 면(104|105|106)을 상/하단 행 구분해 교체(하단은 몰딩 아트). */
function retintWallFace(map: GameMap, plan: InteriorRoomPlan): void {
  const spec = plan.wallMaterial ? WALL_FACE_RETINT[plan.wallMaterial] : undefined;
  if (!spec) return;
  const CREAM = [104, 105, 106];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = CREAM.indexOf(getL(map, x, y));
      if (idx < 0) continue;
      const belowIsFace = CREAM.includes(getL(map, x, y + 1));
      setL(map, x, y, (belowIsFace ? spec.upper : spec.lower)[idx]!);
    }
  }
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

/** 벽 프레임 멤버(성형 결과) + 문 받침(257) + 벽 재질 리틴트 면을 포함한 "벽 셸" 판정. */
export function houseShellWallMembers(): ReadonlySet<number> {
  return new Set<number>([
    ...createInteriorWallFrameAutotileGroup().memberTileIds,
    HOUSE_WALL_FACE.DOOR_POST_BASE,
    // wallMaterial 리틴트 이후에도 벽면으로 인정 — critique의 벽걸이 검사 오탐 방지.
    ...Object.values(WALL_FACE_RETINT).flatMap((spec) => [...spec.upper, ...spec.lower]),
  ]);
}


// ── Furniture with surface rules + bed hard pair ────────────────────────────

// 방 입구(복도가 방으로 들어오는 셀)에는 가구 배치 금지 — 카운터/침대가 착지 칸을 덮어
// 방이 고립되는 사고 방지. 배치 동안 센티널로 점유했다가 끝나면 걷는다.
const ENTRY_SENTINEL = 100000;

/** 공간(방/전체) 하나의 가구 시공 — 입구 센티널 + 테마 배치 + 남쪽 필러 + 매니페스트. */
function paintRoomSpace(
  map: GameMap,
  floor: boolean[],
  mask: boolean[],
  theme: InteriorRoomTheme,
  plan: InteriorRoomPlan,
  room?: RoomSpec,
): string[] {
  const luxury = plan.wallMaterial === "gold-brick";
  const sentinels: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!mask[y * map.width + x]) continue;
      const isEntry = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, map.width, map.height)) return false;
        return floor[ny * map.width + nx] === true && mask[ny * map.width + nx] !== true;
      });
      if (isEntry && isUpperEmpty(map, x, y)) {
        setU(map, x, y, ENTRY_SENTINEL);
        sentinels.push({ x, y });
      }
    }
  }
  paintThemeFurniture(map, mask, theme, plan.door, room, luxury);
  placeSouthFiller(map, mask, theme, plan.door, mask.filter(Boolean).length);
  for (const c of sentinels) {
    if (getU(map, c.x, c.y) === ENTRY_SENTINEL) setU(map, c.x, c.y, TILE.EMPTY);
  }
  return themeManifestWarnings(map, mask, theme, room?.id);
}

function paintFurniture(map: GameMap, floor: boolean[], plan: InteriorRoomPlan): string[] {
  const warnings: string[] = [];
  RNG = mulberry32((plan.seed ?? 1) * 0x9e3779b1 + 1);
  // 방 구조(bbox): 방마다 자기 바닥 마스크 + 자기 테마로 배치한다.
  if (plan.rooms && plan.rooms.length > 0) {
    for (const room of plan.rooms) {
      warnings.push(...paintRoomSpace(map, floor, roomFloorMask(plan, room, floor), room.theme ?? plan.theme, plan, room));
    }
    return warnings;
  }
  warnings.push(...paintRoomSpace(map, floor, floor, plan.theme, plan));
  return warnings;
}

/**
 * 공간 단위 재시공(LLM 하네싱용) — rooms 플랜의 방 하나만 비우고 지정 테마로 다시 가구를 놓는다.
 * '실내'는 상위 개념이고 배치 결정은 공간(방·복도) 단위라는 계약의 실행 지점.
 * 방 범위의 upper(가구·벽면 장식 행 포함)와 러그 lower를 걷어낸 뒤 paintRoomSpace를 재실행하고,
 * 전체 맵 통행 보정을 다시 돌린다. 반환 plan은 테마 오버라이드가 반영된 새 플랜.
 */
export function furnishInteriorSpace(
  map: GameMap,
  plan: InteriorRoomPlan,
  roomId: string,
  themeOverride?: InteriorRoomTheme,
  seed?: number,
): { plan: InteriorRoomPlan; warnings: string[] } {
  const rooms = plan.rooms ?? [];
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx < 0) throw new Error(`room 없음: ${roomId} (rooms=${rooms.map((r) => r.id).join(",")})`);
  const nextRooms = rooms.map((r, i) => (i === idx && themeOverride ? { ...r, theme: themeOverride } : r));
  const nextPlan: InteriorRoomPlan = { ...plan, rooms: nextRooms };
  const room = nextRooms[idx]!;
  const floor = floorMaskFromPlan(nextPlan);
  const mask = roomFloorMask(nextPlan, room, floor);
  // 기존 시공 철거: 방 바닥 upper + 방 벽면 장식 행(room.y-2) upper + 러그 lower 복원.
  const roomFloorTile = room.floorTile ?? nextPlan.floorTile ?? VR.FLOOR;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      if (!mask[i]) continue;
      setU(map, x, y, TILE.EMPTY);
      if (RUG_TILE_SET.has(map.lowerTiles[i]!)) map.lowerTiles[i] = roomFloorTile;
    }
  }
  const faceY = room.y - 2;
  if (faceY >= 0) {
    for (let x = room.x; x < room.x + room.w; x += 1) setU(map, x, faceY, TILE.EMPTY);
  }
  // 방별 결정적 시드(플랜 시드 + 방 인덱스 성분) — 같은 인자로 재호출하면 같은 배치.
  RNG = mulberry32(((seed ?? nextPlan.seed ?? 1) + idx * 977) * 0x9e3779b1 + 1);
  const warnings = paintRoomSpace(map, floor, mask, room.theme ?? nextPlan.theme, nextPlan, room);
  warnings.push(...enforceWalkability(map, floor, nextPlan.door));
  return { plan: nextPlan, warnings };
}

// 통행 확보를 위해 걷어낼 수 있는 단일 소품(하드 쌍/멀티타일 세트는 절대 제거하지 않는다).
const REMOVABLE_SINGLE_PROPS = new Set<number>([
  VR.CHAIR_LEFT, VR.CHAIR_RIGHT, VR.STOOL, VR.SQUARE_TABLE, VR.CRYSTAL_BALL,
  VR.BARREL, VR.CRATE, VR.GRAIN, VR.BOX, VR.JARS, VR.BUCKET, VR.KETTLE, VR.CAULDRON,
]);

/**
 * 통행 연결성 강제(사용자 지적: "통행 불가능한 공간이 너무 많다") — 가구를 전부 장애물로 보고
 * 문에서 BFS. 도달 불가 개방 셀이 남으면 경계의 단일 소품을 걷어내 길을 뚫는다(최대 12개).
 * 하드 쌍(침대/긴 탁자/피아노/카운터/거울 등)은 제거하지 않고, 그래도 막히면 경고를 남긴다.
 */
/** 개방 셀 판정: 마스크 내 바닥(러그 포함)이고 upper가 비어 있다(가구=장애물 보수 가정). */
function isOpenCell(map: GameMap, floor: boolean[], x: number, y: number): boolean {
  const w = map.width;
  if (!inBounds(x, y, w, map.height) || floor[y * w + x] !== true) return false;
  return isWalkFloor(map, x, y) && isUpperEmpty(map, x, y);
}

/** 문에서 4방 BFS로 도달 가능한 개방 셀 집합(key = y*width+x). 읽기 전용 — 평가/수리 공용. */
export function reachableOpenCells(map: GameMap, floor: boolean[], door: DoorSpec): Set<number> {
  const w = map.width;
  const seen = new Set<number>();
  const queue: Array<{ x: number; y: number }> = [];
  if (isOpenCell(map, floor, door.x, door.y)) {
    queue.push(door);
    seen.add(door.y * w + door.x);
  }
  while (queue.length > 0) {
    const c = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = y * w + x;
      if (seen.has(key) || !isOpenCell(map, floor, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

function enforceWalkability(map: GameMap, floor: boolean[], door: DoorSpec): string[] {
  const w = map.width;
  const inMask = (x: number, y: number) => inBounds(x, y, w, map.height) && floor[y * w + x] === true;
  const isOpen = (x: number, y: number) => isOpenCell(map, floor, x, y);
  const bfs = (): Set<number> => reachableOpenCells(map, floor, door);
  let removed = 0;
  for (let pass = 0; pass < 24 && removed <= 12; pass += 1) {
    const reach = bfs();
    // 도달 불가 개방 셀 수집
    const unreachable: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (isOpen(x, y) && !reach.has(y * w + x)) unreachable.push({ x, y });
      }
    }
    if (unreachable.length === 0) break;
    // 후보: 도달 가능 셀과 도달 불가 셀 사이를 막고 있는 제거 가능 단일 소품
    let removedThisPass = false;
    for (let y = 0; y < map.height && !removedThisPass; y += 1) {
      for (let x = 0; x < w && !removedThisPass; x += 1) {
        if (!inMask(x, y) || !REMOVABLE_SINGLE_PROPS.has(getU(map, x, y)) || !isWalkFloor(map, x, y)) continue;
        const neighbors = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
        const touchesReach = neighbors.some((n) => reach.has(n.y * w + n.x));
        const touchesDark = neighbors.some((n) => isOpen(n.x, n.y) && !reach.has(n.y * w + n.x));
        if (touchesReach && touchesDark) {
          setU(map, x, y, TILE.EMPTY);
          removed += 1;
          removedThisPass = true;
        }
      }
    }
    if (!removedThisPass) {
      // 직접 연결 소품이 없으면 경계 프런티어의 소품을 하나 녹여 전진한다.
      for (let y = 0; y < map.height && !removedThisPass; y += 1) {
        for (let x = 0; x < w && !removedThisPass; x += 1) {
          if (!inMask(x, y) || !REMOVABLE_SINGLE_PROPS.has(getU(map, x, y)) || !isWalkFloor(map, x, y)) continue;
          const touchesReach = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
            .some(([dx, dy]) => reach.has((y + dy) * w + (x + dx)));
          if (touchesReach) {
            setU(map, x, y, TILE.EMPTY);
            removed += 1;
            removedThisPass = true;
          }
        }
      }
    }
    if (!removedThisPass) {
      return [`walkability: 도달 불가 개방 셀 ${unreachable.length}개 — 제거 가능한 소품 없음(멀티타일 세트가 길을 막음), 예: (${unreachable[0]!.x},${unreachable[0]!.y})`];
    }
  }
  const finalReach = bfs();
  const still: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isOpen(x, y) && !finalReach.has(y * w + x)) still.push(`(${x},${y})`);
    }
  }
  return still.length > 0 ? [`walkability: 도달 불가 개방 셀 ${still.length}개 잔존 — ${still.slice(0, 4).join(" ")}`] : [];
}

/**
 * 실내 방 평가 리포트 — villageEvaluate의 VillageLookReport 계약과 정렬(ok/score/issues/metrics/feedbackForLlm).
 * 세션 도구 evaluate_interior_room이 반환하고, LLM이 feedbackForLlm으로 자가 수정 루프를 돈다.
 */
export interface InteriorRoomLookReport {
  readonly ok: boolean;
  readonly score: number; // 0~100
  readonly issues: readonly string[];
  readonly metrics: {
    readonly floorCells: number;
    readonly furnitureCells: number;
    readonly unreachableOpenCells: number;
    /** 바닥 bbox 4분면(NW/NE/SW/SE)의 가구+소품 점유 수 — 3차 리뷰 권고 ②(사분면 밀도). */
    readonly quadrantFill: readonly [number, number, number, number];
    readonly rooms: number;
  };
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly feedbackForLlm: string;
}

/** 읽기 전용 실내 평가 — 매니페스트(필수 가구) + 통행 연결성 + 사분면 밀도 균형. */
export function evaluateInteriorRoom(
  map: GameMap,
  plan: InteriorRoomPlan,
  attempt = 1,
  maxAttempts = 3,
): InteriorRoomLookReport {
  const floor = floorMaskFromPlan(plan);
  const issues: string[] = [];

  // 1) 테마 필수 가구
  if (plan.rooms && plan.rooms.length > 0) {
    for (const room of plan.rooms) {
      issues.push(...themeManifestWarnings(map, roomFloorMask(plan, room, floor), room.theme ?? plan.theme, room.id));
    }
  } else {
    issues.push(...themeManifestWarnings(map, floor, plan.theme));
  }

  // 2) 통행 연결성(가구=장애물 보수 가정)
  const reach = reachableOpenCells(map, floor, plan.door);
  let unreachable = 0;
  let floorCells = 0;
  let furnitureCells = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!floor[y * map.width + x]) continue;
      floorCells += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const occupied = !isUpperEmpty(map, x, y) || !isWalkFloor(map, x, y);
      if (occupied) furnitureCells += 1;
      else if (!reach.has(y * map.width + x)) unreachable += 1;
    }
  }
  if (unreachable > 0) issues.push(`walkability: 문에서 도달 불가한 개방 셀 ${unreachable}개`);

  // 3) 사분면 밀도 균형(최저 사분면 < 최고의 25% → 공백 경고)
  // 복도 방 셀은 '의도된 여백'이라 점유·자격 집계에서 모두 제외한다.
  const corridor = corridorCellMask(plan);
  const midX = (minX + maxX) / 2;
  const midY2 = (minY + maxY) / 2;
  const quad: [number, number, number, number] = [0, 0, 0, 0];
  const eligible: [number, number, number, number] = [0, 0, 0, 0];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      if (!floor[i] || corridor.has(i)) continue;
      const qi = (y > midY2 ? 2 : 0) + (x > midX ? 1 : 0);
      eligible[qi] += 1;
      if (isUpperEmpty(map, x, y) && isWalkFloor(map, x, y)) continue;
      quad[qi] += 1;
    }
  }
  // 자격 바닥이 거의 없는 사분면(복도/파티션 위주)은 공백 판정 대상이 아니다.
  const judged = [0, 1, 2, 3].filter((q) => eligible[q]! >= 12);
  const qMax = judged.length ? Math.max(...judged.map((q) => quad[q]!)) : 0;
  const qMin = judged.length ? Math.min(...judged.map((q) => quad[q]!)) : 0;
  if (floorCells >= 60 && qMax > 2 && qMin < qMax * 0.25) {
    const names = ["북서", "북동", "남서", "남동"];
    const worst = judged.find((q) => quad[q] === qMin)!;
    issues.push(`density: ${names[worst]} 사분면이 공백(점유 ${qMin} vs 최대 ${qMax})`);
  }

  // 4) 좌석군 과다(구도 붕괴 — 탁자 세트 스팸): 방 하나에 좌석군 3개 초과 금지.
  if (plan.rooms && plan.rooms.length > 0) {
    const wholeFloor = floorMaskFromPlan(plan);
    for (const room of plan.rooms) {
      const groups = countSeatingGroups(map, roomFloorMask(plan, room, wholeFloor));
      if (groups > 3) issues.push(`composition: 방 ${room.id}에 좌석군 ${groups}개 — 과밀(상한 3)`);
    }
  } else {
    const groups = countSeatingGroups(map, floor);
    if (groups > 3) issues.push(`composition: 좌석군 ${groups}개 — 과밀(상한 3)`);
  }

  const manifestCount = issues.filter((i) => i.startsWith("manifest")).length;
  const compositionCount = issues.filter((i) => i.startsWith("composition")).length;
  const score = Math.max(
    0,
    100
      - (unreachable > 0 ? 40 : 0)
      - manifestCount * 15
      - compositionCount * 15
      - (issues.some((i) => i.startsWith("density")) ? 15 : 0),
  );
  const ok = issues.length === 0;
  const feedbackForLlm = ok
    ? "합격 — 필수 가구·통행 연결성·사분면 밀도 모두 충족."
    : `수정 필요: ${issues.join(" / ")}. 필수 가구는 테마 배치 재실행(furniture 층 forceLayer), 도달 불가는 문·복도 주변 가구 제거, 사분면 공백은 남/빈 사분면에 좌석군·적재물 추가로 해소하라.`;
  return {
    ok,
    score,
    issues,
    metrics: {
      floorCells,
      furnitureCells,
      unreachableOpenCells: unreachable,
      quadrantFill: quad,
      rooms: plan.rooms?.length ?? 0,
    },
    attempt,
    maxAttempts,
    feedbackForLlm,
  };
}

/**
 * 테마 필수 가구 매니페스트(3차 리뷰 권고 ①) — 핵심 가구가 빠진 채 완성되면 경고를 남긴다.
 * (배치 실패가 가능한 소형 방을 고려해 빌드 실패가 아니라 경고 채널로 보고한다.)
 */
function themeManifestWarnings(
  map: GameMap,
  floor: boolean[],
  theme: InteriorRoomTheme,
  roomId?: string,
): string[] {
  const area = floor.filter(Boolean).length;
  if (area < 12) return [];
  const hasTile = (tiles: readonly number[], layer: "upper" | "lower" | "both"): boolean => {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!floor[y * map.width + x]) continue;
        if ((layer === "upper" || layer === "both") && tiles.includes(getU(map, x, y))) return true;
        if ((layer === "lower" || layer === "both") && tiles.includes(getL(map, x, y))) return true;
      }
    }
    return false;
  };
  const where = roomId ? `room=${roomId}` : "map";
  const out: string[] = [];
  if (theme === "bedroom" && !hasTile([VR.BED_L, VR.BED_V_HEAD], "upper")) out.push(`manifest: 침대 없는 침실 (${where})`);
  if (theme === "kitchen" && !hasTile([VR.STOVE_BOT], "lower")) out.push(`manifest: 화덕 없는 주방 (${where})`);
  if (theme === "study" && !hasTile([VR.BOOK_TL], "lower")) out.push(`manifest: 책장 없는 서재 (${where})`);
  if ((theme === "dining" || theme === "tavern") && !hasTile([VR.TABLE_L, VR.SQUARE_TABLE], "upper")) {
    out.push(`manifest: 탁자 없는 ${theme} (${where})`);
  }
  if (theme === "tavern" && area >= 30 && !hasTile([VR.COUNTER_L], "upper")) out.push(`manifest: 카운터 없는 홀 (${where})`);
  return out;
}

function paintThemeFurniture(
  map: GameMap,
  floor: boolean[],
  theme: InteriorRoomTheme,
  door: DoorSpec,
  room?: RoomSpec,
  luxury = false,
): void {
  const wallFace = listWallFace(map, floor).filter(
    (c) => !room || (c.y === room.y - 2 && c.x >= room.x && c.x < room.x + room.w),
  );
  const northFloor = listNorthFloor(floor, map);
  const corners = listCorners(floor, map, door);
  const open = listOpenFloor(floor, map, door);
  const wallSnap = listWallSnapFloor(floor, map, door);
  const area = floor.filter(Boolean).length;
  // 장식 로테이션 — 방 위치 + 시드 RNG로 세트를 바꾼다(같은 테마 방 복붙 방지 + 재생성 다양성).
  const variant = (((room?.x ?? door.x) + (room?.y ?? door.y)) + Math.floor(RNG() * 3)) % 3;
  const plan = { theme, door } as const;
  // No indoor plants (user rule).

  if (plan.theme === "corridor") {
    // 복도: 통행이 주인 — 바닥 점유물 금지, 벽 장식과 벽에 붙는 전시물(흉상/갑옷)만.
    if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW]);
    else placePicturePair(map, wallFace);
    if (area >= 24) {
      const [top, bottom] = variant === 2 ? [VR.ARMOR_T, VR.ARMOR_B] : [VR.BUST_T, VR.BUST_B];
      placeTallPairU(map, northFloor, plan.door, top, bottom);
    }
    return;
  }
  if (plan.theme === "bedroom") {
    // 침대 방향 변주(3차 리뷰: 20장 전원 가로·머리 서쪽 단일 방향) — variant 1은 세로 침대.
    const bed = (variant === 1 ? placeBedVertical(map, northFloor, plan.door) : null)
      ?? placeBedPair(map, northFloor, plan.door);
    // 소품 적재적소: 협탁은 침대 머리맡 옆 1칸 — 성공하면 코너 폴백은 생략.
    const bedside = bed ? placeBedsideProp(map, bed.cells, plan.door) : false;
    // 러그의 주인은 침대(발치 앵커) — 탁자 세트가 아니라. "카펫 과다" 게이트는 유지.
    if (bed && area >= 28 && variant === 0) placeRugUnder(map, bed.x, bed.y + 1, RUG_TEAL);
    placeTallPairU(map, northFloor, plan.door, VR.MIRROR_T, VR.MIRROR_B);
    if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW]);
    else if (variant === 1) placePicturePair(map, wallFace);
    else placeTallPairU(map, northFloor, plan.door, VR.CLOCK_T, VR.CLOCK_B);
    // 소형 객실 밀도 가드(통행 확보): 탁자 세트는 방이 넉넉할 때만 — 4×3 객실은 침대·거울로 충분.
    // 침대 존(주변 2칸)과 러그 위는 후보에서 제외 — 침대에 밥상이 붙는 구도 금지.
    if (area >= 20) {
      const awayFromBed = open.filter(
        (c) =>
          !RUG_TILE_SET.has(getL(map, c.x, c.y))
          && (!bed || bed.cells.every((b) => Math.max(Math.abs(c.x - b.x), Math.abs(c.y - b.y)) > 2)),
      );
      placeTableChairSet(map, awayFromBed, plan.door);
    }
    if (!bedside) placeCorner(map, corners, [VR.BOX]);
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
    // 수정구 남발 축소(3차 리뷰: 7회 등장) — variant 0에만.
    if (variant === 0) placeOpen(map, open, [VR.CRYSTAL_BALL]);
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
    // 창고: 적재물은 벽 스냅이 기본(중앙 부유 금지) — 물량 상향(3차 리뷰: "가장 채우기 쉬운데 가장 비었다").
    placeWallMount(map, wallFace, [VR.LADDER, VR.WINDOW]);
    placeCorner(map, corners, [VR.CRATE, VR.BARREL, VR.GRAIN, VR.BOX, VR.JARS]);
    const loads = Math.max(6, Math.floor(area / 5));
    placeAgainstWall(map, wallSnap, repeatTiles([VR.BARREL, VR.CRATE, VR.JARS, VR.BOX, VR.GRAIN], loads), 1);
    return;
  }
  if (plan.theme === "tavern") {
    // 선술집/홀: 카운터(경로 키트 v1)가 기본 — "카운터 없는 상점" 지적 해소.
    // 피아노·진열대·검 장식은 variant 로테이션으로 분해(동일 홀 클러스터 8회 복붙 지적).
    placeCounterRun(map, northFloor, plan.door);
    const tables = Math.max(1, Math.floor(area / 45));
    let placedTable: { x: number; y: number } | null = null;
    for (let i = 0; i < tables; i += 1) {
      const t = placeLongTable3(map, open, plan.door);
      if (t && !placedTable) placedTable = t;
    }
    // 필수 가구 보장: 긴 탁자가 전부 실패하면 사각 탁자 세트라도 반드시 놓는다.
    if (!placedTable) placeTableChairSet(map, open, plan.door);
    if (variant === 1) placePianoTriple(map, northFloor, plan.door);
    else placeTallPairU(map, northFloor, plan.door, VR.DISPLAY_T, VR.DISPLAY_B);
    placeWallMount(map, wallFace, variant === 2 ? [VR.TAVERN_SIGN, VR.WINDOW, VR.SWORD_RACK] : [VR.TAVERN_SIGN, VR.WINDOW]);
    placeCorner(map, corners, [VR.BARREL, VR.BUCKET, VR.JARS]);
    placeAgainstWall(map, wallSnap, [VR.BARREL, VR.BARREL]);
    return;
  }
  // dining — 장탁자(3칸) 면적 비례, 러그는 상석 탁자 발밑에만, 잔해류(깨진 유리/바닥 구멍)는 금지.
  // 연회장(luxury): 탁자 수 상향(/28) + 상석과 같은 열에 줄 맞춰 배치 — 흩뿌린 탁자는 연회가 아니다.
  const tables = Math.max(1, Math.floor(area / (luxury ? 28 : 40)));
  let headTable: { x: number; y: number } | null = null;
  for (let i = 0; i < tables; i += 1) {
    const t = placeLongTable3(map, open, plan.door, luxury ? headTable?.x : undefined);
    if (t && !headTable) headTable = t;
  }
  // 필수 가구 보장: 식탁 없는 식당 금지 — 긴 탁자가 안 들어가면 사각 탁자 세트로 대체.
  if (!headTable) headTable = placeTableChairSet(map, open, plan.door);
  // 러그: 붉은 카펫은 귀족(gold-brick 저택) 전용, 서민 식당은 짚 돗자리 — 사용자 지정.
  if (headTable && area >= 32) placeRugUnder(map, headTable.x, headTable.y, luxury ? RUG_RED : RUG_MAT);
  placeTallPairU(map, northFloor, plan.door, VR.DISPLAY_T, VR.DISPLAY_B);
  if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW]);
  else placePicturePair(map, wallFace);
  placeCorner(map, corners, [VR.JARS, VR.BOX]);
}

// ── 배치 규칙 헬퍼(2026-07-12): 짝 가구·벽 스냅·밀도 ─────────────────────────

// 결정적 시드 RNG(mulberry32) — 2026-07-13: plan.seed가 실제 배치를 흔들도록 도입.
// (그 전까지 seed는 어디에도 안 쓰여 재생성이 항상 동일 결과였다.)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let RNG: () => number = mulberry32(1);

/** 후보 배열을 시드 기반으로 회전 — 침대/화덕/카운터가 매 시드마다 다른 자리에서 시작한다. */
function rotated<T>(arr: readonly T[]): T[] {
  if (arr.length < 2) return [...arr];
  const k = Math.floor(RNG() * arr.length);
  return [...arr.slice(k), ...arr.slice(0, k)];
}

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
      if (!F(x, y)) continue;
      // 문 접근로(±2칸)만 비운다 — 행/열 전체 제외는 문이 최남단 행인 맵의 남쪽 벽을 통째로 잠식한다.
      if (y === door.y && Math.abs(x - door.x) <= 2) continue;
      if (x === door.x && Math.abs(y - door.y) <= 2) continue;
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

/** 벽 스냅 셀에 소품을 차례로 놓는다(통행 가능한 upper 소품 전제). gap=1이면 밀착 적재(창고). */
function placeAgainstWall(
  map: GameMap,
  cells: Array<{ x: number; y: number }>,
  tiles: readonly number[],
  gap: 1 | 2 = 2,
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
    ci += gap;
  }
}

/** 세로 침대(머리 324 북쪽 + 몸통 354) — 침대 방향 변주용. 벽면 아래 북측 바닥에 세운다. */
function placeBedVertical(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
): { x: number; y: number; cells: Array<{ x: number; y: number }> } | null {
  for (const c of rotated(northFloor)) {
    if (c.x === door.x) continue;
    if (!isWalkFloor(map, c.x, c.y) || !isWalkFloor(map, c.x, c.y + 1)) continue;
    if (!isUpperEmpty(map, c.x, c.y) || !isUpperEmpty(map, c.x, c.y + 1)) continue;
    // hard pair — 반쪽 침대 금지 (324 바로 아래 354)
    setU(map, c.x, c.y, VR.BED_V_HEAD);
    setU(map, c.x, c.y + 1, VR.BED_V_FOOT);
    return { x: c.x, y: c.y, cells: [{ x: c.x, y: c.y }, { x: c.x, y: c.y + 1 }] };
  }
  return null;
}

/**
 * 카운터 일자 런(경로 키트 v1): 좌 408 · 몸통 409(반복) · 우 410 — 북벽 아래에 3~5칸.
 * 상점/여관/길드 홀의 "카운터 없음" 결손 해소. 코너·ㄷ자 조립은 다음 단계(경로 키트 v2).
 */
function placeCounterRun(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
): boolean {
  const byY = new Map<number, number[]>();
  for (const c of northFloor) {
    const xs = byY.get(c.y) ?? [];
    xs.push(c.x);
    byY.set(c.y, xs);
  }
  for (const [northY, xsRaw] of byY) {
    // 카운터는 북벽 바로 아래가 아니라 한 행 남쪽 — 벽과 카운터 사이에 점원이 설 통로를 남긴다.
    // (벽에 붙이면 바 뒤 공간이 없어 "이상한 데 놓인 선반"으로 읽힌다 — 사용자 반복 지적.)
    const y = northY + 1;
    // 배치 가능 셀만으로 런을 구성 — 문 열·센티널(방 입구)·선점 셀이 자연스럽게 런을 쪼갠다.
    // 점원 행(북벽 아래 행)도 비어 있어야 그 구간이 바로 성립한다.
    const xs = [...new Set(xsRaw)]
      .filter(
        (x) =>
          x !== door.x
          && isWalkFloor(map, x, y) && isUpperEmpty(map, x, y)
          && isWalkFloor(map, x, northY) && isUpperEmpty(map, x, northY),
      )
      .sort((a, b) => a - b);
    const place = (start: number, L: number): void => {
      for (let i = 0; i < L; i += 1) {
        setU(map, start + i, y, i === 0 ? VR.COUNTER_L : i === L - 1 ? VR.COUNTER_R : VR.COUNTER_M);
      }
    };
    // "떠 있는 카운터" 방지: 런의 서쪽 끝 또는 동쪽 끝에 붙는(코너 앵커) 창만 허용.
    const runs: Array<{ start: number; len: number }> = [];
    for (let i = 0; i < xs.length; i += 1) {
      if (i > 0 && xs[i]! === xs[i - 1]! + 1) runs[runs.length - 1]!.len += 1;
      else runs.push({ start: xs[i]!, len: 1 });
    }
    for (const run of rotated(runs)) {
      if (run.len < 3) continue;
      place(run.start, Math.min(5, run.len));
      return true;
    }
  }
  return false;
}

/**
 * 남쪽 공백 필러(3차 리뷰: "북쪽 가구, 남쪽 공백" 17/20장) — 넓은 방의 남반부에
 * 테마에 맞는 클러스터를 하나 더 놓는다: 좌석군(tavern/dining/study/bedroom) 또는 적재물(storage/kitchen).
 */
function placeSouthFiller(
  map: GameMap,
  floor: boolean[],
  theme: InteriorRoomTheme,
  door: DoorSpec,
  area: number,
): void {
  if (area < 48) return;
  const ys: number[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) if (floor[y * map.width + x]) ys.push(y);
  }
  if (ys.length === 0) return;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const south = listOpenFloor(floor, map, door).filter((c) => c.y > midY);
  if (south.length === 0) return;
  // 좌석군 상한: 방에 이미 좌석군이 2개 이상이면 남쪽 필러는 적재물로 대체(좌석 스팸 방지).
  if (theme === "storage" || theme === "kitchen" || countSeatingGroups(map, floor) >= 2) {
    const southSnap = listWallSnapFloor(floor, map, door).filter((c) => c.y > midY);
    placeAgainstWall(map, southSnap, [VR.BARREL, VR.CRATE, VR.GRAIN]);
    return;
  }
  placeTableChairSet(map, south, door);
}

// 사분면 필러 소품 — 좌석 금지(스팸 상한과 충돌), 벽 스냅 단일 소품만.
// VR.PLANT(289)는 월드맵 겸용 수풀 작화라 실내 금지(기존 테스트 계약).
const QUADRANT_FILLER_GOODS: Record<InteriorRoomTheme, readonly number[]> = {
  bedroom: [VR.BOX, VR.JARS, VR.BUCKET],
  study: [VR.BOX, VR.JARS, VR.CRATE],
  dining: [VR.JARS, VR.BARREL, VR.BUCKET],
  kitchen: [VR.JARS, VR.BUCKET, VR.BARREL],
  storage: [VR.BARREL, VR.CRATE, VR.GRAIN],
  tavern: [VR.BARREL, VR.JARS, VR.CRATE],
  corridor: [], // 복도는 여백이 정답 — 필러 없음
};

/** 복도 테마 방들의 셀 집합 — 사분면 공백 판정·필러에서 '의도된 여백'으로 제외한다. */
function corridorCellMask(plan: InteriorRoomPlan): Set<number> {
  const out = new Set<number>();
  for (const room of plan.rooms ?? []) {
    if ((room.theme ?? plan.theme) !== "corridor") continue;
    for (let dy = 0; dy < room.h; dy += 1) {
      for (let dx = 0; dx < room.w; dx += 1) {
        out.add((room.y + dy) * plan.width + room.x + dx);
      }
    }
  }
  return out;
}

/**
 * 사분면 공백 보정 — 평가기와 같은 기준(최저 사분면 점유 < 최고의 25%)으로 공백 사분면을 찾아
 * 벽 스냅 자리에 테마 소품을 채운다. 한 점 놓을 때마다 문 BFS로 통행을 재검증하고 도달 불가
 * 셀이 생기면 즉시 되돌린다 — 수리가 통행을 깨던 사고(85→60)의 재발 방지.
 */
function fillSparseQuadrants(map: GameMap, floor: boolean[], plan: InteriorRoomPlan): void {
  const w = map.width;
  const corridor = corridorCellMask(plan);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let floorCells = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!floor[y * w + x]) continue;
      floorCells += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (floorCells < 60) return;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const quadOf = (x: number, y: number) => (y > midY ? 2 : 0) + (x > midX ? 1 : 0);
  const eligible: [number, number, number, number] = [0, 0, 0, 0];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (floor[i] && !corridor.has(i)) eligible[quadOf(x, y)] += 1;
    }
  }
  const occupancy = (): [number, number, number, number] => {
    const q: [number, number, number, number] = [0, 0, 0, 0];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (!floor[i] || corridor.has(i)) continue;
        if (isUpperEmpty(map, x, y) && isWalkFloor(map, x, y)) continue;
        q[quadOf(x, y)] += 1;
      }
    }
    return q;
  };
  const anyUnreachable = (): boolean => {
    const reach = reachableOpenCells(map, floor, plan.door);
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const j = y * w + x;
        if (floor[j] && isWalkFloor(map, x, y) && isUpperEmpty(map, x, y) && !reach.has(j)) return true;
      }
    }
    return false;
  };
  const goods = QUADRANT_FILLER_GOODS[plan.theme];
  if (goods.length === 0) return;
  const snap = listWallSnapFloor(floor, map, plan.door).filter((c) => !corridor.has(c.y * w + c.x));
  const judged = [0, 1, 2, 3].filter((q) => eligible[q]! >= 12);
  if (judged.length === 0) return;
  for (let guard = 0; guard < 12; guard += 1) {
    const q = occupancy();
    const qMax = Math.max(...judged.map((j) => q[j]!));
    const qMin = Math.min(...judged.map((j) => q[j]!));
    if (!(qMax > 2 && qMin < qMax * 0.25)) return;
    const target = judged.find((j) => q[j] === qMin)!;
    const cands = snap.filter(
      (c) => quadOf(c.x, c.y) === target && isWalkFloor(map, c.x, c.y) && isUpperEmpty(map, c.x, c.y),
    );
    let placedOne = false;
    for (const c of rotated(cands)) {
      setU(map, c.x, c.y, goods[guard % goods.length]!);
      if (anyUnreachable()) {
        setU(map, c.x, c.y, TILE.EMPTY);
        continue;
      }
      placedOne = true;
      break;
    }
    if (!placedOne) return; // 채울 자리가 없으면 남은 공백은 평가기가 보고한다
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
  for (const c of rotated(northFloor)) {
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

/** 중심 근접 순 정렬 + 시드 지터 — '북벽 몰림'을 막고 재생성마다 자리가 조금씩 달라진다. */
function sortByCenter(
  open: Array<{ x: number; y: number }>,
  center: { x: number; y: number } | null,
): Array<{ x: number; y: number }> {
  if (!center) return open;
  const jitter = new Map(open.map((c) => [c, RNG() * 10]));
  const d2 = (c: { x: number; y: number }) =>
    (c.x - center.x) ** 2 + (c.y - center.y) ** 2 + (jitter.get(c) ?? 0);
  return [center, ...[...open].sort((a, b) => d2(a) - d2(b))];
}

// 좌석군 구성 타일(탁자·의자·스툴) — 간격 규칙과 좌석군 개수 상한 판정에 쓴다.
const SEATING_TILES = new Set<number>([
  VR.SQUARE_TABLE, VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3, VR.CHAIR_LEFT, VR.CHAIR_RIGHT, VR.STOOL,
]);

/** 방 마스크 안의 좌석군 개수(탁자 앵커 기준: 사각 328 + 긴 탁자 좌단 325). */
function countSeatingGroups(map: GameMap, floor: boolean[]): number {
  let n = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!floor[y * map.width + x]) continue;
      const u = getU(map, x, y);
      if (u === VR.SQUARE_TABLE || u === VR.TABLE_L) n += 1;
    }
  }
  return n;
}

/** 주변에 다른 좌석군이 붙어 있으면 금지 — "탁자 기차/계단식 밀집" 방지(긴 탁자와 동일 규칙). */
function nearSeating(map: GameMap, cx: number, cy: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (SEATING_TILES.has(getU(map, cx + dx, cy + dy))) return true;
    }
  }
  return false;
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
    if (nearSeating(map, c.x, c.y) || nearSeating(map, c.x + 1, c.y)) continue;
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
  alignX?: number,
): { x: number; y: number } | null {
  // 연회 정렬: alignX가 있으면 같은 열(±1) 후보를 우선 — 탁자들이 세로로 줄 맞춰 선다.
  const base = sortByCenter(open, centroid(open));
  const candidates = alignX === undefined
    ? base
    : [...base.filter((c) => Math.abs(c.x + 1 - alignX) <= 1), ...base.filter((c) => Math.abs(c.x + 1 - alignX) > 1)];
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
    for (const c of rotated([...row].sort((a, b) => a.x - b.x))) {
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
  for (const c of rotated(northFloor)) {
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
): { x: number; y: number; cells: Array<{ x: number; y: number }> } | null {
  for (const c of rotated(northFloor)) {
    if (c.x === door.x || c.x + 1 === door.x) continue;
    if (!isWalkFloor(map, c.x, c.y) || !isWalkFloor(map, c.x + 1, c.y)) continue;
    if (!isUpperEmpty(map, c.x, c.y) || !isUpperEmpty(map, c.x + 1, c.y)) continue;
    // hard pair — never place half bed (355 must be immediately left of 356)
    setU(map, c.x, c.y, VR.BED_L);
    setU(map, c.x + 1, c.y, VR.BED_R);
    return { x: c.x, y: c.y, cells: [{ x: c.x, y: c.y }, { x: c.x + 1, y: c.y }] };
  }
  return null;
}

/** 협탁(적재적소 규칙): 침대 셀들의 좌우 인접 바닥 중 첫 자리에 수납장(295)을 붙인다. */
function placeBedsideProp(
  map: GameMap,
  bedCells: Array<{ x: number; y: number }>,
  door: DoorSpec,
): boolean {
  for (const b of bedCells) {
    for (const dx of [1, -1]) {
      const x = b.x + dx;
      if (x === door.x) continue;
      if (!isWalkFloor(map, x, b.y) || !isUpperEmpty(map, x, b.y)) continue;
      setU(map, x, b.y, VR.BOX);
      return true;
    }
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
  // wallMaterial 리틴트 이후의 재시공(furnishInteriorSpace)에서도 벽면을 찾도록 리틴트 면 포함.
  const faceTiles = new Set<number>([
    HOUSE_WALL_FACE.L,
    HOUSE_WALL_FACE.M,
    HOUSE_WALL_FACE.R,
    ...Object.values(WALL_FACE_RETINT).flatMap((spec) => [...spec.upper, ...spec.lower]),
  ]);
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
  return FLOOR_MATERIAL_TILES.has(tile) || RUG_TILE_SET.has(tile);
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
