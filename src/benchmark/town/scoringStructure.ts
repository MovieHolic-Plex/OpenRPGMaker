// benchmark/town/scoringStructure.ts
// 3번~9번 배치 채점.
//
// 이 모듈의 설계 원칙은 interior 트랙의 S5/S6 쌍과 같다:
//   identity   정본 스탬프와 칸 단위로 같은가 (시트 문법을 아는가)
//   structural 타일 id 를 거의 보지 않고, 지은 것이 구조로 성립하는가
// 정본과 다른 타일로 멀쩡한 집을 지은 모델은 identity 가 낮고 structural 이 높다.
// 정본 타일을 흩뿌려 놓기만 한 모델은 그 반대다. 한 숫자로는 이 둘을 구분할 수 없다.
//
// 다만 **문항마다 그 둘을 섞는 비율이 다르다**:
//   5·6번    정본이 유일한 정답이다      → score = mean(identity, structural)
//   4·7·9번  정답이 여럿이다            → score = structural 만 (identity 는 참고)
//   8번      문법 규칙표가 정답이다      → score = 규칙 통과율 (identity 는 참고)
//   3번      수종은 자유다              → score = 쌍 규칙 통과율
// 정답이 하나가 아닌 문항에서 정본 일치를 점수에 넣으면 "정본을 외웠는가"를
// 재는 것이 되고, 그건 이 벤치마크가 물으려는 것이 아니다.

import { deriveTreePairs } from "@/benchmark/groundTruth";
import { HOUSE_KITS, rectHouseHeight } from "@/editor/houseKit";
import {
  DOOR_BOTTOM_TILE,
  DOOR_TOP_TILE,
  FENCE_BOTTOM_LEFT,
  FENCE_BOTTOM_RIGHT,
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  FENCE_GATE_HALF_WIDTH,
  FENCE_LOT_MARGIN,
  FENCE_SIDE_RAIL,
  FENCE_TOP_LEFT,
  FENCE_TOP_RIGHT,
  ROAD_TILES,
  expandRect,
} from "@/editor/tools/village/constants";
import { autotileNeighborMask, autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { DEFAULT_ROAD_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import {
  ROOF_GRID,
  DOOR_GRID,
  FENCE_GRID,
  ROAD_GRID,
  TREE_GRID,
  VILLAGE_GRID,
  WALL_GRID,
  type FixtureHousePlan,
} from "./fixtures";
import {
  cellAt,
  connectedComponents,
  flatten,
  floodFill,
  inBounds,
  isSolidTile,
  isWalkable,
  mean,
  overlay,
  ratio,
  type GridView,
} from "./gridWalk";
import { COBBLE_PALETTE, DOOR_PALETTE, FENCE_PALETTE, ROAD_PALETTE, houseKitPalette } from "./palettes";
import {
  EMPTY_CELL,
  type AxisScore,
  type PlacementReference,
  type TownAnswer,
  type TownAxisId,
  type TownGroundTruth,
} from "./types";

// ── 답변 정규화 ───────────────────────────────────────────────────────────

interface Layers {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

/** grid 답변이 어느 레이어를 뜻하는지 — 문항 정의에 붙은 고정 규약. */
const GRID_LAYER: Readonly<Record<string, "lower" | "upper">> = Object.freeze({
  roadGrid: "lower",
  doorGrid: "lower",
  fenceGrid: "upper",
});

function emptyLayer(size: number): number[] {
  return new Array<number>(size).fill(EMPTY_CELL);
}

function answerLayers(answer: TownAnswer, reference: PlacementReference): Layers | null {
  const size = reference.width * reference.height;
  if ("lower" in answer) {
    const lower = flatten(answer.lower);
    const upper = flatten(answer.upper);
    if (lower.width !== reference.width || lower.height !== reference.height) return null;
    return { width: lower.width, height: lower.height, lower: lower.cells, upper: upper.cells };
  }
  if ("grid" in answer) {
    const view = flatten(answer.grid);
    if (view.width !== reference.width || view.height !== reference.height) return null;
    const layer = GRID_LAYER[reference.key] ?? "lower";
    return layer === "lower"
      ? { width: view.width, height: view.height, lower: view.cells, upper: emptyLayer(size) }
      : { width: view.width, height: view.height, lower: emptyLayer(size), upper: view.cells };
  }
  return null;
}

function view(layers: Layers, layer: "lower" | "upper"): GridView {
  return { width: layers.width, height: layers.height, cells: layer === "lower" ? layers.lower : layers.upper };
}

function shapeMismatch(axis: TownAxisId, reference: PlacementReference, answer: TownAnswer): AxisScore {
  const shape = "grid" in answer
    ? flatten(answer.grid)
    : "lower" in answer
      ? flatten(answer.lower)
      : { width: 0, height: 0 };
  return Object.freeze({
    axis,
    score: 0,
    method: "structural" as const,
    detail: Object.freeze({
      shapeMismatch: 1,
      width: shape.width,
      height: shape.height,
      expectedWidth: reference.width,
      expectedHeight: reference.height,
    }),
  });
}

// ── 공용 지표 ─────────────────────────────────────────────────────────────

/** 정본과의 칸 일치 — 두 레이어의 "빈 칸이 아닌 칸" 합집합 위에서 센다. */
function identity(reference: PlacementReference, layers: Layers): { score: number; exact: number; union: number } {
  const size = reference.width * reference.height;
  let exact = 0;
  let union = 0;
  for (let index = 0; index < size; index += 1) {
    for (const [expected, actual] of [
      [reference.lower[index] ?? EMPTY_CELL, layers.lower[index] ?? EMPTY_CELL],
      [reference.upper[index] ?? EMPTY_CELL, layers.upper[index] ?? EMPTY_CELL],
    ] as const) {
      if (expected === EMPTY_CELL && actual === EMPTY_CELL) continue;
      union += 1;
      if (expected === actual) exact += 1;
    }
  }
  return { score: ratio(exact, union), exact, union };
}

/** 상위 레이어에 놓은 것이 실제로 상위 소품인가. 상위를 안 쓴 답은 위반이 아니다. */
function layerDiscipline(layers: Layers, groundTruth: TownGroundTruth): { score: number; cells: number } {
  let cells = 0;
  let correct = 0;
  for (const tile of layers.upper) {
    if (tile === EMPTY_CELL) continue;
    cells += 1;
    if (groundTruth.priority[tile] === "upper") correct += 1;
  }
  return { score: cells === 0 ? 1 : correct / cells, cells };
}

function paletteClean(layers: Layers, palette: readonly number[]): number {
  const allowed = new Set<number>(palette);
  let used = 0;
  let clean = 0;
  for (const layer of [layers.lower, layers.upper]) {
    for (const tile of layer) {
      if (tile === EMPTY_CELL) continue;
      used += 1;
      if (allowed.has(tile)) clean += 1;
    }
  }
  return ratio(clean, used);
}

function noBanned(layers: Layers, groundTruth: TownGroundTruth): number {
  for (const layer of [layers.lower, layers.upper]) {
    for (const tile of layer) if (tile !== EMPTY_CELL && groundTruth.banned.has(tile)) return 0;
  }
  return 1;
}

/**
 * 일한 항목(work)의 평균에 감점 항목(penalties)을 곱한다.
 *
 * 이 분리가 필요한 이유: "건물을 침범하지 않았다", "금지 타일을 안 썼다" 같은
 * 항목은 **아무것도 안 하면 만점**이다. 그런 항목을 평균에 같이 넣으면 빈 답이
 * 0.667 을 받는다(2026-08-21 실측 버그). 감점 항목은 평균이 아니라 배수로 쓴다.
 */
function combine(work: readonly number[], penalties: readonly number[]): number {
  return penalties.reduce((accumulated, penalty) => accumulated * penalty, mean(work));
}

/** 답변에 놓인 타일 수 — 0 이면 채점하지 않고 0점이다(무응답은 만점의 반대다). */
function placedCells(layers: Layers): number {
  let placed = 0;
  for (const layer of [layers.lower, layers.upper]) {
    for (const tile of layer) if (tile !== EMPTY_CELL) placed += 1;
  }
  return placed;
}

function filledAt(layers: Layers, x: number, y: number): boolean {
  const index = y * layers.width + x;
  if (!inBounds(layers, x, y)) return false;
  return (layers.lower[index] ?? EMPTY_CELL) !== EMPTY_CELL || (layers.upper[index] ?? EMPTY_CELL) !== EMPTY_CELL;
}

// ── 집 기하 ───────────────────────────────────────────────────────────────

interface HouseBands {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly wallRows: number;
  readonly roofRows: number;
  /** 벽 상단 행 y. 지붕 밴드는 top..wallTopY-1 이다. */
  readonly wallTopY: number;
  readonly doorX: number;
}

/** stampRectHouseKit 과 같은 밴드 계산 — 벽 = 상단1 + 중단(2*층-1) + 하단1. */
function houseBands(plan: FixtureHousePlan): HouseBands {
  const height = rectHouseHeight({
    stories: plan.stories,
    roofBodyRows: plan.roofBodyRows,
    kitId: plan.kitId,
    width: plan.width,
    lowWall: plan.lowWall,
  });
  const wallRows = plan.lowWall ? 2 : 2 + (2 * plan.stories - 1);
  return {
    left: plan.x,
    right: plan.x + plan.width - 1,
    top: plan.y,
    bottom: plan.y + height - 1,
    height,
    wallRows,
    roofRows: height - wallRows,
    wallTopY: plan.y + height - wallRows,
    doorX: plan.x + Math.floor(plan.width / 2),
  };
}

interface TileFamilies {
  readonly wall: ReadonlySet<number>;
  readonly roof: ReadonlySet<number>;
}

function kitFamilies(plan: FixtureHousePlan): TileFamilies {
  const kit = HOUSE_KITS[plan.kitId];
  if (!kit) throw new Error(`town scoring: 알 수 없는 집 키트 ${plan.kitId}`);
  const wall = new Set<number>();
  for (const slice of [kit.wall.top, kit.wall.mid, kit.wall.bottom]) for (const tile of slice) wall.add(tile);
  if (kit.postColumn) for (const tile of kit.postColumn.tiles) wall.add(tile);
  const roof = new Set<number>();
  for (const value of Object.values(kit.roof)) if (typeof value === "number") roof.add(value);
  for (const value of Object.values(kit.roof.upper)) if (typeof value === "number") roof.add(value);
  return { wall, roof };
}

/** 벽 나인슬라이스 문법: 행마다 좌·우 끝이 반복 중앙과 다르고, 중앙은 서로 같다. */
function nineSliceRows(layers: Layers, bands: HouseBands): number {
  const lower = view(layers, "lower");
  let correct = 0;
  for (let y = bands.wallTopY; y <= bands.bottom; y += 1) {
    const left = cellAt(lower, bands.left, y);
    const right = cellAt(lower, bands.right, y);
    const middles: number[] = [];
    for (let x = bands.left + 1; x < bands.right; x += 1) middles.push(cellAt(lower, x, y));
    if (middles.length === 0) continue;
    // 하프팀버 기둥 열처럼 중앙이 교대하는 키트도 있으므로 "중앙의 최빈값"을 기준으로 본다.
    const dominant = middles.slice().sort((a, b) =>
      middles.filter((v) => v === b).length - middles.filter((v) => v === a).length)[0]!;
    const middlesConsistent = middles.filter((tile) => tile === dominant).length >= Math.ceil(middles.length / 2);
    const edgesDiffer = left !== dominant && right !== dominant && left !== EMPTY_CELL && right !== EMPTY_CELL;
    if (middlesConsistent && edgesDiffer) correct += 1;
  }
  return ratio(correct, bands.wallRows);
}

function wallBandChecks(
  layers: Layers,
  bands: HouseBands,
  families: TileFamilies,
  groundTruth: TownGroundTruth,
): { readonly isWall: number; readonly solid: number } {
  const lower = view(layers, "lower");
  let cells = 0;
  let wallFamily = 0;
  let solid = 0;
  for (let y = bands.wallTopY; y <= bands.bottom; y += 1) {
    for (let x = bands.left; x <= bands.right; x += 1) {
      cells += 1;
      const tile = cellAt(lower, x, y);
      if (tile !== EMPTY_CELL && families.wall.has(tile)) wallFamily += 1;
      if (tile !== EMPTY_CELL && isSolidTile(groundTruth.passFlags, tile)) solid += 1;
    }
  }
  return { isWall: ratio(wallFamily, cells), solid: ratio(solid, cells) };
}

function outsideClean(layers: Layers, bands: readonly HouseBands[]): number {
  let outside = 0;
  let clean = 0;
  for (let y = 0; y < layers.height; y += 1) {
    for (let x = 0; x < layers.width; x += 1) {
      const inside = bands.some((band) => x >= band.left && x <= band.right && y >= band.top && y <= band.bottom);
      if (inside) continue;
      outside += 1;
      if (!filledAt(layers, x, y)) clean += 1;
    }
  }
  return ratio(clean, outside);
}

function footprintFilled(layers: Layers, bands: HouseBands): number {
  let cells = 0;
  let filled = 0;
  for (let y = bands.top; y <= bands.bottom; y += 1) {
    for (let x = bands.left; x <= bands.right; x += 1) {
      cells += 1;
      if (filledAt(layers, x, y)) filled += 1;
    }
  }
  return ratio(filled, cells);
}

// ── 3번 나무(레이어 분리) ─────────────────────────────────────────────────

function scoreTrees(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const pairs = deriveTreePairs();
  const canopyForTrunk = new Map<number, number>(pairs.map(([canopy, trunk]) => [trunk, canopy]));
  const spots = new Set<number>(TREE_GRID.spots.map((spot) => spot.y * layers.width + spot.x));

  let paired = 0;
  let trunkOnLower = 0;
  let canopyOnUpper = 0;
  for (const spot of TREE_GRID.spots) {
    const index = spot.y * layers.width + spot.x;
    const lower = layers.lower[index] ?? EMPTY_CELL;
    const upper = layers.upper[index] ?? EMPTY_CELL;
    const expectedCanopy = canopyForTrunk.get(lower);
    if (expectedCanopy !== undefined) trunkOnLower += 1;
    if (upper !== EMPTY_CELL && [...canopyForTrunk.values()].includes(upper)) canopyOnUpper += 1;
    if (expectedCanopy !== undefined && upper === expectedCanopy) paired += 1;
  }

  // 마킹 밖에 심은 나무 — 분모를 키워 깎는다(전부 나무로 덮으면 만점이 되지 않게).
  let extra = 0;
  for (let index = 0; index < layers.lower.length; index += 1) {
    if (spots.has(index)) continue;
    if ((layers.lower[index] ?? EMPTY_CELL) !== EMPTY_CELL || (layers.upper[index] ?? EMPTY_CELL) !== EMPTY_CELL) {
      extra += 1;
    }
  }

  const total = TREE_GRID.spots.length;
  const discipline = layerDiscipline(layers, groundTruth);
  return Object.freeze({
    axis: "layer" as const,
    score: ratio(paired, total + extra),
    method: "ruleRate" as const,
    detail: Object.freeze({
      pairedCorrect: paired,
      spots: total,
      trunkOnLower: ratio(trunkOnLower, total),
      canopyOnUpper: ratio(canopyOnUpper, total),
      plantedOutsideMarks: extra,
      layerDiscipline: discipline.score,
      identity: identity(reference, layers).score,
    }),
  });
}

// ── 4번 길 ────────────────────────────────────────────────────────────────

function scoreRoad(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const roadMembers = new Set<number>(ROAD_PALETTE);
  const roadCells = new Set<number>();
  for (let index = 0; index < layers.lower.length; index += 1) {
    const tile = layers.lower[index] ?? EMPTY_CELL;
    if (tile !== EMPTY_CELL && roadMembers.has(tile)) roadCells.add(index);
  }
  // 길을 한 칸도 안 깔았으면 오토타일 합법성·통행 가능은 "해당 없음"이 아니라 0 이다.
  const hasRoad = roadCells.size > 0;

  // 1) 세 지점이 포장됐는가.
  const anchorIndices = ROAD_GRID.anchors.map((anchor) => anchor.y * layers.width + anchor.x);
  const anchorsPaved = ratio(anchorIndices.filter((index) => roadCells.has(index)).length, anchorIndices.length);

  // 2) 하나의 연결망인가 — 첫 지점이 속한 성분에 나머지 지점이 있는가.
  const components = connectedComponents(layers, roadCells);
  const anchorComponent = components.find((component) => component.includes(anchorIndices[0]!));
  const reachableAnchors = anchorComponent
    ? anchorIndices.filter((index) => anchorComponent.includes(index)).length
    : 0;
  const connectivity = ratio(reachableAnchors, anchorIndices.length);

  // 3) 오토타일 합법성 — 칸마다 이웃 마스크가 요구하는 변형 타일인가.
  //    "길을 잘 만드는가"의 핵심이다. 몸통 타일로만 칠한 답은 여기서 걸린다.
  const canvas = { width: layers.width, height: layers.height, lowerTiles: [...layers.lower] };
  const connect = new Set<number>(DEFAULT_ROAD_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
  let legal = 0;
  for (const index of roadCells) {
    const x = index % layers.width;
    const y = Math.floor(index / layers.width);
    const mask = autotileNeighborMask(canvas, x, y, (tile) => connect.has(tile), DEFAULT_ROAD_AUTOTILE_GROUP.neighborhood ?? 4);
    if (autotileVariantForMask(DEFAULT_ROAD_AUTOTILE_GROUP, mask) === (layers.lower[index] ?? EMPTY_CELL)) legal += 1;
  }
  const autotileLegality = hasRoad ? ratio(legal, roadCells.size) : 0;

  // 4) 건물을 침범하지 않았는가.
  let buildingCells = 0;
  let buildingClear = 0;
  for (const building of ROAD_GRID.buildings) {
    for (let y = building.y; y < building.y + building.h; y += 1) {
      for (let x = building.x; x < building.x + building.w; x += 1) {
        buildingCells += 1;
        if (!filledAt(layers, x, y)) buildingClear += 1;
      }
    }
  }
  const buildingsClear = ratio(buildingClear, buildingCells);

  // 5) 깔아 놓은 길을 실제로 걸을 수 있는가.
  let walkable = 0;
  for (const index of roadCells) {
    if (isWalkable(groundTruth.passFlags, layers.lower[index] ?? EMPTY_CELL)) walkable += 1;
  }
  const walkableRate = hasRoad ? ratio(walkable, roadCells.size) : 0;

  const palette = paletteClean(layers, ROAD_PALETTE);
  return Object.freeze({
    axis: "road" as const,
    // 일한 항목 = 지점 포장 · 연결 · 오토타일 합법성. 나머지는 감점 배수다.
    score: combine([anchorsPaved, connectivity, autotileLegality], [buildingsClear, walkableRate, palette]),
    method: "structural" as const,
    detail: Object.freeze({
      anchorsPaved,
      connectivity,
      autotileLegality,
      buildingsClear,
      walkable: walkableRate,
      paletteClean: palette,
      roadCells: roadCells.size,
      components: components.length,
      identity: identity(reference, layers).score,
    }),
  });
}

// ── 5번 벽 외곽 ───────────────────────────────────────────────────────────

function scoreHouseShell(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const plan = WALL_GRID.house;
  const bands = houseBands(plan);
  const families = kitFamilies(plan);
  const wall = wallBandChecks(layers, bands, families, groundTruth);

  // 지붕 밴드가 지붕 조각으로 채워졌는가 — 벽 타일이 지붕 자리에 올라오면 깎인다.
  let roofCells = 0;
  let roofFamily = 0;
  for (let y = bands.top; y < bands.wallTopY; y += 1) {
    for (let x = bands.left; x <= bands.right; x += 1) {
      roofCells += 1;
      const lower = layers.lower[y * layers.width + x] ?? EMPTY_CELL;
      const upper = layers.upper[y * layers.width + x] ?? EMPTY_CELL;
      if ((lower !== EMPTY_CELL && families.roof.has(lower)) || (upper !== EMPTY_CELL && families.roof.has(upper))) {
        roofFamily += 1;
      }
    }
  }

  const discipline = layerDiscipline(layers, groundTruth);
  const filled = footprintFilled(layers, bands);
  const outside = outsideClean(layers, [bands]);
  const roofBandIsRoof = ratio(roofFamily, roofCells);
  const nineSlice = nineSliceRows(layers, bands);
  const palette = paletteClean(layers, houseKitPalette(plan.kitId));
  const structural = combine(
    [filled, wall.isWall, wall.solid, roofBandIsRoof, nineSlice],
    [outside, discipline.score, palette],
  );
  const match = identity(reference, layers);
  return Object.freeze({
    axis: "wallOutline" as const,
    score: mean([match.score, structural]),
    method: "structural" as const,
    detail: Object.freeze({
      identity: match.score,
      structural,
      footprintFilled: filled,
      outsideClean: outside,
      layerDiscipline: discipline.score,
      wallBandIsWall: wall.isWall,
      wallBandSolid: wall.solid,
      roofBandIsRoof,
      nineSlice,
      paletteClean: palette,
      exactCells: match.exact,
      gradedCells: match.union,
    }),
  });
}

// ── 6번 지붕 대각 ─────────────────────────────────────────────────────────

function scoreRoofDiagonal(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const plan = ROOF_GRID.house;
  const bands = houseBands(plan);
  const families = kitFamilies(plan);
  const roof = ROOF_GRID.house;

  // 표준 사선 지붕의 문법: 용마루 행(인셋 폭) → 몸통 행(인셋, 좌우 트림 열) → 처마 행(벽 폭).
  // 인셋 폭은 벽보다 좌우 1칸 좁다 — 그 바깥 열이 트림이고, 용마루/처마 모서리에는
  // 투명 캡이 얹힌다(bright 킷의 국소 규칙, houseKit.ts).
  const insetLeft = bands.left + 1;
  const insetRight = bands.right - 1;
  const ridgeY = bands.top;
  const eavesY = bands.wallTopY - 1;

  // 1) 용마루 행은 인셋 폭으로 꽉 차 있는가(불투명 → 하위).
  let ridgeFilled = 0;
  let ridgeOnLower = 0;
  for (let x = insetLeft; x <= insetRight; x += 1) {
    const index = ridgeY * layers.width + x;
    if (filledAt(layers, x, ridgeY)) ridgeFilled += 1;
    if ((layers.lower[index] ?? EMPTY_CELL) !== EMPTY_CELL) ridgeOnLower += 1;
  }
  const ridgeWidth = insetRight - insetLeft + 1;
  const ridgeFull = ratio(ridgeFilled, ridgeWidth);
  const ridgeOpaque = ratio(ridgeOnLower, ridgeWidth);

  // 2) 용마루 모서리 캡은 투명 → 상위 레이어에 있어야 한다.
  const capLeft = (layers.upper[ridgeY * layers.width + bands.left] ?? EMPTY_CELL) !== EMPTY_CELL ? 1 : 0;
  const capRight = (layers.upper[ridgeY * layers.width + bands.right] ?? EMPTY_CELL) !== EMPTY_CELL ? 1 : 0;
  const ridgeCaps = ratio(capLeft + capRight, 2);

  // 3) 몸통 행: 좌우 바깥 열이 트림(하위, 벽과 다른 타일), 가운데는 몸통(하위)으로 채워진다.
  const bodyRows = Math.max(1, eavesY - ridgeY - 1);
  let bodyTrimmed = 0;
  for (let y = ridgeY + 1; y < eavesY; y += 1) {
    const leftTile = layers.lower[y * layers.width + bands.left] ?? EMPTY_CELL;
    const rightTile = layers.lower[y * layers.width + bands.right] ?? EMPTY_CELL;
    let middle = 0;
    for (let x = insetLeft; x <= insetRight; x += 1) if (filledAt(layers, x, y)) middle += 1;
    const trimsDiffer = leftTile !== EMPTY_CELL && rightTile !== EMPTY_CELL && leftTile !== rightTile;
    if (trimsDiffer && middle >= ridgeWidth) bodyTrimmed += 1;
  }
  const bodyTrim = ratio(bodyTrimmed, bodyRows);

  // 4) 처마 행은 벽과 같은 폭으로 꽉 차 있어야 한다.
  let eavesFilled = 0;
  for (let x = bands.left; x <= bands.right; x += 1) if (filledAt(layers, x, eavesY)) eavesFilled += 1;
  const eavesFullWidth = ratio(eavesFilled, plan.width);

  const wall = wallBandChecks(layers, bands, families, groundTruth);
  const discipline = layerDiscipline(layers, groundTruth);
  const outside = outsideClean(layers, [bands]);
  const nineSlice = nineSliceRows(layers, bands);
  const palette = paletteClean(layers, houseKitPalette(plan.kitId));
  const structural = combine(
    [ridgeFull, ridgeOpaque, ridgeCaps, bodyTrim, eavesFullWidth, wall.isWall, wall.solid, nineSlice],
    [outside, discipline.score, palette],
  );
  const match = identity(reference, layers);
  return Object.freeze({
    axis: "roofDiagonal" as const,
    score: mean([match.score, structural]),
    method: "structural" as const,
    detail: Object.freeze({
      identity: match.score,
      structural,
      ridgeFull,
      ridgeOpaque,
      ridgeDiagonalCapsOnUpper: ridgeCaps,
      bodyTrimRows: bodyTrim,
      eavesFullWidth,
      outsideClean: outside,
      layerDiscipline: discipline.score,
      wallBandIsWall: wall.isWall,
      wallBandSolid: wall.solid,
      nineSlice,
      paletteClean: palette,
    }),
  });
}

// ── 7번 문 ────────────────────────────────────────────────────────────────

/** 문 두 벌 — 상단 → 짝이 되는 하단. */
const DOOR_PAIRS = Object.freeze([
  [DOOR_TOP_TILE, DOOR_BOTTOM_TILE],
  [329, 359],
] as const);

function scoreDoor(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const doorAt = DOOR_GRID.doorAt;
  const bottomIndex = doorAt.y * layers.width + doorAt.x;
  const topIndex = (doorAt.y - 1) * layers.width + doorAt.x;
  const top = layers.lower[topIndex] ?? EMPTY_CELL;
  const bottom = layers.lower[bottomIndex] ?? EMPTY_CELL;

  const pairAtSlot = top !== EMPTY_CELL && bottom !== EMPTY_CELL ? 1 : 0;
  const sameFamily = DOOR_PAIRS.some(([upper, lowerHalf]) => upper === top && lowerHalf === bottom) ? 1 : 0;

  // 바꾼 칸은 문 두 칸뿐이어야 한다 — 벽을 다른 데서 뚫으면 집이 새 버린다.
  let touched = 0;
  for (let index = 0; index < layers.lower.length; index += 1) {
    if ((layers.lower[index] ?? EMPTY_CELL) !== EMPTY_CELL) touched += 1;
    if ((layers.upper[index] ?? EMPTY_CELL) !== EMPTY_CELL) touched += 1;
  }
  const onlyDoorCells = touched === 2 ? 1 : ratio(2, touched);

  // 완성된 집(바탕 + 답변)에서 문 앞에 서 있을 수 있는가.
  const composite = overlay([...reference.baseLower], layers.lower);
  const frontY = doorAt.y + 1;
  const frontWalkable =
    frontY < layers.height && isWalkable(groundTruth.passFlags, composite[frontY * layers.width + doorAt.x] ?? EMPTY_CELL)
      ? 1
      : 0;

  const palette = paletteClean(layers, DOOR_PALETTE);
  // 문을 낸 것 자체(자리·짝)가 일한 항목이고, 나머지는 감점 배수다 —
  // "다른 칸을 안 건드렸다"와 "문 앞이 걸을 수 있다"는 아무것도 안 해도 참이다.
  const structural = combine([pairAtSlot, sameFamily], [onlyDoorCells, frontWalkable, palette]);
  const match = identity(reference, layers);
  return Object.freeze({
    axis: "door" as const,
    // 정본 일치는 점수에 넣지 않는다. 팔레트가 문 **두 벌**(나무·석재)을 주고 프롬프트는
    // 어느 쪽인지 말하지 않으므로 정답이 둘이다 — 석재 문을 옳게 짝지은 답을 반값으로
    // 깎으면 팔레트가 허용한 선택을 벌하는 함정이 된다(2026-08-21 교정).
    // 짝을 섞었는지는 sameFamily 가 이미 본다.
    score: structural,
    method: "structural" as const,
    detail: Object.freeze({
      identity: match.score,
      structural,
      pairAtSlot,
      sameFamily,
      onlyDoorCells,
      frontWalkable,
      paletteClean: palette,
      touchedCells: touched,
    }),
  });
}

// ── 8번 울타리 끝 ─────────────────────────────────────────────────────────

const FENCE_CORNERS_DOWN: ReadonlySet<number> = new Set([FENCE_TOP_LEFT, FENCE_TOP_RIGHT]);
const FENCE_CORNERS_UP: ReadonlySet<number> = new Set([FENCE_BOTTOM_LEFT, FENCE_BOTTOM_RIGHT]);

function scoreFence(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const fenceSet = new Set<number>(FENCE_PALETTE);
  const isFence = (x: number, y: number): boolean => {
    if (!inBounds(layers, x, y)) return false;
    const tile = layers.upper[y * layers.width + x] ?? EMPTY_CELL;
    return tile !== EMPTY_CELL && fenceSet.has(tile);
  };
  const tileAt = (x: number, y: number): number => layers.upper[y * layers.width + x] ?? EMPTY_CELL;

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < layers.height; y += 1) {
    for (let x = 0; x < layers.width; x += 1) if (isFence(x, y)) cells.push({ x, y });
  }

  // R1 가로 런(2칸 이상)의 양끝이 마감됐는가 + R1b 끝 조각의 좌우 방향이 맞는가.
  let ends = 0;
  let endsFinished = 0;
  let orientedEnds = 0;
  for (let y = 0; y < layers.height; y += 1) {
    let x = 0;
    while (x < layers.width) {
      if (!isFence(x, y)) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < layers.width && isFence(x, y)) x += 1;
      const stop = x - 1;
      if (stop === start) continue; // 1칸짜리는 세로 런의 일부일 수 있으므로 R4 가 다룬다
      for (const [edge, endTile, cornerNeedsUp, expected] of [
        [start, tileAt(start, y), FENCE_CORNERS_UP.has(tileAt(start, y)), FENCE_END_LEFT],
        [stop, tileAt(stop, y), FENCE_CORNERS_UP.has(tileAt(stop, y)), FENCE_END_RIGHT],
      ] as const) {
        ends += 1;
        const isEndPiece = endTile === FENCE_END_LEFT || endTile === FENCE_END_RIGHT;
        const isCorner = FENCE_CORNERS_UP.has(endTile) || FENCE_CORNERS_DOWN.has(endTile);
        const continues = cornerNeedsUp ? isFence(edge, y - 1) : isFence(edge, y + 1);
        if (isEndPiece || (isCorner && continues)) endsFinished += 1;
        if (!isEndPiece || endTile === expected) orientedEnds += 1;
      }
    }
  }

  // R2 모서리는 세로 런이 실제로 이어질 때만.
  let corners = 0;
  let cornersLinked = 0;
  for (const cell of cells) {
    const tile = tileAt(cell.x, cell.y);
    if (FENCE_CORNERS_UP.has(tile)) {
      corners += 1;
      if (isFence(cell.x, cell.y - 1)) cornersLinked += 1;
    } else if (FENCE_CORNERS_DOWN.has(tile)) {
      corners += 1;
      if (isFence(cell.x, cell.y + 1)) cornersLinked += 1;
    }
  }

  // R4 고아 조각 — 이웃이 아무도 없는 울타리 칸.
  let orphans = 0;
  for (const cell of cells) {
    const hasNeighbour =
      isFence(cell.x - 1, cell.y) || isFence(cell.x + 1, cell.y) || isFence(cell.x, cell.y - 1) || isFence(cell.x, cell.y + 1);
    if (!hasNeighbour) orphans += 1;
  }
  // 세로 변(408)은 위아래로 이어져야 한다 — 가로로만 붙은 408 은 깃대다.
  let sideRails = 0;
  let sideRailsLinked = 0;
  for (const cell of cells) {
    if (tileAt(cell.x, cell.y) !== FENCE_SIDE_RAIL) continue;
    sideRails += 1;
    if (isFence(cell.x, cell.y - 1) || isFence(cell.x, cell.y + 1)) sideRailsLinked += 1;
  }

  // R5 게이트(문 앞 ±1)는 열려 있어야 한다.
  const lot = expandRect(
    { x: FENCE_GRID.house.x, y: FENCE_GRID.house.y, w: FENCE_GRID.house.width, h: houseBands(FENCE_GRID.house).height },
    FENCE_LOT_MARGIN,
  );
  const gateY = lot.y + lot.h - 1;
  let gateCells = 0;
  let gateOpen = 0;
  for (let dx = -FENCE_GATE_HALF_WIDTH; dx <= FENCE_GATE_HALF_WIDTH; dx += 1) {
    const x = FENCE_GRID.doorAt.x + dx;
    if (!inBounds(layers, x, gateY)) continue;
    gateCells += 1;
    if (!isFence(x, gateY)) gateOpen += 1;
  }

  // R6 이미 채워진 상위 칸이나 길 위에 얹지 않았는가.
  let overwrites = 0;
  for (const cell of cells) {
    const index = cell.y * layers.width + cell.x;
    if ((reference.baseUpper[index] ?? EMPTY_CELL) !== EMPTY_CELL) overwrites += 1;
    else if (ROAD_TILES.has(reference.baseLower[index] ?? EMPTY_CELL)) overwrites += 1;
  }

  const rules = [
    ratio(endsFinished, ends),
    ratio(orientedEnds, ends),
    ratio(cornersLinked, corners),
    ratio(cells.length - orphans, cells.length),
    ratio(sideRailsLinked, sideRails),
    ratio(gateOpen, gateCells),
    ratio(cells.length - overwrites, cells.length),
    paletteClean(layers, FENCE_PALETTE),
  ];
  // 울타리를 한 칸도 치지 않은 답은 규칙을 "위반하지 않았"으므로 만점이 된다 —
  // 그건 채점이 아니라 허점이다. 아무것도 안 한 답은 0점으로 못 박는다.
  const built = cells.length > 0 ? 1 : 0;
  return Object.freeze({
    axis: "fenceEnd" as const,
    score: built === 0 ? 0 : mean(rules),
    method: "ruleRate" as const,
    detail: Object.freeze({
      built,
      fenceCells: cells.length,
      runEndsFinished: rules[0]!,
      endPiecesOriented: rules[1]!,
      cornersLinked: rules[2]!,
      noOrphans: rules[3]!,
      sideRailsLinked: rules[4]!,
      gateOpen: rules[5]!,
      noOverwrite: rules[6]!,
      paletteClean: rules[7]!,
      layerDiscipline: layerDiscipline(layers, groundTruth).score,
      identity: identity(reference, layers).score,
    }),
  });
}

// ── 9번 마을 ──────────────────────────────────────────────────────────────

function scoreVillage(layers: Layers, reference: PlacementReference, groundTruth: TownGroundTruth): AxisScore {
  const bands = VILLAGE_GRID.houses.map((house) => houseBands(house));
  const roadMembers = new Set<number>([...ROAD_PALETTE, ...COBBLE_PALETTE]);
  const doorTiles = new Set<number>(DOOR_PALETTE);

  const roadCells = new Set<number>();
  for (let index = 0; index < layers.lower.length; index += 1) {
    const tile = layers.lower[index] ?? EMPTY_CELL;
    if (tile !== EMPTY_CELL && roadMembers.has(tile)) roadCells.add(index);
  }

  // 1) 집마다 문이 제대로 났는가(하단 벽 행에 세로 두 칸, 같은 벌).
  let doorsPresent = 0;
  const doorFronts: { x: number; y: number }[] = [];
  for (const band of bands) {
    let found = false;
    for (let x = band.left; x <= band.right && !found; x += 1) {
      const bottom = layers.lower[band.bottom * layers.width + x] ?? EMPTY_CELL;
      const top = layers.lower[(band.bottom - 1) * layers.width + x] ?? EMPTY_CELL;
      if (!doorTiles.has(bottom)) continue;
      if (DOOR_PAIRS.some(([upperHalf, lowerHalf]) => upperHalf === top && lowerHalf === bottom)) {
        found = true;
        doorFronts.push({ x, y: band.bottom + 1 });
      }
    }
    if (found) doorsPresent += 1;
  }

  // 2) 문 앞 남쪽 3칸 안에 길이 있는가(village/audit.ts doorHasRoad 와 같은 규칙).
  let doorsConnected = 0;
  for (const front of doorFronts) {
    let connected = false;
    for (let y = front.y; y <= front.y + 2 && !connected; y += 1) {
      for (let x = front.x - 1; x <= front.x + 1 && !connected; x += 1) {
        if (!inBounds(layers, x, y)) continue;
        if (roadCells.has(y * layers.width + x)) connected = true;
      }
    }
    if (connected) doorsConnected += 1;
  }

  // 3) 길이 하나의 연결망이고 두 진입점을 잇는가.
  const components = connectedComponents(layers, roadCells);
  const entryIndices = VILLAGE_GRID.roadAnchors.map((anchor) => anchor.y * layers.width + anchor.x);
  const mainComponent = components.find((component) => component.includes(entryIndices[0]!));
  const entriesLinked = mainComponent
    ? entryIndices.filter((index) => mainComponent.includes(index)).length
    : 0;
  const roadOneNetwork = ratio(entriesLinked, entryIndices.length) * (components.length <= 1 ? 1 : 0.5);

  // 4) 집 안을 포장하지 않았는가 / 5) 집을 실제로 지었는가.
  let footprintCells = 0;
  let footprintFilledCells = 0;
  let pavedInside = 0;
  for (const band of bands) {
    for (let y = band.top; y <= band.bottom; y += 1) {
      for (let x = band.left; x <= band.right; x += 1) {
        footprintCells += 1;
        if (filledAt(layers, x, y)) footprintFilledCells += 1;
        if (roadCells.has(y * layers.width + x)) pavedInside += 1;
      }
    }
  }

  // 6) 필지에 울타리가 있는가.
  const fenceSet = new Set<number>(FENCE_PALETTE);
  let fenced = 0;
  for (const band of bands) {
    const lot = expandRect({ x: band.left, y: band.top, w: band.right - band.left + 1, h: band.height }, FENCE_LOT_MARGIN);
    let hasFence = false;
    for (let y = lot.y; y < lot.y + lot.h && !hasFence; y += 1) {
      for (let x = lot.x; x < lot.x + lot.w && !hasFence; x += 1) {
        if (!inBounds(layers, x, y)) continue;
        const onEdge = x === lot.x || x === lot.x + lot.w - 1 || y === lot.y || y === lot.y + lot.h - 1;
        if (!onEdge) continue;
        const tile = layers.upper[y * layers.width + x] ?? EMPTY_CELL;
        if (tile !== EMPTY_CELL && fenceSet.has(tile)) hasFence = true;
      }
    }
    if (hasFence) fenced += 1;
  }

  // 7) 광장을 포장했는가.
  const cobble = new Set<number>(COBBLE_PALETTE);
  let plazaCells = 0;
  let plazaPaved = 0;
  for (let y = VILLAGE_GRID.plaza.y; y < VILLAGE_GRID.plaza.y + VILLAGE_GRID.plaza.h; y += 1) {
    for (let x = VILLAGE_GRID.plaza.x; x < VILLAGE_GRID.plaza.x + VILLAGE_GRID.plaza.w; x += 1) {
      plazaCells += 1;
      if (cobble.has(layers.lower[y * layers.width + x] ?? EMPTY_CELL)) plazaPaved += 1;
    }
  }

  // 8) 진입점에서 걸어서 모든 문 앞에 닿는가.
  const walkableComposite = overlay([...layers.lower], layers.upper);
  const reachable = floodFill(layers, VILLAGE_GRID.roadAnchors, (x, y) =>
    isWalkable(groundTruth.passFlags, walkableComposite[y * layers.width + x] ?? EMPTY_CELL),
  );
  const reachedDoors = doorFronts.filter((front) => reachable.has(front.y * layers.width + front.x)).length;

  const discipline = layerDiscipline(layers, groundTruth);
  const work = {
    doorsPresent: ratio(doorsPresent, bands.length),
    doorsConnected: ratio(doorsConnected, bands.length),
    roadOneNetwork,
    housesBuilt: ratio(footprintFilledCells, footprintCells),
    fencedHouses: ratio(fenced, bands.length),
    plazaPaved: ratio(plazaPaved, plazaCells),
    doorsReachable: ratio(reachedDoors, bands.length),
  };
  const penalties = {
    housesNotPaved: ratio(footprintCells - pavedInside, footprintCells),
    layerDiscipline: discipline.score,
    noBanned: noBanned(layers, groundTruth),
  };
  return Object.freeze({
    axis: "village" as const,
    score: combine(Object.values(work), Object.values(penalties)),
    method: "structural" as const,
    detail: Object.freeze({
      ...work,
      ...penalties,
      roadComponents: components.length,
      identity: identity(reference, layers).score,
    }),
  });
}

// ── 진입점 ────────────────────────────────────────────────────────────────

export function scoreTownPlacement(input: {
  readonly answer: TownAnswer;
  readonly reference: PlacementReference;
  readonly groundTruth: TownGroundTruth;
}): AxisScore {
  const { answer, reference, groundTruth } = input;
  const axisByKey: Readonly<Record<PlacementReference["key"], TownAxisId>> = {
    treeGrid: "layer",
    roadGrid: "road",
    wallGrid: "wallOutline",
    roofGrid: "roofDiagonal",
    doorGrid: "door",
    fenceGrid: "fenceEnd",
    villageGrid: "village",
  };
  const layers = answerLayers(answer, reference);
  if (!layers) return shapeMismatch(axisByKey[reference.key], reference, answer);
  // 한 칸도 놓지 않은 답은 채점하지 않는다. 감점 항목만 만점을 받아 "아무것도
  // 안 한 답"이 0.3~0.7 을 받던 허점을 여기서 못 박는다(2026-08-21).
  if (placedCells(layers) === 0) {
    return Object.freeze({
      axis: axisByKey[reference.key],
      score: 0,
      method: "structural" as const,
      detail: Object.freeze({ placedCells: 0 }),
    });
  }

  switch (reference.key) {
    case "treeGrid":
      return scoreTrees(layers, reference, groundTruth);
    case "roadGrid":
      return scoreRoad(layers, reference, groundTruth);
    case "wallGrid":
      return scoreHouseShell(layers, reference, groundTruth);
    case "roofGrid":
      return scoreRoofDiagonal(layers, reference, groundTruth);
    case "doorGrid":
      return scoreDoor(layers, reference, groundTruth);
    case "fenceGrid":
      return scoreFence(layers, reference, groundTruth);
    case "villageGrid":
      return scoreVillage(layers, reference, groundTruth);
    default:
      throw new Error(`town scoring: 알 수 없는 배치 키 ${reference.key satisfies never}`);
  }
}
