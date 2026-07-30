export const ICE_GRAND_EXPANSE_MAP_ID = "map_g_ice_grand_expanse";
export const ICE_GRAND_EXPANSE_MAP_NAME = "빙결 대원정 · 열네 능선 (128×128)";
export const ICE_GRAND_EXPANSE_WIDTH = 128;
export const ICE_GRAND_EXPANSE_HEIGHT = 128;
export const ICE_GRAND_EXPANSE_START = { x: 64, y: 120 } as const;
export const ICE_GRAND_EXPANSE_BOSS = { x: 64, y: 11 } as const;
export const ICE_GRAND_EXPANSE_GATE_GEOMETRY = {
  event: { x: 64, y: 47 },
  southFacing: { x: 64, y: 48 },
  northExit: { x: 64, y: 45 },
  barrier: { minX: 0, maxX: 127, topY: 46, depth: 2 },
} as const;
export const ICE_GRAND_EXPANSE_FLOOR_TILE = 67;

/**
 * 네가티밌 공간(천장 마스크)을 싹음 물집 — **푸른 광석 암반 285**.
 *
 * 1차 판은 428 이었다. 정본 의미표가 366~458 을 통째로 `푸른 발광 심연` 으로 묶어 둔 그
 * 심연 집합이고, 실측 픽셀은 428 이 **85% 순검정**(평군 rgb 2,7,14)이다.
 * 64×64 에서 감독이 나락으로 판정해 지운 427(100% 순검정)과 같은 재료다 —
 * 한 맵에서 지우고 다른 맵에 2,800칸 남기면 같은 결함을 남긴 것이다.
 *
 * 285 는 `푸른 광석 암반`(평군 rgb 14,53,104 · 검정 11%)이며 통행 표시가 428 과 동일하게 `x` 다 —
 * 바뀌는 것은 그림만이고 통행은 한 칸도 달라지지 않는다(봉인·보스·체크포인트 좌표가 그대로 생산한다).
 * 315 는 같은 암반이지만 통행 표시가 `star` 라 무른 칸이 된다 — 체우기에 쓰지 않는다.
 */
export const ICE_GRAND_EXPANSE_CEILING_TILE = 285;

/**
 * 절뱽 상단 바로 위 행에 깔는 **평지 립** — 눈밭 블롭 하단 중앙 343.
 *
 * 64×64 와 같은 이유다: 눈밭 9슬라이스가 깔는 남변 97 은 벌 윗선과 `97 ↓ 373` = 173 으로
 * 부딪치고, 343 은 `343 ↓ 373` = 38 로 이어진다. 절뱽 칸 자심은 건드리지 않으며
 * 대각 캡 위에도 놓지 않는다(`343 ↓ 286` = 168).
 */
export const ICE_GRAND_EXPANSE_LIP_TILE = 343;

/**
 * 이 맵에 한 칸도 없어야 하는 심연·물 집합. 검사가 부재를 고정한다.
 *
 * 앞의 여덟은 정본 의미표의 `푸른 발광 심연` 전원이고, 뒤의 네개는 칩셋의 깊은 물 스트립 바탕이다.
 */
export const ICE_GRAND_EXPANSE_BANNED_VOID_TILES = [
  366, 367, 368, 396, 397, 398, 426, 427, 428, 456, 457, 458,
  120, 121, 122, 150, 151, 152, 180, 181, 182, 210, 211, 212,
] as const;

export type IceGrandExpanseDirection = "rise" | "fall";
export type IceGrandExpanseMotifOrigin = readonly [x: number, y: number];

export type IceGrandExpanseBounds = {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

export type IceGrandExpanseRidgeConfig = {
  readonly id: string;
  readonly bounds: IceGrandExpanseBounds;
  readonly direction: IceGrandExpanseDirection;
  readonly motifOrigins: readonly IceGrandExpanseMotifOrigin[];
};

export type IceGrandExpanseRegionBase = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tile: number;
};

export type IceGrandExpanseTerrainRoute = {
  readonly id: string;
  readonly waypoints: readonly IceGrandExpanseMotifOrigin[];
};

export type IceGrandExpanseTerrainRect = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type IceGrandExpanseTerrainPolygon = {
  readonly id: string;
  readonly points: readonly IceGrandExpanseMotifOrigin[];
};

export type IceGrandExpanseTerrainBarrier = {
  readonly id: string;
  readonly waypoints: readonly IceGrandExpanseMotifOrigin[];
  readonly opening: IceGrandExpanseMotifOrigin;
  readonly collisionSpine: {
    readonly minX: number;
    readonly maxX: number;
    readonly topY: number;
    readonly depth: number;
  };
};

export type IceGrandExpanseTerrainRoutePlan = {
  readonly routes: readonly IceGrandExpanseTerrainRoute[];
  readonly nodes: readonly IceGrandExpanseTerrainRect[];
  readonly regions: readonly IceGrandExpanseTerrainPolygon[];
  readonly basins: readonly IceGrandExpanseTerrainPolygon[];
  readonly connectors: readonly IceGrandExpanseTerrainRect[];
  readonly clearings: readonly IceGrandExpanseMotifOrigin[];
  readonly barriers: readonly IceGrandExpanseTerrainBarrier[];
};

export const ICE_GRAND_EXPANSE_RIDGES = [
  {
    id: "r01-southwest-wall",
    bounds: { minX: 4, maxX: 39, minY: 94, maxY: 112 },
    direction: "rise",
    motifOrigins: [[4, 104], [16, 99], [28, 94]],
  },
  {
    id: "r02-southeast-wall",
    bounds: { minX: 88, maxX: 123, minY: 90, maxY: 108 },
    direction: "fall",
    motifOrigins: [[88, 90], [100, 95], [112, 100]],
  },
  {
    id: "r03-central-gate",
    bounds: { minX: 40, maxX: 87, minY: 76, maxY: 99 },
    direction: "rise",
    motifOrigins: [[40, 91], [52, 86], [64, 81], [76, 76]],
  },
  {
    id: "r04-west-lower",
    bounds: { minX: 4, maxX: 39, minY: 66, maxY: 84 },
    direction: "rise",
    motifOrigins: [[4, 76], [16, 71], [28, 66]],
  },
  {
    id: "r05-east-lower",
    bounds: { minX: 88, maxX: 123, minY: 70, maxY: 88 },
    direction: "fall",
    motifOrigins: [[88, 70], [100, 75], [112, 80]],
  },
  {
    id: "r06-west-hook",
    bounds: { minX: 4, maxX: 39, minY: 48, maxY: 66 },
    direction: "rise",
    motifOrigins: [[4, 58], [16, 53], [28, 48]],
  },
  {
    id: "r07-east-hook",
    bounds: { minX: 88, maxX: 123, minY: 48, maxY: 66 },
    direction: "fall",
    motifOrigins: [[88, 48], [100, 53], [112, 58]],
  },
  {
    id: "r08-lake-south",
    bounds: { minX: 40, maxX: 87, minY: 53, maxY: 76 },
    direction: "rise",
    motifOrigins: [[40, 68], [52, 63], [64, 58], [76, 53]],
  },
  {
    id: "r09-lake-north",
    bounds: { minX: 40, maxX: 87, minY: 24, maxY: 47 },
    direction: "fall",
    motifOrigins: [[40, 24], [52, 29], [64, 34], [76, 39]],
  },
  {
    id: "r10-crown-west",
    bounds: { minX: 4, maxX: 27, minY: 39, maxY: 52 },
    direction: "rise",
    motifOrigins: [[4, 44], [16, 39]],
  },
  {
    id: "r11-crown-east",
    bounds: { minX: 100, maxX: 123, minY: 39, maxY: 52 },
    direction: "fall",
    motifOrigins: [[100, 39], [112, 44]],
  },
  {
    id: "r12-summit-left",
    bounds: { minX: 4, maxX: 39, minY: 16, maxY: 34 },
    direction: "rise",
    motifOrigins: [[4, 26], [16, 21], [28, 16]],
  },
  {
    id: "r13-summit-right",
    bounds: { minX: 88, maxX: 123, minY: 16, maxY: 34 },
    direction: "fall",
    motifOrigins: [[88, 16], [100, 21], [112, 26]],
  },
  {
    id: "r14-altar-ring",
    bounds: { minX: 40, maxX: 87, minY: 2, maxY: 25 },
    direction: "fall",
    motifOrigins: [[40, 2], [52, 7], [64, 12], [76, 17]],
  },
] as const satisfies readonly IceGrandExpanseRidgeConfig[];

export const ICE_GRAND_EXPANSE_REGION_BASES = [
  { id: "south-camp", x: 45, y: 109, width: 38, height: 16, tile: 67 },
  { id: "twin-fang", x: 10, y: 88, width: 108, height: 23, tile: 97 },
  { id: "central-gate", x: 42, y: 76, width: 45, height: 21, tile: 67 },
  { id: "west-mine", x: 8, y: 50, width: 47, height: 39, tile: 66 },
  { id: "mirror-lake", x: 38, y: 46, width: 53, height: 28, tile: 96 },
  { id: "east-cliff", x: 74, y: 48, width: 47, height: 41, tile: 68 },
  { id: "crown-switchbacks", x: 20, y: 21, width: 89, height: 32, tile: 37 },
  { id: "dragon-altar", x: 46, y: 4, width: 37, height: 20, tile: 7 },
] as const satisfies readonly IceGrandExpanseRegionBase[];

const TERRAIN_ROUTES = [
  { id: "c1-camp-west-fork", waypoints: [[64, 117], [60, 117], [47, 117], [47, 96], [44, 96]] },
  { id: "c1-west-fork-gate-hub", waypoints: [[44, 96], [41, 96], [40, 96], [40, 85], [60, 85], [64, 85], [64, 84]] },
  { id: "c1-gate-hub-east-fork", waypoints: [[64, 84], [64, 85], [68, 85], [90, 85], [90, 96], [82, 96], [79, 96]] },
  { id: "c1-east-fork-camp", waypoints: [[79, 96], [79, 114], [68, 114], [68, 117], [64, 117]] },
  { id: "c2-gate-hub-west-seal", waypoints: [[64, 84], [64, 73], [24, 73], [24, 63], [28, 63]] },
  { id: "c2-west-seal-lake-north", waypoints: [[28, 63], [28, 60], [23, 60], [23, 49], [60, 49], [64, 49]] },
  { id: "c2-lake-north-east-seal", waypoints: [[64, 49], [68, 49], [100, 49], [100, 62]] },
  { id: "c2-east-seal-gate-hub", waypoints: [[100, 62], [104, 62], [104, 71], [68, 71], [68, 84], [64, 84]] },
  { id: "c3-lake-north-crown-west", waypoints: [[64, 49], [64, 43], [40, 43], [40, 38]] },
  { id: "c3-crown-west-summit", waypoints: [[40, 38], [43, 38], [56, 38], [56, 25], [60, 25], [64, 25]] },
  { id: "c3-summit-crown-east", waypoints: [[64, 25], [68, 25], [71, 25], [71, 38], [84, 38], [88, 38]] },
  { id: "c3-crown-east-lake-north", waypoints: [[88, 38], [88, 40], [73, 40], [73, 43], [64, 43], [64, 49]] },
] as const satisfies readonly IceGrandExpanseTerrainRoute[];

const TERRAIN_NODES = [
  { id: "camp", x: 60, y: 114, width: 9, height: 7 },
  { id: "west-fork", x: 41, y: 93, width: 7, height: 7 },
  { id: "gate-hub", x: 60, y: 81, width: 9, height: 7 },
  { id: "east-fork", x: 76, y: 93, width: 7, height: 7 },
  { id: "west-seal", x: 25, y: 60, width: 7, height: 7 },
  { id: "lake-north", x: 60, y: 43, width: 9, height: 10 },
  { id: "east-seal", x: 97, y: 59, width: 7, height: 7 },
  { id: "crown-west", x: 37, y: 35, width: 7, height: 7 },
  { id: "summit-checkpoint", x: 60, y: 22, width: 9, height: 7 },
  { id: "crown-east", x: 85, y: 35, width: 7, height: 7 },
] as const satisfies readonly IceGrandExpanseTerrainRect[];

const TERRAIN_REGIONS = [
  { id: "south-camp", points: [[42, 111], [48, 107], [56, 109], [64, 106], [72, 109], [81, 107], [87, 113], [84, 119], [88, 123], [79, 126], [67, 124], [55, 127], [45, 123], [39, 117]] },
  { id: "twin-fang", points: [[7, 94], [15, 90], [27, 92], [39, 87], [52, 90], [64, 88], [77, 90], [91, 87], [105, 90], [124, 90], [121, 98], [125, 104], [115, 110], [98, 108], [83, 112], [65, 108], [51, 112], [34, 109], [18, 112], [6, 105]] },
  { id: "central-gate", points: [[36, 83], [42, 77], [51, 80], [58, 75], [65, 78], [72, 75], [82, 79], [91, 77], [96, 84], [91, 89], [94, 96], [84, 101], [75, 97], [65, 102], [55, 98], [45, 101], [38, 94], [41, 88]] },
  { id: "west-mine", points: [[2, 54], [10, 48], [19, 51], [27, 46], [36, 50], [46, 47], [55, 54], [51, 62], [57, 69], [51, 77], [54, 84], [44, 91], [35, 87], [25, 92], [14, 87], [4, 90], [7, 79], [2, 70]] },
  { id: "mirror-lake", points: [[27, 55], [35, 48], [44, 51], [52, 45], [61, 49], [70, 44], [79, 49], [89, 46], [98, 53], [94, 59], [101, 66], [95, 74], [85, 71], [77, 78], [67, 74], [57, 79], [47, 74], [37, 77], [30, 69], [33, 62]] },
  { id: "east-cliff", points: [[72, 55], [79, 49], [89, 52], [98, 47], [108, 51], [118, 48], [126, 56], [122, 64], [126, 72], [119, 79], [123, 87], [113, 92], [103, 88], [93, 91], [82, 86], [75, 90], [78, 78], [71, 68]] },
  { id: "crown-switchbacks", points: [[2, 29], [12, 23], [23, 27], [34, 20], [46, 24], [58, 18], [70, 23], [82, 17], [94, 23], [106, 19], [117, 26], [126, 23], [123, 34], [127, 42], [118, 50], [105, 47], [94, 55], [80, 51], [66, 57], [52, 52], [38, 56], [25, 50], [13, 55], [3, 47], [7, 39]] },
  { id: "dragon-altar", points: [[34, 10], [42, 4], [51, 7], [59, 2], [67, 5], [76, 2], [84, 7], [93, 5], [98, 13], [92, 19], [95, 25], [85, 29], [75, 25], [65, 30], [55, 26], [45, 29], [38, 22], [41, 16]] },
] as const satisfies readonly IceGrandExpanseTerrainPolygon[];

const TERRAIN_BASINS = [
  { id: "south-basin", points: [[31, 114], [37, 111], [44, 113], [49, 109], [56, 112], [62, 110], [68, 114], [76, 111], [83, 114], [90, 112], [94, 118], [90, 123], [94, 126], [32, 126], [35, 122], [29, 119]] },
  { id: "lake-basin", points: [[25, 58], [31, 53], [39, 56], [46, 51], [54, 54], [63, 50], [71, 54], [80, 51], [89, 55], [98, 53], [104, 59], [100, 64], [105, 69], [96, 74], [87, 71], [78, 75], [68, 72], [58, 76], [48, 72], [39, 75], [30, 70], [33, 65]] },
  { id: "crown-basin", points: [[43, 35], [48, 30], [54, 33], [59, 28], [65, 32], [71, 29], [77, 34], [83, 32], [87, 38], [82, 42], [85, 47], [77, 50], [70, 47], [63, 51], [57, 47], [49, 50], [45, 44], [48, 40]] },
  { id: "gate-west-crevasse", points: [[43, 80], [47, 76], [51, 79], [55, 77], [60, 81], [58, 85], [61, 89], [57, 94], [53, 91], [49, 96], [45, 92], [47, 88], [42, 85], [46, 83]] },
  { id: "gate-east-crevasse", points: [[68, 81], [72, 77], [76, 79], [80, 76], [85, 81], [82, 85], [86, 89], [82, 94], [78, 91], [74, 96], [69, 92], [72, 88], [67, 85], [71, 83]] },
  { id: "south-west-crack", points: [[51, 102], [54, 98], [58, 100], [62, 97], [63, 102], [60, 105], [62, 109], [58, 112], [55, 109], [51, 111], [48, 107], [52, 105]] },
  { id: "south-east-crack", points: [[72, 102], [76, 98], [81, 101], [85, 99], [87, 104], [84, 107], [86, 111], [81, 113], [78, 109], [73, 111], [70, 107], [74, 105]] },
  { id: "altar-west-fissure", points: [[45, 11], [50, 7], [54, 9], [58, 6], [61, 11], [58, 14], [61, 18], [57, 22], [53, 19], [49, 23], [45, 18], [48, 15]] },
  { id: "altar-east-fissure", points: [[67, 11], [71, 7], [75, 9], [79, 6], [83, 11], [80, 14], [83, 18], [79, 22], [75, 19], [71, 23], [67, 18], [70, 15]] },
] as const satisfies readonly IceGrandExpanseTerrainPolygon[];

export const ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN = {
  routes: TERRAIN_ROUTES,
  nodes: TERRAIN_NODES,
  regions: TERRAIN_REGIONS,
  basins: TERRAIN_BASINS,
  connectors: [
    { id: "central-gate-connector", x: 64, y: 84, width: 1, height: 12 },
    { id: "summit-boss-connector", x: 64, y: 10, width: 1, height: 16 },
  ],
  clearings: [[60, 38], [93, 98], [53, 34], [23, 58], [64, 92], [34, 72], [98, 58], [40, 82], [40, 81], [88, 82], [88, 81]],
  barriers: [{
    id: "crown-gate-cliff",
    waypoints: [[0, 46], [12, 44], [24, 46], [36, 45], [48, 46], [60, 44], [68, 44], [80, 46], [92, 45], [104, 46], [116, 44], [127, 46]],
    opening: [64, 47],
    collisionSpine: ICE_GRAND_EXPANSE_GATE_GEOMETRY.barrier,
  }],
} as const satisfies IceGrandExpanseTerrainRoutePlan;
