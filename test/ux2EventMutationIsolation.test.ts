import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { cloneCommandContainersForMove } from "@/project/projectClone";
import { createDefaultEventPage, moveEventPageCommandAcross, moveEventPageCommandAt, replaceEventPageCommandAt, replaceEventPageCommands } from "@/editor/eventPages";
import { FORK_THEN_BRANCH_INDEX, FORK_ELSE_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { createCommandToolbarHistory, clearCommandToolbarHistories } from "@/editor/panels/eventEditor/commandToolbarHistory";
import type { Command, GameEvent } from "@/project/types";

function event(id: string): GameEvent {
  const result: GameEvent = { id, x: 2, y: 2, trigger: { kind: "action" }, commands: [] };
  const page = createDefaultEventPage(result, 1);
  page.id = "page";
  page.commands = [
    { kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [{ kind: "text", body: "child" }], else: [{ kind: "text", body: "other" }] },
    { kind: "text", body: "second" },
    { kind: "text", body: "third" },
  ];
  result.pages = [page];
  return result;
}
let mapId: string;
beforeEach(() => {
  const project = createBlankProject();
  mapId = project.startMapId;
  const target = event("ux2-target");
  target.draft = { kind: "edit", original: structuredClone(target) };
  const map = project.maps[mapId]!;
  map.lowerOverlayTiles = Array(map.lowerTiles.length).fill(-1);
  map.upperOverlayTiles = Array(map.lowerTiles.length).fill(-1);
  map.shadowBits = Array(map.lowerTiles.length).fill(0);
  map.lowerTileStacks = { 0: [1, 2] };
  map.upperTileStacks = { 0: [3, 4] };
  map.events = [target, event("ux2-other")];
  store.replaceProject(project);
  clearCommandToolbarHistories(`${mapId}:ux2-target:`);
});
const current = () => store.getCurrent().maps[mapId]!.events[0]!;
const commands = () => current().pages![0]!.commands;

describe("event-only copy on write", () => {
  it("keeps every grid/other event identity and leaves old published/draft originals intact", () => {
    const before = store.getCurrent();
    const beforeValue = structuredClone(before.maps[mapId]!.events[0]);
    const map = before.maps[mapId]!;
    moveEventPageCommandAt(mapId, "ux2-target", "page", [1], 1);
    const after = store.getCurrent();
    expect(after.maps[mapId]).not.toBe(map);
    for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles", "shadowBits", "lowerTileStacks", "upperTileStacks"] as const) {
      expect(after.maps[mapId]![key]).toBe(map[key]);
    }
    expect(after.maps[mapId]!.events[1]).toBe(map.events[1]);
    expect(after.database).toBe(before.database);
    expect(commands()[0]).toBe(map.events[0]!.pages![0]!.commands[0]);
    replaceEventPageCommandAt(mapId, "ux2-target", "page", [0, FORK_THEN_BRANCH_INDEX, 0], { kind: "text", body: "new child" });
    expect(map.events[0]).toEqual(beforeValue);
    expect(current().draft!.original).toEqual(beforeValue!.draft!.original);
    const priorEvent = current();
    store.updateEvent(mapId, "ux2-target", draft => {
      draft.draft!.original!.pages![0]!.commands[0] = { kind: "text", body: "isolated draft original" };
    });
    expect(priorEvent.draft!.original).toEqual(beforeValue!.draft!.original);
    expect(map.events[0]).toEqual(beforeValue);
  });

  it("copies choice option owners and only selected branch arrays before splicing", () => {
    const original: Command[] = [{ kind: "choices", options: [{ text: "a", branch: [{ kind: "text", body: "a" }] }, { text: "b", branch: [] }] }];
    const next = cloneCommandContainersForMove(original, [[0, 0], [0, 1]]);
    const choices = next[0] as Extract<Command, { kind: "choices" }>;
    choices.options[0]!.branch.pop();
    choices.options[1]!.branch.push({ kind: "text", body: "moved" });
    expect((original[0] as typeof choices).options[0]!.branch).toHaveLength(1);
    expect((original[0] as typeof choices).options[1]!.branch).toHaveLength(0);
  });

  it("resolves both cross-move containers before ancestor indices change and rejects self drops", () => {
    const before = store.getCurrent();
    moveEventPageCommandAcross(mapId, "ux2-target", "page", [0, FORK_THEN_BRANCH_INDEX, 0], [0, FORK_ELSE_BRANCH_INDEX], 1);
    const fork = commands()[0] as Extract<Command, { kind: "fork" }>;
    expect(fork.then).toEqual([]);
    expect(fork.else).toEqual([{ kind: "text", body: "other" }, { kind: "text", body: "child" }]);
    expect((before.maps[mapId]!.events[0]!.pages![0]!.commands[0] as typeof fork).then).toHaveLength(1);
    const moved = store.getCurrent();
    moveEventPageCommandAcross(mapId, "ux2-target", "page", [0], [0, FORK_THEN_BRANCH_INDEX], 0);
    expect(store.getCurrent()).toBe(moved);
    replaceEventPageCommands(mapId, "ux2-target", "page", [{ kind: "text", body: "source" }, fork]);
    const old = store.getCurrent();
    moveEventPageCommandAcross(mapId, "ux2-target", "page", [0], [1, FORK_THEN_BRANCH_INDEX], 0);
    expect(commands()).toHaveLength(1);
    expect((commands()[0] as typeof fork).then).toEqual([{ kind: "text", body: "source" }]);
    expect(old.maps[mapId]!.events[0]!.pages![0]!.commands).toHaveLength(2);
  });

  it("does no preparation/emit for boundary moves; immutable history has no full-page snapshot clones", () => {
    const history = createCommandToolbarHistory({ key: `${mapId}:ux2-target:page`, immutableSnapshots: true, readCommands: commands,
      replaceCommands: next => replaceEventPageCommands(mapId, "ux2-target", "page", next) });
    const action = history.wrapActions({ addCommand() {}, insertCommand() {}, replaceCommand() {}, deleteCommand() {},
      moveCommand: (path, dir) => moveEventPageCommandAt(mapId, "ux2-target", "page", path, dir), moveCommandTo() {} });
    const before = store.getCurrent();
    const emit = vi.fn(); const unsubscribe = store.subscribe(emit);
    action.moveCommand([0], -1);
    expect(store.getCurrent()).toBe(before);
    expect(emit).not.toHaveBeenCalled();
    expect(history.canUndo()).toBe(false);
    const clone = vi.spyOn(globalThis, "structuredClone");
    action.moveCommand([1], 1);
    // Vault may clone this draft event. It must not clone the page command tree.
    expect(clone.mock.calls.some(([value]) => value === before.maps[mapId]!.events[0]!.pages![0]!.commands)).toBe(false);
    clone.mockRestore();
    history.undo(); expect(commands()).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
    history.redo(); expect(commands()[1]).toEqual({ kind: "text", body: "third" });
    replaceEventPageCommandAt(mapId, "ux2-target", "page", [1], { kind: "text", body: "later" });
    expect(before.maps[mapId]!.events[0]!.pages![0]!.commands[1]).toEqual({ kind: "text", body: "second" });
    unsubscribe();
  });
});
