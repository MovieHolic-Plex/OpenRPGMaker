import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  openCanvasInspectionPanel,
  type CanvasInspectionDeps,
} from "@/editor/panels/canvasInspectionPanel";
import { createBlankProject } from "@/project/defaults";
import { findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  document.querySelector('[data-testid="canvas-inspection-panel"]')?.remove();
  restoreDom?.();
  restoreDom = null;
});

describe("canvas inspection panel", () => {
  it("shows deterministic lint counts and can focus a located issue", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const focusIssue = vi.fn();
    const deps: CanvasInspectionDeps = {
      focusIssue,
      lint: () => [
        { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
        { code: "map-size", mapId, message: "맵이 너무 큽니다.", severity: "warning" },
      ],
      openRegionTask: vi.fn(),
    };

    const panel = openCanvasInspectionPanel({ deps, mapId, project });

    expect(findByTestId(panel, "canvas-inspection-summary")?.textContent).toContain("문제 2개");
    expect(panel.querySelectorAll('[data-testid="canvas-inspection-item"]')).toHaveLength(2);
    findByTestId(panel, "canvas-inspection-focus-0")?.click();
    expect(focusIssue).toHaveBeenCalledWith({ mapId, x: 4, y: 5 });
  });

  it("sends a located issue to the bounded AI repair preview", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const openRegionTask = vi.fn();
    const deps: CanvasInspectionDeps = {
      focusIssue: vi.fn(),
      lint: () => [
        { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
      ],
      openRegionTask,
    };

    const panel = openCanvasInspectionPanel({ deps, mapId, project });
    findByTestId(panel, "canvas-inspection-fix-0")?.click();

    expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
      autoRun: false,
      mapId,
      region: { x: 2, y: 3, width: 5, height: 5 },
    }));
    expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("입구가 막혀 있습니다.");
  });

  it("shows a clean result when lint finds no issues", () => {
    const project = createBlankProject();
    const deps: CanvasInspectionDeps = {
      focusIssue: vi.fn(),
      lint: () => [],
      openRegionTask: vi.fn(),
    };

    const panel = openCanvasInspectionPanel({ deps, mapId: project.startMapId, project });

    expect(findByTestId(panel, "canvas-inspection-empty")?.textContent).toContain("문제를 찾지 못했습니다");
  });
});
