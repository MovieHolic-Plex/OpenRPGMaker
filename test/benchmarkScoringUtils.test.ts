// benchmarkScoringUtils.test.ts
// 벤치마크 스코어링 유틸(순수 함수)에 대한 계약 테스트.
// todo 5 — TDD: 테스트를 먼저 작성하고, 구현은 그다음.
import { describe, expect, it } from "vitest";

import {
  assertRectangular,
  cellAccuracy,
  countConnectedComponents,
  f1,
  floodFill4,
  jaccard,
  normalizeName,
  perClassIoU,
  precision,
  recall,
  setDiff,
} from "@/benchmark/scoringUtils";

describe("precision / recall / f1", () => {
  it("완벽 일치: f1=1, precision=1, recall=1", () => {
    expect(f1([306], [306])).toBe(1);
    expect(precision([306], [306])).toBe(1);
    expect(recall([306], [306])).toBe(1);
    expect(f1([306, 426, 87], [426, 87, 306])).toBe(1);
  });

  it("완전히 분리: 0", () => {
    expect(f1([1], [2])).toBe(0);
    expect(precision([1], [2])).toBe(0);
    expect(recall([1], [2])).toBe(0);
  });

  it("부분 일치: f1 = 0.5 케이스", () => {
    // 교집합 1개, 각 집합 크기 2 → precision 0.5, recall 0.5 → f1 0.5
    expect(f1([1, 2], [1, 3])).toBe(0.5);
    expect(precision([1, 2], [1, 3])).toBe(0.5);
    expect(recall([1, 2], [1, 3])).toBe(0.5);
  });

  it("빈 pred vs 빈 truth = 1.0 (NaN 금지)", () => {
    expect(f1([], [])).toBe(1);
    expect(precision([], [])).toBe(1);
    expect(recall([], [])).toBe(1);
    expect(Number.isNaN(f1([], []))).toBe(false);
  });

  it("빈 pred vs 비어있지 않은 truth = 0 (NaN 금지)", () => {
    expect(f1([], [306])).toBe(0);
    expect(precision([], [306])).toBe(0);
    expect(recall([], [306])).toBe(0);
    expect(Number.isNaN(f1([], [306]))).toBe(false);
    expect(Number.isFinite(f1([], [306]))).toBe(true);
  });
});

describe("jaccard", () => {
  it("완벽 일치 = 1", () => {
    expect(jaccard([306, 426], [426, 306])).toBe(1);
  });

  it("완전히 분리 = 0", () => {
    expect(jaccard([1], [2])).toBe(0);
  });

  it("부분 일치: 0.5 케이스 (부분집합)", () => {
    expect(jaccard([1], [1, 2])).toBe(0.5);
    expect(jaccard([1, 2], [1])).toBe(0.5);
  });

  it("두 집합 모두 빈 경우 = 1 (NaN 금지)", () => {
    expect(jaccard([], [])).toBe(1);
    expect(Number.isNaN(jaccard([], []))).toBe(false);
  });

  it("한쪽만 빈 경우 = 0 (NaN 금지)", () => {
    expect(jaccard([], [306])).toBe(0);
    expect(jaccard([306], [])).toBe(0);
    expect(Number.isNaN(jaccard([], [306]))).toBe(false);
  });
});

describe("cellAccuracy", () => {
  it("완벽 일치 = 1", () => {
    const a = [
      [306, 306],
      [306, 306],
    ];
    const b = [
      [306, 306],
      [306, 306],
    ];
    expect(cellAccuracy(a, b)).toBe(1);
  });

  it("완전히 다른 그리드 = 0", () => {
    const a = [
      [1, 1],
      [1, 1],
    ];
    const b = [
      [2, 2],
      [2, 2],
    ];
    expect(cellAccuracy(a, b)).toBe(0);
  });

  it("절반 일치 = 0.5", () => {
    const a = [
      [1, 1],
      [2, 2],
    ];
    const b = [
      [1, 1],
      [1, 1],
    ];
    expect(cellAccuracy(a, b)).toBe(0.5);
  });

  it("둘 다 빈 그리드 = 1 (공허 참, NaN 금지)", () => {
    expect(cellAccuracy([], [])).toBe(1);
    expect(Number.isNaN(cellAccuracy([], []))).toBe(false);
  });

  it("형상이 다르면 throw", () => {
    const a = [
      [1, 1],
      [1, 1],
    ];
    const b = [
      [1, 1, 1],
      [1, 1, 1],
    ];
    expect(() => cellAccuracy(a, b)).toThrow();
  });
});

describe("perClassIoU", () => {
  it("모든 클래스 완벽 = 1", () => {
    expect(
      perClassIoU(
        new Map([
          ["wall", [306, 426]],
          ["floor", [240, 360]],
        ]),
        new Map([
          ["wall", [426, 306]],
          ["floor", [360, 240]],
        ]),
      ),
    ).toBe(1);
  });

  it("클래스별 IoU의 평균 (완벽 1 + 분리 0 → 0.5)", () => {
    expect(
      perClassIoU(
        new Map([
          ["wall", [306]],
          ["floor", [240]],
        ]),
        new Map([
          ["wall", [306]],
          ["floor", [360]],
        ]),
      ),
    ).toBe(0.5);
  });

  it("한쪽에만 있는 클래스는 빈 집합으로 취급", () => {
    expect(
      perClassIoU(
        new Map([["wall", [306]]]),
        new Map([
          ["wall", [306]],
          ["roof", [374]],
        ]),
      ),
    ).toBe(0.5); // wall 1.0 + roof 0.0 → 평균 0.5
  });

  it("클래스가 전혀 없으면 1 (NaN 금지)", () => {
    expect(perClassIoU(new Map(), new Map())).toBe(1);
    expect(Number.isNaN(perClassIoU(new Map(), new Map()))).toBe(false);
  });
});

describe("normalizeName", () => {
  it("소문자/trim/괄호 제거", () => {
    expect(normalizeName("  Dirt Road (Auto)  ")).toBe("dirt road");
    expect(normalizeName("  FLOOR  ")).toBe("floor");
    expect(normalizeName("벽 (Wall)")).toBe("벽");
    expect(normalizeName("Grass(Plain)")).toBe("grass");
  });
});

describe("setDiff", () => {
  it("a - b 를 Set으로 반환", () => {
    expect(setDiff([1, 2, 3], [2, 3])).toEqual(new Set([1]));
    expect(setDiff([1, 2], [1, 2])).toEqual(new Set());
    expect(setDiff([], [1, 2])).toEqual(new Set());
  });
});

describe("assertRectangular", () => {
  it("직사각형 그리드는 통과", () => {
    expect(() => assertRectangular([[1, 2], [3, 4]])).not.toThrow();
    expect(() => assertRectangular([])).not.toThrow();
  });

  it("비직사각형(들쭉날쭉)은 throw", () => {
    expect(() => assertRectangular([[1, 2], [3]])).toThrow();
  });
});

describe("floodFill4", () => {
  // L 모양: (0,0),(1,0),(2,0),(0,1) — 4칸
  const lShape = [
    [1, 1, 1],
    [1, 0, 0],
    [0, 0, 0],
  ];
  const isCell = (x: number, y: number) => lShape[y][x] === 1;

  it("L 모양에서 시작점에서 4-연결된 칸 수를 센다", () => {
    expect(floodFill4(lShape, { x: 0, y: 0 }, isCell).size).toBe(4);
    expect(floodFill4(lShape, { x: 2, y: 0 }, isCell).size).toBe(4);
    expect(floodFill4(lShape, { x: 0, y: 1 }, isCell).size).toBe(4);
  });

  it("비-셀에서 시작하면 빈 집합", () => {
    expect(floodFill4(lShape, { x: 1, y: 1 }, isCell).size).toBe(0);
  });

  it("범위 밖 시작점은 throw", () => {
    expect(() => floodFill4(lShape, { x: 5, y: 5 }, isCell)).toThrow();
  });

  it("두 섬은 서로 연결되지 않는다", () => {
    const twoIslands = [
      [1, 0, 0],
      [0, 0, 1],
      [0, 0, 1],
    ];
    const isTwoIsland = (x: number, y: number) => twoIslands[y][x] === 1;
    expect(floodFill4(twoIslands, { x: 0, y: 0 }, isTwoIsland).size).toBe(1);
    expect(floodFill4(twoIslands, { x: 2, y: 1 }, isTwoIsland).size).toBe(2);
  });
});

describe("countConnectedComponents", () => {
  it("L 모양 = 1 컴포넌트", () => {
    const lShape = [
      [1, 1, 1],
      [1, 0, 0],
      [0, 0, 0],
    ];
    expect(countConnectedComponents(lShape, (x, y) => lShape[y][x] === 1)).toBe(1);
  });

  it("두 섬 = 2 컴포넌트", () => {
    const twoIslands = [
      [1, 0, 0],
      [0, 0, 1],
      [0, 0, 1],
    ];
    expect(countConnectedComponents(twoIslands, (x, y) => twoIslands[y][x] === 1)).toBe(2);
  });

  it("빈 그리드 = 0", () => {
    expect(countConnectedComponents([], () => true)).toBe(0);
  });
});
