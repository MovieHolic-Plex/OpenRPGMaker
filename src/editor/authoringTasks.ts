import { editorState } from "@/editor/editorState";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { openDatabaseModalLazy } from "@/editor/panels/databaseModalLazy";
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
  // 톱바에 그리는 힌트도 헤더 문구다 — 정본 이름 뒤에만 설명을 잇는다.
  { id: "test", label: "테스트", hint: `${uiLabel("testPlay")} — 현재 프로젝트`, keywords: ["test", "play", "run", "테스트", "시연"] },
] as const;

/**
 * Ctrl+K 팔레트의 「작업: …」 명령이 부르는 실제 동작 경계.
 *
 * 2026-08-26: `map`/`event` 는 예전에 `activateLeftDrawerTab()` 을 불렀다. 그 함수는
 * `oprn:left-drawer-tab` 이라는 저장 키를 쓰고 레이어를 바꿨는데, 정작 그 키를 읽어 탭을
 * 그리는 UI(`renderLeftDrawerTabs`)는 **어디에서도 호출되지 않았다** — 실측 감사에서 `맵` 칩을
 * 누르면 관찰 가능한 변화가 localStorage 쓰기 하나뿐이었다. 이제 좌측 사이드바가 소유하는
 * 레이어 전환(`selectSidebarLayer`)을 직접 불러서 화면에 보이는 일을 한다.
 *
 * 2026-09-03: 톱바의 작업 칩 4개를 걷었다. 「맵」·「이벤트」는 사이드바 레이어 전환(F5/F7)과,
 * 「데이터」는 톱바 자료집 버튼과, 「테스트」는 ▶ 테스트 버튼과 같은 일을 두 번째 자리에서 했다.
 * 칩이 함께 바꾸던 도크 프리셋(`setWorkspacePreset`)도 걷었다 — 「데이터 중심」은 자료집 모달
 * 뒤에서 좌측 도크를 비워, 모달을 닫으면 팔레트가 사라진 채로 남는 함정이었다. 패널 표시는
 * 「보기」 메뉴의 패널 토글 하나가 소유한다. 이 함수는 Ctrl+K 의 「작업: …」 명령을 위해 남는다.
 */
export function runAuthoringTask(id: AuthoringTaskId): void {
  if (id === "map") {
    // 이벤트 레이어에 있었다면 타일 작업으로 돌아온다. 이미 타일 레이어면 그 레이어를 유지한다.
    const layer = editorState.get().layer;
    selectSidebarLayer(layer === "event" ? "lower" : layer);
    return;
  }
  if (id === "event") {
    selectSidebarLayer("event");
    return;
  }
  if (id === "data") {
    openDatabaseModalLazy();
    return;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
}
