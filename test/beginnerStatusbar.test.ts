import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderEditorStatusbar } from "@/editor/panels/editorStatusbar";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

function testIds(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll<HTMLElement>("[data-testid]"))
    .map((node) => node.dataset.testid ?? "")
    .filter(Boolean);
}

describe("beginner statusbar density", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      layer: "event",
      tool: "event",
      showLayoutBboxes: true,
    });
    resetEditorUiModeForTests("beginner");
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    resetEditorUiModeForTests("standard");
  });

  it("keeps layer, map, and save — hides tool, zoom, blueprint, and ready AI", () => {
    const host = document.createElement("div");
    renderEditorStatusbar(host);
    expect(host.textContent).toContain("이벤트 레이어");
    expect(host.textContent).toMatch(/맵:/);
    expect(host.querySelector("[data-testid='paint-hint-switch']")?.textContent).toContain("타일 칠하려면");
    expect(host.querySelector("[data-testid='toggle-layout-bboxes']")).toBeNull();
    expect(host.textContent).not.toContain("줌:");
    expect(host.textContent).not.toMatch(/^펜$|펜/);
    const ids = testIds(host);
    expect(ids).not.toContain("ai-connection-status");
  });

  it("shows the blueprint toggle only when the current map has regions", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("blank project missing start map");
    store.replace({
      ...project,
      maps: {
        ...project.maps,
        [mapId]: {
          ...map,
          layoutPlan: {
            version: 1,
            kind: "test-plan",
            regions: [{ id: "plaza-1", role: "plaza", label: "광장", x: 0, y: 0, w: 3, h: 3 }],
          },
        },
      },
    });
    const host = document.createElement("div");
    renderEditorStatusbar(host);
    const toggle = host.querySelector("[data-testid='toggle-layout-bboxes']");
    expect(toggle?.textContent).toMatch(/설계도/);
    expect(toggle?.getAttribute("title") ?? "").not.toContain("layoutPlan");
    expect(toggle?.getAttribute("title") ?? "").not.toContain("P/M/H");
  });

  it("keeps layer, map, and save in standard mode — extras stay in overflow", () => {
    resetEditorUiModeForTests("standard");
    const host = document.createElement("div");
    renderEditorStatusbar(host);
    expect(host.textContent).toMatch(/맵:/);
    expect(host.querySelector("[data-testid='statusbar-overflow']")?.textContent).toContain("줌:");
    expect(host.querySelector("[data-testid='ai-connection-status']")).toBeNull();
  });
});
