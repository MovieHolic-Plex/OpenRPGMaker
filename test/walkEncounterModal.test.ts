/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { beginWalkEncounter } from "@/editor/walkEncounterAuthoring";
import { renderSelectionActionChips } from "@/editor/selectionActionChips";
import { regionTaskMenuItems } from "@/editor/panels/mapSelectionContextMenu";
import { openWalkEncounterModal, openWalkEncounterList, openWalkEncounterForSelection } from "@/editor/panels/walkEncounterModal";
import { historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { modalStackDepthForTest } from "@/editor/ui/modalStack";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import * as locks from "@/editor/mapEditLocks";
import { deserialize, serialize } from "@/project/io";

beforeEach(() => {
  document.body.replaceChildren();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  delete map.encounterTable;
  map.troopIds = [];
  map.encounterRate = 0;
  project.system.actionCombat = { enabled: false };
  store.replaceProject(project);
  editorState.set({ currentMapId: map.id, selection: null });
  resetMapEditHistory();
});
afterEach(() => {
  while (modalStackDepthForTest()) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  vi.restoreAllMocks();
});
function node<T extends HTMLElement = HTMLElement>(id: string): T {
  const result = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!result) throw new Error(`Missing test control: ${id}`);
  return result;
}
function open() {
  const draft = beginWalkEncounter(store.getCurrent().startMapId, { x: 2, y: 2, w: 3, h: 3 });
  openWalkEncounterModal(draft);
  return draft;
}
function chooseFirstEnemy() { node<HTMLInputElement>(`walk-enemy-${store.getCurrent().database.enemies[0]!.id}`).click(); }

it("keeps editor shortcuts and project undo out of the active form", () => {
  open();
  node("walk-encounter-save").focus();
  expect(historyHotkeyOwnedByPanel()).toBe(true);
  expect(shouldIgnoreEditorShortcut(new KeyboardEvent("keydown", { key: "1" }))).toBe(true);
});

it("opens the same draft flow from the visible selection action and context action", () => {
  const selection = { mapId: store.getCurrent().startMapId, x: 2, y: 2, width: 3, height: 3 };
  document.body.append(renderSelectionActionChips(selection));
  node("selection-chip-walk-encounter").click();
  expect(node("walk-encounter-modal")).toBeTruthy();
  node("walk-encounter-cancel").click();
  const action = regionTaskMenuItems(selection).find((item) => item.id === "region-walk-encounter");
  if (!action) throw new Error("Missing encounter action");
  action.action();
  chooseFirstEnemy(); node("walk-encounter-save").click();
  expect(store.getCurrent().maps[selection.mapId]!.encounterTable?.[0]?.conditions?.region).toEqual({ x: 2, y: 2, w: 3, h: 3 });
});

it("search preserves focus and multi-selection; cancel discards every local change", () => {
  const before = structuredClone(store.getCurrent());
  open();
  chooseFirstEnemy();
  const search = node<HTMLInputElement>("walk-encounter-search");
  search.focus(); search.value = "no-such-enemy";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  expect(document.activeElement).toBe(search);
  expect(node("walk-encounter-catalog").querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  search.value = ""; search.dispatchEvent(new Event("input", { bubbles: true }));
  expect(node<HTMLInputElement>(`walk-enemy-${before.database.enemies[0]!.id}`).checked).toBe(true);
  node<HTMLInputElement>(`walk-enemy-${before.database.enemies[1]!.id}`).click();
  node<HTMLInputElement>("walk-encounter-weight-0").value = "7";
  node("walk-encounter-weight-0").dispatchEvent(new Event("input", { bubbles: true }));
  node("walk-encounter-cancel").click();
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("saves through real controls, reopens from the list, and confirms deletion without deleting tiles", () => {
  open(); chooseFirstEnemy();
  const frequency = node<HTMLSelectElement>("walk-encounter-frequency");
  expect(frequency.dataset.eventCustomSelect).toBeUndefined();
  frequency.value = "60";
  frequency.dispatchEvent(new Event("change", { bubbles: true }));
  const before = structuredClone(store.getCurrent());
  node("walk-encounter-save").click();
  expect(document.querySelector('[data-testid="walk-encounter-modal"]')).toBeNull();
  const mapId = before.startMapId;
  expect(store.getCurrent().maps[mapId]!.encounterRate).toBe(60);
  expect(store.getCurrent().maps[mapId]!.encounterTable).toHaveLength(1);
  openWalkEncounterList(); node("walk-encounter-edit-0").click();
  expect(node<HTMLInputElement>(`walk-enemy-${before.database.enemies[0]!.id}`).checked).toBe(true);
  node("walk-encounter-delete").click();
  expect(store.getCurrent().maps[mapId]!.encounterTable).toHaveLength(1);
  node("walk-encounter-delete").click();
  expect(store.getCurrent().maps[mapId]!.encounterTable).toBeUndefined();
  expect(store.getCurrent().maps[mapId]!.lowerTiles).toEqual(before.maps[mapId]!.lowerTiles);
});

it("reuses the last enemy choice on another rectangle and can replace existing bounds", () => {
  const first = open(); chooseFirstEnemy(); node("walk-encounter-save").click();
  openWalkEncounterForSelection({ mapId: first.mapId, x: 8, y: 2, width: 2, height: 2 });
  node("walk-encounter-reuse").click(); node("walk-encounter-save").click();
  expect(store.getCurrent().maps[first.mapId]!.encounterTable).toHaveLength(2);
  editorState.set({ selection: { mapId: first.mapId, x: 4, y: 8, width: 2, height: 2 } });
  openWalkEncounterList(); node("walk-encounter-retarget-0").click();
  node("walk-encounter-save").click();
  expect(store.getCurrent().maps[first.mapId]!.encounterTable!.map((entry) => entry.conditions?.region)).toEqual([
    { x: 8, y: 2, w: 2, h: 2 }, { x: 4, y: 8, w: 2, h: 2 },
  ]);
});

it("Escape closes only the top modal and restores the opener without mutations", () => {
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  const before = structuredClone(store.getCurrent());
  open(); chooseFirstEnemy();
  node("walk-encounter-save").focus();
  openEventSubdialog({ title: "Nested", testId: "walk-nested-probe", width: "narrow", render: () => undefined });
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(modalStackDepthForTest()).toBe(1);
  expect(document.activeElement).toBe(node("walk-encounter-save"));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(modalStackDepthForTest()).toBe(0);
  expect(document.activeElement).toBe(opener);
  expect(store.getCurrent()).toEqual(before);
});

it("keeps a stale or newly locked modal open with an error and makes no mutation", () => {
  open(); chooseFirstEnemy();
  vi.spyOn(locks, "canEditMap").mockReturnValue(false);
  const before = structuredClone(store.getCurrent());
  node("walk-encounter-save").click();
  expect(node("walk-encounter-error").textContent).not.toBe("");
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it.each(["blank", "cleared"])("rejects a %s variable threshold, then saves a reloadable zero threshold", (mode) => {
  const before = structuredClone(store.getCurrent());
  const variableId = before.variables[0]!.id;
  open();
  chooseFirstEnemy();
  const variable = Array.from(node("walk-encounter-advanced").querySelectorAll("select"))
    .find((select) => Array.from(select.options).some((option) => option.value === variableId));
  if (!variable) throw new Error("Missing variable selector");
  variable.value = variableId;
  variable.dispatchEvent(new Event("change", { bubbles: true }));
  const threshold = node<HTMLInputElement>("walk-encounter-threshold-0");
  if (mode === "cleared") {
    threshold.value = "5";
    threshold.dispatchEvent(new Event("input", { bubbles: true }));
    threshold.value = "";
    threshold.dispatchEvent(new Event("input", { bubbles: true }));
  }

  node("walk-encounter-save").click();

  expect(document.querySelector('[data-testid="walk-encounter-modal"]')).not.toBeNull();
  expect(node("walk-encounter-error").textContent).not.toBe("");
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);

  threshold.value = "0";
  threshold.dispatchEvent(new Event("input", { bubbles: true }));
  node("walk-encounter-save").click();
  const reloaded = deserialize(serialize(store.getCurrent()));
  expect(reloaded.maps[reloaded.startMapId]!.encounterTable?.[0]?.conditions)
    .toMatchObject({ variableId, atLeast: 0 });
});
