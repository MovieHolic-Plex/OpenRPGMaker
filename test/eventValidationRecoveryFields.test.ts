/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { clearCommandInspector, selectedCommandPath } from "@/editor/panels/eventEditor/commandInspector";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { defaultRouteSoundId } from "@/editor/panels/eventEditor/moveRouteCommandCatalog";
import { eventValidationDiagnosticReport } from "@/editor/eventValidationDiagnostics";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, FieldSpawnDef, MoveCommand } from "@/project/types";

let mapId: string;
function control(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
function input(id: string, value: string, event = "change") {
  const node = control(id);
  if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) throw new Error(`Not editable: ${id}`);
  node.value = value;
  node.dispatchEvent(new Event(event, { bubbles: true }));
}
function currentPage(): EventPage {
  const page = store.getCurrent().maps[mapId]?.events.find(event => event.id === "recovery")?.pages?.[0];
  if (!page) throw new Error("Missing page");
  return page;
}
function open(commands: Command[], moves?: MoveCommand[]) {
  const project = store.getCurrent();
  const page: EventPage = { id: "page", name: "Recovery", conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "below", movement: moves ? { type: "custom", speed: 4, frequency: 5, route: { moves, repeat: false, wait: true, skippable: true } }
      : { type: "fixed", speed: 3, frequency: 3 }, commands };
  store.updateMap(mapId, map => { map.events = [{ id: "recovery", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] }]; });
  editorState.set({ currentMapId: project.startMapId, selectedEventId: "recovery", selectedEventPageId: "page" });
  openEventEditorModal(mapId, "recovery");
}
function clickError(code: string) {
  const index = validateEventDraft(store.getCurrent(), mapId, "recovery").issues.findIndex(issue => issue.severity === "error" && issue.code === code);
  expect(index).toBeGreaterThanOrEqual(0);
  control("event-draft-validation-summary").click();
  control(`event-draft-validation-issue-${index}`).click();
}
function focusedId() {
  return document.activeElement?.getAttribute("data-custom-select-for") ?? document.activeElement?.getAttribute("data-testid");
}
beforeEach(() => {
  resetModalStackForTest(); clearCommandInspector();
  const project = createBlankProject();
  mapId = project.startMapId;
  store.replaceProject(project);
});
afterEach(() => {
  document.querySelector('[data-testid="event-command-edit-cancel"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.querySelector('[data-testid="event-page-move-route-cancel"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
  document.body.replaceChildren(); clearCommandInspector(); resetModalStackForTest();
});

function spawn(): FieldSpawnDef {
  const project = store.getCurrent();
  return { id: "keep-spawn", troopId: project.database.troops[0]?.id ?? "", area: { x: 1, y: 1, w: 2, h: 2 },
    maxAlive: 4, respawnSec: 31, chase: true, factionId: "enemy", persistKill: true, footprint: { width: 2, height: 2 }, passRows: 1,
    onKillSwitchId: project.switches[0]?.id, graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "left", pattern: 2, scale: 1.5 } };
}
function currentSpawn(): FieldSpawnDef {
  const loop = currentPage().commands[0];
  const command = loop?.kind === "loop" ? loop.body[0] : undefined;
  if (command?.kind !== "spawnFieldEnemy") throw new Error("Missing spawn command");
  return command.spawn;
}

describe("spawn validation recovery in the actual inspector", () => {
  it("accumulates staged field edits and optional clears through the existing command dialog", () => {
    const original = spawn();
    let saved: Command | undefined;
    openEventCommandEditDialog({ initial: { kind: "spawnFieldEnemy", spawn: original }, onApply: command => { saved = command; } });
    input("event-command-spawn-area-x", "3");
    input("event-command-spawn-area-y", "4");
    input("event-command-spawn-switch", "");
    input("event-command-spawn-graphic", "");
    expect(saved).toBeUndefined();
    const expected = structuredClone(original);
    expected.area = { ...expected.area, x: 3, y: 4 };
    delete expected.onKillSwitchId;
    if (expected.graphic) delete expected.graphic.sprite;
    control("event-command-edit-ok").click();
    expect(saved).toEqual({ kind: "spawnFieldEnemy", spawn: expected });
    expect(original).toEqual(spawn());
  });

  it.each(["troop", "switch", "graphic", "x", "y", "w", "h"] as const)("focuses and repairs %s without losing authored spawn data", field => {
    // Given: one invalid nested spawn field and non-default unrelated data.
    const valid = spawn();
    const invalid = structuredClone(valid);
    let testId: string; let code: string; let value: string;
    if (field === "troop") { invalid.troopId = "missing"; testId = "event-command-spawn-troop"; code = "reference.troop.missing"; value = valid.troopId; }
    else if (field === "switch") { invalid.onKillSwitchId = "missing"; testId = "event-command-spawn-switch"; code = "reference.switch.missing"; value = valid.onKillSwitchId ?? ""; }
    else if (field === "graphic") { invalid.graphic = { ...valid.graphic, sprite: { type: "bundled", id: "missing" } }; testId = "event-command-spawn-graphic"; code = "reference.resource.missing"; value = "tex_easyrpg_charset_people1"; }
    else { invalid.area[field] = -1; testId = `event-command-spawn-area-${field}`; code = "map.area.out-of-bounds"; value = String(valid.area[field]); }
    open([{ kind: "loop", body: [{ kind: "spawnFieldEnemy", spawn: invalid }, { kind: "breakLoop" }] }]);
    // When: the diagnostic selects the field and the author corrects it.
    clickError(code);
    expect(selectedCommandPath()).toEqual([0, -5, 0]);
    expect(focusedId()).toBe(testId);
    expect(currentSpawn()).toEqual(invalid); // Rendering/navigation may not repair data by itself.
    input(testId, value);
    // Then: only the intended field changes and validation no longer blocks saving.
    expect(currentSpawn()).toEqual(valid);
    expect(validateEventDraft(store.getCurrent(), mapId, "recovery").canCommit).toBe(true);
  });
});

const routeCases: readonly { move: MoveCommand; code: string; testId: string; value: string; repaired: MoveCommand }[] = [
  { move: { kind: "setSwitch", switchId: "missing", value: false }, code: "reference.switch.missing", testId: "event-page-move-route-switch-id", value: "sw_0001", repaired: { kind: "setSwitch", switchId: "sw_0001", value: false } },
  { move: { kind: "changeGraphic", spriteId: "missing" }, code: "reference.resource.missing", testId: "event-page-move-route-graphic-id", value: "tex_easyrpg_charset_people1", repaired: { kind: "changeGraphic", spriteId: "tex_easyrpg_charset_people1" } },
  { move: { kind: "playSe", resourceId: "missing" }, code: "reference.resource.missing", testId: "event-page-move-route-sound-id", value: defaultRouteSoundId(), repaired: { kind: "playSe", resourceId: defaultRouteSoundId() } },
];
describe("page route validation recovery", () => {
  it("keeps initial and appended parameter changes as insertion templates until explicit row selection", () => {
    const original: MoveCommand = { kind: "playSe", resourceId: "preserved-original" };
    open([], [original]);
    const before = structuredClone(currentPage());
    control("event-page-custom-route").click();
    input("event-page-move-route-sound-id", "first-insert", "input");
    control("event-page-move-route-add-play-se").click();
    input("event-page-move-route-sound-id", "second-insert", "input");
    control("event-page-move-route-add-play-se").click();
    expect(currentPage()).toEqual(before);
    control("event-page-move-route-ok").click();
    expect(currentPage().movement.route?.moves).toEqual([original,
      { kind: "playSe", resourceId: "first-insert" }, { kind: "playSe", resourceId: "second-insert" }]);
  });

  it.each(routeCases)("opens, selects and edits the exact $move.kind step without committing until OK", ({ move, code, testId, value, repaired }) => {
    const moves: MoveCommand[] = [{ kind: "move", dir: "up" }, move, { kind: "move", dir: "down" }];
    open([{ kind: "text", body: "keep commands" }], moves);
    const before = structuredClone(currentPage());
    // When: selecting a page movement diagnostic opens the existing route editor.
    clickError(code);
    expect(focusedId()).toBe(testId);
    expect(control("event-page-move-route-command-2").classList.contains("selected")).toBe(true);
    input(testId, value, "input");
    // Then: only its local selected step changes, then the existing OK boundary commits it.
    expect(currentPage()).toEqual(before);
    control("event-page-move-route-ok").click();
    expect(currentPage()).toEqual({ ...before, movement: { ...before.movement, route: {
      ...before.movement.route, moves: [moves[0], repaired, moves[2]],
    } } });
    expect(validateEventDraft(store.getCurrent(), mapId, "recovery").canCommit).toBe(true);
  });

  it.each(["map", "x", "y"] as const)("focuses and repairs the NPC transfer %s field in its selected step", field => {
    const move: MoveCommand = { kind: "npcTransfer", mapId: field === "map" ? "missing" : mapId,
      x: field === "x" ? -1 : 1, y: field === "y" ? -1 : 2, direction: "left" };
    open([{ kind: "text", body: "keep" }], [move, { kind: "move", dir: "down" }]);
    clickError(field === "map" ? "reference.map.missing" : "map.position.out-of-bounds");
    const testId = `event-page-move-route-npc-target-${field}`;
    expect(focusedId()).toBe(testId);
    input(testId, field === "map" ? mapId : field === "x" ? "1" : "2", field === "map" ? "change" : "input");
    control("event-page-move-route-ok").click();
    expect(currentPage().movement.route?.moves[0]).toEqual({ kind: "npcTransfer", mapId, x: 1, y: 2, direction: "left" });
    expect(validateEventDraft(store.getCurrent(), mapId, "recovery").canCommit).toBe(true);
  });

  it("recomputes repeated route-step locations after reorder and deletion", () => {
    open([], [{ kind: "playSe", resourceId: "first-missing" }, { kind: "move", dir: "up" }, { kind: "playSe", resourceId: "second-missing" }]);
    store.updateMap(mapId, map => {
      const route = map.events[0]?.pages?.[0]?.movement.route;
      if (!route) throw new Error("Missing route");
      route.moves.reverse(); route.moves.splice(1, 1);
    });
    const event = store.getCurrent().maps[mapId]?.events[0];
    if (!event) throw new Error("Missing event");
    const report = eventValidationDiagnosticReport(validateEventDraft(store.getCurrent(), mapId, "recovery"), event);
    expect(report.issues.map(issue => issue.selection)).toEqual(["event-page-move-route-command-1", "event-page-move-route-command-2"]);
    clickError("reference.resource.missing");
    const sound = control("event-page-move-route-sound-id");
    expect(sound instanceof HTMLInputElement && sound.value).toBe("second-missing");
    expect(focusedId()).toBe("event-page-move-route-sound-id");
    input("event-page-move-route-sound-id", defaultRouteSoundId(), "input");
    control("event-page-move-route-ok").click();
    expect(currentPage().movement.route?.moves).toEqual([{ kind: "playSe", resourceId: defaultRouteSoundId() }, { kind: "playSe", resourceId: "first-missing" }]);
  });

  it("cancels route recovery without changing the page", () => {
    open([], [{ kind: "playSe", resourceId: "missing" }]);
    const before = structuredClone(currentPage());
    clickError("reference.resource.missing");
    expect(focusedId()).toBe("event-page-move-route-sound-id");
    input("event-page-move-route-sound-id", "edited", "input");
    control("event-page-move-route-cancel").click();
    expect(currentPage()).toEqual(before);
  });
});
