import type { TileAiMetadata, TileGroupMetadata } from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import { CHIPSET_TILE_GROUPS, DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";

export type CombinedTownHarnessGroup = Omit<TileGroupMetadata, "tileIds"> & {
  readonly passage: TileAiMetadata["passage"];
  readonly repeatability: TileAiMetadata["repeatability"];
  readonly stackable?: boolean;
  readonly tileIds: readonly number[];
};

export const COMBINED_TOWN_HARNESS_PREFIX = "harness-combined-town-";
export const COMBINED_TOWN_ROOF_OVERLAY_TILES = [374, 375, 376, 377, 384, 385, 386, 387] as const;

const CONIFER_TOP = 260;
const CONIFER_BOTTOM = 290;
const DRY_TREE_TOP = 261;
const DRY_TREE_BOTTOM = 291;
const BROADLEAF_TOP_LEFT = 262;
const BROADLEAF_TOP_RIGHT = 263;
const BROADLEAF_BOTTOM_LEFT = 292;
const BROADLEAF_BOTTOM_RIGHT = 293;
const BRANCH_TILE = 259;
const BUSH_TILE = 289;
const FLOWER_OBJECT_TILE_SET = new Set<number>(CHIPSET_TILE_GROUPS.flowerObjects);

export const COMBINED_TOWN_HARNESS_GROUPS: readonly CombinedTownHarnessGroup[] = [
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}dirt-road-autotile`,
    name: "흙길 오토타일",
    role: "terrain",
    defaultLayer: "lower",
    tileIds: [
      DIRT_ROAD_TILE.CORNER_NORTH_WEST,
      DIRT_ROAD_TILE.EDGE_NORTH,
      DIRT_ROAD_TILE.CORNER_NORTH_EAST,
      DIRT_ROAD_TILE.EDGE_WEST,
      DIRT_ROAD_TILE.BODY,
      DIRT_ROAD_TILE.EDGE_EAST,
      DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
      DIRT_ROAD_TILE.EDGE_SOUTH,
      DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
      DIRT_ROAD_TILE.BODY_ALT,
    ],
    description: "대표 흙길을 칠하면 주변 길과 연결되어 변, 모서리, 중앙 타일로 자동 정리됩니다.",
    placementRules: "하위 레이어에서 한 칸 브러시로 칠하고, 연결 상태에 따라 외곽과 중앙을 자동 선택합니다.",
    confidence: "high",
    source: "bundled-default",
    passage: "passable",
    repeatability: "auto",
    patternGrammar: {
      axis: "both",
      kind: "autotile_3x3",
      minHeight: 1,
      minWidth: 1,
      parts: [
        { role: "topLeft", tileIds: [DIRT_ROAD_TILE.CORNER_NORTH_WEST] },
        { role: "top", tileIds: [DIRT_ROAD_TILE.EDGE_NORTH] },
        { role: "topRight", tileIds: [DIRT_ROAD_TILE.CORNER_NORTH_EAST] },
        { role: "left", tileIds: [DIRT_ROAD_TILE.EDGE_WEST] },
        { role: "center", tileIds: [DIRT_ROAD_TILE.BODY, DIRT_ROAD_TILE.BODY_ALT] },
        { role: "right", tileIds: [DIRT_ROAD_TILE.EDGE_EAST] },
        { role: "bottomLeft", tileIds: [DIRT_ROAD_TILE.CORNER_SOUTH_WEST] },
        { role: "bottom", tileIds: [DIRT_ROAD_TILE.EDGE_SOUTH] },
        { role: "bottomRight", tileIds: [DIRT_ROAD_TILE.CORNER_SOUTH_EAST] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
  },
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}grass-autotile`,
    name: "잔디",
    role: "terrain",
    defaultLayer: "lower",
    tileIds: [TILE.GRASS, 270, 271, 272, 273, 300, 301, 302, 330, 331, 332, 333],
    description: "기본 잔디 지형입니다. 영역을 잔디로 채우거나 원상 복구할 때 사용합니다.",
    placementRules: "하위 레이어 면 채우기 전용. 균질 지형이라 이웃 연결 성형이 필요 없습니다.",
    confidence: "high",
    source: "bundled-default",
    passage: "passable",
    repeatability: "auto",
    patternGrammar: {
      axis: "both",
      kind: "autotile_3x3",
      minHeight: 1,
      minWidth: 1,
      parts: [
        { role: "topLeft", tileIds: [TILE.GRASS] },
        { role: "top", tileIds: [TILE.GRASS] },
        { role: "topRight", tileIds: [TILE.GRASS] },
        { role: "left", tileIds: [TILE.GRASS] },
        { role: "center", tileIds: [TILE.GRASS, 270, 271, 272, 273] },
        { role: "right", tileIds: [TILE.GRASS] },
        { role: "bottomLeft", tileIds: [TILE.GRASS] },
        { role: "bottom", tileIds: [TILE.GRASS] },
        { role: "bottomRight", tileIds: [TILE.GRASS] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
  },
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}sand-autotile`,
    name: "모래",
    role: "terrain",
    defaultLayer: "lower",
    layerHome: "lower",
    tileIds: [...CHIPSET_TILE_GROUPS.sandGround],
    description: "대표 모래를 칠하면 주변 모래/물과 연결되어 변, 모서리, 중앙, 오목 타일로 자동 정리됩니다.",
    placementRules: "하위 레이어에서 한 칸 브러시로 칠하고, 연결 상태에 따라 외곽과 중앙을 자동 선택합니다.",
    confidence: "high",
    source: "bundled-default",
    passage: "passable",
    repeatability: "auto",
    patternGrammar: {
      axis: "both",
      kind: "autotile_3x3",
      minHeight: 1,
      minWidth: 1,
      parts: [
        { role: "topLeft", tileIds: [SAND_TILE.CORNER_NORTH_WEST] },
        { role: "top", tileIds: [SAND_TILE.EDGE_NORTH] },
        { role: "topRight", tileIds: [SAND_TILE.CORNER_NORTH_EAST] },
        { role: "left", tileIds: [SAND_TILE.EDGE_WEST] },
        { role: "center", tileIds: [SAND_TILE.BODY, 364, SAND_TILE.ISOLATED, SAND_TILE.INNER_CORNER] },
        { role: "right", tileIds: [SAND_TILE.EDGE_EAST] },
        { role: "bottomLeft", tileIds: [SAND_TILE.CORNER_SOUTH_WEST] },
        { role: "bottom", tileIds: [SAND_TILE.EDGE_SOUTH] },
        { role: "bottomRight", tileIds: [SAND_TILE.CORNER_SOUTH_EAST] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
  },
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}lake-water-autotile`,
    name: "애니메이션 물 오토타일",
    role: "water",
    defaultLayer: "lower",
    tileIds: [...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames, ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames],
    description: "호수와 연못 수면입니다. 물 덩어리의 주변 연결을 보고 가장자리와 중앙 프레임을 렌더링합니다.",
    placementRules: "하위 레이어에서 물 대표 타일을 자유롭게 칠하면 주변 물과 이어져 보이도록 렌더링합니다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "auto",
    patternGrammar: {
      axis: "both",
      kind: "animated_terrain",
      minHeight: 1,
      minWidth: 1,
      parts: [
        { role: "center", tileIds: [...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames] },
        { role: "top", tileIds: [LAKE_AUTOTILE_TILE.EDGE_NORTH] },
        { role: "left", tileIds: [LAKE_AUTOTILE_TILE.EDGE_WEST] },
        { role: "bottom", tileIds: [LAKE_AUTOTILE_TILE.EDGE_SOUTH] },
        { role: "topLeft", tileIds: [LAKE_AUTOTILE_TILE.OUTER_CORNER] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
  },
  wall9Slice("plaster-wall-9slice", "흰 집 벽 확장", CHIPSET_TILE_GROUPS.houseWhiteWallObjects, "흰 회벽 집의 정면 벽입니다. 좌/중/우 열과 상/중/하 행을 유지해 확장합니다."),
  wall9Slice("wood-wall-9slice", "통나무 집 벽 확장", CHIPSET_TILE_GROUPS.houseWoodWallObjects, "통나무 집 정면 벽입니다. 상/중/하 행과 좌/중/우 열을 보존합니다."),
  // 연습08 기준 집(밝은 오렌지 지붕 페어)의 벽 세트(12/42/72 계열). 벽 어휘에 없어서
  // place_door/place_window가 이 벽 위 배치를 거부하던 공백을 메운다.
  wall9Slice("timber-stone-wall-9slice", "목골 석벽 집 벽 확장", CHIPSET_TILE_GROUPS.housePurpleStoneWallObjects, "목골+석재 집의 정면 벽입니다. 좌/중/우 열과 상/중/하 행을 유지해 확장합니다."),
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}roof-overlays`,
    name: "사선 지붕 오버레이",
    role: "roof",
    defaultLayer: "upper",
    tileIds: COMBINED_TOWN_ROOF_OVERLAY_TILES,
    description: "벽 위에 얹어 사선 지붕 실루엣을 만드는 상위 오버레이입니다.",
    placementRules: "상위 레이어에만 놓습니다. 아래 벽이나 지붕면을 지우지 않고 겹쳐서 통행을 막는 지붕 외곽을 만듭니다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "fixed",
    stackable: true,
    patternGrammar: overlayGrammar(COMBINED_TOWN_ROOF_OVERLAY_TILES),
  },
  lowerStackGroup("fence", "울타리", CHIPSET_TILE_GROUPS.fenceObjects, "울타리는 투명 소품이라 상위 레이어에 겹쳐 지면을 보존합니다. 길과 문 동선을 가리지 않게 끊어 배치합니다."),
  lowerStackGroup("windows", "창문", CHIPSET_TILE_GROUPS.houseWindowObjects, "창문은 벽 위에 겹치는 투명 소품입니다. 상위 레이어에 놓아 아래 벽을 보존합니다."),
  lowerStackGroup("castle-windows", "성 창문", CHIPSET_TILE_GROUPS.castleWindowObjects, "성 창문: 28 열린창, 58 성 창, 88 깨진 창조각. 벽 위에 겹칩니다."),
  // map_castle_keep(성채) 실측 금본 — 성 맵 조립 모듈 3종.
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}castle-roof-deck`,
    name: "성 지붕/여장 면",
    role: "castle",
    defaultLayer: "lower",
    tileIds: [...CHIPSET_TILE_GROUPS.castleRoofDeckObjects],
    description:
      "성 지붕·여장 보루 면(3×4 블록). 모서리 18/20/108/110, 상·하변 19/109, 좌변 48|78, 채움 49|79|50|80. 외곽 성벽 위·본채 지붕·남쪽 커튼 위 테라스로 쓴다.",
    placementRules:
      "하위 solid. 직사각 면으로 깐다(최소 2×2, 권장 ≥3×3). 마당(잔디 통행 구역)에는 절대 깔지 않는다. 면 남쪽 가장자리 아래에 castle-wall-face(21/51/81)를 붙인다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "repeat",
    patternGrammar: {
      axis: "both",
      kind: "nine_slice_expandable",
      minHeight: 2,
      minWidth: 2,
      parts: [
        { role: "topLeft", tileIds: [18] },
        { role: "top", tileIds: [19] },
        { role: "topRight", tileIds: [20] },
        { role: "left", tileIds: [48, 78] },
        { role: "center", tileIds: [49, 79, 50, 80] },
        { role: "right", tileIds: [50, 80] },
        { role: "bottomLeft", tileIds: [108] },
        { role: "bottom", tileIds: [109] },
        { role: "bottomRight", tileIds: [110] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
  },
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}castle-wall-face`,
    name: "성벽 정면",
    role: "castle",
    defaultLayer: "lower",
    tileIds: [...CHIPSET_TILE_GROUPS.castleWallFaceObjects],
    description:
      "성벽 정면 세로 띠: 상 21 + 중 51(무제한) + 하 81. 커튼월·본채 정면·모서리 보강에 사용. 남쪽 성문은 가로로 끊고 모래길을 통과시킨다.",
    placementRules:
      "하위 solid. 열 단위로 세로 배치 후 가로 반복. 최소 높이 2(21+81 또는 51+81), 권장 3(21/51/81). 지붕 면 남쪽 변 바로 아래 또는 독립 커튼월. 성문 폭 2~4칸은 비운다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "repeat",
    patternGrammar: {
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [
        { role: "top", tileIds: [21] },
        { role: "repeatBody", tileIds: [51] },
        { role: "bottom", tileIds: [81] },
      ],
      preserveCaps: true,
      repeat: "body",
    },
  },
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}castle-round-tower`,
    name: "원형 타워",
    role: "castle",
    defaultLayer: "mixed",
    tileIds: [...CHIPSET_TILE_GROUPS.castleRoundTowerObjects],
    description:
      "원형 타워(2칸 폭): 캡 upper 24|25 → 목 lower 138|139 → 몸 140|141(세로 연장) / 창문 142|143 → 베이스 upper 54|55. 창문 행은 몸통 중간에 끼운다. 마당 안 랜드마크.",
    placementRules:
      "가로 2칸 페어 유지. 캡(24|25)·베이스(54|55) 상위(투명), 몸·목·창문(138–143) 하위 solid. 몸 140|141 세로 연장, 창문 142|143은 몸 중간 1행. 커튼월과 겹치지 않게 마당 쪽에 둔다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "repeat",
    patternGrammar: {
      axis: "both",
      kind: "vertical_expandable",
      minHeight: 4,
      minWidth: 2,
      parts: [
        { role: "topLeft", tileIds: [24] },
        { role: "topRight", tileIds: [25] },
        { role: "top", tileIds: [138, 139] },
        { role: "repeatBody", tileIds: [140, 141] },
        { role: "center", tileIds: [142, 143] },
        { role: "bottomLeft", tileIds: [54] },
        { role: "bottomRight", tileIds: [55] },
      ],
      preserveCaps: true,
      repeat: "body",
    },
    rules: [
      hardPairRule("r_round_tower_cap_h", 24, 25, "aLeftOfB", "원형 타워 캡 좌(24)는 우(25) 바로 왼쪽에 있어야 합니다."),
      hardPairRule("r_round_tower_neck_h", 138, 139, "aLeftOfB", "원형 타워 목 좌(138)는 우(139) 바로 왼쪽에 있어야 합니다."),
      hardPairRule("r_round_tower_body_h", 140, 141, "aLeftOfB", "원형 타워 몸 좌(140)는 우(141) 바로 왼쪽에 있어야 합니다."),
      hardPairRule("r_round_tower_window_h", 142, 143, "aLeftOfB", "원형 타워 창문 좌(142)는 우(143) 바로 왼쪽에 있어야 합니다."),
      hardPairRule("r_round_tower_base_h", 54, 55, "aLeftOfB", "원형 타워 베이스 좌(54)는 우(55) 바로 왼쪽에 있어야 합니다."),
      hardPairRule("r_round_tower_cap_over_neck_l", 24, 138, "aAboveB", "원형 타워 캡 좌(24)는 목 좌(138) 바로 위에 있어야 합니다."),
      hardPairRule("r_round_tower_cap_over_neck_r", 25, 139, "aAboveB", "원형 타워 캡 우(25)는 목 우(139) 바로 위에 있어야 합니다."),
    ],
  },
  lowerSolidGroup("doors", "문/입구", [...CHIPSET_TILE_GROUPS.houseEntranceObjects, ...CHIPSET_TILE_GROUPS.houseDoorObjects], "문은 1x2 세로 입구 기준으로 하위 레이어에 배치합니다."),
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}wood-door`,
    name: "나무 문(세로)",
    role: "building",
    defaultLayer: "lower",
    tileIds: [...CHIPSET_TILE_GROUPS.woodDoorPairObjects],
    description: "나무 문 세트: 상 116 + 하 146 (1×2).",
    placementRules: "116을 146 바로 위에 둔다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "fixed",
    patternGrammar: {
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [
        { role: "top", tileIds: [116] },
        { role: "bottom", tileIds: [146] },
      ],
      preserveCaps: true,
      repeat: "body",
    },
    rules: [hardPairRule("r_wood_door_pair", 116, 146, "aAboveB", "나무 문 상단(116)은 하단(146) 바로 위에 있어야 합니다.")],
  },
  {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}stone-stairs`,
    name: "돌계단(가로)",
    role: "building",
    defaultLayer: "lower",
    tileIds: [...CHIPSET_TILE_GROUPS.stoneStairObjects],
    description: "돌계단: 좌 111 + 중 112(무제한 연장) + 우 113. RM2k3 가로 층계 — 밟을 수 있음(좌우 4-dir은 harness 후처리).",
    placementRules: "가로로 전개. 112는 중앙 반복. 절벽 옆 진입용.",
    confidence: "high",
    source: "bundled-default",
    passage: "passable",
    repeatability: "repeat",
    patternGrammar: {
      axis: "horizontal",
      kind: "horizontal_expandable",
      minWidth: 3,
      minHeight: 1,
      parts: [
        { role: "leftCap", tileIds: [111] },
        { role: "repeatBody", tileIds: [112] },
        { role: "rightCap", tileIds: [113] },
      ],
      preserveCaps: true,
      repeat: "body",
    },
  },
  lowerSolidGroup("roof-wall-boundary", "지붕-벽 경계", [404, 405, 406, 407, 434, 435, 436, 437, 464, 466, 467], "직선 지붕면과 벽 경계는 하위 레이어입니다. 사선 지붕만 상위에 겹칩니다."),
  verticalTreeGroup("conifer-tree", "침엽수", CONIFER_TOP, CONIFER_BOTTOM, "침엽수는 상단과 하단을 세로 2칸 원자로 배치합니다."),
  verticalTreeGroup("dry-tree", "마른나무", DRY_TREE_TOP, DRY_TREE_BOTTOM, "마른나무는 상단과 하단을 세로 2칸 원자로 배치합니다."),
  broadleafTreeGroup(),
  mixedStackGroup("bush-props", "덤불", [BUSH_TILE], "덤불은 단독 배치 가능한 자연 소품입니다.", "solid", {
    rules: [
      {
        id: "r_bush_spacing_soft",
        kind: "spacing",
        message: "덤불은 서로 너무 붙지 않게 2칸 이상 띄우면 자연스럽습니다.",
        params: { minGap: 2 },
        strength: "soft",
      },
    ],
  }),
  mixedStackGroup("flower-props", "꽃/자연 소품", CHIPSET_TILE_GROUPS.flowerObjects, "꽃은 통행 가능한 투명 자연 소품으로 기존 지면을 보존합니다.", "passable", {
    rules: [
      {
        id: "r_flower_spacing_medium",
        kind: "spacing",
        message: "꽃은 서로 2칸 이상 띄워 배치하기를 권장합니다.",
        params: { minGap: 2 },
        strength: "medium",
      },
    ],
  }),
  mixedStackGroup("branch-props", "가지", [BRANCH_TILE], "가지는 단독 배치 가능한 자연 소품입니다.", "passable"),
  // 칩셋 실사(사용자 비전): 가로 벤치 327|328, 세로 의자 358|388.
  mixedStackGroup(
    "bench-horizontal",
    "벤치(가로)",
    [327, 328],
    "가로 벤치: 좌 327 + 우 328 (1×2). 세로 의자는 bench-vertical(358|388). 통행 불가(×).",
    "solid",
    {
      patternGrammar: {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 2,
        minHeight: 1,
        parts: [
          { role: "leftCap", tileIds: [327] },
          { role: "rightCap", tileIds: [328] },
        ],
        preserveCaps: true,
        repeat: "body",
      },
      rules: [hardPairRule("r_bench_h_pair", 327, 328, "aLeftOfB", "가로 벤치 좌(327)는 우(328) 바로 왼쪽에 있어야 합니다.")],
    },
  ),
  mixedStackGroup(
    "bench-vertical",
    "의자(세로)",
    [358, 388],
    "세로 의자/벤치: 상 358 + 하 388 (1×2). 둘 다 상위 레이어. 통행 불가(×).",
    "solid",
    {
      patternGrammar: {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "top", tileIds: [358] },
          { role: "bottom", tileIds: [388] },
        ],
        preserveCaps: true,
        repeat: "body",
      },
      rules: [hardPairRule("r_bench_v_pair", 358, 388, "aAboveB", "세로 의자 상(358)은 하(388) 바로 위에 있어야 합니다.")],
    },
  ),
  mixedStackGroup(
    "table-horizontal",
    "탁자(가로)",
    [...CHIPSET_TILE_GROUPS.tableHorizontalObjects],
    "가로 탁자: 좌 234 + 중 235(무제한 연장) + 우 236. 상위 레이어. 통행 불가(×) — 상점 카운터.",
    "solid",
    {
      patternGrammar: {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 3,
        minHeight: 1,
        parts: [
          { role: "leftCap", tileIds: [234] },
          { role: "repeatBody", tileIds: [235] },
          { role: "rightCap", tileIds: [236] },
        ],
        preserveCaps: true,
        repeat: "body",
      },
    },
  ),
  mixedStackGroup(
    "table-vertical",
    "탁자(세로)",
    [...CHIPSET_TILE_GROUPS.tableVerticalObjects],
    "세로 탁자: 상 144 + 중 174(무제한 연장) + 하 204. 상위 레이어. 통행 불가(×).",
    "solid",
    {
      patternGrammar: {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 3,
        minWidth: 1,
        parts: [
          { role: "top", tileIds: [144] },
          { role: "repeatBody", tileIds: [174] },
          { role: "bottom", tileIds: [204] },
        ],
        preserveCaps: true,
        repeat: "body",
      },
    },
  ),
  mixedStackGroup(
    "table-chairs",
    "탁자 옆 의자",
    [175, 176, 205, 206],
    "탁자 옆 의자: 175=탁자 위(아래 봄), 176=탁자 아래(위 봄), 205=탁자 왼(오 봄), 206=탁자 오른(왼 봄). 통행 불가(×).",
    "solid",
  ),
  mixedStackGroup(
    "free-chairs",
    "의자(단독)",
    [147, 148],
    "147=등받이 없는 의자, 148=등받이 있는 의자. 단독 배치. 통행 불가(×).",
    "solid",
  ),
  mixedStackGroup(
    "house-yard-props",
    "집 앞 마당 소품",
    [...CHIPSET_TILE_GROUPS.houseYardObjects],
    "집 앞에 두는 마당 소품: 349장작, 350우편함, 351화분, 352항아리. 통행 불가(×).",
    "solid",
    {
      rules: [
        {
          id: "r_yard_near_house_soft",
          kind: "spacing",
          message: "집 앞 마당 소품은 집 입구·전면 근처 2~4칸 안쪽에 두는 것이 자연스럽습니다.",
          params: { minGap: 1 },
          strength: "soft",
        },
      ],
    },
  ),
  mixedStackGroup(
    "cemetery-props",
    "묘지 소품",
    [...CHIPSET_TILE_GROUPS.cemeteryObjects],
    "묘지: 323묘지, 353묘비, 383해골. 집과 멀리. 통행 불가(×).",
    "solid",
    {
      rules: [
        {
          id: "r_cemetery_spacing",
          kind: "spacing",
          message: "묘지 소품은 집·마당 소품과 최소 6칸 이상 떨어뜨리세요.",
          params: { minGap: 6 },
          strength: "medium",
        },
      ],
    },
  ),
  mixedStackGroup(
    "wall-ladder",
    "벽 사다리",
    [...CHIPSET_TILE_GROUPS.wallLadderObjects],
    "벽 사다리(322): 집 벽 위 상위 레이어. 플레이어 통과 가능.",
    "passable",
  ),
  mixedStackGroup(
    "fruit-box",
    "과일박스",
    [...CHIPSET_TILE_GROUPS.fruitBoxObjects],
    "과일박스: 좌 202 + 우 203 (1×2). 통행 불가(×).",
    "solid",
    {
      patternGrammar: {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 2,
        minHeight: 1,
        parts: [
          { role: "leftCap", tileIds: [202] },
          { role: "rightCap", tileIds: [203] },
        ],
        preserveCaps: true,
        repeat: "body",
      },
      rules: [hardPairRule("r_fruit_box_pair", 202, 203, "aLeftOfB", "과일박스 좌(202)는 우(203) 바로 왼쪽에 있어야 합니다.")],
    },
  ),
  mixedStackGroup(
    "wood-box",
    "나무 상자",
    [...CHIPSET_TILE_GROUPS.woodBoxObjects],
    "나무 상자(237) 단독 소품. 통행 불가(×).",
    "solid",
  ),
  // 장터 데크·부두 바닥. fill_region(오토타일 전용) 대신 paint_tiles rect / place 로 면 채움.
  lowerPassableTerrainGroup(
    "wood-floor-deck",
    "나무 바닥 데크",
    [...CHIPSET_TILE_GROUPS.woodFloorBody],
    "나무 바닥(192·222·228–230). 하위 통행 가능. 장터 데크·부두 면적 채움용. 대표 바디 222.",
  ),
  // 맵 하단 난간 한 줄(223) 등 목조 구조. 통행 불가 경계.
  lowerSolidGroup(
    "timber-post-rail",
    "목조 난간/기둥",
    [...CHIPSET_TILE_GROUPS.timberPostStructureObjects],
    "목조 기둥·난간(193–197, 223–227). 하위 solid. 장터/데크 가장자리 가로 반복에 223 바디를 쓴다.",
  ),
  // 마켓 공터 y=8 금본: 상위 가로 레일 468|469*|470 (통행 불가). timber 223과 별 세트.
  mixedStackGroup(
    "market-rail-upper",
    "장터 레일(상위)",
    [...CHIPSET_TILE_GROUPS.marketRailHorizontalObjects],
    "장터/데크 상위 레일: 좌 468 + 중 469(무제한 연장) + 우 470. 통행 불가. 마켓 공터 (1,8)–(8,8) 금본.",
    "solid",
    {
      patternGrammar: {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 3,
        minHeight: 1,
        parts: [
          { role: "leftCap", tileIds: [468] },
          { role: "repeatBody", tileIds: [469] },
          { role: "rightCap", tileIds: [470] },
        ],
        preserveCaps: true,
        repeat: "body",
      },
    },
  ),
  // 마켓 공터 (0,4)/(0,7) 금본: 회색 돌단·석판 소품.
  mixedStackGroup(
    "stone-step-slab",
    "돌단/석판",
    [...CHIPSET_TILE_GROUPS.stoneStepObjects],
    "돌단·석판(268). 상위 solid. 장터 가장자리 단·연석·짧은 계단 느낌 장식.",
    "solid",
  ),
  mixedStackGroup(
    "magic-circle",
    "마법진",
    [...CHIPSET_TILE_GROUPS.magicCircleObjects],
    "마법진(231). 통행 가능한 상위 장식.",
    "passable",
  ),
  mixedStackGroup(
    "small-props",
    "마을 소품",
    [
      ...CHIPSET_TILE_GROUPS.signObjects,
      ...CHIPSET_TILE_GROUPS.fireObjects,
      ...CHIPSET_TILE_GROUPS.statueObjects,
      ...CHIPSET_TILE_GROUPS.smallObjects.filter(
        (tile) =>
          tile !== BRANCH_TILE
          && !FLOWER_OBJECT_TILE_SET.has(tile)
          && !(CHIPSET_TILE_GROUPS.benchObjects as readonly number[]).includes(tile)
          && !(CHIPSET_TILE_GROUPS.houseYardObjects as readonly number[]).includes(tile)
          && !(CHIPSET_TILE_GROUPS.cemeteryObjects as readonly number[]).includes(tile),
      ),
    ],
    "표지판·횃불·석상 등 잔여 소품 가방. 통행 불가(×). 꽃·사다리는 별 그룹.",
    "solid",
  ),
  // 헤드리스 플레이테스트로 검증된 통행성 함정 타일(핸드오프 0.4) — 겉보기와 달리 통행이 막히는 돌바닥.
  lowerSolidGroup("stone-floor-trap", "돌바닥", [TILE.FLOOR, 343], "겉보기엔 평평해 통행 가능해 보이지만 실측 결과 통행이 막히는 돌바닥입니다. 장식용 바닥 마감으로만 사용하세요."),
  // 검증된 통행 불가 성벽 계단/어두운 벽 타일.
  // 참고: TILE.WALL(306)은 하네스 그룹 미소속 — 레이어는 tileset.priority(lower)로 분류되고
  // isSolidChipsetTile 기본값으로 이미 통행 불가라 별도 그룹이 필요 없다.
  // "벽" 검색은 tileSemanticsCombinedTown.ts(검색 전용 큐레이션)에서 제공한다.
  lowerSolidGroup("castle-solid-tiles", "성벽 계단/어두운 벽", [TILE.STAIRS, 426], "성벽 계단, 어두운 벽 등 통행이 막히는 구조 타일입니다."),
];

function wall9Slice(id: string, name: string, tileIds: readonly number[], description: string): CombinedTownHarnessGroup {
  return {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}${id}`,
    name,
    role: "wall",
    defaultLayer: "lower",
    tileIds,
    description,
    placementRules: "지붕-벽 경계 아래 하위 레이어에 배치합니다. 모서리는 고정하고 가운데 열은 가로 반복합니다.",
    confidence: "high",
    source: "bundled-default",
    passage: "solid",
    repeatability: "repeat",
    patternGrammar: nineSliceGrammar(tileIds),
  };
}

function lowerSolidGroup(id: string, name: string, tileIds: readonly number[], placementRules: string): CombinedTownHarnessGroup {
  return { id: `${COMBINED_TOWN_HARNESS_PREFIX}${id}`, name, role: "building", defaultLayer: "lower", tileIds, description: placementRules, placementRules, confidence: "high", source: "bundled-default", passage: "solid", repeatability: "fixed" };
}

function lowerPassableTerrainGroup(
  id: string,
  name: string,
  tileIds: readonly number[],
  placementRules: string,
): CombinedTownHarnessGroup {
  return {
    id: `${COMBINED_TOWN_HARNESS_PREFIX}${id}`,
    name,
    role: "terrain",
    defaultLayer: "lower",
    tileIds,
    description: placementRules,
    placementRules,
    confidence: "high",
    source: "bundled-default",
    passage: "passable",
    repeatability: "repeat",
  };
}

function lowerStackGroup(id: string, name: string, tileIds: readonly number[], placementRules: string): CombinedTownHarnessGroup {
  return { ...lowerSolidGroup(id, name, tileIds, placementRules), role: id === "fence" ? "fence" : "prop", stackable: true };
}

function mixedStackGroup(
  id: string,
  name: string,
  tileIds: readonly number[],
  placementRules: string,
  passage: TileAiMetadata["passage"],
  extras: Pick<CombinedTownHarnessGroup, "patternGrammar" | "rules"> = {}
): CombinedTownHarnessGroup {
  return { id: `${COMBINED_TOWN_HARNESS_PREFIX}${id}`, name, role: "prop", defaultLayer: "mixed", tileIds, description: placementRules, placementRules, confidence: "high", source: "bundled-default", passage, repeatability: "fixed", stackable: true, ...extras };
}

function verticalTreeGroup(id: string, name: string, top: number, bottom: number, placementRules: string): CombinedTownHarnessGroup {
  return mixedStackGroup(id, name, [top, bottom], placementRules, "solid", {
    patternGrammar: {
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [
        { role: "top", tileIds: [top] },
        { role: "bottom", tileIds: [bottom] },
      ],
      preserveCaps: true,
      repeat: "body",
    },
    rules: [
      {
        id: `r_${id.replace(/-/g, "_")}_above`,
        kind: "adjacency",
        message: `${name} 상단(${top})은 하단(${bottom}) 바로 위에 있어야 합니다.`,
        params: { a: top, b: bottom, relation: "aAboveB" },
        strength: "hard",
      },
    ],
  });
}

function broadleafTreeGroup(): CombinedTownHarnessGroup {
  return mixedStackGroup(
    "broadleaf-tree-2x2",
    "활엽수 2x2",
    [BROADLEAF_TOP_LEFT, BROADLEAF_TOP_RIGHT, BROADLEAF_BOTTOM_LEFT, BROADLEAF_BOTTOM_RIGHT],
    "활엽수는 2x2 원자 오브젝트로 배치합니다.",
    "solid",
    {
      patternGrammar: {
        axis: "both",
        kind: "source_rect",
        minHeight: 2,
        minWidth: 2,
        parts: [
          { role: "topLeft", tileIds: [BROADLEAF_TOP_LEFT] },
          { role: "topRight", tileIds: [BROADLEAF_TOP_RIGHT] },
          { role: "bottomLeft", tileIds: [BROADLEAF_BOTTOM_LEFT] },
          { role: "bottomRight", tileIds: [BROADLEAF_BOTTOM_RIGHT] },
        ],
        preserveCaps: true,
        repeat: "source_order",
      },
      rules: [
        hardPairRule("r_broadleaf_left_column", BROADLEAF_TOP_LEFT, BROADLEAF_BOTTOM_LEFT, "aAboveB", "활엽수 왼쪽 열은 상단(262)이 하단(292) 바로 위에 있어야 합니다."),
        hardPairRule("r_broadleaf_right_column", BROADLEAF_TOP_RIGHT, BROADLEAF_BOTTOM_RIGHT, "aAboveB", "활엽수 오른쪽 열은 상단(263)이 하단(293) 바로 위에 있어야 합니다."),
        hardPairRule("r_broadleaf_top_row", BROADLEAF_TOP_LEFT, BROADLEAF_TOP_RIGHT, "aLeftOfB", "활엽수 상단은 262가 263 바로 왼쪽에 있어야 합니다."),
        hardPairRule("r_broadleaf_bottom_row", BROADLEAF_BOTTOM_LEFT, BROADLEAF_BOTTOM_RIGHT, "aLeftOfB", "활엽수 하단은 292가 293 바로 왼쪽에 있어야 합니다."),
      ],
    }
  );
}

function hardPairRule(
  id: string,
  a: number,
  b: number,
  relation: "aAboveB" | "aBelowB" | "aLeftOfB" | "aRightOfB",
  message: string
): NonNullable<TileGroupMetadata["rules"]>[number] {
  return { id, kind: "adjacency", message, params: { a, b, relation }, strength: "hard" };
}

function nineSliceGrammar(tileIds: readonly number[]): TileGroupMetadata["patternGrammar"] {
  return {
    axis: "both",
    kind: "nine_slice_expandable",
    minHeight: 3,
    minWidth: 3,
    parts: [
      { role: "topLeft", tileIds: [tileIds[0] ?? TILE.EMPTY] },
      { role: "top", tileIds: [tileIds[1] ?? TILE.EMPTY] },
      { role: "topRight", tileIds: [tileIds[2] ?? TILE.EMPTY] },
      { role: "left", tileIds: [tileIds[3] ?? TILE.EMPTY] },
      { role: "center", tileIds: [tileIds[4] ?? TILE.EMPTY] },
      { role: "right", tileIds: [tileIds[5] ?? TILE.EMPTY] },
      { role: "bottomLeft", tileIds: [tileIds[6] ?? TILE.EMPTY] },
      { role: "bottom", tileIds: [tileIds[7] ?? TILE.EMPTY] },
      { role: "bottomRight", tileIds: [tileIds[8] ?? TILE.EMPTY] },
    ],
    preserveCaps: true,
    repeat: "center",
  };
}

function overlayGrammar(tileIds: readonly number[]): TileGroupMetadata["patternGrammar"] {
  return { kind: "overlay_detail", parts: [{ role: "repeatBody", tileIds: [...tileIds] }], preserveCaps: true, repeat: "source_order" };
}
