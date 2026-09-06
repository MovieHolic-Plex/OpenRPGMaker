// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeRowWindow, createVirtualList } from "@/editor/panels/databaseListVirtualizer";

// No browser layout in happy-dom. Supply only the layout boundary: border-box
// row height, CSS gap/padding, viewport dimensions. Windowing and DOM replacement
// are real, and assertions reconstruct the extent from the actual rendered DOM.
function fixture(initialColumns: number, initialHeight: number, viewportHeight = 472) {
  let columns = initialColumns;
  let height = initialHeight;
  const gap = columns === 1 ? 2 : 8;
  const padding = columns === 1 ? 0 : 10;
  const list = createVirtualList({
    items: Array.from({ length: 101 }, (_, index) => index),
    measureRows: true,
    columns: () => columns,
    renderRow: (index) => {
      const row = document.createElement("button");
      row.dataset.index = String(index);
      row.getBoundingClientRect = () => new DOMRect(0, 0, 194 / columns, height);
      return row;
    },
  });
  document.body.append(list.element);
  Object.defineProperty(list.element, "clientHeight", { get: () => viewportHeight });
  const host = list.element.querySelector<HTMLElement>(".db-virtual-rows")!;
  host.style.rowGap = `${gap}px`;
  host.style.padding = `${padding}px 12px`;
  const top = () => Number.parseFloat(list.element.querySelector<HTMLElement>(".db-virtual-spacer-top")!.style.height);
  const bottom = () => Number.parseFloat(list.element.querySelector<HTMLElement>(".db-virtual-spacer-bottom")!.style.height);
  const assertGeometry = () => {
    const nodes = Array.from(host.children) as HTMLElement[];
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.length).toBeLessThan(101);
    const start = Number(nodes[0].dataset.index);
    expect(start % columns).toBe(0);
    expect(top()).toBeCloseTo(Math.floor(start / columns) * (height + gap));
    const renderedRows = Math.ceil(nodes.length / columns);
    const extent = top() + padding * 2 + renderedRows * height + (renderedRows - 1) * gap + bottom();
    expect(extent).toBeCloseTo(padding * 2 + Math.ceil(101 / columns) * (height + gap) - gap);
  };
  const assertTargetVisible = () => {
    const target = host.querySelector<HTMLElement>('[data-index="100"]');
    expect(target).not.toBeNull();
    const localIndex = Array.from(host.children).indexOf(target!);
    const y = top() + padding + Math.floor(localIndex / columns) * (height + gap) - list.element.scrollTop;
    expect(y).toBeGreaterThanOrEqual(-0.001);
    expect(y + height).toBeLessThanOrEqual(viewportHeight + 0.001);
  };
  return { list, host, assertGeometry, assertTargetVisible, resize: (nextColumns: number, nextHeight: number) => { columns = nextColumns; height = nextHeight; } };
}

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe("measured enemy virtual geometry", () => {
  it.each([440, 472, 572])("keeps row #101 visible through scroll renders in a %ipx viewport", (viewportHeight) => {
    const f = fixture(1, 40, viewportHeight);
    f.list.render();
    f.assertGeometry();
    f.list.scrollToIndex(100);
    f.assertTargetVisible();
    f.list.element.dispatchEvent(new Event("scroll"));
    f.assertGeometry();
    f.assertTargetVisible();
    expect(f.list.element.scrollTop).toBe(101 * 42 - 2 - viewportHeight);
  });

  it.each([3, 4])("accounts for fractional card height, 8px gaps, padding and an incomplete last row (%i columns)", (columns) => {
    const f = fixture(columns, 103.7);
    f.list.render();
    f.assertGeometry();
    f.list.scrollToIndex(100);
    f.list.element.dispatchEvent(new Event("scroll"));
    f.assertGeometry();
    f.assertTargetVisible();
  });

  it("remeasures pitch at unchanged indices and clamps the old gallery offset on a ResizeObserver column change", () => {
    let resized!: ResizeObserverCallback;
    vi.stubGlobal("ResizeObserver", class { constructor(callback: ResizeObserverCallback) { resized = callback; } observe() {} });
    const f = fixture(3, 156);
    f.list.render();
    f.resize(3, 103.7);
    f.list.render(); // Same start/end window can still require new spacer heights.
    f.assertGeometry();
    f.list.scrollToIndex(100);
    const oldScroll = f.list.element.scrollTop;
    f.resize(4, 89.6);
    resized([], {} as ResizeObserver);
    expect(f.list.element.style.getPropertyValue("--db-gallery-columns")).toBe("4");
    expect(f.list.element.scrollTop).toBeLessThan(oldScroll);
    f.assertGeometry();
    f.assertTargetVisible();
  });

  it("includes a partially visible bottom row at fractional scroll offsets without relying on overscan", () => {
    expect(computeRowWindow({ total: 101, scrollTop: 41.5, viewportHeight: 42, rowHeight: 42, overscan: 0 })).toEqual({ start: 0, end: 2 });
  });
});
