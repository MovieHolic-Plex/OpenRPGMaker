import { el } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { renderMapList } from "./mapList";
import { renderMapProps } from "./mapProps";

/** Map navigation and properties share one section, separate from tile painting. */
export function createMapSidebarSection(): { root: HTMLElement; show(): void; dispose(): void } {
  let tab: "list" | "properties" = "list";
  let mapId = editorState.get().currentMapId;
  const list = el("div", { class: "map-sidebar-list", dataset: { testid: "map-sidebar-list" } });
  const properties = el("div", { class: "map-sidebar-properties", dataset: { testid: "map-sidebar-properties" } });
  const tabs = el("nav", { class: "map-sidebar-tabs", attrs: { "aria-label": "맵 관리" } });
  const root = el("section", { class: "map-sidebar-section", attrs: { "aria-label": "맵" }, dataset: { testid: "map-sidebar-section" }, children: [tabs, list, properties] });
  for (const [id, label] of [["list", "맵 목록"], ["properties", "맵 속성"]] as const) {
    tabs.append(el("button", { text: label, attrs: { type: "button" }, dataset: { testid: `map-sidebar-${id}-tab`, mapTab: id }, on: { click: () => { tab = id; refresh(); } } }));
  }
  function refresh(): void {
    if (root.hidden) return;
    list.hidden = tab !== "list"; properties.hidden = tab !== "properties";
    for (const button of tabs.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.mapTab === tab));
    if (tab === "list") renderMapList(list);
    else renderMapProps(properties);
  }
  const unsubscribeEditor = editorState.subscribe(() => {
    const next = editorState.get().currentMapId;
    if (next !== mapId) { mapId = next; refresh(); }
  });
  const unsubscribeStore = store.subscribe(() => {
    // Preserve in-progress property text. The next tab entry refreshes the data.
    if (!root.contains(document.activeElement)) refresh();
  });
  root.hidden = true;
  return { root, show: refresh, dispose: () => { unsubscribeEditor(); unsubscribeStore(); } };
}
