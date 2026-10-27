/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DragOperationHandler } from "@/editor/DragOperationHandler";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent, MapId } from "@/project/types";
import { toast } from "@/util/toast";

vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

function sampleEvent(id: string, x: number, y: number, footprint?: { width: number; height: number }): GameEvent {
  const page: EventPage = {
    id: `${id}-page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...(footprint ? { footprint } : {}),
  };
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
}

function handler(mapId: MapId): DragOperationHandler {
  return new DragOperationHandler({} as never, {
    mapId: () => mapId,
    pointerToTile: (ptr) => ({ x: ptr.x, y: ptr.y }),
    hoverPreviewLayer: () => null,
    clearHoverPreview: () => {},
    showEventLayerClickFeedback: () => {},
    setLastPointerTile: () => {},
    setPaintState: () => {},
  });
}

function drag(mapId: MapId, from: { x: number; y: number }, to: { x: number; y: number }): void {
  const dragHandler = handler(mapId);
  dragHandler.maybeBeginEventDragCandidate({ x: from.x, y: from.y } as never);
  expect(dragHandler.tryPromoteEventDrag({ x: to.x, y: to.y } as never)).toBe(true);
  dragHandler.finish({ x: to.x, y: to.y } as never);
}

describe("event drag keeps the grabbed cell and the whole body", () => {
  let mapId: MapId;

  beforeEach(() => {
    const project = createBlankProject();
    store.replace(project);
    mapId = project.startMapId;
    resetMapEditHistory();
    editorState.set({ layer: "event", tool: "event" });
    vi.mocked(toast).mockClear();
  });

  it("moves a 1x1 event onto the drop cell", () => {
    store.update((project) => {
      project.maps[mapId]!.events.push(sampleEvent("one", 4, 5));
    });

    drag(mapId, { x: 4, y: 5 }, { x: 6, y: 7 });

    expect(store.getCurrent().maps[mapId]!.events[0]).toMatchObject({ id: "one", x: 6, y: 7 });
    expect(editorState.get().selectedEventId).toBe("one");
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });

  it("keeps a wide event's grabbed edge under the cursor", () => {
    // width 3 at (10, 10) covers x 9..11. Grabbing the right cell and moving
    // one tile right must shift the anchor by one, not snap it to the cursor.
    store.update((project) => {
      project.maps[mapId]!.events.push(sampleEvent("wide", 10, 10, { width: 3, height: 1 }));
    });

    drag(mapId, { x: 11, y: 10 }, { x: 12, y: 10 });

    expect(store.getCurrent().maps[mapId]!.events[0]).toMatchObject({ id: "wide", x: 11, y: 10 });
  });

  it("refuses a drop whose body would cover a neighbor even when the cursor cell is empty", () => {
    store.update((project) => {
      project.maps[mapId]!.events.push(
        sampleEvent("wide", 10, 10, { width: 3, height: 1 }),
        sampleEvent("neighbor", 13, 10),
      );
    });

    drag(mapId, { x: 10, y: 10 }, { x: 12, y: 10 });

    const events = store.getCurrent().maps[mapId]!.events;
    expect(events.find((event) => event.id === "wide")).toMatchObject({ x: 10, y: 10 });
    expect(events.find((event) => event.id === "neighbor")).toMatchObject({ x: 13, y: 10 });
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith("이미 다른 이벤트가 있는 칸입니다.", "error");
  });

  it("refuses a drop that would push the body outside the map", () => {
    store.update((project) => {
      project.maps[mapId]!.events.push(sampleEvent("wide", 1, 5, { width: 3, height: 1 }));
    });

    drag(mapId, { x: 1, y: 5 }, { x: 0, y: 5 });

    expect(store.getCurrent().maps[mapId]!.events[0]).toMatchObject({ id: "wide", x: 1, y: 5 });
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith("이벤트 몸이 맵 밖으로 나갑니다.", "error");
  });

  it("leaves the event in place when the pointer returns to the grabbed cell", () => {
    store.update((project) => {
      project.maps[mapId]!.events.push(sampleEvent("wide", 10, 10, { width: 3, height: 1 }));
    });
    const dragHandler = handler(mapId);
    dragHandler.maybeBeginEventDragCandidate({ x: 11, y: 10 } as never);
    expect(dragHandler.tryPromoteEventDrag({ x: 12, y: 10 } as never)).toBe(true);
    dragHandler.finish({ x: 11, y: 10 } as never);

    expect(store.getCurrent().maps[mapId]!.events[0]).toMatchObject({ x: 10, y: 10 });
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(toast).not.toHaveBeenCalled();
  });
});
