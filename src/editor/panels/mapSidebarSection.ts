import { el } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { renderMapList } from "./mapList";

/**
 * 「맵」 탭 — 어느 맵을 고칠지 고르는 목록 하나만 둔다.
 * 맵 속성은 예전엔 「맵 목록 / 맵 속성」 하위 탭으로 목록과 자리를 나눠 썼다. 같은 설정 창이 행을
 * 두 번 누르거나 행 메뉴의 「맵 설정」으로 이미 열리므로(mapPropertiesDialog), 탭 안의 탭은 걷었다.
 */
export function createMapSidebarSection(): { root: HTMLElement; show(): void; dispose(): void } {
  let mapId = editorState.get().currentMapId;
  const list = el("div", { class: "map-sidebar-list", dataset: { testid: "map-sidebar-list" } });
  const root = el("section", { class: "map-sidebar-section", attrs: { "aria-label": "맵" }, dataset: { testid: "map-sidebar-section" }, children: [list] });
  function refresh(): void {
    if (root.hidden) return;
    renderMapList(list);
  }
  const unsubscribeEditor = editorState.subscribe(() => {
    const next = editorState.get().currentMapId;
    if (next !== mapId) { mapId = next; refresh(); }
  });
  const unsubscribeStore = store.subscribe(() => {
    // 이름 바꾸기·필터 입력 중에는 다시 그리지 않는다. 다음 탭 진입이 새로 그린다.
    if (!root.contains(document.activeElement)) refresh();
  });
  root.hidden = true;
  return { root, show: refresh, dispose: () => { unsubscribeEditor(); unsubscribeStore(); } };
}
