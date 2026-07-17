import type { PassFlag } from "../types";
import { DEFAULT_TILES_PER_ROW, TILE } from "./constants";
import { CHIPSET_ANIMATION_FRAME_TILES } from "./chipsetAnimation";
import { COMBINED_TOWN_TRANSPARENT_TILES } from "./generatedChipsetTransparency";

// allow: SIZE_OK - central descriptor table for the 480-cell EasyRPG exterior atlas.

type TileRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type ChipsetTileLayer = "lower" | "upper";
export type ChipsetTilePassage = "passable" | "solid";
export type ChipsetTileRepeatRole = "body" | "variant" | "detail" | "edge" | "object" | "single";
export type ChipsetTileUsage = "terrain" | "path" | "edge" | "detail" | "structure" | "decoration" | "empty" | "unknown";

export type ChipsetTileDescriptor = {
  readonly index: number;
  readonly column: number;
  readonly row: number;
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly aiLabel: string;
  readonly usage: ChipsetTileUsage;
  readonly tags: readonly string[];
  readonly layer: ChipsetTileLayer;
  readonly passage: ChipsetTilePassage;
  readonly terrainTag: number;
  readonly repeatRole: ChipsetTileRepeatRole;
  readonly confirmed: boolean;
};

type TileSemantic = Pick<ChipsetTileDescriptor, "key" | "label" | "aiLabel" | "usage" | "tags">;

export const TERRAIN_TAG = {
  NORMAL: 0,
  WATER: 1,
  SAND: 2,
  SNOW: 3,
  STONE: 4,
} as const;

export const DIRT_ROAD_TILE = {
  BODY: 421,
  BODY_ALT: TILE.PATH,
  EDGE_NORTH: 391,
  EDGE_SOUTH: 451,
  EDGE_WEST: 420,
  EDGE_EAST: 422,
  CORNER_NORTH_WEST: 390,
  CORNER_NORTH_EAST: 392,
  CORNER_SOUTH_WEST: 450,
  CORNER_SOUTH_EAST: 452,
  // 블록 윗줄(12행): 외딴 1칸 웅덩이 / 네 귀퉁이 잔디 바이트가 합성된 오목 코너.
  ISOLATED: 360,
  INNER_CORNER: 362,
} as const;

const DIRT_ROAD_SIDE_EDGES = [
  DIRT_ROAD_TILE.EDGE_NORTH,
  DIRT_ROAD_TILE.EDGE_SOUTH,
  DIRT_ROAD_TILE.EDGE_WEST,
  DIRT_ROAD_TILE.EDGE_EAST,
] as const;

const DIRT_ROAD_CORNERS = [
  DIRT_ROAD_TILE.CORNER_NORTH_WEST,
  DIRT_ROAD_TILE.CORNER_NORTH_EAST,
  DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
  DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
] as const;

export const SAND_TILE = {
  BODY: 424,
  EDGE_NORTH: 394,
  EDGE_SOUTH: 454,
  EDGE_WEST: 423,
  EDGE_EAST: 425,
  CORNER_NORTH_WEST: 393,
  CORNER_NORTH_EAST: 395,
  CORNER_SOUTH_WEST: 453,
  CORNER_SOUTH_EAST: 455,
  // 블록 윗줄(12행): 외딴 1칸 웅덩이 / 네 귀퉁이 잔디 바이트가 합성된 오목 코너.
  ISOLATED: 363,
  INNER_CORNER: 365,
} as const;

// 포석(돌길) 오토타일 — 129 템플릿 블록(열 9~11 × 행 4~7). 2026-07-16 사용자 지정 정본.
export const COBBLE_TILE = {
  BODY: 190,
  EDGE_NORTH: 160,
  EDGE_SOUTH: 220,
  EDGE_WEST: 189,
  EDGE_EAST: 191,
  CORNER_NORTH_WEST: 159,
  CORNER_NORTH_EAST: 161,
  CORNER_SOUTH_WEST: 219,
  CORNER_SOUTH_EAST: 221,
  ISOLATED: 129,
  INNER_CORNER: 131,
} as const;

// 경작지(밭고랑+새싹) 오토타일 — 126 템플릿 블록(열 6~8 × 행 4~7). 참조 맵 밭 문법.
export const FARMLAND_TILE = {
  BODY: 187,
  EDGE_NORTH: 157,
  EDGE_SOUTH: 217,
  EDGE_WEST: 186,
  EDGE_EAST: 188,
  CORNER_NORTH_WEST: 156,
  CORNER_NORTH_EAST: 158,
  CORNER_SOUTH_WEST: 216,
  CORNER_SOUTH_EAST: 218,
  ISOLATED: 126,
  INNER_CORNER: 128,
} as const;

const SAND_SIDE_EDGES = [
  SAND_TILE.EDGE_NORTH,
  SAND_TILE.EDGE_SOUTH,
  SAND_TILE.EDGE_WEST,
  SAND_TILE.EDGE_EAST,
] as const;

const SAND_CORNERS = [
  SAND_TILE.CORNER_NORTH_WEST,
  SAND_TILE.CORNER_NORTH_EAST,
  SAND_TILE.CORNER_SOUTH_WEST,
  SAND_TILE.CORNER_SOUTH_EAST,
] as const;

const LAKE_WATER_BODY_TILES = [120, 150, 180, 210] as const;
const LAKE_WATER_BODY_ANIMATION_FRAMES = [
  ...tilesInRect({ left: 0, top: 4, right: 2, bottom: 7 }),
] as const;
const LAKE_SHORE_EDGE_TILES = [0, 30, 60, 90] as const;
const LAKE_SHORE_EDGE_ANIMATION_FRAMES = [
  ...tilesInRect({ left: 0, top: 0, right: 2, bottom: 3 }),
] as const;
// 2026-07-17 정본 교정: 3행(93~95)은 폭포가 아니라 수로(석축 스킨)의 오목(inner) 코너다.
// 폭포는 4행부터 — lakeAutotile.ts CANAL_AUTOTILE_TILE 참조.
const WATERFALL_WATER_TILES = [123, 153, 183, 213] as const;
const WATERFALL_WATER_ANIMATION_FRAMES = [
  ...tilesInRect({ left: 3, top: 4, right: 5, bottom: 7 }),
] as const;
const DESERT_SAND_BODY_TILES = [SAND_TILE.BODY] as const;
const DESERT_SAND_EDGE_TILES = [...SAND_SIDE_EDGES, ...SAND_CORNERS] as const;
const HOUSE_PURPLE_STONE_WALL_OBJECTS = [12, 13, 14, 42, 43, 44, 72, 73, 74] as const;
const HOUSE_WHITE_WALL_UPPER_OBJECTS = [15, 16, 17] as const;
const HOUSE_WHITE_WALL_BODY_OBJECTS = [45, 46, 47] as const;
const HOUSE_WHITE_WALL_LOWER_OBJECTS = [75, 76, 77] as const;
const HOUSE_WHITE_WALL_OBJECTS = [
  ...HOUSE_WHITE_WALL_UPPER_OBJECTS,
  ...HOUSE_WHITE_WALL_BODY_OBJECTS,
  ...HOUSE_WHITE_WALL_LOWER_OBJECTS,
] as const;
const HOUSE_WOOD_WALL_UPPER_OBJECTS = [102, 103, 104] as const;
const HOUSE_WOOD_WALL_BODY_OBJECTS = [132, 133, 134] as const;
const HOUSE_WOOD_WALL_LOWER_OBJECTS = [162, 163, 164] as const;
const HOUSE_WOOD_WALL_OBJECTS = [
  ...HOUSE_WOOD_WALL_UPPER_OBJECTS,
  ...HOUSE_WOOD_WALL_BODY_OBJECTS,
  ...HOUSE_WOOD_WALL_LOWER_OBJECTS,
] as const;
const HOUSE_WHITE_WALL_LEFT_COLUMN_OBJECTS = [15, 45, 75] as const;
const HOUSE_WHITE_WALL_REPEAT_COLUMN_OBJECTS = [16, 46, 76] as const;
const HOUSE_WHITE_WALL_RIGHT_COLUMN_OBJECTS = [17, 47, 77] as const;
const HOUSE_PLASTER_WALL_OBJECTS = [
  ...HOUSE_PURPLE_STONE_WALL_OBJECTS,
  ...HOUSE_WHITE_WALL_OBJECTS,
] as const;
const WOOD_STRUCTURE_OBJECTS = [105, 106, 107, 135, 136, 137, 165, 166, 167] as const;
const TIMBER_POST_STRUCTURE_OBJECTS = [193, 194, 195, 196, 197, 223, 224, 225, 226, 227] as const;
const HOUSE_ENTRANCE_UPPER_OBJECTS = [329] as const;
const HOUSE_ENTRANCE_LOWER_OBJECTS = [359] as const;
const HOUSE_ENTRANCE_OBJECTS = [
  ...HOUSE_ENTRANCE_UPPER_OBJECTS,
  ...HOUSE_ENTRANCE_LOWER_OBJECTS,
] as const;
const HOUSE_ROOF_OBJECTS = [374, 375, 376, 377, 384, 386, 387, 404, 405, 406, 407] as const;
const HOUSE_FACADE_OBJECTS = [385, 434, 435, 436, 437, 464, 466, 467] as const;
const HOUSE_DOOR_OBJECTS = [465] as const;
const HOUSE_WINDOW_OBJECTS = [85, 87] as const;
const HOUSE_WALL_OBJECTS = [
  ...HOUSE_PLASTER_WALL_OBJECTS,
  ...HOUSE_WOOD_WALL_OBJECTS,
  ...HOUSE_FACADE_OBJECTS,
] as const;

export const CHIPSET_TILE_GROUPS = {
  water: CHIPSET_ANIMATION_FRAME_TILES,
  snowGround: [
    ...tilesInRect({ left: 6, top: 0, right: 8, bottom: 3 }),
  ],
  grassGround: [
    240, 241, 242, 243, 244, 245,
    270, 271, 272, 273, 274, 275,
    300, 301, 302, 303, 304, 305,
    330, 331, 332, 333, 334, 335,
  ],
  // 키큰 풀(포켓몬풍 인카운터 풀숲 상징) — 243 템플릿 블록 + 상단 변형 244.
  // 273/333은 243 블록의 NW/SW 모서리 — 잔디 오분류를 교정해 편입 (2026-07-17, grass-autotile 그룹에서 제거).
  // 통행성은 잔디와 동일(passable) — 인카운터는 사냥터/조우표로 별도 배선하며 타일 자체엔 로직을 넣지 않는다.
  tallGrass: [303, 304, 305, 334, 335, 243, 244, 245, 273, 274, 275, 333],
  lakeWaterBody: LAKE_WATER_BODY_TILES,
  lakeWaterBodyAnimationFrames: LAKE_WATER_BODY_ANIMATION_FRAMES,
  lakeShoreEdges: LAKE_SHORE_EDGE_TILES,
  lakeShoreEdgeAnimationFrames: LAKE_SHORE_EDGE_ANIMATION_FRAMES,
  waterBody: LAKE_WATER_BODY_TILES,
  waterEdges: LAKE_SHORE_EDGE_TILES,
  waterfallWater: WATERFALL_WATER_TILES,
  waterfallWaterAnimationFrames: WATERFALL_WATER_ANIMATION_FRAMES,
  dirtRoadBody: [DIRT_ROAD_TILE.BODY_ALT, DIRT_ROAD_TILE.BODY],
  dirtRoadVariants: [],
  dirtRoadDetail: [156, 157, 158, 186, 187, 188, 216, 217, 218],
  dirtRoadSideEdges: DIRT_ROAD_SIDE_EDGES,
  dirtRoadCorners: DIRT_ROAD_CORNERS,
  dirtEdges: [...DIRT_ROAD_SIDE_EDGES, ...DIRT_ROAD_CORNERS],
  desertSandBody: DESERT_SAND_BODY_TILES,
  desertSandEdges: DESERT_SAND_EDGE_TILES,
  sandBody: DESERT_SAND_BODY_TILES,
  sandSideEdges: SAND_SIDE_EDGES,
  sandCorners: SAND_CORNERS,
  sandGround: [363, 364, 365, 393, 394, 395, 423, 424, 425, 453, 454, 455],
  stoneFloorBody: [342],
  woodBridgeBody: [],
  woodFloorBody: [192, 222, 228, 229, 230],
  groundDetail: [402, 403, 432, 433, 462, 463],
  darkWallBody: [
    366, 367, 368, 369, 370, 371,
    396, 397, 398, 399, 400, 401,
    426, 427, 428, 429, 430, 431,
    456, 457, 458, 459, 460, 461,
  ],
  stoneGround: [
    129, 130, 131, 159, 160, 161, 189, 190, 191, 219, 220, 221,
    342, 343, 344, 345, 346, 347, 372, 373, 462, 463,
  ],
  stoneWallBody: [306],
  stoneWall: [
    246, 247, 248, 249, 250, 251,
    276, 277, 278, 279, 280, 281,
    306, 307, 308, 309, 310, 311,
    336, 337, 338, 339, 340, 341,
  ],
  structureSolid: [
    ...tilesInRect({ left: 6, top: 8, right: 17, bottom: 12 }),
    ...tilesInRect({ left: 18, top: 0, right: 29, bottom: 3 }),
  ],
  upperObjects: [
    ...tilesInRect({ left: 18, top: 8, right: 29, bottom: 15 }),
  ],
  treeObjects: [260, 262, 263, 289, 290, 292, 293],
  // 351은 화분(집 앞 마당) — flower가 아니라 houseYardObjects.
  flowerObjects: [288, 348],
  stakeObjects: [378, 408, 438],
  fenceObjects: [378, 379, 380, 408, 409, 410, 438, 439],
  housePurpleStoneWallObjects: HOUSE_PURPLE_STONE_WALL_OBJECTS,
  houseWhiteWallUpperObjects: HOUSE_WHITE_WALL_UPPER_OBJECTS,
  houseWhiteWallBodyObjects: HOUSE_WHITE_WALL_BODY_OBJECTS,
  houseWhiteWallLowerObjects: HOUSE_WHITE_WALL_LOWER_OBJECTS,
  houseWhiteWallObjects: HOUSE_WHITE_WALL_OBJECTS,
  houseWoodWallUpperObjects: HOUSE_WOOD_WALL_UPPER_OBJECTS,
  houseWoodWallBodyObjects: HOUSE_WOOD_WALL_BODY_OBJECTS,
  houseWoodWallLowerObjects: HOUSE_WOOD_WALL_LOWER_OBJECTS,
  houseWoodWallObjects: HOUSE_WOOD_WALL_OBJECTS,
  houseWhiteWallLeftColumnObjects: HOUSE_WHITE_WALL_LEFT_COLUMN_OBJECTS,
  houseWhiteWallRepeatColumnObjects: HOUSE_WHITE_WALL_REPEAT_COLUMN_OBJECTS,
  houseWhiteWallRightColumnObjects: HOUSE_WHITE_WALL_RIGHT_COLUMN_OBJECTS,
  housePlasterWallObjects: HOUSE_PLASTER_WALL_OBJECTS,
  woodStructureObjects: WOOD_STRUCTURE_OBJECTS,
  timberPostStructureObjects: TIMBER_POST_STRUCTURE_OBJECTS,
  houseEntranceUpperObjects: HOUSE_ENTRANCE_UPPER_OBJECTS,
  houseEntranceLowerObjects: HOUSE_ENTRANCE_LOWER_OBJECTS,
  houseEntranceObjects: HOUSE_ENTRANCE_OBJECTS,
  houseRoofObjects: HOUSE_ROOF_OBJECTS,
  houseFacadeObjects: HOUSE_FACADE_OBJECTS,
  houseWallObjects: HOUSE_WALL_OBJECTS,
  houseDoorObjects: HOUSE_DOOR_OBJECTS,
  houseWindowObjects: HOUSE_WINDOW_OBJECTS,
  houseObjects: [...HOUSE_ROOF_OBJECTS, ...HOUSE_WALL_OBJECTS, ...HOUSE_ENTRANCE_OBJECTS, ...HOUSE_DOOR_OBJECTS],
  roofObjects: [374, 375, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 436, 437],
  buildingFrontObjects: [414, 415, 416, 444, 445, 446, 474, 475, 476],
  tentObjects: [389, 418, 419, 448, 449, 477, 478, 479],
  // 칩셋 실사(Combined Town / Exterior) — 사용자 비전 강제 지정:
  // - 가로 벤치 327|328 / 세로 의자 358(상)+388(하)
  // - 집 앞 마당: 349장작·350우편함·351화분·352항아리
  // - 묘지(집과 멀리): 323묘지·353묘비·383해골
  // - 탁자 가로 234|235*|236 / 세로 144/174*/204 (중간 무제한 연장)
  // - 탁자 옆 의자: 175(탁자 위·아래봄) 176(탁자 아래·위봄) 205(탁자 왼·오봄) 206(탁자 오른·왼봄)
  // - 147등받이 없음 148등받이 있음 / 202|203 과일박스 / 237 나무상자
  // - 116/146 나무문 / 322 벽 사다리(상위·통행가능) / 111|112*|113 돌계단
  // - 28 성 열린창 58 성 창 88 깨진 창조각 / 231 마법진
  // - 원형 타워(2칸 폭): 캡 upper 24|25, 목 lower 138|139, 몸 140|141, 창문 142|143, 베이스 upper 54|55
  benchObjects: [327, 328, 358, 388],
  benchHorizontalObjects: [327, 328],
  benchVerticalObjects: [358, 388],
  chairObjects: [147, 148, 175, 176, 205, 206],
  tableHorizontalObjects: [234, 235, 236],
  tableVerticalObjects: [144, 174, 204],
  tableObjects: [144, 174, 204, 234, 235, 236],
  houseYardObjects: [349, 350, 351, 352],
  cemeteryObjects: [323, 353, 383],
  wallLadderObjects: [322],
  fruitBoxObjects: [202, 203],
  woodBoxObjects: [237],
  woodDoorPairObjects: [116, 146],
  stoneStairObjects: [111, 112, 113],
  castleWindowObjects: [28, 58, 88],
  // 성 지붕·여장 면 (3×4) + 성벽 정면 (21/51/81) — map_castle_keep 실측 금본.
  castleRoofDeckObjects: [18, 19, 20, 48, 49, 50, 78, 79, 80, 108, 109, 110],
  castleWallFaceObjects: [21, 51, 81],
  // 원형 타워 조각 — 사용자 맵 (18,18)–(19,24) 실측 금본.
  castleRoundTowerCapObjects: [24, 25],
  castleRoundTowerNeckObjects: [138, 139],
  castleRoundTowerBodyObjects: [140, 141],
  castleRoundTowerWindowObjects: [142, 143],
  castleRoundTowerBaseObjects: [54, 55],
  castleRoundTowerObjects: [24, 25, 54, 55, 138, 139, 140, 141, 142, 143],
  magicCircleObjects: [231],
  // 2026-07-17 교정: 덩굴 정본은 265(V자)·295(대각) — 예전 목록(291=마른나무 하단,
  // 355=지붕 캡 등)은 오분류였다.
  vineObjects: [265, 295],
  signObjects: [319, 320],
  fireObjects: [318, 381],
  // 2026-07-16 사용자 교정: 382=우물(wellObjects로), 412=돌바닥 하위 지면 타일(소품 아님).
  // 441/442 바위는 412 돌바닥 패치 위에 섞어 쓴다. 이 가방은 해체됨.
  statueObjects: [],
  // 2026-07-16 칩셋 재조사 + 사용자 교정 반영.
  // 술통 177 + 오크통 207. 석상/돌기둥은 세로 2칸 페어: 266(상)+296(하), 267(상)+297(하).
  barrelObjects: [177, 207],
  plazaStatueObjects: [266, 296],
  plazaPillarObjects: [267, 297],
  // 우물(382) — 위에서 본 돌 우물 (2026-07-16 사용자 확정). 마을 광장 근처 단독 배치.
  wellObjects: [382],
  // 화려한 깃발 208/209 — 장터·중요한 집 입구의 벽면 장식.
  bannerObjects: [208, 209],
  // 마켓 공터 실측: 하단 가로 레일 468|469*|470, 가장자리 돌단/슬랩 268
  marketRailObjects: [468, 469, 470],
  marketRailHorizontalObjects: [468, 469, 470],
  stoneStepObjects: [268],
  // 411/443은 소품이 아니라 돌바닥 지면 텍스처(통행 가능) — 가방에서 제외 (2026-07-16, 돌마당 필드).
  // 2026-07-17 교정: 441/442 바위는 전역 밴(석상/기둥으로 대체), 318 횃불·320 벽보·
  // 472/473 간판은 "벽 전용"이라 지면 산포 가방에서 제외.
  smallObjects: [259, 319, 348, 349, 350, 351, 352, 440],
} as const;

export const CONFIRMED_CHIPSET_TILE_INDEXES = [
  ...CHIPSET_TILE_GROUPS.lakeWaterBody,
  ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames,
  ...CHIPSET_TILE_GROUPS.waterfallWater,
  ...CHIPSET_TILE_GROUPS.lakeShoreEdges,
  ...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames,
  ...CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames,
  240,
  241,
  270,
  271,
  300,
  301,
  330,
  331,
  ...CHIPSET_TILE_GROUPS.dirtRoadBody,
  ...CHIPSET_TILE_GROUPS.dirtRoadSideEdges,
  ...CHIPSET_TILE_GROUPS.dirtRoadCorners,
  ...CHIPSET_TILE_GROUPS.desertSandBody,
  ...CHIPSET_TILE_GROUPS.desertSandEdges,
  ...CHIPSET_TILE_GROUPS.woodBridgeBody,
  ...CHIPSET_TILE_GROUPS.woodFloorBody,
  ...CHIPSET_TILE_GROUPS.groundDetail,
  ...CHIPSET_TILE_GROUPS.darkWallBody,
  342,
  343,
  TILE.WALL,
  TILE.TREE,
  TILE.FLOWERS,
  ...CHIPSET_TILE_GROUPS.stakeObjects,
  ...CHIPSET_TILE_GROUPS.fenceObjects,
  ...CHIPSET_TILE_GROUPS.houseObjects,
  ...CHIPSET_TILE_GROUPS.houseWindowObjects,
  ...CHIPSET_TILE_GROUPS.woodStructureObjects,
  ...CHIPSET_TILE_GROUPS.timberPostStructureObjects,
  ...CHIPSET_TILE_GROUPS.roofObjects,
  ...CHIPSET_TILE_GROUPS.buildingFrontObjects,
  ...CHIPSET_TILE_GROUPS.tentObjects,
  ...CHIPSET_TILE_GROUPS.benchObjects,
  ...CHIPSET_TILE_GROUPS.chairObjects,
  ...CHIPSET_TILE_GROUPS.tableObjects,
  ...CHIPSET_TILE_GROUPS.houseYardObjects,
  ...CHIPSET_TILE_GROUPS.cemeteryObjects,
  ...CHIPSET_TILE_GROUPS.wallLadderObjects,
  ...CHIPSET_TILE_GROUPS.fruitBoxObjects,
  ...CHIPSET_TILE_GROUPS.woodBoxObjects,
  ...CHIPSET_TILE_GROUPS.woodDoorPairObjects,
  ...CHIPSET_TILE_GROUPS.stoneStairObjects,
  ...CHIPSET_TILE_GROUPS.castleWindowObjects,
  ...CHIPSET_TILE_GROUPS.castleRoofDeckObjects,
  ...CHIPSET_TILE_GROUPS.castleWallFaceObjects,
  ...CHIPSET_TILE_GROUPS.castleRoundTowerObjects,
  ...CHIPSET_TILE_GROUPS.magicCircleObjects,
  ...CHIPSET_TILE_GROUPS.vineObjects,
  ...CHIPSET_TILE_GROUPS.signObjects,
  ...CHIPSET_TILE_GROUPS.fireObjects,
  ...CHIPSET_TILE_GROUPS.statueObjects,
  ...CHIPSET_TILE_GROUPS.barrelObjects,
  ...CHIPSET_TILE_GROUPS.plazaStatueObjects,
  ...CHIPSET_TILE_GROUPS.plazaPillarObjects,
  ...CHIPSET_TILE_GROUPS.wellObjects,
  ...CHIPSET_TILE_GROUPS.bannerObjects,
  ...CHIPSET_TILE_GROUPS.smallObjects,
] as const;

const DIRT_TILES = [
  ...CHIPSET_TILE_GROUPS.dirtRoadBody,
  ...CHIPSET_TILE_GROUPS.dirtRoadVariants,
  ...CHIPSET_TILE_GROUPS.dirtRoadDetail,
  ...CHIPSET_TILE_GROUPS.dirtEdges,
] as const;

export function isWaterChipsetTile(index: number): boolean {
  return hasTile(CHIPSET_TILE_GROUPS.water, index);
}

export function isPropOverlayChipsetTile(index: number): boolean {
  if (isBuildingBaseChipsetTile(index)) return false;
  return (
    hasTile(CHIPSET_TILE_GROUPS.upperObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.treeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.flowerObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stakeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fenceObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.benchObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.chairObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.tableObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.houseYardObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.cemeteryObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.wallLadderObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fruitBoxObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodBoxObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.magicCircleObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.vineObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.signObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fireObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.statueObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.barrelObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.plazaStatueObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.plazaPillarObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.wellObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.houseWindowObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.castleWindowObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.tentObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.marketRailObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneStepObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.smallObjects, index)
  );
}

// 투명 픽셀을 가진 스프라이트형 칩(벤치·사선 지붕·나무 등). 하위 레이어에 깔리면
// 투명 부분 아래에 지형이 없어 검게 보이므로 상위 레이어 전용으로 취급한다.
const TRANSPARENT_CHIPSET_TILES = new Set<number>(COMBINED_TOWN_TRANSPARENT_TILES);

export function isTransparentChipsetTile(index: number): boolean {
  return TRANSPARENT_CHIPSET_TILES.has(index);
}

export function isUpperChipsetTile(index: number): boolean {
  return isPropOverlayChipsetTile(index) || isTransparentChipsetTile(index);
}

function isBuildingBaseChipsetTile(index: number): boolean {
  return (
    hasTile(CHIPSET_TILE_GROUPS.houseObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.timberPostStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.roofObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.buildingFrontObjects, index)
    // tentObjects 제외: 텐트는 잔디 위 상위 오버레이(하위면 지면을 지움 + 상위 팔레트에서 안 보임)
  );
}

export function isSolidChipsetTile(index: number): boolean {
  if (hasTile(CHIPSET_TILE_GROUPS.flowerObjects, index)) return false;
  // 벽 사다리(322): 집 벽 위 상위 오버레이, 플레이어 통과 가능.
  if (hasTile(CHIPSET_TILE_GROUPS.wallLadderObjects, index)) return false;
  if (hasTile(CHIPSET_TILE_GROUPS.magicCircleObjects, index)) return false;
  // 돌계단(111–113): RM2k3 층계 — 밟는 칩(○ + 4방향). 완전 차단(×) 아님.
  if (hasTile(CHIPSET_TILE_GROUPS.stoneStairObjects, index)) return false;
  return (
    isWaterChipsetTile(index) ||
    hasTile(CHIPSET_TILE_GROUPS.treeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodDoorPairObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.castleRoofDeckObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.castleWallFaceObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.castleRoundTowerObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.houseObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.roofObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.timberPostStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneWall, index) ||
    hasTile(CHIPSET_TILE_GROUPS.structureSolid, index) ||
    // 가구·잡화 소품: RM2k3 식으로 지나갈 수 없음 (꽃·마법진·사다리는 위에서 제외)
    hasTile(CHIPSET_TILE_GROUPS.tableObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.benchObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.chairObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodBoxObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fruitBoxObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.houseYardObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.cemeteryObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.signObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fireObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.statueObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.barrelObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.plazaStatueObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.plazaPillarObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.wellObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.tentObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fenceObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stakeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.marketRailObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneStepObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.upperObjects, index)
  );
}

/**
 * RM2k3 식 데크/절벽 가장자리 칩 — woodFloorBody 변형의 4방향 통행.
 * 본체 222는 전방향, 가장자리는 바깥 방향만 닫아 “층”을 흉내 낸다.
 */
export const RM2K3_WOOD_FLOOR_PASSABILITY = {
  body: 222,
  edgeWest: 228, // left 닫힘 — 데크 서측
  edgeEast: 229, // right 닫힘
  edgeNorth: 230, // up 닫힘
  edgeSouth: 192, // down 닫힘
} as const;

export function rm2k3WoodFloorPassFlag(tile: number): PassFlag | null {
  switch (tile) {
    case RM2K3_WOOD_FLOOR_PASSABILITY.body:
      return { up: true, down: true, left: true, right: true };
    case RM2K3_WOOD_FLOOR_PASSABILITY.edgeWest:
      return { up: true, down: true, left: false, right: true };
    case RM2K3_WOOD_FLOOR_PASSABILITY.edgeEast:
      return { up: true, down: true, left: true, right: false };
    case RM2K3_WOOD_FLOOR_PASSABILITY.edgeNorth:
      return { up: false, down: true, left: true, right: true };
    case RM2K3_WOOD_FLOOR_PASSABILITY.edgeSouth:
      return { up: true, down: false, left: true, right: true };
    default:
      return null;
  }
}

/**
 * 돌계단(111–113): 밟는 칩(○ 전방향).
 * 고상/절벽 분리는 데크 가장자리 4-dir이 담당 — 계단 자체를 상하 막으면
 * 도로(2칸 폭)에서 층계로 못 올라가고 층계 칸끼리도 못 움직인다.
 */
export function rm2k3StairPassFlag(): PassFlag {
  return { up: true, down: true, left: true, right: true };
}

export function terrainTagForChipsetTile(index: number): number {
  if (isWaterChipsetTile(index)) return TERRAIN_TAG.WATER;
  if (hasTile(CHIPSET_TILE_GROUPS.sandGround, index)) return TERRAIN_TAG.SAND;
  if (hasTile(CHIPSET_TILE_GROUPS.snowGround, index)) return TERRAIN_TAG.SNOW;
  if (hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index)) return TERRAIN_TAG.STONE;
  if (hasTile(CHIPSET_TILE_GROUPS.stoneGround, index)) return TERRAIN_TAG.STONE;
  return TERRAIN_TAG.NORMAL;
}

export function tileLabelForIndex(index: number): string {
  return tileSemanticForIndex(index).label;
}

export function tileAiLabelForIndex(index: number): string {
  return tileSemanticForIndex(index).aiLabel;
}

export function tileDisplayLabelForIndex(index: number): string {
  const semantic = tileSemanticForIndex(index);
  const label = koreanTileLabel(semantic.key, index);
  return `${index} ${label}`;
}

export function describeChipsetTile(index: number): ChipsetTileDescriptor {
  const semantic = tileSemanticForIndex(index);
  return {
    index,
    column: index % DEFAULT_TILES_PER_ROW,
    row: Math.floor(index / DEFAULT_TILES_PER_ROW),
    key: semantic.key,
    label: semantic.label,
    description: semantic.aiLabel,
    aiLabel: semantic.aiLabel,
    usage: semantic.usage,
    tags: semantic.tags,
    layer: isUpperChipsetTile(index) ? "upper" : "lower",
    passage: isSolidChipsetTile(index) ? "solid" : "passable",
    terrainTag: terrainTagForChipsetTile(index),
    repeatRole: repeatRoleForChipsetTile(index),
    confirmed: hasTile(CONFIRMED_CHIPSET_TILE_INDEXES, index),
  };
}

export function dirtLikeTiles(): readonly number[] {
  return DIRT_TILES;
}

function tileSemanticForIndex(index: number): TileSemantic {
  if (index === TILE.EMPTY) return semantic({ key: "empty", label: "Empty", aiLabel: "Empty tile: clears the selected map layer.", usage: "empty", tags: ["empty", "erase"] });
  // 사용자 비전 강제 지정(Combined Town 실사) — 그룹 휴리스틱보다 우선.
  const vision = visionTileSemantic(index);
  if (vision) return vision;
  if (hasTile(CHIPSET_TILE_GROUPS.woodBridgeBody, index)) return semantic({ key: "wood_bridge_body", label: "Wood bridge", aiLabel: "Wood bridge body: lower-layer walkable bridge surface for crossing water.", usage: "path", tags: ["wood", "bridge", "walkable", "water-crossing"] });
  if (index === 378) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence upper-left corner: use at the top-left of a fenced enclosure before horizontal rail 379.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "upper-left"] });
  if (index === 379) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence top/bottom horizontal rail: repeat this tile across the upper or lower run between fence corners or terminators.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "horizontal", "repeat-horizontal"] });
  if (index === 380) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence upper-right corner: use at the top-right of a fenced enclosure after horizontal rail 379.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "upper-right"] });
  if (index === 408) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence vertical rail: repeat this tile down the left or right side of a fenced enclosure.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "vertical", "repeat-vertical"] });
  if (index === 409) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence right-side lower terminator: use at the inner-left end of a lower-right fence run so it does not imply continuation further left.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "terminator", "right-side", "lower-run"] });
  if (index === 410) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence lower-right turn: use where the right vertical fence bends into the lower horizontal fence.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "lower-right"] });
  if (index === 438) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence lower-left turn: use where the left vertical fence bends into the lower horizontal fence.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "lower-left"] });
  if (index === 439) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence left-side lower terminator: use at the inner-right end of a lower-left fence run so it does not imply continuation further right.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "terminator", "left-side", "lower-run"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stakeObjects, index)) return semantic({ key: "stake_object", label: "Stake", aiLabel: "Stake object: upper-layer wooden post or palisade marker for fences and boundaries.", usage: "decoration", tags: ["stake", "post", "fence", "boundary", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames, index)) return semantic({ key: "lake_water_body", label: "Lake water", aiLabel: "Lake water body: lower-layer still, impassable pond, lake, or oasis interior tile with 3fps water animation.", usage: "terrain", tags: ["lake", "still-water", "pond", "oasis", "body", "animation-frame", "impassable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames, index)) return semantic({ key: "lake_shore_edge", label: "Lake shore", aiLabel: "Lake shore edge: lower-layer bank transition for still water beside grass or sand with 3fps water animation.", usage: "edge", tags: ["lake", "shore", "edge", "bank", "still-water", "animation-frame", "impassable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames, index)) return semantic({ key: "waterfall_water", label: "Waterfall", aiLabel: "Waterfall water: lower-layer vertical flowing water tile for cliffs with 3fps animation, not a lake surface.", usage: "terrain", tags: ["waterfall", "flowing-water", "cliff", "animation-frame", "impassable"] });
  if (isWaterChipsetTile(index)) return semantic({ key: "water_surface", label: "Water", aiLabel: "Water surface: lower-layer impassable lake or river tile.", usage: "terrain", tags: ["water", "lake", "river", "impassable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.snowGround, index)) return semantic({ key: "snow_ground", label: "Snow", aiLabel: "Snow ground: lower-layer cold terrain surface.", usage: "terrain", tags: ["snow", "ground", "cold"] });
  if (hasTile(CHIPSET_TILE_GROUPS.tallGrass, index)) return semantic({ key: "tall_grass", label: "Tall grass", aiLabel: "Tall grass: lower-layer walkable dark-grass band that symbolizes a Pokémon-style encounter/route thicket. Passable like normal grass; encounters are wired separately via hunting ground / encounter table, never on the tile itself.", usage: "terrain", tags: ["tall-grass", "dark-grass", "grass", "encounter", "route", "pokemon", "walkable", "outdoor"] });
  if (hasTile(CHIPSET_TILE_GROUPS.grassGround, index)) return semantic({ key: "grass_ground", label: "Grass", aiLabel: "Grass ground: lower-layer walkable outdoor base terrain.", usage: "terrain", tags: ["grass", "ground", "walkable", "outdoor"] });
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadBody, index)) return semantic({ key: "dirt_road_body", label: "Dirt road", aiLabel: "Dirt road body: lower-layer walkable road center tile.", usage: "path", tags: ["dirt", "road", "walkable", "body"] });
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadDetail, index)) return semantic({ key: "dirt_road_detail", label: "Dirt detail", aiLabel: "Dirt detail: small lower-layer road variation or ground accent.", usage: "detail", tags: ["dirt", "detail", "variation"] });
  if (index === DIRT_ROAD_TILE.EDGE_NORTH) return semantic({ key: "dirt_road_edge_north", label: "Dirt edge", aiLabel: "Dirt road north edge: use along the top border of a road mass after all connected road rectangles are merged.", usage: "edge", tags: ["dirt", "road", "edge", "north", "autotile"] });
  if (index === DIRT_ROAD_TILE.EDGE_SOUTH) return semantic({ key: "dirt_road_edge_south", label: "Dirt edge", aiLabel: "Dirt road south edge: use along the bottom border of a road mass after all connected road rectangles are merged.", usage: "edge", tags: ["dirt", "road", "edge", "south", "autotile"] });
  if (index === DIRT_ROAD_TILE.EDGE_WEST) return semantic({ key: "dirt_road_edge_west", label: "Dirt edge", aiLabel: "Dirt road west edge: use along the left border of a road mass, including vertical branch sides.", usage: "edge", tags: ["dirt", "road", "edge", "west", "autotile"] });
  if (index === DIRT_ROAD_TILE.EDGE_EAST) return semantic({ key: "dirt_road_edge_east", label: "Dirt edge", aiLabel: "Dirt road east edge: use along the right border of a road mass, including vertical branch sides.", usage: "edge", tags: ["dirt", "road", "edge", "east", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_NORTH_WEST) return semantic({ key: "dirt_road_corner_north_west", label: "Dirt corner", aiLabel: "Dirt road outer north-west corner: use only where both north and west neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "north-west", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_NORTH_EAST) return semantic({ key: "dirt_road_corner_north_east", label: "Dirt corner", aiLabel: "Dirt road outer north-east corner: use only where both north and east neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "north-east", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_SOUTH_WEST) return semantic({ key: "dirt_road_corner_south_west", label: "Dirt corner", aiLabel: "Dirt road outer south-west corner: use only where both south and west neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "south-west", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_SOUTH_EAST) return semantic({ key: "dirt_road_corner_south_east", label: "Dirt corner", aiLabel: "Dirt road outer south-east corner: use only where both south and east neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "south-east", "autotile"] });
  if (hasTile(CHIPSET_TILE_GROUPS.dirtEdges, index)) return semantic({ key: "dirt_road_edge", label: "Dirt edge", aiLabel: "Dirt road edge: lower-layer border or corner for shaped road transitions.", usage: "edge", tags: ["dirt", "road", "edge", "autotile"] });
  if (hasTile(CHIPSET_TILE_GROUPS.desertSandBody, index)) return semantic({ key: "desert_sand_body", label: "Desert sand", aiLabel: "Desert sand body: lower-layer walkable dry terrain interior tile.", usage: "terrain", tags: ["desert", "sand", "dry", "walkable", "body"] });
  if (hasTile(CHIPSET_TILE_GROUPS.desertSandEdges, index)) return semantic({ key: "desert_sand_edge", label: "Desert edge", aiLabel: "Desert sand edge: lower-layer border or corner for dry terrain transitions.", usage: "edge", tags: ["desert", "sand", "edge", "autotile"] });
  if (hasTile(CHIPSET_TILE_GROUPS.sandGround, index)) return semantic({ key: "sand_ground", label: "Sand", aiLabel: "Sand terrain: lower-layer beach, plaza, or desert tile.", usage: "terrain", tags: ["sand", "beach", "plaza", "desert"] });
  if (hasTile(CHIPSET_TILE_GROUPS.woodFloorBody, index)) return semantic({ key: "wood_floor_body", label: "Wood floor", aiLabel: "Wood floor body: lower-layer plank or pier surface.", usage: "path", tags: ["wood", "floor", "plank", "walkable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.groundDetail, index)) return semantic({ key: "ground_detail", label: "Ground detail", aiLabel: "Ground detail: lower-layer rubble, flowers, moss, or terrain accent.", usage: "detail", tags: ["ground", "detail", "rubble", "accent"] });
  if (hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index)) return semantic({ key: "dark_wall_body", label: "Dark wall", aiLabel: "Dark wall body: solid lower-layer cave, cliff, or deep masonry boundary.", usage: "structure", tags: ["dark", "wall", "solid", "cave"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stoneGround, index)) return semantic({ key: "stone_floor", label: "Stone floor", aiLabel: "Stone floor: lower-layer town, ruin, or paved surface.", usage: "structure", tags: ["stone", "floor", "paved", "town"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stoneWall, index)) return semantic({ key: "stone_wall", label: "Castle wall top", aiLabel: "Castle wall top / battlement: lower-layer stone castle-wall surface, parapet, or rampart-walk component. Prefer Korean labels like 성벽 상단, 성곽 위, 여장, or 성벽 보행로 instead of generic 돌담.", usage: "structure", tags: ["stone", "castle", "wall", "battlement", "parapet", "rampart", "castle-wall", "structure"] });
  if (hasTile(CHIPSET_TILE_GROUPS.housePurpleStoneWallObjects, index)) return semantic({ key: "house_purple_stone_wall_object", label: "House purple stone wall", aiLabel: "House purple stone wall: upper-layer exterior home wall panel with timber beams and purple stone infill.", usage: "structure", tags: ["house", "wall", "purple-stone", "timber", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallUpperObjects, index)) return semantic({ key: "house_white_wall_upper_object", label: "House white wall upper", aiLabel: "House white wall upper: top row of the cream-white house wall; repeat tile 16 horizontally between left cap 15 and right cap 17.", usage: "structure", tags: ["house", "wall", "white", "cream", "upper-wall", "facade", "upper", ...whiteWallColumnTags(index)] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallBodyObjects, index)) return semantic({ key: "house_white_wall_body_object", label: "House white wall body", aiLabel: "House white wall body: middle cream-white exterior wall row; repeat tile 46 horizontally between left cap 45 and right cap 47.", usage: "structure", tags: ["house", "wall", "white", "cream", "body", "facade", "upper", ...whiteWallColumnTags(index)] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallLowerObjects, index)) return semantic({ key: "house_white_wall_lower_object", label: "House white wall lower", aiLabel: "House white wall lower: bottom cream-white exterior wall row; repeat tile 76 horizontally between left cap 75 and right cap 77.", usage: "structure", tags: ["house", "wall", "white", "cream", "lower-wall", "facade", "upper", ...whiteWallColumnTags(index)] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWoodWallUpperObjects, index)) return semantic({ key: "house_wood_wall_upper_object", label: "House wood wall upper", aiLabel: "House wood wall upper: top row of the wooden house wall; use tiles 102, 103, and 104 as the upper row.", usage: "structure", tags: ["house", "wood", "wall", "upper-wall", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWoodWallBodyObjects, index)) return semantic({ key: "house_wood_wall_body_object", label: "House wood wall body", aiLabel: "House wood wall body: middle row of the wooden house wall; use tiles 132, 133, and 134 below the upper row.", usage: "structure", tags: ["house", "wood", "wall", "body", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWoodWallLowerObjects, index)) return semantic({ key: "house_wood_wall_lower_object", label: "House wood wall lower", aiLabel: "House wood wall lower: bottom row of the wooden house wall; use tiles 162, 163, and 164 below the body row.", usage: "structure", tags: ["house", "wood", "wall", "lower-wall", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.woodStructureObjects, index)) return semantic({ key: "wood_structure_object", label: "Wood structure", aiLabel: "Wood structure piece: upper-layer wooden building component; inspect its neighbors before use because this is not a repeatable house wall.", usage: "structure", tags: ["wood", "structure", "beam", "plank", "needs-manual-composition", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.timberPostStructureObjects, index)) return semantic({ key: "timber_post_structure_object", label: "Timber post structure", aiLabel: "Timber post structure piece: upper-layer post, plaster, or wood component; use only in a hand-mapped composition, not as a standalone house wall.", usage: "structure", tags: ["timber", "post", "structure", "needs-manual-composition", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseEntranceUpperObjects, index)) return semantic({ key: "house_entrance_upper_object", label: "House entrance upper", aiLabel: "House entrance upper: top half of a two-tile vertical house entrance; place tile 329 directly above tile 359.", usage: "structure", tags: ["house", "entrance", "doorway", "upper-half", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseEntranceLowerObjects, index)) return semantic({ key: "house_entrance_lower_object", label: "House entrance lower", aiLabel: "House entrance lower: bottom half of a two-tile vertical house entrance; place tile 359 directly below tile 329.", usage: "structure", tags: ["house", "entrance", "doorway", "lower-half", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseRoofObjects, index)) return semantic({ key: "house_roof_object", label: "House roof", aiLabel: "House roof object: upper-layer exterior home roof section for AI-composed village houses.", usage: "structure", tags: ["house", "roof", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseFacadeObjects, index)) return semantic({ key: "house_facade_object", label: "House facade", aiLabel: "House facade object: upper-layer exterior home front wall, window, or roof-facing section paired with the red or blue roof tiles.", usage: "structure", tags: ["house", "wall", "facade", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseDoorObjects, index)) return semantic({ key: "house_door_object", label: "House door", aiLabel: "House door object: upper-layer exterior home entrance or base section for AI-composed village houses.", usage: "structure", tags: ["house", "door", "entrance", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWindowObjects, index)) return semantic({ key: "house_window_object", label: "House window", aiLabel: "House window object: upper-layer exterior window placed on top of a house wall tile, not a lower terrain tile.", usage: "structure", tags: ["house", "window", "facade", "upper", "overlay"] });
  if (hasTile(CHIPSET_TILE_GROUPS.roofObjects, index)) return semantic({ key: "roof_object", label: "Roof", aiLabel: "Roof object: upper-layer house or tent roof section for exterior buildings.", usage: "structure", tags: ["roof", "building", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.buildingFrontObjects, index)) return semantic({ key: "building_front_object", label: "Building front", aiLabel: "Building front object: upper-layer facade, door, or wall face for exterior buildings.", usage: "structure", tags: ["building", "facade", "door", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.tentObjects, index)) return semantic({ key: "tent_object", label: "Tent", aiLabel: "Tent object: upper-layer shelter or campsite structure.", usage: "structure", tags: ["tent", "shelter", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.benchObjects, index)) return semantic({ key: "bench_object", label: "Bench", aiLabel: "Bench object: upper-layer village furniture decoration.", usage: "decoration", tags: ["bench", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.chairObjects, index)) return semantic({ key: "chair_object", label: "Chair", aiLabel: "Chair object: upper-layer seat furniture.", usage: "decoration", tags: ["chair", "furniture", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.tableObjects, index)) return semantic({ key: "table_object", label: "Table", aiLabel: "Table object: upper-layer table furniture; middle tiles can stretch.", usage: "decoration", tags: ["table", "furniture", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseYardObjects, index)) return semantic({ key: "house_yard_object", label: "House-yard prop", aiLabel: "House-yard prop: place in front of houses (firewood, mailbox, pot, jar).", usage: "decoration", tags: ["house-yard", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.cemeteryObjects, index)) return semantic({ key: "cemetery_object", label: "Cemetery", aiLabel: "Cemetery prop: keep far from houses (grave, headstone, skeleton).", usage: "decoration", tags: ["cemetery", "grave", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.wallLadderObjects, index)) return semantic({ key: "wall_ladder_object", label: "Wall ladder", aiLabel: "Wall ladder: upper-layer passable overlay on house walls.", usage: "decoration", tags: ["ladder", "wall", "passable", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.fruitBoxObjects, index)) return semantic({ key: "fruit_box_object", label: "Fruit box", aiLabel: "Fruit crate pair: left 202 + right 203.", usage: "decoration", tags: ["crate", "fruit", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.woodBoxObjects, index)) return semantic({ key: "wood_box_object", label: "Wood box", aiLabel: "Wooden box prop (237).", usage: "decoration", tags: ["box", "crate", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.marketRailObjects, index)) {
    if (index === 468) {
      return semantic({
        key: "market_rail_object",
        label: "Market rail left",
        aiLabel: "Market/deck upper rail left cap (468). Pair with stretch mid 469 and right 470. Solid upper barrier.",
        usage: "decoration",
        tags: ["rail", "fence", "market", "horizontal", "left", "upper", "solid"],
      });
    }
    if (index === 469) {
      return semantic({
        key: "market_rail_object",
        label: "Market rail mid",
        aiLabel: "Market/deck upper rail middle (469). Stretch unlimited between left 468 and right 470. Solid upper barrier.",
        usage: "decoration",
        tags: ["rail", "fence", "market", "horizontal", "body", "stretch", "upper", "solid"],
      });
    }
    return semantic({
      key: "market_rail_object",
      label: "Market rail right",
      aiLabel: "Market/deck upper rail right cap (470). After stretch mid 469. Solid upper barrier.",
      usage: "decoration",
      tags: ["rail", "fence", "market", "horizontal", "right", "upper", "solid"],
    });
  }
  if (hasTile(CHIPSET_TILE_GROUPS.stoneStepObjects, index)) {
    return semantic({
      key: "stone_step_object",
      label: "Stone step slab",
      aiLabel: "Stone step/slab prop (268): upper-layer solid block used as a short step, curb, or market edge accent (map_market_reference gold).",
      usage: "decoration",
      tags: ["stone", "step", "slab", "curb", "market", "upper", "solid"],
    });
  }
  if (hasTile(CHIPSET_TILE_GROUPS.woodDoorPairObjects, index)) return semantic({ key: "wood_door_object", label: "Wood door", aiLabel: "Wooden door pair: top 116 above bottom 146.", usage: "structure", tags: ["door", "wood", "building"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stoneStairObjects, index)) return semantic({ key: "stone_stair_object", label: "Stone stairs", aiLabel: "Stone stair strip: left 111, stretchable center 112, right 113.", usage: "structure", tags: ["stairs", "stone", "repeat-horizontal"] });
  if (hasTile(CHIPSET_TILE_GROUPS.castleWindowObjects, index)) return semantic({ key: "castle_window_object", label: "Castle window", aiLabel: "Castle window variant (open/closed/broken).", usage: "structure", tags: ["window", "castle"] });
  if (hasTile(CHIPSET_TILE_GROUPS.castleRoofDeckObjects, index)) {
    return semantic({
      key: "castle_roof_object",
      label: "Castle roof deck",
      aiLabel: "Castle roof/battlement deck tile (18–110 block). Paint as a rectangle: corners 18/20/108/110, edges 19/109/48|78, fill 49|79|50|80.",
      usage: "structure",
      tags: ["castle", "roof", "battlement", "deck"],
    });
  }
  if (hasTile(CHIPSET_TILE_GROUPS.castleWallFaceObjects, index)) {
    return semantic({
      key: "castle_wall_face_object",
      label: "Castle wall face",
      aiLabel: "Castle wall face column: top 21, stretch mid 51, bottom 81. Place under roof-deck south edge or as curtain wall.",
      usage: "structure",
      tags: ["castle", "wall", "face"],
    });
  }
  if (hasTile(CHIPSET_TILE_GROUPS.castleRoundTowerObjects, index)) {
    return semantic({
      key: "castle_round_tower_object",
      label: "Castle round tower",
      aiLabel: "Castle round tower piece: 2-wide vertical (cap 24|25 upper, neck 138|139, body 140|141, windows 142|143, base 54|55 upper).",
      usage: "structure",
      tags: ["castle", "round-tower", "tower", "structure"],
    });
  }
  if (hasTile(CHIPSET_TILE_GROUPS.magicCircleObjects, index)) return semantic({ key: "magic_circle_object", label: "Magic circle", aiLabel: "Magic circle decoration (231), passable upper.", usage: "decoration", tags: ["magic", "ritual", "passable", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.vineObjects, index)) return semantic({ key: "vine_object", label: "Vines", aiLabel: "Vine object: upper-layer organic wall or ruin decoration.", usage: "decoration", tags: ["vine", "nature", "ruin", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.signObjects, index)) return semantic({ key: "sign_object", label: "Sign", aiLabel: "Sign object: upper-layer signpost or readable map marker.", usage: "decoration", tags: ["sign", "marker", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.fireObjects, index)) return semantic({ key: "fire_object", label: "Fire", aiLabel: "Fire object: upper-layer torch or campfire decoration.", usage: "decoration", tags: ["fire", "torch", "campfire", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.statueObjects, index)) return semantic({ key: "statue_object", label: "Statue", aiLabel: "Statue object: upper-layer monument or ruin decoration.", usage: "decoration", tags: ["statue", "monument", "ruin", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.treeObjects, index)) return semantic({ key: "tree_object", label: "Tree", aiLabel: "Tree object: upper-layer forest canopy or trunk part.", usage: "decoration", tags: ["tree", "forest", "solid", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.flowerObjects, index)) return semantic({ key: "flower_object", label: "Flowers", aiLabel: "Flowers object: upper-layer small passable nature decoration.", usage: "decoration", tags: ["flower", "nature", "passable", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.upperObjects, index)) return semantic({ key: "generic_object", label: "Object", aiLabel: "Generic upper-layer exterior object; inspect visually before procedural use.", usage: "decoration", tags: ["object", "upper", "unclassified"] });
  return semantic({ key: `tile_${index}`, label: `Tile ${index}`, aiLabel: `Unmapped chipset tile ${index}: needs manual classification before AI placement.`, usage: "unknown", tags: ["unmapped"] });
}

/** Combined Town 실사 비전 강제 라벨 — 오분류 방지. */
function visionTileSemantic(index: number): TileSemantic | null {
  switch (index) {
    case 327:
      return semantic({ key: "bench_object", label: "Bench left", aiLabel: "Horizontal bench left half (327). Pair right with 328.", usage: "decoration", tags: ["bench", "horizontal", "left", "village", "upper"] });
    case 328:
      return semantic({ key: "bench_object", label: "Bench right", aiLabel: "Horizontal bench right half (328). Pair left with 327.", usage: "decoration", tags: ["bench", "horizontal", "right", "village", "upper"] });
    case 358:
      return semantic({ key: "bench_object", label: "Chair vertical top", aiLabel: "Vertical chair/bench top (358). Must sit directly above 388.", usage: "decoration", tags: ["bench", "chair", "vertical", "top", "village", "upper"] });
    case 388:
      return semantic({ key: "bench_object", label: "Chair vertical bottom", aiLabel: "Vertical chair/bench bottom (388). Must sit directly below 358.", usage: "decoration", tags: ["bench", "chair", "vertical", "bottom", "village", "upper"] });
    case 349:
      return semantic({ key: "house_yard_object", label: "Firewood pile", aiLabel: "Firewood pile (349). Place in front of houses.", usage: "decoration", tags: ["firewood", "house-yard", "village", "upper"] });
    case 350:
      return semantic({ key: "house_yard_object", label: "Mailbox", aiLabel: "Mailbox (350). Place in front of houses.", usage: "decoration", tags: ["mailbox", "house-yard", "village", "upper"] });
    case 351:
      return semantic({ key: "house_yard_object", label: "Flower pot", aiLabel: "Flower pot (351). Place in front of houses.", usage: "decoration", tags: ["pot", "flower-pot", "house-yard", "village", "upper"] });
    case 352:
      return semantic({ key: "house_yard_object", label: "Jar", aiLabel: "Storage jar (352). Place in front of houses.", usage: "decoration", tags: ["jar", "pot", "house-yard", "village", "upper"] });
    case 353:
      return semantic({ key: "cemetery_object", label: "Gravestone", aiLabel: "Gravestone (353). Keep far from houses in a cemetery area.", usage: "decoration", tags: ["gravestone", "cemetery", "grave", "upper"] });
    case 323:
      return semantic({ key: "cemetery_object", label: "Cemetery marker", aiLabel: "Cemetery/graveyard marker (323). Keep far from houses.", usage: "decoration", tags: ["cemetery", "grave", "upper"] });
    case 383:
      return semantic({ key: "cemetery_object", label: "Skeleton", aiLabel: "Skeleton remains (383). Cemetery/ruin prop — not a statue.", usage: "decoration", tags: ["skeleton", "cemetery", "ruin", "upper"] });
    case 322:
      return semantic({ key: "wall_ladder_object", label: "Wall ladder", aiLabel: "Wall ladder (322): upper-layer on house wall; player can walk through.", usage: "decoration", tags: ["ladder", "wall", "passable", "upper"] });
    case 175:
      return semantic({ key: "chair_object", label: "Chair face down", aiLabel: "Chair facing down (175). Place on the north/top side of a table.", usage: "decoration", tags: ["chair", "face-down", "table-north", "furniture", "upper"] });
    case 176:
      return semantic({ key: "chair_object", label: "Chair face up", aiLabel: "Chair facing up (176). Place on the south/bottom side of a table.", usage: "decoration", tags: ["chair", "face-up", "table-south", "furniture", "upper"] });
    case 205:
      return semantic({ key: "chair_object", label: "Chair face right", aiLabel: "Chair facing right (205). Place on the west/left side of a table.", usage: "decoration", tags: ["chair", "face-right", "table-west", "furniture", "upper"] });
    case 206:
      return semantic({ key: "chair_object", label: "Chair face left", aiLabel: "Chair facing left (206). Place on the east/right side of a table.", usage: "decoration", tags: ["chair", "face-left", "table-east", "furniture", "upper"] });
    case 147:
      return semantic({ key: "chair_object", label: "Stool", aiLabel: "Backless chair/stool (147).", usage: "decoration", tags: ["chair", "stool", "furniture", "upper"] });
    case 148:
      return semantic({ key: "chair_object", label: "Chair with back", aiLabel: "Chair with backrest (148).", usage: "decoration", tags: ["chair", "backrest", "furniture", "upper"] });
    case 144:
      return semantic({ key: "table_object", label: "Table vertical top", aiLabel: "Vertical table top (144). Above stretch body 174 and bottom 204.", usage: "decoration", tags: ["table", "vertical", "top", "furniture", "upper"] });
    case 174:
      return semantic({ key: "table_object", label: "Table vertical mid", aiLabel: "Vertical table middle (174). May stretch unlimited between 144 and 204.", usage: "decoration", tags: ["table", "vertical", "body", "stretch", "furniture", "upper"] });
    case 204:
      return semantic({ key: "table_object", label: "Table vertical bottom", aiLabel: "Vertical table bottom (204). Below stretch body 174.", usage: "decoration", tags: ["table", "vertical", "bottom", "furniture", "upper"] });
    case 234:
      return semantic({ key: "table_object", label: "Table horizontal left", aiLabel: "Horizontal table left (234). Pair with stretch mid 235 and right 236.", usage: "decoration", tags: ["table", "horizontal", "left", "furniture", "upper"] });
    case 235:
      return semantic({ key: "table_object", label: "Table horizontal mid", aiLabel: "Horizontal table middle (235). May stretch unlimited between 234 and 236.", usage: "decoration", tags: ["table", "horizontal", "body", "stretch", "furniture", "upper"] });
    case 236:
      return semantic({ key: "table_object", label: "Table horizontal right", aiLabel: "Horizontal table right (236). After stretch mid 235.", usage: "decoration", tags: ["table", "horizontal", "right", "furniture", "upper"] });
    case 237:
      return semantic({ key: "wood_box_object", label: "Wood box", aiLabel: "Wooden box (237).", usage: "decoration", tags: ["box", "crate", "upper"] });
    case 202:
      return semantic({ key: "fruit_box_object", label: "Fruit box left", aiLabel: "Fruit crate left (202). Pair right with 203.", usage: "decoration", tags: ["crate", "fruit", "left", "upper"] });
    case 203:
      return semantic({ key: "fruit_box_object", label: "Fruit box right", aiLabel: "Fruit crate right (203). Pair left with 202.", usage: "decoration", tags: ["crate", "fruit", "right", "upper"] });
    case 116:
      return semantic({ key: "wood_door_object", label: "Wood door top", aiLabel: "Wooden door top (116). Place directly above 146.", usage: "structure", tags: ["door", "wood", "top", "building"] });
    case 146:
      return semantic({ key: "wood_door_object", label: "Wood door bottom", aiLabel: "Wooden door bottom (146). Place directly below 116.", usage: "structure", tags: ["door", "wood", "bottom", "building"] });
    case 111:
      return semantic({ key: "stone_stair_object", label: "Stone stair left", aiLabel: "Stone stairs left cap (111). Center 112 may stretch; right is 113.", usage: "structure", tags: ["stairs", "stone", "left"] });
    case 112:
      return semantic({ key: "stone_stair_object", label: "Stone stair mid", aiLabel: "Stone stairs center (112). May stretch unlimited between 111 and 113.", usage: "structure", tags: ["stairs", "stone", "body", "stretch"] });
    case 113:
      return semantic({ key: "stone_stair_object", label: "Stone stair right", aiLabel: "Stone stairs right cap (113).", usage: "structure", tags: ["stairs", "stone", "right"] });
    case 28:
      return semantic({ key: "castle_window_object", label: "Castle open window", aiLabel: "Castle open window (28).", usage: "structure", tags: ["window", "castle", "open"] });
    case 58:
      return semantic({ key: "castle_window_object", label: "Castle window", aiLabel: "Castle window (58).", usage: "structure", tags: ["window", "castle"] });
    case 88:
      return semantic({ key: "castle_window_object", label: "Broken window shard", aiLabel: "Broken window shard (88).", usage: "structure", tags: ["window", "broken", "castle"] });
    case 231:
      return semantic({ key: "magic_circle_object", label: "Magic circle", aiLabel: "Magic circle (231), passable decoration.", usage: "decoration", tags: ["magic", "ritual", "passable", "upper"] });
    // Combined Town 성 지붕·여장 면 + 성벽 정면 (사용자 비전 18~110)
    case 18:
      return semantic({ key: "castle_roof_object", label: "Castle roof NW", aiLabel: "Castle roof/battlement top-left corner (18).", usage: "structure", tags: ["castle", "roof", "battlement", "corner", "top-left"] });
    case 19:
      return semantic({ key: "castle_roof_object", label: "Castle roof N", aiLabel: "Castle roof/battlement top edge (19); stretch horizontally between 18 and 20.", usage: "structure", tags: ["castle", "roof", "battlement", "top", "stretch"] });
    case 20:
      return semantic({ key: "castle_roof_object", label: "Castle roof NE", aiLabel: "Castle roof/battlement top-right corner (20).", usage: "structure", tags: ["castle", "roof", "battlement", "corner", "top-right"] });
    case 21:
      return semantic({ key: "castle_wall_face_object", label: "Castle wall top", aiLabel: "Castle wall face top row (21); repeat horizontally under battlements.", usage: "structure", tags: ["castle", "wall", "face", "top", "stretch"] });
    case 48:
      return semantic({ key: "castle_roof_object", label: "Castle roof W", aiLabel: "Castle roof left edge (48); stretch vertically.", usage: "structure", tags: ["castle", "roof", "left", "stretch"] });
    case 49:
      return semantic({ key: "castle_roof_object", label: "Castle roof floor light", aiLabel: "Castle roof/battlement light gray floor fill (49).", usage: "structure", tags: ["castle", "roof", "floor", "light"] });
    case 50:
      return semantic({ key: "castle_roof_object", label: "Castle roof body", aiLabel: "Castle roof body (50); expand for large roof decks.", usage: "structure", tags: ["castle", "roof", "body", "stretch"] });
    case 51:
      return semantic({ key: "castle_wall_face_object", label: "Castle wall mid", aiLabel: "Castle wall face middle (51); stretch between top 21 and bottom 81.", usage: "structure", tags: ["castle", "wall", "face", "body", "stretch"] });
    case 78:
      return semantic({ key: "castle_roof_object", label: "Castle roof W lower", aiLabel: "Castle roof left edge lower segment (78).", usage: "structure", tags: ["castle", "roof", "left"] });
    case 79:
      return semantic({ key: "castle_roof_object", label: "Castle roof floor dark", aiLabel: "Castle roof/battlement dark gray floor fill (79).", usage: "structure", tags: ["castle", "roof", "floor", "dark"] });
    case 80:
      return semantic({ key: "castle_roof_object", label: "Castle roof body lower", aiLabel: "Castle roof lower body (80).", usage: "structure", tags: ["castle", "roof", "body"] });
    case 81:
      return semantic({ key: "castle_wall_face_object", label: "Castle wall bottom", aiLabel: "Castle wall face bottom row (81); ground contact.", usage: "structure", tags: ["castle", "wall", "face", "bottom", "stretch"] });
    case 108:
      return semantic({ key: "castle_roof_object", label: "Castle roof SW", aiLabel: "Castle roof bottom-left corner (108).", usage: "structure", tags: ["castle", "roof", "corner", "bottom-left"] });
    case 109:
      return semantic({ key: "castle_roof_object", label: "Castle roof S", aiLabel: "Castle roof bottom edge (109); stretch between 108 and 110.", usage: "structure", tags: ["castle", "roof", "bottom", "stretch"] });
    case 110:
      return semantic({ key: "castle_roof_object", label: "Castle roof SE", aiLabel: "Castle roof bottom-right corner (110).", usage: "structure", tags: ["castle", "roof", "corner", "bottom-right"] });
    // 원형 타워(2칸 폭) — map_castle_keep (18,18)–(19,24) 실측
    case 24:
      return semantic({ key: "castle_round_tower_object", label: "Round tower cap L", aiLabel: "Round tower roof/cap left (24). Upper layer; pair right with 25.", usage: "structure", tags: ["castle", "round-tower", "cap", "left", "upper"] });
    case 25:
      return semantic({ key: "castle_round_tower_object", label: "Round tower cap R", aiLabel: "Round tower roof/cap right (25). Upper layer; pair left with 24.", usage: "structure", tags: ["castle", "round-tower", "cap", "right", "upper"] });
    case 54:
      return semantic({ key: "castle_round_tower_object", label: "Round tower base L", aiLabel: "Round tower base left (54). Upper layer; pair right with 55; place under body column.", usage: "structure", tags: ["castle", "round-tower", "base", "left", "upper"] });
    case 55:
      return semantic({ key: "castle_round_tower_object", label: "Round tower base R", aiLabel: "Round tower base right (55). Upper layer; pair left with 54.", usage: "structure", tags: ["castle", "round-tower", "base", "right", "upper"] });
    case 138:
      return semantic({ key: "castle_round_tower_object", label: "Round tower neck L", aiLabel: "Round tower neck/top body left (138). Lower solid; pair right with 139; sits under cap 24.", usage: "structure", tags: ["castle", "round-tower", "neck", "left", "lower", "solid"] });
    case 139:
      return semantic({ key: "castle_round_tower_object", label: "Round tower neck R", aiLabel: "Round tower neck/top body right (139). Lower solid; pair left with 138; sits under cap 25.", usage: "structure", tags: ["castle", "round-tower", "neck", "right", "lower", "solid"] });
    case 140:
      return semantic({ key: "castle_round_tower_object", label: "Round tower body L", aiLabel: "Round tower body left (140). Lower solid; may stretch vertically; pair right with 141.", usage: "structure", tags: ["castle", "round-tower", "body", "left", "stretch", "lower", "solid"] });
    case 141:
      return semantic({ key: "castle_round_tower_object", label: "Round tower body R", aiLabel: "Round tower body right (141). Lower solid; may stretch vertically; pair left with 140.", usage: "structure", tags: ["castle", "round-tower", "body", "right", "stretch", "lower", "solid"] });
    case 142:
      return semantic({ key: "castle_round_tower_object", label: "Round tower window L", aiLabel: "Round tower window left (142). Lower solid window row; pair right with 143; insert into body stretch.", usage: "structure", tags: ["castle", "round-tower", "window", "left", "lower", "solid"] });
    case 143:
      return semantic({ key: "castle_round_tower_object", label: "Round tower window R", aiLabel: "Round tower window right (143). Lower solid window row; pair left with 142; the round tower's window pair.", usage: "structure", tags: ["castle", "round-tower", "window", "right", "lower", "solid"] });
    default:
      return null;
  }
}

function semantic(definition: TileSemantic): TileSemantic {
  return definition;
}

function koreanTileLabel(key: string, index: number): string {
  const visionKo: Record<number, string> = {
    327: "벤치 좌",
    328: "벤치 우",
    358: "세로 의자 상",
    388: "세로 의자 하",
    349: "장작 더미",
    350: "우편함",
    351: "화분",
    352: "항아리",
    353: "묘비",
    323: "묘지",
    383: "해골",
    322: "벽 사다리",
    175: "의자(아래 봄)",
    176: "의자(위 봄)",
    205: "의자(오른쪽 봄)",
    206: "의자(왼쪽 봄)",
    147: "의자(등받이 없음)",
    148: "의자(등받이 있음)",
    144: "세로 탁자 상",
    174: "세로 탁자 중",
    204: "세로 탁자 하",
    234: "가로 탁자 좌",
    235: "가로 탁자 중",
    236: "가로 탁자 우",
    237: "나무 상자",
    268: "돌단/석판",
    468: "장터 레일 좌",
    469: "장터 레일 중",
    470: "장터 레일 우",
    202: "과일박스 좌",
    203: "과일박스 우",
    116: "나무 문 상",
    146: "나무 문 하",
    111: "돌계단 좌",
    112: "돌계단 중",
    113: "돌계단 우",
    28: "성 열린 창문",
    58: "성 창문",
    88: "깨진 창문조각",
    231: "마법진",
    18: "성 지붕 좌상",
    19: "성 지붕 상단",
    20: "성 지붕 우상",
    21: "성벽 상단",
    48: "성 지붕 좌측",
    49: "성 지붕 바닥(옅은)",
    50: "성 지붕 중단",
    51: "성벽 중단",
    78: "성 지붕 좌측(하)",
    79: "성 지붕 바닥(진한)",
    80: "성 지붕 중단(하)",
    81: "성벽 하단",
    108: "성 지붕 좌하",
    109: "성 지붕 하단",
    110: "성 지붕 우하",
    24: "원형 타워 캡 좌",
    25: "원형 타워 캡 우",
    54: "원형 타워 베이스 좌",
    55: "원형 타워 베이스 우",
    138: "원형 타워 목 좌",
    139: "원형 타워 목 우",
    140: "원형 타워 몸 좌",
    141: "원형 타워 몸 우",
    142: "원형 타워 창문 좌",
    143: "원형 타워 창문 우",
  };
  if (visionKo[index]) return visionKo[index]!;
  const labels: Record<string, string> = {
    empty: "빈 타일",
    wood_bridge_body: "나무 다리",
    stake_object: "말뚝",
    fence_object: "울타리",
    lake_water_body: "호수 물",
    lake_shore_edge: "호수 외곽",
    waterfall_water: "폭포",
    water_surface: "물",
    snow_ground: "눈밭",
    grass_ground: "풀밭",
    tall_grass: "키큰 풀",
    dirt_road_body: "흙길 중심",
    dirt_road_detail: "흙길 장식",
    dirt_road_edge: "흙길 외곽",
    desert_sand_body: "사막 모래",
    desert_sand_edge: "사막 외곽",
    sand_ground: "모래 지형",
    wood_floor_body: "나무 바닥",
    ground_detail: "지면 장식",
    dark_wall_body: "어두운 벽",
    stone_floor: "돌 바닥",
    stone_wall: "성벽 상단",
    house_purple_stone_wall_object: "보라 석재 집벽",
    house_white_wall_upper_object: "흰 집벽 상단",
    house_white_wall_body_object: "흰 집벽 중단",
    house_white_wall_lower_object: "흰 집벽 하단",
    house_wood_wall_upper_object: "나무 집벽 상단",
    house_wood_wall_body_object: "나무 집벽 중단",
    house_wood_wall_lower_object: "나무 집벽 하단",
    wood_structure_object: "나무 구조물",
    timber_post_structure_object: "목재 기둥 구조",
    house_entrance_upper_object: "집 입구 상단",
    house_entrance_lower_object: "집 입구 하단",
    house_roof_object: "집 지붕",
    house_facade_object: "집 전면",
    house_door_object: "집 문",
    roof_object: "지붕",
    building_front_object: "건물 전면",
    tent_object: "천막",
    bench_object: "벤치",
    chair_object: "의자",
    table_object: "탁자",
    house_yard_object: "집 앞 소품",
    cemetery_object: "묘지 소품",
    wall_ladder_object: "벽 사다리",
    fruit_box_object: "과일박스",
    wood_box_object: "나무 상자",
    market_rail_object: "장터 레일",
    stone_step_object: "돌단/석판",
    wood_door_object: "나무 문",
    stone_stair_object: "돌계단",
    castle_window_object: "성 창문",
    castle_round_tower_object: "원형 타워",
    magic_circle_object: "마법진",
    vine_object: "덩굴",
    sign_object: "표지판",
    fire_object: "불/횃불",
    statue_object: "석상",
    tree_object: "나무",
    flower_object: "꽃",
    generic_object: "오브젝트",
  };
  return labels[key] ?? `미분류 칩 ${index}`;
}

function whiteWallColumnTags(index: number): readonly string[] {
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallRepeatColumnObjects, index)) return ["center", "repeat-horizontal"] as const;
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallRightColumnObjects, index)) return ["right-cap"] as const;
  return ["left-cap"] as const;
}

function repeatRoleForChipsetTile(index: number): ChipsetTileRepeatRole {
  if (
    hasTile(CHIPSET_TILE_GROUPS.dirtRoadBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames, index) ||
    hasTile(CHIPSET_TILE_GROUPS.sandBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodBridgeBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodFloorBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneFloorBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneWallBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.castleRoundTowerBodyObjects, index) ||
    index === 51 ||
    index === 49 ||
    index === 79 ||
    index === 50 ||
    index === 80
  ) {
    return "body";
  }
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadVariants, index)) return "variant";
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadDetail, index) || hasTile(CHIPSET_TILE_GROUPS.groundDetail, index) || hasTile(CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames, index)) return "detail";
  if (
    hasTile(CHIPSET_TILE_GROUPS.dirtEdges, index) ||
    hasTile(CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames, index) ||
    hasTile(CHIPSET_TILE_GROUPS.sandSideEdges, index) ||
    hasTile(CHIPSET_TILE_GROUPS.sandCorners, index)
  ) {
    return "edge";
  }
  if (isUpperChipsetTile(index)) return "object";
  return "single";
}

function tilesInRect(rect: TileRect): readonly number[] {
  const tiles: number[] = [];
  for (let row = rect.top; row <= rect.bottom; row++) {
    for (let col = rect.left; col <= rect.right; col++) {
      tiles.push(row * DEFAULT_TILES_PER_ROW + col);
    }
  }
  return tiles;
}

function hasTile(tiles: readonly number[], index: number): boolean {
  return tiles.includes(index);
}
