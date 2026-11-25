// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { readEventSurfaceCss } from "./helpers/eventSurfaceCss";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { renderClassicPageTabStrip, renderPageActions } from "@/editor/panels/eventEditor/pageProps";
import { openPageTabContextMenu } from "@/editor/panels/eventEditor/pageTabContextMenu";
import { pageTabDropIndex } from "@/editor/panels/eventEditor/pageTabDragDrop";
import { modalStackEntryCountForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { addEventPage, clearCopiedEventPage, copyEventPageToClipboard } from "@/editor/eventPages";
import { addEvent } from "@/editor/eventActions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent, MapId, Command } from "@/project/types";
import { renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { eventEditorViewLevel, setEventEditorViewLevel } from "@/editor/panels/eventEditor/beginnerChrome";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { buildSceneCards, conditionQuestion, SCENE_COMMENT_COMMAND_ID } from "@/editor/panels/eventEditor/sceneCards";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { resetViewLevelHintForTest, VIEW_LEVEL_HINT_QUIET_MS, viewLevelHintFor } from "@/editor/panels/eventEditor/viewLevelHint";
import { editStepSummary, eventCommandChanges, linkedMapEvents, noteViewLevelSignal, pruneUndoneSteps, resetEventEditLineForTest, type EditStep } from "@/editor/panels/eventEditor/eventEditLine";
import { registerAiAssistantBridge, unregisterAiAssistantBridge, type AiBridgeSendOptions } from "@/editor/aiAssistantBridge";
import { isolateTimers } from "./mergedTeardown";

// test/eventPageManagementSurface.test.ts
//
// 이벤트 편집기 「페이지 관리」 작업면 계약. 2026-08-30 적대적 리뷰가 실측한 결함을 잡는다:
//
//   D1 헤더 이름 상자가 활성 페이지를 따라가지 않고, 고치면 **다른 페이지**가 바뀌었다.
//   D2 복사·삭제가 모달 오른쪽 끝(x=1514) 접힌 details 안에 있어 화면에 없었다.
//   D3 페이지 복제(`copyEventPage`)가 UI 에서 도달 불가였다.
//   D4 페이지 순서 이동(`moveEventPage`)이 UI 에서 도달 불가였다 — 순서가 런타임 우선순위다.
//   D5 붙여넣기·삭제가 조건부 마운트라 버튼이 나타났다 사라졌다.
//   D7 탭 우클릭 메뉴가 없었다(명령 목록에는 있다).
//   D8 role=tab 에 aria-pressed 를 함께 쓰고, tabindex·방향키가 없었다.
describe("eventPageManagementSurface", () => {
  isolateTimers();
  let mapId: MapId;
  let eventId: string;
  beforeEach(() => {
    resetModalStackForTest();
    clearCopiedEventPage();
    store.replace(createBlankProject());
    mapId = store.getCurrent().startMapId;
    eventId = addEvent(mapId, 3, 3);
    document.body.replaceChildren();
  });
  function currentEvent(): GameEvent {
    const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event) throw new Error("event missing");
    return event;
  }
  function pages(): readonly EventPage[] {
    return currentEvent().pages ?? [];
  }
  function actions(activeIndex = 0): HTMLElement {
    const event = currentEvent();
    const page = (event.pages ?? [])[activeIndex];
    if (!page) throw new Error(`page ${activeIndex} missing`);
    const host = document.createElement("div");
    host.append(renderPageActions(mapId, event, page));
    document.body.append(host);
    return host;
  }
  function button(host: HTMLElement, testId: string): HTMLButtonElement {
    const node = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    if (!node) throw new Error(`missing ${testId}`);
    return node;
  }
  describe("페이지 관리 작업면", () => {
    it("여섯 액션을 항상 마운트하고, 못 쓰는 것은 disabled + 이유를 말한다 (D2·D5)", () => {
      const host = actions();
      const ids = [
        "event-page-duplicate",
        "event-page-copy",
        "event-page-paste",
        "event-page-move-back",
        "event-page-move-forward",
        "event-page-delete",
      ];
      for (const id of ids) expect(button(host, id)).toBeTruthy();

      // 페이지 하나 · 클립보드 비었음 → 붙여넣기·순서·삭제는 못 쓴다.
      expect(button(host, "event-page-paste").disabled).toBe(true);
      expect(button(host, "event-page-paste").title).toContain("먼저 복사");
      expect(button(host, "event-page-delete").disabled).toBe(true);
      expect(button(host, "event-page-delete").title).toContain("하나뿐");
      expect(button(host, "event-page-move-back").disabled).toBe(true);
      expect(button(host, "event-page-move-forward").disabled).toBe(true);
      // 여섯 버튼은 ⋯ 메뉴 안에 있지만 항상 마운트된다. 닫힌 details 여도 .click() 은 동작한다.
      const menu = host.querySelector("details");
      expect(menu?.querySelector("summary")?.getAttribute("aria-label")).toBe("페이지 메뉴");
      expect(menu?.querySelectorAll("button")).toHaveLength(ids.length);
    });

    it("복제는 원본 바로 앞의 낮은 우선순위에 꽂는다 — 원본 뒤면 런타임 승자가 바뀐다 (D3)", () => {
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      expect(pages()).toHaveLength(3);
      const sourceId = pages()[0]!.id;

      button(actions(0), "event-page-duplicate").click();

      const after = pages();
      expect(after).toHaveLength(4);
      expect(after[1]!.id).toBe(sourceId);
      expect(after[0]!.name).toBe(`${after[1]!.name} 복사본`);
    });

    it("순서 이동 버튼이 실제로 페이지를 옮기고 양 끝에서 막힌다 (D4)", () => {
      addEventPage(mapId, eventId);
      const [first, second] = [pages()[0]!.id, pages()[1]!.id];

      button(actions(1), "event-page-move-back").click();

      expect(pages().map((page) => page.id)).toEqual([second, first]);
      expect(button(actions(0), "event-page-move-back").disabled).toBe(true);
      expect(button(actions(1), "event-page-move-forward").disabled).toBe(true);
    });

    it("복사를 누르면 붙여넣기가 살아난다 (D5)", () => {
      const host = actions();
      expect(button(host, "event-page-paste").disabled).toBe(true);
      button(host, "event-page-copy").click();
      // 복사는 스토어를 바꾸지 않으므로 액션 줄이 스스로 자기를 다시 그린다.
      const refreshed = document.body.querySelector<HTMLElement>('[data-testid="event-page-tabs"]');
      expect(refreshed?.querySelector<HTMLButtonElement>('[data-testid="event-page-paste"]')?.disabled).toBe(false);
    });

    it("탭은 WAI-ARIA tablist 계약을 지킨다: aria-pressed 없음, roving tabindex (D8)", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      editorState.set({ selectedEventPageId: (event.pages ?? [])[1]!.id });
      const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[1]!);

      const tabs = [...strip.querySelectorAll<HTMLElement>(".evt-page-segment")];
      expect(tabs).toHaveLength(2);
      for (const tab of tabs) expect(tab.getAttribute("aria-pressed")).toBeNull();
      expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"]);
      expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["-1", "0"]);
    });

    it("방향키가 페이지 선택을 옮기고, Ctrl+방향키는 순서를 바꾼다 (D8)", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const [first, second] = [(event.pages ?? [])[0]!.id, (event.pages ?? [])[1]!.id];
      editorState.set({ selectedEventPageId: first });
      const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[0]!);
      document.body.append(strip);

      strip
        .querySelector<HTMLElement>('[data-testid="evt-page-segment-1"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(editorState.get().selectedEventPageId).toBe(second);

      strip
        .querySelector<HTMLElement>('[data-testid="evt-page-segment-1"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true, bubbles: true }));
      expect(pages().map((page) => page.id)).toEqual([second, first]);
    });

    it("실제 모달 구독 렌더 뒤에도 방향키와 Ctrl+방향키 포커스가 선택 페이지를 따른다", () => {
      addEventPage(mapId, eventId);
      editorState.set({ currentMapId: mapId, selectedEventId: eventId, selectedEventPageId: pages()[0]!.id });
      openEventEditorModal(mapId, eventId);
      const firstId = pages()[0]!.id;
      const secondId = pages()[1]!.id;
      const first = document.querySelector<HTMLElement>(`.evt-page-segment[data-page-id="${firstId}"]`)!;
      first.focus();

      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(editorState.get().selectedEventPageId).toBe(secondId);
      expect((document.activeElement as HTMLElement).dataset.pageId).toBe(secondId);

      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowLeft", ctrlKey: true, bubbles: true,
      }));
      expect(pages().map((page) => page.id)).toEqual([secondId, firstId]);
      expect((document.activeElement as HTMLElement).dataset.pageId).toBe(secondId);
      expect((document.activeElement as HTMLElement).dataset.pageId).toBe(editorState.get().selectedEventPageId);
    });

    it("우클릭 메뉴의 붙여넣기는 선택이 아니라 **우클릭한** 페이지 바로 앞에 넣는다", () => {
      // 우클릭은 선택을 옮기지 않는다. 예전엔 붙여넣기가 editorState 의 활성 페이지로 자리를 잡아서,
      // 1페이지를 고른 상태에서 3페이지를 우클릭해 붙여넣으면 새 페이지가 index 0 에 꽂혔다.
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      const [first, , third] = [pages()[0]!, pages()[1]!, pages()[2]!];
      expect(copyEventPageToClipboard(mapId, eventId, first.id)).toBe(true);
      editorState.set({ selectedEventPageId: first.id });

      openPageTabContextMenu({
        x: 20, y: 20, mapId, event: currentEvent(), page: third, index: 2, requestDelete: () => undefined,
      });
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-paste"]')!.click();

      const after = pages();
      const pastedIndex = after.findIndex((page) => page.id === editorState.get().selectedEventPageId);
      expect(after.findIndex((page) => page.id === third.id)).toBe(3);
      expect(pastedIndex).toBe(2);
    });

    it("한 동작은 한 단어만 쓰고, 보이는 라벨이 접근성 이름에 들어 있다 (WCAG 2.5.3)", () => {
      const host = actions();
      const expected = [
        ["event-page-duplicate", "복제"],
        ["event-page-copy", "복사"],
        ["event-page-paste", "붙여넣기"],
        ["event-page-delete", "삭제"],
      ] as const;
      for (const [testId, label] of expected) {
        const node = button(host, testId);
        // 보이는 라벨은 진짜 텍스트 노드다 — `font-size:0` + `::after` 로 다른 말을 그리면 이 단언이 깨진다.
        expect(node.textContent, testId).toBe(label);
        expect(node.querySelector(".event-page-button-label")?.textContent, testId).toBe(label);
        expect(node.dataset.compactLabel, testId).toBeUndefined();
        expect(node.getAttribute("aria-label") ?? "", testId).toContain(label);
        // 비활성이여도 title 은 라벨을 되둥하지 않고 이유를 말한다.
        expect(node.getAttribute("title") ?? "", testId).not.toBe(label);
      }
    });

    it("좁은 포트 CSS 는 라벨을 지우고 다시 그리는 장치를 쓰지 않는다", () => {
      // 2026-09-11 Task 13: 페이지 버튼 규칙을 갖던 event-editor.balanced.css 는 구성 요소 버킷으로 흩어졌다 → 표면 전체를 본다.
      const css = readEventSurfaceCss();
      expect(css).not.toContain("attr(data-compact-label)");
      expect(css).not.toMatch(/\.event-page-button-label\s*\{[^}]*font-size:\s*0/u);
    });

    it("메뉴 복사는 선택을 옮기지 않는다 — 읽기 행위가 헤더·목록·버튼 대상을 끌고 가면 안 된다", () => {
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      const [first, , third] = [pages()[0]!, pages()[1]!, pages()[2]!];
      editorState.set({ selectedEventPageId: first.id });

      openPageTabContextMenu({
        x: 12, y: 12, mapId, event: currentEvent(), page: third, index: 2, requestDelete: () => undefined,
      });
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();

      expect(editorState.get().selectedEventPageId).toBe(first.id);
    });

    it("이미 활성인 페이지를 메뉴로 복사해도 버튼 줄의 붙여넣기가 살아나고 안내도 바뀌다", () => {
      // 클립보드에 변경 통지가 없어서, 메뉴 복사 후에도 붙여넣기가 disabled + "먼저 복사를 누르세요"
      // 로 남았다 — 같은 화면의 성공 토스트와 정반대로 말하는 상태다.
      const host = actions(0);
      const active = pages()[0]!;
      editorState.set({ selectedEventPageId: active.id });
      expect(button(host, "event-page-paste").disabled).toBe(true);

      openPageTabContextMenu({
        x: 12, y: 12, mapId, event: currentEvent(), page: active, index: 0, requestDelete: () => undefined,
      });
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();

      const paste = document.body.querySelector<HTMLButtonElement>('[data-testid="event-page-paste"]')!;
      expect(paste.disabled).toBe(false);
      expect(paste.title).not.toContain("먼저 복사");
      expect(paste.title).toContain("앞");
    });

    it("탭 우클릭 메뉴가 여섯 항목을 주고 클립보드 상태를 반영한다 (D7)", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const page = (event.pages ?? [])[0]!;
      openPageTabContextMenu({ x: 20, y: 20, mapId, event, page, index: 0, requestDelete: () => undefined });

      const menu = document.querySelector<HTMLElement>('[data-testid="event-page-context-menu"]');
      expect(menu).toBeTruthy();
      expect(menu!.getAttribute("role")).toBe("menu");
      expect([...menu!.querySelectorAll("[data-testid]")].map((node) => node.getAttribute("data-testid"))).toEqual([
        "event-page-menu-duplicate",
        "event-page-menu-copy",
        "event-page-menu-paste",
        "event-page-menu-move-back",
        "event-page-menu-move-forward",
        "event-page-menu-delete",
      ]);
      // 첫 페이지에서는 앞으로 옮기기와 빈 버퍼의 붙여넣기가 막혀 있다.
      expect(menu!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-move-back"]')!.disabled).toBe(true);
      expect(menu!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-paste"]')!.disabled).toBe(true);

      copyEventPageToClipboard(mapId, eventId, page.id);
      openPageTabContextMenu({ x: 20, y: 20, mapId, event, page, index: 0, requestDelete: () => undefined });
      const reopened = document.querySelector<HTMLElement>('[data-testid="event-page-context-menu"]');
      expect(reopened!.querySelector<HTMLButtonElement>('[data-testid="event-page-menu-paste"]')!.disabled).toBe(false);
    });

    it("우클릭 메뉴는 모달 스택 최상단을 잡는다 — Escape 가 이벤트 편집기까지 닫지 않도록", () => {
      const event = currentEvent();
      const page = (event.pages ?? [])[0]!;
      const before = modalStackEntryCountForTest();

      openPageTabContextMenu({ x: 10, y: 10, mapId, event, page, index: 0, requestDelete: () => undefined });
      expect(modalStackEntryCountForTest()).toBe(before + 1);

      document
        .querySelector<HTMLElement>('[data-testid="event-page-menu-duplicate"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(document.querySelector('[data-testid="event-page-context-menu"]')).toBeNull();
      expect(modalStackEntryCountForTest()).toBe(before);
    });

    it("우클릭 메뉴의 모든 닫기 경로가 리스너와 raw 모달 엔트리를 함께 치운다", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const page = event.pages![0]!;
      const request = { x: 10, y: 10, mapId, event, page, index: 0, requestDelete: () => undefined };
      const baseline = modalStackEntryCountForTest();

      openPageTabContextMenu(request);
      openPageTabContextMenu(request);
      expect(document.querySelectorAll('[data-testid="event-page-context-menu"]')).toHaveLength(1);
      expect(modalStackEntryCountForTest()).toBe(baseline + 1);

      document.querySelector<HTMLElement>('[data-testid="event-page-menu-copy"]')!.click();
      expect(modalStackEntryCountForTest()).toBe(baseline);

      openPageTabContextMenu(request);
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(modalStackEntryCountForTest()).toBe(baseline);

      openPageTabContextMenu(request);
      document.querySelector<HTMLElement>('[data-testid="event-page-menu-duplicate"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(modalStackEntryCountForTest()).toBe(baseline);
    });

    it("페이지가 한 장이면 탭을 끌 수 없다", () => {
      const strip = renderClassicPageTabStrip(mapId, currentEvent(), pages()[0]!);
      const tab = strip.querySelector<HTMLElement>(".evt-page-segment[data-page-id]");
      expect(tab?.getAttribute("draggable")).toBe("false");
    });

    it("페이지가 두 장 이상이면 탭을 끌 수 있고, 복제 버튼은 브라우저 기본 드래그를 막는다", () => {
      addEventPage(mapId, eventId);
      const event = currentEvent();
      const strip = renderClassicPageTabStrip(mapId, event, (event.pages ?? [])[0]!);
      document.body.append(strip);
      const tabs = [...strip.querySelectorAll<HTMLElement>(".evt-page-segment[data-page-id]")];
      expect(tabs).toHaveLength(2);
      for (const tab of tabs) expect(tab.getAttribute("draggable")).toBe("true");
      expect(tabs[0]!.title).toContain("끌어다 놓아");

      const host = actions();
      const duplicate = button(host, "event-page-duplicate");
      expect(duplicate.getAttribute("draggable")).toBe("false");
      const drag = new Event("dragstart", { bubbles: true, cancelable: true });
      duplicate.dispatchEvent(drag);
      expect(drag.defaultPrevented).toBe(true);
    });

    it("탭 드롭은 소스 제거를 보정한 자리에 꽂는다", () => {
      expect(pageTabDropIndex(0, 2, false)).toBe(2);
      expect(pageTabDropIndex(2, 0, true)).toBe(0);
      expect(pageTabDropIndex(1, 1, false)).toBe(1);
    });

    it("탭을 다른 탭 위에 떨어뜨리면 페이지 순서가 바뀐다", () => {
      addEventPage(mapId, eventId);
      addEventPage(mapId, eventId);
      const [first, second, third] = pages();
      editorState.set({ selectedEventPageId: first!.id });
      const strip = renderClassicPageTabStrip(mapId, currentEvent(), first!);
      document.body.append(strip);
      const source = strip.querySelector<HTMLElement>(`[data-page-id="${first!.id}"]`)!;
      const target = strip.querySelector<HTMLElement>(`[data-page-id="${third!.id}"]`)!;
      target.getBoundingClientRect = () => ({
        x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 28, width: 80, height: 28, toJSON: () => ({}),
      });

      source.dispatchEvent(new Event("dragstart", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("drop", { bubbles: true, cancelable: true, clientX: 70 }));

      expect(pages().map((page) => page.id)).toEqual([second!.id, third!.id, first!.id]);
    });

    it("거부된 경계 이동은 성공 토스트를 만들지 않는다", () => {
      const host = actions();
      const target = button(host, "event-page-move-back");
      target.disabled = false;
      target.click();
      expect(document.querySelector('[data-testid="toast"]')).toBeNull();
    });
  });
});

describe("eventPreviewState", () => {
  isolateTimers();
  const FACE_A = "easyrpg-faceset-people1-03";
  const FACE_B = "easyrpg-faceset-actor1-00";
  function faceCommand(resourceId: string): Extract<Command, { kind: "changeFace" }> {
    return { kind: "changeFace", resourceId, position: "left", flipHorizontally: false };
  }
  function page(id: string, commands: Command[]): EventPage {
    return {
      id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" },
      priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    };
  }
  function render(authored: EventPage, advances = 0): HTMLElement {
    const panel = renderEventPagePreview({
      mapId: store.getCurrent().startMapId, eventId: "ev_preview_state", page: authored,
    });
    document.body.append(panel);
    for (let i = 0; i < advances; i += 1) {
      const next = panel.querySelector<HTMLButtonElement>('[data-testid="event-script-live-next"]');
      if (!next) throw new Error("Preview Next control is missing");
      next.click();
    }
    return panel;
  }
  function faceId(panel: HTMLElement): string | null {
    return panel.querySelector('[data-testid="event-command-face-crop-shell"]')?.getAttribute("data-resource-id") ?? null;
  }
  describe("event preview uses the current command state", () => {
    beforeEach(() => {
      const project = createBlankProject();
      project.variables = [{ id: "var_0001", name: "Score" }];
      store.replace(project);
    });
    afterEach(() => {
      clearCommandInspector();
      setCommandInspectorHost(undefined);
      document.body.replaceChildren();
    });

    it("refreshes a remembered dialogue step when its preceding face is edited", () => {
      const first = render(page("edited-face", [
        faceCommand(FACE_A), { kind: "text", body: "대사" },
      ]), 1);
      expect(faceId(first)).toBe(FACE_A);
      first.remove();

      const refreshed = render(page("edited-face", [
        faceCommand(FACE_B), { kind: "text", body: "대사" },
      ]));

      expect(refreshed.querySelector(".event-script-live-position")?.textContent).toBe("2/2");
      expect(faceId(refreshed)).toBe(FACE_B);
    });

    it("honors a face-clear command instead of finding an older portrait", () => {
      const panel = render(page("cleared-face", [
        faceCommand(FACE_A),
        faceCommand(""),
        { kind: "text", body: "얼굴 없는 대사" },
      ]), 2);

      expect(faceId(panel)).toBeNull();
      expect(panel.querySelector(".ecp-message-window")?.classList.contains("with-face")).toBe(false);
    });

    it("carries the authored face side and flip into the dialogue stage", () => {
      const panel = render(page("face-layout", [
        { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
        { kind: "text", body: "오른쪽 얼굴" },
      ]), 1);

      const face = panel.querySelector('[data-testid="event-command-face-crop-shell"]');
      expect(face?.getAttribute("data-position")).toBe("right");
      expect(face?.classList.contains("flipped")).toBe(true);
      expect(panel.querySelector(".ecp-message-window")?.classList.contains("face-right")).toBe(true);
    });

    it("does not borrow a face from a skipped conditional branch", () => {
      const panel = render(page("skipped-face", [
        faceCommand(FACE_A),
        {
          kind: "fork", condition: { kind: "switch", switchId: "sw_preview", value: true },
          then: [faceCommand(FACE_B)], else: [],
        },
        { kind: "text", body: "실행되는 대사" },
      ]), 3);

      expect(faceId(panel)).toBe(FACE_A);
    });

    it.each([4, 5])("keeps choice-local faces out of sibling/outer dialogue at step %i", (step) => {
      const panel = render(page(`choice-face-${step}`, [
        faceCommand(FACE_A),
        {
          kind: "choices", prompt: "선택", options: [
            { text: "첫 분기", branch: [
              faceCommand(FACE_B), { kind: "text", body: "첫 분기 대사" },
            ] },
            { text: "다음 분기", branch: [{ kind: "text", body: "다음 분기 대사" }] },
          ],
        },
        { kind: "text", body: "분기 밖 대사" },
      ]), step);

      expect(faceId(panel)).toBe(FACE_A);
    });

    it("interpolates the variable value at the current simulated step", () => {
      const panel = render(page("variable-dialogue", [
        { kind: "setVariable", variableId: "var_0001", op: "=", value: 37 },
        { kind: "text", body: "점수: \\V[1]" },
      ]), 1);

      expect(panel.querySelector(".ecp-message-body")?.textContent).toBe("점수: 37");
    });

    it("passes authored face side and flip from the list into the text inspector", () => {
      const list = document.createElement("div");
      const inspector = document.createElement("div");
      document.body.append(list, inspector);
      setCommandInspectorHost(inspector);
      renderCommandList(list, [
        { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
        { kind: "text", body: "인스펙터 대사" },
      ], [], {
        addCommand() {}, insertCommand() {}, replaceCommand() {},
        deleteCommand() {}, moveCommand() {}, moveCommandTo() {},
      });
      const row = list.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head');
      if (!row) throw new Error("Text command row is missing");

      row.click();

      const face = inspector.querySelector('[data-testid="event-command-face-crop-shell"]');
      expect(face?.getAttribute("data-position")).toBe("right");
      expect(face?.classList.contains("flipped")).toBe(true);
    });
  });
});

// 레코드 픽커 창의 두 계약을 고정한다.
//
// 1) 참조 수 집계는 창이 열려 있는 동안 한 번만 한다. 렌더마다 새로 만들면 검색 키
//    한 번에 프로젝트 맵 전체가 다시 직렬화된다.
// 2) 행을 클릭해 재렌더가 일어나도 포커스가 선택된 행에 남는다. 재렌더는 방금 누른
//    버튼을 파괴하므로, 옮겨 주지 않으면 body 로 떨어져 ↑↓·Enter 와 스크린리더
//    위치를 함께 잃는다.
describe("eventRecordPickerPanelBehavior", () => {
  isolateTimers();
  function picker(): HTMLElement {
    const node = document.querySelector<HTMLElement>('[data-testid="event-record-picker"]');
    if (!node) throw new Error("픽커가 열리지 않았다");
    return node;
  }
  const rows = (): HTMLElement[] =>
    Array.from(picker().querySelectorAll<HTMLElement>(".event-record-picker-row"));
  describe("레코드 픽커 창 동작", () => {
    beforeEach(() => {
      const project = createBlankProject();
      project.switches[0]!.name = "마을 축제 시작";
      project.switches[1]!.name = "마을 축제 끝남";
      store.replace(project);
    });

    afterEach(() => {
      document.querySelectorAll('[data-testid="event-record-picker"]').forEach((n) => n.remove());
      vi.restoreAllMocks();
    });

    it("검색을 여러 번 해도 프로젝트를 다시 직렬화하지 않는다", () => {
      const spy = vi.spyOn(JSON, "stringify");
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const afterOpen = spy.mock.calls.length;
      expect(afterOpen).toBeGreaterThan(0);

      const search = picker().querySelector<HTMLInputElement>(
        '[data-testid="event-record-picker-search"]',
      )!;
      for (const query of ["축", "축제", "축제 시"]) {
        search.value = query;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // 검색 세 번이 집계 원본을 다시 만들지 않아야 한다.
      expect(spy.mock.calls.length).toBe(afterOpen);
    });

    it("행을 클릭한 뒤에도 포커스가 선택된 행에 남는다", () => {
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const second = rows()[1];
      expect(second).toBeTruthy();
      second!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      const selected = picker().querySelector<HTMLElement>(".event-record-picker-row.selected");
      expect(selected).toBeTruthy();
      expect(document.activeElement).toBe(selected);
      expect(document.activeElement).not.toBe(document.body);
    });

    it("행에 포커스가 있어도 ↑↓ 로 선택을 옮길 수 있다", () => {
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const first = rows()[0]!;
      first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const before = picker()
        .querySelector<HTMLElement>(".event-record-picker-row.selected")
        ?.dataset.testid;

      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );

      const after = picker()
        .querySelector<HTMLElement>(".event-record-picker-row.selected")
        ?.dataset.testid;
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
    });

    it("빈 검색 문구는 아이템·스위치 받침에 맞는 조사를 쓴다", () => {
      openRecordPickerPanel({ kind: "item", currentId: "", onSelect: () => undefined });
      const search = picker().querySelector<HTMLInputElement>(
        '[data-testid="event-record-picker-search"]',
      )!;
      search.value = "없는물건";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      expect(picker().querySelector('[data-testid="event-record-picker-no-result"]')?.textContent)
        .toBe('"없는물건" 과 일치하는 아이템이 없습니다.');

      document.querySelectorAll('[data-testid="event-record-picker"]').forEach((node) => node.remove());
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });
      const switchSearch = picker().querySelector<HTMLInputElement>(
        '[data-testid="event-record-picker-search"]',
      )!;
      switchSearch.value = "가나";
      switchSearch.dispatchEvent(new Event("input", { bubbles: true }));
      expect(picker().querySelector('[data-testid="event-record-picker-no-result"]')?.textContent)
        .toBe('"가나" 와 일치하는 스위치가 없습니다.');
    });

    it("아이템이 없으면 빈 목록도 받침 있는 조사를 쓴다", () => {
      const project = createBlankProject();
      project.database.items = [];
      store.replace(project);
      openRecordPickerPanel({ kind: "item", currentId: "", onSelect: () => undefined });
      expect(picker().textContent).toContain("아이템이 아직 없습니다.");
      expect(picker().textContent).not.toContain("아이템가");
    });

    it("Enter 는 선택을 확정하고 창을 닫는다", () => {
      const onSelect = vi.fn();
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect });

      rows()[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-testid="event-record-picker"]')).toBeNull();
    });
  });
});

// 이벤트 편집기 보기 셋(쉬움·보통·고급)과 장면 카드 모델(목업 v2).
describe("eventSceneCards", () => {
  isolateTimers();
  const comment = (text: string): Command => ({ kind: "m2Command", commandId: SCENE_COMMENT_COMMAND_ID, fields: { comment: text, color: "green" } });
  const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body });
  const narrate = (body: string): Command => ({ kind: "text", body, context: "narration" });
  describe("장면 카드 모델", () => {
    it("대사 줄은 얼굴 바꾸기와 함께 한 대화 카드로 묶고, 상점은 따로 카드다", () => {
      const cards = buildSceneCards([
        { kind: "changeFace", faceId: "f" } as Command,
        say("오든", "회복약이랑 약초는 여기서 사고판다."),
        { kind: "shop", itemIds: ["a"], allowSell: true, title: "오든 약재상" },
      ]);
      expect(cards.map((card) => card.kind)).toEqual(["talk", "shop"]);
      expect(cards[0]!.title).toBe("오든이 말한다");
      expect(cards[0]!.paths).toEqual([[0], [1]]);
      expect(cards[1]!.shop?.title).toBe("오든 약재상");
    });

    it("주석 명령은 카드 경계이자 이름이고, 다음 주석까지 모두 담는다", () => {
      const cards = buildSceneCards([
        comment("막을 연다"),
        { kind: "playAudio", resourceId: "se", loop: false, channel: "se" } as Command,
        narrate("쇠 장화 소리"),
        comment("마주 선다"),
        say("발렌", "넘겨라."),
        say("이리스", "싫어요."),
      ]);
      expect(cards.map((card) => [card.kind, card.title, card.commandCount])).toEqual([
        ["stage", "막을 연다", 3],
        ["talk", "마주 선다", 3],
      ]);
    });

    it("전투 뒤 전투 결과 갈림은 전투 카드 하나와 이기면·지면 갈래다", () => {
      const cards = buildSceneCards([
        { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true } as Command,
        { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [narrate("이겼다")], else: [narrate("졌다")] } as Command,
      ]);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.kind).toBe("battle");
      expect(cards[0]!.branches.map((branch) => branch.label)).toEqual(["이기면", "지면"]);
      expect(cards[0]!.branches[0]!.containerPath).toEqual([1, FORK_THEN_BRANCH_INDEX]);
    });

    it("조건 문장을 물음으로 바꾼다", () => {
      expect(conditionQuestion("「해 손잡이 당김」이 켜져 있으면")).toBe("「해 손잡이 당김」이 켜져 있나?");
      expect(conditionQuestion("전투 승리일 때")).toBe("전투 승리일 때?");
    });
  });
  describe("보기 셋", () => {
    const EVENT_ID = "ev_scene_levels";
    const page: EventPage = {
      id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [say("오든", "어서 오게."), { kind: "shop", itemIds: [], allowSell: true }],
    };

    beforeEach(() => {
      localStorage.clear();
      resetEventViewSession();
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const event: GameEvent = { id: EVENT_ID, name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] };
      project.maps[mapId]!.events.push(event);
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    });
    afterEach(() => {
      localStorage.clear();
      clearCommandInspector();
      document.body.replaceChildren();
    });

    const render = (): HTMLElement => {
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, editorState.get().currentMapId!, EVENT_ID);
      return host;
    };

    it("시험 환경의 기본은 고급(명령 목록)이고, 고른 보기는 기억한다", () => {
      expect(eventEditorViewLevel()).toBe("advanced");
      setEventEditorViewLevel("easy");
      expect(eventEditorViewLevel()).toBe("easy");
      expect(localStorage.getItem("oprn.event-editor.view")).toBe("easy");
    });

    it("쉬움은 명령 목록 대신 장면 카드를 그리고, 줄 수·카드 추가를 숨긴다", () => {
      setEventEditorViewLevel("easy");
      const host = render();
      const cards = host.querySelector<HTMLElement>('[data-testid="event-scene-cards"]');
      expect(cards?.dataset.level).toBe("easy");
      expect(cards?.querySelectorAll(".event-scene-card")).toHaveLength(2);
      expect(host.querySelector('[data-testid="event-scene-card-count"]')).toBeNull();
      expect(host.querySelector('[data-testid="event-scene-add"]')).toBeNull();
      expect(host.querySelector(".cmd-item")).toBeNull();
      expect(host.querySelector('[data-testid="event-editor-advanced-toggle"]')).toBeNull();
    });

    it("쉬움은 모습·시작 방식을 페이지 줄 앞 칩으로 옮기고, 고급은 설정 칸에 그대로 둔다", () => {
      setEventEditorViewLevel("easy");
      const easy = render();
      const strip = easy.querySelector('[data-testid="event-editor-pagebar"] > [data-testid="event-scene-who-when"]');
      expect(strip?.querySelector('[data-testid="event-classic-graphic"]')).not.toBeNull();
      expect(strip?.querySelector('[data-testid="event-classic-trigger"]')).not.toBeNull();
      expect(easy.querySelector('.event-editor-settings-column [data-testid="event-classic-trigger"]')).toBeNull();
      expect(easy.querySelector('[data-testid="event-scene-page-label"]')?.textContent).toBe("때");
      document.body.replaceChildren();
      setEventEditorViewLevel("advanced");
      const advanced = render();
      expect(advanced.querySelector('[data-testid="event-scene-who-when"]')).toBeNull();
      expect(advanced.querySelector('.event-editor-settings-column [data-testid="event-classic-trigger"]')).not.toBeNull();
    });

    it("보통은 카드에 줄 수와 카드 추가를 더한다", () => {
      setEventEditorViewLevel("normal");
      const host = render();
      expect(host.querySelectorAll('[data-testid="event-scene-card-count"]')).toHaveLength(2);
      expect(host.querySelector('[data-testid="event-scene-add"]')).not.toBeNull();
    });
  });
  describe("막히는 신호의 보기 제안", () => {
    beforeEach(() => {
      localStorage.clear();
      resetViewLevelHintForTest();
      resetEventEditLineForTest();
    });

    it("쉬움에서 두 번 되돌림은 보통을 한 번만 제안하고, 14일 뒤 다시 제안한다", () => {
      setEventEditorViewLevel("easy");
      const now = 1_000_000;
      expect(viewLevelHintFor("undo-twice", now)).toContain("보기 › 보통");
      expect(viewLevelHintFor("undo-twice", now + 1000)).toBeNull();
      expect(viewLevelHintFor("undo-twice", now + VIEW_LEVEL_HINT_QUIET_MS + 1)).toContain("보통");
    });

    it("숨은 명령·줄 복사·Delete 는 고급을 제안하고, 이미 그 보기 이상이면 말하지 않는다", () => {
      setEventEditorViewLevel("normal");
      expect(viewLevelHintFor("undo-twice")).toBeNull();
      expect(viewLevelHintFor("hidden-command")).toContain("보기 › 고급");
      expect(viewLevelHintFor("line-delete")).toBeNull();
      setEventEditorViewLevel("advanced");
      resetViewLevelHintForTest();
      expect(viewLevelHintFor("line-copy")).toBeNull();
    });

    it("보기를 스스로 바꾸지 않고, 열린 편집기의 요약줄 자리에 한 줄로 띄운다", () => {
      setEventEditorViewLevel("easy");
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const page: EventPage = {
        id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [say("오든", "어서 오게.")],
      };
      project.maps[mapId]!.events.push({ id: "ev_hint", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, mapId, "ev_hint");
      const card = host.querySelector<HTMLElement>(".event-scene-card")!;
      card.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
      const summary = host.querySelector<HTMLElement>('[data-testid="event-edit-line-summary"]')!;
      expect(summary.dataset.kind).toBe("hint");
      expect(summary.textContent).toContain("고급");
      expect(eventEditorViewLevel()).toBe("easy");
      expect(noteViewLevelSignal("line-copy")).toBe(false);
      document.body.replaceChildren();
      clearCommandInspector();
    });
  });
  describe("한 줄 고치기 조수 호출", () => {
    afterEach(() => {
      unregisterAiAssistantBridge();
      resetEventEditLineForTest();
      document.body.replaceChildren();
      clearCommandInspector();
    });

    it("Enter 는 지금 페이지 범위(eventCommandScope)로 보내고, 이어진 이벤트가 없으면 한 번만 부른다", async () => {
      setEventEditorViewLevel("easy");
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const page: EventPage = {
        id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [say("오든", "어서 오게.")],
      };
      project.maps[mapId]!.events.push({ id: "ev_line", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      const calls: { text: string; options?: AiBridgeSendOptions }[] = [];
      registerAiAssistantBridge({
        send: async (text, options) => {
          calls.push({ text, options });
          const before = store.getCurrent();
          const after = structuredClone(before);
          (after.maps[mapId]!.events.find((event) => event.id === "ev_line")!.pages![0]!.commands[0] as { body: string }).body = "어서 와.";
          return { ok: true, pendingProposal: { callCount: 1, summary: "", before, after }, status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
        },
        getStatus: () => ({ ready: true, turnBusy: false }) as never,
        getAudit: () => [],
        getHarness: () => null,
        abort: () => {},
      });
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, mapId, "ev_line");
      const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
      input.value = "반말로";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await vi.waitFor(() => expect(store.getCurrent().maps[mapId]!.events.find((event) => event.id === "ev_line")!.pages![0]!.commands[0]).toMatchObject({ body: "어서 와." }));
      expect(calls).toHaveLength(1);
      expect(calls[0]!.text).toBe("반말로");
      expect(calls[0]!.options).toMatchObject({ deferApply: true, eventCommandScope: { mapId, eventId: "ev_line", pageId: "p1", mode: "edit" } });
    });
  });
  describe("한 줄 고치기 범위(이어진 이벤트)", () => {
    const lever = (id: string, name: string, switchId: string, body: string): GameEvent => ({
      id, name, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `${id}_p1`, name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [narrate(body), { kind: "setSwitch", switchId, value: true } as Command],
      }],
    });
    const puzzle = () => {
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      project.maps[mapId]!.events.push(
        lever("ev_sun", "해 손잡이", "sw_sun", "해 문양"),
        lever("ev_moon", "달 손잡이", "sw_sun", "달 문양"),
        lever("ev_far", "석판", "sw_other", "석판 글"),
      );
      return { project, mapId };
    };
    const setBody = (event: GameEvent, body: string) => { (event.pages![0]!.commands[0] as { body: string }).body = body; };

    it("같은 스위치를 쓰는 같은 맵 이벤트를 이어진 것으로 찾는다", () => {
      const { project, mapId } = puzzle();
      expect(linkedMapEvents(project, mapId, "ev_moon").map((event) => event.id)).toEqual(["ev_sun"]);
    });

    it("맵 여러 이벤트가 명령에서 쓰는 이야기 깃발은 연결로 보지 않는다(마을 허브)", () => {
      const { project, mapId } = puzzle();
      for (let index = 0; index < 4; index += 1) project.maps[mapId]!.events.push(lever(`ev_villager_${index}`, "주민", "sw_sun", "안녕"));
      expect(linkedMapEvents(project, mapId, "ev_moon")).toEqual([]);
    });

    it("같은 맵 다른 이벤트의 명령 변경은 받고 연 이벤트를 먼저 둔다", () => {
      const { project: before, mapId } = puzzle();
      const after = structuredClone(before);
      const events = after.maps[mapId]!.events;
      setBody(events.find((event) => event.id === "ev_sun")!, "해 문양, 나중에");
      setBody(events.find((event) => event.id === "ev_moon")!, "달 문양, 먼저");
      const checked = eventCommandChanges(before, after, mapId, "ev_moon");
      expect(checked.ok).toBe(true);
      if (!checked.ok) return;
      expect(checked.changes.map((change) => change.eventId)).toEqual(["ev_moon", "ev_sun"]);
      const moonPages = before.maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages!;
      const line = editStepSummary(checked.changes, moonPages, undefined, "ev_moon", (id) => id === "ev_sun" ? "해 손잡이" : id);
      expect(line).toContain("이벤트 2개");
      expect(line).toContain("해 손잡이");
    });

    it("다른 이벤트의 조건·다른 맵·이벤트 더하기는 통째로 거절한다", () => {
      const { project: before, mapId } = puzzle();
      const cond = structuredClone(before);
      cond.maps[mapId]!.events.find((event) => event.id === "ev_sun")!.pages![0]!.name = "바뀐 이름";
      expect(eventCommandChanges(before, cond, mapId, "ev_moon").ok).toBe(false);
      const added = structuredClone(before);
      added.maps[mapId]!.events.push(lever("ev_new", "새 손잡이", "sw_sun", "새"));
      expect(eventCommandChanges(before, added, mapId, "ev_moon").ok).toBe(false);
      const otherMap = structuredClone(before);
      const otherMapId = Object.keys(otherMap.maps).find((id) => id !== mapId);
      if (otherMapId) {
        otherMap.maps[otherMapId]!.name = "바뀐 맵";
        expect(eventCommandChanges(before, otherMap, mapId, "ev_moon").ok).toBe(false);
      }
    });

    it("연 이벤트만 Ctrl+Z 로 되돌리면 같은 단계의 다른 이벤트도 되돌려 한 단계로 지킨다", () => {
      const { project, mapId } = puzzle();
      const events = project.maps[mapId]!.events;
      const sun = events.find((event) => event.id === "ev_sun")!;
      const moon = events.find((event) => event.id === "ev_moon")!;
      const sunBefore = structuredClone(sun.pages![0]!.commands);
      const moonBefore = structuredClone(moon.pages![0]!.commands);
      setBody(sun, "해 문양, 나중에");
      const sunAfter = structuredClone(sun.pages![0]!.commands);
      const moonAfter = moonBefore.map((command, index) => index === 0 ? narrate("달 문양, 먼저") : command);
      store.replace(project); // 달은 이미 Ctrl+Z 로 되돌아갔고(before), 해는 아직 after 다.
      const state: { steps: EditStep[] } = { steps: [{ summary: "정답 바꿈", changes: [
        { eventId: "ev_moon", pageId: "ev_moon_p1", before: moonBefore, after: moonAfter },
        { eventId: "ev_sun", pageId: "ev_sun_p1", before: sunBefore, after: sunAfter },
      ] }] };
      const undone: string[] = [];
      pruneUndoneSteps(state, mapId, (eventId, pageId) => undone.push(`${eventId}:${pageId}`));
      expect(state.steps).toHaveLength(0);
      expect(undone).toEqual(["ev_sun:ev_sun_p1"]);
    });
  });
});
