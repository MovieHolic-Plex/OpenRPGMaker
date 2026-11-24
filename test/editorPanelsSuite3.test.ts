// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { computeRowWindow, createVirtualList, type VirtualList } from "@/editor/panels/databaseListVirtualizer";
import { numberField, selectField, sliderStepperField, textField } from "@/editor/panels/databaseControls";
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

describe("databaseNumericLabelTrust", () => {
  isolateTimers();
  afterEach(() => {
    document.body.replaceChildren();
  });
  function inputIn(field: HTMLElement, type = "number"): HTMLInputElement {
    const input = field.querySelector(`input[type="${type}"]`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${type} input`);
    return input;
  }
  function visibleCaption(field: HTMLElement): HTMLElement {
    const caption = field.firstElementChild;
    if (!(caption instanceof HTMLElement)) throw new Error("Missing field caption");
    return caption.querySelector("label") ?? caption;
  }
  function nativeLabel(input: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
    const label = input.labels?.item(0);
    if (!label) throw new Error("Missing native input label");
    return label;
  }
  describe("database numeric label trust", () => {
    it("forwards maximum HP caption activation to the input without committing a decrement", () => {
      const commit = vi.fn();
      const field = numberField("Maximum HP", "db-field-enemy-max-hp", 18, commit, { min: 1, max: 99999 });
      document.body.append(field);
      const input = inputIn(field);
      const activate = vi.fn();
      input.addEventListener("click", activate);

      visibleCaption(field).click();

      expect(input.value).toBe("18");
      expect(commit).not.toHaveBeenCalled();
      expect(activate).toHaveBeenCalledTimes(1);
      // happy-dom forwards label clicks but does not implement their native focus default.
      // The native control association is the browser focus contract; browser QA owns activeElement.
      expect(nativeLabel(input).control).toBe(input);
    });

    it("names the numeric input from its visible label without labelling or nesting the buttons", () => {
      const name = "Maximum HP";
      const field = numberField(name, "hp", 18, vi.fn());
      document.body.append(field);
      const input = inputIn(field);
      const label = nativeLabel(input);

      expect(input.labels).toHaveLength(1);
      expect(label.control).toBe(input);
      expect(label.textContent).toBe(name);
      expect(visibleCaption(field).textContent).toBe(name);
      expect(field.querySelector("label button")).toBeNull();
      expect(field.matches(".db-field")).toBe(true);
      expect(field.children).toHaveLength(2);
      expect(field.children.item(1)?.matches(".db-number-stepper")).toBe(true);
      expect(input.parentElement?.children.item(1)).toBe(input);
      expect(input.dataset.testid).toBe("hp");
      for (const button of field.querySelectorAll("button")) {
        expect(button.labels).toHaveLength(0);
        expect(button.getAttribute("aria-label")).toContain(name);
      }
    });

    it.each([
      { suffix: "dec", next: 17 },
      { suffix: "inc", next: 19 },
    ])("commits one intentional $suffix click through the existing input event path", ({ suffix, next }) => {
      const commit = vi.fn();
      const field = numberField("Maximum HP", "hp", 18, commit, { min: 1, max: 99 });
      document.body.append(field);
      const input = inputIn(field);
      const inputEvent = vi.fn();
      input.addEventListener("input", inputEvent);
      const button = field.querySelector(`[data-testid="hp-${suffix}"]`);
      if (!(button instanceof HTMLButtonElement)) throw new Error("Missing stepper button");

      button.click();

      expect(input.value).toBe(String(next));
      expect(commit.mock.calls).toEqual([[next]]);
      expect(inputEvent).toHaveBeenCalledTimes(1);
    });

    it("keeps disabled numeric fields named and inert for caption and button clicks", () => {
      const name = "Maximum HP";
      const reason = "Inherited value";
      const commit = vi.fn();
      const field = numberField(name, "hp", 18, commit, undefined, { disabled: true, disabledReason: reason });
      document.body.append(field);
      const input = inputIn(field);

      visibleCaption(field).click();
      for (const button of field.querySelectorAll("button")) {
        expect(button.disabled).toBe(true);
        button.click();
      }

      expect(input.disabled).toBe(true);
      expect(input.title).toBe(reason);
      expect(input.value).toBe("18");
      expect(commit).not.toHaveBeenCalled();
      expect(nativeLabel(input).control).toBe(input);
      expect(nativeLabel(input).textContent).toBe(name);
    });

    it("names both slider inputs from the caption and activates only the numeric input", () => {
      const name = "Knockback resistance";
      const commit = vi.fn();
      const field = sliderStepperField(name, "resist", 25, commit, { min: 0, max: 100, step: 5, unit: "%" });
      document.body.append(field);
      const input = inputIn(field);
      const range = inputIn(field, "range");
      const activate = vi.fn();
      input.addEventListener("click", activate);

      visibleCaption(field).click();

      const label = nativeLabel(input);
      expect(label.control).toBe(input);
      expect(label.textContent).toBe(name);
      expect(label.contains(range)).toBe(false);
      expect(range.getAttribute("aria-labelledby")).toBe(label.id);
      expect(document.getElementById(label.id)).toBe(label);
      expect(label.id).not.toBe("");
      expect(input.value).toBe("25");
      expect(range.value).toBe("25");
      expect(commit).not.toHaveBeenCalled();
      expect(activate).toHaveBeenCalledTimes(1);
      expect(input.dataset.testid).toBe("resist-stepper");
      expect(range.dataset.testid).toBe("resist-slider");
      expect(field.children.item(1)?.matches(".db-slider-stepper")).toBe(true);
    });

    it.each(["number", "slider"])("keeps two detached %s instances independently labelled despite identical testids", (kind) => {
      const commits = [vi.fn(), vi.fn()];
      const fields = commits.map((commit) => kind === "number"
        ? numberField("Maximum HP", "same-id", 18, commit)
        : sliderStepperField("Maximum HP", "same-id", 18, commit, { min: 0, max: 100, step: 1 }));
      document.body.append(...fields);
      const inputs = fields.map((field) => inputIn(field));
      const activations = inputs.map((input) => {
        const activate = vi.fn();
        input.addEventListener("click", activate);
        return activate;
      });

      for (const [index, field] of fields.entries()) {
        visibleCaption(field).click();
        expect(activations[index]).toHaveBeenCalledTimes(1);
        const input = inputIn(field);
        expect(nativeLabel(input).control).toBe(input);
        expect(field.contains(nativeLabel(input))).toBe(true);
        expect(input.value).toBe("18");
        expect(commits[index]).not.toHaveBeenCalled();
        if (kind === "slider") {
          expect(inputIn(field, "range").getAttribute("aria-labelledby")).toBe(nativeLabel(input).id);
        }
      }
      for (const activate of activations) expect(activate).toHaveBeenCalledTimes(1);
      const ids = Array.from(document.querySelectorAll("[id]"), (node) => node.id);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("preserves native implicit labels and callbacks for simple text and select fields", () => {
      const name = "Record name";
      const textCommit = vi.fn();
      const selectCommit = vi.fn();
      const text = textField(name, "name", "Slime", textCommit);
      const select = selectField(name, "kind", "a", [{ id: "a", name: "A" }, { id: "b", name: "B" }], selectCommit);
      document.body.append(text, select);
      const input = inputIn(text, "text");
      const picker = select.querySelector("select");
      if (!picker) throw new Error("Missing select");

      for (const [field, control] of [[text, input], [select, picker]] as const) {
        visibleCaption(field).click();
        expect(nativeLabel(control)).toBe(field);
        expect(nativeLabel(control).control).toBe(control);
        expect(visibleCaption(field).textContent).toBe(name);
      }
      expect(textCommit).not.toHaveBeenCalled();
      expect(selectCommit).not.toHaveBeenCalled();
      input.value = "Bat";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      picker.value = "b";
      picker.dispatchEvent(new Event("change", { bubbles: true }));
      expect(textCommit.mock.calls).toEqual([["Bat"]]);
      expect(selectCommit.mock.calls).toEqual([["b"]]);
    });
  });
});
