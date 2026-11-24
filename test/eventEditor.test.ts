// @vitest-environment happy-dom

import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command, Condition, EventPage, GameEvent, Trigger } from "@/project/types";
import { captureFormSurface } from "./eventEditorFormSurface";
import { captureInteractionSurface } from "./eventEditorInteractionSurface";
import { probeCommandControls } from "./eventEditorCommitProbe";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { inspectorTitle } from "@/editor/panels/eventEditor/inspectorChoicesTitle";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { attachWindowDrag } from "@/editor/panels/eventEditor/modalDrag";
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
import { _resetEventPageDeletionHistoryForTest, canRedoEventPageDeletion, canUndoEventPageDeletion, undoEventPageDeletion } from "@/editor/panels/eventEditor/pageDeleteHistory";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest, applyEventDraftVault, applySessionEvents, eventDraftVaultStorageKey, loadEventDraftVaultFromLocalStorage, persistEventDraftVaultNow, syncEventDraftVaultFromProject } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { EventDraftIssue, EventDraftValidation } from "@/editor/eventDraftValidator";
import { refreshEventValidationBell, renderEventValidationBell } from "@/editor/panels/eventEditor/validationBell";
import { isolateTimers } from "./mergedTeardown";

// 명령 하나가 렌더를 터뜨려도 이벤트 전체가 흰 화면이 되면 안 된다.
// 깨진 카드만 자리 표시자로 그리고 형제는 정상 표시한다.
describe("eventEditorBrokenCommandIsolation", () => {
  isolateTimers();
  const noop = (): void => {};
  const actions: CommandListActions = {
    addCommand: noop,
    insertCommand: noop,
    replaceCommand: noop,
    deleteCommand: noop,
    moveCommand: noop,
    moveCommandTo: noop,
  };
  const GOOD: Command = { kind: "text", speaker: "장로", body: "허허, 잘 왔네." };
  // 요약기가 options.length 에서 터지는 깨진 선택지 — 가드로 못 막는未知 모양의 대리인.
  const BROKEN = { kind: "choices", prompt: "???" } as unknown as Command;
  describe("깨진 명령 격리", () => {
    it("스토리보드: 깨진 카드 옆에 정상 카드가 그려진다", () => {
      const host = renderStoryboard([GOOD, BROKEN, GOOD]);
      document.body.append(host);
      try {
        expect(host.querySelectorAll(".event-storyboard-card").length).toBe(3);
        const broken = host.querySelector('[data-testid="event-storyboard-broken-1"]');
        expect(broken).not.toBeNull();
        expect(broken?.textContent ?? "").toContain("표시할 수 없는 명령");
        const cards = Array.from(host.querySelectorAll(".event-storyboard-card"));
        expect(cards[0]?.textContent ?? "").toContain("허허");
        expect(cards[2]?.textContent ?? "").toContain("허허");
      } finally {
        host.remove();
      }
    });

    it("목록: 깨진 행 옆에 정상 행이 그려진다", () => {
      const host = document.createElement("div");
      document.body.append(host);
      try {
        renderCommandList(host, [GOOD, BROKEN, GOOD], [], actions);
        expect(host.querySelectorAll(".cmd-item").length).toBe(3);
        const broken = host.querySelector('[data-testid="event-command-broken-1"]');
        expect(broken).not.toBeNull();
        expect(broken?.textContent ?? "").toContain("표시할 수 없는 명령");
        expect(host.querySelectorAll('[data-testid="event-command-text"]').length).toBe(2);
      } finally {
        host.remove();
      }
    });

    it("분기 안 깨진 명령도 형제를 가리지 않는다", () => {
      const fork: Command = {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_1", value: true },
        then: [GOOD, BROKEN],
        else: [],
      };
      const host = renderStoryboard([fork]);
      document.body.append(host);
      try {
        const cards = host.querySelectorAll(".event-storyboard-card, .event-storyboard-branch-command");
        expect(cards.length).toBeGreaterThanOrEqual(3);
        expect(host.querySelector('[data-testid^="event-storyboard-broken-"]')).not.toBeNull();
      } finally {
        host.remove();
      }
    });
  });
});

describe("eventEditorFormSurfaceLifecycle", () => {
  isolateTimers();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.stubGlobal("Image", class {
      addEventListener(): void {}
      set src(_value: string) {}
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("stops the animation interval after harvesting a detached command form", () => {
    const scheduled = vi.spyOn(window, "setInterval");
    const cleared = vi.spyOn(window, "clearInterval");
    const before = vi.getTimerCount();

    const surface = captureFormSurface("showAnimation");

    expect(surface.error).toBeUndefined();
    expect(surface.controls["show-animation-play"]).toBe("button{}");
    expect(scheduled).toHaveBeenCalledTimes(1);
    const timer = scheduled.mock.results[0];
    if (timer?.type !== "return") throw new Error("Animation timer was not scheduled");
    expect(cleared).toHaveBeenCalledWith(timer.value);
    expect(vi.getTimerCount()).toBe(before);
  });
  it("releases intervals started by interaction-driven preview changes", () => {
    const before = vi.getTimerCount();
    const surface = captureInteractionSurface(MINIMAL_COMMANDS.showAnimation, "showAnimation");
    expect(surface.error).toBeUndefined();
    expect(surface.reactions).toHaveProperty("show-animation-animationId-select");
    expect(vi.getTimerCount()).toBe(before);
  });
  it("keeps commit probes static even when a browser window already exists", () => {
    const before = vi.getTimerCount();
    const schedule = window.setInterval;
    const run = probeCommandControls(MINIMAL_COMMANDS.showAnimation);
    expect(run.error).toBeUndefined();
    expect(run.results.some(result => result.key === "show-animation-animationId-select")).toBe(true);
    expect(window.setInterval).toBe(schedule);
    expect(vi.getTimerCount()).toBe(before);
  });
});

describe("eventEditorInspectorTitle", () => {
  isolateTimers();
  const choicesCmd: Command = {
    kind: "choices",
    prompt: "두 길목을 정리해 줄래?",
    options: [
      { text: "맡는다", branch: [] },
      { text: "나중에", branch: [] },
    ],
    cancelBehavior: "choice2",
  };
  describe("inspectorTitle", () => {
    it("uses the trimmed prompt as the compact choices title (no options, no cancel)", () => {
      const title = inspectorTitle(choicesCmd);
      expect(title).toBe("두 길목을 정리해 줄래?");
      expect(title).not.toContain("1.맡는다");
      expect(title).not.toContain("나중에");
      expect(title).not.toContain("취소");
    });

    it("falls back to `선택지 N개` when the prompt is empty or whitespace", () => {
      const empty: Command = { ...choicesCmd, prompt: "" };
      const blank: Command = { ...choicesCmd, prompt: "   \n  " };
      const missing: Command = { kind: "choices", options: choicesCmd.options };
      expect(inspectorTitle(empty)).toBe("선택지 2개");
      expect(inspectorTitle(blank)).toBe("선택지 2개");
      expect(inspectorTitle(missing)).toBe("선택지 2개");
    });

    it("collapses multiline prompts to one line", () => {
      const multiline: Command = { ...choicesCmd, prompt: "첫째 줄\n\n  둘째   줄" };
      const title = inspectorTitle(multiline);
      expect(title).toBe("첫째 줄 둘째 줄");
      expect(title).not.toContain("\n");
    });

    it("ellipsizes prompts longer than 80 chars", () => {
      const long: Command = { ...choicesCmd, prompt: "가".repeat(100) };
      const title = inspectorTitle(long);
      expect(title.length).toBeLessThanOrEqual(80);
      expect(title.endsWith("…")).toBe(true);
      expect(title).not.toContain("맡는다");
    });

    it("keeps commandSummary output for non-choices kinds", () => {
      const waitCmd: Command = { kind: "wait", ms: 1500 };
      expect(inspectorTitle(waitCmd)).toBe(commandSummary(waitCmd));
      expect(inspectorTitle(waitCmd)).toContain("대기");
    });

    it("leaves the list-row commandSummary contract untouched", () => {
      const summary = commandSummary(choicesCmd);
      expect(summary).toContain("선택지 표시");
      expect(summary).toContain("맡는다");
      expect(summary).toContain("나중에");
    });
  });
});

// test/eventEditorModalDragSvgTarget.test.ts
//
// 이벤트 편집기 헤더 드래그는 헤더 안 단추 위에서 시작하면 안 된다 — 시작하면 setPointerCapture +
// preventDefault 가 뒤따르는 click 을 삼킨다. 단추 아이콘이 SVG 로 바뀐 뒤(글리프 → SVG 세트)
// 포인터 대상이 `<path>` 가 되면서 `instanceof HTMLElement` 가림막이 비켜났고, 닫기(×)·전체 보기
// 단추가 실제 마우스로는 눌리지 않았다(2026-09-03 실측, e2e event-ai-command-dock «닫기» 단계).
describe("eventEditorModalDragSvgTarget", () => {
  isolateTimers();
  function mount(): { handle: HTMLElement; windowEl: HTMLElement; path: Element; button: HTMLButtonElement } {
    const windowEl = document.createElement("section");
    const handle = document.createElement("header");
    const button = document.createElement("button");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.append(path);
    button.append(svg);
    handle.append(button);
    windowEl.append(handle);
    document.body.append(windowEl);
    handle.setPointerCapture = () => undefined;
    handle.hasPointerCapture = () => false;
    handle.releasePointerCapture = () => undefined;
    attachWindowDrag(handle, windowEl);
    return { handle, windowEl, path, button };
  }
  function pointerDown(target: Element): PointerEvent {
    const event = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10 });
    target.dispatchEvent(event);
    return event;
  }
  describe("attachWindowDrag — 단추 위 포인터", () => {
    it("SVG 아이콘(path)을 누르면 드래그를 시작하지 않아 click 이 살아남는다", () => {
      const { windowEl, path } = mount();
      const event = pointerDown(path);
      expect(event.defaultPrevented).toBe(false);
      expect(windowEl.classList.contains("dragging")).toBe(false);
    });

    it("단추 자체를 누를 때도 같다(기존 동작)", () => {
      const { windowEl, button } = mount();
      const event = pointerDown(button);
      expect(event.defaultPrevented).toBe(false);
      expect(windowEl.classList.contains("dragging")).toBe(false);
    });

    it("헤더 빈 곳을 누르면 드래그가 시작된다", () => {
      const { handle, windowEl } = mount();
      const event = pointerDown(handle);
      expect(event.defaultPrevented).toBe(true);
      expect(windowEl.classList.contains("dragging")).toBe(true);
    });
  });
});

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
