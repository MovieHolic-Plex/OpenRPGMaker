// Ctrl+K 통합 팔레트의 에디터 명령 레지스트리 (스펙 §4 3-A).
// run()은 기존 단축키/레일과 동일한 상태 전이만 수행한다 — 새 경로를 만들지 않는다.
import { applyLayer } from "@/editor/hotkeys";
import { AUTHORING_TASKS, runAuthoringTask } from "@/editor/authoringTasks";
import { toolLabel } from "@/editor/uiCopy";
import { editorState, type Tool } from "@/editor/editorState";
import { dismissLocationDrawModeForTool } from "@/editor/locationDrawMode";
import { dockZoneHasHost, LEFT_DOCK_TASK_HOST } from "@/editor/workspace/leftDockPanels";
import { getLocale, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, t } from "@/i18n";
import { withJosa } from "@/util/josa";
import { allPanels } from "@/editor/workspace/panelRegistry";
import { moveWorkspacePanel, toggleWorkspacePanel } from "@/editor/workspace/workspaceStore";
import { selectEditorMap } from "@/editor/mapSelection";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { isBuildPaletteEnabled, setBuildPaletteEnabled } from "@/editor/panels/buildPalette";
import { downloadCurrentMapScreenshot } from "@/editor/panels/editorZoomToolbar";
import { executeCanvasAiAction } from "@/editor/panels/canvasAiWorkbench";
import { openWalkEncounterList } from "@/editor/panels/walkEncounterModal";
import { toggleLocationLayer } from "@/editor/mapLocationLayerState";
import { toggleMapBackgroundPreview } from "@/editor/mapBackgroundPreviewState";
import { OPEN_AUTHORING_JOURNEY_EVENT } from "@/editor/panels/authoringJourneyStrip";
import { OPEN_AI_SUGGESTIONS_EVENT } from "@/editor/panels/aiSuggestionPeek";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldCodexPanel, openWorldPanel } from "@/editor/panels/worldEntries";
import { listLeftActivityPanes } from "@/editor/panels/workspaceBar";
import { saveProjectNow } from "@/editor/saveActions";
import { uiLabel } from "@/editor/uiCopy";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { INSPECTION_COMMANDS } from '@/editor/panels/sidebarInspectionPins';
import { openLeftDrawer, openLeftInspection, toggleLeftColumn } from "@/editor/panels/leftColumnDrawer";
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

const DUPLICATED_TASKS: ReadonlySet<string> = new Set(["data", "test"]);

// 톱바에서 ⌘K 로 옮긴 단추들(2026-11 개편 — 초보자가 처음 30분에 쓰지 않는 것). id 는 옛 톱바 testid 다 —
// 팔레트 행은 `command-palette-item-command-<id>` 로 그려져 같은 이름으로 찾는다. 메뉴 모듈은 팔레트를 가져오므로
// 순환을 피하려고 실행 때 불러온다. 단추 자체는 menu.ts RETIRED_TOPBAR_CONTROLS 에 남아 있다.
const TOPBAR_MOVED_COMMANDS: readonly EditorCommand[] = [
  {
    id: "topbar-battle-test",
    label: "화면: 랜덤 전투 테스트",
    category: "화면",
    keywords: ["battle", "random", "encounter", "전투", "전투 테스트", "랜덤", "적"],
    run: () => { window.dispatchEvent(new CustomEvent("oprn:test-play-window", { detail: { kind: "random-battle" } })); },
  },
  {
    id: "topbar-ai-studio",
    label: "화면: AI 스튜디오 열기/닫기",
    category: "화면",
    keywords: ["studio", "ai", "스튜디오", "장면 모니터", "조수"],
    run: () => { void import("@/editor/aiStudioMode").then((mod) => mod.requestAiStudioToggle()); },
  },
  {
    id: "commit-history-toggle",
    label: "화면: 저장 기록 열기",
    category: "화면",
    keywords: ["history", "commit", "기록", "저장 기록", "커밋", "히스토리"],
    run: () => { void import("@/editor/teamWorkflowUi").then((mod) => mod.openCommitHistoryPanel()); },
  },
  {
    id: "topbar-identity",
    label: "화면: 편집 이름 바꾸기",
    category: "화면",
    keywords: ["identity", "name", "login", "이름", "편집 이름", "신원", "로그인"],
    // 톱바는 더 이상 이름을 보이지 않으므로 바뀐 뒤 다시 그릴 것이 없다.
    run: () => { void import("@/editor/teamWorkflowUi").then((mod) => mod.openIdentityMenu(() => {})); },
  },
  {
    id: "window-fullscreen",
    label: "화면: 전체화면 전환",
    category: "화면",
    keywords: ["fullscreen", "window", "전체화면", "창"],
    run: () => { void import("@/editor/panels/menu").then((mod) => mod.toggleFullscreen()); },
  },
  // ⋯ 더 보기가 품던 셋(2026-11 개편 — 시안 톱바에는 ⋯ 가 없다). id 는 옛 메뉴 항목의 testid 다.
  {
    id: "topbar-ai-settings",
    label: "화면: AI 설정 열기",
    category: "화면",
    keywords: ["ai", "settings", "connect", "model", "key", "AI 설정", "AI 연결", "연결", "모델", "설정"],
    run: () => { void import("@/editor/panels/aiSettingsModal").then((mod) => mod.openAiSettingsModal()); },
  },
  {
    id: "menu-help-guide",
    label: "도움말: 에디터 가이드",
    category: "화면",
    keywords: ["help", "guide", "manual", "도움말", "가이드", "설명서"],
    run: () => { void import("@/editor/panels/helpModal").then((mod) => mod.openHelpModal()); },
  },
  ...SUPPORTED_LOCALES.map((locale): EditorCommand => ({
    id: `menu-language-${locale}`,
    label: `언어: ${LOCALE_NATIVE_NAMES[locale]}`,
    category: "화면",
    keywords: ["language", "locale", "언어", locale, LOCALE_NATIVE_NAMES[locale]],
    run: () => { if (locale !== getLocale()) void setLocale(locale); },
  })),
];

// 캔버스 위에서 ⌘K 로 옮긴 단추들(2026-11 캔버스 알약 개편). id 는 옛 단추의 testid 다 — 팔레트 행이
// `command-palette-item-command-<id>` 로 그려져 같은 이름으로 찾는다. 단추의 클릭과 같은 함수를 부른다.
// 맵 PNG 저장은 아래 「map-screenshot」 명령이 이미 맡는다.
const CANVAS_MOVED_COMMANDS: readonly EditorCommand[] = [
  {
    id: "walk-encounter-list-open",
    label: "화면: 걷기 전투 — 적 출현 범위",
    category: "화면",
    keywords: ["encounter", "walk", "인카운터", "걷기 전투", "적 출현", "랜덤 인카운터", "범위"],
    run: () => openWalkEncounterList(),
  },
  {
    id: "map-location-layer-toggle",
    label: "화면: 구역 그리기 켜기/끄기",
    category: "화면",
    keywords: ["location", "region", "로케이션", "구역", "이름 붙은 구역"],
    run: () => toggleLocationLayer(),
  },
  {
    id: "map-background-preview-toggle",
    label: "화면: 맵 배경 미리보기 켜기/끄기",
    category: "화면",
    keywords: ["background", "preview", "parallax", "배경", "맵 배경", "미리보기"],
    run: () => toggleMapBackgroundPreview(),
  },
  {
    id: "editor-grid-toggle",
    label: "화면: 격자 보이기/숨기기",
    category: "화면",
    keywords: ["grid", "격자", "격자선", "눈금"],
    run: () => editorState.set({ showGrid: !editorState.get().showGrid }),
  },
  {
    id: "canvas-ai-create",
    label: "AI: 선택 영역에 집·길·NPC 만들기",
    category: "도구",
    keywords: ["ai", "create", "build", "만들기", "건축", "집", "길"],
    run: () => executeCanvasAiAction("create"),
  },
  {
    id: "canvas-ai-polish",
    label: "AI: 선택 영역 다듬기",
    category: "도구",
    keywords: ["ai", "polish", "다듬기", "정리"],
    run: () => executeCanvasAiAction("polish"),
  },
  {
    id: "canvas-ai-inspect",
    label: "검사: 맵 통행·참조·이벤트",
    category: "화면",
    keywords: ["inspect", "lint", "검사", "통행", "참조"],
    run: () => executeCanvasAiAction("inspect"),
  },
  {
    id: "canvas-ai-ask",
    label: "AI: 선택 영역이나 현재 맵에 요청",
    category: "도구",
    keywords: ["ai", "ask", "request", "AI 요청", "영역 작업", "요청"],
    run: () => executeCanvasAiAction("ask"),
  },
  {
    id: "authoring-journey-toggle",
    label: "화면: 저작 진행 보기",
    category: "화면",
    keywords: ["journey", "progress", "저작 진행", "여정", "단계", "진행"],
    run: () => { window.dispatchEvent(new CustomEvent(OPEN_AUTHORING_JOURNEY_EVENT)); },
  },
  {
    id: "ai-suggestion-peek",
    label: "AI: 살펴볼 것 보기",
    category: "화면",
    keywords: ["suggestion", "diagnostic", "살펴볼 것", "제안", "진단", "조수"],
    run: () => { window.dispatchEvent(new CustomEvent(OPEN_AI_SUGGESTIONS_EVENT)); },
  },
  {
    id: "tool-pan",
    label: `도구: ${toolLabel("pan")}`,
    category: "도구",
    keywords: ["pan", "hand", "손", "이동", "화면 밀기"],
    hotkey: "Space",
    run: () => runTool("pan"),
  },
];

/** 「보기」 메뉴가 비추던 왼쪽 활동 막대 패널 — 누르면 막대 단추를 누른 것과 같다(workspaceBar). */
function leftPanelViewCommands(): readonly EditorCommand[] {
  return listLeftActivityPanes().map((pane): EditorCommand => ({
    id: `workspace-panels-button-${pane.pane}`,
    label: `화면: 패널 보기 — ${pane.title}`,
    category: "화면",
    keywords: ["panel", "view", "패널", "보기", pane.title],
    run: pane.toggle,
  }));
}

async function openCurrentMapSettings(): Promise<void> {
  const mapId = editorState.get().currentMapId;
  const map = mapId ? store.getCurrent().maps[mapId] : undefined;
  if (!map) return;
  const { openMapPropertiesDialog } = await import("@/editor/panels/mapPropertiesDialog");
  openMapPropertiesDialog(map.id, map.name);
}

export function listEditorCommands(): readonly EditorCommand[] {
  return [
    ...TOPBAR_MOVED_COMMANDS,
    ...CANVAS_MOVED_COMMANDS,
    ...leftPanelViewCommands(),
    ...INSPECTION_COMMANDS.map((id): EditorCommand => ({
      id: `sidebar-inspection-${id}`, label: `검사: ${{ inspector: '인스펙터', ruleAudit: '규칙 감사', history: '작업 기록' }[id]}`,
      category: '화면', keywords: ['inspect', 'audit', 'history', '검사', '기록', id], run: () => {
        // Workspace activation belongs to command dispatch, not the panel module
        // (which is itself rendered through the workspace registry).
        if (!document.querySelector('[data-testid="left-palette-root"]')) moveWorkspacePanel('tiles', 'left');
        openSidebarInspection(id);
      },
    })),
    // 왼쪽 열에서 뺀 진입(맵 연결·공방·에셋 스토어·검사)은 여기서만 연다 — 같은 서랍·같은 검사 메뉴다.
    {
      id: "inspect-rule-violations", label: "검사: 규칙 위반 보기", category: "화면",
      keywords: ["inspect", "audit", "lint", "rule", "검사", "규칙", "위반", "경고"],
      run: () => {
        if (openLeftInspection()) return;
        if (!document.querySelector('[data-testid="left-palette-root"]')) moveWorkspacePanel('tiles', 'left');
        openSidebarInspection("ruleAudit");
      },
    },
    { id: "left-drawer-links", label: "화면: 맵 연결 보기", category: "화면", keywords: ["links", "connection", "graph", "연결", "맵 연결", "이동", "도달"], run: () => openLeftDrawer("links") },
    { id: "left-drawer-workshop", label: "화면: 공방 열기", category: "화면", keywords: ["workshop", "harness", "공방", "도트", "후보"], run: () => openLeftDrawer("workshop") },
    { id: "left-drawer-store", label: "화면: 에셋 스토어 열기", category: "화면", keywords: ["store", "asset", "market", "스토어", "에셋", "장터"], run: () => openLeftDrawer("store") },
    { id: "left-column-toggle", label: "화면: 왼쪽 열 접기/펴기", category: "화면", keywords: ["sidebar", "left", "collapse", "사이드바", "왼쪽", "접기", "펴기"], run: () => toggleLeftColumn() },
    // 「작업: 데이터」·「작업: 테스트」는 아래 「자료집 열기」·「테스트 실행」과 같은 일을 다른 이름으로 했다 — 한 명령 한 이름.
    ...AUTHORING_TASKS.filter((task) => !DUPLICATED_TASKS.has(task.id)).map((task): EditorCommand => ({
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
    // F5(새로고침)·F6(브라우저 영역 이동)은 쓰지 않는다 — hotkeys.ts 의 Shift+1/2/3.
    { id: "layer-lower", label: "레이어: 바닥", category: "레이어", keywords: ["lower", "타일", "바닥", "하위"], hotkey: "Shift+1", run: () => applyLayer("lower") },
    { id: "layer-upper", label: "레이어: 상위", category: "레이어", keywords: ["upper", "오브젝트", "덧그림", "장식", "상위"], hotkey: "Shift+2", run: () => applyLayer("upper") },
    { id: "layer-event", label: "레이어: 이벤트", category: "레이어", keywords: ["event", "이벤트"], hotkey: "Shift+3", run: () => applyLayer("event") },
    // 맵 설정(크기·배경 음악·타일 그림판)은 맵 목록 우클릭에만 있었다 — 팔레트에서 같은 창을 연다.
    {
      id: "map-settings",
      label: "맵 설정 열기 — 크기·배경 음악",
      category: "화면",
      keywords: ["map settings", "map properties", "size", "bgm", "맵 설정", "맵 속성", "크기", "배경 음악", "음악", "타일 그림판", "타일셋"],
      run: () => { void openCurrentMapSettings(); },
    },
    // 도크 프리셋 명령(「화면: 프리셋 — 맵 중심/이벤트 중심/데이터 중심」)은 2026-09-03 에 걷었다.
    // 톱바 작업 칩과 함께 사라진 개념이고, 패널 표시는 아래 「패널 — 열기/닫기」 명령이 이미 다룬다.
    // 패널 도킹 — ⌘K 에서 좌/우 도크로 바로 보낸다. 호스트 없는 도크는 명령 자체를 내놓지 않고
    // 열린 팔레트가 낡아도 다시 막는다.
    // 좌측 도크의 작업 호스트(타일)는 레이아웃과 무관하게 늘 마운트된다 — 열기/닫기 명령은 화면을 바꾸지 못하므로 내놓지 않는다.
    ...allPanels().filter((panel) => panel.id !== "assistant" && panel.id !== LEFT_DOCK_TASK_HOST).flatMap((panel): readonly EditorCommand[] => [
      {
        id: `workspace-panel-${panel.id}`,
        label: `화면: 패널 — ${panel.title} 열기/닫기`,
        category: "화면",
        keywords: ["panel", "dock", "패널", "도크", panel.title],
        run: () => toggleWorkspacePanel(panel.id),
      },
      ...(["left", "right"] as const).filter(dockZoneHasHost).map((zone): EditorCommand => ({
        id: `workspace-panel-${panel.id}-${zone}`,
        label: `화면: 패널 — ${withJosa(panel.title, "을/를")} ${zone === "left" ? "왼쪽" : "오른쪽"}으로`,
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
      keywords: ["play", "run", "test", "실행", "테스트", "시연"],
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
      keywords: ["database", "db", "data", "데이터베이스", "데이터", "자료", "자료집", "액터", "스킬"],
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
      label: "화면: 세계관 · 세계 개요 열기",
      category: "화면",
      keywords: ["world", "세계", "세계관", "세계 개요", "이 세계"],
      run: () => openWorldPanel(),
    },
    {
      id: "open-world-codex",
      label: "화면: 세계관 · 설정집 열기",
      category: "화면",
      keywords: ["world", "codex", "세계관", "설정집", "문서", "낱장", "카드"],
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
      hotkey: "?",
      // 이름대로 단축키 절에서 연다(예전에는 가이드 맨 위 「개요」가 열렸다).
      run: () => {
        void import("@/editor/panels/helpModal").then((mod) => mod.openHelpModal("shortcuts"));
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
  // 화면에는 번역된 라벨이 보인다(DOM 번역 계층). 원문과 t(원문) 을 함께 비교해야 보이는 글자로 찾힌다.
  return commands.filter(
    (command) =>
      command.label.toLowerCase().includes(q) ||
      t(command.label).toLowerCase().includes(q) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(q) || t(keyword).toLowerCase().includes(q)),
  );
}
