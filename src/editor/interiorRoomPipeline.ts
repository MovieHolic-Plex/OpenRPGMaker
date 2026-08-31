/**
 * villager-room-v1 procedural interior pipeline (village-session style layers).
 *
 * Layers (multi-turn / one-shot):
 *   plan → floor (bbox) → walls → furniture → entrance → critique
 *
 * Walls (천장 정본, 2026-07-20 사용자 교정): `planInteriorHouseWalls` /
 * `paintInteriorHouseWalls` — 천장(구조 질량)은 366 오토타일 하나로 통일(비드 테두리는
 * 쿼터 렌더 성형), 남향 모서리에는 크림 벽면 2행(74–76/104–106, 1칸 77/107),
 * 모든 벽면 위에는 반드시 천장(쌍 불변식). 문은 천장 띠를 뚫는 바닥 통로만 —
 * 스텝 397·플랭크 396/398·캡 457/456/458·포스트 426/428 낱장 금지. Forbidden: 233/257/258.
 *
 * Furniture surfaces:
 *   wallFace | againstWall | corner | openFloor | anyFloor  (PlacementZone 공용 어휘)
 * Hard cluster: bed 355 left-of 356 (upper) — openwiki hard adjacency contract.
 */
import {
  CEILING_MEMBER_TILES,
  paintInteriorHouseWalls,
  planInteriorHouseWalls,
  shapeInteriorCeiling,
} from "@/editor/interiorHouseWallGrammar";
import { HOUSE_SHELL_MEMBER_TILES } from "@/project/defaults/interiorHouseWallTiles";
import { DEFAULT_TILE_SIZE, TILE } from "@/project/defaults/constants";
import {
  createDarkWallAutotileGroup,
  DARK_WALL_AUTOTILE_GROUP_ID,
  DARK_WALL_TILE,
} from "@/project/defaults/darkWallAutotile";
import { DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
// 순환 의존(카탈로그 → 이 모듈의 interiorVocabTiles)이므로 import 순서상 마지막에 둔다:
// 카탈로그 본문이 실행될 때 DARK_WALL_TILE 등 상위 상수가 이미 초기화되어 있어야 한다.
import { INTERIOR_OBJECT_CATALOG, interiorObjectById, type InteriorObjectCell } from "@/editor/interiorObjectCatalog";
import {
  resolveInteriorRoomVocab,
  seedInteriorTilesetCatalog,
  type InteriorRoomVocab,
} from "@/editor/interiorRoomVocab";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { asPlacementFacing } from "@/project/placementSurface";
import type {
  ClusterRule,
  GameEvent,
  GameMap,
  InteriorRoomKindRecord,
  MapId,
  PlacementFacing,
  PlacementZone,
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

/**
 * 하우스 셸 타일 — Option B whole-tile grammar (map_interior_blank 골드 기준).
 * 크림 벽면 2단: 윗줄 74/75/76 · 아랫줄 104/105/106 · 1칸 칸막이 77/107.
 * 문: 398|floor|396 + 아래 397 only (257 금지). 캡 조인트 458/456 (233/258 금지).
 */
export const HOUSE_WALL_FACE = {
  /** 가로 run 윗줄 (천장 쪽 회벽). */
  UL: 74,
  UM: 75,
  UR: 76,
  /** 가로 run 아랫줄 (걸레받이). */
  L: 104,
  M: 105,
  R: 106,
  /** 1칸 세로 칸막이 크림 상단(천장 직하). */
  SOLO_U: 77,
  /** 1칸 세로 칸막이 크림 하단(걸레받이). */
  SOLO_L: 107,
  /** 북벽 최상단 캡(트림). 조인트는 458/456. */
  CAP: 457,
  DOOR_WEST: 398,
  DOOR_EAST: 396,
  DOOR_STEP: 397,
} as const;

/**
 * 실내 어휘 타일 사전 생성자 — 함수 선언은 모듈 인스턴스화 시점에 이미 준비되므로,
 * 이 모듈을 순환 참조하는 interiorObjectCatalog가 자기 모듈 본문에서 곧바로 어휘를 읽을 수 있다.
 * (`export const VR`을 순환 초기화 중에 직접 읽으면 TDZ에 걸려 undefined 접근으로 터진다.)
 */
export function interiorVocabTiles() {
  return {
    VOID: 430,
    FLOOR: 72,
    FLOOR_HOLE: 73,
    /** Dark wall body / brush (autotile). */
    BODY: DARK_WALL_TILE.BODY,
    INNER_L: 104,
    INNER_R: 106,
    /** @deprecated legacy dark-wall store variants — render quarters only under Option B */
    EDGE_W: 396,
    EDGE_E: 398,
    EDGE_N: 367,
    EDGE_S: 427,
    CORNER_NW: 368,
    CORNER_NE: 369,
    BEAM_SW: 426,
    BEAM_SE: 428,
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
    /** 벽난로 아궁이(373) — 벽면 매립 화구. 실내 바닥 모닥불(124) 대체(2026-07-20). */
    HEARTH: 373,
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
}

export const VR = interiorVocabTiles();

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

/**
 * Where a prop may be placed.
 *
 * 2026-08-30: 자체 어휘(`againstWallFloor`/`cornerFloor`/`floorDebris`)를 버리고
 * 프로젝트 공용 `PlacementZone` 으로 갈아탔다. 이유는 둘이다:
 *  ① 이 표는 여기서만 쓰이고 편집 UI 가 없어서, 같은 뜻을 타일 그룹 규칙(surface)에
 *    또 적어야 했다 — 두 벌은 곧 어긋난다.
 *  ② 선언된 5값 중 `againstWallFloor` 와 `floorDebris` 는 **어디서도 조회되지 않았다**.
 *    한 어휘로 합치면 그런 죽은 값이 생기지 않는다.
 * 뜻 대응: againstWallFloor→againstWall, cornerFloor→corner, floorDebris→anyFloor.
 */
export type PropSurface = PlacementZone;

export const PROP_SURFACE: Readonly<Record<number, PropSurface>> = {
  [VR.WINDOW]: "wallFace",
  [VR.PICTURE_L]: "wallFace",
  [VR.PICTURE_R]: "wallFace",
  [VR.RELIGIOUS]: "wallFace",
  [VR.SWORD_RACK]: "wallFace",
  [VR.BED_L]: "againstWall",
  [VR.BED_R]: "againstWall",
  [VR.BOOK_TL]: "againstWall",
  [VR.CABINET_U]: "againstWall",
  [VR.PLANT]: "corner",
  [VR.GRAIN]: "corner",
  [VR.BOX]: "corner",
  [VR.TABLE_TOP]: "openFloor",
  [VR.TABLE_BOT]: "openFloor",
  [VR.CHAIR_LEFT]: "openFloor",
  [VR.CHAIR_RIGHT]: "openFloor",
  [VR.BROKEN_GLASS]: "anyFloor",
  [VR.FLOOR_HOLE]: "anyFloor",
  [VR.STAIRS_DOWN]: "anyFloor",
  // kitchen/storage/tavern 테마 가구.
  [VR.FRUIT_SHELF]: "wallFace",
  [VR.SHELF_JARS]: "wallFace",
  [VR.TAVERN_SIGN]: "wallFace",
  [VR.LADDER]: "wallFace",
  [VR.BUCKET]: "corner",
  [VR.JARS]: "corner",
  [VR.CRATE]: "corner",
  [VR.BARREL]: "corner",
  [VR.CAULDRON]: "openFloor",
  [VR.KETTLE]: "openFloor",
  [VR.TABLE_L]: "openFloor",
  [VR.TABLE_R]: "openFloor",
  [VR.TABLE_R3]: "openFloor",
  [VR.STOOL]: "openFloor",
  [VR.SQUARE_TABLE]: "openFloor",
  [VR.CRYSTAL_BALL]: "openFloor",
  [VR.MIRROR_T]: "againstWall",
  [VR.CLOCK_T]: "againstWall",
  [VR.BUST_T]: "againstWall",
  [VR.ARMOR_T]: "againstWall",
  [VR.DISPLAY_T]: "againstWall",
  [VR.PIANO_L]: "againstWall",
  // 화덕·아궁이(2026-08-30). 예전에는 이 표에 **없었다** — 「북벽에 붙여 배치」는 주석과
  // 절차 코드에만 있었고, 그래서 사용자가 고칠 수도 검사할 수도 없었다.
  // 세로쌍의 발밑(51)이 벽에 붙은 바닥이고 상단(21)은 그 위 벽면에 겹친다.
  [VR.STOVE_BOT]: "againstWall",
  [VR.STOVE_TOP]: "wallFace",
  [VR.HEARTH]: "wallFace",
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
export type InteriorThemeModifier = "rustic" | "luxury" | "sacred" | "scholarly" | "martial";

export const INTERIOR_THEME_MODIFIERS: readonly InteriorThemeModifier[] = [
  "rustic",
  "luxury",
  "sacred",
  "scholarly",
  "martial",
] as const;

export type RoomSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 타일셋 방 종류 id. 기본 7종은 InteriorRoomTheme 과 같다. */
  readonly theme?: string;
  /** Composable mood/program overlays; e.g. dining+sacred or study+martial. */
  readonly modifiers?: readonly InteriorThemeModifier[];
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

export type InteriorSemanticTileRole = "bed" | "bookshelf" | "stove" | "table" | "counter";

export interface InteriorSemanticTileSet {
  readonly label: string;
  readonly tileIds: readonly number[];
  readonly layer: "lower" | "upper" | "both";
}

/** Stable semantic seam between room grammar/evaluation and the current EasyRPG art IDs. */
export const INTERIOR_SEMANTIC_TILE_CATALOG: Readonly<Record<InteriorSemanticTileRole, InteriorSemanticTileSet>> = {
  bed: { label: "침대", tileIds: [VR.BED_L, VR.BED_R, VR.BED_V_HEAD, VR.BED_V_FOOT], layer: "upper" },
  bookshelf: { label: "책장", tileIds: [VR.BOOK_TL, VR.BOOK_TR, VR.BOOK_ML, VR.BOOK_MR, VR.BOOK_BL, VR.BOOK_BR], layer: "lower" },
  stove: { label: "화덕", tileIds: [VR.STOVE_TOP, VR.STOVE_BOT], layer: "lower" },
  table: { label: "탁자", tileIds: [VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3, VR.SQUARE_TABLE], layer: "upper" },
  counter: { label: "카운터", tileIds: [VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R], layer: "upper" },
};

export interface InteriorThemeGrammar {
  readonly label: string;
  readonly requiredRoles: readonly InteriorSemanticTileRole[];
  readonly suggestedModifiers: readonly InteriorThemeModifier[];
}

/** Data-driven role grammar. Modifiers compose with these roles instead of multiplying hard-coded themes. */
export const INTERIOR_ROOM_THEME_CATALOG: Readonly<Record<InteriorRoomTheme, InteriorThemeGrammar>> = {
  bedroom: { label: "침실", requiredRoles: ["bed"], suggestedModifiers: ["rustic", "luxury"] },
  study: { label: "서재", requiredRoles: ["bookshelf"], suggestedModifiers: ["scholarly", "sacred"] },
  dining: { label: "식당/홀", requiredRoles: ["table"], suggestedModifiers: ["rustic", "luxury", "sacred"] },
  kitchen: { label: "주방", requiredRoles: ["stove"], suggestedModifiers: ["rustic"] },
  storage: { label: "창고", requiredRoles: [], suggestedModifiers: ["rustic", "martial"] },
  tavern: { label: "선술집", requiredRoles: ["table", "counter"], suggestedModifiers: ["rustic", "luxury"] },
  corridor: { label: "복도", requiredRoles: [], suggestedModifiers: ["luxury", "sacred", "martial"] },
};

let activeInteriorVocab: InteriorRoomVocab | null = null;

export function interiorVocabFromTileset(tileset: Project["tilesets"][string] | undefined): InteriorRoomVocab {
  return resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
}

function currentInteriorVocab(): InteriorRoomVocab {
  return activeInteriorVocab ?? interiorVocabFromTileset(undefined);
}

function withInteriorVocab<T>(vocab: InteriorRoomVocab | undefined, fn: () => T): T {
  if (!vocab) return fn();
  const previous = activeInteriorVocab;
  activeInteriorVocab = vocab;
  try {
    return fn();
  } finally {
    activeInteriorVocab = previous;
  }
}

export function seedDefaultInteriorCatalog(tileset: Project["tilesets"][string]): boolean {
  return seedInteriorTilesetCatalog(tileset, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
}

export type InteriorRoomPlan = {
  readonly mapId: MapId;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly wings: readonly Wing[];
  readonly door: DoorSpec;
  /** 타일셋 방 종류 id. 기본 7종은 InteriorRoomTheme. */
  readonly theme: string;
  /** 가구·방 종류를 읽을 타일셋. 생략 시 실내 칩셋. */
  readonly tilesetId?: string;
  /** Plan-wide composable overlays; room.modifiers overrides this list for that room. */
  readonly themeModifiers?: readonly InteriorThemeModifier[];
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

/**
 * 화덕은 북쪽 벽에 붙는다 — **데이터로 적은 정본**(2026-08-30).
 *
 * 예전에는 같은 뜻이 세 군데에 흩어져 있었다: 타일 상수 주석, 그룹의 placementRules 문장,
 * 그리고 `placeStovePair` 안의 손으로 쓴 이웃 검사. 셋 중 어느 것도 사용자가 고칠 수 없었고
 * 맵 위의 위반을 잡아 주지도 않았다. 이제 이 규칙 하나가
 *  - 절차 생성의 자리 판정(`placeStovePair` 가 방향을 여기서 읽는다),
 *  - projectLint 의 맵 감사(`cluster-rule:surface:*` → 규칙 감사 패널),
 *  - 타일셋 지식 인스펙터의 «배치 면» 드롭다운(사용자가 방향을 바꿀 수 있다)
 * 세 곳을 동시에 움직인다.
 */
export function interiorStoveSurfaceRule(): ClusterRule {
  return {
    id: "r_interior_stove_north_wall",
    kind: "surface",
    strength: "hard",
    message: "화덕(21+51)은 북쪽 벽에 등을 대고 놓입니다 — 발밑(51)이 바닥이고 그 위가 벽면이어야 합니다.",
    params: { zone: "againstWall", facing: "north" },
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
    // 천장 정본 v2(2026-07-20): 천장(구조 질량·바깥 어둠)은 검정+회암 테두리 오토타일
    // (앵커 369, body 430) 하나 — 저장 시점 성형(shapeInteriorCeiling). 체커 블록(366 계열)은 배제.
    // 남향 모서리(아래가 바닥)에는 반드시 크림 벽면 2행, 모든 벽면 위에는 반드시 천장(쌍 불변식).
    // 233/258/257은 벽 아트가 아니라 핑크/질감 플레이스홀더 — 금지(HOUSE_SHELL_FORBIDDEN_TILES).
    group("house-shell", "하우스 셸(천장 430 오토타일 + 크림 벽면)", "wall", "lower", [
      ...CEILING_MEMBER_TILES,
      HOUSE_WALL_FACE.UL, HOUSE_WALL_FACE.UM, HOUSE_WALL_FACE.UR,
      HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R,
      HOUSE_WALL_FACE.SOLO_U, HOUSE_WALL_FACE.SOLO_L,
    ], "집 실내 표준 벽: 천장=검정+회암 테두리 오토타일(앵커 369·body 430) 통일, 벽 위 필수 + 남향 모서리 크림 면 위 74/75/76 · 아래 104/105/106(1칸 77/107). 체커 블록(366-368/396-398/426-428/456-458)과 캡/포스트/트림/플랭크 낱장 사용 금지 — 문은 바닥 통로만"),
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
    group("corner-props", "구석 소품", "prop", "upper", [VR.GRAIN, VR.BOX, VR.PLANT, VR.BUCKET, VR.JARS, VR.CRATE, VR.BARREL], "구석 바닥(corner)만", {
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
      rules: [interiorStoveHardRule(), interiorStoveSurfaceRule()],
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

  // Dark wall 366 brush autotile (legacy store brush — 집 셸에는 미사용).
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

  // 천장 정본 v2: 검정+회암 테두리 천장 오토타일(앵커 369·body 430) — 집 셸의 정본 천장.
  const ceiling = {
    ...DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP,
    id: `${INTERIOR_ROOM_HARNESS_PREFIX}ceiling`,
    name: "천장(회암 테두리)",
  };
  const groups = ts.autotileGroups ?? [];
  const ceilingIdx = groups.findIndex((g) => g.id === ceiling.id);
  if (ceilingIdx < 0) {
    ts.autotileGroups = [...groups, ceiling];
    changed = true;
  } else if (JSON.stringify(groups[ceilingIdx]!.variantMap) !== JSON.stringify(ceiling.variantMap)) {
    const next = [...groups];
    next[ceilingIdx] = ceiling;
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
  changed = seedDefaultInteriorCatalog(ts) || changed;
  return changed;
}

// ── Phased build ────────────────────────────────────────────────────────────

/**
 * 세션 시작 맵. 계획된 바닥 footprint(rooms/wings)를 기본 바닥 타일로 미리 깔아 둔다.
 *
 * 예전에는 전면 VOID(통행 불가)였다. 그래서 이 맵이 **시작 맵을 교체**하면 플레이어 시작 좌표가
 * 즉시 통행 불가가 되어 커밋이 `시작 위치가 통행 불가 타일입니다` 로 거부됐고, 모델은 원인이
 * 자기 인자가 아닌 줄 모른 채 좌표만 바꿔 4회 재시도했다(2026-08-23 실측). 바닥 레이어가
 * 뒤에서 정식으로 다시 칠하므로 이 선칠은 최종 결과를 바꾸지 않는다.
 */
export function createEmptyRoomMap(plan: InteriorRoomPlan): GameMap {
  const lowerTiles = new Array<number>(plan.width * plan.height).fill(VR.VOID);
  for (const rect of floorFootprintRects(plan)) {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (x < 0 || y < 0 || x >= plan.width || y >= plan.height) continue;
        lowerTiles[y * plan.width + x] = plan.floorTile ?? VR.FLOOR;
      }
    }
  }
  return {
    id: plan.mapId,
    name: plan.name,
    width: plan.width,
    height: plan.height,
    tilesetId: plan.tilesetId ?? INTERIOR_ROOM_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles,
    upperTiles: new Array(plan.width * plan.height).fill(TILE.EMPTY),
    events: [],
  };
}

/** 계획된 바닥 영역 — rooms 우선, 없으면 wings. */
function floorFootprintRects(plan: InteriorRoomPlan): readonly { x: number; y: number; w: number; h: number }[] {
  const rooms = plan.rooms ?? [];
  if (rooms.length > 0) return rooms.map((room) => ({ x: room.x, y: room.y, w: room.w, h: room.h }));
  return (plan.wings ?? []).map((wing) => ({ x: wing.x, y: wing.y, w: wing.w, h: wing.h }));
}

/** Validate room bboxes before paint. Returns issues (empty = ok). */
export function validateInteriorRoomPlan(plan: InteriorRoomPlan): string[] {
  const issues: string[] = [];
  const rooms = plan.rooms ?? [];
  if (rooms.length === 0 && (plan.wings?.length ?? 0) === 0) {
    issues.push("plan: rooms/wings empty — no floor footprint");
    return issues;
  }
  // Overlap: axis-aligned rooms must not share floor cells (partition walls need a gap or explicit shared edge policy).
  for (let i = 0; i < rooms.length; i += 1) {
    const a = rooms[i]!;
    if (a.w < 2 || a.h < 2) issues.push(`plan: room '${a.id}' too small (${a.w}x${a.h})`);
    if (a.x < 0 || a.y < 0 || a.x + a.w > plan.width || a.y + a.h > plan.height) {
      issues.push(`plan: room '${a.id}' out of bounds`);
    }
    for (let j = i + 1; j < rooms.length; j += 1) {
      const b = rooms[j]!;
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlapX && overlapY) {
        issues.push(`plan: rooms '${a.id}' and '${b.id}' overlap`);
      }
    }
  }
  // Door on floor union
  const floor = floorMaskFromPlan(plan);
  if (!floor[plan.door.y * plan.width + plan.door.x]) {
    issues.push(`plan: exterior door (${plan.door.x},${plan.door.y}) not on floor mask`);
  }
  // Reachability between rooms via floor mask (4-neighbor)
  if (rooms.length >= 2) {
    const key = (x: number, y: number) => `${x},${y}`;
    const visited = new Set<string>();
    const q: Array<{ x: number; y: number }> = [{ x: plan.door.x, y: plan.door.y }];
    visited.add(key(plan.door.x, plan.door.y));
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (!inBounds(nx, ny, plan.width, plan.height)) continue;
        if (!floor[ny * plan.width + nx]) continue;
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        visited.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    for (const room of rooms) {
      let hit = false;
      for (let dy = 0; dy < room.h && !hit; dy += 1) {
        for (let dx = 0; dx < room.w && !hit; dx += 1) {
          const x = room.x + dx;
          const y = room.y + dy;
          if (floor[y * plan.width + x] && visited.has(key(x, y))) hit = true;
        }
      }
      if (!hit) issues.push(`plan: room '${room.id}' unreachable from door (check innerDoors / gaps)`);
    }
  }
  return issues;
}

export function runInteriorRoomPipeline(plan: InteriorRoomPlan, vocab?: InteriorRoomVocab): {
  readonly map: GameMap;
  readonly log: string[];
  readonly ok: boolean;
  readonly warnings: string[];
} {
  return withInteriorVocab(vocab, () => {
    let map = createEmptyRoomMap(plan);
    const log: string[] = [];
    const warnings: string[] = [];
    for (const layer of INTERIOR_ROOM_BUILD_ORDER) {
      const result = applyInteriorRoomLayer(map, plan, layer, vocab);
      map = result.map;
      log.push(`[${layer}] ${result.summary}`);
      warnings.push(...result.warnings);
      if (!result.ok && (layer === "critique" || layer === "plan")) {
        return { map, log, ok: false, warnings };
      }
    }
    return { map, log, ok: true, warnings };
  });
}

export function applyInteriorRoomLayer(
  map: GameMap,
  plan: InteriorRoomPlan,
  layer: RoomLayer,
  vocab?: InteriorRoomVocab,
): BuildPhaseResult {
  if (vocab) {
    return withInteriorVocab(vocab, () => applyInteriorRoomLayer(map, plan, layer));
  }
  const warnings: string[] = [];
  switch (layer) {
    case "plan": {
      const planIssues = validateInteriorRoomPlan(plan);
      warnings.push(...planIssues);
      return {
        map,
        layer,
        summary: `plan rooms=${plan.rooms?.length ?? 0} wings=${plan.wings.length} door=(${plan.door.x},${plan.door.y}) theme=${plan.theme}`,
        warnings,
        ok: planIssues.length === 0,
      };
    }
    case "floor": {
      const next = cloneMap(map);
      paintFloorBboxes(next, plan);
      return { map: next, layer, summary: "floor bbox filled (72)", warnings, ok: true };
    }
    case "walls": {
      const next = cloneMap(map);
      const floor = floorMaskFromPlan(plan);
      // Option B: deterministic whole-tile house grammar (no store wall-frame autotile).
      const placements = planInteriorHouseWalls({
        width: plan.width,
        height: plan.height,
        floor,
        rooms: plan.rooms,
        door: plan.door,
        innerDoors: plan.innerDoors ?? [],
      });
      // Ensure room floors exist under shell paint
      for (let y = 0; y < plan.height; y += 1) {
        for (let x = 0; x < plan.width; x += 1) {
          if (floor[y * plan.width + x]) setL(next, x, y, VR.FLOOR);
        }
      }
      paintInteriorHouseWalls(next, placements);
      // 천장 정본 v2: 천장(430 계열)을 저장 시점에 오토타일 성형 — 회암 테두리.
      shapeInteriorCeiling(next);
      return { map: next, layer, summary: "walls raised (house whole-tile grammar)", warnings, ok: true };
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
      retintHouseWallFace(next, plan.wallMaterial);
      // 통행 강제·소품 정리가 천장 인접 바닥을 바꿨을 수 있다 — 천장 재성형으로 마감.
      shapeInteriorCeiling(next);
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
 * 벽면 재질 리틴트 — 크림 면 2단(위 74–76 · 아래 104–106 · 1칸 77/107)을 재질 세트로 교체.
 * 완성 통타일 자리바꿈일 뿐이다: 캡/포스트/트림/문 프레임은 건드리지 않고 오토타일도 타지 않는다.
 */
export function retintHouseWallFace(map: GameMap, material: InteriorWallMaterial | undefined): void {
  const spec = material ? WALL_FACE_RETINT[material] : undefined;
  if (!spec) return;
  const CREAM_UPPER: readonly number[] = [HOUSE_WALL_FACE.UL, HOUSE_WALL_FACE.UM, HOUSE_WALL_FACE.UR];
  const CREAM_LOWER: readonly number[] = [HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R];
  const SOLO: readonly number[] = [HOUSE_WALL_FACE.SOLO_U, HOUSE_WALL_FACE.SOLO_L];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = getL(map, x, y);
      const soloIdx = SOLO.indexOf(tile);
      if (soloIdx >= 0) {
        setL(map, x, y, (soloIdx === 0 ? spec.upper : spec.lower)[1]!);
        continue;
      }
      const uIdx = CREAM_UPPER.indexOf(tile);
      if (uIdx >= 0) {
        setL(map, x, y, spec.upper[uIdx]!);
        continue;
      }
      const lIdx = CREAM_LOWER.indexOf(tile);
      if (lIdx >= 0) {
        setL(map, x, y, spec.lower[lIdx]!);
      }
    }
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

/** 벽 프레임 멤버(성형 결과) + 문 받침(257) + 1칸 크림 77/107 + 벽 재질 리틴트 면. */
export function houseShellWallMembers(): ReadonlySet<number> {
  return new Set<number>([
    ...HOUSE_SHELL_MEMBER_TILES,
    // wallMaterial 리틴트 이후 면
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
  theme: string,
  plan: InteriorRoomPlan,
  room?: RoomSpec,
): string[] {
  const modifiers = room?.modifiers ?? plan.themeModifiers ?? [];
  const luxury = plan.wallMaterial === "gold-brick" || modifiers.includes("luxury");
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
  if (isBuiltinInteriorTheme(theme)) {
    applyThemeModifiers(map, mask, modifiers, plan.door);
    placeSouthFiller(map, mask, theme, plan.door, mask.filter(Boolean).length);
  }
  ensureRequiredRoles(map, mask, theme, plan.door, room);
  for (const c of sentinels) {
    if (getU(map, c.x, c.y) === ENTRY_SENTINEL) setU(map, c.x, c.y, TILE.EMPTY);
  }
  return themeManifestWarnings(map, mask, theme, room?.id);
}

function paintFurniture(map: GameMap, floor: boolean[], plan: InteriorRoomPlan): string[] {
  const warnings: string[] = [];
  RNG = mulberry32((plan.seed ?? 1) * 0x9e3779b1 + 1);
  // 복도 카펫 먼저 — 복도 테마 방은 붉은 카펫 러너로 잇는다(2026-07-20 사용자 교정).
  paintCorridorCarpets(map, plan);
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
 * 복도 카펫 러너 — 복도 테마 방 바닥에 붉은 카펫(테두리 375-377 / 몸통 405-407 / 하단 435-437)을
 * 3열 폭으로 중앙 정렬해 깐다. 세로 복도(대저택 정본)·가로 복도 모두 방 전장을 잇는다.
 */
function paintCorridorCarpets(map: GameMap, plan: InteriorRoomPlan): void {
  for (const room of plan.rooms ?? []) {
    if ((room.theme ?? plan.theme) !== "corridor") continue;
    const stripW = Math.min(3, room.w);
    const x0 = room.x + Math.floor((room.w - stripW) / 2);
    for (let dy = 0; dy < room.h; dy += 1) {
      const rowSet = dy === 0 ? RUG_RED[0]! : dy === room.h - 1 ? RUG_RED[2]! : RUG_RED[1]!;
      for (let dx = 0; dx < stripW; dx += 1) {
        const col = stripW === 1 ? 1 : dx === 0 ? 0 : dx === stripW - 1 ? 2 : 1;
        const x = x0 + dx;
        const y = room.y + dy;
        if (!inBounds(x, y, map.width, map.height)) continue;
        if (map.lowerTiles[y * map.width + x] !== VR.FLOOR && !FLOOR_MATERIAL_TILES.has(map.lowerTiles[y * map.width + x]!)) continue;
        map.lowerTiles[y * map.width + x] = rowSet[col]!;
      }
    }
  }
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
  themeOverride?: string,
  seed?: number,
  modifierOverride?: readonly InteriorThemeModifier[],
  vocab?: InteriorRoomVocab,
): { plan: InteriorRoomPlan; warnings: string[] } {
  if (vocab) {
    return withInteriorVocab(vocab, () =>
      furnishInteriorSpace(map, plan, roomId, themeOverride, seed, modifierOverride),
    );
  }
  const rooms = plan.rooms ?? [];
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx < 0) throw new Error(`room 없음: ${roomId} (rooms=${rooms.map((r) => r.id).join(",")})`);
  const nextRooms = rooms.map((r, i) => i === idx
    ? {
        ...r,
        ...(themeOverride ? { theme: themeOverride } : {}),
        ...(modifierOverride ? { modifiers: [...modifierOverride] } : {}),
      }
    : r);
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
  VR.CABINET_U, // 단독 upper 캐비닛(사이드보드) — 구석 봉쇄 시 제거 허용
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
      // 도달 측 프런티어가 하드 세트로 막혀 있으면, 도달 불가 포켓에 붙은 소품을 녹여 포켓을 연다.
      for (let y = 0; y < map.height && !removedThisPass; y += 1) {
        for (let x = 0; x < w && !removedThisPass; x += 1) {
          if (!inMask(x, y) || !REMOVABLE_SINGLE_PROPS.has(getU(map, x, y)) || !isWalkFloor(map, x, y)) continue;
          const touchesDark = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
            .some(([dx, dy]) => {
              const nx = x + dx;
              const ny = y + dy;
              return isOpen(nx, ny) && !reach.has(ny * w + nx);
            });
          if (touchesDark) {
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
  vocab?: InteriorRoomVocab,
): InteriorRoomLookReport {
  if (vocab) {
    return withInteriorVocab(vocab, () => evaluateInteriorRoom(map, plan, attempt, maxAttempts));
  }
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
  if (floorCells >= 24 && qMax > 2 && qMin < qMax * 0.25) {
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
  theme: string,
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
  const kind = currentInteriorVocab().kindsById.get(theme);
  const grammar = isBuiltinInteriorTheme(theme) ? INTERIOR_ROOM_THEME_CATALOG[theme] : undefined;
  const requiredRoles = kind?.requiredRoles ?? grammar?.requiredRoles ?? [];
  const label = kind?.label ?? grammar?.label ?? theme;
  for (const role of requiredRoles) {
    if (role === "counter" && area < 30) continue;
    const tiles = tilesForRole(role);
    if (tiles.tileIds.length === 0) continue;
    if (!hasTile(tiles.tileIds, tiles.layer)) {
      out.push(`manifest: ${tiles.label} 없는 ${label} (${where})`);
    }
  }
  return out;
}

function tilesForRole(role: string): { label: string; tileIds: readonly number[]; layer: "lower" | "upper" | "both" } {
  const objects = [...currentInteriorVocab().objectsById.values()].filter((object) => object.role === role);
  if (objects.length > 0) {
    const tileIds = objects.flatMap((object) => object.cells.map((cell) => cell.tile));
    const layers = new Set(objects.flatMap((object) => object.cells.map((cell) => cell.layer)));
    const layer: "lower" | "upper" | "both" = layers.size > 1 ? "both" : layers.has("upper") ? "upper" : "lower";
    const semantic = role in INTERIOR_SEMANTIC_TILE_CATALOG
      ? INTERIOR_SEMANTIC_TILE_CATALOG[role as InteriorSemanticTileRole]
      : undefined;
    return { label: semantic?.label ?? objects[0]!.label, tileIds, layer };
  }
  const semantic = INTERIOR_SEMANTIC_TILE_CATALOG[role as InteriorSemanticTileRole];
  if (semantic) return { label: semantic.label, tileIds: semantic.tileIds, layer: semantic.layer };
  return { label: role, tileIds: [], layer: "upper" };
}

function applyThemeModifiers(
  map: GameMap,
  floor: boolean[],
  modifiers: readonly InteriorThemeModifier[],
  door: DoorSpec,
): void {
  if (modifiers.length === 0) return;
  const selected = new Set(modifiers);
  const wallFace = listWallFace(map, floor);
  const northFloor = listNorthFloor(floor, map);
  const corners = listCorners(floor, map, door);
  const open = listOpenFloor(floor, map, door);

  if (selected.has("sacred")) {
    placeWallMount(map, wallFace, [VR.RELIGIOUS]);
    placeTallPairU(map, northFloor, door, VR.BUST_T, VR.BUST_B);
  }
  if (selected.has("scholarly")) {
    placeBookshelfRow(map, northFloor, door, 1);
    placeOpen(map, open, [VR.CRYSTAL_BALL]);
  }
  if (selected.has("martial")) {
    placeWallMount(map, wallFace, [VR.SWORD_RACK]);
    placeTallPairU(map, northFloor, door, VR.ARMOR_T, VR.ARMOR_B);
  }
  if (selected.has("luxury")) {
    placePicturePair(map, wallFace);
    placeTallPairU(map, northFloor, door, VR.MIRROR_T, VR.MIRROR_B);
  }
  if (selected.has("rustic")) {
    placeCorner(map, corners, [VR.BARREL, VR.CRATE]);
  }
}

function isBuiltinInteriorTheme(theme: string): theme is InteriorRoomTheme {
  return (INTERIOR_ROOM_THEMES as readonly string[]).includes(theme);
}

function ensureRequiredRoles(
  map: GameMap,
  floor: boolean[],
  theme: string,
  door: DoorSpec,
  room?: RoomSpec,
): void {
  const kind = currentInteriorVocab().kindsById.get(theme);
  const required = kind?.requiredRoles ?? [];
  if (required.length === 0) return;
  for (const role of required) {
    const tiles = tilesForRole(role);
    if (tiles.tileIds.length === 0) continue;
    const hasRole = tiles.tileIds.some((tile) => {
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (!floor[y * map.width + x]) continue;
          if (tiles.layer !== "lower" && getU(map, x, y) === tile) return true;
          if (tiles.layer !== "upper" && getL(map, x, y) === tile) return true;
        }
      }
      return false;
    });
    if (hasRole) continue;
    const object = [...currentInteriorVocab().objectsById.values()].find((entry) => entry.role === role);
    if (!object) continue;
    placeCatalogObject(map, floor, door, object, room);
  }
}

function paintGenericThemeFurniture(
  map: GameMap,
  floor: boolean[],
  kind: InteriorRoomKindRecord,
  door: DoorSpec,
  room?: RoomSpec,
): void {
  const vocab = currentInteriorVocab();
  const themed = [...vocab.objectsById.values()].filter(
    (object) => object.themes.includes(kind.id) || (object.role !== null && kind.requiredRoles.includes(object.role)),
  );
  const required = kind.requiredRoles
    .map((role) => themed.find((object) => object.role === role)
      ?? [...vocab.objectsById.values()].find((object) => object.role === role))
    .filter((object): object is NonNullable<typeof object> => object !== undefined);
  for (const object of required) {
    placeCatalogObject(map, floor, door, object, room);
  }
  for (const object of themed) {
    if (object.role && kind.requiredRoles.includes(object.role)) continue;
    if (kind.walkway && (object.snap === "floor" || object.snap === "free")) continue;
    placeCatalogObject(map, floor, door, object, room);
  }
}

function placeCatalogObject(
  map: GameMap,
  floor: boolean[],
  door: DoorSpec,
  object: { cells: readonly InteriorObjectCell[]; snap: string; width: number; height: number },
  room?: RoomSpec,
): boolean {
  const inRoom = (cell: { x: number; y: number }): boolean => {
    if (!room) return true;
    return cell.x >= room.x && cell.x < room.x + room.w && cell.y >= room.y && cell.y < room.y + room.h;
  };
  const candidates =
    object.snap === "floor" || object.snap === "free"
      ? listOpenFloor(floor, map, door).filter(inRoom)
      : object.snap === "wall-any"
        ? listWallSnapFloor(floor, map, door).filter(inRoom)
        : listNorthFloor(floor, map).filter(inRoom);
  for (const origin of rotated(candidates)) {
    if (!canPaintObject(map, object.cells, origin.x, origin.y, door)) continue;
    paintObjectCells(map, object.cells, origin.x, origin.y);
    return true;
  }
  return false;
}

function canPaintObject(
  map: GameMap,
  cells: readonly InteriorObjectCell[],
  ox: number,
  oy: number,
  door: DoorSpec,
): boolean {
  for (const cell of cells) {
    const x = ox + cell.dx;
    const y = oy + cell.dy;
    if (!inBounds(x, y, map.width, map.height)) return false;
    if (x === door.x && y === door.y) return false;
    if (cell.layer === "upper" && !isUpperEmpty(map, x, y)) return false;
    if (cell.layer === "lower") {
      const existing = getL(map, x, y);
      if (houseShellWallMembers().has(existing) || existing === VR.VOID) return false;
    }
  }
  return true;
}

function paintThemeFurniture(
  map: GameMap,
  floor: boolean[],
  theme: string,
  door: DoorSpec,
  room?: RoomSpec,
  luxury = false,
): void {
  const inRoom = (c: { x: number; y: number }): boolean => {
    if (!room) return true;
    return c.x >= room.x && c.x < room.x + room.w && c.y >= room.y && c.y < room.y + room.h;
  };
  const wallFace = listWallFace(map, floor).filter(
    (c) => !room || (c.y === room.y - 2 && c.x >= room.x && c.x < room.x + room.w),
  );
  const northFloor = listNorthFloor(floor, map).filter(inRoom);
  const corners = listCorners(floor, map, door).filter(inRoom);
  const open = listOpenFloor(floor, map, door).filter(inRoom);
  const wallSnap = listWallSnapFloor(floor, map, door).filter(inRoom);
  const area = floor.filter(Boolean).length;
  // 장식 로테이션 — 방 위치 + 시드 RNG로 세트를 바꾼다(같은 테마 방 복붙 방지 + 재생성 다양성).
  const variant = (((room?.x ?? door.x) + (room?.y ?? door.y)) + Math.floor(RNG() * 3)) % 3;
  const plan = { theme, door } as const;
  // No indoor plants (user rule).

  if (!isBuiltinInteriorTheme(theme)) {
    const kind = currentInteriorVocab().kindsById.get(theme);
    if (kind) paintGenericThemeFurniture(map, floor, kind, door, room);
    return;
  }

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
    // 러그: 소형 침실(4×4=16)도 침대 발치 1칸 앵커로 허용 — 빈 나무바닥 방지.
    if (bed && area >= 16) placeRugUnder(map, bed.x, bed.y + 1, RUG_TEAL);
    placeTallPairU(map, northFloor, plan.door, VR.MIRROR_T, VR.MIRROR_B);
    // 벽 장식 이중화: 창 + 그림/시계 — 북벽이 텅 비는 소형 침실 방지.
    if (variant === 0) {
      placeWallMount(map, wallFace, [VR.WINDOW]);
      placePicturePair(map, wallFace);
    } else if (variant === 1) {
      placePicturePair(map, wallFace);
      placeWallMount(map, wallFace, [VR.WINDOW]);
    } else {
      placeTallPairU(map, northFloor, plan.door, VR.CLOCK_T, VR.CLOCK_B);
      placeWallMount(map, wallFace, [VR.WINDOW]);
    }
    // 2026-07-20 사용자 교정: "모든 방마다 탁자" 강제 해제 — 침실에는 탁자 세트를 놓지 않는다.
    // 침대·협탁·거울·러그·벽 장식이 침실의 본문이다.
    // 코너·벽 스냅 — 소형 객실은 병/통 스팸 금지 (1~2개).
    placeCorner(map, corners, bedside ? [VR.BOX] : [VR.BOX, VR.JARS]);
    placeAgainstWall(map, wallSnap, [VR.CABINET_U], 2);
    return;
  }
  if (plan.theme === "study") {
    // 서가 열: 방 폭에 비례해 책장 반복 배치 + 반드시 '읽을 자리'(책상+의자)를 만든다.
    // 소형 서재(area<40)는 서가 1단만 — 2단이면 중앙 1열만 남고 SE 구석이 봉쇄된다.
    const bboxW = floorBboxWidth(floor, map);
    const shelvesPerRow = area < 40 ? 1 : Math.max(1, Math.floor(bboxW / 4));
    placeBookshelfRow(map, northFloor, plan.door, shelvesPerRow);
    // 대형 서재(도서관)는 방을 가로지르는 프리스탠딩 서가 열을 한 줄 더 깐다.
    if (area >= 48 && northFloor.length > 0) {
      const rowY = Math.min(...northFloor.map((c) => c.y)) + 3;
      const midRow: Array<{ x: number; y: number }> = [];
      for (let x = 0; x < map.width; x += 1) {
        if (floor[rowY * map.width + x]) midRow.push({ x, y: rowY });
      }
      placeBookshelfRow(map, midRow, plan.door, Math.max(1, shelvesPerRow - 1));
    }
    placeTableChairSet(map, open, plan.door);
    // 수정구: 넓을 때만 — 좁은 서재는 책상·서가 밀도가 우선.
    if (variant === 0 && area >= 28) placeOpen(map, open, [VR.CRYSTAL_BALL]);
    placeTallPairU(map, northFloor, plan.door, VR.CLOCK_T, VR.CLOCK_B);
    if (variant === 0) placeWallMount(map, wallFace, [VR.WINDOW, VR.RELIGIOUS]);
    else {
      placePicturePair(map, wallFace);
      placeWallMount(map, wallFace, [VR.WINDOW]);
    }
    placeCorner(map, corners, [VR.BOX]);
    // 서재: 책장·책상이 본문 — 구석 잡동사니/캐비닛 과적 금지.
    return;
  }
  if (plan.theme === "kitchen") {
    // 화덕(21+51 세로쌍)을 북벽에 붙이고, 솥·주전자는 화덕 옆(바닥 산포 금지).
    // 2026-07-20 사용자 교정: 실내 바닥 모닥불(124) 대신 정본 아궁이(373 '벽난로 아궁이')를
    // 화덕 옆 벽면에 매립한다 — 어휘에 있었는데 파이프라인이 안 쓰던 타일.
    const stove = placeStovePair(map, northFloor, plan.door);
    if (stove) {
      const cx = stove.x + 1;
      if (isWalkFloor(map, cx, stove.y) && isUpperEmpty(map, cx, stove.y)) setU(map, cx, stove.y, VR.CAULDRON);
      if (isWalkFloor(map, cx + 1, stove.y) && isUpperEmpty(map, cx + 1, stove.y)) setU(map, cx + 1, stove.y, VR.KETTLE);
      const hearthX = stove.x - 1;
      const hearthY = stove.y - 1; // 화덕 상단(21)과 같은 벽면 행
      if (isUpperEmpty(map, hearthX, hearthY) && houseShellWallMembers().has(getL(map, hearthX, hearthY))) {
        setU(map, hearthX, hearthY, VR.HEARTH);
      }
    }
    // 작업대(사각 탁자+의자 1) — 주방 중앙이 텅 비는 문제 해소. 화덕 존 1칸 여유.
    const awayFromStove = open.filter(
      (c) => !stove || Math.max(Math.abs(c.x - stove.x), Math.abs(c.y - stove.y)) > 1,
    );
    placeTableChairSet(map, awayFromStove, plan.door);
    placeWallMount(map, wallFace, [VR.WINDOW, VR.FRUIT_SHELF]);
    placeCorner(map, corners, [VR.BUCKET, VR.JARS]);
    // 주방: 화덕·작업대가 본체 — 벽 스냅 통/병 과적 금지.
    const kitchenLoads = Math.max(1, Math.min(2, Math.floor(area / 20)));
    placeAgainstWall(
      map,
      wallSnap,
      repeatTiles([VR.BARREL, VR.CRATE], kitchenLoads),
      2,
    );
    return;
  }
  if (plan.theme === "storage") {
    // 창고: 적재물은 벽 스냅이 기본(중앙 부유 금지) — 물량 상향(3차 리뷰: "가장 채우기 쉬운데 가장 비었다").
    placeWallMount(map, wallFace, [VR.LADDER, VR.WINDOW]);
    placeCorner(map, corners, [VR.CRATE, VR.BARREL, VR.BOX]);
    // 창고도 가득 채우지 않음 — 벽 따라 여백 유지.
    const loads = Math.max(2, Math.min(4, Math.floor(area / 12)));
    placeAgainstWall(map, wallSnap, repeatTiles([VR.BARREL, VR.CRATE, VR.BOX], loads), 2);
    return;
  }
  if (plan.theme === "tavern") {
    // 선술집/홀: 카운터(경로 키트 v1)가 기본 — "카운터 없는 상점" 지적 해소.
    // 피아노·진열대·검 장식은 variant 로테이션으로 분해(동일 홀 클러스터 8회 복붙 지적).
    placeCounterRun(map, northFloor, plan.door);
    const tables = Math.max(1, Math.floor(area / 36));
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
    placeCorner(map, corners, [VR.BARREL, VR.CRATE]);
    placeAgainstWall(map, wallSnap, repeatTiles([VR.BARREL, VR.CRATE], Math.max(1, Math.min(2, Math.floor(area / 28)))), 2);
    return;
  }
  // dining — 장탁자(3칸) 면적 비례, 러그는 상석 탁자 발밑에만, 잔해류(깨진 유리/바닥 구멍)는 금지.
  // 연회장(luxury): 탁자 수 상향(/28) + 상석과 같은 열에 줄 맞춰 배치 — 흩뿌린 탁자는 연회가 아니다.
  // 일반 거실/식당: 면적 30마다 탁자 1 — 7×5 거실이 탁자 1+빈바닥으로 끝내지 않게.
  const tables = Math.max(1, Math.floor(area / (luxury ? 28 : 30)));
  let headTable: { x: number; y: number } | null = null;
  for (let i = 0; i < tables; i += 1) {
    const t = placeLongTable3(map, open, plan.door, luxury ? headTable?.x : undefined);
    if (t && !headTable) headTable = t;
  }
  // 필수 가구 보장: 식탁 없는 식당 금지 — 긴 탁자가 안 들어가면 사각 탁자 세트로 대체.
  if (!headTable) headTable = placeTableChairSet(map, open, plan.door);
  // 소형 거실(7×5≈35)에도 러그 — 나무바닥 허전함 방지. 붉은 카펫은 귀족 전용.
  if (headTable && area >= 20) placeRugUnder(map, headTable.x, headTable.y, luxury ? RUG_RED : RUG_MAT);
  // 거실/홀: 진열대 대신 괘종시계(레퍼런스 코티지) 또는 진열 — 서민 홀은 시계 우선.
  if (luxury) placeTallPairU(map, northFloor, plan.door, VR.DISPLAY_T, VR.DISPLAY_B);
  else placeTallPairU(map, northFloor, plan.door, VR.CLOCK_T, VR.CLOCK_B);
  // 벽 이중 장식 + 사이드보드(캐비닛) + 코너 적재(통·상자 — 레퍼런스 남서 코너).
  if (variant === 0) {
    placeWallMount(map, wallFace, [VR.WINDOW]);
    placePicturePair(map, wallFace);
  } else {
    placePicturePair(map, wallFace);
    placeWallMount(map, wallFace, [VR.WINDOW]);
  }
  placeCorner(map, corners, [VR.BARREL, VR.BOX, VR.JARS]);
  placeAgainstWall(map, wallSnap, [VR.CABINET_U], 2);
  // 2번째 좌석군 — 넓을 때만 (병/통으로 바닥 채우지 않음).
  if (area >= 40 && countSeatingGroups(map, floor) < 2) {
    placeTableChairSet(map, open, plan.door);
  }
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

/**
 * 카탈로그 정의(형태 정본: interiorObjectCatalog)의 셀 id를 가져온다.
 * 정의가 없으면 즉시 실패 — 어휘 오타가 조용히 반쪽 가구로 새어나가지 않게.
 */
function objectCells(id: string): readonly InteriorObjectCell[] {
  const fromVocab = currentInteriorVocab().objectsById.get(id);
  if (fromVocab) return fromVocab.cells;
  const def = interiorObjectById(id);
  if (!def) throw new Error(`실내 오브젝트 정의 없음: ${id}`);
  return def.cells;
}

/** 카탈로그 셀 목록을 (ox,oy) 원점에 찍는다 — 칸별 레이어는 셀이 정본. */
function paintObjectCells(
  map: GameMap,
  cells: readonly InteriorObjectCell[],
  ox: number,
  oy: number,
): void {
  for (const cell of cells) {
    if (cell.layer === "upper") setU(map, ox + cell.dx, oy + cell.dy, cell.tile);
    else setL(map, ox + cell.dx, oy + cell.dy, cell.tile);
  }
}

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
    paintObjectCells(map, objectCells("bed_v"), c.x, c.y);
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
    // 좌 캡 · 반복 몸통 · 우 캡 — 타일 id는 카탈로그 counter 정의(3칸 런)에서 가져온다.
    const counter = objectCells("counter");
    const place = (start: number, L: number): void => {
      for (let i = 0; i < L; i += 1) {
        const cell = i === 0 ? counter[0]! : i === L - 1 ? counter[counter.length - 1]! : counter[1]!;
        setU(map, start + i, y, cell.tile);
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
 * 남쪽 공백 필러 — 소형 방(6×4≈24)부터 남반부에 테마 클러스터를 하나 더 놓는다.
 * (구 임계 48은 가정집 4방 같은 소형 방에서 사실상 무력 → 남쪽 전면 공백.)
 */
function placeSouthFiller(
  map: GameMap,
  floor: boolean[],
  theme: string,
  door: DoorSpec,
  area: number,
): void {
  // 복도는 여백이 정답(2026-07-20 사용자 교정) — 남측 필러(탁자·의자·상자)를 절대 놓지 않는다.
  // (이 가드가 없어서 대저택 홀에 탁자 세트가 들어가던 버그.)
  if (theme === "corridor") return;
  if (area < 20) return;
  const ys: number[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) if (floor[y * map.width + x]) ys.push(y);
  }
  if (ys.length === 0) return;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const south = listOpenFloor(floor, map, door).filter((c) => c.y > midY);
  if (south.length === 0) return;
  // 좌석군 상한: 이미 좌석군이 2개 이상이면 적재물로 대체(좌석 스팸 방지).
  // 침실도 적재물 — "모든 방마다 탁자" 강제 해제(2026-07-20 사용자 교정).
  if (theme === "storage" || theme === "kitchen" || theme === "bedroom" || countSeatingGroups(map, floor) >= 2) {
    const southSnap = listWallSnapFloor(floor, map, door).filter((c) => c.y > midY);
    const goods =
      theme === "kitchen"
        ? [VR.BARREL, VR.CRATE, VR.JARS, VR.BUCKET]
        : theme === "storage"
          ? [VR.BARREL, VR.CRATE, VR.GRAIN, VR.BOX]
          : theme === "bedroom"
            ? [VR.CABINET_U, VR.BOX]
            : [VR.BARREL, VR.CRATE, VR.GRAIN, VR.JARS];
    placeAgainstWall(map, southSnap, goods, 1);
    return;
  }
  placeTableChairSet(map, south, door);
  // 좌석 실패·잔여 공백: 벽 스냅 적재로 한 번 더 채운다.
  const southSnap = listWallSnapFloor(floor, map, door).filter((c) => c.y > midY);
  placeAgainstWall(map, southSnap, [VR.BOX], 2);
}

// 사분면 필러 소품 — 좌석 금지(스팸 상한과 충돌), 벽 스냅 단일 소품만.
// VR.PLANT(289)는 월드맵 겸용 수풀 작화라 실내 금지(기존 테스트 계약).
const QUADRANT_FILLER_GOODS: Record<InteriorRoomTheme, readonly number[]> = {
  bedroom: [VR.BOX],
  study: [VR.BOX],
  dining: [VR.BOX],
  kitchen: [VR.BUCKET],
  storage: [VR.CRATE, VR.BARREL],
  tavern: [VR.BARREL],
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
  // 소형 맵은 여백 허용 — 필러가 병/통 스팸이 되지 않게 임계를 올린다.
  if (floorCells < 48) return;
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
  const goods = isBuiltinInteriorTheme(plan.theme) ? QUADRANT_FILLER_GOODS[plan.theme] : undefined;
  if (!goods || goods.length === 0) return;
  const snap = listWallSnapFloor(floor, map, plan.door).filter((c) => !corridor.has(c.y * w + c.x));
  const judged = [0, 1, 2, 3].filter((q) => eligible[q]! >= 12);
  if (judged.length === 0) return;
  for (let guard = 0; guard < 4; guard += 1) {
    const q = occupancy();
    const qMax = Math.max(...judged.map((j) => q[j]!));
    const qMin = Math.min(...judged.map((j) => q[j]!));
    // 공백이 꽤 클 때만 1~2개 보정 (0.25 → 0.15).
    if (!(qMax > 3 && qMin < qMax * 0.15)) return;
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
    paintObjectCells(map, objectCells("table_long"), c.x, c.y);
    setU(map, c.x - 1, c.y, VR.CHAIR_RIGHT);
    setU(map, c.x + 3, c.y, VR.CHAIR_LEFT);
    // 스툴 자동 배치 제거 — 바닥 잡동사니 과다 방지.
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
      paintObjectCells(map, objectCells("piano"), c.x, y);
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
  // 카탈로그 책장은 3×3(가운데 열 19/49/79는 가로 반복 몸통) — 서가 열은 좌·우 캡 열만 쓴 2×3 변형.
  const shelfCells = objectCells("bookshelf")
    .filter((cell) => cell.dx !== 1)
    .map((cell) => ({ ...cell, dx: cell.dx === 0 ? 0 : 1 }));
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
    paintObjectCells(map, shelfCells, c.x, c.y);
    placed += 1;
    minNextX = c.x + 3; // 책장 2칸 + 통로 1칸
  }
}

/**
 * Stove as atomic vertical pair 21(top)/51(bottom):
 * RM tall-furniture depth grammar — 하단(51)은 북측 바닥 행 lower(통행 차단),
 * 상단(21)은 바로 위 크림 벽면 행 upper(벽에 겹쳐 세움). 시계/피아노와 같은 깊이 문법.
 */
/**
 * 벽에 등을 대는 방향 → 발밑에서 그 방향으로 한 칸 오프셋.
 * `checkPlacementSurface` 의 방향 검사와 같은 규약이다(기준선에서 한 칸).
 */
const FACING_STEP: Readonly<Record<PlacementFacing, { readonly dx: number; readonly dy: number }>> = {
  any: { dx: 0, dy: -1 },
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

function placeStovePair(
  map: GameMap,
  northFloor: Array<{ x: number; y: number }>,
  door: DoorSpec,
): { x: number; y: number } | null {
  const wall = houseShellWallMembers();
  // 방향은 규칙에서 읽는다 — 손으로 쓴 `c.y - 1` 을 남겨 두면 규칙을 고쳐도 파이프라인이 안 따라온다.
  // 후보 목록(northFloor)은 여전히 북쪽 편향 프리필터이므로, 방향을 바꾸면 후보도 같이 바꿔야 한다.
  const step = FACING_STEP[
    (asPlacementFacing(interiorStoveSurfaceRule().params.facing) ?? "north")
  ];
  for (const c of rotated(northFloor)) {
    if (c.x === door.x) continue;
    if (!isWalkFloor(map, c.x, c.y)) continue;
    if (!wall.has(getL(map, c.x + step.dx, c.y + step.dy))) continue; // 등을 댈 벽면이 있어야 함
    if (!isUpperEmpty(map, c.x, c.y) || !isUpperEmpty(map, c.x, c.y - 1)) continue;
    // hard pair — never place half stove (21 must be immediately above 51)
    paintObjectCells(map, objectCells("stove"), c.x, c.y - 1);
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
    paintObjectCells(map, objectCells("bed_h"), c.x, c.y);
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
    if (PROP_SURFACE[tile] !== "corner") continue;
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
  // 가구·소품 조사 이벤트 — 책장/상자/통/캐비닛 등 (병 스팸 셀은 제외).
  attachPropInspectEvents(map);
}

/** 맵에 놓인 가구 타일을 훑어 action 조사 이벤트를 붙인다. 방마다 수동 이벤트를 안 달아도 된다. */

function attachPropInspectEvents(map: GameMap): void {
  const lines: Record<number, string> = {
    [VR.BOOK_TL]: "책장이다. 낡은 책들이 빼곡하다.",
    [VR.BOOK_TR]: "책장이다. 먼지 쌓인 표지들.",
    [VR.BOOK_ML]: "책장 중간 칸. 메모가 끼어 있다.",
    [VR.BOOK_MR]: "책장 중간 칸. 제목을 알아볼 수 없다.",
    [VR.BOOK_BL]: "책장 아래 칸. 묵직한 사전이 있다.",
    [VR.BOOK_BR]: "책장 아래 칸. 빈 노트가 꽂혀 있다.",
    [VR.BOX]: "나무 상자를 열어본다. 잡화가 들어 있다.",
    [VR.CRATE]: "나무 상자. 못이 삐져나와 있다.",
    [VR.BARREL]: "술통을 두드려 본다. 텅 빈 울림.",
    [VR.CABINET_U]: "수납장. 옷가지와 수건이 개어져 있다.",
    [VR.CABINET_L]: "수납장 아래 서랍. 열쇠 꾸러미가 굴러다닌다.",
    [VR.GRAIN]: "곡물 자루. 거친 삼베 냄새.",
    [VR.DISPLAY_B]: "진열장. 약병과 작은 검이 놓여 있다.",
    [VR.DISPLAY_T]: "진열장 위. 먼지가 살짝 앉았다.",
  };
  // 조사 대상: lower 책장/캐비닛 하단 + upper 상자·통·진열
  const lowerTargets = new Set<number>([
    VR.BOOK_TL, VR.BOOK_TR, VR.BOOK_ML, VR.BOOK_MR, VR.BOOK_BL, VR.BOOK_BR, VR.CABINET_L,
  ]);
  const upperTargets = new Set<number>([VR.BOX, VR.CRATE, VR.BARREL, VR.CABINET_U, VR.GRAIN, VR.DISPLAY_B, VR.DISPLAY_T]);
  const occupied = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
  const out: GameEvent[] = [];
  let n = 0;
  const tryAdd = (x: number, y: number, tile: number, name: string) => {
    const key = `${x},${y}`;
    if (occupied.has(key)) return;
    const body = lines[tile];
    if (!body) return;
    occupied.add(key);
    n += 1;
    out.push({
      id: `ev_inspect_${map.id}_${n}`,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `ev_inspect_${map.id}_${n}_p`,
          name,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "below",
          overlapForbidden: false,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body }],
        },
      ],
    });
  };
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const L = getL(map, x, y);
      const U = getU(map, x, y);
      if (lowerTargets.has(L)) {
        const name = L === VR.CABINET_L ? "수납장" : "책장";
        // 책장은 BL/BR만
        if (L === VR.BOOK_BL || L === VR.BOOK_BR || L === VR.CABINET_L) tryAdd(x, y, L, name);
      }
      if (upperTargets.has(U)) {
        const name =
          U === VR.BOX || U === VR.CRATE ? "상자" :
          U === VR.BARREL ? "통" :
          U === VR.CABINET_U ? "수납장" :
          U === VR.GRAIN ? "자루" : "진열장";
        tryAdd(x, y, U, name);
      }
    }
  }
  if (out.length) map.events = [...(map.events ?? []), ...out];
  // (2026-07-20) (1,1) 고정 데모 상자(ensurePinnedChipsetBox)는 사용자 지적으로 제거 —
  // 천장 링 위에 바닥+상자를 강제로 박아 넣던 데모 잔재였다. 되살리지 말 것.
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

  // entrance event: door cell must hold a page named 입구 (GameEvent has no name)
  const entrance = (map.events ?? []).find(
    (e) => e.x === plan.door.x && e.y === plan.door.y && e.pages?.[0]?.name === "입구",
  );
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

    // P0/P1: door-based walkability on painted map (post-furniture)
  {
    const walk = (x: number, y: number) => inBounds(x, y, map.width, map.height) && isWalkFloor(map, x, y);
    const key = (x: number, y: number) => `${x},${y}`;
    const seen = new Set<string>();
    const q: Array<{ x: number; y: number }> = [];
    if (walk(plan.door.x, plan.door.y)) {
      q.push({ x: plan.door.x, y: plan.door.y });
      seen.add(key(plan.door.x, plan.door.y));
    }
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        const k = key(nx, ny);
        if (seen.has(k) || !walk(nx, ny)) continue;
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    for (const room of plan.rooms ?? []) {
      let reachable = false;
      for (let dy = 0; dy < room.h && !reachable; dy += 1) {
        for (let dx = 0; dx < room.w && !reachable; dx += 1) {
          const x = room.x + dx;
          const y = room.y + dy;
          if (seen.has(key(x, y))) reachable = true;
        }
      }
      if (!reachable) issues.push(`reachability: room '${room.id}' not walk-reachable from door after furniture`);
    }
  }

return issues;
}

// ── Spatial helpers ─────────────────────────────────────────────────────────

function listWallFace(map: GameMap, floor: boolean[]): Array<{ x: number; y: number }> {
  const members = houseShellWallMembers();
  // 벽걸이는 크림 벽면 **윗줄**에 건다 — 아랫줄에 걸면 벽 하단부에 붙어 낮아 보인다.
  // 윗줄=74/75/76(리틴트 upper), 아랫줄=104/105/106(리틴트 lower).
  // "아래 셀도 벽면인 벽면 셀"이 윗줄이다. (키 큰 가구 상단은 여전히 아랫줄에 겹침.)
  // wallMaterial 리틴트 이후의 재시공(furnishInteriorSpace)에서도 벽면을 찾도록 리틴트 면 포함.
  const faceTiles = new Set<number>([
    HOUSE_WALL_FACE.UL,
    HOUSE_WALL_FACE.UM,
    HOUSE_WALL_FACE.UR,
    HOUSE_WALL_FACE.L,
    HOUSE_WALL_FACE.M,
    HOUSE_WALL_FACE.R,
    HOUSE_WALL_FACE.SOLO_U,
    HOUSE_WALL_FACE.SOLO_L,
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
