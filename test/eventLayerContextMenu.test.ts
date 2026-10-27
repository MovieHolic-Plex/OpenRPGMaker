import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setStartMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import {
  clearEventLayerClipboard,
  eventLayerContextMenuItems,
  type EventLayerContextMenuTarget,
} from "@/editor/panels/eventLayerContextMenu";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { toast } from "@/util/toast";

vi.mock("@/editor/panels/eventEditor/modal", () => ({
  openEventEditorModal: vi.fn(),
  openNewEventEditorModal: vi.fn(() => "event-new"),
}));

vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

describe("event layer context menu", () => {
  let target: EventLayerContextMenuTarget;

  beforeEach(() => {
    const project = createBlankProject();
    store.replace(project);
    target = { mapId: project.startMapId, x: 4, y: 5 };
  });

  afterEach(() => {
    clearEventLayerClipboard();
    vi.clearAllMocks();
  });

  it("offers the RPG Maker event-layer commands when right-clicking a tile", () => {
    const items = eventLayerContextMenuItems(target);

    expect(items.map((item) => item.label)).toEqual([
      // 2026-09-28: 빈 칸의 AI 는 편집기 대신 칸 옆 입력창 → 작업함(eventAiQueue). 맨 위, 단축키 A.
      "AI로 여기에 이벤트...",
      "이벤트 생성...",
      "잘라내기",
      "복사",
      "붙여넣기",
      "삭제",
      "장소 이동 이벤트 생성...",
      "주인공 시작 위치 설정",
      "탈것 시작 위치 설정...",
      "여기서 테스트",
      "이 이벤트 테스트",
    ]);
    expect(items.find((item) => item.id === "test-here")?.testId).toBe("event-layer-test-here");
    expect(items.find((item) => item.id === "test-event")?.testId).toBe("event-layer-test-event");
    expect(items.find((item) => item.id === "create-event")?.testId).toBe("event-layer-create-event");
    expect(items.find((item) => item.id === "event-ai-queue")?.testId).toBe("event-layer-event-ai-queue");
    expect(items.find((item) => item.id === "event-ai-queue")?.shortcut).toBe("A");
    // 빈 칸에는 「고치기」가 없다 — 고칠 이벤트가 없다.
    expect(items.some((item) => item.id === "event-ai-author")).toBe(false);
    expect(items.find((item) => item.id === "cut")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "paste")?.disabled).toBe(true);
    // 빈 칸에는 테스트할 이벤트가 없다 — 항목은 보이되 눌리지 않는다(2026-09-03 톱바 「이벤트 테스트」 후계).
    expect(items.find((item) => item.id === "test-event")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "vehicle-start")?.disabled).toBeUndefined();
  });

  it("「이 이벤트 테스트」는 이벤트 칸에서만 살고 선택 이벤트 테스트 창을 요청한다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const event: GameEvent = {
      id: "event-under-cursor",
      x: target.x,
      y: target.y,
      trigger: { kind: "action" },
      commands: [{ kind: "text", body: "hi" }],
      pages: [],
    };
    store.update((draft) => {
      draft.maps[mapId]!.events.push(event);
    });
    // node 환경에는 window 가 없다 — 테스트 창 요청은 window 이벤트라 EventTarget 하나를 세워 받는다.
    const requests: unknown[] = [];
    const fakeWindow = new EventTarget();
    fakeWindow.addEventListener("oprn:test-play-window", (raw) => {
      requests.push((raw as CustomEvent).detail);
    });
    vi.stubGlobal("window", fakeWindow);
    try {
      const item = eventLayerContextMenuItems(target).find((candidate) => candidate.id === "test-event");
      expect(item?.disabled).toBe(false);
      item?.action();
      expect(requests).toEqual([{ kind: "selected-event", mapId, eventId: "event-under-cursor" }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sets the current tile as the player starting position", () => {
    setStartMap("missing-map");

    const startItem = eventLayerContextMenuItems(target).find((item) => item.id === "player-start");
    startItem?.action();

    const project = store.getCurrent();
    expect(project.startMapId).toBe(target.mapId);
    expect(project.startPos).toEqual({ x: target.x, y: target.y });
  });

  it("copies, pastes, and deletes events from the clicked event tile", () => {
    const event: GameEvent = {
      id: "event-source",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "text", body: "copied" }],
      pages: [{
        id: "page-source",
        name: "Source",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "page copied" }],
      }],
    };
    store.update((project) => {
      project.maps[target.mapId]?.events.push(event);
    });

    const sourceTarget = { ...target, x: 1, y: 1 };
    const sourceItems = eventLayerContextMenuItems(sourceTarget);
    expect(sourceItems.find((item) => item.id === "copy")?.disabled).toBe(false);
    sourceItems.find((item) => item.id === "copy")?.action();

    const pasteItems = eventLayerContextMenuItems(target);
    expect(pasteItems.find((item) => item.id === "paste")?.disabled).toBe(false);
    pasteItems.find((item) => item.id === "paste")?.action();

    const pasted = store.getCurrent().maps[target.mapId].events.find((item) => item.x === target.x && item.y === target.y);
    expect(pasted?.id).not.toBe(event.id);
    expect(pasted?.pages?.[0]?.id).not.toBe(event.pages?.[0]?.id);
    expect(pasted?.pages?.[0]?.commands).toEqual(event.pages?.[0]?.commands);

    eventLayerContextMenuItems(sourceTarget).find((item) => item.id === "delete")?.action();
    expect(store.getCurrent().maps[target.mapId].events.some((item) => item.id === event.id)).toBe(false);
  });

  it("refuses to paste an event onto a cell another event already covers", () => {
    resetMapEditHistory();
    const source = sampleEvent("event-source", 1, 1);
    const occupant = sampleEvent("event-occupant", target.x, target.y);
    store.update((project) => {
      project.maps[target.mapId]?.events.push(source, occupant);
    });
    editorState.set({ selectedEventId: source.id });
    eventLayerContextMenuItems({ ...target, x: 1, y: 1 }).find((item) => item.id === "copy")?.action();

    eventLayerContextMenuItems(target).find((item) => item.id === "paste")?.action();

    const events = store.getCurrent().maps[target.mapId].events;
    expect(events.map((item) => item.id)).toEqual([source.id, occupant.id]);
    expect(editorState.get().selectedEventId).toBe(source.id);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith("이미 다른 이벤트가 있는 칸입니다.", "error");
  });

  it("refuses to paste onto the non-anchor cell of a taller event", () => {
    resetMapEditHistory();
    const source = sampleEvent("event-source", 1, 1);
    const tall = sampleEvent("event-tall", target.x, target.y + 1, { width: 1, height: 2 });
    store.update((project) => {
      project.maps[target.mapId]?.events.push(source, tall);
    });
    eventLayerContextMenuItems({ ...target, x: 1, y: 1 }).find((item) => item.id === "copy")?.action();

    eventLayerContextMenuItems(target).find((item) => item.id === "paste")?.action();

    expect(store.getCurrent().maps[target.mapId].events.map((item) => item.id)).toEqual([source.id, tall.id]);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("refuses a wide paste whose body would cover a neighbor, and still pastes when the body is clear", () => {
    resetMapEditHistory();
    const source = sampleEvent("event-wide", 1, 1, { width: 3, height: 1 });
    const neighbor = sampleEvent("event-neighbor", target.x + 1, target.y);
    store.update((project) => {
      project.maps[target.mapId]?.events.push(source, neighbor);
    });
    eventLayerContextMenuItems({ ...target, x: 1, y: 1 }).find((item) => item.id === "copy")?.action();

    eventLayerContextMenuItems(target).find((item) => item.id === "paste")?.action();
    expect(store.getCurrent().maps[target.mapId].events.map((item) => item.id)).toEqual([source.id, neighbor.id]);

    const clearTarget = { ...target, x: target.x, y: target.y + 3 };
    eventLayerContextMenuItems(clearTarget).find((item) => item.id === "paste")?.action();
    const pasted = store.getCurrent().maps[target.mapId].events.find((item) => item.x === clearTarget.x && item.y === clearTarget.y);
    expect(pasted?.id).not.toBe(source.id);
    expect(pasted?.pages?.[0]?.footprint).toEqual({ width: 3, height: 1 });
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });

  it("cuts an event in one undo step and keeps it on the clipboard", () => {
    resetMapEditHistory();
    const source = sampleEvent("event-cut", 1, 1);
    store.update((project) => {
      project.maps[target.mapId]?.events.push(source);
    });
    const sourceTarget = { ...target, x: 1, y: 1 };

    eventLayerContextMenuItems(sourceTarget).find((item) => item.id === "cut")?.action();

    expect(store.getCurrent().maps[target.mapId].events.map((item) => item.id)).toEqual([]);
    expect(eventLayerContextMenuItems(target).find((item) => item.id === "paste")?.disabled).toBe(false);
    expect(getMapEditHistoryEntries()).toEqual([
      expect.objectContaining({ label: "이벤트 삭제: event-cut", steps: 1 }),
    ]);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[target.mapId].events.map((item) => item.id)).toEqual(["event-cut"]);
    expect(getMapEditHistoryEntries()).toHaveLength(0);

    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[target.mapId].events.map((item) => item.id)).toEqual([]);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });

  it("does not create a second event on a cell that is already covered", () => {
    const occupant = sampleEvent("event-occupant", target.x, target.y + 1, { width: 1, height: 2 });
    store.update((project) => {
      project.maps[target.mapId]?.events.push(occupant);
    });
    const items = eventLayerContextMenuItems(target);

    items.find((item) => item.id === "create-event")?.action();
    items.find((item) => item.id === "create-transfer-event")?.action();
    items.find((item) => item.id === "vehicle-start")?.action();

    expect(openNewEventEditorModal).not.toHaveBeenCalled();
    expect(store.getCurrent().maps[target.mapId].events.map((item) => item.id)).toEqual([occupant.id]);
  });
});

function sampleEvent(id: string, x: number, y: number, footprint?: { width: number; height: number }): GameEvent {
  const page: EventPage = {
    id: `${id}-page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: id }],
    ...(footprint ? { footprint } : {}),
  };
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}
