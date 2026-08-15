import { describe, expect, it, vi } from "vitest";
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

  it("windows by full rows when columns > 1 (grid math)", () => {
    // 133 items ÷ 4 columns = 34 rows. viewport 400px / rowHeight 120px = 4 visible rows.
    const window = computeRowWindow({
      total: 133,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 120,
      columns: 4,
      overscan: 0,
      threshold: 80,
    });
    // endRow = min(34, 0 + 4 + 0) = 4 → items [0, 16). start 는 항상 columns 의 배수다.
    expect(window).toEqual({ start: 0, end: 16 });
    expect(window.start % 4).toBe(0);
    expect(window.end - window.start).toBeLessThan(133);
  });

  it("keeps the window row-aligned at depth (start is a multiple of columns)", () => {
    const window = computeRowWindow({
      total: 200,
      scrollTop: 10 * 120,
      viewportHeight: 400,
      rowHeight: 120,
      columns: 3,
      overscan: 2,
      threshold: 80,
    });
    expect(window.start % 3).toBe(0);
    expect(window.start).toBeGreaterThanOrEqual(0);
    expect(window.end).toBeLessThanOrEqual(200);
    expect(window.start).toBeLessThan(window.end);
  });

  it("clamps the last row to the item count when the total is not divisible", () => {
    // 10 items ÷ 3 columns = 4 rows (last row holds 1 item).
    const window = computeRowWindow({
      total: 10,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 120,
      columns: 3,
      overscan: 0,
      threshold: 80,
    });
    // total(10) <= threshold(80) → 전부 렌더. end 가 항목 수로 클램프된다.
    expect(window).toEqual({ start: 0, end: 10 });
  });

  it("applies the threshold to the item count, not the row count", () => {
    // 100 items ÷ 4 columns = 25 rows — 행 수는 임계값(80) 이하여도 항목 수가 넘으면 윈도잉.
    const window = computeRowWindow({
      total: 100,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 120,
      columns: 4,
      overscan: 0,
      threshold: 80,
    });
    expect(window.end - window.start).toBeLessThan(100);
  });

  it("guards columns > total and degenerate columns values without crashing", () => {
    // columns(1000) > total(500): rows=1 → 전체가 한 행으로 렌더된다 (0 나눗셈 없음).
    const wide = computeRowWindow({
      total: 500,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 120,
      columns: 1000,
      overscan: 0,
      threshold: 0,
    });
    expect(wide).toEqual({ start: 0, end: 500 });

    // columns 0 / 음수 / NaN 은 기본 1 로 폴백 — columns 미지정과 동일한 결과.
    const baseline = computeRowWindow({ total: 500, scrollTop: 0, viewportHeight: 400, rowHeight: 120, overscan: 0, threshold: 0 });
    for (const broken of [0, -3, Number.NaN]) {
      expect(computeRowWindow({ total: 500, scrollTop: 0, viewportHeight: 400, rowHeight: 120, columns: broken, overscan: 0, threshold: 0 })).toEqual(baseline);
    }
  });

  it("columns=1 produces identical math to the default (single column)", () => {
    const withDefault = computeRowWindow({ total: 1000, scrollTop: 100 * DEFAULT_ROW_HEIGHT, viewportHeight: 10 * DEFAULT_ROW_HEIGHT, overscan: 5, threshold: 80 });
    const withOne = computeRowWindow({ total: 1000, scrollTop: 100 * DEFAULT_ROW_HEIGHT, viewportHeight: 10 * DEFAULT_ROW_HEIGHT, columns: 1, overscan: 5, threshold: 80 });
    expect(withOne).toEqual(withDefault);
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

  it("renders grid rows with columns: spacers cover full rows and the CSS var is set", () => {
    const restore = installFakeDom();
    try {
      const items = Array.from({ length: 133 }, (_, index) => index);
      const list = createVirtualList<number>({
        items,
        rowHeight: 120,
        columns: 4,
        renderRow: (value) => el("button", { dataset: { card: String(value) }, text: String(value) }),
      });
      const container = list.element;
      if (!(container instanceof FakeElement)) throw new Error("expected fake element");

      // 뷰포트/스크롤을 부여하면 행 단위로 윈도잉된다 (rows=34, visible 4행 + overscan).
      (container as unknown as { clientHeight: number }).clientHeight = 400;
      (container as unknown as { scrollTop: number }).scrollTop = 0;
      list.render();
      const rowsHost = container.querySelector(".db-virtual-rows");
      const renderedCount = rowsHost?.childNodes.length ?? 0;
      expect(renderedCount).toBeGreaterThan(0);
      expect(renderedCount).toBeLessThan(133);
      expect(renderedCount % 4).toBe(0);

      // 스페이서는 '행' 단위 — 상단 0행, 하단 (34 - endRow)행.
      const topSpacer = container.querySelector(".db-virtual-spacer-top");
      const bottomSpacer = container.querySelector(".db-virtual-spacer-bottom");
      expect(topSpacer?.style.height).toBe("0px");
      const endRow = Math.ceil(renderedCount / 4);
      expect(bottomSpacer?.style.height).toBe(`${(34 - endRow) * 120}px`);

      // CSS 그리드용 커스텀 프로퍼티가 컨테이너에 심긴다.
      expect(container.style.getPropertyValue("--db-gallery-columns")).toBe("4");
    } finally {
      restore();
    }
  });

  it("supports a columns resolver function called with the container (width-responsive)", () => {
    const restore = installFakeDom();
    try {
      const items = Array.from({ length: 133 }, (_, index) => index);
      const resolver = vi.fn(() => 3);
      const list = createVirtualList<number>({
        items,
        columns: resolver,
        renderRow: (value) => el("button", { dataset: { card: String(value) }, text: String(value) }),
      });
      expect(resolver.mock.calls.length).toBeGreaterThan(0);
      expect(resolver.mock.calls[0]?.[0]).toBe(list.element);
      expect(list.element.style.getPropertyValue("--db-gallery-columns")).toBe("3");
    } finally {
      restore();
    }
  });
});
