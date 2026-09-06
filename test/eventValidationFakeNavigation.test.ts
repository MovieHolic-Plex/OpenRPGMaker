import { expect, it, vi } from "vitest";
import { installFakeDom } from "./fakeDom";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { navigateToEventCommand } from "@/editor/panels/eventEditor/content";
import { navigateToEventDraftIssue } from "@/editor/panels/eventEditor/validationBell";
import { selectedCommandPath } from "@/editor/panels/eventEditor/commandInspector";

it("uses the shared navigation contract in the lightweight rendered host", () => {
  const restore = installFakeDom();
  const errors = vi.spyOn(console, "error");
  try {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("Missing map");
    map.events = [{ id: "fake-nav", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "p1", name: "page", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: "missing-map", x: 0, y: 0 }],
    }] }];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "fake-nav", selectedEventPageId: "p1" });
    openEventEditorModal(mapId, "fake-nav");
    expect(errors.mock.calls).toEqual([]);
    expect(document.querySelector('[data-testid="event-editor-modal"]')?.isConnected).toBe(true);
    expect(document.querySelectorAll("[data-cmd-path]").length).toBeGreaterThan(0);
    expect(navigateToEventCommand(mapId, "fake-nav", "p1", [0])).toBe(true);
    expect(selectedCommandPath()).toEqual([0]);
    navigateToEventDraftIssue({ pageId: "p1", commandPath: [0], code: "reference.map.missing", severity: "error", message: "" });
    expect(document.querySelector('[data-testid="event-command-transfer"]')?.className).toContain("selected");
  } finally {
    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
    errors.mockRestore();
    restore();
  }
});
