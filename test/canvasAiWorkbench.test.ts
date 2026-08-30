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
    requestAssistant: vi.fn(),
    openAssistantPanel: vi.fn(),
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
    expect(deps.requestAssistant).not.toHaveBeenCalled();
    expect(deps.toast).toHaveBeenCalledWith("다듬을 영역을 드래그해 선택하세요.", "info");
  });

  it("다듬기: 선택을 스코프로 무장하고 지시문을 채워 바로 실행한다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const selection = { mapId, x: 3, y: 4, width: 6, height: 5 };
    const requestAssistant = vi.fn();
    const deps = makeDeps({
      getProject: () => project,
      getState: () => ({ ...editorState.get(), currentMapId: mapId, selection }),
      requestAssistant,
    });

    executeCanvasAiAction("polish", deps);

    // 실행체는 조수 세션 하나다 — 이 진입점은 브리지 이벤트 1건만 낸다(옛 openRegionTask 삭제).
    expect(requestAssistant).toHaveBeenCalledWith(selection, expect.objectContaining({
      autoRun: true,
      focus: true,
    }));
    expect(requestAssistant.mock.calls[0]?.[1].instruction).toContain("반복되는 타일을 줄이고");
  });

  it("AI 요청: 선택이 없으면 맵 전체를 스코프로 씌우지 않고 조수만 펼친다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const requestAssistant = vi.fn();
    const openAssistantPanel = vi.fn();
    const deps = makeDeps({
      getProject: () => project,
      getState: () => ({ ...editorState.get(), currentMapId: mapId, selection: null }),
      requestAssistant,
      openAssistantPanel,
    });

    executeCanvasAiAction("ask", deps);

    // 맵 전체 사각형을 스코프로 주면 실내 신축처럼 맵 밖이 본업인 작업이 헛되게 클립된다.
    expect(requestAssistant).not.toHaveBeenCalled();
    expect(openAssistantPanel).toHaveBeenCalledOnce();
  });

  it("AI 요청: 선택이 있으면 그 사각형만 스코프로 무장한다(자동 실행 없음)", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const selection = { mapId, x: 2, y: 2, width: 4, height: 4 };
    const requestAssistant = vi.fn();
    const openAssistantPanel = vi.fn();
    const deps = makeDeps({
      getProject: () => project,
      getState: () => ({ ...editorState.get(), currentMapId: mapId, selection }),
      requestAssistant,
      openAssistantPanel,
    });

    executeCanvasAiAction("ask", deps);

    expect(requestAssistant).toHaveBeenCalledWith(selection, { focus: true });
    expect(openAssistantPanel).not.toHaveBeenCalled();
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
