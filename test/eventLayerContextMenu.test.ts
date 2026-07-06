import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setStartMap } from "@/editor/actions";
import {
  clearEventLayerClipboard,
  eventLayerContextMenuItems,
  type EventLayerContextMenuTarget,
} from "@/editor/panels/eventLayerContextMenu";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

vi.mock("@/editor/panels/eventEditor/modal", () => ({
  openEventEditorModal: vi.fn(),
  openNewEventEditorModal: vi.fn(() => "event-new"),
}));

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
      "이벤트 생성...",
      "잘라내기",
      "복사",
      "붙여넣기",
      "삭제",
      "장소 이동 이벤트 생성...",
      "주인공 시작 위치 설정",
      "탈것 시작 위치 설정...",
      "여기서 테스트",
    ]);
    expect(items.find((item) => item.id === "test-here")?.testId).toBe("event-layer-test-here");
    expect(items.find((item) => item.id === "create-event")?.testId).toBe("event-layer-create-event");
    expect(items.find((item) => item.id === "cut")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "paste")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "vehicle-start")?.disabled).toBeUndefined();
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
});
