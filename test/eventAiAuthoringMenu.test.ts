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

describe("AI 도크 열림 예약", () => {
  beforeEach(() => {
    resetEventAiStagedForTest();
    clearCommandInspector();
    vi.clearAllMocks();
  });

  /**
   * 재렌더를 **새 호스트**에 그린다. `renderEventEditorDynamic` 은 자기를 담은 컨테이너에
   * append 만 하므로, 같은 호스트에 두 번 그리면 `querySelector` 가 **옛 도크**를 돌려주고
   * 새 도크가 잘못 태어나도 테스트가 통과한다. 매 렌더마다 빈 호스트를 써서 "이번에 그려진
   * 도크"만 본다.
   */
  function renderFresh(mapId: string, eventId: string): { host: HTMLElement; dock: HTMLDetailsElement | null } {
    const host = document.createElement("div");
    document.body.append(host);
    renderEventEditorDynamic(host, mapId, eventId);
    return { host, dock: host.querySelector<HTMLDetailsElement>('[data-testid="ai-event-assist"]') };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("예약이 있으면 도크가 펼쳐진 채로 태어나고, 다음 재렌더에서는 다시 펼치지 않는다", async () => {
    const { mapId } = seedProject(true);
    const { requestEventAiDockOpen } = await import("@/editor/panels/eventEditor/aiDockOpenRequest");
    // 편집기 첫 렌더 **전** 예약 — modal.ts 의 순서와 같다.
    requestEventAiDockOpen(mapId, EXISTING_ID);
    const first = renderFresh(mapId, EXISTING_ID);
    expect(first.dock?.open).toBe(true);

    // 사용자가 접었다고 치자. 그 뒤 재렌더가 도로 펼치면 예약이 샌 것이다.
    if (first.dock) first.dock.open = false;
    const second = renderFresh(mapId, EXISTING_ID);
    expect(second.dock?.open).toBe(false);
    // 이번 렌더가 정말 새 도크인지 확인한다 — 같으면 위 단언은 옛 DOM 을 본 것이다.
    expect(second.dock).not.toBe(first.dock);
  });

  it("예약 없이 열면 도크는 닫힌 채로 태어난다 — 기본 동작은 그대로다", async () => {
    const { mapId } = seedProject(true);
    const { dock } = renderFresh(mapId, EXISTING_ID);
    expect(dock).not.toBeNull();
    expect(dock?.open).toBe(false);
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

  it("편집기가 도크를 그리기 전에 닫히면 예약은 폐기된다 — 나중에 저절로 펼쳐지지 않는다", async () => {
    const { mapId } = seedProject(true);
    const { clearEventAiDockOpenRequest, pendingEventAiDockOpenCountForTest, requestEventAiDockOpen } = await import(
      "@/editor/panels/eventEditor/aiDockOpenRequest"
    );
    // 본문 렌더가 던져 도크가 태어나지 못한 상황을 흉내낸다: 예약만 남고 소비자가 없다.
    requestEventAiDockOpen(mapId, EXISTING_ID);
    expect(pendingEventAiDockOpenCountForTest()).toBe(1);

    // modal.ts 의 closeHandler 가 하는 일.
    clearEventAiDockOpenRequest(mapId, EXISTING_ID);
    expect(pendingEventAiDockOpenCountForTest()).toBe(0);

    const { dock } = renderFresh(mapId, EXISTING_ID);
    expect(dock?.open).toBe(false);
  });

  it("이미 그 이벤트를 편집 중이면 예약을 남기지 않고 지금 도크를 펼친다", async () => {
    const { mapId } = seedProject(true);
    const { focusEventAiDockInOpenEditor, resetEventAiStagedForTest } = await import(
      "@/editor/panels/eventEditor/aiAssist"
    );
    const { pendingEventAiDockOpenCountForTest } = await import("@/editor/panels/eventEditor/aiDockOpenRequest");
    const { host, dock } = renderFresh(mapId, EXISTING_ID);
    expect(dock?.open).toBe(false);

    expect(focusEventAiDockInOpenEditor()).toBe(true);
    expect(dock?.open).toBe(true);
    // 예약을 남기지 않는다 — 남기면 다음 재렌더까지 떠돌다 다른 열기에 샌다.
    expect(pendingEventAiDockOpenCountForTest()).toBe(0);

    // 재렌더가 펼침을 유지한다(state.open 을 함께 세운 근거). 새 호스트로 그린다.
    const again = renderFresh(mapId, EXISTING_ID);
    expect(again.dock?.open).toBe(true);
    resetEventAiStagedForTest();
    void host;
  });

  // 적대적 리뷰가 재현한 결함: 전역 `selectedEventPageId` 로 도크 키를 재구성하면, 다른
  // 이벤트의 페이지가 선택돼 있을 때(A 를 최소화한 채 B 를 복사한 뒤 A 로 돌아옴) 엉뚱한 키를
  // 만져 아무 일도 일어나지 않는다. 도크가 자기 키를 스스로 아는지 확인한다.
  it("다른 이벤트의 페이지가 선택돼 있어도 이 도크는 자기 페이지로 열린다", async () => {
    const { mapId } = seedProject(true);
    const { focusEventAiDockInOpenEditor, resetEventAiStagedForTest } = await import(
      "@/editor/panels/eventEditor/aiAssist"
    );
    const { dock } = renderFresh(mapId, EXISTING_ID);
    expect(dock?.open).toBe(false);

    // 다른 이벤트의 페이지가 선택된 상태를 흉내낸다.
    editorState.set({ selectedEventId: "ev_someone_else", selectedEventPageId: "page_of_other_event" });

    expect(focusEventAiDockInOpenEditor()).toBe(true);
    expect(dock?.open).toBe(true);
    resetEventAiStagedForTest();
  });
});
