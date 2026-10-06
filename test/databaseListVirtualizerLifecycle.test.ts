// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVirtualList, type VirtualList } from "@/editor/panels/databaseListVirtualizer";

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
