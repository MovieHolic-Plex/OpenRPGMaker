// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, describe, vi } from "vitest";
import { renderDatabasePanel, refreshDatabasePanel, setDatabaseActiveTab, switchDatabaseActiveTab, getDatabaseActiveTab } from "@/editor/panels/database";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setSelectedRecordId, setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { createVirtualList, type VirtualList } from "@/editor/panels/databaseListVirtualizer";
import { numberField, selectField, sliderStepperField, textField } from "@/editor/panels/databaseControls";
import { isolateTimers } from "./mergedTeardown";

describe("databaseInventoryCatalog", () => {
  isolateTimers();
  let host: HTMLDivElement;
  beforeEach(() => {
    const project = createBlankProject();
    project.database.items = [normalizeItemRecord({ id: "potion", name: "달빛 약", type: "medicine" }), normalizeItemRecord({ id: "book", name: "기술서", type: "book" })];
    project.database.equipment = [normalizeEquipmentRecord({ id: "sword", name: "달빛 검", slot: "weapon" }), normalizeEquipmentRecord({ id: "shield", name: "나무 방패", slot: "shield" })];
    store.replace(project);
    resetDatabaseRecordViewSession();
    setViewModeForCollection("items", "list");
    setDatabaseActiveTab("items");
    host = document.createElement("div");
    document.body.append(host);
    renderDatabasePanel(host);
  });
  afterEach(() => { requestDatabaseModalClose("battleTest"); host.remove(); resetDatabaseRecordViewSession(); });
  function control(id: string): HTMLElement {
    const node = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }
  function search(value: string): HTMLInputElement {
    const input = control("db-catalog-search");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected search input");
    input.focus(); input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return input;
  }
  function rowIds(): string[] {
    return Array.from(host.querySelectorAll<HTMLElement>(".db-list-row"), (row) => row.dataset.recordId ?? "");
  }
  it("shows both collections through one real rail entry", () => {
    // Given/When: opening the catalog. Then: one rail entry and both collections.
    expect(host.querySelector('[data-testid="db-tab-equipment"]')).toBeNull();
    expect(control("db-tab-items").dataset.count).toBe("4");
    expect(rowIds()).toEqual(["potion", "book", "sword", "shield"]);
  });
  it("searches both collections without replacing focused search or selected detail", () => {
    const detail = control("db-detail-form");
    // When
    const input = search("달빛");
    // Then
    expect(rowIds()).toEqual(["potion", "sword"]);
    expect(control("db-catalog-search")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(control("db-detail-form")).toBe(detail);
    expect(control("db-catalog-count").dataset.visibleCount).toBe("2");
    expect(control("db-catalog-count").dataset.totalCount).toBe("4");
  });
  it("preserves selection when a kind filter hides its row", () => {
    control("db-record-row-sword").click();
    const detail = control("db-detail-form");
    // When
    control("db-catalog-filter-items").click();
    // Then
    expect(rowIds()).toEqual(["potion", "book"]);
    expect(control("db-detail-form")).toBe(detail);
    expect(control("db-field-name")).toHaveProperty("value", "달빛 검");
  });
  it("opens a legacy equipment target using existing selected-record session", () => {
    search("no matches"); setSelectedRecordId("equipment", "shield");
    // When
    switchDatabaseActiveTab("equipment", host);
    // Then
    expect(getDatabaseActiveTab()).toBe("items");
    expect(control("db-catalog-filter-equipment").getAttribute("aria-pressed")).toBe("true");
    expect(control("db-record-row-shield").getAttribute("aria-pressed")).toBe("true");
    expect(control("db-field-name")).toHaveProperty("value", "나무 방패");
  });
  it("narrows shared search by subtype while keeping the select focused", () => {
    search("달빛");
    const select = control("db-catalog-subtype");
    if (!(select instanceof HTMLSelectElement)) throw new Error("Expected subtype select");
    // When
    select.focus(); select.value = "equipment:weapon";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    // Then
    expect(rowIds()).toEqual(["sword"]);
    expect(document.activeElement).toBe(select);
    expect(control("db-catalog-count").dataset.visibleCount).toBe("1");
  });
  it.each(["items", "equipment"] as const)("creates explicitly in %s and reveals the new selection", (collection) => {
    search("no matches");
    const before = store.getCurrent().database[collection].length;
    // When
    control(`db-catalog-add-${collection}`).click();
    // Then
    expect(store.getCurrent().database[collection]).toHaveLength(before + 1);
    expect(control("db-catalog-search")).toHaveProperty("value", "");
    const active = host.querySelector<HTMLElement>('.db-catalog-rows [aria-pressed="true"]');
    expect(active?.dataset.collection).toBe(collection);
    expect(store.getCurrent().database[collection].some((record) => record.id === active?.dataset.recordId)).toBe(true);
  });
  it("duplicates the selected equipment rather than a remembered item", () => {
    control("db-record-row-sword").click();
    // When
    control("db-catalog-duplicate").click();
    // Then
    expect(store.getCurrent().database.equipment).toHaveLength(3);
    expect(store.getCurrent().database.items).toHaveLength(2);
    expect(host.querySelector<HTMLElement>('.db-catalog-rows [aria-pressed="true"]')?.dataset.collection).toBe("equipment");
  });
  it("retains both kinds and the selected row in gallery mode", () => {
    control("db-record-row-sword").click();
    // When
    control("db-view-toggle-gallery").click();
    // Then
    expect(host.querySelectorAll(".db-gallery-card")).toHaveLength(4);
    expect(control("db-record-card-sword").getAttribute("aria-pressed")).toBe("true");
    expect(control("db-field-name")).toHaveProperty("value", "달빛 검");
  });
  // 69756ade51 (IS-091): 삭제는 확인 없이 바로 실행되고 Ctrl+Z 가 되살린다 — 한 번 누르면 선택한 한 건만 지운다.
  it("deletes one record per press and follows the selected kind afterwards", () => {
    control("db-delete-selected").click();
    expect(store.getCurrent().database.items.map((record) => record.id)).toEqual(["book"]);
    control("db-record-row-sword").click();
    // When: the next press targets the newly selected equipment, not the item deleted before.
    control("db-delete-selected").click();
    // Then
    expect(store.getCurrent().database.items.map((record) => record.id)).toEqual(["book"]);
    expect(store.getCurrent().database.equipment.map((record) => record.id)).toEqual(["shield"]);
  });
  it("deletes only the selected collection's record on a single press", () => {
    control("db-record-row-sword").click();
    // When
    control("db-delete-selected").click();
    // Then
    expect(store.getCurrent().database.equipment.map((record) => record.id)).toEqual(["shield"]);
    expect(store.getCurrent().database.items).toHaveLength(2);
    expect(control("db-catalog-count").dataset.totalCount).toBe("3");
  });
  it("retains the reference guard on equipment deletion", () => {
    store.update((project) => { const actor = project.database.actors[0]; if (actor) actor.initialEquipment.weapon = "sword"; });
    control("db-record-row-sword").click();
    // When
    control("db-delete-selected").click();
    // Then
    expect(store.getCurrent().database.equipment.map((record) => record.id)).toEqual(["sword", "shield"]);
  });
  it("keeps same-ID records in separate collections independently selectable", () => {
    store.update((project) => { const equipment = project.database.equipment[0]; if (equipment) equipment.id = "potion"; });
    switchDatabaseActiveTab("items", host);
    const row = host.querySelector<HTMLElement>('.db-catalog-rows [data-collection="equipment"][data-record-id="potion"]');
    // When
    row?.click();
    // Then
    expect(host.querySelectorAll('.db-catalog-rows [aria-pressed="true"]')).toHaveLength(1);
    expect(control("db-field-name")).toHaveProperty("value", "달빛 검");
  });
  it("keeps the requested equipment selection when opening a fresh modal", () => {
    setSelectedRecordId("equipment", "shield");
    // When
    openDatabaseModal("equipment");
    // Then
    const modal = document.querySelector('[data-testid="database-modal"]');
    expect(modal?.querySelector('[data-testid="db-catalog-filter-equipment"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(modal?.querySelector('[data-testid="db-field-name"]')).toHaveProperty("value", "나무 방패");
  });
  it("keeps slot management open through a pending database refresh", () => {
    // Given the equipment editor's management disclosure.
    control("db-record-row-sword").click();
    control("db-equipment-slot-manage").click();
    expect(control("db-equipment-slot-manager")).toHaveProperty("open", true);

    // When a queued store notification refreshes the database.
    refreshDatabasePanel(host);

    // Then the user can still reach the newly opened management inputs.
    expect(control("db-equipment-slot-manager")).toHaveProperty("open", true);
  });
  it("immediately refreshes weapon-only controls in both slot directions", () => {
    // Given the real catalog form and a focused weapon slot select.
    control("db-record-row-sword").click();
    expect(control("db-field-equipment-two-handed")).toBeTruthy();
    const select = control("db-field-equipment-slot");
    if (!(select instanceof HTMLSelectElement)) throw new Error("Expected slot select");
    select.focus();

    // When the weapon becomes a shield, then no stale weapon-only toggle remains.
    select.value = "shield";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(host.querySelector('[data-testid="db-field-equipment-two-handed"]')).toBeNull();
    expect(document.activeElement).toBe(control("db-field-equipment-slot"));

    // When it becomes a weapon again, then the toggle is immediately available.
    const next = control("db-field-equipment-slot");
    if (!(next instanceof HTMLSelectElement)) throw new Error("Expected slot select");
    next.value = "weapon";
    next.dispatchEvent(new Event("change", { bubbles: true }));
    expect(control("db-field-equipment-two-handed")).toBeTruthy();
    expect(document.activeElement).toBe(control("db-field-equipment-slot"));
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
