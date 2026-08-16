// benchmark/scoringConstruction.ts
// 건설(construction) 차원 스코어러 — d3 하우스 / d5 나무 / d7 울타리(todo 7).
//
// 공통 규칙:
//  - 그리드는 number[][] (lower/upper 동일 W×H, 빈 칸 -1, contract.ts 참조).
//    입출력 경계에서 assertRectangular 로 검증한다(malformed_input fail-fast).
//  - 통과 조건(계획): 모든 속성 체크 && cellAccuracy >= 0.8.
//  - 공허 참(vacuous pass) 방지: 지붕이 아예 없으면 roofSupport 실패, 캐노피만
//    있는 칸은 나무로 세지 않는다.
import {
  FENCE_TILES,
  ROOF_TILES,
  TREE_CANOPY_TILES,
  TREE_PAIRS,
  TREE_TRUNK_TILES,
  WALL_TILES,
} from "@/benchmark/groundTruth";
import type { ConstructionGridFixture } from "@/benchmark/fixtures/construction";
import { EXPECTED_TREE_COUNT } from "@/benchmark/fixtures/construction";
import { assertRectangular, cellAccuracy, floodFill4 } from "@/benchmark/scoringUtils";

/** 좌표계: x = 열, y = 행. */
export interface ConstructionGrid {
  readonly lower: readonly (readonly number[])[];
  readonly upper: readonly (readonly number[])[];
}

export interface ConstructionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ConstructionCheck {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface HouseScore {
  readonly kind: "house";
  readonly roofSupport: boolean;
  readonly wallEnclosure: boolean;
  readonly roofCount: number;
  readonly cellAccuracy: number;
  readonly checks: readonly ConstructionCheck[];
  readonly passed: boolean;
}

export interface TreeScore {
  readonly kind: "trees";
  readonly treeCount: number;
  readonly validTreeCount: number;
  readonly orphanCanopyCount: number;
  readonly missingCanopyCount: number;
  readonly invalidPairCells: readonly string[];
  readonly cellAccuracy: number;
  readonly checks: readonly ConstructionCheck[];
  readonly passed: boolean;
}

export interface FenceScore {
  readonly kind: "fence";
  readonly boundaryComplete: boolean;
  readonly noOffRingFence: boolean;
  readonly ringConnected: boolean;
  readonly gapCount: number;
  readonly offRingCells: readonly string[];
  readonly fenceCellCount: number;
  readonly layer: "lower" | "upper" | "both" | "none";
  readonly checks: readonly ConstructionCheck[];
  readonly passed: boolean;
}

const CELL_ACCURACY_THRESHOLD = 0.8;

function check(id: string, label: string, passed: boolean, detail?: string): ConstructionCheck {
  return { id, label, passed, detail };
}

/** 입력 그리드의 형상(lower/upper 동일 직사각형)을 검증한다. */
function validateConstructionGrid(grid: ConstructionGrid): { width: number; height: number } {
  const lower = grid.lower;
  const upper = grid.upper;
  assertRectangular(lower);
  assertRectangular(upper);
  const height = lower.length;
  const width = lower[0]?.length ?? 0;
  if (height !== upper.length || width !== (upper[0]?.length ?? 0)) {
    throw new Error(
      `construction grid: lower(${lower.length}x${width}) 와 upper(${upper.length}x${upper[0]?.length ?? 0}) 형상 불일치`,
    );
  }
  if (height === 0 || width === 0) {
    throw new Error("construction grid: empty grid");
  }
  return { width, height };
}

/**
 * lower+upper 를 세로로 이어 붙인(2H x W) 그리드로 cellAccuracy 를 잰다.
 * construction 답변은 두 레이어가 함께 정답을 이루므로, 한 레이어만 비교하면
 * 다른 레이어의 오답(예: 지붕 누락)이 점수에 반영되지 않는다.
 */
function layeredCellAccuracy(grid: ConstructionGrid, gt: ConstructionGrid): number {
  return cellAccuracy([...grid.lower, ...grid.upper], [...gt.lower, ...gt.upper]);
}

function isBoundaryCell(x: number, y: number, rect: ConstructionRect): boolean {
  return (
    x === rect.x || x === rect.x + rect.width - 1 || y === rect.y || y === rect.y + rect.height - 1
  );
}

/** rect 가 그리드 안에 온전히 들어가는지(1칸 여유 불필요). */
function validateRect(rect: ConstructionRect, width: number, height: number): void {
  if (rect.width < 1 || rect.height < 1) {
    throw new Error(`fence rect: width/height must be >= 1 (got ${rect.width}x${rect.height})`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > width || rect.y + rect.height > height) {
    throw new Error(
      `fence rect: (${rect.x},${rect.y},${rect.width},${rect.height}) is outside grid ${width}x${height}`,
    );
  }
}

/**
 * d3 하우스 채점.
 *
 * 속성 체크:
 *  - roofSupport: UPPER 의 모든 지붕 칸에 대해 같은 좌표의 LOWER 가 벽 타일.
 *    지붕이 하나도 없으면 실패(공허 참 방어 — 벽만 있는 답을 받지 않는다).
 *  - wallEnclosure: LOWER 의 벽 링이 (a) 하나의 4-연결 링이고 (b) 링 내부
 *    영역이 벽 없이 링 바깥으로 4-연결로 새어 나가지 않는다(= 닫힌 울타리).
 *    floodFill4 로 판정한다. 기준은 "링 내부 vs 링 바깥"이지 그리드 경계가
 *    아니므로, 집 바깥의 빈 칸(그리드 가장자리까지)은 누출로 치지 않는다.
 */
export function scoreHouse(
  grid: ConstructionGrid,
  gt: ConstructionGridFixture,
): HouseScore {
  const { width, height } = validateConstructionGrid(grid);

  // roofSupport — 지붕은 UPPER, 받침 벽은 LOWER, 같은 (x,y).
  let roofCount = 0;
  const unsupportedRoofCells: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!ROOF_TILES.has(grid.upper[y][x])) continue;
      roofCount += 1;
      if (!WALL_TILES.has(grid.lower[y][x])) unsupportedRoofCells.push(`${x},${y}`);
    }
  }
  const roofSupport = roofCount > 0 && unsupportedRoofCells.length === 0;

  // wallEnclosure — 벽 셀 집합으로 링/닫힘 판정.
  const isWall = (x: number, y: number) => WALL_TILES.has(grid.lower[y][x]);
  const wallCellCount = countWhere(grid.lower, width, height, (tile) => WALL_TILES.has(tile));
  const wallRingConnected = wallCellCount > 0 && countComponents(width, height, isWall) === 1;
  const enclosed = wallCellCount > 0 && floorRegionEnclosed(width, height, isWall);
  const wallEnclosure = wallRingConnected && enclosed;

  const accuracy = layeredCellAccuracy(grid, gt);

  const checks: ConstructionCheck[] = [
    check("roofSupport", "roof 칸마다 같은 칸 lower 에 벽", roofSupport,
      roofCount === 0 ? "upper 에 지붕 칸이 없음" :
      unsupportedRoofCells.length > 0 ? `벽 없는 지붕 칸: ${unsupportedRoofCells.slice(0, 5).join(" ")}` : undefined),
    check("wallEnclosure", "벽 링 4-연결 + 바닥 영역 둘러쌈", wallEnclosure,
      !wallRingConnected ? `벽이 4-연결 링이 아님(${wallCellCount}칸)` :
      !enclosed ? "벽 링이 바닥 영역을 닫지 않음" : undefined),
  ];

  return {
    kind: "house",
    roofSupport,
    wallEnclosure,
    roofCount,
    cellAccuracy: accuracy,
    checks,
    passed: checks.every((item) => item.passed) && accuracy >= CELL_ACCURACY_THRESHOLD,
  };
}

/** grid를 훑으며 predicate가 참인 칸 수를 센다. */
function countWhere(
  grid: readonly (readonly number[])[],
  width: number,
  height: number,
  predicate: (tile: number) => boolean,
): number {
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(grid[y][x])) count += 1;
    }
  }
  return count;
}

/** 4-연결 컴포넌트 개수(scoringUtils.grid 는 형상 검증용으로만 사용). */
function countComponents(
  width: number,
  height: number,
  isCell: (x: number, y: number) => boolean,
): number {
  const shape = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
  const visited = new Set<string>();
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      if (visited.has(key) || !isCell(x, y)) continue;
      const component = floodFill4(shape, { x, y }, isCell);
      for (const cellKey of component) visited.add(cellKey);
      count += 1;
    }
  }
  return count;
}

/**
 * 벽 링 내부가 링 바깥으로 새는지(= 링이 닫혀 있지 않은지) 판정한다.
 *
 * 판정 기준은 그리드 경계가 아니라 링 자체다: 12x10 그리드에서 집 바깥 빈 칸은
 * 그리드 가장자리까지 이어져도 정상이다. 비-벽 4-연결 컴포넌트 중 그리드
 * 경계에 닿지 않는 것(= 링에 갇힌 내부 영역)이 하나라도 있으면 닫힌 것이다.
 * 벽에 구멍이 나면 내부 컴포넌트가 외부(경계에 닿는) 컴포넌트와 합쳐져
 * 내부가 사라진다 → enclosed=false.
 */
function floorRegionEnclosed(
  width: number,
  height: number,
  isWall: (x: number, y: number) => boolean,
): boolean {
  const shape = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
  const nonWall = (x: number, y: number) => !isWall(x, y);
  const visited = new Set<string>();
  let interiorComponents = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      if (visited.has(key) || isWall(x, y)) continue;
      const component = floodFill4(shape, { x, y }, nonWall);
      for (const cellKey of component) visited.add(cellKey);
      if (!touchesGridEdge(component, width, height)) interiorComponents += 1;
    }
  }
  return interiorComponents >= 1;
}

function touchesGridEdge(component: ReadonlySet<string>, width: number, height: number): boolean {
  for (const key of component) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true;
  }
  return false;
}

/**
 * d5 나무 채점. 나무 = (lower 줄기 ∈ TREE_TRUNK_TILES) && (같은 좌표 upper
 * 캐노피 ∈ TREE_CANOPY_TILES) && (둘이 TREE_PAIRS 의 같은 쌍).
 * 줄기가 없는 캐노피는 나무로 세지 않는다(orphan 으로 별도 집계).
 */
export function scoreTrees(grid: ConstructionGrid, gt?: ConstructionGrid): TreeScore {
  const { width, height } = validateConstructionGrid(grid);

  const isTrunk = (tile: number) => TREE_TRUNK_TILES.has(tile);
  const canopyForTrunk = new Map<number, number>();
  for (const [canopy, trunk] of TREE_PAIRS) canopyForTrunk.set(trunk, canopy);

  const treeCells: string[] = [];
  const invalidPairCells: string[] = [];
  let missingCanopyCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const trunk = grid.lower[y][x];
      if (!isTrunk(trunk)) continue;
      const canopy = grid.upper[y][x];
      const key = `${x},${y}`;
      if (!TREE_CANOPY_TILES.has(canopy)) {
        missingCanopyCount += 1; // 줄기만 있음 → 놓인 나무 아님
        continue;
      }
      treeCells.push(key);
      if (canopyForTrunk.get(trunk) !== canopy) invalidPairCells.push(key);
    }
  }

  const orphanCanopies = collectOrphanCanopies(grid, width, height);
  const treeCount = treeCells.length;
  const validTreeCount = treeCount - invalidPairCells.length;
  const countOk = treeCount === EXPECTED_TREE_COUNT;
  const noOrphans = orphanCanopies.length === 0;

  const accuracy = gt ? layeredCellAccuracy(grid, gt) : 1;

  const checks: ConstructionCheck[] = [
    check("treeCount", `나무 수 === ${EXPECTED_TREE_COUNT}`, countOk, `실제 ${treeCount}그루`),
    check("pairCompatibility", "모든 나무가 TREE_PAIRS 호환 쌍", invalidPairCells.length === 0,
      invalidPairCells.length > 0 ? `비호환 쌍 칸: ${invalidPairCells.slice(0, 5).join(" ")}` : undefined),
    check("noOrphanCanopy", "줄기 없는 캐노피 없음", noOrphans,
      orphanCanopies.length > 0 ? `고아 캐노피: ${orphanCanopies.slice(0, 5).join(" ")}` : undefined),
  ];

  return {
    kind: "trees",
    treeCount,
    validTreeCount,
    orphanCanopyCount: orphanCanopies.length,
    missingCanopyCount,
    invalidPairCells,
    cellAccuracy: accuracy,
    checks,
    passed: checks.every((item) => item.passed) && accuracy >= CELL_ACCURACY_THRESHOLD,
  };
}

/** 줄기 없이 upper 에만 캐노피가 있는 칸 좌표 목록. */
function collectOrphanCanopies(grid: ConstructionGrid, width: number, height: number): string[] {
  const orphans: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (TREE_CANOPY_TILES.has(grid.upper[y][x]) && !TREE_TRUNK_TILES.has(grid.lower[y][x])) {
        orphans.push(`${x},${y}`);
      }
    }
  }
  return orphans;
}

/**
 * d7 울타리 채점.
 *
 * LAYER-ACCEPTANCE RULE(계획 COORDINATION NOTE): d7 프롬프트
 * ("place fence tiles along the rectangle boundary")은 레이어를 지정하지
 * 않는다. 모델은 링을 lower 또는 upper 어느 쪽에든 놓을 수 있으므로, 경계
 * 칸은 "두 레이어 중 하나에 울타리 타일"이면 충분하다고 판정한다. 픽스처는
 * lower 에 링을 두지만 채점은 레이어 무관이다. 반대로 링 밖 칸(두 레이어 모두)에
 * 울타리가 있으면 실패시킨다.
 *
 * 체크:
 *  - boundaryComplete: 경계 링의 모든 칸이 (어느 레이어에서든) 울타리.
 *  - noOffRingFence: 링 밖 칸에는 lower/upper 모두 울타리가 없다.
 *  - ringConnected: 울타리 칸 집합이 4-연결 하나(구멍 허용분 ≤1: gapCount 로
 *    별도 집계, 2개 이상이면 실패).
 */
export function scoreFence(grid: ConstructionGrid, rect: ConstructionRect): FenceScore {
  const { width, height } = validateConstructionGrid(grid);
  validateRect(rect, width, height);

  const fenceAt = (x: number, y: number) =>
    FENCE_TILES.has(grid.lower[y][x]) || FENCE_TILES.has(grid.upper[y][x]);

  const gaps: string[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (!isBoundaryCell(x, y, rect)) continue;
      if (!fenceAt(x, y)) gaps.push(`${x},${y}`);
    }
  }

  const offRingCells: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inRect = x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
      if (inRect && isBoundaryCell(x, y, rect)) continue;
      if (FENCE_TILES.has(grid.lower[y][x]) || FENCE_TILES.has(grid.upper[y][x])) {
        offRingCells.push(`${x},${y}`);
      }
    }
  }

  const components = countComponents(width, height, fenceAt);

  const boundaryComplete = gaps.length === 0;
  const noOffRingFence = offRingCells.length === 0;
  const ringConnected = components === 1 && gaps.length <= 1;

  const layer = detectFenceLayer(grid, width, height);

  const checks: ConstructionCheck[] = [
    check("boundaryComplete", "경계 링 전체 칸에 울타리(lower 또는 upper)", boundaryComplete,
      gaps.length > 0 ? `빈 경계 칸: ${gaps.slice(0, 5).join(" ")}` : undefined),
    check("noOffRingFence", "링 밖 칸에 울타리 없음", noOffRingFence,
      offRingCells.length > 0 ? `링 밖 울타리 칸: ${offRingCells.slice(0, 5).join(" ")}` : undefined),
    check("ringConnected", "링 4-연결(구멍 ≤1)", ringConnected,
      components !== 1 ? `울타리 4-연결 컴포넌트 ${components}개` :
      gaps.length > 1 ? `구멍 ${gaps.length}개` : undefined),
  ];

  return {
    kind: "fence",
    boundaryComplete,
    noOffRingFence,
    ringConnected,
    gapCount: gaps.length,
    offRingCells,
    fenceCellCount: countFenceCells(grid, width, height),
    layer,
    checks,
    passed: checks.every((item) => item.passed),
  };
}

function countFenceCells(grid: ConstructionGrid, width: number, height: number): number {
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (FENCE_TILES.has(grid.lower[y][x]) || FENCE_TILES.has(grid.upper[y][x])) count += 1;
    }
  }
  return count;
}

function detectFenceLayer(
  grid: ConstructionGrid,
  width: number,
  height: number,
): "lower" | "upper" | "both" | "none" {
  let inLower = false;
  let inUpper = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (FENCE_TILES.has(grid.lower[y][x])) inLower = true;
      if (FENCE_TILES.has(grid.upper[y][x])) inUpper = true;
    }
  }
  if (inLower && inUpper) return "both";
  if (inLower) return "lower";
  if (inUpper) return "upper";
  return "none";
}
