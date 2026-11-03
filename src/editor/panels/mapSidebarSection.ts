import { el } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import { isTileCellChange, store } from "@/project/store";
import { getMapFilterQuery, renderMapList } from "./mapList";

/** Painting emits per pointer sample; the tree only needs the settled stroke (thumbnails). */
const TILE_PAINT_SETTLE_MS = 500;

/**
 * 왼쪽 열의 「맵」 섹션 — 어느 맵을 고칠지 고르는 트리 하나. 이름 검색칸은 열 맨 위(`search`)가 갖는다.
 * 맵 속성은 행을 두 번 누르거나 행 메뉴의 「맵 설정」으로 연다(mapPropertiesDialog).
 */
export function createMapSidebarSection(search: HTMLInputElement | null = null): { root: HTMLElement; show(): void; dispose(): void } {
  let mapId = editorState.get().currentMapId;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  const list = el("div", { class: "map-sidebar-list", dataset: { testid: "map-sidebar-list" } });
  const root = el("section", { class: "map-sidebar-section", attrs: { "aria-label": "맵" }, dataset: { testid: "map-sidebar-section" }, children: [list] });
  function refresh(): void {
    if (settleTimer !== null) { clearTimeout(settleTimer); settleTimer = null; }
    if (root.hidden) return;
    renderMapList(list, { externalFilter: search !== null });
    // 맵 보이기(revealMapInDock)는 필터를 지운다 — 검색칸 글자도 그 상태를 따라간다.
    if (search && document.activeElement !== search && search.value !== getMapFilterQuery()) search.value = getMapFilterQuery();
  }
  const unsubscribeEditor = editorState.subscribe(() => {
    const next = editorState.get().currentMapId;
    if (next !== mapId) { mapId = next; refresh(); }
  });
  const unsubscribeStore = store.subscribe((_project, change) => {
    if (root.hidden) return;
    // 이름 바꾸기 중에는 다시 그리지 않는다. 다음 표시가 새로 그린다.
    if (root.contains(document.activeElement)) return;
    if (isTileCellChange(change)) {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { settleTimer = null; if (!root.contains(document.activeElement)) refresh(); }, TILE_PAINT_SETTLE_MS);
      return;
    }
    refresh();
  });
  return {
    root,
    show: refresh,
    dispose: () => {
      if (settleTimer !== null) clearTimeout(settleTimer);
      unsubscribeEditor();
      unsubscribeStore();
    },
  };
}
