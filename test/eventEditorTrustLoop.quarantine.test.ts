// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { readEventCommandPickerPreferences } from "@/editor/panels/eventEditor/commandPickerPreferences";
import { renderEventEditorContent, renderEventEditorStable } from "@/editor/panels/eventEditor/content";
import { renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { PAGE_COMMAND_BUTTONS } from "@/editor/panels/eventEditor/options";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

let originalStorage: PropertyDescriptor | undefined;

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

function page(commands: EventPage["commands"] = []): EventPage {
  return {
    id: "page-1",
    name: "신뢰 테스트",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function gameEvent(eventPage: EventPage): GameEvent {
  return {
    id: "event-1",
    x: 3,
    y: 3,
    trigger: eventPage.trigger,
    commands: [],
    pages: [eventPage],
  };
}

function fakeContainer(): HTMLElement {
  return document.createElement("div");
}

function keyEvent(key: string, options: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...options });
}

beforeEach(() => {
  vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "event-editor-trust-loop");
  _resetEventDraftVaultForTest();
  document.body.replaceChildren();
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
  store.replaceProject(createBlankProject());
});

afterEach(() => {
  document.querySelector<HTMLElement>('[data-testid="event-command-picker"] [data-testid="event-command-picker-cancel"]')?.click();
  document.querySelector<HTMLElement>('[data-testid="event-command-edit-cancel"]')?.click();
  document.querySelector<HTMLElement>('[data-testid="event-command-text-cancel"]')?.click();
  document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  _resetEventDraftVaultForTest();
  vi.unstubAllEnvs();
  document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
  document.body.replaceChildren();
});

describe("event editor trust loop", () => {
  it.each(PAGE_COMMAND_BUTTONS)(
    "routes quick command $testId to the active page",
    ({ kind, testId }) => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId].events = [gameEvent(page())];
      store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });

      const host = fakeContainer();
      document.body.append(host);
      renderEventEditorStable(host, mapId, "event-1");
      document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.click();
      expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).not.toBeNull();
      document.querySelector<HTMLElement>('[data-testid="event-command-edit-ok"]')?.click();

      expect(store.getCurrent().maps[mapId].events[0]?.pages?.[0]?.commands.at(-1)?.kind).toBe(kind);
    },
  );

  it.each([
    ["Apply", "event-editor-apply"],
    ["OK", "event-editor-ok"],
    ["Test", "event-editor-test"],
  ] as const)("blocks %s on fatal validation, keeps the draft open, and navigates to its command", (_label, actionTestId) => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(page([{ kind: "text", body: "original" }]))];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
    openEventEditorModal(mapId, "event-1");
    store.update((working) => {
      working.maps[mapId].events[0]!.pages![0]!.commands = [
        { kind: "transfer", mapId: "missing-map", x: 0, y: 0 },
      ];
    });

    document.querySelector<HTMLElement>(`[data-testid="${actionTestId}"]`)?.click();

    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
    expect(store.getCurrent().maps[mapId].events[0]?.draft?.kind).toBe("edit");
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events[0]?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "original" }]);
    const issue = document.querySelector<HTMLElement>('[data-issue-code="reference.map.missing"]');
    expect(issue).not.toBeNull();
    issue?.click();
    expect(document.querySelector('[data-testid="event-command-transfer"]')?.className).toContain("selected");
  });

  it("navigates position issues to coordinates and schedule issues to the visible map picker", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page([{ kind: "text", body: "hello" }]));
    event.x = project.maps[mapId].width;
    event.schedule = [{ when: {}, at: { mapId: "missing-map", x: 0, y: 0 } }];
    project.maps[mapId].events = [event];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: event.id, selectedEventPageId: "page-1" });
    openEventEditorModal(mapId, event.id);

    document.querySelector<HTMLElement>('[data-issue-code="event.position.out-of-bounds"]')?.click();
    expect(document.activeElement).toBe(document.querySelector('[data-testid="event-editor-coords"]'));

    document.querySelector<HTMLElement>('[data-issue-code="reference.map.missing"]')?.click();
    const scheduleEditor = document.querySelector<HTMLDetailsElement>('[data-testid="event-schedule-editor"]');
    expect(scheduleEditor?.open).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('[data-custom-select-for="event-schedule-map-0"]'));
  });

  it("discards a working edit on Cancel without changing the canonical event", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(page([{ kind: "text", body: "canonical" }]))];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
    openEventEditorModal(mapId, "event-1");
    store.update((working) => {
      working.maps[mapId].events[0]!.pages![0]!.commands = [{ kind: "text", body: "working" }];
    });

    const closed = Promise.withResolvers<void>();
    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    if (!modal) throw new Error("missing editor modal");
    modal.addEventListener("oprn:event-editor-close", () => closed.resolve(), { once: true });
    const deadline = setTimeout(() => closed.reject(new Error("editor did not close")), 2000);
    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
    document.querySelector<HTMLElement>('[data-testid="app-modal-confirm"]')?.click();
    try { await closed.promise; } finally { clearTimeout(deadline); }

    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    expect(store.getCurrent().maps[mapId].events[0]?.draft).toBeUndefined();
    expect(store.getCurrent().maps[mapId].events[0]?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", body: "canonical" }]);
  });

  it("shows the real event test action, honest local/remote status, and opens the picker with Ctrl/Cmd+K", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(page([{ kind: "text", body: "hello" }]))];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
    openEventEditorModal(mapId, "event-1");

    expect(document.querySelector('[data-testid="event-editor-test"]')?.textContent).toBe("테스트");
    const draftStatus = document.querySelector('[data-testid="event-editor-draft-status"]')?.textContent ?? "";
    expect(draftStatus).toBe("변경 없음");
    expect(document.querySelector('[data-testid="event-editor-diff"]')).toBeNull();
    const remoteStatus = document.querySelector('[data-testid="event-editor-remote-status"]')?.textContent ?? "";
    expect(remoteStatus).toBe("저장 준비");
    expect(remoteStatus).not.toContain("원격 저장");

    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    modal?.dispatchEvent(keyEvent("k", { ctrlKey: true }));
    expect(document.querySelector('[data-testid="event-command-picker"]')).not.toBeNull();
    const search = document.querySelector<HTMLInputElement>('[data-testid="event-command-picker-search"]');
    expect(document.activeElement).toBe(search);
  });

  it("restores focus to the parent editor when a subdialog opener rerenders away", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(page())];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
    openEventEditorModal(mapId, "event-1");

    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    const opener = modal?.querySelector<HTMLElement>('[data-testid="event-template-talking-npc"]');
    if (!modal || !opener) throw new Error("expected event editor template opener");
    opener.focus();
    opener.click();
    expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).not.toBeNull();

    document.querySelector<HTMLElement>('[data-testid="event-command-edit-cancel"]')?.click();
    expect(document.activeElement).toBe(opener);

    opener.click();
    document.querySelector<HTMLElement>('[data-testid="event-command-edit-ok"]')?.click();

    expect(document.body.contains(opener)).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    expect(modal.contains(document.activeElement)).toBe(true);
    document.activeElement?.dispatchEvent(keyEvent("k", { ctrlKey: true }));
    expect(document.querySelector('[data-testid="event-command-picker"]')).not.toBeNull();
  });

  it("renders all beginner empty-state actions and inserts a factory-created dialogue command", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(page())];
    store.replaceProject(project);
    editorState.set({ selectedEventPageId: "page-1" });
    const content = fakeContainer();

    renderEventEditorContent(content, mapId, "event-1");

    for (const testId of [
      "event-template-talking-npc",
      "event-template-treasure-chest",
      "event-template-transfer",
      "event-template-shop",
      "event-template-battle",
      "event-template-empty-search",
    ]) {
      expect(content.querySelector(`[data-testid="${testId}"]`), testId).not.toBeNull();
    }
    content.querySelector<HTMLElement>('[data-testid="event-template-talking-npc"]')?.click();
    const body = document.querySelector<HTMLTextAreaElement>('[data-testid="event-command-text-body"]');
    if (!body) throw new Error("expected text command template dialog");
    body.value = "안녕하세요";
    body.dispatchEvent(new Event("input"));
    document.querySelector<HTMLElement>('[data-testid="event-command-edit-ok"]')?.click();

    expect(store.getCurrent().maps[mapId].events[0]?.pages?.[0]?.commands)
      .toEqual([{ kind: "text", speaker: undefined, body: "안녕하세요" }]);
  });

  it("uses strict roving tabs, preserves command focus, and keeps recents newest-first", () => {
    openEventCommandPicker({ title: "이벤트 명령", onSelect: () => undefined });
    const firstTab = document.querySelector<HTMLElement>('[data-testid="event-command-picker-tab-1"]');
    const secondTab = document.querySelector<HTMLElement>('[data-testid="event-command-picker-tab-2"]');
    expect(firstTab?.textContent).toBe("빠른 저작");
    expect(secondTab?.textContent).toBe("동료 · 전투");
    expect(firstTab?.getAttribute("tabindex")).toBe("0");
    expect(secondTab?.getAttribute("tabindex")).toBe("-1");
    expect(firstTab?.getAttribute("aria-controls")).toBe("event-command-picker-panel");
    expect(firstTab?.getAttribute("id")).toBe("event-command-picker-tab-button-1");
    const panel = document.querySelector<HTMLElement>('[data-testid="event-command-picker"] .event-command-picker-panel');
    expect(panel?.getAttribute("role")).toBe("tabpanel");
    expect(panel?.getAttribute("aria-labelledby")).toBe("event-command-picker-tab-button-1");

    firstTab?.dispatchEvent(keyEvent("ArrowRight"));
    expect(secondTab?.getAttribute("aria-selected")).toBe("true");
    expect(secondTab?.getAttribute("tabindex")).toBe("0");
    expect(firstTab?.getAttribute("tabindex")).toBe("-1");
    secondTab?.dispatchEvent(keyEvent("Home"));
    expect(firstTab?.getAttribute("aria-selected")).toBe("true");
    expect(firstTab?.getAttribute("tabindex")).toBe("0");

    const search = document.querySelector<HTMLInputElement>('[data-testid="event-command-picker-search"]');
    search?.dispatchEvent(keyEvent("ArrowDown"));
    expect(String(search?.getAttribute("aria-activedescendant"))).toMatch(/^event-command-picker-option-/u);

    const textCommand = document.querySelector<HTMLElement>('[data-testid="command-picker-add-text"]');
    const textId = textCommand?.parentElement?.dataset.commandId;
    const favorite = textCommand?.parentElement?.querySelector<HTMLElement>(".event-command-picker-favorite");
    if (!textId || !favorite) throw new Error("expected text favorite control");
    favorite.focus();
    favorite.click();
    expect(readEventCommandPickerPreferences().favorites).toContain(textId);
    expect(document.querySelector('[data-testid="event-command-picker-favorites"]')).not.toBeNull();
    const focusedFavorite = document.activeElement as HTMLElement | null;
    expect(focusedFavorite?.classList.contains("event-command-picker-favorite")).toBe(true);
    expect(focusedFavorite?.parentElement?.dataset.commandId).toBe(textId);

    // 한 레이어: 명령을 고르면 피커가 닫힌다. 다음 선택은 피커를 다시 열고 한다.
    const waitCommand = document.querySelector<HTMLElement>('[data-testid="command-picker-add-wait"]');
    const waitId = waitCommand?.parentElement?.dataset.commandId;
    waitCommand?.click();
    expect(document.querySelector('[data-testid="event-command-picker"]')).toBeNull();
    openEventCommandPicker({ title: "이벤트 명령", onSelect: () => undefined });
    const switchCommand = document.querySelector<HTMLElement>('[data-testid="command-picker-add-setSwitch"]');
    const switchId = switchCommand?.parentElement?.dataset.commandId;
    switchCommand?.click();
    openEventCommandPicker({ title: "이벤트 명령", onSelect: () => undefined });
    if (!waitId || !switchId) throw new Error("expected recent command ids");
    const recents = readEventCommandPickerPreferences().recents;
    expect(recents.slice(0, 2)).toEqual([switchId, waitId]);
    const recentRoot = document.querySelector<HTMLElement>('[data-testid="event-command-picker-recents"]');
    const recentIds = Array.from(
      recentRoot?.querySelectorAll<HTMLElement>(".event-command-picker-command-wrap") ?? [],
    ).map((node) => node.dataset.commandId);
    expect(recentIds.slice(0, 2)).toEqual([switchId, waitId]);
  });

  it("traps focus inside subdialogs and labels the close control in Korean", () => {
    openEventCommandPicker({ title: "이벤트 명령", onSelect: () => undefined });
    const backdrop = document.querySelector<HTMLElement>('[data-testid="event-command-picker"]');
    const dialog = backdrop?.querySelector<HTMLElement>('[role="dialog"]') ?? backdrop;
    const close = dialog?.querySelector<HTMLElement>(".event-subdialog-close");
    const search = dialog?.querySelector<HTMLElement>('[data-testid="event-command-picker-search"]');
    const cancel = dialog?.querySelector<HTMLElement>('[data-testid="event-command-picker-cancel"]');
    if (!dialog || !close || !search || !cancel) throw new Error("expected command picker dialog controls");

    expect(close.getAttribute("aria-label")).toBe("닫기");
    cancel.focus();
    cancel.dispatchEvent(keyEvent("Tab"));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(keyEvent("Tab", { shiftKey: true }));
    expect(document.activeElement).toBe(cancel);
  });

  it("restores focus, caret, open details, and scroll across reactive rerenders", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(page([{ kind: "text", body: "hello" }]))];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
    openEventEditorModal(mapId, "event-1");

    const nameInput = document.querySelector<HTMLInputElement>('[data-testid="event-editor-name"]');
    // 열린 details 복원은 `data-testid` 가 있는 아무 details 에나 걸리는 일반 계약이다.
    // 예전 표본은 플로우차트 아코디언이었는데, 플로우가 보기 방식으로 승격되면서 details 가 아니게 됐다.
    const details = document.querySelector<HTMLDetailsElement>('[data-testid="event-editor-aux-tools"]');
    const commandList = document.querySelector<HTMLElement>(".cmd-list");
    if (!nameInput || !details || !commandList) throw new Error("expected event editor interaction surfaces");
    nameInput.focus();
    nameInput.setSelectionRange(2, 5);
    details.open = true;
    commandList.scrollTop = 73;
    commandList.scrollLeft = 11;

    store.update((working) => {
      working.meta.author = "rerender";
    });

    const restoredInput = document.querySelector<HTMLInputElement>('[data-testid="event-editor-name"]');
    const restoredDetails = document.querySelector<HTMLDetailsElement>('[data-testid="event-editor-aux-tools"]');
    const restoredList = document.querySelector<HTMLElement>(".cmd-list");
    expect(document.activeElement).toBe(restoredInput);
    expect(restoredInput?.selectionStart).toBe(2);
    expect(restoredInput?.selectionEnd).toBe(5);
    expect(restoredDetails?.open).toBe(true);
    expect(restoredList?.scrollTop).toBe(73);
    expect(restoredList?.scrollLeft).toBe(11);
  });

  it("labels script browsing as non-runtime simulation with loop/choice/goto caveats", () => {
    const host = renderEventPagePreview({
      mapId: "map_start",
      eventId: "event-1",
      page: page([
        { kind: "loop", body: [{ kind: "gotoLabel", name: "again" }] },
        { kind: "choices", prompt: "선택", options: [{ text: "예", branch: [] }] },
      ]),
    });

    expect(host.textContent).toContain("실제 게임 실행이 아닌");
    expect(host.textContent).toContain("반복은 한 번");
    expect(host.textContent).toContain("선택지는 모든 분기");
    expect(host.textContent).toContain("실제 점프를 수행하지 않습니다");
  });
});
