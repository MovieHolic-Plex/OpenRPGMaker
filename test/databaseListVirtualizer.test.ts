import { describe, expect, it } from "vitest";
import {
  computeRowWindow,
  createVirtualList,
  DEFAULT_ROW_HEIGHT,
  VIRTUALIZATION_THRESHOLD,
} from "@/editor/panels/databaseListVirtualizer";
import { el } from "@/util/dom";
import { FakeElement, installFakeDom } from "./fakeDom";

describe("computeRowWindow", () => {
  it("renders everything when the total is at or below the threshold", () => {
    expect(computeRowWindow({ total: 40, scrollTop: 999, viewportHeight: 300, threshold: 80 })).toEqual({
      start: 0,
      end: 40,
    });
  });

  it("renders everything when the viewport height is unknown (0)", () => {
    expect(computeRowWindow({ total: 500, scrollTop: 4000, viewportHeight: 0 })).toEqual({ start: 0, end: 500 });
  });

  it("windows a large list around the scroll position with overscan", () => {
    const window = computeRowWindow({
      total: 1000,
      scrollTop: 100 * DEFAULT_ROW_HEIGHT,
      viewportHeight: 10 * DEFAULT_ROW_HEIGHT,
      overscan: 5,
      threshold: 80,
    });
    // firstVisible = 100, visibleCount = 10, overscan = 5 -> [95, 115)
    expect(window).toEqual({ start: 95, end: 115 });
    expect(window.end - window.start).toBeLessThan(1000);
  });

  it("clamps the window to the list bounds", () => {
    const window = computeRowWindow({
      total: 200,
      scrollTop: 500 * DEFAULT_ROW_HEIGHT,
      viewportHeight: 8 * DEFAULT_ROW_HEIGHT,
      overscan: 4,
      threshold: 80,
    });
    expect(window.start).toBeGreaterThanOrEqual(0);
    expect(window.end).toBe(200);
    expect(window.start).toBeLessThanOrEqual(200);
  });

  it("returns an empty window for an empty list", () => {
    expect(computeRowWindow({ total: 0, scrollTop: 0, viewportHeight: 300 })).toEqual({ start: 0, end: 0 });
  });

  it("exposes a sensible default threshold", () => {
    expect(VIRTUALIZATION_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("createVirtualList", () => {
  it("renders all rows when geometry is unavailable (fake DOM) and re-renders windowed slices", () => {
    const restore = installFakeDom();
    try {
      const items = Array.from({ length: 300 }, (_, index) => index);
      const list = createVirtualList<number>({
        items,
        rowHeight: DEFAULT_ROW_HEIGHT,
        renderRow: (value) => el("button", { dataset: { row: String(value) }, text: String(value) }),
      });
      const container = list.element;
      if (!(container instanceof FakeElement)) throw new Error("expected fake element");
      const rowsHost = container.querySelector(".db-virtual-rows");
      // 높이를 측정할 수 없으면 전부 렌더된다.
      expect(rowsHost?.childNodes.length).toBe(300);

      // 뷰포트/스크롤을 부여하면 보이는 슬라이스만 렌더한다.
      (container as unknown as { clientHeight: number }).clientHeight = 10 * DEFAULT_ROW_HEIGHT;
      (container as unknown as { scrollTop: number }).scrollTop = 100 * DEFAULT_ROW_HEIGHT;
      list.render();
      const windowedCount = container.querySelector(".db-virtual-rows")?.childNodes.length ?? 0;
      expect(windowedCount).toBeGreaterThan(0);
      expect(windowedCount).toBeLessThan(300);
    } finally {
      restore();
    }
  });
});
