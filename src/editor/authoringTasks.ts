import { editorState } from "@/editor/editorState";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { setWorkspacePreset } from "@/editor/workspace/workspaceStore";
import { uiLabel } from "@/editor/uiCopy";

export type AuthoringTaskId = "map" | "event" | "data" | "test";

export type AuthoringTask = {
  readonly id: AuthoringTaskId;
  readonly label: string;
  readonly hint: string;
  readonly keywords: readonly string[];
};

export const AUTHORING_TASKS: readonly AuthoringTask[] = [
  { id: "map", label: "맵", hint: "타일 도구와 맵 작업 화면 열기", keywords: ["map", "tile", "맵", "타일"] },
  { id: "event", label: "이벤트", hint: "이벤트 레이어와 배치 도구 열기", keywords: ["event", "scene", "이벤트", "장면"] },
  { id: "data", label: "데이터", hint: "데이터베이스 열기", keywords: ["data", "database", "db", "데이터", "자료"] },
  // 톱바에 그리는 힌트도 헤더 문구다 — 이 항목은 "현재 프로젝트 시연 실행" 이라 톱바 테스트
  // 버튼·게임 메뉴와 다른 이름을 내고 있었다. 정본은 uiCopy 가 가진다.
  { id: "test", label: "테스트", hint: `현재 프로젝트 ${uiLabel("testPlay")}`, keywords: ["test", "play", "run", "테스트", "시연"] },
] as const;

/**
 * Topbar and command palette share this single real-action boundary.
 *
 * 2026-08-26: `map`/`event` 는 예전에 `activateLeftDrawerTab()` 을 불렀다. 그 함수는
 * `oprn:left-drawer-tab` 이라는 저장 키를 쓰고 레이어를 바꿨는데, 정작 그 키를 읽어 탭을
 * 그리는 UI(`renderLeftDrawerTabs`)는 **어디에서도 호출되지 않았다** — 실측 감사에서 `맵` 칩을
 * 누르면 관찰 가능한 변화가 localStorage 쓰기 하나뿐이었다. 이제 좌측 사이드바가 소유하는
 * 레이어 전환(`selectSidebarLayer`)을 직접 불러서 화면에 보이는 일을 한다.
 */
export function runAuthoringTask(id: AuthoringTaskId): void {
  if (id === "map") {
    setWorkspacePreset("map");
    // 이벤트 레이어에 있었다면 타일 작업으로 돌아온다. 이미 타일 레이어면 그 레이어를 유지한다.
    const layer = editorState.get().layer;
    selectSidebarLayer(layer === "event" ? "lower" : layer);
    return;
  }
  if (id === "event") {
    setWorkspacePreset("event");
    selectSidebarLayer("event");
    return;
  }
  if (id === "data") {
    setWorkspacePreset("data");
    openDatabaseModal();
    return;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
}
