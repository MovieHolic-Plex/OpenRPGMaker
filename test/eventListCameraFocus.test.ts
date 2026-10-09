import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import {
  requestEditorCameraFocus,
  subscribeEditorCameraFocus,
  type CameraFocusTarget,
} from "@/editor/editorCameraFocus";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreFakeDom: () => void = () => undefined;

function fakeContainer(): HTMLElement {
  return new FakeElement("div") as unknown as HTMLElement;
}

function page(): EventPage {
  return {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function event(): GameEvent {
  return { id: "event-1", x: 7, y: 4, trigger: { kind: "action" }, commands: [], pages: [page()] };
}

describe("event list → editor camera focus", () => {
  beforeEach(() => {
    _resetEventDraftVaultForTest();
    restoreFakeDom = installFakeDom();
    const project = createBlankProject();
    project.maps[project.startMapId].events = [event()];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  });

  afterEach(() => {
    document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
    _resetEventDraftVaultForTest();
    restoreFakeDom();
  });

  it("pub/sub delivers focus target to subscribers", () => {
    const received: CameraFocusTarget[] = [];
    const unsub = subscribeEditorCameraFocus((target) => received.push(target));
    requestEditorCameraFocus({ mapId: "m1", tileX: 3, tileY: 5 });
    unsub();
    // After unsubscribe, further requests must not arrive.
    requestEditorCameraFocus({ mapId: "m1", tileX: 1, tileY: 1 });
    expect(received).toEqual([{ mapId: "m1", tileX: 3, tileY: 5 }]);
  });

  it("clicking a map-event list row requests camera focus on that event tile", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;

    const received: CameraFocusTarget[] = [];
    const unsub = subscribeEditorCameraFocus((target) => received.push(target));

    const sidebar = fakeContainer();
    renderEventEditor(sidebar);

    const row = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-1"]');
    expect(row).not.toBeNull();
    row?.click();

    unsub();

    // Selection (existing behavior) still updates editorState.
    expect(editorState.get().selectedEventId).toBe("event-1");
    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");

    // New behavior: exactly one focus request at the event's tile on this map.
    expect(received).toEqual([{ mapId, tileX: 7, tileY: 4 }]);
  });
});
