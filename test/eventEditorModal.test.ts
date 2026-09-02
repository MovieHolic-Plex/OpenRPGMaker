import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { renderClassicPageTabStrip } from "@/editor/panels/eventEditor/pageProps";
import { openNpcGraphicDialog } from "@/editor/panels/eventEditor/graphicDialog";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";
import "./eventEditorModalClose.test";

let restoreFakeDom: () => void = () => undefined;

function fakeContainer(): HTMLElement {
  return new FakeElement("div") as unknown as HTMLElement;
}

function eventPage(): EventPage {
  return {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "Hello" }],
  };
}

function gameEvent(page: EventPage): GameEvent {
  return {
    id: "event-1",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

function deleteKeyEvent(): KeyboardEvent {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    altKey: { value: false },
    ctrlKey: { value: false },
    key: { value: "Delete" },
    metaKey: { value: false },
  });
  return event as KeyboardEvent;
}

describe("RPG Maker style event editor entry points", () => {
  beforeEach(() => {
    _resetEventDraftVaultForTest();
    restoreFakeDom = installFakeDom();
    resetEditorUiModeForTests("expert");
    store.replaceProject(createBlankProject());
  });

  afterEach(() => {
    document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
    document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
    _resetEventDraftVaultForTest();
    resetEditorUiModeForTests("standard");
    restoreFakeDom();
  });

  it("exposes the sidebar launcher and modal editor entry points", () => {
    expect(typeof renderEventEditor).toBe("function");
    expect(typeof openEventEditorModal).toBe("function");
    expect(typeof openEventCommandPicker).toBe("function");
    expect(typeof openNpcGraphicDialog).toBe("function");
  });

  it("renders missing map/event messages localized in Korean", () => {
    const project = createBlankProject();
    store.replace(project);

    const sidebar = fakeContainer();
    editorState.set({ currentMapId: "missing-map", selectedEventId: null });
    renderEventEditor(sidebar);
    expect(sidebar.textContent).toContain("맵을 찾을 수 없습니다.");
    expect(sidebar.textContent).not.toContain("Map not found.");

    const missingMapContent = fakeContainer();
    renderEventEditorContent(missingMapContent, "missing-map", "missing-event");
    expect(missingMapContent.textContent).toContain("맵을 찾을 수 없습니다.");
    expect(missingMapContent.textContent).not.toContain("Map not found.");

    const missingEventContent = fakeContainer();
    renderEventEditorContent(missingEventContent, project.startMapId, "missing-event");
    expect(missingEventContent.textContent).toContain("이벤트를 찾을 수 없습니다.");
    expect(missingEventContent.textContent).not.toContain("Event not found.");
  });

  it("removes the new-event modal when cancel discards its draft", () => {
    const project = createBlankProject();
    store.replace(project);

    const eventId = openNewEventEditorModal(project.startMapId, 9, 10);
    expect(eventId).not.toBe("");
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();

    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();

    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    expect(store.getCurrent().maps[project.startMapId].events.some((event) => event.id === eventId)).toBe(false);
  });

  it("shows the user-authored event page name in the map event list", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = { ...eventPage(), name: "마을 상인" };
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });

    const sidebar = fakeContainer();
    renderEventEditor(sidebar);
    expect(sidebar.querySelector(".event-list-icon")).not.toBeNull();
    expect(sidebar.querySelector(".event-graphic-preview")).not.toBeNull();

    expect(sidebar.querySelector(".event-list-name")?.textContent).toBe("마을 상인");
    expect(sidebar.querySelector(".event-editor-launch-title")?.textContent).toBe("마을 상인");
    expect(sidebar.querySelector(".event-list-meta")?.textContent).toBe("2,3 · 1p");
    const row = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-1"]');
    // Custom hover panel is enough — native browser title tooltip must stay off.
    expect(row?.getAttribute("title")).toBeNull();
    row?.dispatchEvent(new Event("pointerenter"));
    const tip = document.querySelector('[data-testid="event-list-tooltip"]');
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toContain("마을 상인");
    expect(tip?.textContent).toContain("페이지 1");
    expect(tip?.textContent).toContain("Hello");
  });

  it("exposes classic ontology-aligned shell markers for a populated event page", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ selectedEventPageId: page.id });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");

    const requiredShellMarkers = [
      "event-classic-page-controls",
      "event-character-id-field",
      "event-classic-conditions",
      "event-classic-graphic",
      "event-classic-movement-section",
      // Nested under movement-section (still present in DOM when closed).
      "event-classic-movement-type",
      "event-classic-trigger",
      "event-classic-animation-type",
      "event-classic-movement-speed",
      "event-script-canvas",
    ];
    for (const testId of requiredShellMarkers) {
      expect(content.querySelector(`[data-testid="${testId}"]`), testId).not.toBeNull();
    }
    // Disposition B: no bottom-left/right panes.
    expect(content.querySelector('[data-testid="event-page-bottom-left"]')).toBeNull();
    expect(content.querySelector('[data-testid="event-page-bottom-right"]')).toBeNull();
  });

  it("renders the classic page toolbar with icons and a top page tab strip carrying names and condition summaries", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const pages = [
      { ...eventPage(), id: "page-1", name: "EV0002" },
      { ...eventPage(), id: "page-2", name: "EV0002-2" },
      { ...eventPage(), id: "page-3", name: "EV0002-3" },
    ];
    map.events = [{ ...gameEvent(pages[0]), pages }];
    store.replace(project);
    editorState.set({ selectedEventPageId: "page-3" });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");

    // 페이지 액션은 조건부로 사라지지 않는다 — 전부 마운트하고 못 쓰는 것만 disabled 다
    // (2026-08-30: 예전에는 붙여넣기·삭제가 나타났다 사라져 이웃 버튼 자리를 밀었다).
    // 페이지 추가는 탭 스트립의 [+](evt-page-add) 하나로 통일(2026-08-19 스펙).
    const pageActionExpectations = [
      ["event-page-duplicate", "복제"],
      ["event-page-copy", "복사"],
      ["event-page-paste", "붙여넣기"],
      ["event-page-delete", "삭제"],
    ] as const;
    for (const [testId, label] of pageActionExpectations) {
      const button = content.querySelector(`[data-testid="${testId}"]`);
      expect(button?.textContent).toContain(label);
    }
    expect(content.querySelector('[data-testid="event-page-paste"]')?.getAttribute("disabled")).toBe("");

    const ev = store.getCurrent().maps[project.startMapId]!.events[0]!;
    const strip = renderClassicPageTabStrip(project.startMapId, ev, ev.pages[2]!);
    expect(strip.dataset.testid).toBe("evt-header-page-tabs");
    for (const [index, name] of ["EV0002", "EV0002-2", "EV0002-3"].entries()) {
      const tab = strip.querySelector(`[data-testid="evt-page-segment-${index + 1}"]`);
      expect(tab?.textContent).toContain(String(index + 1));
      expect(tab?.textContent).toContain(name);
    }
    expect(strip.querySelector('[data-testid="evt-page-cond-1"]')?.textContent).toBe("조건 없음");
    expect(strip.querySelector('[data-testid="evt-page-add"]')).not.toBeNull();
    expect(strip.querySelector('[data-testid="evt-page-segment-3"]')?.className).toContain("active");
  });

  it("requires confirmation before deleting a visible event page", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const pages = [
      { ...eventPage(), id: "page-1", name: "첫 페이지" },
      { ...eventPage(), id: "page-2", name: "삭제 대상" },
    ];
    map.events = [{ ...gameEvent(pages[0]), pages }];
    store.replace(project);
    editorState.set({ selectedEventPageId: "page-2" });
    const confirm = vi.fn(() => false);
    Object.assign(globalThis, { window: { confirm } });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");
    content.querySelector<HTMLElement>('[data-testid="event-page-delete"]')?.click();

    // 삭제는 네이티브 confirm 이 아니라 앱의 showConfirm 을 거친다: 클릭만으로는 아무것도 지워지지 않는다.
    expect(confirm).not.toHaveBeenCalled();
    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages).toHaveLength(2);
  });

  it("wires the command toolbar copy, cut, undo, and redo actions", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ selectedEventPageId: page.id });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");
    content.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head')?.click();

    content.querySelector<HTMLElement>('[data-testid="event-command-toolbar-copy"]')?.click();
    content.querySelector<HTMLElement>('[data-testid="event-command-toolbar-cut"]')?.click();
    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages?.[0]?.commands).toEqual([]);

    const undoContent = fakeContainer();
    renderEventEditorContent(undoContent, project.startMapId, "event-1");
    undoContent.querySelector<HTMLElement>('[data-testid="event-command-toolbar-undo"]')?.click();
    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages?.[0]?.commands).toEqual([{ kind: "text", body: "Hello" }]);

    const redoContent = fakeContainer();
    renderEventEditorContent(redoContent, project.startMapId, "event-1");
    redoContent.querySelector<HTMLElement>('[data-testid="event-command-toolbar-redo"]')?.click();
    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages?.[0]?.commands).toEqual([]);
  });

  it("persists the event overlap forbidden checkbox", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = { ...eventPage(), overlapForbidden: true };
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ selectedEventPageId: page.id });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");
    const overlap = content.querySelector<HTMLInputElement>('[data-testid="event-page-overlap-forbidden"]');
    if (!overlap) throw new Error("Expected overlap checkbox");

    expect(overlap.disabled).toBe(false);
    expect(overlap.checked).toBe(true);
    overlap.checked = false;
    overlap.dispatchEvent(new Event("change"));

    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages?.[0]?.overlapForbidden).toBe(false);
  });

  it("persists custom move-route skippable and keeps Help inside the dialog", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = {
      ...eventPage(),
      movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [], repeat: true, skippable: false } },
    } satisfies EventPage;
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ selectedEventPageId: page.id });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");
    content.querySelector<HTMLElement>('[data-testid="event-page-custom-route"]')?.click();

    const dialog = document.querySelector<HTMLElement>('[data-testid="event-page-move-route-dialog"]');
    if (!dialog) throw new Error("Expected move-route dialog");
    const target = dialog.querySelector<HTMLSelectElement>('[data-testid="event-page-move-route-target-event"]');
    const skippable = dialog.querySelector<HTMLInputElement>('[data-testid="event-page-move-route-skippable"]');
    if (!target || !skippable) throw new Error("Expected move-route controls");

    expect(target.disabled).toBe(false);
    expect(skippable.disabled).toBe(false);
    skippable.checked = true;
    dialog.querySelector<HTMLElement>('[data-testid="event-page-move-route-help"]')?.click();
    expect(document.querySelector('[data-testid="event-page-move-route-dialog"]')).not.toBeNull();
    expect(dialog.querySelector('[data-testid="event-page-move-route-help-panel"]')?.textContent).toContain("현재 이벤트");

    dialog.querySelector<HTMLElement>('[data-testid="event-page-move-route-ok"]')?.click();
    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages?.[0]?.movement.route?.skippable).toBe(true);
  });

  it("헤더 이름 상자는 활성 페이지를 따라가고, 그 페이지 이름만 고친다", () => {
    // 실측 결함(2026-08-30): 헤더는 모달을 열 때 한 번만 렌더되고 refresh 는 페이지 카운터만
    // 갱신했다. 그래서 상자는 1페이지 이름에 묶여 있었고(`페이지 2/4` 인데 상자는 `페이지 1`),
    // 2페이지를 고른 뒤 이름을 고치면 **1페이지 이름이 바뀌었다**.
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const pages = [
      { ...eventPage(), id: "page-1", name: "첫 페이지" },
      { ...eventPage(), id: "page-2", name: "둘째 페이지" },
    ];
    map.events = [{ ...gameEvent(pages[0]!), pages }];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });

    openEventEditorModal(project.startMapId, "event-1");
    const nameInput = document.querySelector<HTMLInputElement>('[data-testid="event-editor-name"]');
    if (!nameInput) throw new Error("Expected the header name input");
    expect(nameInput.value).toBe("첫 페이지");

    editorState.set({ selectedEventPageId: "page-2" });
    // 「페이지 N/M」 카운터는 탭 줄과 중복이라 없앴다(2026-09-03). 순번은 이름 상자의 aria-label 이 말한다.
    expect(document.querySelector('[data-testid="event-editor-header-page-count"]')).toBeNull();
    expect(nameInput.value).toBe("둘째 페이지");
    expect(nameInput.getAttribute("aria-label")).toBe("페이지 이름 (2/2)");

    nameInput.value = "이름 바꿈";
    nameInput.dispatchEvent(new Event("change"));

    const saved = store.getCurrent().maps[project.startMapId].events[0]?.pages ?? [];
    expect(saved.map((page) => page.name)).toEqual(["첫 페이지", "이름 바꿈"]);
  });

  // 예전 계약: 모달 안에서 맨 Delete 를 누르면 확인 후 **이벤트가 통째로** 지워졌다.
  // 가드는 텍스트 입력과 명령 리스트뿐이라 설정 레일·그래픽 패널·페이지 탭·빈 여백 —
  // 모달 면적의 대부분이 «누르면 이벤트가 사라지는» 표면이었다. 페이지 탭을 눌러 포커스가
  // 거기 있는 채로 명령 하나 지우려고 Delete 를 누르면 이벤트가 날아갔다.
  // 지금 계약: 맨 Delete 로는 이벤트를 지우지 않는다. 입구는 라벨 붙은 푸터 버튼 하나뿐이다.
  it("never deletes the open event with a bare Delete key", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });
    const confirmDeletion = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmDeletion);

    openEventEditorModal(project.startMapId, "event-1");
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    if (!modal) throw new Error("Expected event editor modal to open");

    modal.dispatchEvent(deleteKeyEvent());

    expect(confirmDeletion).not.toHaveBeenCalled();
    expect(store.getCurrent().maps[project.startMapId].events).toHaveLength(1);
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
  });

  it("names its target on the footer delete button and keeps it out of the save cluster", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });

    openEventEditorModal(project.startMapId, "event-1");
    const del = document.querySelector<HTMLElement>('[data-testid="event-delete"]');
    if (!del) throw new Error("Expected the footer event-delete button");

    // 우상단 페이지 툴바의 `삭제`(=페이지 1개)와 글자가 같으면 안 된다 — 폭발 반경이 다르다.
    expect(del.textContent).toBe("이벤트 삭제");
    expect(del.getAttribute("aria-label")).toContain("모든 페이지");
    expect(del.closest(".event-editor-footer-actions")).toBeNull();
    expect(del.closest(".event-editor-footer-leading")).not.toBeNull();
  });

  it("keeps the event and active draft when delete confirmation is canceled", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });
    const confirmDeletion = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmDeletion);

    openEventEditorModal(project.startMapId, "event-1");
    const deleteButton = document.querySelector<HTMLElement>('[data-testid="event-delete"]');
    if (!deleteButton) throw new Error("Expected event delete button to render");

    deleteButton.click();

    const event = store.getCurrent().maps[project.startMapId].events.find((item) => item.id === "event-1");
    expect(confirmDeletion).toHaveBeenCalledOnce();
    expect(event?.draft?.kind).toBe("edit");
    expect(editorState.get().selectedEventId).toBe("event-1");
    expect(editorState.get().selectedEventPageId).toBe(page.id);
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
  });

  it("ignores the modal Delete key when focus is inside an input", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });
    const confirmDeletion = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmDeletion);

    openEventEditorModal(project.startMapId, "event-1");
    const nameInput = document.querySelector<HTMLElement>('[data-testid="event-editor-name"]');
    if (!nameInput) throw new Error("Expected the modal header name input to render");

    nameInput.dispatchEvent(deleteKeyEvent());

    expect(confirmDeletion).not.toHaveBeenCalled();
    expect(store.getCurrent().maps[project.startMapId].events.some((event) => event.id === "event-1")).toBe(true);
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
  });

  it("preserves settings scroll when page props re-render after an edit", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });

    openEventEditorModal(project.startMapId, "event-1");
    const settingsMain = document.querySelector<HTMLElement>(".event-editor-settings-main");
    const cmdList = document.querySelector<HTMLElement>(".cmd-list");
    if (!settingsMain || !cmdList) throw new Error("Expected event editor scroll hosts");

    (settingsMain as unknown as { scrollTop: number }).scrollTop = 180;
    (cmdList as unknown as { scrollTop: number }).scrollTop = 64;

    const movementType = document.querySelector<HTMLSelectElement>('[data-testid="event-page-movement-type"]');
    if (!movementType) throw new Error("Expected movement type control");
    movementType.value = "random";
    movementType.dispatchEvent(new Event("change", { bubbles: true }));

    const settingsAfter = document.querySelector<HTMLElement>(".event-editor-settings-main");
    const cmdListAfter = document.querySelector<HTMLElement>(".cmd-list");
    expect((settingsAfter as unknown as { scrollTop: number } | null)?.scrollTop).toBe(180);
    expect((cmdListAfter as unknown as { scrollTop: number } | null)?.scrollTop).toBe(64);
    expect(store.getCurrent().maps[project.startMapId].events[0]?.pages?.[0]?.movement.type).toBe("random");
  });

  it("keeps the workbench when a page is missing movement, graphic, or trigger", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const firstVisit = {
      id: "page-1",
      name: "첫 방문",
    } as EventPage;
    const counter = { ...eventPage(), id: "page-2", name: "단골 창구" };
    map.events = [{ ...gameEvent(counter), x: 77, y: 17, pages: [firstVisit, counter] }];
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      selectedEventId: "event-1",
      selectedEventPageId: firstVisit.id,
    });

    openEventEditorModal(project.startMapId, "event-1");

    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.querySelector('[data-testid="event-editor-content"]')).not.toBeNull();
    expect(modal?.querySelector(".event-editor-workbench")).not.toBeNull();
    expect(modal?.querySelector('[data-testid="event-editor-render-error"]')).toBeNull();
    expect(modal?.querySelector('[data-testid="event-editor-identity"]')?.textContent).toBe("이벤트: 단골 창구");
    // 좌표 앞에 맵 이름 — 어느 맵의 (77, 17) 인지 헤더가 말한다(2026-09-03 제안서 §6).
    expect(modal?.querySelector('[data-testid="event-editor-map-name"]')?.textContent).toBe(project.maps[project.startMapId]!.name);
    expect(modal?.querySelector('[data-testid="event-editor-coords"]')?.textContent).toBe("77, 17");
    // NPC 가 연결되지 않은 이벤트는 「NPC 없음」 칩을 그리지 않는다.
    expect(modal?.querySelector('[data-testid="event-editor-npc-chip"]')).toBeNull();
    expect(document.querySelector<HTMLInputElement>('[data-testid="event-editor-name"]')?.value).toBe("첫 방문");
  });

});
