/** Project-owned supplemental interior vocabulary. No editor/runtime seeding dependencies. */
import { DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import type { ClusterRule, TileGroupMetadata } from "@/project/types";

export const INTERIOR_ROOM_HARNESS_PREFIX = "harness-interior-house-v1-";
const CEILING_MEMBER_TILES = [369, 371, 399, 400, 401, 429, 430, 431, 459, 460, 461];

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

/** Shared project vocabulary; the editor catalog no longer imports the room pipeline. */
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
    COUNTER_L: 325, // 접수용 긴 탁자. 오분류된 408~410은 자동 배치하지 않는다.
    COUNTER_M: 326,
    COUNTER_R: 327,
  } as const;
}

export const VR = interiorVocabTiles();

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
    group("counter-top-props", "카운터 위 소품", "prop", "upper", [237, 235, 238], "술병/항아리/식기 — 카운터·탁자(lower 불투명) 위에만 배치", {
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
    group("kitchen-props", "주방 소품", "prop", "upper", [VR.CAULDRON, VR.KETTLE, VR.FRUIT_SHELF, VR.SHELF_JARS], "가마솥/항아리는 openFloor, 선반은 wallFace", {
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
