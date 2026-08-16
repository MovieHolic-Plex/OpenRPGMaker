// benchmark/fixtures/construction.ts
// 건설(construction) 차원 d3/d5/d7 의 ground-truth 맵(todo 7).
//
// 작성 규칙(계획: "authored ONCE"):
//  - 그리드 레이아웃(형상/좌표)은 이 파일에 한 번 손으로 고정한다.
//  - 쓰이는 타일 id는 살아있는 groundTruth 세트에서 고른다(pickMember).
//    선호 id가 세트에서 빠지면 그 자리에서 throw — groundTruth 세트가 바뀌면
//    이 픽스처도 같은 변경 안에서 재작성해야 한다(stale-state 방어).
//  - 좌표계: x=열, y=행. lower/upper 는 동일 W×H (contract.ts construction 계약).
//  - 빈 칸은 -1.
import {
  FENCE_TILES,
  FLOOR_TILES,
  ROOF_TILES,
  TREE_PAIRS,
  WALL_TILES,
  type TreePair,
} from "@/benchmark/groundTruth";

/** ConstructionGrid — contract.ts의 construction 답변 형상과 동일. */
export interface ConstructionGridFixture {
  readonly lower: readonly (readonly number[])[];
  readonly upper: readonly (readonly number[])[];
}

/**
 * groundTruth 세트에서 타일 id 하나를 고른다. 선호 id가 세트에 없으면 throw
 * (픽스처가 세트와 어긋나면 조용히 넘어가지 않는다).
 */
function pickMember(set: ReadonlySet<number>, preferred: number, label: string): number {
  if (!set.has(preferred)) {
    const sorted = [...set].sort((a, b) => a - b);
    throw new Error(
      `construction fixture: ${label}에 id ${preferred} 가 groundTruth 세트에 없음 ` +
        `(현재 멤버: [${sorted.join(", ")}]) — 픽스처를 다시 작성하라`,
    );
  }
  return preferred;
}

// ── d3 하우스(12x10) ───────────────────────────────────────────────────────
// 12x10 그리드, 마킹된 바닥 영역 4x3(x=4..7, y=4..6), 그 경계를 두르는 6x5
// 벽 링(x=3..8, y=3..7), 지붕은 그 링의 북쪽(맨 윗)줄 y=3, x=3..8 위 UPPER
// 레이어 같은 칸에 — prompts.buildD3HousePrompt("roof in the upper layer on
// the top row of that wall boundary") 및 scoreHouse roofSupport 계약과 정합.

const HOUSE_WIDTH = 12;
const HOUSE_HEIGHT = 10;
const HOUSE_FLOOR_RECT = { x: 4, y: 4, width: 4, height: 3 } as const;
const HOUSE_WALL_RECT = { x: 3, y: 3, width: 6, height: 5 } as const;
const HOUSE_ROOF_ROW_Y = HOUSE_WALL_RECT.y; // 북쪽 벽줄과 같은 y

const HOUSE_WALL_TILE = pickMember(WALL_TILES, 306, "d3 하우스 벽 타일");
const HOUSE_FLOOR_TILE = pickMember(FLOOR_TILES, 240, "d3 하우스 바닥 타일");
const HOUSE_ROOF_TILE = pickMember(ROOF_TILES, 374, "d3 하우스 지붕 타일");

function buildEmptyGrid(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => -1));
}

/** 그리드를 그대로 동결해 픽스처로 노출(행 단위 추가 동결은 필요 없다). */
function freezeFixture(lower: number[][], upper: number[][]): ConstructionGridFixture {
  return Object.freeze({ lower: Object.freeze(lower), upper: Object.freeze(upper) });
}

function fillRect(
  grid: number[][],
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  tile: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      grid[y][x] = tile;
    }
  }
}

function buildHouseFixture(): ConstructionGridFixture {
  const lower = buildEmptyGrid(HOUSE_WIDTH, HOUSE_HEIGHT);
  fillRect(lower, HOUSE_WALL_RECT, HOUSE_WALL_TILE); // 벽 링(6x5 둘레)
  fillRect(lower, HOUSE_FLOOR_RECT, HOUSE_FLOOR_TILE); // 내부 바닥(4x3)
  const upper = buildEmptyGrid(HOUSE_WIDTH, HOUSE_HEIGHT);
  fillRect(upper, { x: HOUSE_WALL_RECT.x, y: HOUSE_ROOF_ROW_Y, width: HOUSE_WALL_RECT.width, height: 1 }, HOUSE_ROOF_TILE);
  return freezeFixture(lower, upper);
}

export const HOUSE_GROUND_TRUTH: ConstructionGridFixture = buildHouseFixture();

// ── d5 나무(8x6, 4그루) ────────────────────────────────────────────────────
// 침엽 2그루 + 마른나무 1그루 + 활엽 1그루. 각 나무는 (줄기=lower, 캐노피=upper,
// 같은 좌표) 1칸짜리 쌍 — TREE_PAIRS에서 살아있는 쌍 테이블을 읽는다.
// 좌표는 고정, 배치 순서는 [conifer, conifer, dry, broadleaf].

export const EXPECTED_TREE_COUNT = 4;

const TREE_GRID_WIDTH = 8;
const TREE_GRID_HEIGHT = 6;

function pairAt(index: number, label: string): TreePair {
  const pair = TREE_PAIRS[index];
  if (!pair) {
    throw new Error(`construction fixture: TREE_PAIRS[${index}](${label}) 없음 — 픽스처를 다시 작성하라`);
  }
  return pair;
}

// TREE_PAIRS 순서(groundTruth.ts): 0 침엽 260↔290, 1 마른나무 261↔291,
// 2 활엽-왼쪽 262↔292, 3 활엽-오른쪽 263↔293.
const CONIFER_PAIR = pairAt(0, "침엽");
const DRY_PAIR = pairAt(1, "마른나무");
const BROADLEAF_PAIR = pairAt(2, "활엽-왼쪽");

const TREE_POSITIONS: readonly { readonly x: number; readonly y: number; readonly pair: TreePair }[] = Object.freeze([
  Object.freeze({ x: 1, y: 1, pair: CONIFER_PAIR }),
  Object.freeze({ x: 5, y: 1, pair: CONIFER_PAIR }),
  Object.freeze({ x: 2, y: 4, pair: DRY_PAIR }),
  Object.freeze({ x: 6, y: 4, pair: BROADLEAF_PAIR }),
]);

function buildTreeFixture(): ConstructionGridFixture {
  const lower = buildEmptyGrid(TREE_GRID_WIDTH, TREE_GRID_HEIGHT);
  const upper = buildEmptyGrid(TREE_GRID_WIDTH, TREE_GRID_HEIGHT);
  for (const { x, y, pair } of TREE_POSITIONS) {
    const [canopy, trunk] = pair;
    lower[y][x] = trunk;
    upper[y][x] = canopy;
  }
  return freezeFixture(lower, upper);
}

export const TREE_GROUND_TRUTH: ConstructionGridFixture = buildTreeFixture();

// ── d7 울타리(6x5 정원) ────────────────────────────────────────────────────
// 6x5 그리드 전체가 정원 사각형(rect = {0,0,6,5}), 경계 링 전체에 울타리.
// 계획 지시대로 픽스처 링은 LOWER 레이어에 작성한다. 단 scoreFence 는 레이어를
// 가리지 않고 받는다(d7 프롬프트가 레이어를 지정하지 않음) — scoringConstruction.ts 참조.

const FENCE_TILE = pickMember(FENCE_TILES, 378, "d7 울타리 타일");

export interface ConstructionRectFixture {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const FENCE_RECT: ConstructionRectFixture = Object.freeze({ x: 0, y: 0, width: 6, height: 5 });

function isRingCell(x: number, y: number, rect: ConstructionRectFixture): boolean {
  return (
    x === rect.x || x === rect.x + rect.width - 1 || y === rect.y || y === rect.y + rect.height - 1
  );
}

function buildFenceFixture(): ConstructionGridFixture {
  const lower = buildEmptyGrid(FENCE_RECT.width, FENCE_RECT.height);
  for (let y = 0; y < FENCE_RECT.height; y += 1) {
    for (let x = 0; x < FENCE_RECT.width; x += 1) {
      if (isRingCell(x, y, FENCE_RECT)) lower[y][x] = FENCE_TILE;
    }
  }
  const upper = buildEmptyGrid(FENCE_RECT.width, FENCE_RECT.height);
  return freezeFixture(lower, upper);
}

export const FENCE_GROUND_TRUTH: ConstructionGridFixture = buildFenceFixture();
