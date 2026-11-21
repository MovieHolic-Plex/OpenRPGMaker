/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { beginExistingEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { undoFeedbackText } from "@/editor/eventDiffLabel";
import { requestEditorEventDeletion } from "@/editor/eventDeletion";
import { addEventPage, deleteEventPage, replaceEventPageCommands, updateEventPage } from "@/editor/eventPages";
import { editorState } from "@/editor/editorState";
import { runUndoWithFeedback } from "@/editor/hotkeys";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearCommandToolbarHistories, createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { undoActiveEventCommands } from "@/editor/panels/eventEditor/content";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import {
  _resetEventPageDeletionHistoryForTest,
  canRedoEventPageDeletion,
  canUndoEventPageDeletion,
  undoEventPageDeletion,
} from "@/editor/panels/eventEditor/pageDeleteHistory";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import {
  _resetEventDraftVaultForTest,
  applyEventDraftVault,
  applySessionEvents,
  eventDraftVaultStorageKey,
  loadEventDraftVaultFromLocalStorage,
  persistEventDraftVaultNow,
  syncEventDraftVaultFromProject,
} from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { Command, Condition, EventPage, GameEvent, Trigger } from "@/project/types";
import { toast } from "@/util/toast";

function page(id: string, name: string, trigger: Trigger, commands: Command[], conditions: Condition[] = []): EventPage {
  return {
    id,
    name,
    conditions,
    graphic: {},
    trigger,
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function seedEvent(pages: EventPage[], name = "사건"): { mapId: string; eventId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const event = createDefaultGameEvent(1, 1);
  event.name = name;
  event.trigger = { kind: "auto" };
  event.commands = [];
  event.pages = pages;
  project.maps[mapId]!.events = [event];
  store.replace(project);
  return { mapId, eventId: event.id };
}

describe("event editor QA fixes", () => {
  beforeEach(() => {
    _resetEventDraftVaultForTest();
    _resetEventPageDeletionHistoryForTest();
    clearCommandToolbarHistories("");
    resetMapEditHistory();
    document.querySelector("[data-testid='toast-stack']")?.remove();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    document.querySelector("[data-testid='event-editor-modal']")?.remove();
    document.querySelector("[data-testid='toast-stack']")?.remove();
    resetModalStackForTest();
    window.history.replaceState(null, "", "/");
    _resetEventDraftVaultForTest();
    _resetEventPageDeletionHistoryForTest();
    clearCommandToolbarHistories("");
    resetMapEditHistory();
    document.querySelector("[data-testid='app-confirm-modal']")?.remove();
  });

  it("undoes a page delete with its trigger, conditions, and commands", () => {
    const gone = page(
      "gone",
      "지울 페이지",
      { kind: "action" },
      [{ kind: "text", body: "keep me" }],
      [{ kind: "switch", switchId: "sw_0001", value: true }],
    );
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, []),
      gone,
    ]);
    beginExistingEventDraft(mapId, eventId);
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    expect(canUndoEventPageDeletion(mapId, eventId)).toBe(true);
    expect(store.getCurrent().maps[mapId]!.events[0]!.pages?.some((entry) => entry.id === "gone")).toBe(false);

    expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
    const restored = store.getCurrent().maps[mapId]!.events[0]!.pages?.find((entry) => entry.id === "gone");
    expect(restored?.trigger).toEqual({ kind: "action" });
    expect(restored?.conditions).toEqual([{ kind: "switch", switchId: "sw_0001", value: true }]);
    expect(restored?.commands).toEqual([{ kind: "text", body: "keep me" }]);
  });

  it("map undo after apply restores a deleted pre-existing page", () => {
    const before = page(
      "gone",
      "지울 페이지",
      { kind: "touch" },
      [{ kind: "text", body: "before the session" }],
      [{ kind: "switch", switchId: "sw_0001", value: true }],
    );
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, []),
      before,
    ]);
    beginExistingEventDraft(mapId, eventId);
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    saveEventDraft(mapId, eventId);

    expect(undoMapEdit()).toBe(true);
    const gone = findPage(mapId, eventId, "gone");
    expect(gone?.trigger).toEqual(before.trigger);
    expect(gone?.conditions).toEqual(before.conditions);
    expect(gone?.commands).toEqual(before.commands);
  });

  it("map undo after apply restores the pre-session page, not the in-session edit", () => {
    // 자동 실행·명령 0개는 캡처가 틀린 게 아니다. 이벤트 뿌리의 trigger/commands 를
    // createDefaultEventPage 가 첫 페이지로 복사하고, 세션에서 고친 명령은 작업 본문에만 있다.
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, []),
      page("gone", "지울 페이지", { kind: "auto" }, []),
    ]);
    beginExistingEventDraft(mapId, eventId);
    updateEventPage(mapId, eventId, "gone", {
      trigger: { kind: "action" },
      conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
      commands: [{ kind: "text", body: "written in this session" }],
    });
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
    const inSession = findPage(mapId, eventId, "gone");
    expect(inSession?.trigger).toEqual({ kind: "action" });
    expect(inSession?.commands).toEqual([{ kind: "text", body: "written in this session" }]);
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    saveEventDraft(mapId, eventId);

    expect(undoMapEdit()).toBe(true);
    const gone = findPage(mapId, eventId, "gone");
    expect(gone?.trigger).toEqual({ kind: "auto" });
    expect(gone?.conditions).toEqual([]);
    expect(gone?.commands).toEqual([]);
  });

  it("map undo after apply does not restore a page created in this session", () => {
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
    ]);
    beginExistingEventDraft(mapId, eventId);
    const created = addEventPage(mapId, eventId);
    updateEventPage(mapId, eventId, created, {
      trigger: { kind: "touch" },
      conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
      commands: [{ kind: "text", body: "created in this session" }],
    });
    expect(deleteEventPage(mapId, eventId, created)).toBe(true);
    expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
    const inSession = findPage(mapId, eventId, created);
    expect(inSession?.trigger).toEqual({ kind: "touch" });
    expect(inSession?.commands).toEqual([{ kind: "text", body: "created in this session" }]);
    expect(deleteEventPage(mapId, eventId, created)).toBe(true);
    saveEventDraft(mapId, eventId);

    expect(undoMapEdit()).toBe(true);
    const event = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === eventId);
    expect(event?.pages?.map((entry) => entry.id)).toEqual(["keep"]);
    expect(event?.pages?.[0]?.commands).toEqual([{ kind: "text", body: "stay" }]);
  });

  it("enables the editor undo button after a page delete and restores the page", async () => {
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
      page("gone", "지울 페이지", { kind: "touch" }, [{ kind: "text", body: "keep me" }]),
    ]);
    openEventEditorModal(mapId, eventId);
    const button = () => document.querySelector<HTMLButtonElement>("[data-testid='event-command-toolbar-undo']");
    await viWaitForButton(button);
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    await viWaitForButton(() => {
      const undo = button();
      return undo && !undo.disabled ? undo : null;
    });
    button()?.click();
    const restored = store.getCurrent().maps[mapId]!.events[0]!.pages?.find((entry) => entry.id === "gone");
    expect(restored?.trigger).toEqual({ kind: "touch" });
    expect(restored?.commands).toEqual([{ kind: "text", body: "keep me" }]);
  });

  it("scopes a blank session away from the shared local vault and keeps a pasted event", () => {
    window.history.replaceState(null, "", "/?blankProject=1");
    sessionStorage.setItem("oprn:event-draft-session", "tab-a");
    const stale: GameEvent = {
      id: "stale-draft",
      x: 4,
      y: 4,
      name: "옛 초안",
      trigger: { kind: "auto" },
      commands: [],
      pages: [],
      draft: { kind: "new" },
    };
    localStorage.setItem("oprn:event-draft-vault:local", JSON.stringify({
      version: 1,
      entries: [{ mapId: "map_blank_start", event: stale, updatedAt: 1 }],
    }));
    const project = createBlankProject();
    const pasted = createDefaultGameEvent(2, 2);
    pasted.id = "pasted";
    pasted.name = "붙여넣은 이벤트";
    delete pasted.draft;
    project.maps[project.startMapId]!.events = [pasted];
    syncEventDraftVaultFromProject(project);
    persistEventDraftVaultNow();

    expect(eventDraftVaultStorageKey()).toBe("oprn:event-draft-vault:session:tab-a");
    expect(localStorage.getItem("oprn:event-draft-vault:local")).toContain("stale-draft");
    const saved = JSON.parse(localStorage.getItem("oprn:event-draft-vault:session:tab-a") ?? "{}") as {
      sessionEvents?: Array<{ events?: Array<{ id?: string }> }>;
    };
    expect(saved.sessionEvents?.[0]?.events?.map((event) => event.id)).toEqual(["pasted"]);

    _resetEventDraftVaultForTest();
    expect(loadEventDraftVaultFromLocalStorage()).toBe(0);
    const restored = applySessionEvents(applyEventDraftVault(createBlankProject()));
    expect(restored.maps[restored.startMapId]!.events.map((event) => event.id)).toEqual(["pasted"]);
    expect(restored.maps[restored.startMapId]!.events.some((event) => event.id === "stale-draft")).toBe(false);

    sessionStorage.setItem("oprn:event-draft-session", "tab-b");
    _resetEventDraftVaultForTest();
    expect(loadEventDraftVaultFromLocalStorage()).toBe(0);
    const other = applySessionEvents(applyEventDraftVault(createBlankProject()));
    expect(other.maps[other.startMapId]!.events).toEqual([]);
  });

  it("dedupes the same visible toast", () => {
    const message = "조건 없는 새 페이지를 기존 승자보다 낮은 우선순위로 추가했어요.";
    toast(message, { kind: "info", dedupe: true });
    toast(message, { kind: "info", dedupe: true });
    expect(document.querySelectorAll(".toast.show")).toHaveLength(1);
    toast("다른 알림", { kind: "info", dedupe: true });
    expect(document.querySelectorAll(".toast.show")).toHaveLength(2);
  });

  it("does not say 변경 없음 when undo changes the event name and page count", () => {
    const { mapId, eventId } = seedEvent([
      page("a", "하나", { kind: "action" }, []),
      page("b", "둘", { kind: "action" }, []),
    ], "옛 이름");
    recordProjectSnapshot("이벤트 편집 — 변경 없음");
    store.updateEvent(mapId, eventId, (event) => {
      event.name = "새 이름";
      event.pages = event.pages?.slice(0, 1);
    }, { scope: "map", mapId, eventId, label: "이름과 페이지" });

    expect(runUndoWithFeedback()).toBe(true);
    const message = document.querySelector(".toast-message")?.textContent ?? "";
    expect(message).not.toContain("변경 없음");
    expect(message).toContain("이벤트 이름, 페이지 수");
    const event = store.getCurrent().maps[mapId]!.events[0]!;
    expect(event.name).toBe("옛 이름");
    expect(event.pages).toHaveLength(2);
  });

  it("builds undo feedback from the restored name and page count", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const event = createDefaultGameEvent(0, 0);
    event.name = "옛";
    event.pages = [page("a", "하나", { kind: "action" }, []), page("b", "둘", { kind: "action" }, [])];
    before.maps[before.startMapId]!.events = [event];
    const renamed = structuredClone(event);
    renamed.name = "새";
    renamed.pages = renamed.pages?.slice(0, 1);
    after.maps[after.startMapId]!.events = [renamed];
    expect(undoFeedbackText("이벤트 편집 — 변경 없음", before, after)).toBe("되돌렸습니다 — 이벤트 이름, 페이지 수");
    expect(undoFeedbackText("타일 칠하기", before, after)).toBe("되돌렸습니다 — 타일 칠하기");
  });

  it("undoes a page deletion that sits between two command edits, then redoes in that order", () => {
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
      page("gone", "지울 페이지", { kind: "touch" }, [{ kind: "text", body: "old" }]),
    ]);
    beginExistingEventDraft(mapId, eventId);
    editorState.set({ selectedEventPageId: "keep" });
    const history = createCommandToolbarHistory({
      key: `${mapId}:${eventId}:keep`,
      editScope: { mapId, eventId },
      immutableSnapshots: true,
      readCommands: () => findPage(mapId, eventId, "keep")?.commands ?? [],
      replaceCommands: (commands) => replaceEventPageCommands(mapId, eventId, "keep", commands),
    });
    history.replaceAll([{ kind: "text", body: "first" }]);
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    history.replaceAll([{ kind: "text", body: "second" }]);

    undoActiveEventCommands(mapId, eventId);
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "first" }]);
    expect(findPage(mapId, eventId, "gone")).toBeUndefined();

    undoActiveEventCommands(mapId, eventId);
    expect(findPage(mapId, eventId, "gone")?.commands).toEqual([{ kind: "text", body: "old" }]);
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "first" }]);

    undoActiveEventCommands(mapId, eventId, true);
    expect(findPage(mapId, eventId, "gone")).toBeUndefined();
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "first" }]);
    undoActiveEventCommands(mapId, eventId, true);
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "second" }]);
  });

  it("drops page-deletion redo after a command edit and command redo after a page deletion", () => {
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
      page("gone", "지울 페이지", { kind: "touch" }, [{ kind: "text", body: "old" }]),
    ]);
    beginExistingEventDraft(mapId, eventId);
    editorState.set({ selectedEventPageId: "keep" });
    const history = createCommandToolbarHistory({
      key: `${mapId}:${eventId}:keep`,
      editScope: { mapId, eventId },
      immutableSnapshots: true,
      readCommands: () => findPage(mapId, eventId, "keep")?.commands ?? [],
      replaceCommands: (commands) => replaceEventPageCommands(mapId, eventId, "keep", commands),
    });
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
    history.replaceAll([{ kind: "text", body: "new" }]);
    expect(canRedoEventPageDeletion(mapId, eventId)).toBe(false);
    undoActiveEventCommands(mapId, eventId, true);
    expect(findPage(mapId, eventId, "gone")?.commands).toEqual([{ kind: "text", body: "old" }]);
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "new" }]);

    history.undo();
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "stay" }]);
    expect(history.canRedo()).toBe(true);
    expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
    expect(history.canRedo()).toBe(false);
    undoActiveEventCommands(mapId, eventId, true);
    expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "stay" }]);
    expect(findPage(mapId, eventId, "gone")).toBeUndefined();
  });

  it("does not delete the replacement project's event when confirmation outlives the switch", async () => {
    const { mapId, eventId } = seedEvent([
      page("keep", "남는 페이지", { kind: "action" }, []),
      page("gone", "지울 페이지", { kind: "action" }, []),
    ]);
    const pending = requestEditorEventDeletion(mapId, eventId);
    const replacement = createBlankProject();
    const survivor = createDefaultGameEvent(3, 3);
    survivor.id = eventId;
    survivor.name = "다른 문서";
    replacement.maps[replacement.startMapId]!.events = [survivor];
    store.replaceProject(replacement);

    document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")?.click();
    await expect(pending).resolves.toBe(false);
    const events = store.getCurrent().maps[replacement.startMapId]!.events;
    expect(events.map((event) => event.id)).toEqual([eventId]);
    expect(events[0]?.name).toBe("다른 문서");
  });

  it("leaves a map's events in place when the recovered session snapshot is not a list of events", () => {
    window.history.replaceState(null, "", "/?blankProject=1");
    sessionStorage.setItem("oprn:event-draft-session", "tab-a");
    const project = createBlankProject();
    const keep = createDefaultGameEvent(1, 1);
    keep.id = "keep";
    keep.name = "살아 있는 이벤트";
    project.maps[project.startMapId]!.events = [keep];
    localStorage.setItem(eventDraftVaultStorageKey(), JSON.stringify({
      version: 1,
      entries: [],
      sessionEvents: [{ mapId: project.startMapId, events: [null] }],
    }));
    expect(loadEventDraftVaultFromLocalStorage()).toBe(0);
    const restored = applySessionEvents(project);
    expect(restored.maps[project.startMapId]!.events.map((event) => event.id)).toEqual(["keep"]);
  });

  it("keeps the previous session snapshot while event arrays are unchanged", () => {
    window.history.replaceState(null, "", "/?blankProject=1");
    sessionStorage.setItem("oprn:event-draft-session", "tab-a");
    const project = createBlankProject();
    const event = createDefaultGameEvent(1, 1);
    event.id = "pasted";
    event.commands = [{ kind: "text", body: "old" }];
    project.maps[project.startMapId]!.events = [event];
    syncEventDraftVaultFromProject(project);
    persistEventDraftVaultNow();

    event.commands = [{ kind: "text", body: "mutated in place" }];
    syncEventDraftVaultFromProject(project);
    persistEventDraftVaultNow();
    const stale = JSON.parse(localStorage.getItem(eventDraftVaultStorageKey()) ?? "{}") as {
      sessionEvents?: Array<{ events?: Array<{ commands?: Array<{ body?: string }> }> }>;
    };
    expect(stale.sessionEvents?.[0]?.events?.[0]?.commands?.[0]?.body).toBe("old");

    project.maps[project.startMapId]!.events = [structuredClone(event)];
    project.maps[project.startMapId]!.events[0]!.commands = [{ kind: "text", body: "replaced" }];
    syncEventDraftVaultFromProject(project);
    persistEventDraftVaultNow();
    const next = JSON.parse(localStorage.getItem(eventDraftVaultStorageKey()) ?? "{}") as {
      sessionEvents?: Array<{ events?: Array<{ commands?: Array<{ body?: string }> }> }>;
    };
    expect(next.sessionEvents?.[0]?.events?.[0]?.commands?.[0]?.body).toBe("replaced");
  });
});

function findPage(mapId: string, eventId: string, pageId: string): EventPage | undefined {
  return store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.pages?.find((entry) => entry.id === pageId);
}

function viWaitForButton<T>(read: () => T | null | undefined): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = (): void => {
      const value = read();
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - started > 4000) {
        const crash = document.querySelector("[data-testid='event-editor-render-error']")?.textContent?.trim();
        reject(new Error(crash ? `timed out waiting for the undo button: ${crash}` : "timed out waiting for the undo button"));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}
