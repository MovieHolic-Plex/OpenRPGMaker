import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditor, syncMountedEventSelection } from "@/editor/panels/eventEditor";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

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
    const list = sidebar.querySelector<HTMLElement>('[data-testid="event-list"]')!;
    const kept = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-3"]')!;
    list.scrollTop = 180;

    editorState.set({ selectedEventId: "event-3", selectedEventPageId: "event-3-page" });
    expect(syncMountedEventSelection()).toBe(true);

    expect(sidebar.querySelector('[data-testid="event-list-row-event-3"]')).toBe(kept);
    expect(list.scrollTop).toBe(180);
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
