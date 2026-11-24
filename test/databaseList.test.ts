// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { computeRowWindow, createVirtualList, type VirtualList } from "@/editor/panels/databaseListVirtualizer";
import { isolateTimers } from "./mergedTeardown";

describe("databaseListGeometry", () => {
  isolateTimers();
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
});

describe("databaseListVirtualizerLifecycle", () => {
  isolateTimers();
  const observers: TrackedResizeObserver[] = [];
  class TrackedResizeObserver {
    readonly observe = vi.fn();
    readonly disconnect = vi.fn();
    constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
    fire(): void { this.callback([], this as unknown as ResizeObserver); }
  }
  const lists: VirtualList<number>[] = [];
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", TrackedResizeObserver);
  });
  afterEach(() => {
    for (const list of lists.splice(0)) list.dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function makeList(retain = true, onScroll = vi.fn()) {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientHeight", { value: 96 });
    document.body.append(container);
    const renderRow = vi.fn((id: number) => {
      const button = document.createElement("button");
      button.dataset.id = String(id);
      button.textContent = String(id);
      return button;
    });
    const list = createVirtualList({
      container, items: Array.from({ length: 200 }, (_, i) => i),
      rowHeight: 32, overscan: 1, renderRow, onScroll,
      ...(retain ? { getRowKey: (id: number) => String(id) } : {}),
    });
    lists.push(list);
    const host = container.querySelector<HTMLElement>(".db-virtual-rows")!;
    const row = (id: number) => host.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)!;
    const scroll = (offset: number) => {
      container.scrollTop = offset;
      container.dispatchEvent(new Event("scroll"));
    };
    return { list, container, host, row, scroll, renderRow, onScroll };
  }
  describe("virtual row identity, focus and ownership", () => {
    it("keeps overlapping buttons connected and focused as the window advances both ways", () => {
      const { container, host, row, scroll, renderRow } = makeList();
      const focused = row(2);
      focused.focus();
      const remove = vi.spyOn(focused, "remove");
      scroll(64);
      expect(row(2)).toBe(focused);
      expect(document.activeElement).toBe(focused);
      expect(remove).not.toHaveBeenCalled();
      expect(row(0)).toBeNull();
      expect(host.children).toHaveLength(5);
      scroll(0);
      expect(row(2)).toBe(focused);
      expect(document.activeElement).toBe(focused);
      expect(container.scrollTop).toBe(0);
      // Only newly entering rows are authored again.
      expect(renderRow).toHaveBeenCalledTimes(7);
    });

    it("recovers focus when its resource leaves the window without reversing the scroll", () => {
      const { container, host, row, scroll } = makeList();
      const focused = row(1);
      focused.focus();
      scroll(3200);
      expect(focused.isConnected).toBe(false);
      expect(document.activeElement).toBe(host.firstElementChild);
      expect(container.scrollTop).toBe(3200);
      expect(host.children).toHaveLength(5);
    });

    it("restores focus by resource key after replacement/reordering and refreshes row content", () => {
      const { list, row } = makeList();
      const old = row(2);
      old.focus();
      old.textContent = "obsolete";
      list.setItems([2, 0, 1, 3, 4]);
      expect(row(2)).not.toBe(old);
      expect(row(2).textContent).toBe("2");
      expect(document.activeElement).toBe(row(2));
    });

    it("does not take focus from controls outside the rows", () => {
      const { scroll, list } = makeList();
      const search = document.createElement("input");
      document.body.append(search);
      search.focus();
      scroll(3200);
      list.setItems([1, 2, 3]);
      expect(document.activeElement).toBe(search);
    });

    it("reveals and focuses an unmounted row in either direction and rejects invalid indexes", () => {
      const { list, row, container } = makeList();
      expect(list.focusRow(100)).toBe(true);
      expect(document.activeElement).toBe(row(100));
      expect(container.scrollTop).toBe(3136);
      expect(list.focusRow(0)).toBe(true);
      expect(document.activeElement).toBe(row(0));
      expect(container.scrollTop).toBe(0);
      for (const index of [-1, 200, 1.5, NaN]) expect(list.focusRow(index)).toBe(false);
      expect(document.activeElement).toBe(row(0));
    });

    it("preserves the replacement behavior of callers without retention keys", () => {
      const { row, scroll, list } = makeList(false);
      const original = row(2);
      scroll(64);
      expect(row(2)).not.toBe(original);
      const refreshed = row(2);
      list.setItems(Array.from({ length: 200 }, (_, i) => i));
      expect(row(2)).not.toBe(refreshed);
    });

    it("disconnects the observer and scroll listener once and makes stale work inert", () => {
      const { list, container, host, scroll, onScroll, renderRow } = makeList();
      const observer = observers[0]!;
      const removeListener = vi.spyOn(container, "removeEventListener");
      expect(observer.observe).toHaveBeenCalledWith(container);
      list.dispose();
      list.dispose();
      renderRow.mockClear();
      scroll(3200);
      observer.fire(); // Already queued delivery after disconnect.
      list.render();
      list.setItems([1, 2, 3]);
      list.scrollToIndex(0);
      expect(list.focusRow(0)).toBe(false);
      expect(observer.disconnect).toHaveBeenCalledTimes(1);
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
      expect(onScroll).not.toHaveBeenCalled();
      expect(renderRow).not.toHaveBeenCalled();
      expect(container.scrollTop).toBe(3200);
      expect(host.children).toHaveLength(0);
    });
  });
});
