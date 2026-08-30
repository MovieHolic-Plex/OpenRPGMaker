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
      requestAssistant: vi.fn(),
    };

    const panel = openCanvasInspectionPanel({ deps, mapId, project });

    expect(findByTestId(panel, "canvas-inspection-summary")?.textContent).toContain("문제 2개");
    expect(panel.querySelectorAll('[data-testid="canvas-inspection-item"]')).toHaveLength(2);
    findByTestId(panel, "canvas-inspection-focus-0")?.click();
    expect(focusIssue).toHaveBeenCalledWith({ mapId, x: 4, y: 5 });
  });

  it("문제 좌표 둘레를 조수 턴의 스코프로 무장하고 캔버스 선택도 같이 옮긴다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const requestAssistant = vi.fn();
    const deps: CanvasInspectionDeps = {
      focusIssue: vi.fn(),
      lint: () => [
        { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
      ],
      requestAssistant,
    };

    const panel = openCanvasInspectionPanel({ deps, mapId, project });
    findByTestId(panel, "canvas-inspection-fix-0")?.click();

    const region = { x: 2, y: 3, width: 5, height: 5 };
    expect(requestAssistant).toHaveBeenCalledWith({ mapId, ...region }, expect.objectContaining({ focus: true }));
    expect(requestAssistant.mock.calls[0]?.[1].instruction).toContain("입구가 막혀 있습니다.");
    // autoRun 은 하지 않는다 — 수리 지시문은 사용자가 읽고 다듬을 여지가 있다.
    expect(requestAssistant.mock.calls[0]?.[1].autoRun).toBeUndefined();
    // 사용자가 캔버스에서 같은 사각형을 봐야 되돌리기·확인이 맞아떨어진다.
    expect(editorState.get().selection).toEqual({ mapId, ...region });
  });

  it("shows a clean result when lint finds no issues", () => {
    const project = createBlankProject();
    const deps: CanvasInspectionDeps = {
      focusIssue: vi.fn(),
      lint: () => [],
      requestAssistant: vi.fn(),
    };

    const panel = openCanvasInspectionPanel({ deps, mapId: project.startMapId, project });

    expect(findByTestId(panel, "canvas-inspection-empty")?.textContent).toContain("문제를 찾지 못했습니다");
  });
});
