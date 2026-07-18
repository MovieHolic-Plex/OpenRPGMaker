import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { undoMapEdit } from "@/editor/mapEditHistory";
import { deleteEditorEvent, requestEditorEventDeletion } from "@/editor/eventDeletion";
import type { Command, EventPage, GameEvent } from "@/project/types";
import { installFakeDom } from "./fakeDom";

function eventPage(commands: Command[] = []): EventPage {
  return {
    id: "page-1",
    name: "페이지 1",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function gameEvent(page: EventPage): GameEvent {
  return {
    id: "event-1",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

function keyEvent(key: string, target?: EventTarget | null): KeyboardEvent {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    altKey: { value: false },
    ctrlKey: { value: false },
    key: { value: key },
    metaKey: { value: false },
    target: { value: target ?? null },
  });
  return event as KeyboardEvent;
}

describe("event command Delete safety", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    _resetEventDraftVaultForTest();
    restoreDom = installFakeDom();
    store.replaceProject(createBlankProject());
  });

  afterEach(() => {
    document.querySelector('[data-testid="event-editor-modal"]')?.remove();
    document.querySelector('[data-testid="toast"]')?.remove();
    restoreDom?.();
    vi.unstubAllGlobals();
  });

  it("Delete on a selected command removes only that command, not the event", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const commands: Command[] = [
      { kind: "text", speaker: "A", body: "hello" },
      { kind: "changeGold", op: "+=", amount: 10 },
    ];
    const page = eventPage(commands);
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      selectedEventId: "event-1",
      selectedEventPageId: page.id,
    });
    const confirmDeletion = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmDeletion);

    openEventEditorModal(project.startMapId, "event-1");
    const cmdHead = document.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head');
    if (!cmdHead) throw new Error("expected command head");

    cmdHead.dispatchEvent(keyEvent("Delete", cmdHead));

    expect(confirmDeletion).not.toHaveBeenCalled();
    const live = store.getCurrent().maps[project.startMapId]!.events.find((e) => e.id === "event-1");
    expect(live).toBeTruthy();
    expect(live?.pages?.[0]?.commands.map((c) => c.kind)).toEqual(["changeGold"]);
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
  });

  it("Delete while focus is on the command list surface does not delete the event", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const page = eventPage([{ kind: "text", speaker: "", body: "x" }]);
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      selectedEventId: "event-1",
      selectedEventPageId: page.id,
    });
    const confirmDeletion = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmDeletion);

    openEventEditorModal(project.startMapId, "event-1");
    const cmdList = document.querySelector<HTMLElement>(".cmd-list");
    if (!cmdList) throw new Error("expected cmd-list");

    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    if (!modal) throw new Error("expected modal");
    // Simulate keydown that reaches the modal with command-list target.
    Object.defineProperty(keyEvent("Delete", cmdList), "target", { value: cmdList });
    modal.dispatchEvent(keyEvent("Delete", cmdList));

    expect(confirmDeletion).not.toHaveBeenCalled();
    expect(store.getCurrent().maps[project.startMapId]!.events.some((e) => e.id === "event-1")).toBe(true);
  });

  it("event deletion snapshots and restore undoes the delete", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      selectedEventId: "event-1",
      selectedEventPageId: page.id,
    });
    vi.stubGlobal("confirm", vi.fn(() => true));

    expect(deleteEditorEvent(project.startMapId, "event-1")).toBe(true);
    expect(store.getCurrent().maps[project.startMapId]!.events).toEqual([]);

    const toast = document.querySelector('[data-testid="toast"]');
    expect(toast?.textContent).toContain("삭제");
    const restore = document.querySelector<HTMLButtonElement>('[data-testid="toast-event-delete-restore"]');
    expect(restore).toBeTruthy();
    restore?.click();

    expect(store.getCurrent().maps[project.startMapId]!.events.some((e) => e.id === "event-1")).toBe(true);
  });

  it("requestEditorEventDeletion asks for confirmation before mutating", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [gameEvent(eventPage())];
    store.replace(project);
    const confirmDeletion = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmDeletion);

    expect(requestEditorEventDeletion(project.startMapId, "event-1")).toBe(false);
    expect(confirmDeletion).toHaveBeenCalledOnce();
    expect(store.getCurrent().maps[project.startMapId]!.events).toHaveLength(1);
  });

  it("Ctrl+Z restores after confirmed event delete", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [gameEvent(eventPage())];
    store.replace(project);
    vi.stubGlobal("confirm", vi.fn(() => true));

    expect(requestEditorEventDeletion(project.startMapId, "event-1")).toBe(true);
    expect(store.getCurrent().maps[project.startMapId]!.events).toEqual([]);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[project.startMapId]!.events.some((e) => e.id === "event-1")).toBe(true);
  });
});
