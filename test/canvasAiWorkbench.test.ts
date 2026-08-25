import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  executeCanvasAiAction,
  renderCanvasAiWorkbench,
  type CanvasAiWorkbenchDeps,
} from "@/editor/panels/canvasAiWorkbench";
import { createBlankProject } from "@/project/defaults";
import type { MapId } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function asFake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function makeDeps(overrides: Partial<CanvasAiWorkbenchDeps> = {}): CanvasAiWorkbenchDeps {
  const project = createBlankProject();
  return {
    getProject: () => project,
    getState: () => editorState.get(),
    openInspection: vi.fn(),
    openRegionTask: vi.fn(),
    selectBuildMode: vi.fn(),
    selectRegionTool: vi.fn(),
    toast: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  editorState.set({
    currentMapId: null,
    selection: null,
    tool: "paint",
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("canvas AI workbench actions", () => {
  it("opens the existing deterministic build palette for 만들기", () => {
    const deps = makeDeps();

    executeCanvasAiAction("create", deps);

    expect(deps.selectBuildMode).toHaveBeenCalledOnce();
  });

  it("asks for a region before running 다듬기", () => {
    const deps = makeDeps();

    executeCanvasAiAction("polish", deps);

    expect(deps.selectRegionTool).toHaveBeenCalledOnce();
    expect(deps.openRegionTask).not.toHaveBeenCalled();
    expect(deps.toast).toHaveBeenCalledWith("다듬을 영역을 드래그해 선택하세요.", "info");
  });

  it("runs 다듬기 through the bounded region AI preview flow", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const openRegionTask = vi.fn();
    const deps = makeDeps({
      getProject: () => project,
      getState: () => ({
        ...editorState.get(),
        currentMapId: mapId,
        selection: { mapId, x: 3, y: 4, width: 6, height: 5 },
      }),
      openRegionTask,
    });

    executeCanvasAiAction("polish", deps);

    expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
      autoRun: true,
      mapId,
      region: { x: 3, y: 4, width: 6, height: 5 },
    }));
    expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("반복되는 타일을 줄이고");
  });

  it("opens AI 요청 on the whole current map when nothing is selected", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const openRegionTask = vi.fn();
    const deps = makeDeps({
      getProject: () => project,
      getState: () => ({ ...editorState.get(), currentMapId: mapId }),
      openRegionTask,
    });

    executeCanvasAiAction("ask", deps);

    expect(openRegionTask).toHaveBeenCalledWith({
      autoRun: false,
      mapId,
      region: { x: 0, y: 0, width: map.width, height: map.height },
    });
  });

  it("opens the deterministic inspection results for 검사", () => {
    const project = createBlankProject();
    const openInspection = vi.fn();
    const deps = makeDeps({ getProject: () => project, openInspection });

    executeCanvasAiAction("inspect", deps);

    expect(openInspection).toHaveBeenCalledWith({
      mapId: project.startMapId,
      project,
    });
  });

  it("renders all four functional actions", () => {
    const root = asFake(renderCanvasAiWorkbench(makeDeps()));

    expect(findByTestId(root, "canvas-ai-create")?.textContent).toContain("만들기");
    expect(findByTestId(root, "canvas-ai-polish")?.textContent).toContain("다듬기");
    expect(findByTestId(root, "canvas-ai-inspect")?.textContent).toContain("검사");
    expect(findByTestId(root, "canvas-ai-ask")?.textContent).toContain("AI 요청");
  });
});
