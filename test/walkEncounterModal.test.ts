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
import { requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { selectedRecordIdForSession, setSearchQueryForCollection } from "@/editor/panels/databaseRecordViewSession";
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
  requestDatabaseModalClose("battleTest");
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
function chooseFirstGroup(index = 0) {
  node("walk-encounter-add-group").click();
  node(`walk-group-${store.getCurrent().database.troops[index]!.id}`).click();
  node("walk-encounter-picker-done").click();
}

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
  chooseFirstGroup(); node("walk-encounter-save").click();
  expect(store.getCurrent().maps[selection.mapId]!.encounterTable?.[0]?.conditions?.region).toEqual({ x: 2, y: 2, w: 3, h: 3 });
});

it("search preserves focus and multi-selection; cancel discards every local change", () => {
  const before = structuredClone(store.getCurrent());
  open();
  chooseFirstGroup();
  node("walk-encounter-add-group").click();
  const search = node<HTMLInputElement>("walk-encounter-search");
  search.focus(); search.value = "no-such-enemy";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  expect(document.activeElement).toBe(search);
  expect(node("walk-encounter-catalog").querySelectorAll("button")).toHaveLength(0);
  search.value = ""; search.dispatchEvent(new Event("input", { bubbles: true }));
  expect(node<HTMLButtonElement>(`walk-group-${before.database.troops[0]!.id}`).disabled).toBe(true);
  node(`walk-group-${before.database.troops[1]!.id}`).click();
  node("walk-encounter-picker-done").click();
  node<HTMLInputElement>("walk-encounter-weight-0").value = "7";
  node("walk-encounter-weight-0").dispatchEvent(new Event("input", { bubbles: true }));
  node("walk-encounter-cancel").click();
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("saves through real controls, reopens from the list, and confirms deletion without deleting tiles", () => {
  open(); chooseFirstGroup();
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
  expect(node("walk-encounter-row-0")).toBeTruthy();
  node("walk-encounter-delete").click();
  expect(store.getCurrent().maps[mapId]!.encounterTable).toHaveLength(1);
  node("walk-encounter-delete").click();
  expect(store.getCurrent().maps[mapId]!.encounterTable).toBeUndefined();
  expect(store.getCurrent().maps[mapId]!.lowerTiles).toEqual(before.maps[mapId]!.lowerTiles);
});

it("reuses the last group choice on another rectangle and can replace existing bounds", () => {
  const first = open(); chooseFirstGroup(); node("walk-encounter-save").click();
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
  open(); chooseFirstGroup();
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
  open(); chooseFirstGroup();
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
  chooseFirstGroup();
  const variable = Array.from(node("walk-encounter-conditions-0").querySelectorAll("select"))
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


it("updates relative shares without remounting the focused weight input", () => {
  const draft = open(); chooseFirstGroup();
  node("walk-encounter-add-group").click();
  node(`walk-group-${store.getCurrent().database.troops[1]!.id}`).click();
  node("walk-encounter-picker-done").click();
  const input = node<HTMLInputElement>("walk-encounter-weight-0");
  input.focus(); input.value = "3"; input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(document.activeElement).toBe(input);
  expect(node("walk-encounter-weight-0")).toBe(input);
  expect(node("walk-encounter-share-0").textContent).toBe("75%");
  expect(node("walk-encounter-share-1").textContent).toBe("25%");
  expect(draft.choices[0]?.weight).toBe(3);
});


function nextAddedNode(id: string): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const result = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!result) return;
      clearTimeout(deadline); observer.disconnect(); resolve(result);
    });
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error(`No ${id} added`)); }, 10_000);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

it("reveals the correct group after DB open and restores the same pending draft on close", async () => {
  const draft = open(); chooseFirstGroup(1);
  const id = draft.choices[0]!.id;
  const weight = node<HTMLInputElement>("walk-encounter-weight-0");
  weight.value = "7"; weight.dispatchEvent(new Event("input", { bubbles: true }));
  draft.choices[0]!.conditions = { timePhase: "night", atLeast: 0, variableId: store.getCurrent().variables[0]!.id };
  draft.rate = 60;
  const pending = structuredClone(draft);
  const before = structuredClone(store.getCurrent());
  setSearchQueryForCollection("troops", "no-match");
  const opened = nextAddedNode("database-modal");
  node("walk-encounter-edit-group-0").click();
  await opened;
  expect(document.querySelector('[data-testid="walk-encounter-modal"]')).toBeNull();
  expect(modalStackDepthForTest()).toBe(0);
  expect(selectedRecordIdForSession("troops")).toBe(id);
  expect(document.querySelector(`[data-testid="db-record-row-${id}"]`)).not.toBeNull();
  const restored = nextAddedNode("walk-encounter-modal");
  node("database-modal-close").click();
  await restored;
  expect(draft).toEqual(pending);
  expect(node<HTMLInputElement>("walk-encounter-weight-0").value).toBe("7");
  expect(store.getCurrent()).toEqual(before);
  node("walk-encounter-cancel").click();
  expect(store.getCurrent()).toEqual(before);
});

it.each(["project", "map", "settings"])("restores but rejects the pending draft after %s changes in the group editor", async (change) => {
  const draft = open(); chooseFirstGroup();
  const opened = nextAddedNode("database-modal");
  node("walk-encounter-edit-group-0").click(); await opened;
  const restored = nextAddedNode("walk-encounter-modal");
  if (change === "project") store.replaceProject(structuredClone(store.getCurrent()));
  else {
    if (change === "map") editorState.set({ currentMapId: "other-map" });
    else store.updateMap(draft.mapId, (map) => { map.encounterRate = 99; });
    requestDatabaseModalClose("battleTest");
  }
  await restored;
  const before = structuredClone(store.getCurrent());
  expect(node("walk-encounter-error").textContent).not.toBe("");
  expect(draft.choices).toHaveLength(1);
  node("walk-encounter-save").click();
  expect(store.getCurrent()).toEqual(before);
});

it("retains missing-group rows, blocks save and lets authors replace the reference", () => {
  const draft = open();
  node("walk-encounter-cancel").click();
  draft.choices = [{ id: "deleted-group", weight: 3, conditions: { timePhase: "night" } }];
  openWalkEncounterModal(draft);
  const before = structuredClone(store.getCurrent());
  node("walk-encounter-save").click();
  expect(node("walk-encounter-error").textContent).not.toBe("");
  expect(draft.choices[0]?.id).toBe("deleted-group");
  expect(store.getCurrent()).toEqual(before);
  node("walk-encounter-edit-group-0").click();
  node(`walk-group-${before.database.troops[0]!.id}`).click();
  expect(draft.choices[0]).toEqual({ id: before.database.troops[0]!.id, weight: 3, conditions: { timePhase: "night" } });
});

it("opens the group editor from an empty database and returns to an empty draft", async () => {
  store.update((project) => { project.database.troops = []; });
  const draft = open();
  node("walk-encounter-add-group").click();
  expect(node("walk-encounter-catalog").querySelectorAll("button")).toHaveLength(0);
  const opened = nextAddedNode("database-modal");
  node("walk-encounter-group-editor").click(); await opened;
  const restored = nextAddedNode("walk-encounter-modal");
  node("database-modal-close").click(); await restored;
  expect(draft.choices).toEqual([]);
});


it("keeps per-row conditions independent and duplicate choices disabled in the picker", () => {
  const draft = open(); chooseFirstGroup();
  node("walk-encounter-add-group").click();
  const first = node<HTMLButtonElement>(`walk-group-${draft.choices[0]!.id}`);
  expect(first.disabled).toBe(true); first.click(); expect(draft.choices).toHaveLength(1);
  node(`walk-group-${store.getCurrent().database.troops[1]!.id}`).click();
  node("walk-encounter-picker-done").click();
  const firstConditions = node<HTMLDetailsElement>("walk-encounter-conditions-0");
  firstConditions.querySelector("summary")!.click();
  expect(firstConditions.open).toBe(true);
  expect(node<HTMLDetailsElement>("walk-encounter-conditions-1").open).toBe(false);
  const input = node<HTMLInputElement>("walk-encounter-min-level-0");
  input.value = "4"; input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(draft.choices[0]!.conditions.minPartyLevel).toBe(4);
  expect(draft.choices[1]!.conditions.minPartyLevel).toBeUndefined();
  node("walk-encounter-cancel").click();
  expect(getMapEditHistoryState().canUndo).toBe(false);
});


it("shows replacement recovery if a group is deleted while the form is open", () => {
  const draft = open(); chooseFirstGroup();
  store.update((project) => { project.database.troops = project.database.troops.filter((troop) => troop.id !== draft.choices[0]!.id); });
  node("walk-encounter-save").click();
  expect(node("walk-encounter-row-0").querySelector(".walk-encounter-missing")).not.toBeNull();
  node("walk-encounter-edit-group-0").click();
  expect(node("walk-encounter-picker")).toBeTruthy();
});
