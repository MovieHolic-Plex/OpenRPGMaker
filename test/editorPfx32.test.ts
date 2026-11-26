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
import { readFileSync } from "node:fs";
import { parse } from "postcss";
import { createBattleRuntime } from "@/battle/runtime";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { runTool } from "@/editor/tools/toolRunner";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { battleField, syncBattleField } from "@/player/battleFieldDom";
import { retroDamage } from "@/player/battleRetroMotion";
import { deserialize, serialize } from "@/project/io/serialize";
import type { EnemyRecord, Project } from "@/project/types";
import { beginGameExport, endGameExport, resetGameExportForTest } from "@/editor/panels/gameExportNotice";
import { resetToastsForTest } from "@/util/toast";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
import { renderDailyWeatherTab } from "@/editor/panels/databaseDailyWeatherView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { dailyWeatherForecast } from "@/project/dailyWeather";
import { startSession } from "@/project/session";
import { playGiftSelection } from "@/player/playSceneGift";
import { runCommands, runEvent } from "@/player/playSceneInterpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { closeMapContextMenu, openMapContextMenu } from "@/editor/panels/mapContextMenu";

describe("editorPanelsSuite4", () => {
  isolateTimers();
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
    // btn-trim-r2: 목록 도구는 「+ 아이템」만 밖에 두고 나머지는 ⋯ 하나 뒤로. 거르기를 고르면 메뉴가 닫힌다.
    it("keeps only + 아이템 outside the catalog ⋯ menu and closes it after a filter pick", () => {
      const more = host.querySelector<HTMLDetailsElement>(".db-catalog-actions details.db-toolbar-more");
      if (!more) throw new Error("missing catalog ⋯");
      expect(control("db-catalog-add-items").closest("details")).toBeNull();
      for (const testid of ["db-catalog-add-equipment", "db-catalog-duplicate", "db-delete-selected", "db-catalog-filter-equipment", "db-catalog-subtype", "db-view-toggle-gallery"]) {
        expect(more.contains(control(testid)), testid).toBe(true);
      }
      more.open = true;
      control("db-catalog-filter-equipment").click();
      expect(more.open).toBe(false);
      expect(rowIds()).toEqual(["sword", "shield"]);
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
});

describe("editorPanelsSuite6", () => {
  isolateTimers();
  describe("enemyBattleScale", () => {
    isolateTimers();
    function enemy(project: Project, id = "enemy_stone_golem"): EnemyRecord {
      const record = project.database.enemies.find((entry) => entry.id === id);
      if (!record) throw new Error(`Missing enemy fixture ${id}`);
      return record;
    }
    function input(form: HTMLElement, suffix: "slider" | "stepper"): HTMLInputElement {
      const control = form.querySelector<HTMLInputElement>(`[data-testid="db-field-enemy-battle-scale-${suffix}"]`);
      if (!control) throw new Error(`Missing battle scale ${suffix}`);
      return control;
    }
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
      document.body.replaceChildren();
      vi.clearAllTimers();
      vi.useRealTimers();
    });
    describe("enemy battle size at the authoring and project IO seams", () => {
      it.each([175, 0, 999])("authors %s percent through upsert_enemy and project IO", (value) => {
        // Given: the real tool runner and an existing enemy with unrelated fields.
        const context = { project: createBlankProject() };
        const before = structuredClone(enemy(context.project));
        // When: the tool edits only the authored battle size.
        const result = runTool(context, "upsert_enemy", {
          enemy: { id: before.id, battleScalePercent: value },
        }, { dryRun: false });
        // Then: schema acceptance, mutation and persistence agree.
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(enemy(deserialize(serialize(context.project)))).toEqual({
          ...before, battleScalePercent: Math.min(300, Math.max(10, value)),
        });
      });

      it("keeps an edited enemy size through save, load and a second save", () => {
        // Given: the actual editor store, not a mock mutation adapter.
        store.replace(createBlankProject());
        // When: a record patch goes through the normal mutation and IO boundaries.
        updateDatabaseRecord("enemies", "enemy_stone_golem", { battleScalePercent: 175 });
        const loaded = deserialize(serialize(store.getCurrent()));
        const reloaded = deserialize(serialize(loaded));
        // Then: normalization must not drop the authored percentage.
        expect(enemy(reloaded).battleScalePercent).toBe(175);
        expect(enemy(reloaded, "enemy_cave_bat").battleScalePercent).toBeUndefined();
      });

      it.each([
        [undefined, undefined], [100, undefined], [10, 10], [300, 300],
        [0, 10], [-50, 10], [9999, 300], [125.6, 126],
        [null, undefined], ["175", undefined], ["bad", undefined],
      ])("normalizes wire value %s to %s without breaking old projects", (raw, expected) => {
        // Given: persisted or externally authored project data.
        const project = createBlankProject();
        Object.assign(enemy(project), { battleScalePercent: raw });
        // When: it crosses the real project load boundary.
        const loaded = deserialize(serialize(project));
        // Then: omission/default stay sparse and malformed values use the default.
        expect(enemy(loaded).battleScalePercent).toBe(expected);
        if (expected === undefined) expect(enemy(loaded)).not.toHaveProperty("battleScalePercent");
      });

      it.each([NaN, Infinity, -Infinity])("defaults non-finite direct edits (%s) safely", (value) => {
        store.replace(createBlankProject());
        updateDatabaseRecord("enemies", "enemy_stone_golem", { battleScalePercent: value });
        expect(enemy(store.getCurrent())).not.toHaveProperty("battleScalePercent");
      });

      it.each([175, 10, 300, 999, -20, 125.6])("edits %s using the real form, preserving focus and other enemy data", (value) => {
        // Given: a mounted real enemy inspector with existing actions/stats/art.
        store.replace(createBlankProject());
        const before = structuredClone(enemy(store.getCurrent()));
        const form = document.createElement("section");
        document.body.append(form);
        renderEnemyRecordForm(form, before);
        const number = input(form, "stepper");
        expect(number.value).toBe("100");
        expect([number.min, number.max, number.step]).toEqual(["10", "300", "1"]);
        expect(number.labels?.length).toBeGreaterThan(0);
        number.focus();
        // When: native input bubbles through the current store-backed form.
        number.value = String(value);
        number.dispatchEvent(new Event("input", { bubbles: true }));
        // Then: input, slider and saved value agree without replacing the input.
        const expected = Math.round(Math.min(300, Math.max(10, value)));
        expect(number.value).toBe(String(expected));
        expect(input(form, "slider").value).toBe(String(expected));
        expect(document.activeElement).toBe(number);
        expect(enemy(store.getCurrent())).toEqual({ ...before, battleScalePercent: expected });
        expect(enemy(deserialize(serialize(store.getCurrent()))).battleScalePercent).toBe(expected);
      });

      it("restores 100 percent through the slider and reopens with that default", () => {
        store.replace(createBlankProject());
        updateDatabaseRecord("enemies", "enemy_stone_golem", { battleScalePercent: 175 });
        const form = document.createElement("section");
        renderEnemyRecordForm(form, enemy(store.getCurrent()));
        const slider = input(form, "slider");
        slider.value = "100";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        const loaded = deserialize(serialize(store.getCurrent()));
        store.replace(loaded);
        const reopened = document.createElement("section");
        renderEnemyRecordForm(reopened, enemy(loaded));
        expect(input(reopened, "stepper").value).toBe("100");
        expect(enemy(loaded)).not.toHaveProperty("battleScalePercent");
      });
    });
    describe("enemy size in the supported battle presentations", () => {
      it.each(["retro2003", "pokemon"] as const)("applies independent sizes in %s and retains them through hit/idle sync", (skin) => {
        // Given: two differently sized records in an existing multi-enemy troop.
        const project = createBlankProject();
        project.system.battleUiStyle = skin;
        project.system.battleModel = skin === "pokemon" ? "gen1" : "rm2k3";
        enemy(project).battleScalePercent = 175;
        enemy(project, "enemy_cave_bat").battleScalePercent = 50;
        // Gen1 exposes only the first live opponent, so put the golem first.
        const troop = project.database.troops.find((entry) => entry.id === "troop_golem_guard");
        if (!troop?.members) throw new Error("Missing troop members fixture");
        troop.members.sort((a, b) => Number(b.enemyId === "enemy_stone_golem") - Number(a.enemyId === "enemy_stone_golem"));
        store.replace(deserialize(serialize(project)));
        const runtime = createBattleRuntime({ project: store.getCurrent(), troopId: "troop_golem_guard", canEscape: true, canLose: false, rng: () => 0 });
        const snapshot = runtime.snapshot();
        // When: the real renderer creates and synchronizes its battler nodes.
        const field = battleField(snapshot);
        const golem = field.querySelector<HTMLElement>('[data-record-id="enemy_stone_golem"]');
        const image = golem?.querySelector<HTMLImageElement>(".battle-enemy-image");
        expect(golem?.style.getPropertyValue("--battle-enemy-scale")).toBe("1.75");
        const bats = field.querySelectorAll<HTMLElement>('[data-record-id="enemy_cave_bat"]');
        expect(bats.length).toBe(skin === "pokemon" ? 0 : 2);
        for (const bat of bats) {
          expect(bat.style.getPropertyValue("--battle-enemy-scale")).toBe("0.5");
        }
        syncBattleField(field, snapshot, undefined, { hitTargetId: "enemy_stone_golem" });
        if (skin === "pokemon") {
          expect(golem?.classList.contains("battle-pose-hit")).toBe(true);
        } else {
          // The dot side-view skin draws the golem from its 9-cell pixel sheet. Pixel-sheet enemies keep the
          // semantic pose at idle/dead (battleRetroMotion.retroMotionPose) and show the hit as a sheet cell
          // chosen by retroPixelEnemyCell, driven by retroDamage — so assert that channel, not the pose class.
          if (!golem || !image) throw new Error("Missing golem pixel-sheet nodes");
          expect(golem.dataset.pixelEnemy).toBe("stomp");
          retroDamage(golem, { targetId: golem.dataset.testid ?? "", amount: 12, critical: false, healing: false }, false);
          expect(image.dataset.pixelCell).toBe("hit");
          // The transient hit cell expires on a timer; the detached test field repaints on the next sync.
          vi.advanceTimersByTime(400);
        }
        syncBattleField(field, snapshot, undefined, { calm: true });
        if (skin === "retro2003") expect(image?.dataset.pixelCell).toBe("idle");
        // Then: sizing has not taken over transform, scale or the animation channel.
        expect(golem?.querySelector(".battle-enemy-image")).toBe(image);
        expect(golem?.style.getPropertyValue("--battle-enemy-scale")).toBe("1.75");
        expect(image?.style.transform).toBe("");
        expect(image?.style.getPropertyValue("scale")).toBe("");
        expect(image?.style.animation).toBe("");
        expect(golem?.style.transform).toBe("");
      });

      it.each(["retro2003", "pokemon"] as const)("uses unchanged 100 percent dimensions for a legacy %s enemy", (skin) => {
        const project = createBlankProject();
        project.system.battleUiStyle = skin;
        store.replace(project);
        const runtime = createBattleRuntime({ project, troopId: "troop_golem_guard", canEscape: true, canLose: false, rng: () => 0 });
        const field = battleField(runtime.snapshot());
        expect(field.querySelector<HTMLElement>(".battle-enemy")?.style.getPropertyValue("--battle-enemy-scale")).toBe("1");
      });

      it.each([
        ["_rm2000.css", "retro2003", 2, 160, 180],
        ["_rm2000.css", "retro2003", 1, 200, 240],
        ["_battlers.css", "pokemon", 1, 148, 148],
      ] as const)("consumes the multiplier in the shipped %s size rule (%s, %s enemies)", (file, skin, count, width, height) => {
        // Given: parsed shipped CSS. happy-dom cannot evaluate calc multiplication
        // or :where specificity; real-browser geometry/cascade QA is lead-owned.
        const sheet = parse(readFileSync(`src/styles/runtime/battle-skins/${file}`, "utf8"));
        const selector = skin === "pokemon"
          ? '.battle-scene[data-battle-skin="pokemon"] .battle-enemy .battle-enemy-image'
          : count === 1
            ? '.battle-scene[data-battle-ui-style="classic"][data-battle-skin-family="glass"] .battle-enemy-group:not(:has(> .battle-enemy:nth-child(2))) .battle-enemy-image'
            : '.battle-scene[data-battle-ui-style="classic"][data-battle-skin-family="glass"] .battle-enemy .battle-enemy-image';
        const dimensions: Record<string, string> = {};
        const shared = '.battle-scene[data-battle-ui-style="classic"][data-battle-skin-family="glass"] .battle-enemy .battle-enemy-image';
        // When: shared dimensions and the selected skin's base-size overrides apply.
        sheet.walkRules((rule) => {
          if (rule.selector !== selector && !(skin !== "pokemon" && rule.selector === shared)) return;
          rule.walkDecls(/^(width|height|--battle-enemy-base-width|--battle-enemy-base-height)$/, (declaration) => { dimensions[declaration.prop] = declaration.value; });
        });
        // Then: both dimensions consume the same runtime multiplier with legacy fallback.
        expect(dimensions).toEqual({
          "--battle-enemy-base-width": `${width}px`,
          "--battle-enemy-base-height": `${height}px`,
          width: "calc(var(--battle-enemy-base-width) * var(--battle-enemy-scale, 1) * var(--battle-enemy-fit, 1))",
          height: "calc(var(--battle-enemy-base-height) * var(--battle-enemy-scale, 1) * var(--battle-enemy-fit, 1))",
        });
      });
    });
  });
  describe("gameExportNotice", () => {
    isolateTimers();
    afterEach(() => {
      resetGameExportForTest();
      resetToastsForTest();
      document.body.replaceChildren();
      vi.useRealTimers();
    });
    function toastTexts(): string[] {
      return [...document.querySelectorAll(".toast")].map((node) => node.textContent ?? "");
    }
    describe("game export notice", () => {
      it("keeps the progress toast up past the default two seconds", () => {
        vi.useFakeTimers();
        expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
        const notice = document.querySelector<HTMLElement>('[data-testid="toast"]');
        expect(notice?.textContent).toContain("게임 번들을 만드는 중...");
        expect(notice?.classList.contains("show")).toBe(true);
        vi.advanceTimersByTime(3_000);
        expect(notice?.classList.contains("show")).toBe(true);
      });

      it("refuses a second export while the first is still running", () => {
        expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
        expect(beginGameExport("실행형 HTML 을 만드는 중...")).toBe(false);
        const texts = toastTexts();
        expect(texts.some((text) => text.includes("게임 번들을 만드는 중"))).toBe(true);
        expect(texts.some((text) => text.includes("이미 게임을 내보내는 중"))).toBe(true);
        expect(texts.some((text) => text.includes("실행형 HTML"))).toBe(false);
      });

      it("replaces progress with an error that stays past the default four seconds", () => {
        vi.useFakeTimers();
        beginGameExport("게임 번들을 만드는 중...");
        endGameExport("게임 내보내기 실패: manifest", "error");
        const notice = document.querySelector<HTMLElement>('[data-testid="toast"]');
        expect(notice?.textContent).toContain("게임 내보내기 실패: manifest");
        expect(notice?.classList.contains("error")).toBe(true);
        expect(toastTexts().some((text) => text.includes("게임 번들을 만드는 중"))).toBe(false);
        vi.advanceTimersByTime(5_000);
        expect(notice?.classList.contains("show")).toBe(true);
        vi.advanceTimersByTime(16_000);
        expect(notice?.classList.contains("show")).toBe(false);
      });

      it("allows another export after the first finishes", () => {
        expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
        endGameExport("게임 내보내기 완료: 맵 1개, 에셋 2개", "ok");
        expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
      });
    });
  });
});

describe("editorPanelsSuite7", () => {
  isolateTimers();
  describe("lifeAuthoringBounds", () => {
    isolateTimers();
    function fixture() {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true, daysPerSeason: 40 };
      project.characters = { resident: { displayName: "Profile name", birthday: { season: "spring", day: 40 } } };
      project.switches.push({ id: "reward", name: "Reward" });
      project.database.lifeSkills = [{ id: "skill", name: "Skill", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 1, switchId: "reward" }] }];
      project.system.dailyWeather = { enabled: true, seasons: { spring: [{ kind: "rain", weight: 1 }] } };
      // Establish the existing load normalization before testing render/roundtrip purity.
      return deserialize(serialize(project));
    }
    function mount(render: (host: HTMLElement, rerender: () => void) => void) {
      const host = document.createElement("div");
      document.body.append(host);
      const rerender = () => { host.replaceChildren(); render(host, rerender); };
      rerender();
      return host;
    }
    function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, id: string): T {
      const node = host.querySelector<T>(`[data-testid="${id}"]`);
      if (!node) throw new Error(`Missing control ${id}`);
      return node;
    }
    beforeEach(() => {
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      store.replace(fixture());
      resetMapEditHistory();
      _resetEditActivityForTest();
    });
    afterEach(() => { _resetEditActivityForTest(); document.body.replaceChildren(); });
    describe("authoring bounds", () => {
      it("accepts day40 in a 40-day calendar and bounds new input to that calendar", () => {
        const host = mount(renderCharactersTab);
        control(host, "db-character-row-resident").click();
        const day = control(host, "db-character-birthday-day");
        expect(day.max).toBe("40");
        day.value = "40";
        day.dispatchEvent(new Event("input"));
        expect(store.getCurrent().characters?.resident.birthday?.day).toBe(40);
        day.value = "41";
        day.dispatchEvent(new Event("change"));
        expect(day.value).toBe("40");
        expect(store.getCurrent().characters?.resident.birthday?.day).toBe(40);
      });

      it("diagnoses day29 in a 28-day calendar without silently changing it", () => {
        store.update((project) => { project.system.timeSystem = { enabled: true, daysPerSeason: 28 }; project.characters!.resident = { ...project.characters!.resident, birthday: { season: "spring", day: 29 } }; });
        const before = serialize(store.getCurrent());
        const host = mount(renderCharactersTab);
        control(host, "db-character-row-resident").click();
        const day = control(host, "db-character-birthday-day");
        expect(day.value).toBe("29");
        expect(day.max).toBe("28");
        expect(day.getAttribute("aria-invalid")).toBe("true");
        expect(control(host, "db-character-birthday-warning").hidden).toBe(false);
        expect(serialize(store.getCurrent())).toBe(before);
      });

      it("shows effective omitted weather values without authoring them", () => {
        const before = serialize(store.getCurrent());
        const host = mount(renderDailyWeatherTab);
        expect(control(host, "db-weather-forecast-days").value).toBe("1");
        expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("0.5");
        expect(serialize(store.getCurrent())).toBe(before);
      });

      it("rejects both 129th-rule add controls without mutation or an undo entry", () => {
        store.update((project) => { project.system.dailyWeather!.seasons.spring = Array.from({ length: 128 }, () => ({ kind: "rain", weight: 1 })); });
        const before = serialize(store.getCurrent());
        const host = mount(renderDailyWeatherTab);
        let mutations = 0;
        const history = getMapEditHistoryState();
        const unsubscribe = store.subscribe(() => { mutations += 1; });
        control(host, "db-weather-add-spring").click();
        control(host, "db-weather-add-rule-spring").click();
        unsubscribe();
        expect(store.getCurrent().system.dailyWeather!.seasons.spring).toHaveLength(128);
        expect(mutations).toBe(0);
        expect(getMapEditHistoryState()).toEqual(history);
        expect(serialize(store.getCurrent())).toBe(before);
      });

      it("caps skill input at10, starts new rewards at2, and retains legacy level1", () => {
        const host = mount(renderLifeCraftingTab);
        control(host, "db-life-section-skills").click();
        const max = control(host, "db-life-skill-max-level");
        expect(max.max).toBe("10");
        max.value = "11";
        max.dispatchEvent(new Event("change"));
        expect(max.value).toBe("10");
        expect(store.getCurrent().database.lifeSkills![0].maxLevel).toBe(10);
        control(host, "db-life-skill-reward-add").click();
        expect(store.getCurrent().database.lifeSkills![0].levelUpRewards.map((r) => r.level)).toEqual([1, 2]);
        const level = control(host, "db-life-skill-reward-level-1");
        expect([level.min, level.max]).toEqual(["2", "10"]);
        level.value = "15";
        level.dispatchEvent(new Event("change"));
        expect(level.value).toBe("10");
        expect(store.getCurrent().database.lifeSkills![0].levelUpRewards.map((r) => r.level)).toEqual([1, 10]);
      });

      it("refuses a new level-up reward when maxLevel is1", () => {
        store.update((project) => { project.database.lifeSkills![0] = { ...project.database.lifeSkills![0], maxLevel: 1 }; });
        const before = serialize(store.getCurrent());
        const host = mount(renderLifeCraftingTab);
        control(host, "db-life-section-skills").click();
        control(host, "db-life-skill-reward-add").click();
        expect(serialize(store.getCurrent())).toBe(before);
      });

      it.each([{ graphicStages: undefined }, { graphicStages: [] }, { graphicStages: [{ frame: 0, label: "Editor-only" }] }])("does not author crop graphics during rendering ($graphicStages)", ({ graphicStages }) => {
        store.update((project) => { project.database.crops = [{ id: "unlinked", name: "Crop", seedItemId: project.database.items[0].id, harvestItemId: project.database.items[0].id, harvestCount: 1, seasons: ["spring"], stages: [{ days: 2 }], ...(graphicStages === undefined ? {} : { graphicStages }) }]; });
        const before = serialize(store.getCurrent());
        mount(renderCropTab);
        expect(serialize(store.getCurrent())).toBe(before);
        expect(deserialize(before).database.crops![0].graphicStages).toEqual(graphicStages);
      });
    });
    // Real public gift/interpreter authorities; only the dialogue/render endpoints are recording
    // substitutes. Native player.html coverage lives in the task14 evidence harness.
    describe("public automatic speaker consumers", () => {
      function sceneFixture() {
        const project = store.getCurrent();
        project.maps[project.startMapId].events = ["first", "second"].map((id) => ({ id, x: 1, y: 1, characterId: "resident", talkFriendship: true, trigger: { kind: "action" }, commands: [] }));
        const messages: Array<{ speaker?: string; body: string }> = [];
        const dialogue = { showText: async (message: { speaker?: string; body: string }) => { messages.push(message); }, showChoices: async () => 0, showNumberInput: async () => 0, close() {}, hide() {} };
        const scene = { session: startSession(project, 1), map: project.maps[project.startMapId], tileY: 0, running: false, inputEnabled: true, eventPositions: {}, eventSprites: new Map(), game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } }, setInputEnabled() {}, refreshRuntimeSurfaces() {}, syncRuntimeState() {}, showRuntimeOverlay() {}, clearRuntimeOverlay() {} } as unknown as PlaySceneContext;
        scene.session.inventory = {};
        return { scene, messages, project };
      }

      it("uses linked profile names for no-items and daily-limit gift feedback", async () => {
        const { scene, messages } = sceneFixture();
        await playGiftSelection(scene, scene.map.events[0]);
        expect(messages[0].speaker).toBe("Profile name");
        scene.session.dailyGifts = { resident: "1:spring:1" };
        await playGiftSelection(scene, scene.map.events[1]);
        expect(messages[1].speaker).toBe("Profile name");
      });

      it("shares talk identity across events and preserves explicit command speaker overrides", async () => {
        const { scene, messages } = sceneFixture();
        await runEvent(scene, "first");
        expect(messages[0].speaker).toBe("Profile name");
        const friendship = structuredClone(scene.session.friendship);
        await runEvent(scene, "second");
        expect(scene.session.friendship).toEqual(friendship);
        expect(messages).toHaveLength(1);
        await runCommands(scene, [{ kind: "text", speaker: "Explicit speaker", body: "Explicit" }, { kind: "text", body: "Automatic" }, { kind: "text", speaker: "", body: "Narration" }], "second");
        expect(messages.slice(1).map((m) => m.speaker)).toEqual(["Explicit speaker", "Profile name", ""]);
      });
    });
    describe("legacy characterization", () => {
      it("uses effective forecast 1 and rain intensity 0.5 without backfilling", () => {
        const project = store.getCurrent();
        const before = serialize(project);
        const forecast = dailyWeatherForecast(project, startSession(project, 1));
        expect(forecast).toHaveLength(1);
        expect(forecast[0].intensity).toBe(0.5);
        expect(serialize(project)).toBe(before);
      });

      it("retains explicit forecast 3 and intensity 0.65 through render and roundtrip", () => {
        store.update((project) => { project.system.dailyWeather = { enabled: true, forecastDays: 3, seasons: { spring: [{ kind: "rain", weight: 1, intensity: 0.65 }] } }; });
        const before = serialize(store.getCurrent());
        const host = mount(renderDailyWeatherTab);
        expect(control(host, "db-weather-forecast-days").value).toBe("3");
        expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("0.65");
        expect(serialize(store.getCurrent())).toBe(before);
        expect(serialize(deserialize(before))).toBe(before);
      });

      it("preserves the legacy level1 reward and authored birthday on render/serialize", () => {
        const before = serialize(store.getCurrent());
        const character = mount(renderCharactersTab);
        control(character, "db-character-row-resident").click();
        expect(control(character, "db-character-birthday-day").value).toBe("40");
        const skills = mount(renderLifeCraftingTab);
        control(skills, "db-life-section-skills").click();
        expect(control(skills, "db-life-skill-reward-level-0").value).toBe("1");
        expect(serialize(store.getCurrent())).toBe(before);
        expect(serialize(deserialize(before))).toBe(before);
      });
    });
  });
  describe("mapContextMenuLayout", () => {
    isolateTimers();
    describe("map context menu item layout", () => {
      afterEach(() => {
        closeMapContextMenu();
      });

      it("keeps an empty icon slot so the label is not clipped to the 16px first column", () => {
        openMapContextMenu({
          mapId: "map-1",
          mapName: "테스트",
          point: { x: 10, y: 10 },
          items: [
            {
              action: () => {},
              icon: "",
              id: "create-event",
              label: "이벤트 생성...",
              shortcut: "Enter",
              testId: "event-layer-create-event",
            },
          ],
        });

        const item = document.querySelector<HTMLButtonElement>('[data-testid="event-layer-create-event"]');
        expect(item).not.toBeNull();
        const children = Array.from(item!.children) as HTMLElement[];
        expect(children.map((node) => node.className)).toEqual([
          "map-context-menu-icon",
          "map-context-menu-label",
          "map-context-menu-shortcut",
        ]);
        expect(children[0].getAttribute("aria-hidden")).toBe("true");
        expect(children[1].textContent).toBe("이벤트 생성...");
        expect(children[2].textContent).toBe("Enter");
      });
    });
  });
});
