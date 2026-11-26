// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { beginExistingEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { undoFeedbackText } from "@/editor/eventDiffLabel";
import { requestEditorEventDeletion, deleteEditorEvent } from "@/editor/eventDeletion";
import { addEventPage, deleteEventPage, replaceEventPageCommands, updateEventPage } from "@/editor/eventPages";
import { editorState } from "@/editor/editorState";
import { runUndoWithFeedback, historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearCommandToolbarHistories, createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { undoActiveEventCommands } from "@/editor/panels/eventEditor/content";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { _resetEventPageDeletionHistoryForTest, canRedoEventPageDeletion, canUndoEventPageDeletion, undoEventPageDeletion } from "@/editor/panels/eventEditor/pageDeleteHistory";
import { resetModalStackForTest, modalStackDepthForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest, applyEventDraftVault, applySessionEvents, eventDraftVaultStorageKey, loadEventDraftVaultFromLocalStorage, persistEventDraftVaultNow, syncEventDraftVaultFromProject } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { Command, Condition, EventPage, GameEvent, Trigger } from "@/project/types";
import { toast } from "@/util/toast";
import type { EventDraftIssue, EventDraftValidation } from "@/editor/eventDraftValidator";
import { refreshEventValidationBell, renderEventValidationBell } from "@/editor/panels/eventEditor/validationBell";
import { selectEditorMap } from "@/editor/mapSelection";
import { showConfirm } from "@/editor/ui/modal";
import { attachColumnResize } from "@/editor/panels/eventEditor/layoutResize";
import { attachWindowFullscreen } from "@/editor/panels/eventEditor/modalFullscreen";
import { attachWindowResize } from "@/editor/panels/eventEditor/modalResize";
import { isolateTimers } from "./mergedTeardown";

describe("eventEditorQaFixes", () => {
  isolateTimers();
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
});

describe("eventEditorValidationBell", () => {
  isolateTimers();
  function validationOf(issues: readonly EventDraftIssue[]): EventDraftValidation {
    const errorCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const infoCount = issues.filter((issue) => issue.severity === "info").length;
    return { issues, errorCount, warningCount, infoCount, canCommit: errorCount === 0 };
  }
  function issue(overrides: Partial<EventDraftIssue> = {}): EventDraftIssue {
    return {
      severity: "warning",
      code: "shop.items.empty",
      message: "상점에 팔 물건이 없습니다.",
      pageId: "p1",
      ...overrides,
    };
  }
  describe("event editor validation bell", () => {
    let header: HTMLElement;

    beforeEach(() => {
      document.body.replaceChildren();
      header = document.createElement("header");
      header.className = "event-editor-modal-header";
      header.append(renderEventValidationBell());
      document.body.append(header);
    });

    function bell(): HTMLDetailsElement {
      const node = header.querySelector<HTMLDetailsElement>('[data-testid="event-draft-validation"]');
      if (!node) throw new Error("expected validation bell");
      return node;
    }

    it("stays hidden while the draft has no issues", () => {
      refreshEventValidationBell(header, validationOf([]));

      expect(bell().hidden).toBe(true);
      expect(bell().dataset.count).toBe("0");
      expect(bell().dataset.severity).toBe("none");
      expect(header.querySelector('[data-testid^="event-draft-validation-issue-"]')).toBeNull();
    });

    it("shows the issue count and takes the worst severity", () => {
      refreshEventValidationBell(header, validationOf([
        issue(),
        issue({ severity: "info", code: "page.empty" }),
      ]));

      expect(bell().hidden).toBe(false);
      expect(bell().dataset.severity).toBe("warning");
      expect(bell().dataset.count).toBe("2");
      expect(header.querySelector('[data-testid="event-draft-validation-count"]')?.textContent).toBe("2");
      expect(header.querySelectorAll('[data-testid^="event-draft-validation-issue-"]')).toHaveLength(2);

      refreshEventValidationBell(header, validationOf([
        issue({ severity: "error", code: "event.position.out-of-bounds" }),
        issue(),
      ]));

      expect(bell().dataset.severity).toBe("error");
      expect(header.querySelector('[data-testid="event-draft-validation-tally"]')?.textContent)
        .toBe("오류 1 · 경고 1");
    });

    it("caps the badge at 99+ while keeping the exact count machine-readable", () => {
      refreshEventValidationBell(header, validationOf(
        Array.from({ length: 120 }, (_, index) => issue({ code: `dup.${index}` })),
      ));

      expect(header.querySelector('[data-testid="event-draft-validation-count"]')?.textContent).toBe("99+");
      expect(bell().dataset.count).toBe("120");
    });

    it("navigates to the clicked issue page and closes the popover", () => {
      editorState.set({ selectedEventPageId: "p9" });
      refreshEventValidationBell(header, validationOf([issue({ pageId: "p3" })]));
      bell().open = true;

      header.querySelector<HTMLButtonElement>('[data-testid="event-draft-validation-issue-0"]')?.click();

      expect(editorState.get().selectedEventPageId).toBe("p3");
      expect(bell().open).toBe(false);
    });

    it("closes the popover when the next pointerdown lands outside it", () => {
      refreshEventValidationBell(header, validationOf([issue()]));
      bell().open = true;
      bell().dispatchEvent(new Event("toggle"));

      header.querySelector('[data-testid="event-draft-validation-issue-0"]')
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(bell().open).toBe(true);

      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(bell().open).toBe(false);
    });
  });
});

describe("eventEditorWindowControls", () => {
  isolateTimers();
  let mapId: string;
  const destinationMapId = "window-map-b";
  function node(id: string): HTMLElement {
    const result = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!result) throw new Error(`Missing ${id}`);
    return result;
  }
  beforeEach(() => {
    const project = createBlankProject();
    mapId = project.startMapId;
    project.maps[mapId].events = [{ id: "window-event", x: 1, y: 1,
      trigger: { kind: "action" }, commands: [], pages: [{
        id: "window-page", name: "Window event", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
      }] }];
    project.maps[mapId].events.push({ ...structuredClone(project.maps[mapId].events[0]), id: "other-event" });
    const secondMap = structuredClone(project.maps[mapId]);
    const pages = project.maps[mapId].events[0].pages;
    const destinationPage = secondMap.events[0].pages?.[0];
    if (!pages || !destinationPage) throw new Error("Expected two-map fixture pages");
    secondMap.id = destinationMapId;
    secondMap.events = [{ ...structuredClone(secondMap.events[0]), id: "destination-event",
      pages: [{ ...structuredClone(destinationPage), id: "destination-page" }] }];
    project.maps[destinationMapId] = secondMap;
    pages.push({ ...structuredClone(pages[0]), id: "window-page-2", name: "Second page" });
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page" });
    openEventEditorModal(mapId, "window-event");
  });
  afterEach(() => {
    document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
    document.body.replaceChildren();
    resetModalStackForTest();
    vi.restoreAllMocks();
  });
  function draft() { return store.getCurrent().maps[mapId].events.find(event => event.id === "window-event"); }
  function key(target: EventTarget, key: string, altKey = false): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, altKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }
  function changedUntil(check: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!check()) return;
        observer.disconnect();
        clearTimeout(deadline);
        resolve();
      });
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Expected DOM transition")); }, 5000);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }
  describe("event editor window controls", () => {
    for (const target of ["existing", "new"] as const) {
      for (const dirty of [false, true]) {
        it(`keeps the destination map when opening a ${target} event after ${dirty ? "approved dirty" : "unchanged"} cross-map switching`, async () => {
          if (dirty) updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
          const previous = node("event-editor-modal");
          node("event-editor-window-minimize").click();
          expect(selectEditorMap(destinationMapId)).toBe(true);
          expect(editorState.get().currentMapId).toBe(destinationMapId);
          if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
          else openNewEventEditorModal(destinationMapId, 3, 4);
          if (dirty) {
            const switched = changedUntil(() => node("event-editor-modal") !== previous);
            node("app-modal-confirm").click();
            await switched;
          }
          const modal = node("event-editor-modal");
          expect(modal).not.toBe(previous);
          expect(modal.dataset.mapId).toBe(destinationMapId);
          expect(editorState.get().currentMapId).toBe(destinationMapId);
          const opened = store.getCurrent().maps[destinationMapId].events.find(event => event.id === modal.dataset.eventId);
          expect(opened?.draft?.kind).toBe(target === "existing" ? "edit" : "new");
          expect(editorState.get().selectedEventId).toBe(opened?.id);
          expect(editorState.get().selectedEventPageId).toBe(opened?.pages?.[0].id);
          if (target === "existing") expect(opened?.id).toBe("destination-event");
          else expect(opened).toMatchObject({ x: 3, y: 4 });
          expect(draft()?.draft).toBeUndefined();
          expect(draft()?.pages?.[0].name).toBe("Window event");
          expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
          expect(modalStackDepthForTest()).toBe(1);
        });
      }

      it(`retains the original map and page when cancelling a dirty cross-map switch to a ${target} event`, async () => {
        editorState.set({ selectedEventPageId: "window-page-2" });
        updateEventPage(mapId, "window-event", "window-page-2", { name: "Dirty second page" });
        const original = structuredClone(draft());
        const destination = structuredClone(store.getCurrent().maps[destinationMapId]);
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        selectEditorMap(destinationMapId);
        if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
        else expect(openNewEventEditorModal(destinationMapId, 3, 4)).toBe("");
        expect(modal.hidden).toBe(false);
        expect(modalStackDepthForTest()).toBe(2);
        const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
        node("app-modal-cancel").click();
        await cancelled;
        expect(node("event-editor-modal")).toBe(modal);
        expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
        expect(draft()).toEqual(original);
        expect(store.getCurrent().maps[destinationMapId]).toEqual(destination);
        expect(modalStackDepthForTest()).toBe(1);
      });
    }

    for (const restore of ["chip", "same-event"] as const) {
      it(`restores the original map and nondefault page via ${restore} after selecting another map`, () => {
        editorState.set({ selectedEventPageId: "window-page-2" });
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        selectEditorMap(destinationMapId);
        if (restore === "chip") node("event-editor-window-restore").click();
        else openEventEditorModal(mapId, "window-event");
        expect(node("event-editor-modal")).toBe(modal);
        expect(modal.hidden).toBe(false);
        expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
      });
    }

    it("minimizes without discarding pending input and restores the same editor", () => {
      const modal = node("event-editor-modal");
      const input = node("event-editor-name");
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected input");
      input.focus();
      input.value = "Pending draft";
      input.setSelectionRange(3, 7);
      node("event-editor-window-minimize").click();
      expect(modal.hidden).toBe(true);
      expect(modalStackDepthForTest()).toBe(0);
      expect(document.body.classList.contains("event-editor-modal-open")).toBe(false);
      const restore = node("event-editor-window-restore");
      expect(document.activeElement).toBe(restore);
      expect(historyHotkeyOwnedByPanel()).toBe(false);
      expect(shouldIgnoreEditorShortcut(key(restore, "ArrowRight"))).toBe(false);
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      restore.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(false);
      restore.click();
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(node("event-editor-name")).toBe(input);
      expect(input.value).toBe("Pending draft");
      expect(input.selectionStart).toBe(3);
      expect(input.selectionEnd).toBe(7);
      expect(document.activeElement).toBe(input);
      expect(modalStackDepthForTest()).toBe(1);
    });
    it("keeps full-view state and saved normal geometry across minimize and map reopen", () => {
      const modal = node("event-editor-modal");
      const windowEl = modal.querySelector<HTMLElement>(".event-editor-modal-window");
      if (!windowEl) throw new Error("Expected window");
      Object.assign(windowEl.style, { width: "900px", height: "650px", transform: "translate(12px, 8px)" });
      node("event-editor-window-fullscreen").click();
      expect(node("event-editor-window-fullscreen").style.display).not.toBe("none");
      node("event-editor-window-minimize").click();
      editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
      openEventEditorModal(mapId, "window-event");
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(modal.classList.contains("is-fullscreen")).toBe(true);
      expect(editorState.get().selectedEventPageId).toBe("window-page");
      key(document, "Escape");
      expect(windowEl.style.width).toBe("900px");
      expect(windowEl.style.height).toBe("650px");
      expect(windowEl.style.transform).toBe("translate(12px, 8px)");
      expect(modalStackDepthForTest()).toBe(1);
      key(document, "Escape");
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    });

    it("does not rebuild pending dynamic fields on background map and selection changes", () => {
      const field = node("event-command-search");
      if (!(field instanceof HTMLInputElement)) throw new Error("Expected search input");
      field.focus();
      field.value = "pending search";
      node("event-editor-window-minimize").click();
      store.updateMap(mapId, map => { map.name = "Background edit"; });
      editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
      node("event-editor-window-restore").click();
      expect(node("event-command-search")).toBe(field);
      expect(field.value).toBe("pending search");
      expect(document.activeElement).toBe(field);
    });

    it("restores a minimized new draft without resetting or discarding it", () => {
      node("event-editor-cancel").click();
      const eventId = openNewEventEditorModal(mapId, 2, 2);
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      openEventEditorModal(mapId, eventId);
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
    });

    it("guards switching dirty minimized drafts, then discards only on approval", async () => {
      updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      openEventEditorModal(mapId, "other-event");
      expect(modal.hidden).toBe(false);
      expect(modalStackDepthForTest()).toBe(2);
      const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
      node("app-modal-cancel").click();
      await cancelled;
      expect(draft()?.pages?.[0].name).toBe("Dirty");
      expect(modalStackDepthForTest()).toBe(1);
      openEventEditorModal(mapId, "other-event");
      const switched = changedUntil(() => document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.dataset.eventId === "other-event");
      node("app-modal-confirm").click();
      await switched;
      expect(draft()?.draft).toBeUndefined();
      expect(draft()?.pages?.[0].name).toBe("Window event");
      expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("keeps Apply and save semantics after restore", () => {
      updateEventPage(mapId, "window-event", "window-page", { name: "Applied" });
      node("event-editor-window-minimize").click();
      node("event-editor-window-restore").click();
      node("event-editor-apply").click();
      expect(draft()?.pages?.[0].name).toBe("Applied");
      expect(draft()?.draft?.kind).toBe("edit");
      updateEventPage(mapId, "window-event", "window-page", { name: "Saved" });
      node("event-editor-save").click();
      expect(draft()?.pages?.[0].name).toBe("Saved");
      expect(draft()?.draft).toBeUndefined();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("closes a dormant draft on deletion rather than resurrecting it from the vault", () => {
      node("event-editor-window-minimize").click();
      expect(deleteEditorEvent(mapId, "window-event", { silent: true })).toBe(true);
      expect(draft()).toBeUndefined();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("ends ownership on same-ID project replacement without touching the incoming draft", () => {
      node("event-editor-window-minimize").click();
      const replacement = structuredClone(store.getCurrent());
      const incoming = replacement.maps[mapId].events[0];
      if (!incoming.pages?.[0]) throw new Error("Expected page");
      incoming.pages[0].name = "Incoming";
      store.replaceProject(replacement);
      expect(draft()?.pages?.[0].name).toBe("Incoming");
      expect(draft()?.draft).toBeDefined();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("tears down its pending close guard on project replacement", async () => {
      updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
      node("event-editor-modal-close").click();
      const replacement = structuredClone(store.getCurrent());
      store.replaceProject(replacement);
      expect(document.querySelector('[data-testid="app-confirm-modal"]')).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
      await Promise.resolve();
      expect(draft()?.pages?.[0].name).toBe("Dirty");
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("does not steal focus or Escape from another modal while minimized", async () => {
      node("event-editor-window-minimize").click();
      const result = showConfirm({ message: "Other operation" });
      openEventEditorModal(mapId, "window-event");
      expect(node("event-editor-modal").hidden).toBe(true);
      expect(document.activeElement).toBe(node("app-modal-cancel"));
      key(document, "Escape");
      expect(await result).toBe(false);
      expect(node("event-editor-modal").hidden).toBe(true);
      node("event-editor-window-restore").click();
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("disposes draft subscriptions and restore UI on external DOM teardown", async () => {
      node("event-editor-cancel").click();
      const subscribe = store.subscribe.bind(store);
      const disposers: Array<() => void> = [];
      vi.spyOn(store, "subscribe").mockImplementation(listener => {
        const dispose = vi.fn(subscribe(listener));
        disposers.push(dispose);
        return dispose;
      });
      openEventEditorModal(mapId, "window-event");
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      const disposed = changedUntil(() => !document.querySelector('[data-testid="event-editor-window-restore"]'));
      modal.remove();
      await disposed;
      expect(draft()?.draft).toBeUndefined();
      expect(modalStackDepthForTest()).toBe(0);
      store.updateMap(mapId, map => { map.name = "After teardown"; });
      expect(disposers.length).toBeGreaterThan(0);
      for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    });

    it("maximizes on immediate titlebar double-click but not on nested button SVGs", () => {
      const modal = node("event-editor-modal");
      node("event-editor-titlebar").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(modal.classList.contains("is-fullscreen")).toBe(true);
      const path = node("event-editor-window-fullscreen").querySelector("path");
      if (!path) throw new Error("Expected SVG path");
      path.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(modal.classList.contains("is-fullscreen")).toBe(true);
      key(modal, "Enter", true);
      expect(modal.classList.contains("is-fullscreen")).toBe(false);
    });

  });
});

describe("eventEditorWindowing", () => {
  isolateTimers();
  describe("event editor windowing", () => {
    afterEach(() => {
      document.body.classList.remove("event-editor-column-resizing");
      document.body.replaceChildren();
    });

    it("toggles full view and restores the previous window geometry", () => {
      const backdrop = document.createElement("div");
      const windowEl = document.createElement("section");
      const header = document.createElement("header");
      const button = document.createElement("button");
      header.append(button);
      windowEl.append(header);
      backdrop.append(windowEl);
      document.body.append(backdrop);
      windowEl.style.width = "960px";
      windowEl.style.height = "700px";
      windowEl.style.transform = "translate(24px, 12px)";

      const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
      expect(button.getAttribute("aria-label")).toBe("전체 보기");
      expect(button.getAttribute("aria-pressed")).toBe("false");

      button.click();
      expect(controller.isFullscreen()).toBe(true);
      expect(backdrop.classList.contains("is-fullscreen")).toBe(true);
      expect(windowEl.classList.contains("is-fullscreen")).toBe(true);
      expect(windowEl.style.transform).toBe("");
      expect(button.getAttribute("aria-label")).toBe("창 보기로 복원");

      backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(controller.isFullscreen()).toBe(false);
      expect(windowEl.style.width).toBe("960px");
      expect(windowEl.style.height).toBe("700px");
      expect(windowEl.style.transform).toBe("translate(24px, 12px)");
      controller.dispose();
    });

    it("supports title-bar double click and Alt+Enter", () => {
      const backdrop = document.createElement("div");
      const windowEl = document.createElement("section");
      const header = document.createElement("header");
      const button = document.createElement("button");
      const title = document.createElement("span");
      header.append(title, button);
      windowEl.append(header);
      backdrop.append(windowEl);
      document.body.append(backdrop);

      const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
      title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(controller.isFullscreen()).toBe(true);

      backdrop.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }));
      expect(controller.isFullscreen()).toBe(false);
      controller.dispose();
    });

    it("resizes the settings rail by keyboard and resets it on double click", () => {
      const workbench = document.createElement("div");
      const settings = document.createElement("div");
      const handle = document.createElement("div");
      settings.className = "event-editor-settings-column";
      workbench.append(settings, handle);
      document.body.append(workbench);

      Object.defineProperty(workbench, "getBoundingClientRect", {
        value: () => ({ left: 100, width: 1200, right: 1300, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
      });
      Object.defineProperty(settings, "getBoundingClientRect", {
        value: () => ({ left: 100, width: 312, right: 412, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
      });

      attachColumnResize(handle, workbench);
      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("336px");
      expect(handle.getAttribute("aria-valuenow")).toBe("336");
      expect(handle.getAttribute("aria-valuetext")).toBe("설정 패널 336픽셀");

      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
      expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("288px");

      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("");
      expect(handle.getAttribute("aria-valuenow")).toBe("312");
    });


    it("lets a viewport-fitted modal become smaller instead of growing to the desktop minimum", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
      const windowEl = document.createElement("section");
      const handle = document.createElement("div");
      document.body.append(windowEl, handle);
      Object.defineProperty(windowEl, "getBoundingClientRect", {
        value: () => ({ left: 40, width: 720, right: 760, top: 32, bottom: 832, height: 800, x: 40, y: 32, toJSON: () => ({}) }),
      });

      attachWindowResize(handle, windowEl);
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));

      expect(windowEl.style.width).toBe("704px");
    });
  });
});
