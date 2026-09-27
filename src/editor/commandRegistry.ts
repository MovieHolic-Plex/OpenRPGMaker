// Ctrl+K 통합 팔레트의 에디터 명령 레지스트리 (스펙 §4 3-A).
// run()은 기존 단축키/레일과 동일한 상태 전이만 수행한다 — 새 경로를 만들지 않는다.
import { applyLayer } from "@/editor/hotkeys";
import { AUTHORING_TASKS, runAuthoringTask } from "@/editor/authoringTasks";
import { toolLabel } from "@/editor/uiCopy";
import { editorState, type Tool } from "@/editor/editorState";
import { dismissLocationDrawModeForTool } from "@/editor/locationDrawMode";
import { dockZoneHasHost } from "@/editor/workspace/leftDockPanels";
import { allPanels } from "@/editor/workspace/panelRegistry";
import { moveWorkspacePanel, toggleWorkspacePanel } from "@/editor/workspace/workspaceStore";
import { selectEditorMap } from "@/editor/mapSelection";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { isBuildPaletteEnabled, setBuildPaletteEnabled } from "@/editor/panels/buildPalette";
import { downloadCurrentMapScreenshot } from "@/editor/panels/editorZoomToolbar";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldCodexPanel, openWorldPanel } from "@/editor/panels/worldEntries";
import { saveProjectNow } from "@/editor/saveActions";
import { uiLabel } from "@/editor/uiCopy";
import type { MapId, Project } from "@/project/types";
import { INSPECTION_COMMANDS } from '@/editor/panels/sidebarInspectionPins';
import { openSidebarInspection } from '@/editor/panels/tileToolbarMenus';

export interface EditorCommand {
  readonly id: string;
  readonly label: string;
  readonly category: "도구" | "레이어" | "화면" | "이동";
  readonly keywords: readonly string[];
  readonly hotkey?: string;
  readonly run: () => void;
}

// 라벨은 uiCopy 의 toolLabel 단일 원천. keywords 에는 **구 용어도 남긴다** —
// 예전 이름(브러시·펜·지우개·스포이트)으로 검색하는 사용자를 막지 않는다.
// 「화면: 편집 모드 — 초보/표준/전문가」 명령은 2026-09-27 에 편집 모드와 함께 걷었다.
const TOOL_COMMANDS: readonly { id: Tool; keywords: readonly string[]; hotkey: string }[] = [
  { id: "select", keywords: ["select", "선택", "영역"], hotkey: "V" },
  { id: "paint", keywords: ["brush", "paint", "칠하기", "펜", "브러시"], hotkey: "B" },
  { id: "erase", keywords: ["erase", "eraser", "지우기", "지우개"], hotkey: "E" },
  { id: "fill", keywords: ["fill", "채우기", "버킷"], hotkey: "G" },
  { id: "event", keywords: ["event", "이벤트", "장면", "npc"], hotkey: "N" },
  { id: "eyedropper", keywords: ["eyedropper", "picker", "타일 집기", "스포이트"], hotkey: "I" },
];

function runTool(tool: Tool): void {
  dismissLocationDrawModeForTool(tool);
  if (tool === "paint") {
    editorState.set(
      editorState.get().layer === "event"
        ? { tool: "paint", paintShape: "pen", layer: "lower" }
        : { tool: "paint", paintShape: "pen" },
    );
  } else if (tool === "event") editorState.set({ tool: "event", layer: "event" });
  else if (editorState.get().layer === "event") editorState.set({ tool, layer: "lower" });
  else editorState.set({ tool });
}

export function listEditorCommands(): readonly EditorCommand[] {
  return [
    ...INSPECTION_COMMANDS.map((id): EditorCommand => ({
      id: `sidebar-inspection-${id}`, label: `검사: ${{ inspector: '인스펙터', ruleAudit: '규칙 감사', history: '작업 기록' }[id]}`,
      category: '화면', keywords: ['inspect', 'audit', 'history', '검사', '기록', id], run: () => {
        // Workspace activation belongs to command dispatch, not the panel module
        // (which is itself rendered through the workspace registry).
        if (!document.querySelector('[data-testid="left-palette-root"]')) moveWorkspacePanel('tiles', 'left');
        openSidebarInspection(id);
      },
    })),
    ...AUTHORING_TASKS.map((task): EditorCommand => ({
      id: `authoring-task-${task.id}`,
      label: `작업: ${task.label}`,
      category: "화면",
      keywords: ["authoring", "작업", ...task.keywords],
      run: () => runAuthoringTask(task.id),
    })),
    ...TOOL_COMMANDS.map((tool): EditorCommand => ({
      id: `tool-${tool.id}`,
      label: `도구: ${toolLabel(tool.id)}`,
      category: "도구",
      keywords: tool.keywords,
      hotkey: tool.hotkey,
      run: () => runTool(tool.id),
    })),
    // keywords 에 구 용어(하위/상위)를 남긴다 — 예전 용어로 검색하는 사용자를 위해.
    { id: "layer-lower", label: "레이어: 바닥", category: "레이어", keywords: ["lower", "타일", "바닥", "하위"], hotkey: "F5", run: () => applyLayer("lower") },
    { id: "layer-upper", label: "레이어: 상위", category: "레이어", keywords: ["upper", "오브젝트", "덧그림", "장식", "상위"], hotkey: "F6", run: () => applyLayer("upper") },
    { id: "layer-event", label: "레이어: 이벤트", category: "레이어", keywords: ["event", "이벤트"], hotkey: "F7", run: () => applyLayer("event") },
    // 도크 프리셋 명령(「화면: 프리셋 — 맵 중심/이벤트 중심/데이터 중심」)은 2026-09-03 에 걷었다.
    // 톱바 작업 칩과 함께 사라진 개념이고, 패널 표시는 아래 「패널 — 열기/닫기」 명령이 이미 다룬다.
    // 패널 도킹 — ⌘K 에서 좌/우 도크로 바로 보낸다. 호스트 없는 도크는 명령 자체를 내놓지 않고
    // 열린 팔레트가 낡아도 다시 막는다.
    ...allPanels().filter((panel) => panel.id !== "assistant").flatMap((panel): readonly EditorCommand[] => [
      {
        id: `workspace-panel-${panel.id}`,
        label: `화면: 패널 — ${panel.title} 열기/닫기`,
        category: "화면",
        keywords: ["panel", "dock", "패널", "도크", panel.title],
        run: () => toggleWorkspacePanel(panel.id),
      },
      ...(["left", "right"] as const).filter(dockZoneHasHost).map((zone): EditorCommand => ({
        id: `workspace-panel-${panel.id}-${zone}`,
        label: `화면: 패널 — ${panel.title}를 ${zone === "left" ? "왼쪽" : "오른쪽"}으로`,
        category: "화면",
        keywords: ["panel", "dock", "move", "패널", "도크", "이동", panel.title],
        run: () => {
          if (!dockZoneHasHost(zone)) return;
          moveWorkspacePanel(panel.id, zone);
        },
      })),
    ]),
    {
      id: "test-play",
      label: `화면: ${uiLabel("testPlay")}`,
      category: "화면",
      keywords: ["play", "run", "실행", "테스트", "시연"],
      run: () => runAuthoringTask("test"),
    },
    {
      id: "save-project",
      label: "화면: 프로젝트 저장",
      category: "화면",
      keywords: ["save", "저장", "ctrl+s"],
      hotkey: "Ctrl+S",
      run: () => { void saveProjectNow(); },
    },
    {
      id: "open-database",
      label: `화면: ${uiLabel("database")} 열기`,
      category: "화면",
      keywords: ["database", "db", "데이터베이스", "자료집", "액터", "스킬"],
      run: () => runAuthoringTask("data"),
    },
    // 음악·효과음과 맵·이벤트 찾기는 2026-09-03 까지 팔레트에 없었다 — 표준 모드에서는 「도구 ▾」
    // 메뉴 두 번 클릭이 유일한 길이었다. 팔레트는 한 집 규칙의 예외(전체 검색)라 여기 둔다.
    {
      id: "open-audio",
      label: `화면: ${uiLabel("audio")} 열기`,
      category: "화면",
      keywords: ["audio", "bgm", "se", "sound", "music", "음악", "효과음", "소리"],
      run: () => openAudioTestDialog(),
    },
    {
      id: "open-map-event-search",
      label: `화면: ${uiLabel("mapEventSearch")}`,
      category: "화면",
      keywords: ["search", "find", "event", "찾기", "검색", "이벤트"],
      run: () => openMapEventSearchModal(),
    },
    {
      id: "open-world",
      label: "화면: 세계관 · 이 세계 열기",
      category: "화면",
      keywords: ["world", "세계", "세계관"],
      run: () => openWorldPanel(),
    },
    {
      id: "open-world-codex",
      label: "화면: 세계관 · 설정집 열기",
      category: "화면",
      keywords: ["world", "codex", "세계관", "설정집", "낱장", "카드"],
      run: () => openWorldCodexPanel(),
    },
    {
      id: "open-resources",
      label: `화면: ${uiLabel("resources")} 관리자 열기`,
      category: "화면",
      keywords: ["resources", "resource", "리소스", "소재"],
      run: () => openResourceModal(),
    },
    {
      id: "map-screenshot",
      label: "화면: 현재 맵 PNG 저장",
      category: "화면",
      keywords: ["map", "screenshot", "png", "맵", "이미지", "저장"],
      run: () => { void downloadCurrentMapScreenshot(); },
    },
    {
      id: "build-palette",
      label: "도구: 건축 팔레트 전환",
      category: "도구",
      keywords: ["build", "palette", "건축", "팔레트"],
      run: () => setBuildPaletteEnabled(!isBuildPaletteEnabled()),
    },
    {
      id: "help-shortcuts",
      label: "도움말: 단축키 보기",
      category: "화면",
      keywords: ["help", "shortcut", "도움말", "단축키", "키"],
      run: () => {
        void import("@/editor/panels/helpModal").then((mod) => mod.openHelpModal());
      },
    },
  ];
}

export function listMapCommands(
  project: Project,
  select: (mapId: MapId) => boolean = selectEditorMap,
): readonly EditorCommand[] {
  return Object.entries(project.maps).map(([mapId, map]): EditorCommand => ({
    id: `map-${mapId}`,
    label: `맵 이동: ${map.name || mapId}`,
    category: "이동",
    keywords: [map.name || "", mapId],
    run: () => { select(mapId); },
  }));
}

export function matchEditorCommands(query: string, commands: readonly EditorCommand[]): readonly EditorCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter(
    (command) =>
      command.label.toLowerCase().includes(q) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
  );
}
