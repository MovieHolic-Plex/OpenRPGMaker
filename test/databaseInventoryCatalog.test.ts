// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { renderDatabasePanel, refreshDatabasePanel, setDatabaseActiveTab, switchDatabaseActiveTab, getDatabaseActiveTab } from "@/editor/panels/database";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setSelectedRecordId, setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
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
it("requires fresh delete confirmation after changing the selected kind", () => {
  control("db-delete-selected").click();
  control("db-record-row-sword").click();
  // When: the first delete click on the equipment must only arm confirmation.
  control("db-delete-selected").click();
  // Then
  expect(store.getCurrent().database.items).toHaveLength(2);
  expect(store.getCurrent().database.equipment).toHaveLength(2);
});
it("deletes only the selected collection after confirmation", () => {
  control("db-record-row-sword").click(); control("db-delete-selected").click();
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
  control("db-delete-selected").click(); control("db-delete-selected").click();
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
