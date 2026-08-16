// benchmarkInputImages.test.ts
// 벤치마크 입력 이미지 렌더러(todo 4) 계약 테스트 — TDD: 구현 전에 먼저 작성.
// .omo/plans/tileset-vision-benchmark.md todo 4의 수용 기준을 그대로 옮긴다.
//
// 캔버스는 vitest(node 환경)에서 사용할 수 없으므로 `document.createElement("canvas")`를
// 스텁하고, 그 2d 컨텍스트의 fillText/strokeText/measureText는 호출되면 throw하는
// 스파이로 만든다 → 렌더러가 어떤 텍스트 API도 호출하지 않고 완료해야 한다(안티-게이밍:
// 이미지에 caption/id/라벨을 절대 그리지 않음). getContext("2d")가 null을 반환하면
// data-URL 단언은 건너뛰되 렌더러는 여전히 실행되어야 한다.
//
// 순수 그리드-수학 헬퍼는 그리드 생성자가 올바른 차원/직사각형성/마스크 L형 셀 개수를
// 반환하는지 단언한다. 범위 밖 id를 가진 그리드는 throw해야 한다.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTOTILE_GRID_HEIGHT,
  AUTOTILE_GRID_WIDTH,
  buildAutotileMask,
  buildFenceGrid,
  buildHouseGrid,
  buildTreeGrid,
  FENCE_GRID_HEIGHT,
  FENCE_GRID_WIDTH,
  HOUSE_FLOOR_REGION,
  HOUSE_GRID_HEIGHT,
  HOUSE_GRID_WIDTH,
  MAX_BENCHMARK_TILE_ID,
  renderBenchmarkAtlas,
  renderGridImage,
  renderShapeImage,
  SHAPE_CELL_SIZE,
  SHAPE_MARKER_COLOR,
  TREE_GRID_HEIGHT,
  TREE_GRID_WIDTH,
  type BenchmarkGrid,
} from "@/benchmark/inputImages";
import { FENCE_RECT, HOUSE_GROUND_TRUTH, TREE_GROUND_TRUTH } from "@/benchmark/fixtures/construction";
import { FLOOR_TILES } from "@/benchmark/groundTruth";

// ── DOM/Image 스텁 헬퍼 ────────────────────────────────────────────────

/** 텍스트 API가 호출되면 throw하는 + drawImage/fillRect를 기록하는 스파이 컨텍스트. */
function makeSpyContext(throwOnText: boolean): {
  fillStyle: string;
  imageSmoothingEnabled: boolean;
  fillRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillText: () => void;
  strokeText: () => void;
  measureText: () => void;
  fillRects: Array<[number, number, number, number]>;
} {
  const fillRects: Array<[number, number, number, number]> = [];
  const textThrower = (name: string) => () => {
    throw new Error(`canvas text API invoked: ${name}`);
  };
  return {
    fillStyle: "",
    imageSmoothingEnabled: true,
    fillRect: vi.fn((...args: [number, number, number, number]) => {
      fillRects.push(args);
    }),
    drawImage: vi.fn(),
    fillText: throwOnText ? textThrower("fillText") : vi.fn(),
    strokeText: throwOnText ? textThrower("strokeText") : vi.fn(),
    measureText: throwOnText ? textThrower("measureText") : vi.fn(),
    fillRects,
  };
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _srcValue = "";
  set src(value: string) {
    this._srcValue = value;
    queueMicrotask(() => this.onload?.());
  }
  get src(): string {
    return this._srcValue;
  }
}

/** document.createElement("canvas")를 2d 컨텍스트로 스텁. ctx가 null이면 getContext 는 null. */
function installDomStubs(ctx: unknown): void {
  const canvas = {
    width: 0,
    height: 0,
    getContext: (_type: string) => ctx,
    toDataURL: (_mime: string) => "data:image/png;base64,BENCHMARK_STUB",
  };
  vi.stubGlobal("document", { createElement: (tag: string) => (tag === "canvas" ? canvas : ({} as HTMLElement)) });
  vi.stubGlobal("Image", FakeImage);
}

const PNG_URL_RE = /^data:image\/png/;

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── 순수 그리드-수학 헬퍼 ────────────────────────────────────────────────

function cellRectsFor(mask: { width: number; cells: ReadonlySet<number> }): Array<[number, number, number, number]> {
  const rects: Array<[number, number, number, number]> = [];
  for (const index of mask.cells) {
    const x = index % mask.width;
    const y = Math.floor(index / mask.width);
    rects.push([x * SHAPE_CELL_SIZE, y * SHAPE_CELL_SIZE, SHAPE_CELL_SIZE, SHAPE_CELL_SIZE]);
  }
  return rects;
}

describe("benchmark input images — pure grid-math helpers", () => {
  it("buildHouseGrid 는 픽스처와 같은 12x10 차원, 바닥 영역(grass)만 표시, 직사각형", () => {
    const grid = buildHouseGrid();
    expect(grid.width).toBe(HOUSE_GRID_WIDTH);
    expect(grid.height).toBe(HOUSE_GRID_HEIGHT);
    const cellCount = grid.width * grid.height;
    expect(grid.lower).toHaveLength(cellCount); // 직사각형성: lower/upper = width*height
    expect(grid.upper).toHaveLength(cellCount);
    expect(grid.upper.every((tile) => tile === -1)).toBe(true);
    const floorSet = new Set(FLOOR_TILES);
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const idx = y * grid.width + x;
        const inRegion =
          x >= HOUSE_FLOOR_REGION.x &&
          x < HOUSE_FLOOR_REGION.x + HOUSE_FLOOR_REGION.width &&
          y >= HOUSE_FLOOR_REGION.y &&
          y < HOUSE_FLOOR_REGION.y + HOUSE_FLOOR_REGION.height;
        if (inRegion) {
          expect(floorSet.has(grid.lower[idx])).toBe(true); // 표시된 바닥 영역은 FLOOR 멤버
        } else {
          expect(grid.lower[idx]).toBe(-1); // 그 외 빈 칸
        }
      }
    }
  });

  it("buildHouseGrid 는 픽스처(HOUSE_GROUND_TRUTH)의 바닥 영역과 정확히 일치", () => {
    const grid = buildHouseGrid();
    // 입력 = 픽스처에서 FLOOR 멤버(바닥 마킹)만 남기고 벽/지붕은 비운 형태.
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const idx = y * grid.width + x;
        const fixtureTile = HOUSE_GROUND_TRUTH.lower[y][x];
        const expected = fixtureTile >= 0 && FLOOR_TILES.has(fixtureTile) ? fixtureTile : -1;
        expect(grid.lower[idx]).toBe(expected);
      }
    }
  });

  it("buildTreeGrid 는 픽스처와 같은 8x6 차원, 빈 그리드", () => {
    const grid = buildTreeGrid();
    expect(grid.width).toBe(TREE_GRID_WIDTH);
    expect(grid.height).toBe(TREE_GRID_HEIGHT);
    const cellCount = grid.width * grid.height;
    expect(grid.lower).toHaveLength(cellCount);
    expect(grid.upper).toHaveLength(cellCount);
    // d5 입력은 모델이 나무 위치를 자유 선택하는 빈 그리드여야 한다(픽스처 차원과 정합).
    expect(grid.lower.every((tile) => tile === -1)).toBe(true);
    expect(grid.upper.every((tile) => tile === -1)).toBe(true);
    expect(grid.width).toBe(TREE_GROUND_TRUTH.lower[0].length);
    expect(grid.height).toBe(TREE_GROUND_TRUTH.lower.length);
  });

  it("buildFenceGrid 는 정원 사각형(FENCE_RECT, 6x5 전체 그리드)을 바닥 멤버로 표시", () => {
    const grid = buildFenceGrid();
    expect(grid.width).toBe(FENCE_GRID_WIDTH);
    expect(grid.height).toBe(FENCE_GRID_HEIGHT);
    expect(FENCE_RECT.width).toBe(FENCE_GRID_WIDTH);
    expect(FENCE_RECT.height).toBe(FENCE_GRID_HEIGHT);
    const cellCount = grid.width * grid.height;
    expect(grid.lower).toHaveLength(cellCount);
    expect(grid.upper).toHaveLength(cellCount);
    const floorSet = new Set(FLOOR_TILES);
    expect(grid.lower.every((tile) => floorSet.has(tile))).toBe(true); // 마킹된 정원 전체가 바닥 멤버
    expect(grid.upper.every((tile) => tile === -1)).toBe(true);
  });

  it("buildAutotileMask 는 8x6, L형 8칸(행0..4 열0 + 행4 열0..3)", () => {
    const mask = buildAutotileMask();
    expect(mask.width).toBe(AUTOTILE_GRID_WIDTH);
    expect(mask.height).toBe(AUTOTILE_GRID_HEIGHT);
    expect(mask.cells).toEqual(new Set([0, 8, 16, 24, 32, 33, 34, 35]));
    expect(mask.cells.size).toBe(8);
    for (const index of mask.cells) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(mask.width * mask.height);
    }
  });

  it("L형 마스크 셀이 정확히 8개(행0..4 열0 + 행4 열0..3)", () => {
    const mask = buildAutotileMask();
    // 행 0..4, 열 0 → (0,0),(1,0),(2,0),(3,0),(4,0)
    const expected = new Set<number>();
    for (let row = 0; row <= 4; row += 1) expected.add(row * mask.width + 0);
    for (let col = 0; col <= 3; col += 1) expected.add(4 * mask.width + col);
    expect(expected.size).toBe(8);
    expect(mask.cells).toEqual(expected);
  });
});

// ── 범위 밖 / 잘못된 입력 ────────────────────────────────────────────────

describe("benchmark input images — out-of-range / malformed input", () => {
  it("그리드 id 480(== MAX, 범위 밖)이면 renderGridImage 가 throw", async () => {
    installDomStubs(makeSpyContext(false));
    const bad: BenchmarkGrid = {
      width: 2,
      height: 2,
      lower: [0, 1, 2, MAX_BENCHMARK_TILE_ID + 1],
      upper: [-1, -1, -1, -1],
    };
    await expect(renderGridImage(bad)).rejects.toThrow();
  });

  it("비정수 / 음수 그리드 id 도 throw", async () => {
    installDomStubs(makeSpyContext(false));
    const bad: BenchmarkGrid = {
      width: 2,
      height: 2,
      lower: [0, 1, 2, 1.5],
      upper: [-1, -1, -1, -1],
    };
    await expect(renderGridImage(bad)).rejects.toThrow();
  });

  it("비직사각형 그리드(lower/upper 길이 != width*height) 는 throw", async () => {
    installDomStubs(makeSpyContext(false));
    const bad: BenchmarkGrid = {
      width: 3,
      height: 3,
      lower: [0, 1, 2],
      upper: [-1, -1, -1],
    };
    await expect(renderGridImage(bad)).rejects.toThrow();
  });

  it("마스크 셀 인덱스가 범위 밖이면 renderShapeImage 가 throw", () => {
    expect(() => renderShapeImage({ width: 2, height: 2, cells: new Set([0, 5]) })).toThrow();
    expect(() => renderShapeImage({ width: 1, height: 1, cells: new Set([1]) })).toThrow();
  });

  it("생성자가 내놓은 그리드/마스크는 모두 유효하다(self-check)", async () => {
    installDomStubs(makeSpyContext(false));
    for (const grid of [buildHouseGrid(), buildTreeGrid(), buildFenceGrid()]) {
      await expect(renderGridImage(grid)).resolves.toEqual(expect.any(String));
    }
    expect(renderShapeImage(buildAutotileMask())).toEqual(expect.any(String));
  });
});

// ── 안티-게이밍: 텍스트 API 금지 스파이 ──────────────────────────────────

describe("benchmark input images — no-caption (text API) guard", () => {
  it("atlas 렌더러가 텍스트 API 없이 완료하고 PNG data URL 반환", async () => {
    const ctx = makeSpyContext(true); // fillText/strokeText/measureText 호출 시 throw
    installDomStubs(ctx);
    const url = await renderBenchmarkAtlas();
    expect(url).toMatch(PNG_URL_RE); // getContext 가 존재하면 data URL
    // throw-on-invoke 스파이가 터지지 않았음 = 텍스트 API 호출 없음.
  });

  it("grid 렌더러(하우스/나무/울타리)가 텍스트 API 없이 완료하고 PNG data URL 반환", async () => {
    const ctx = makeSpyContext(true);
    installDomStubs(ctx);
    for (const grid of [buildHouseGrid(), buildTreeGrid(), buildFenceGrid()]) {
      const url = await renderGridImage(grid);
      expect(url).toMatch(PNG_URL_RE);
    }
  });

  it("shape 렌더러가 텍스트 API 없이 완료하고 L형 셀에 마커 색을 칠한다", () => {
    const ctx = makeSpyContext(true);
    installDomStubs(ctx);
    const mask = buildAutotileMask();
    const url = renderShapeImage(mask);
    expect(url).toMatch(PNG_URL_RE);
    expect(ctx.fillStyle).toBe(SHAPE_MARKER_COLOR); // 마커 색 사용
    const expectedRects = cellRectsFor(mask);
    for (const rect of expectedRects) {
      expect(ctx.fillRects).toContainEqual(rect); // L형 8칸 모두 마커 사각형
    }
  });
});

// ── getContext null ───────────────────────────────────────────────────────

describe("benchmark input images — null 2d context (data-URL 단언 생략)", () => {
  it("getContext(\"2d\")가 null이면 렌더러는 여전히 실행된다(빈 문자열 반환)", async () => {
    installDomStubs(null);
    const atlas = await renderBenchmarkAtlas();
    expect(typeof atlas).toBe("string");

    const grid = await renderGridImage(buildHouseGrid());
    expect(typeof grid).toBe("string");

    const shape = renderShapeImage(buildAutotileMask());
    expect(typeof shape).toBe("string");
  });
});
