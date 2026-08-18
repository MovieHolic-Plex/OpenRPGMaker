// Ctrl+K 통합 팔레트의 에디터 명령 레지스트리 (스펙 §4 3-A).
// run()은 기존 단축키/레일과 동일한 상태 전이만 수행한다 — 새 경로를 만들지 않는다.
import { applyLayer } from "@/editor/hotkeys";
import { editorState, type Tool } from "@/editor/editorState";
import { getEditorUiMode, setEditorUiMode } from "@/editor/editorUiMode";
import { activateLeftDrawerTab } from "@/editor/leftDrawerTab";
import { selectEditorMap } from "@/editor/mapSelection";
import { isBuildPaletteEnabled, setBuildPaletteEnabled } from "@/editor/panels/buildPalette";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { downloadCurrentMapScreenshot } from "@/editor/panels/editorZoomToolbar";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldPanel } from "@/editor/panels/worldPanel";
import type { MapId, Project } from "@/project/types";

export interface EditorCommand {
  readonly id: string;
  readonly label: string;
  readonly category: "도구" | "레이어" | "화면" | "이동";
  readonly keywords: readonly string[];
  readonly hotkey?: string;
  readonly run: () => void;
}

const TOOL_COMMANDS: readonly { id: Tool; label: string; keywords: readonly string[]; hotkey: string }[] = [
  { id: "select", label: "도구: 선택", keywords: ["select", "선택"], hotkey: "V" },
  { id: "paint", label: "도구: 브러시", keywords: ["brush", "paint", "펜", "브러시"], hotkey: "B" },
  { id: "erase", label: "도구: 지우개", keywords: ["erase", "eraser", "지우개"], hotkey: "E" },
  { id: "fill", label: "도구: 채우기", keywords: ["fill", "채우기", "버킷"], hotkey: "G" },
  { id: "event", label: "도구: 이벤트", keywords: ["event", "이벤트", "npc"], hotkey: "N" },
  { id: "eyedropper", label: "도구: 스포이트", keywords: ["eyedropper", "picker", "스포이트"], hotkey: "I" },
];

function runTool(tool: Tool): void {
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
    ...TOOL_COMMANDS.map((tool): EditorCommand => ({
      id: `tool-${tool.id}`,
      label: tool.label,
      category: "도구",
      keywords: tool.keywords,
      hotkey: tool.hotkey,
      run: () => runTool(tool.id),
    })),
    { id: "layer-lower", label: "레이어: 타일(하위)", category: "레이어", keywords: ["lower", "타일", "하위"], hotkey: "F5", run: () => applyLayer("lower") },
    { id: "layer-upper", label: "레이어: 오브젝트(상위)", category: "레이어", keywords: ["upper", "오브젝트", "상위"], hotkey: "F6", run: () => applyLayer("upper") },
    { id: "layer-event", label: "레이어: 이벤트", category: "레이어", keywords: ["event", "이벤트"], hotkey: "F7", run: () => applyLayer("event") },
    {
      id: "mode-toggle",
      label: "화면: 초보→표준→전문가 모드 전환",
      category: "화면",
      keywords: ["mode", "beginner", "standard", "expert", "초보", "표준", "전문가", "모드"],
      run: () => {
        const mode = getEditorUiMode();
        setEditorUiMode(mode === "beginner" ? "standard" : mode === "standard" ? "expert" : "beginner");
      },
    },
    {
      id: "test-play",
      label: "화면: 테스트 플레이 실행",
      category: "화면",
      keywords: ["play", "run", "실행", "테스트"],
      run: () => {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window"));
      },
    },
    {
      id: "open-database",
      label: "화면: 데이터베이스 열기",
      category: "화면",
      keywords: ["database", "db", "데이터베이스", "액터", "스킬"],
      run: () => openDatabaseModal(),
    },
    {
      id: "open-world",
      label: "화면: 세계관 열기",
      category: "화면",
      keywords: ["world", "세계", "세계관"],
      run: () => openWorldPanel(),
    },
    {
      id: "open-resources",
      label: "화면: 리소스 관리자 열기",
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
      id: "drawer-map",
      label: "화면: 맵 서랍",
      category: "화면",
      keywords: ["drawer", "map", "서랍", "맵"],
      run: () => activateLeftDrawerTab("map"),
    },
    {
      id: "drawer-tile",
      label: "화면: 타일 서랍",
      category: "화면",
      keywords: ["drawer", "tile", "서랍", "타일"],
      run: () => activateLeftDrawerTab("tile"),
    },
    {
      id: "drawer-event",
      label: "화면: 이벤트 서랍",
      category: "화면",
      keywords: ["drawer", "event", "서랍", "이벤트"],
      run: () => activateLeftDrawerTab("event"),
    },
    {
      id: "mode-beginner",
      label: "화면: 초보 모드",
      category: "화면",
      keywords: ["mode", "beginner", "초보", "모드"],
      run: () => setEditorUiMode("beginner"),
    },
    {
      id: "mode-standard",
      label: "화면: 표준 모드",
      category: "화면",
      keywords: ["mode", "standard", "표준", "모드"],
      run: () => setEditorUiMode("standard"),
    },
    {
      id: "mode-expert",
      label: "화면: 전문가 모드",
      category: "화면",
      keywords: ["mode", "expert", "전문가", "모드"],
      run: () => setEditorUiMode("expert"),
    },
    {
      id: "toggle-chat-dock",
      label: "화면: AI 채팅 도크 전환",
      category: "화면",
      keywords: ["chat", "dock", "ai", "채팅", "도크"],
      run: () => {
        void import("@/editor/panels/editor").then((mod) => mod.toggleChatDock());
      },
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
