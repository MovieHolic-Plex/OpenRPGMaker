import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditor, syncMountedEventSelection } from "@/editor/panels/eventEditor";
import { requestEditorCameraFocus, subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("eventListCameraFocus", () => {
  isolateTimers();
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
});

describe("eventListSelectionSync", () => {
  isolateTimers();
  let restoreFakeDom: () => void = () => undefined;
  function page(id: string): EventPage {
    return {
      id,
      name: "EV001",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function event(id: string, name: string, x: number): GameEvent {
    return { id, name, x, y: 2, trigger: { kind: "action" }, commands: [], pages: [page(`${id}-page`)] };
  }
  describe("event list selection stays in place", () => {
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      restoreFakeDom = installFakeDom();
      const project = createBlankProject();
      project.maps[project.startMapId].events = [
        event("event-1", "문지기", 1),
        event("event-2", "상인", 4),
        event("event-3", "아이", 8),
      ];
      store.replace(project);
      editorState.set({
        currentMapId: project.startMapId,
        layer: "event",
        tool: "event",
        selectedEventId: "event-1",
        selectedEventPageId: "event-1-page",
        pendingEventCoordinate: null,
      });
    });

    afterEach(() => {
      document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
      _resetEventDraftVaultForTest();
      restoreFakeDom();
    });

    it("moves the highlight and summary without rebuilding rows or resetting scroll", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      const rows = sidebar.querySelector<HTMLElement>(".event-list-rows")!;
      const kept = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-3"]')!;
      rows.scrollTop = 180;

      editorState.set({ selectedEventId: "event-3", selectedEventPageId: "event-3-page" });
      expect(syncMountedEventSelection()).toBe(true);

      expect(sidebar.querySelector('[data-testid="event-list-row-event-3"]')).toBe(kept);
      expect(rows.scrollTop).toBe(180);
      expect(sidebar.querySelector('[data-testid="event-list-row-event-1"]')?.classList.contains("active")).toBe(false);
      expect(kept.classList.contains("active")).toBe(true);
      expect(sidebar.querySelector(".event-editor-launch-title")?.textContent).toBe("아이");
      expect(sidebar.querySelector<HTMLElement>('[data-testid="event-editor-launch"]')?.dataset.eventId).toBe("event-3");
    });

    it("keeps the same summary when only the page id changes", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      const launch = sidebar.querySelector('[data-testid="event-editor-launch"]');
      editorState.set({ selectedEventPageId: "event-1-page" });
      expect(syncMountedEventSelection()).toBe(true);
      expect(sidebar.querySelector('[data-testid="event-editor-launch"]')).toBe(launch);
    });

    it("clears the highlight when the selection is dropped", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      editorState.set({ selectedEventId: null, selectedEventPageId: null });
      expect(syncMountedEventSelection()).toBe(true);
      const rows = [...sidebar.querySelectorAll<HTMLElement>(".event-list-row")];
      expect(rows.length).toBe(3);
      expect(rows.every((row) => !row.classList.contains("active"))).toBe(true);
      expect(sidebar.querySelector('[data-testid="event-editor-launch"]')).toBeNull();
    });

    it("leaves the mounted list alone when the selected event is not in it", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      const row = sidebar.querySelector('[data-testid="event-list-row-event-1"]');
      editorState.set({ selectedEventId: "missing" });
      expect(syncMountedEventSelection()).toBe(false);
      expect(sidebar.querySelector('[data-testid="event-list-row-event-1"]')).toBe(row);
      expect(row?.classList.contains("active")).toBe(true);
    });
  });
});
