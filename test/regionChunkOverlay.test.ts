// test/regionChunkOverlay.test.ts
// 청크를 캔버스 위 도형으로 그리기 위한 순수 기하·순회 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.

import { describe, expect, it } from "vitest";
import {
  buildChunkOverlayShapes,
  defaultOverlayLayer,
  hitRectFor,
  MIN_CHUNK_HIT_PX,
  nextChunkInDirection,
  selectionAfterToggle,
} from "@/editor/regionTask/regionChunkOverlay";
import type { RegionChangeGroups, RegionChunk } from "@/editor/regionTask/regionChangeGroups";
import type { RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 10, y: 20, width: 12, height: 11 };

/** 영역 로컬 좌표 목록으로 청크 만들기. index 는 이 테스트에서 쓰이지 않는다. */
function chunk(
  id: string,
  layer: "lower" | "upper",
  cells: readonly (readonly [number, number])[],
  label = id,
): RegionChunk {
  return {
    id,
    layer,
    label,
    dominantTile: 1,
    cells: cells.map(([x, y]) => ({ x, y, index: y * REGION.width + x })),
  };
}

function groups(lower: readonly RegionChunk[], upper: readonly RegionChunk[]): RegionChangeGroups {
  return { lower, upper, unchangedCells: 0 };
}

describe("buildChunkOverlayShapes", () => {
  it("셀 하나짜리 청크는 타일 한 칸 사각형과 사방 외곽선 4변이 된다", () => {
    const shapes = buildChunkOverlayShapes({
      chunks: [chunk("a", "lower", [[0, 0]])],
      region: REGION,
      tileSize: 24,
    });

    expect(shapes).toHaveLength(1);
    const [shape] = shapes;
    expect(shape!.cellRects).toEqual([{ x: 0, y: 0, width: 24, height: 24 }]);
    expect(shape!.bounds).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(shape!.outline).toHaveLength(4);
  });

  it("가로로 붙은 두 칸은 내부 경계를 뺀 외곽선 6변이 된다", () => {
    const [shape] = buildChunkOverlayShapes({
      chunks: [chunk("a", "lower", [[0, 0], [1, 0]])],
      region: REGION,
      tileSize: 24,
    });

    // 사각형 2개가 공유하는 세로 변 1쌍이 사라진다: 8 - 2 = 6
    expect(shape!.outline).toHaveLength(6);
    expect(shape!.bounds).toEqual({ x: 0, y: 0, width: 48, height: 24 });
  });

  it("origin 과 tileSize 를 화면 좌표에 반영한다", () => {
    const [shape] = buildChunkOverlayShapes({
      chunks: [chunk("a", "lower", [[2, 3]])],
      region: REGION,
      tileSize: 32,
      origin: { x: 100, y: 50 },
    });

    expect(shape!.cellRects).toEqual([{ x: 100 + 64, y: 50 + 96, width: 32, height: 32 }]);
  });

  it("순회 순서는 위에서 아래로, 같은 줄에서는 왼쪽에서 오른쪽으로 매긴다", () => {
    const shapes = buildChunkOverlayShapes({
      chunks: [
        chunk("right-top", "lower", [[8, 0]]),
        chunk("bottom", "lower", [[0, 5]]),
        chunk("left-top", "lower", [[1, 0]]),
      ],
      region: REGION,
      tileSize: 24,
    });

    expect(shapes.map((s) => s.id)).toEqual(["left-top", "right-top", "bottom"]);
    expect(shapes.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("aria-label 은 라벨과 describeChunkPosition 의 위치말을 함께 읽어준다", () => {
    // 12×11 영역의 오른쪽 아래 → "우하단"
    const [shape] = buildChunkOverlayShapes({
      chunks: [chunk("a", "lower", [[10, 9]], "잔디밭(1칸)")],
      region: REGION,
      tileSize: 24,
    });

    expect(shape!.ariaLabel).toContain("잔디밭(1칸)");
    expect(shape!.ariaLabel).toContain("우하단");
  });

  it("셀이 없는 청크는 도형을 만들지 않는다", () => {
    const shapes = buildChunkOverlayShapes({
      chunks: [chunk("empty", "lower", [])],
      region: REGION,
      tileSize: 24,
    });

    expect(shapes).toEqual([]);
  });
});

describe("defaultOverlayLayer", () => {
  it("변경 칸이 더 많은 레이어를 기본 활성으로 고른다", () => {
    const g = groups(
      [chunk("l", "lower", [[0, 0]])],
      [chunk("u", "upper", [[0, 0], [1, 0], [2, 0]])],
    );
    expect(defaultOverlayLayer(g)).toBe("upper");
  });

  it("칸 수가 같으면 바닥(lower)을 고른다", () => {
    const g = groups([chunk("l", "lower", [[0, 0]])], [chunk("u", "upper", [[5, 5]])]);
    expect(defaultOverlayLayer(g)).toBe("lower");
  });

  it("한쪽이 비어 있으면 변경이 있는 쪽을 고른다", () => {
    const g = groups([], [chunk("u", "upper", [[0, 0]])]);
    expect(defaultOverlayLayer(g)).toBe("upper");
  });
});

describe("selectionAfterToggle", () => {
  it("포함된 청크를 누르면 제외되고, 원본 집합은 바뀌지 않는다", () => {
    const before = new Set(["a", "b"]);
    const after = selectionAfterToggle(before, "a");

    expect([...after]).toEqual(["b"]);
    expect([...before]).toEqual(["a", "b"]);
  });

  it("제외된 청크를 누르면 다시 포함된다", () => {
    expect([...selectionAfterToggle(new Set(["b"]), "a")].sort()).toEqual(["a", "b"]);
  });
});

describe("nextChunkInDirection", () => {
  const shapes = buildChunkOverlayShapes({
    chunks: [
      chunk("tl", "lower", [[0, 0]]),
      chunk("tr", "lower", [[6, 0]]),
      chunk("bl", "lower", [[0, 6]]),
    ],
    region: REGION,
    tileSize: 24,
  });

  it("오른쪽으로는 같은 줄에서 더 오른쪽 청크로 간다", () => {
    expect(nextChunkInDirection(shapes, "tl", "right")).toBe("tr");
  });

  it("아래로는 더 아래 청크로 간다", () => {
    expect(nextChunkInDirection(shapes, "tl", "down")).toBe("bl");
  });

  it("갈 곳이 없으면 null 을 준다", () => {
    expect(nextChunkInDirection(shapes, "tr", "right")).toBeNull();
    expect(nextChunkInDirection(shapes, "tl", "up")).toBeNull();
  });

  it("모르는 id 는 null 을 준다", () => {
    expect(nextChunkInDirection(shapes, "nope", "down")).toBeNull();
  });
});

describe("hitRectFor", () => {
  it("타일이 작아도 최소 히트 타깃까지 넓힌다 — 1칸 청크는 16px 라 그냥 두면 누를 수 없다", () => {
    // 실측(2026-09-11, 호수 마을 12×10 영역): 청크 22개 중 18개가 1칸 = 16×16px.
    const hit = hitRectFor({ x: 100, y: 50, width: 16, height: 16 });

    expect(hit.width).toBe(MIN_CHUNK_HIT_PX);
    expect(hit.height).toBe(MIN_CHUNK_HIT_PX);
    // 원래 칸의 중심을 유지한다 — 넓힌 쪽이 한쪽으로 치우치면 커서가 엉뚱한 칸을 가리킨다.
    expect(hit.x + hit.width / 2).toBe(100 + 8);
    expect(hit.y + hit.height / 2).toBe(50 + 8);
  });

  it("이미 최소치보다 큰 사각형은 그대로 둔다", () => {
    const rect = { x: 0, y: 0, width: 48, height: 32 };
    expect(hitRectFor(rect)).toEqual(rect);
  });

  it("한 축만 작으면 그 축만 넓힌다", () => {
    const hit = hitRectFor({ x: 0, y: 0, width: 48, height: 16 });
    expect(hit.width).toBe(48);
    expect(hit.height).toBe(MIN_CHUNK_HIT_PX);
  });
});
