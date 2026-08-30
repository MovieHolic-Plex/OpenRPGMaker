import { editorState, type EditorState, type TileSelection } from "@/editor/editorState";
import { setBuildPaletteEnabled } from "@/editor/panels/buildPalette";
import { openCanvasInspectionPanel } from "@/editor/panels/canvasInspectionPanel";
import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast, type ToastKind } from "@/util/toast";

export type CanvasAiAction = "create" | "polish" | "inspect" | "ask";

export interface CanvasAiWorkbenchDeps {
  readonly getProject: () => Project;
  readonly getState: () => EditorState;
  readonly openInspection: (options: { readonly mapId: MapId; readonly project: Project }) => void;
  /** 선택을 조수 턴의 스코프로 무장시키고(있으면) 지시문을 입력창에 채운다. */
  readonly requestAssistant: typeof requestAiSelectionContext;
  /** 선택이 없을 때 조수 패널만 펼친다(스코프 없이 현재 맵 문맥으로 대화). */
  readonly openAssistantPanel: () => void;
  readonly selectBuildMode: () => void;
  readonly selectRegionTool: () => void;
  readonly toast: (message: string, kind?: ToastKind) => void;
}

const defaultDeps: CanvasAiWorkbenchDeps = {
  getProject: () => store.getCurrent(),
  getState: () => editorState.get(),
  openInspection: ({ mapId, project }) => { openCanvasInspectionPanel({ mapId, project }); },
  requestAssistant: requestAiSelectionContext,
  openAssistantPanel: () => { openAiAssistantPanel(); },
  selectBuildMode: () => setBuildPaletteEnabled(true),
  selectRegionTool: () => editorState.set({ selection: null, tool: "select" }),
  toast,
};

const ACTIONS: readonly {
  readonly action: CanvasAiAction;
  readonly icon: SvgIconName;
  readonly label: string;
  readonly title: string;
}[] = [
  { action: "create", icon: "template", label: "만들기", title: "집·길·강·NPC 등을 선택 영역에 만들기" },
  { action: "polish", icon: "brush", label: "다듬기", title: "선택 영역을 자연스럽게 정리하고 미리보기" },
  { action: "inspect", icon: "inspector", label: "검사", title: "통행·참조·이벤트 문제를 정적으로 검사" },
  { action: "ask", icon: "more", label: "AI 요청", title: "선택 영역 또는 현재 맵에 자연어로 요청" },
];

export function renderCanvasAiWorkbench(deps: CanvasAiWorkbenchDeps = defaultDeps): HTMLElement {
  return el("div", {
    class: "canvas-ai-workbench",
    attrs: { "aria-label": "AI 빠른 작업", role: "group" },
    dataset: { testid: "canvas-ai-workbench" },
    children: ACTIONS.map(({ action, icon, label, title }) => el("button", {
      class: `canvas-ai-action is-${action}`,
      attrs: { "aria-label": title, title, type: "button" },
      dataset: { testid: `canvas-ai-${action}` },
      children: [
        makeSvgIcon(icon),
        el("span", { text: label }),
      ],
      on: { click: () => executeCanvasAiAction(action, deps) },
    })),
  });
}

export function executeCanvasAiAction(action: CanvasAiAction, deps: CanvasAiWorkbenchDeps = defaultDeps): void {
  const project = deps.getProject();
  const state = deps.getState();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) {
    deps.toast("현재 맵을 찾지 못했습니다.", "error");
    return;
  }

  switch (action) {
    case "create":
      deps.selectBuildMode();
      deps.toast("만들 영역을 드래그해 선택하세요.", "info");
      return;
    case "polish": {
      const selection = validSelection(state.selection, mapId);
      if (!selection) {
        deps.selectRegionTool();
        deps.toast("다듬을 영역을 드래그해 선택하세요.", "info");
        return;
      }
      deps.requestAssistant(selection, {
        autoRun: true,
        focus: true,
        instruction: [
          "선택 영역의 원래 기능과 주요 구조는 보존하세요.",
          "반복되는 타일을 줄이고, 빈 공간을 주변 지형과 자연스럽게 연결해 주세요.",
          "출입구와 이동 경로를 막지 말고 장식 밀도만 균형 있게 다듬어 주세요.",
        ].join("\n"),
      });
      return;
    }
    case "inspect":
      deps.openInspection({ mapId, project });
      return;
    case "ask": {
      // 선택이 없으면 **맵 전체를 스코프로 씌우지 않는다** — 조수는 스코프 없이도 현재 맵을
      // 컨텍스트로 받고, 맵 전체 사각형을 스코프로 주면 실내 신축 같은 맵 밖 작업이 헛되게
      // 클립 대상으로 잡힌다. 선택이 있으면 그것만 스코프.
      const selection = validSelection(state.selection, mapId);
      if (selection) deps.requestAssistant(selection, { focus: true });
      else deps.openAssistantPanel();
      return;
    }
  }
}

function validSelection(selection: TileSelection | null, mapId: MapId): TileSelection | null {
  return selection?.mapId === mapId ? selection : null;
}
