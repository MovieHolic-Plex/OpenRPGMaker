// @vitest-environment happy-dom
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
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { renderClassicPageTabStrip, renderPageActions } from "@/editor/panels/eventEditor/pageProps";
import { openPageTabContextMenu } from "@/editor/panels/eventEditor/pageTabContextMenu";
import { modalStackEntryCountForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { addEventPage, clearCopiedEventPage, copyEventPageToClipboard } from "@/editor/eventPages";
import { addEvent } from "@/editor/eventActions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent, MapId } from "@/project/types";

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
    // 접힘 없음: details/summary 가 아니라 평평한 줄이다.
    expect(host.querySelector("details")).toBeNull();
    expect(host.querySelector("summary")).toBeNull();
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

  it("거부된 경계 이동은 성공 토스트를 만들지 않는다", () => {
    const host = actions();
    const target = button(host, "event-page-move-back");
    target.disabled = false;
    target.click();
    expect(document.querySelector('[data-testid="toast"]')).toBeNull();
  });
});
