// benchmark/inputImages.ts
// 벤치마크 입력 이미지 렌더러(todo 4): atlas / grid / shape.
//
// 안티-게이밍 하드 규칙(계획 todo 4): 이미지 위에 caption/id/라벨/텍스트를 절대
// 그리지 않는다 — 캔버스 텍스트 API(fillText/strokeText/measureText)를 호출하지
// 않으며, test/benchmarkInputImages.test.ts 의 throw-on-invoke 스파이가 이를 강제한다.
// 에디터 패널/DOM 위젯은 import 하지 않고 순수 캔버스 헬퍼만 쓴다. 허용된 렌더
// 유틸: tilesetAiTempMapImage.ts(renderTempMapImage/renderTilesetAtlasImage — 에디터와
// 동일한 타일셋 텍스처 슬라이싱 경로)와 chipsetTileRender.ts(타일 렌더링 수학 참조로만,
// Phaser 씬이 필요해 직접 import 하지 않는다 — renderTempMapImage 가 같은 경로를 재사용).
//
// 그리드 레이아웃은 todo 7 fixtures/construction.ts 의 ground-truth 맵에서 파생한다:
//   - buildHouseGrid : HOUSE_GROUND_TRUTH(12x10, floor x4..7 y4..6)의 FLOOR 멤버(바닥 마킹)만 표시.
//   - buildTreeGrid  : TREE_GROUND_TRUTH(8x6)의 차원, 모델이 나무 위치를 고르는 빈 그리드.
//   - buildFenceGrid : FENCE_RECT(6x5 전체가 정원)를 바닥 멤버(잔디)로 표시.
// 입력 그리드와 픽스처가 어긋나지 않도록 파생으로 정합시킨다(stale-state 방어).
// 마스크(d6a) 형상은 계획 todo 8(expectedAutotileGrid)과 정합: L = 행0..4 열0 + 행4 열0..3.
import { DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, TILE } from "@/project/defaults/constants";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { renderTempMapImage, renderTilesetAtlasImage } from "@/editor/panels/tilesetAiTempMapImage";
import type { GameMap } from "@/project/types";
import { FLOOR_TILES } from "./groundTruth";
import { FENCE_RECT, HOUSE_GROUND_TRUTH, TREE_GROUND_TRUTH } from "./fixtures/construction";

/** 허용 최대 타일 id(0..479). 기본 타일 그림판 DEFAULT_TILE_COUNT=480 과 정합. */
export const MAX_BENCHMARK_TILE_ID = DEFAULT_TILE_COUNT - 1;

/** 그리드 이미지의 셀 크기(px) — renderTempMapImage 의 PREVIEW_SCALE=2 와 정합(16*2=32). */
export const SHAPE_CELL_SIZE = DEFAULT_TILE_SIZE * 2;
/** shape(d6a) 렌더러 배경 — renderTempMapImage 임시맵 배경과 동일. */
export const SHAPE_BACKGROUND_COLOR = "#20232a";
/** shape(d6a) 렌더러가 L-path 셀을 칠하는 별도 마커 색. */
export const SHAPE_MARKER_COLOR = "#ffcc00";

// ── d3 하우스(12x10) 레이아웃 — fixtures/construction.ts HOUSE_GROUND_TRUTH 와 정합 ──
export const HOUSE_GRID_WIDTH = 12;
export const HOUSE_GRID_HEIGHT = 10;
export const HOUSE_FLOOR_REGION = { x: 4, y: 4, width: 4, height: 3 } as const;

// ── d5 나무(8x6) 레이아웃 — fixtures/construction.ts TREE_GROUND_TRUTH 와 정합 ──
export const TREE_GRID_WIDTH = 8;
export const TREE_GRID_HEIGHT = 6;

// ── d6a 오토타일 마스크(8x6) — 계획 todo 8 과 정합 ──
export const AUTOTILE_GRID_WIDTH = 8;
export const AUTOTILE_GRID_HEIGHT = 6;

// ── d7 울타리(6x5 정원) — fixtures/construction.ts FENCE_RECT 와 정합 ──
export const FENCE_GRID_WIDTH = FENCE_RECT.width;
export const FENCE_GRID_HEIGHT = FENCE_RECT.height;

/** 빈 셀 구분값(-1) 또는 허용 범위 id 로 구성된 그리드. lower/upper 길이 = width*height. */
export interface BenchmarkGrid {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

/** d6a 오토타일 L-path 마킹. cells 는 셀 인덱스(= y*width + x) 집합. */
export interface BenchmarkMask {
  readonly width: number;
  readonly height: number;
  readonly cells: ReadonlySet<number>;
}

// ── 유효성 검사(시스템 경계) ──────────────────────────────────────────────

function pickMember(set: ReadonlySet<number>, preferred: number, label: string): number {
  if (set.has(preferred)) return preferred;
  const sorted = [...set].sort((a, b) => a - b);
  throw new Error(
    `inputImages: ${label}에 id ${preferred} 가 groundTruth 세트에 없음 (현재 멤버: [${sorted.join(", ")}]) — 픽스처를 다시 작성하라`,
  );
}

function validateTileId(tile: number): void {
  if (tile === -1) return;
  if (!Number.isInteger(tile) || tile < 0 || tile > MAX_BENCHMARK_TILE_ID) {
    throw new Error(`inputImages: 타일 id 범위 초과 — ${tile} (허용: -1 또는 0..${MAX_BENCHMARK_TILE_ID})`);
  }
}

function validateGrid(grid: BenchmarkGrid, tileSize: number): void {
  if (!Number.isInteger(grid.width) || grid.width <= 0) {
    throw new Error("inputImages: 그리드 width 는 양의 정수여야 합니다");
  }
  if (!Number.isInteger(grid.height) || grid.height <= 0) {
    throw new Error("inputImages: 그리드 height 는 양의 정수여야 합니다");
  }
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("inputImages: tileSize 는 양의 정수여야 합니다");
  }
  const cellCount = grid.width * grid.height;
  if (grid.lower.length !== cellCount || grid.upper.length !== cellCount) {
    throw new Error("inputImages: lower/upper 길이가 width*height 와 일치하지 않습니다 (비직사각형 그리드)");
  }
  for (const tile of grid.lower) validateTileId(tile);
  for (const tile of grid.upper) validateTileId(tile);
}

function validateMask(mask: BenchmarkMask): void {
  if (!Number.isInteger(mask.width) || mask.width <= 0) {
    throw new Error("inputImages: 마스크 width 는 양의 정수여야 합니다");
  }
  if (!Number.isInteger(mask.height) || mask.height <= 0) {
    throw new Error("inputImages: 마스크 height 는 양의 정수여야 합니다");
  }
  const cellCount = mask.width * mask.height;
  for (const index of mask.cells) {
    if (!Number.isInteger(index) || index < 0 || index >= cellCount) {
      throw new Error(`inputImages: 마스크 셀 인덱스 범위 초과 — ${index} (허용: 0..${cellCount - 1})`);
    }
  }
}

// ── 렌더러 ───────────────────────────────────────────────────────────────

const SNAPSHOT_UNAVAILABLE = "Tileset snapshot canvas is unavailable";
async function benchmarkSnapshot(run: () => Promise<string>): Promise<string> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Error && error.message === SNAPSHOT_UNAVAILABLE) return "";
    throw error;
  }
}

/** d1/d2/d4/d6b — 기본 타일셋 전체 아틀라스 이미지(data URL). */
export async function renderBenchmarkAtlas(): Promise<string> {
  const tileset = defaultTileset();
  return benchmarkSnapshot(() => renderTilesetAtlasImage(tileset));
}

function buildGridMap(grid: BenchmarkGrid, tileSize: number): GameMap {
  const tileset = defaultTileset();
  return {
    events: [],
    height: grid.height,
    id: "benchmark-grid",
    lowerTiles: [...grid.lower],
    name: "benchmark construction grid",
    tileSize,
    tilesetId: tileset.id,
    upperTiles: [...grid.upper],
    width: grid.width,
  };
}

/**
 * d3/d5/d7 — 그리드(하위 레이어 먼저, 상위 레이어 위에서)를 에디터와 동일한
 * 타일셋 텍스처 슬라이싱 경로(renderTempMapImage)로 그려 PNG data URL 반환.
 * tileSize 는 기본 타일 그림판 셀 크기(16). 그리드는 검증 후 렌더(fail-fast).
 */
export async function renderGridImage(grid: BenchmarkGrid, tileSize: number = DEFAULT_TILE_SIZE): Promise<string> {
  validateGrid(grid, tileSize);
  const tileset = defaultTileset();
  return benchmarkSnapshot(() => renderTempMapImage(buildGridMap(grid, tileSize), tileset));
}

/**
 * d6a — 오토타일 L-path 마킹 이미지(data URL). 셀 id 는 표시하지 않는다(안티-게이밍).
 * L-path 셀을 별도 마커 색으로 칠한다. 2d 컨텍스트가 없으면 빈 문자열 반환.
 */
export function renderShapeImage(mask: BenchmarkMask): string {
  validateMask(mask);
  const canvas = document.createElement("canvas");
  canvas.width = mask.width * SHAPE_CELL_SIZE;
  canvas.height = mask.height * SHAPE_CELL_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = SHAPE_BACKGROUND_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = SHAPE_MARKER_COLOR;
  for (const index of mask.cells) {
    const x = index % mask.width;
    const y = Math.floor(index / mask.width);
    context.fillRect(x * SHAPE_CELL_SIZE, y * SHAPE_CELL_SIZE, SHAPE_CELL_SIZE, SHAPE_CELL_SIZE);
  }
  return canvas.toDataURL("image/png");
}

// ── 그리드 생성자(입력 5종: atlas / houseGrid / treeGrid / autotileShape / fenceGrid) ──

/**
 * d3 입력 — 12x10 그리드에 "표시된 바닥 영역"(FLOOR 멤버)만 표현. 벽/지붕은
 * 비워 모델이 경계 벽 + 지붕을 놓게 한다(HOUSE_GROUND_TRUTH 의 FLOOR 멤버에서 파생).
 */
export function buildHouseGrid(): BenchmarkGrid {
  const width = HOUSE_GRID_WIDTH;
  const height = HOUSE_GRID_HEIGHT;
  const lower = Array.from({ length: width * height }, () => -1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = HOUSE_GROUND_TRUTH.lower[y][x];
      if (tile >= 0 && FLOOR_TILES.has(tile)) {
        lower[y * width + x] = tile;
      }
    }
  }
  return { width, height, lower, upper: Array.from({ length: width * height }, () => -1) };
}

/**
 * d5 입력 — TREE_GROUND_TRUTH(8x6) 차원의 빈 그리드. 모델이 나무 4그루의 위치를
 * 자유 선택한다(프롬프트가 위치를 마킹하지 않음). id 를 넣지 않으므로 그리드는
 * 픽스처의 차원/형상과만 정합하면 된다.
 */
export function buildTreeGrid(): BenchmarkGrid {
  const width = TREE_GRID_WIDTH;
  const height = TREE_GRID_HEIGHT;
  if (TREE_GROUND_TRUTH.lower[0]?.length !== width || TREE_GROUND_TRUTH.lower.length !== height) {
    throw new Error("inputImages: d5 픽스처(TREE_GROUND_TRUTH) 차원이 상수와 어긋났다 — 픽스처를 다시 확인하라");
  }
  return {
    width,
    height,
    lower: Array.from({ length: width * height }, () => -1),
    upper: Array.from({ length: width * height }, () => -1),
  };
}

/** d6a 입력 — 8x6 L형 흙길 마킹(셀 인덱스 집합, id 는 포함하지 않음). */
export function buildAutotileMask(): BenchmarkMask {
  // 계획 todo 8 과 정합: L = 행 0..4 열 0(5칸) + 행 4 열 0..3(4칸), 겹침 (4,0) 제외 → 8칸.
  const cells = new Set<number>([0, 8, 16, 24, 32, 33, 34, 35]);
  return { width: AUTOTILE_GRID_WIDTH, height: AUTOTILE_GRID_HEIGHT, cells };
}

/**
 * d7 입력 — FENCE_RECT(6x5 전체가 정원)를 바닥 멤버(잔디)로 표시. 모델이 경계
 * 링을 따라 울타리를 놓는다(FENCE_RECT 에서 차원 파생, stale-state 방어).
 */
export function buildFenceGrid(): BenchmarkGrid {
  const width = FENCE_GRID_WIDTH;
  const height = FENCE_GRID_HEIGHT;
  const base = pickMember(FLOOR_TILES, TILE.GRASS, "d7 정원 바닥(잔디)");
  return {
    width,
    height,
    lower: Array.from({ length: width * height }, () => base),
    upper: Array.from({ length: width * height }, () => -1),
  };
}
