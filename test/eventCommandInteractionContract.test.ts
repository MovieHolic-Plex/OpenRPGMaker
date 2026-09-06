/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { addEventPageCommand, moveEventPageCommandAt, moveEventPageCommandAcross } from "@/editor/eventPages";
import { recordProjectSnapshot, resetMapEditHistory, pendingHistoryLabels, getMapEditHistoryEntries } from "@/editor/mapEditHistory";
import { clearCommandInspector, selectedCommandPath } from "@/editor/panels/eventEditor/commandInspector";
import { readEventCommandClipboard } from "@/editor/panels/eventEditor/commandClipboard";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import * as content from "@/editor/panels/eventEditor/content";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";

const original: Command[] = [
  { kind: "text", body: "first" },
  { kind: "loop", body: [{ kind: "text", body: "nested" }] },
  { kind: "text", body: "last" },
];
let mapId: string;
function commands(pageId = "p1"): Command[] {
  return store.getCurrent().maps[mapId]!.events[0]!.pages!.find(page => page.id === pageId)!.commands;
}
function element(selector: string): HTMLElement {
  const result = document.querySelector<HTMLElement>(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
function button(id: string): HTMLElement { return element(`[data-testid="${id}"]`); }
function head(index = 0): HTMLElement { return element(`[data-cmd-path="[${index}]"] .cmd-head`); }
function key(target: HTMLElement, value: string, ctrlKey = true, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: value, ctrlKey, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
function undo(): void { button("event-command-toolbar-undo").click(); }

beforeEach(() => {
  resetModalStackForTest();
  clearCommandInspector();
  resetMapEditHistory();
  const project = createBlankProject();
  mapId = project.startMapId;
  const page: EventPage = {
    id: "p1", name: "one", conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: structuredClone(original),
  };
  project.maps[mapId]!.events = [{ id: "contract", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
    pages: [page, { ...structuredClone(page), id: "p2", commands: [{ kind: "text", body: "other page" }] }] }];
  store.replaceProject(project);
  editorState.set({ currentMapId: mapId, selectedEventId: "contract", selectedEventPageId: "p1" });
  openEventEditorModal(mapId, "contract");
  button("event-view-toggle-list").click();
});
afterEach(() => {
  const modal = document.querySelector('[data-testid="event-editor-modal"]');
  modal?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
  document.body.replaceChildren();
  clearCommandInspector();
  resetModalStackForTest();
  resetMapEditHistory();
  vi.restoreAllMocks();
});

describe("page command interaction contract", () => {
  it("routes modal Ctrl+Z to the same command snapshot as the toolbar", () => {
    head().click();
    button("event-command-toolbar-cut").click();
    key(button("event-editor-modal"), "z");
    expect(commands()).toEqual(original);
  });
  it("does not consume global map undo when page history is empty", () => {
    recordProjectSnapshot("global map edit", mapId, { kind: "map" });
    const before = pendingHistoryLabels();
    key(button("event-editor-modal"), "z");
    expect(pendingHistoryLabels()).toEqual(before);
  });
  it("leaves native text undo unprevented and local history intact", () => {
    head().click();
    button("event-command-toolbar-cut").click();
    const input = button("event-editor-name");
    expect(key(input, "z").defaultPrevented).toBe(false);
    expect(commands()).toHaveLength(2);
  });
  it("records the stable catalog command-action seam in the current page history", () => {
    addEventPageCommand(mapId, "contract", "p1", { kind: "text", body: "catalog" });
    undo();
    expect(commands()).toEqual(original);
  });
  it("selects the authored tree and deletes it as one undo, not only the focused row", () => {
    head().click();
    key(head(), "a");
    expect(document.querySelectorAll(".cmd-item.selected")).toHaveLength(4);
    key(head(), "Delete", false);
    expect(commands()).toEqual([]);
    undo();
    expect(commands()).toEqual(original);
  });
  it("shares Select All with toolbar cut and pastes deep cloned roots once in stable order", () => {
    head().click();
    key(head(), "a");
    button("event-command-toolbar-cut").click();
    expect(commands()).toEqual([]);
    undo();
    head().click();
    key(head(), "v");
    expect(commands()).toEqual([...original, ...original]);
    undo();
    expect(commands()).toEqual(original);
    const legacyRead = readEventCommandClipboard();
    expect(legacyRead).toEqual(original[0]);
  });
  it("clears positional inspector selection when the active page changes", () => {
    head().click();
    editorState.set({ selectedEventPageId: "p2" });
    expect(selectedCommandPath()).toBeUndefined();
    expect(button("event-editor-inspector").hidden).toBe(true);
  });
  it("clears selection rather than selecting the next positional command after deletion", () => {
    head().click();
    key(head(), "Delete", false);
    expect(selectedCommandPath()).toBeUndefined();
    expect(document.querySelectorAll(".cmd-item.selected")).toHaveLength(0);
  });
  it("gives the context menu its own Escape layer and restores its opener", () => {
    const opener = head();
    opener.focus();
    const depth = modalStackDepthForTest();
    opener.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(modalStackDepthForTest()).toBe(depth + 1);
    key(button("event-command-menu-edit"), "Escape", false);
    expect(document.querySelector('[data-testid="event-command-context-menu"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(modalStackDepthForTest()).toBe(depth);
  });
  it("keeps redo after a rejected or boundary move", () => {
    let list: Command[] = structuredClone(original);
    const history = createCommandToolbarHistory({ key: "noop-contract", readCommands: () => list, replaceCommands: next => { list = next; } });
    history.replaceAll([]);
    history.undo();
    history.replaceAll(structuredClone(list));
    expect(history.canRedo()).toBe(true);
    history.redo();
    expect(list).toEqual([]);
  });
  it("navigates from a hidden filtered view to the exact nested command and inspector", () => {
    button("event-view-toggle-flow").click();
    const search = document.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
    search.value = "no-such-command";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    editorState.set({ selectedEventPageId: "p2" });
    expect(content.navigateToEventCommand).toBeTypeOf("function");
    expect(content.navigateToEventCommand(mapId, "contract", "p1", [1, -5, 0])).toBe(true);
    expect(editorState.get().selectedEventPageId).toBe("p1");
    expect(element(".cmd-list").hidden).toBe(false);
    expect(document.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!.value).toBe("");
    expect(selectedCommandPath()).toEqual([1, -5, 0]);
    expect(button("event-editor-inspector").dataset.commandPath).toBe("[1,-5,0]");
    expect(document.activeElement).toBe(element('[data-cmd-path="[1,-5,0]"] .cmd-head'));
  });
  it("disposes a body-mounted context menu synchronously on parent close", () => {
    head().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    button("event-editor-modal").dispatchEvent(new CustomEvent("oprn:event-editor-close"));
    expect(document.querySelector('[data-testid="event-command-context-menu"]')).toBeNull();
  });
  it("routes context-menu Ctrl+Z to page history without leaving a popup", () => {
    head().click();
    button("event-command-toolbar-cut").click();
    head().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    key(button("event-command-menu-edit"), "z");
    expect(commands()).toEqual(original);
    expect(document.querySelector('[data-testid="event-command-context-menu"]')).toBeNull();
  });
  it("removes exactly its outside listener on action and replacement", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    head().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    const listener = add.mock.calls.find(call => call[0] === "mousedown")?.[1];
    expect(listener).toBeDefined();
    button("event-command-menu-copy").click();
    expect(remove).toHaveBeenCalledWith("mousedown", listener);
    const depth = modalStackDepthForTest();
    head().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    head(1).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(modalStackDepthForTest()).toBe(depth + 1);
    expect(document.querySelectorAll('[data-testid="event-command-context-menu"]')).toHaveLength(1);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(modalStackDepthForTest()).toBe(depth);
  });
  it("keeps page redo through actual boundary and self-descendant moves", () => {
    head().click();
    button("event-command-toolbar-cut").click();
    undo();
    const history = createCommandToolbarHistory({ key: `${mapId}:contract:p1`, readCommands: commands, replaceCommands: () => {} });
    const actions = history.wrapActions({
      addCommand: () => {}, insertCommand: () => {}, replaceCommand: () => {}, deleteCommand: () => {}, moveCommandTo: () => {},
      moveCommand: (path, dir) => moveEventPageCommandAt(mapId, "contract", "p1", path, dir),
      moveCommandAcross: (path, target, index) => moveEventPageCommandAcross(mapId, "contract", "p1", path, target, index),
    });
    actions.moveCommand([0], -1);
    actions.moveCommandAcross?.([1], [1, -5], 0);
    expect(history.canRedo()).toBe(true);
    key(button("event-editor-modal"), "z", true, true);
    expect(commands()).toEqual(original.slice(1));
  });
  it("uses one page undo for a visible follower preset insertion", () => {
    element('[data-testid^="follower-preset-chip-"]').click();
    expect(commands().length).toBeGreaterThan(original.length);
    undo();
    expect(commands()).toEqual(original);
    expect(button("event-command-toolbar-undo").hasAttribute("disabled")).toBe(true);
  });
  it("records Ctrl+K picker confirmation once and cancels staged edits without history", () => {
    key(button("event-editor-modal"), "k");
    button("command-picker-add-text").click();
    button("event-command-edit-ok").click();
    expect(commands()).toHaveLength(original.length + 1);
    key(button("event-editor-modal"), "z");
    expect(commands()).toEqual(original);
    key(button("event-editor-modal"), "k");
    button("command-picker-add-text").click();
    button("event-command-edit-cancel").click();
    expect(commands()).toEqual(original);
    expect(button("event-command-toolbar-redo").hasAttribute("disabled")).toBe(false);
  });
  it("inserts the memory-opening command template only into this page as one local undo", () => {
    store.update(project => { project.maps[mapId]!.events[0]!.pages![0]!.commands = []; });
    const globalHistory = getMapEditHistoryEntries();
    const otherPage = structuredClone(commands("p2"));
    button("event-template-memory-opening").click();
    expect(commands().length).toBeGreaterThan(1);
    expect(commands("p2")).toEqual(otherPage);
    expect(getMapEditHistoryEntries()).toEqual(globalHistory);
    undo();
    expect(commands()).toEqual([]);
  });
  it("preserves all selected rows and inspector when switching authoring views", () => {
    head().click();
    key(head(), "a");
    button("event-view-toggle-storyboard").click();
    expect(element('[data-testid="event-storyboard-host"]').querySelectorAll('[data-cmd-path].selected')).toHaveLength(4);
    button("event-view-toggle-list").click();
    button("event-command-toolbar-cut").click();
    expect(commands()).toEqual([]);
  });
  it("uses authored-tree keyboard selection and deletion in storyboard view too", () => {
    button("event-view-toggle-storyboard").click();
    const row = element('[data-testid="event-storyboard-host"] [data-cmd-path="[0]"]');
    row.click();
    key(row, "a");
    key(row, "Delete", false);
    expect(commands()).toEqual([]);
    undo();
    expect(commands()).toEqual(original);
  });
  it("clears stale descendant selections after an inspector structural edit", () => {
    head(1).click();
    key(head(1), "a");
    button("event-loop-body-delete-0").click();
    expect(selectedCommandPath()).toBeUndefined();
    expect(document.querySelectorAll('.cmd-item.selected')).toHaveLength(0);
  });
  it("pastes a cut page back through the empty command-list keyboard surface as one undo", () => {
    head().click();
    key(head(), "a");
    key(head(), "x");
    key(button("event-command-empty-line"), "v");
    expect(commands()).toEqual(original);
    undo();
    expect(commands()).toEqual([]);
  });
  it("does not offer a single-row move while a batch is selected", () => {
    head().click();
    key(head(), "a");
    expect(button("event-command-toolbar-move-down").hasAttribute("disabled")).toBe(true);
  });
});
