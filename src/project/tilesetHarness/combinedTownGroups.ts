import type { TileAiMetadata, TileGroupMetadata } from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import { CHIPSET_TILE_GROUPS, DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";

export type CombinedTownHarnessGroup = Omit<TileGroupMetadata, "tileIds"> & {
  readonly passage: TileAiMetadata["passage"];
  readonly repeatability: TileAiMetadata["repeatability"];
  readonly stackable?: boolean;
  readonly tileIds: readonly number[];
};

export const COMBINED_TOWN_HARNESS_PREFIX = "harness-combined-town-";
export const COMBINED_TOWN_ROOF_OVERLAY_TILES = [374, 375, 376, 377, 384, 385, 386, 387] as const;

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
  lowerSolidGroup("doors", "문/입구", [...CHIPSET_TILE_GROUPS.houseEntranceObjects, ...CHIPSET_TILE_GROUPS.houseDoorObjects, 116, 146], "문은 1x2 세로 입구 기준으로 하위 레이어에 배치합니다."),
  lowerSolidGroup("roof-wall-boundary", "지붕-벽 경계", [404, 405, 406, 407, 434, 435, 436, 437, 464, 466, 467], "직선 지붕면과 벽 경계는 하위 레이어입니다. 사선 지붕만 상위에 겹칩니다."),
  mixedStackGroup("tree-props", "나무 소품", CHIPSET_TILE_GROUPS.treeObjects, "나무는 투명 소품입니다. 필요한 경우 하위/상위 스택에 겹쳐 배치합니다.", "solid"),
  mixedStackGroup("flower-props", "꽃/자연 소품", CHIPSET_TILE_GROUPS.flowerObjects, "꽃은 통행 가능한 투명 자연 소품으로 기존 지면을 보존합니다.", "passable"),
  mixedStackGroup("small-props", "마을 소품", [...CHIPSET_TILE_GROUPS.benchObjects, ...CHIPSET_TILE_GROUPS.signObjects, ...CHIPSET_TILE_GROUPS.fireObjects, ...CHIPSET_TILE_GROUPS.statueObjects, ...CHIPSET_TILE_GROUPS.smallObjects], "표지판, 벤치, 장식물은 투명 소품으로 기존 지면을 보존합니다.", "passable"),
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

function lowerStackGroup(id: string, name: string, tileIds: readonly number[], placementRules: string): CombinedTownHarnessGroup {
  return { ...lowerSolidGroup(id, name, tileIds, placementRules), role: id === "fence" ? "fence" : "prop", stackable: true };
}

function mixedStackGroup(id: string, name: string, tileIds: readonly number[], placementRules: string, passage: TileAiMetadata["passage"]): CombinedTownHarnessGroup {
  return { id: `${COMBINED_TOWN_HARNESS_PREFIX}${id}`, name, role: "prop", defaultLayer: "mixed", tileIds, description: placementRules, placementRules, confidence: "high", source: "bundled-default", passage, repeatability: "fixed", stackable: true };
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
