/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";

describe("event editor settings column layout", () => {
  let host: HTMLElement;

  beforeEach(() => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.events = [
      {
        id: "ev_layout",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "경비병",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      },
    ];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
  });

  it("keeps page tabs and settings-main as the only two direct settings-column children", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_layout");
    const column = host.querySelector(".event-editor-settings-column");
    expect(column).toBeTruthy();
    const direct = [...(column?.children ?? [])] as HTMLElement[];
    expect(direct).toHaveLength(2);
    expect(direct[0]?.classList.contains("event-page-number-tabs")).toBe(true);
    expect(direct[1]?.classList.contains("event-editor-settings-main")).toBe(true);
    // schedule must live inside main, not as a 54px-wide third grid cell
    expect(direct[1]?.querySelector("[data-testid='event-schedule-section']")).toBeTruthy();
    expect(direct[1]?.querySelector(".event-page-props")).toBeTruthy();
  });
});
