/** @vitest-environment happy-dom */
// 우클릭 「AI 로 이벤트 만들기 / 이 이벤트를 AI 로 고치기」 계약.
//
// 이 기능의 위험은 "메뉴 항목이 있나"가 아니라 **도크가 정말 펼쳐진 채로 태어나나**다.
// 편집기는 store 갱신 한 번에 본문을 통째로 다시 그리므로, 렌더 뒤에 DOM 을 켜는 구현은
// 첫 재렌더에서 조용히 닫힌 칩으로 되돌아간다(그래서 예약을 렌더 전에 남긴다).
// 아래 테스트는 그 재렌더를 실제로 한 번 더 태워서 확인한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEventAiStagedForTest } from "@/editor/panels/eventEditor/aiAssist";
import { resetEventEditLineForTest } from "@/editor/panels/eventEditor/eventEditLine";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { eventLayerContextMenuItems } from "@/editor/panels/eventLayerContextMenu";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

// 편집기 모달은 무겁다(피커 자산·포커스 트랩). 여기서 보는 계약은 "어느 이벤트를 어떤
// 옵션으로 여는가"이므로 모달을 스텁하고 호출만 기록한다.
vi.mock("@/editor/panels/eventEditor/modal", () => ({
  openEventEditorModal: vi.fn(),
  openNewEventEditorModal: vi.fn(() => "event-new"),
}));

const modal = await import("@/editor/panels/eventEditor/modal");
const openNew = vi.mocked(modal.openNewEventEditorModal);
const openExisting = vi.mocked(modal.openEventEditorModal);

const EXISTING_ID = "ev_ai_author";

function seedProject(withEvent: boolean): { mapId: string; x: number; y: number } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  if (withEvent) {
    const event: GameEvent = {
      id: EXISTING_ID,
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p1",
        name: "상인",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "어서 오세요." }],
      }],
    };
    project.maps[mapId]!.events = [event];
  }
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
  return { mapId, x: withEvent ? 4 : 9, y: withEvent ? 5 : 9 };
}

describe("AI 이벤트 저작 우클릭 진입점", () => {
  beforeEach(() => {
    resetEventAiStagedForTest();
    clearCommandInspector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("빈 칸에서는 편집기를 열지 않고 칸 옆 작업함 입력창으로 간다", () => {
    const target = seedProject(false);
    const item = eventLayerContextMenuItems(target).find((candidate) => candidate.id === "event-ai-queue");

    expect(item?.label).toBe("AI로 여기에 이벤트...");
    item?.action();

    expect(openNew).not.toHaveBeenCalled();
    expect(openExisting).not.toHaveBeenCalled();
  });

  it("이벤트 칸에서는 그 이벤트를 고치도록 열고, 새로 만들지 않는다", () => {
    const target = seedProject(true);
    const item = eventLayerContextMenuItems(target).find((candidate) => candidate.id === "event-ai-author");

    expect(item?.label).toBe("이 이벤트를 AI 로 고치기...");
    item?.action();

    expect(openExisting).toHaveBeenCalledTimes(1);
    expect(openExisting.mock.calls[0]?.[1]).toBe(EXISTING_ID);
    expect(openExisting.mock.calls[0]?.[2]).toEqual({ aiDock: true });
    expect(openNew).not.toHaveBeenCalled();
  });

  it("빈 칸의 AI 항목은 맨 위다 — 여러 칸을 연달아 부탁할 때 가장 자주 누른다", () => {
    const target = seedProject(false);
    const ids = eventLayerContextMenuItems(target).map((item) => item.id);
    expect(ids.slice(0, 2)).toEqual(["event-ai-queue", "create-event"]);
  });

  it("이벤트가 있어도 AI 항목은 비활성이 아니다 — 고치기가 곧 이 항목의 일이다", () => {
    const target = seedProject(true);
    const item = eventLayerContextMenuItems(target).find((candidate) => candidate.id === "event-ai-author");
    expect(item?.disabled).toBeUndefined();
  });
});

describe("조수 입구 예약 — 한 줄 입력칸", () => {
  // 조수 창(도크)은 없다(목업 v2). 우클릭 「AI 로 이벤트 …」로 들어오면 맨 아래 한 줄 입력칸이 초점을 받는다.
  beforeEach(() => {
    resetEventAiStagedForTest();
    resetEventEditLineForTest();
    clearCommandInspector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  function renderFresh(mapId: string, eventId: string): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    renderEventEditorDynamic(host, mapId, eventId);
    return host;
  }

  it("예약이 있으면 한 줄 입력칸이 초점을 받고, 다음 재렌더에서는 다시 뺏지 않는다", async () => {
    const { mapId } = seedProject(true);
    const { requestEventAiDockOpen } = await import("@/editor/panels/eventEditor/aiDockOpenRequest");
    requestEventAiDockOpen(mapId, EXISTING_ID);
    const first = renderFresh(mapId, EXISTING_ID);
    await Promise.resolve();
    expect(document.activeElement).toBe(first.querySelector('[data-testid="event-edit-line-input"]'));

    (document.activeElement as HTMLElement | null)?.blur();
    const second = renderFresh(mapId, EXISTING_ID);
    await Promise.resolve();
    expect(document.activeElement).not.toBe(second.querySelector('[data-testid="event-edit-line-input"]'));
  });

  it("조수 창(도크)은 그리지 않는다 — 입구는 한 줄 입력칸 하나다", () => {
    const { mapId } = seedProject(true);
    const host = renderFresh(mapId, EXISTING_ID);
    expect(host.querySelector('[data-testid="ai-event-assist"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-command-quick-ai"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-edit-line-input"]')).not.toBeNull();
  });

  it("예약은 소비되면 사라진다 — 나중에 다른 이벤트로 새지 않는다", async () => {
    const { mapId } = seedProject(true);
    const { pendingEventAiDockOpenCountForTest, requestEventAiDockOpen } = await import(
      "@/editor/panels/eventEditor/aiDockOpenRequest"
    );
    requestEventAiDockOpen(mapId, EXISTING_ID);
    expect(pendingEventAiDockOpenCountForTest()).toBe(1);
    renderFresh(mapId, EXISTING_ID);
    expect(pendingEventAiDockOpenCountForTest()).toBe(0);
  });

  it("이미 그 이벤트를 편집 중이면 예약 없이 지금 입력칸으로 초점을 준다", async () => {
    const { mapId } = seedProject(true);
    const { focusEventEditLine } = await import("@/editor/panels/eventEditor/eventEditLine");
    const { pendingEventAiDockOpenCountForTest } = await import("@/editor/panels/eventEditor/aiDockOpenRequest");
    const host = renderFresh(mapId, EXISTING_ID);
    expect(focusEventEditLine()).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('[data-testid="event-edit-line-input"]'));
    expect(pendingEventAiDockOpenCountForTest()).toBe(0);
  });
});
