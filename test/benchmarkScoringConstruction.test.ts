// benchmarkScoringConstruction.test.ts
// 건설(construction) 차원 스코어러 계약 테스트 — d3 집 / d5 나무 / d7 울타리.
// todo 7 — TDD: 이 파일을 먼저 작성 → RED → 구현 → GREEN.
import { describe, expect, it } from "vitest";

import {
  FENCE_TILES,
  FLOOR_TILES,
  ROOF_TILES,
  TREE_CANOPY_TILES,
  TREE_PAIRS,
  TREE_TRUNK_TILES,
  WALL_TILES,
} from "@/benchmark/groundTruth";
import {
  EXPECTED_TREE_COUNT,
  FENCE_GROUND_TRUTH,
  FENCE_RECT,
  HOUSE_GROUND_TRUTH,
  TREE_GROUND_TRUTH,
} from "@/benchmark/fixtures/construction";
import type { ConstructionGrid, ConstructionRect } from "@/benchmark/scoringConstruction";
import { scoreFence, scoreHouse, scoreTrees } from "@/benchmark/scoringConstruction";

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

type MutableGrid = { lower: number[][]; upper: number[][] };

function cloneGrid(grid: ConstructionGrid): MutableGrid {
  return {
    lower: grid.lower.map((row) => [...row]),
    upper: grid.upper.map((row) => [...row]),
  };
}

function boundaryCells(rect: ConstructionRect): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const onRing =
        x === rect.x || x === rect.x + rect.width - 1 || y === rect.y || y === rect.y + rect.height - 1;
      if (onRing) cells.push({ x, y });
    }
  }
  return cells;
}

function trunkCellsOf(grid: ConstructionGrid): { x: number; y: number; trunk: number; canopy: number }[] {
  const found: { x: number; y: number; trunk: number; canopy: number }[] = [];
  for (let y = 0; y < grid.lower.length; y += 1) {
    for (let x = 0; x < grid.lower[y].length; x += 1) {
      if (TREE_TRUNK_TILES.has(grid.lower[y][x])) {
        found.push({ x, y, trunk: grid.lower[y][x], canopy: grid.upper[y][x] });
      }
    }
  }
  return found;
}

// ── fixtures: 살아있는 groundTruth 세트에서 파생(stale-state 방어) ──────────

describe("construction fixtures (groundTruth 파생)", () => {
  it("d3 하우스: 12x10, 벽/바닥/지붕 타일이 모두 살아있는 세트 멤버", () => {
    expect(HOUSE_GROUND_TRUTH.lower.length).toBe(10);
    expect(HOUSE_GROUND_TRUTH.lower[0].length).toBe(12);
    expect(HOUSE_GROUND_TRUTH.upper.length).toBe(10);
    expect(HOUSE_GROUND_TRUTH.upper[0].length).toBe(12);

    let wallCells = 0;
    let floorCells = 0;
    let roofCells = 0;
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        const lowerTile = HOUSE_GROUND_TRUTH.lower[y][x];
        if (WALL_TILES.has(lowerTile)) wallCells += 1;
        if (FLOOR_TILES.has(lowerTile)) floorCells += 1;
        if (ROOF_TILES.has(HOUSE_GROUND_TRUTH.upper[y][x])) roofCells += 1;
      }
    }
    // 6x5 링 - 4x3 내부 = 18 벽, 내부 바닥 12, 북쪽 벽줄 위 지붕 6.
    expect(wallCells).toBe(18);
    expect(floorCells).toBe(12);
    expect(roofCells).toBe(6);
    // 지붕은 upper, 같은 칸의 lower는 벽(roofSupport 계약과 정합).
    for (let x = 3; x <= 8; x += 1) {
      expect(ROOF_TILES.has(HOUSE_GROUND_TRUTH.upper[3][x])).toBe(true);
      expect(WALL_TILES.has(HOUSE_GROUND_TRUTH.lower[3][x])).toBe(true);
    }
  });

  it("d5 나무: 4그루(침엽 2 / 마른나무 1 / 활엽 1), 쌍이 TREE_PAIRS 멤버", () => {
    const trees = trunkCellsOf(TREE_GROUND_TRUTH);
    expect(trees.length).toBe(EXPECTED_TREE_COUNT);
    expect(EXPECTED_TREE_COUNT).toBe(4);

    const pairOf = (trunk: number, canopy: number) =>
      TREE_PAIRS.some(([c, t]) => c === canopy && t === trunk);
    for (const tree of trees) {
      expect(TREE_TRUNK_TILES.has(tree.trunk)).toBe(true);
      expect(TREE_CANOPY_TILES.has(tree.canopy)).toBe(true);
      expect(pairOf(tree.trunk, tree.canopy)).toBe(true);
    }
    // 침엽 2(260/290) + 마른나무 1(261/291) + 활엽 1(262/292).
    const conifer = trees.filter((t) => t.trunk === 290).length;
    const dry = trees.filter((t) => t.trunk === 291).length;
    const broadleaf = trees.filter((t) => t.trunk === 292).length;
    expect(conifer).toBe(2);
    expect(dry).toBe(1);
    expect(broadleaf).toBe(1);
  });

  it("d7 울타리: 6x5 사각형, 경계 링 전체가 lower에 울타리 타일", () => {
    expect(FENCE_RECT.width).toBe(6);
    expect(FENCE_RECT.height).toBe(5);
    expect(FENCE_GROUND_TRUTH.lower.length).toBe(5);
    expect(FENCE_GROUND_TRUTH.lower[0].length).toBe(6);

    for (const { x, y } of boundaryCells(FENCE_RECT)) {
      expect(FENCE_TILES.has(FENCE_GROUND_TRUTH.lower[y][x])).toBe(true);
    }
    // 링 밖(내부 정원)에는 울타리가 없다.
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 4; x += 1) {
        expect(FENCE_TILES.has(FENCE_GROUND_TRUTH.lower[y][x])).toBe(false);
      }
    }
    // upper 레이어는 비어 있다(링은 lower에 작성 — 계획 지시).
    expect(FENCE_GROUND_TRUTH.upper.flat().every((tile) => tile === -1)).toBe(true);
  });
});

// ── d3 하우스 ──────────────────────────────────────────────────────────────

describe("scoreHouse (d3)", () => {
  it("정답 하우스: passed=true, roofSupport/wallEnclosure/cellAccuracy 모두 통과", () => {
    const score = scoreHouse(HOUSE_GROUND_TRUTH, HOUSE_GROUND_TRUTH);
    expect(score.roofSupport).toBe(true);
    expect(score.wallEnclosure).toBe(true);
    expect(score.cellAccuracy).toBe(1);
    expect(score.checks.every((check) => check.passed)).toBe(true);
    expect(score.passed).toBe(true);
  });

  it("지붕만 있고 같은 칸 아래에 벽이 없으면 roofSupport 실패(공허 통과 금지)", () => {
    // 지붕 줄을 북쪽 벽줄(y=3)에서 한 칸 위(y=2)로 옮긴다 — 나머지는 완벽.
    const roofTile = HOUSE_GROUND_TRUTH.upper[3][3];
    expect(ROOF_TILES.has(roofTile)).toBe(true);
    const grid = cloneGrid(HOUSE_GROUND_TRUTH);
    for (let x = 3; x <= 8; x += 1) {
      grid.upper[3][x] = -1;
      grid.upper[2][x] = roofTile;
    }
    const score = scoreHouse(grid, HOUSE_GROUND_TRUTH);
    expect(score.roofSupport).toBe(false);
    expect(score.wallEnclosure).toBe(true); // 벽 링은 그대로 → 이 체크만으로는 못 걸른다
    expect(score.cellAccuracy).toBeGreaterThanOrEqual(0.8); // cellAccuracy만으로도 통과
    expect(score.passed).toBe(false);
  });

  it("벽만 있고 지붕이 아예 없으면 실패(roofCount=0 → roofSupport 공허 참 방어)", () => {
    const grid = cloneGrid(HOUSE_GROUND_TRUTH);
    for (let x = 3; x <= 8; x += 1) {
      grid.upper[3][x] = -1;
    }
    const score = scoreHouse(grid, HOUSE_GROUND_TRUTH);
    expect(score.roofSupport).toBe(false);
    expect(score.wallEnclosure).toBe(true);
    // lower+upper 합산 240칸(20x12) 중 6칸만 틀림 → 0.975 (>= 0.8 이므로 cellAccuracy 단독으론 통과)
    expect(score.cellAccuracy).toBeCloseTo(0.975, 10);
    expect(score.passed).toBe(false);
  });

  it("비직사각형(들쭉날쭉) 그리드는 throw(malformed_input)", () => {
    expect(() =>
      scoreHouse(
        { lower: [[306, 306], [306]], upper: [[-1, -1], [-1]] },
        HOUSE_GROUND_TRUTH,
      ),
    ).toThrow(/assertRectangular/);
  });
});

// ── d5 나무 ────────────────────────────────────────────────────────────────

describe("scoreTrees (d5)", () => {
  it("정답 나무 4그루: passed=true", () => {
    const score = scoreTrees(TREE_GROUND_TRUTH);
    expect(score.treeCount).toBe(4);
    expect(score.validTreeCount).toBe(4);
    expect(score.orphanCanopyCount).toBe(0);
    expect(score.cellAccuracy).toBe(1);
    expect(score.passed).toBe(true);
  });

  it("캐노피가 빠진 나무는 실패", () => {
    const grid = cloneGrid(TREE_GROUND_TRUTH);
    const target = trunkCellsOf(TREE_GROUND_TRUTH)[0];
    grid.upper[target.y][target.x] = -1;
    const score = scoreTrees(grid);
    expect(score.validTreeCount).toBe(3);
    expect(score.passed).toBe(false);
  });

  it("줄기가 빠진 나무는 실패 — 캐노피만 있는 칸은 나무로 세지 않는다", () => {
    const grid = cloneGrid(TREE_GROUND_TRUTH);
    const target = trunkCellsOf(TREE_GROUND_TRUTH)[0];
    grid.lower[target.y][target.x] = -1; // 캐노피는 그대로
    const score = scoreTrees(grid);
    expect(score.treeCount).toBe(3); // 캐노피는 줄기 없이 카운트되지 않음
    expect(score.orphanCanopyCount).toBe(1);
    expect(score.validTreeCount).toBe(3);
    expect(score.passed).toBe(false);
  });

  it("비호환 쌍 — 침엽 캐노피 260 + 마른나무 줄기 291 — 은 실패", () => {
    const grid = cloneGrid(TREE_GROUND_TRUTH);
    const dry = trunkCellsOf(TREE_GROUND_TRUTH).find((tree) => tree.trunk === 291);
    expect(dry).toBeDefined();
    grid.upper[dry!.y][dry!.x] = 260; // 침엽 캐노피
    const score = scoreTrees(grid);
    expect(score.treeCount).toBe(4); // 줄기+캐노피는 놓였다 — 개수는 맞음
    expect(score.validTreeCount).toBe(3); // 쌍이 틀렸으니 유효 나무는 3
    expect(score.invalidPairCells).toHaveLength(1);
    expect(score.passed).toBe(false);
  });

  it("나무 수가 3그루면 실패", () => {
    const grid = cloneGrid(TREE_GROUND_TRUTH);
    const target = trunkCellsOf(TREE_GROUND_TRUTH)[0];
    grid.lower[target.y][target.x] = -1;
    grid.upper[target.y][target.x] = -1;
    const score = scoreTrees(grid);
    expect(score.treeCount).toBe(3);
    expect(score.validTreeCount).toBe(3);
    expect(score.cellAccuracy).toBeGreaterThanOrEqual(0.8); // cellAccuracy만으로는 통과
    expect(score.passed).toBe(false);
  });

  it("비직사각형(들쭉날쭉) 그리드는 throw(malformed_input)", () => {
    expect(() => scoreTrees({ lower: [[290, 290], [290]], upper: [[-1], [-1, -1]] })).toThrow(
      /assertRectangular/,
    );
  });
});

// ── d7 울타리 ──────────────────────────────────────────────────────────────

describe("scoreFence (d7)", () => {
  it("완전한 링(lower): passed=true", () => {
    const score = scoreFence(FENCE_GROUND_TRUTH, FENCE_RECT);
    expect(score.boundaryComplete).toBe(true);
    expect(score.noOffRingFence).toBe(true);
    expect(score.ringConnected).toBe(true);
    expect(score.gapCount).toBe(0);
    expect(score.passed).toBe(true);
  });

  it("링에 구멍이 하나 있으면 실패", () => {
    const grid = cloneGrid(FENCE_GROUND_TRUTH);
    grid.lower[0][2] = -1; // 북쪽 변 중간 칸 제거
    const score = scoreFence(grid, FENCE_RECT);
    expect(score.gapCount).toBe(1);
    expect(score.boundaryComplete).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("링 밖(정원 내부)에 울타리 칸이 있으면 실패", () => {
    const grid = cloneGrid(FENCE_GROUND_TRUTH);
    grid.lower[2][2] = FENCE_GROUND_TRUTH.lower[0][0]; // 내부 칸에 울타리
    const score = scoreFence(grid, FENCE_RECT);
    expect(score.noOffRingFence).toBe(false);
    expect(score.offRingCells.length).toBe(1);
    expect(score.passed).toBe(false);
  });

  it("링을 UPPER 레이어에 놓아도 통과(레이어 수용 규칙)", () => {
    // d7 프롬프트는 레이어를 지정하지 않는다 — 링이 lower 또는 upper 어느 쪽이든 받는다.
    const grid = cloneGrid(FENCE_GROUND_TRUTH);
    const fenceTile = FENCE_GROUND_TRUTH.lower[0][0];
    for (const { x, y } of boundaryCells(FENCE_RECT)) {
      grid.upper[y][x] = fenceTile;
      grid.lower[y][x] = -1;
    }
    const score = scoreFence(grid, FENCE_RECT);
    expect(score.boundaryComplete).toBe(true);
    expect(score.noOffRingFence).toBe(true);
    expect(score.ringConnected).toBe(true);
    expect(score.passed).toBe(true);
  });

  it("경계가 2군데 끊기면 ringConnected 실패(≤1 구멍 허용)", () => {
    const grid = cloneGrid(FENCE_GROUND_TRUTH);
    grid.lower[0][2] = -1; // 북쪽 변
    grid.lower[4][2] = -1; // 남쪽 변 — 두 군데
    const score = scoreFence(grid, FENCE_RECT);
    expect(score.gapCount).toBe(2);
    expect(score.ringConnected).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("그리드 밖 rect / 들쭉날쭉 그리드는 throw(malformed_input)", () => {
    expect(() => scoreFence(FENCE_GROUND_TRUTH, { x: 1, y: 1, width: 6, height: 5 })).toThrow();
    expect(() => scoreFence({ lower: [[378, 378], [378]], upper: [[-1, -1], [-1]] }, FENCE_RECT)).toThrow(
      /assertRectangular/,
    );
  });
});
