// Ctrl+K 통합 팔레트의 에디터 명령 레지스트리 (스펙 §4 3-A).
// run()은 기존 단축키/레일과 동일한 상태 전이만 수행한다 — 새 경로를 만들지 않는다.
import { applyLayer } from "@/editor/hotkeys";
import { editorState, type Tool } from "@/editor/editorState";
import { getEditorUiMode, setEditorUiMode } from "@/editor/editorUiMode";
import { selectEditorMap } from "@/editor/mapSelection";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
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
      label: "화면: 기본↔전문가 모드 전환",
      category: "화면",
      keywords: ["mode", "basic", "expert", "기본", "전문가", "모드"],
      run: () => setEditorUiMode(getEditorUiMode() === "basic" ? "expert" : "basic"),
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
