/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory, undoMapEdit, redoMapEdit, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { beginWalkEncounter, applyWalkEncounter, reuseLastWalkEncounter, walkEncounterRegions, type WalkEncounterDraft } from "@/editor/walkEncounterAuthoring";
import * as locks from "@/editor/mapEditLocks";
import { eligibleEncounterEntries, pickEncounterTroopForMap } from "@/player/encounters";
import { startSession } from "@/project/session";
import { serialize, deserialize } from "@/project/io";

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  project.database.troops = [];
  delete project.system.initialTroopId;
  project.system.actionCombat = { enabled: false };
  const map = project.maps[project.startMapId]!;
  map.encounterRate = 0;
  map.troopIds = [];
  delete map.encounterTable;
  store.replaceProject(project);
  editorState.set({ currentMapId: project.startMapId });
  resetMapEditHistory();
});

function readyDraft(x = 2): WalkEncounterDraft {
  const project = store.getCurrent();
  const draft = beginWalkEncounter(project.startMapId, { x, y: 3, w: 4, h: 5 });
  draft.choices.push({ kind: "enemy", id: project.database.enemies[0]!.id, weight: 1, conditions: {} });
  return draft;
}

function currentMap() { return store.getCurrent().maps[store.getCurrent().startMapId]!; }

it("does not make troops or history until apply; writes a single annotated mutation", () => {
  const before = structuredClone(store.getCurrent());
  const changes: unknown[] = [];
  const unsubscribe = store.subscribe((_project, change) => changes.push(change));
  const draft = readyDraft();
  draft.choices[0]!.weight = 7;
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
  expect(changes).toEqual([]);
  expect(applyWalkEncounter(draft).ok).toBe(true);
  unsubscribe();
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ scope: "project", label: expect.any(String) });
});

it("saves/reloads runtime-eligible rules and never falls back outside a region", () => {
  expect(applyWalkEncounter(readyDraft()).ok).toBe(true);
  const project = deserialize(serialize(store.getCurrent()));
  const map = project.maps[project.startMapId]!;
  expect(map.encounterTable).toEqual(currentMap().encounterTable);
  // The load normalizer adds aligned members and optional defaults.
  expect(project.database.troops).toMatchObject(store.getCurrent().database.troops);
  expect(project.database.troops[0]!.members).toMatchObject([{ enemyId: project.database.enemies[0]!.id, hidden: false }]);
  const session = startSession(project, 42);
  expect(pickEncounterTroopForMap(map, session, { x: 2, y: 3 }, () => 0)).toBe(map.encounterTable![0]!.troopId);
  for (const position of [{ x: 1, y: 3 }, { x: 6, y: 3 }, { x: 2, y: 2 }, { x: 2, y: 8 }]) {
    expect(eligibleEncounterEntries(map, session, position)).toEqual([]);
    expect(pickEncounterTroopForMap(map, session, position, () => 0)).toBeUndefined();
  }
});

it.each(["preserve", "replace"] as const)("requires an explicit legacy decision: %s", (legacy) => {
  store.update((project) => {
    const map = project.maps[project.startMapId]!;
    map.troopIds = ["legacy"];
    map.encounterRate = 7;
    project.database.troops.push({ id: "legacy", name: "Legacy", enemyIds: [project.database.enemies[1]!.id], autoAlign: true, battleEventPages: [] });
  });
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  const draft = readyDraft();
  expect(draft.needsLegacyChoice).toBe(true);
  expect(applyWalkEncounter(draft).ok).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
  draft.legacy = legacy;
  expect(applyWalkEncounter(draft).ok).toBe(true);
  expect(currentMap().encounterRate).toBe(7);
  const session = startSession(store.getCurrent(), 42);
  expect(pickEncounterTroopForMap(currentMap(), session, { x: 0, y: 0 }, () => 0)).toBe(legacy === "preserve" ? "legacy" : undefined);
  expect(currentMap().troopIds).toEqual(legacy === "preserve" ? ["legacy"] : []);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
});

it("preserves other regions, edits per-entry conditions, and moves bounds from a new selection", () => {
  const first = readyDraft();
  first.choices[0]!.conditions.minPartyLevel = 3;
  expect(applyWalkEncounter(first).ok).toBe(true);
  expect(applyWalkEncounter(readyDraft(12)).ok).toBe(true);
  const other = structuredClone(currentMap().encounterTable![1]!);
  const draft = beginWalkEncounter(first.mapId, first.region, true);
  expect(draft.choices[0]!.conditions).toEqual({ minPartyLevel: 3 });
  draft.region = { x: 8, y: 9, w: 2, h: 3 };
  draft.choices[0]!.weight = 8;
  expect(applyWalkEncounter(draft).ok).toBe(true);
  expect(currentMap().encounterTable![0]).toEqual(other);
  expect(currentMap().encounterTable![1]).toMatchObject({ weight: 8, conditions: { minPartyLevel: 3, region: draft.region } });
  expect(walkEncounterRegions(currentMap())).toEqual([other.conditions!.region, draft.region]);
});

it("repeats choices without sharing drafts or duplicating simple troops, then deletes only rules", () => {
  const first = readyDraft();
  expect(applyWalkEncounter(first).ok).toBe(true);
  const draft = beginWalkEncounter(first.mapId, { x: 12, y: 3, w: 2, h: 2 });
  expect(reuseLastWalkEncounter(draft)).toBe(true);
  draft.choices[0]!.weight = 9;
  expect(applyWalkEncounter(draft).ok).toBe(true);
  expect(store.getCurrent().database.troops).toHaveLength(1);
  expect(currentMap().encounterTable!.map((entry) => entry.weight)).toEqual([1, 9]);
  const before = structuredClone(store.getCurrent());
  const remove = beginWalkEncounter(first.mapId, first.region, true);
  expect(applyWalkEncounter(remove, "delete").ok).toBe(true);
  expect(currentMap().encounterTable).toHaveLength(1);
  expect(store.getCurrent().database.troops).toEqual(before.database.troops);
  expect(currentMap().lowerTiles).toEqual(before.maps[first.mapId]!.lowerTiles);
  expect(currentMap().upperTiles).toEqual(before.maps[first.mapId]!.upperTiles);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(redoMapEdit()).toBe(true);
  expect(currentMap().encounterTable).toHaveLength(1);
});

it("uses all authored conditions in the actual runtime", () => {
  const draft = readyDraft();
  const project = store.getCurrent();
  draft.choices[0]!.conditions = { switchId: project.switches[0]!.id, variableId: project.variables[0]!.id,
    atLeast: 5, minPartyLevel: 3, maxPartyLevel: 8, timePhase: "night", season: "winter" };
  expect(applyWalkEncounter(draft).ok).toBe(true);
  const session = startSession(store.getCurrent(), 42);
  session.partyActorIds = [project.database.actors[0]!.id];
  session.actorLevels = { [session.partyActorIds[0]!]: 4 };
  session.switches[project.switches[0]!.id] = true;
  session.variables[project.variables[0]!.id] = 5;
  session.gameTime = { year: 1, season: "winter", day: 1, hour: 23, minute: 0 };
  const eligible = () => eligibleEncounterEntries(currentMap(), session, { x: 2, y: 3 });
  expect(eligible()).toHaveLength(1);
  session.switches[project.switches[0]!.id] = false; expect(eligible()).toEqual([]);
  session.switches[project.switches[0]!.id] = true;
  session.variables[project.variables[0]!.id] = 4; expect(eligible()).toEqual([]);
  session.variables[project.variables[0]!.id] = 5;
  session.actorLevels[session.partyActorIds[0]!] = 9; expect(eligible()).toEqual([]);
  session.actorLevels[session.partyActorIds[0]!] = 2; expect(eligible()).toEqual([]);
  session.actorLevels[session.partyActorIds[0]!] = 4;
  session.gameTime = { ...session.gameTime, hour: 12 }; expect(eligible()).toEqual([]);
  session.gameTime = { ...session.gameTime, hour: 23, season: "spring" }; expect(eligible()).toEqual([]);
});

it("multi-selects enemies with relative weights without reusing a scripted/trainer troop", () => {
  const draft = readyDraft();
  const secondEnemy = store.getCurrent().database.enemies[1]!;
  store.update((project) => {
    project.database.troops.push({ id: "trainer", name: "Trainer", enemyIds: [draft.choices[0]!.id], autoAlign: true, trainerBattle: true, battleEventPages: [] });
  });
  draft.choices.push({ kind: "enemy", id: secondEnemy.id, weight: 3, conditions: {} });
  expect(applyWalkEncounter(draft).ok).toBe(true);
  const table = currentMap().encounterTable!;
  expect(table).toHaveLength(2);
  expect(table[0]!.troopId).not.toBe("trainer");
  expect(store.getCurrent().database.troops).toHaveLength(3);
  const session = startSession(store.getCurrent(), 42);
  expect(pickEncounterTroopForMap(currentMap(), session, { x: 2, y: 3 }, () => 0.2)).toBe(table[0]!.troopId);
  expect(pickEncounterTroopForMap(currentMap(), session, { x: 2, y: 3 }, () => 0.5)).toBe(table[1]!.troopId);
  expect(walkEncounterRegions(currentMap())).toHaveLength(1);
});

it("rechecks map locks for save and delete without creating a history entry", () => {
  const draft = readyDraft();
  expect(applyWalkEncounter(draft).ok).toBe(true);
  const edit = beginWalkEncounter(draft.mapId, draft.region, true);
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  vi.spyOn(locks, "canEditMap").mockReturnValue(false);
  expect(applyWalkEncounter(edit).ok).toBe(false);
  expect(applyWalkEncounter(edit, "delete").ok).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("merges unrelated live edits but rejects changed encounter settings and project switches", () => {
  const draft = readyDraft();
  store.updateMap(draft.mapId, (map) => { map.name = "Renamed while open"; map.lowerTiles[0] = 123; });
  expect(applyWalkEncounter(draft).ok).toBe(true);
  expect(currentMap().name).toBe("Renamed while open");
  expect(currentMap().lowerTiles[0]).toBe(123);
  const stale = readyDraft(12);
  store.updateMap(draft.mapId, (map) => { map.encounterTable!.push({ troopId: "unrelated", weight: 5 }); });
  const before = structuredClone(store.getCurrent());
  expect(applyWalkEncounter(stale).ok).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  const switched = readyDraft(18);
  store.replaceProject(structuredClone(store.getCurrent()));
  expect(applyWalkEncounter(switched).ok).toBe(false);
  expect(reuseLastWalkEncounter(readyDraft(18))).toBe(false);
});

it("rejects invalid bounds, conditions, empty selections and deleted references atomically", () => {
  const draft = readyDraft();
  const before = structuredClone(store.getCurrent());
  draft.region.w = currentMap().width + 1;
  expect(applyWalkEncounter(draft).ok).toBe(false);
  draft.region.w = 4;
  draft.choices[0]!.weight = 0; expect(applyWalkEncounter(draft).ok).toBe(false);
  draft.choices[0]!.weight = 1;
  draft.choices[0]!.conditions = { minPartyLevel: 8, maxPartyLevel: 2 };
  expect(applyWalkEncounter(draft).ok).toBe(false);
  draft.choices[0]!.conditions = {};
  draft.choices[0]!.id = "deleted"; expect(applyWalkEncounter(draft).ok).toBe(false);
  draft.choices = []; expect(applyWalkEncounter(draft).ok).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("rejects another active map and real-time combat rather than silently creating ineffective rules", () => {
  const draft = readyDraft();
  editorState.set({ currentMapId: "another-map" });
  expect(applyWalkEncounter(draft).ok).toBe(false);
  editorState.set({ currentMapId: draft.mapId });
  store.update((project) => {
    project.system.actionCombat = { enabled: true };
    project.maps[draft.mapId]!.actionCombat = true;
  });
  const before = structuredClone(store.getCurrent());
  expect(applyWalkEncounter(draft).ok).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("creates effective rectangular rules and a troop in one undoable save", () => {
  const before = structuredClone(store.getCurrent());
  const mapId = before.startMapId;
  const enemy = before.database.enemies[0]!;
  const draft = beginWalkEncounter(mapId, { x: 2, y: 3, w: 4, h: 5 });
  draft.choices.push({ kind: "enemy", id: enemy.id, weight: 1, conditions: {} });
  expect(applyWalkEncounter(draft)).toEqual({ ok: true });
  const saved = structuredClone(store.getCurrent());
  expect(saved.maps[mapId]!.encounterRate).toBeGreaterThan(0);
  expect(saved.database.troops).toHaveLength(1);
  expect(saved.maps[mapId]!.encounterTable).toEqual([{
    troopId: saved.database.troops[0]!.id, weight: 1,
    conditions: { region: { x: 2, y: 3, w: 4, h: 5 } },
  }]);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(redoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(saved);
});
