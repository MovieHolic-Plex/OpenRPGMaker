// 좌측 서랍 탭(맵/타일/이벤트). 루트 testid는 유지하고 가중치만 바꾼다.

import { editorState, type EditorState, type Layer, type Tool } from "@/editor/editorState";
import { el } from "@/util/dom";

export const LEFT_DRAWER_TAB_KEY = "rpg-zzu:left-drawer-tab";

export const LEFT_DRAWER_TABS = {
  map: "map",
  tile: "tile",
  event: "event",
} as const;

export type LeftDrawerTab = (typeof LEFT_DRAWER_TABS)[keyof typeof LEFT_DRAWER_TABS];

const TAB_ITEMS = [
  { id: LEFT_DRAWER_TABS.map, label: "맵" },
  { id: LEFT_DRAWER_TABS.tile, label: "타일" },
  { id: LEFT_DRAWER_TABS.event, label: "이벤트" },
] as const;

const DRAWER_CLASS: { readonly [K in LeftDrawerTab]: string } = {
  map: "is-drawer-map",
  tile: "is-drawer-tile",
  event: "is-drawer-event",
};

let lastTileLayer: Exclude<Layer, "event"> = "lower";
let lastTileTool: Exclude<Tool, "event"> = "paint";

function readStorage(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function parseLeftDrawerTab(raw: string | null | undefined): LeftDrawerTab {
  if (raw === "map" || raw === "tile" || raw === "event") return raw;
  return LEFT_DRAWER_TABS.tile;
}

export function loadLeftDrawerTab(): LeftDrawerTab {
  return parseLeftDrawerTab(readStorage(LEFT_DRAWER_TAB_KEY));
}

export function saveLeftDrawerTab(tab: LeftDrawerTab): void {
  writeStorage(LEFT_DRAWER_TAB_KEY, tab);
}

export function rememberTileWork(state: EditorState): void {
  if (state.layer === "lower" || state.layer === "upper") lastTileLayer = state.layer;
  if (state.tool !== "event") lastTileTool = state.tool;
}

export function tabForEditorLayer(layer: Layer, current: LeftDrawerTab): LeftDrawerTab {
  if (current === LEFT_DRAWER_TABS.map) return LEFT_DRAWER_TABS.map;
  return layer === "event" ? LEFT_DRAWER_TABS.event : LEFT_DRAWER_TABS.tile;
}

export function activateLeftDrawerTab(tab: LeftDrawerTab): void {
  saveLeftDrawerTab(tab);
  if (tab === LEFT_DRAWER_TABS.event) {
    editorState.set({ layer: "event", tool: "event" });
    return;
  }
  if (tab === LEFT_DRAWER_TABS.tile) {
    editorState.set({ layer: lastTileLayer, tool: lastTileTool });
  }
}

export function applyLeftDrawerTab(left: HTMLElement, tab: LeftDrawerTab): void {
  left.dataset.drawerTab = tab;
  left.classList.remove("is-drawer-map", "is-drawer-tile", "is-drawer-event");
  left.classList.add(DRAWER_CLASS[tab]);
}

export function syncLeftDrawerTabs(root: HTMLElement, active: LeftDrawerTab): void {
  for (const node of Array.from(root.children)) {
    const button = node as HTMLElement;
    if (!button.dataset?.drawerTab) continue;
    const on = button.dataset.drawerTab === active;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-selected", String(on));
  }
}

export function renderLeftDrawerTabs(options: {
  readonly getActive: () => LeftDrawerTab;
  readonly onSelect: (tab: LeftDrawerTab) => void;
}): HTMLElement {
  const root = el("div", {
    class: "left-drawer-tabs",
    attrs: { role: "tablist", "aria-label": "맵 타일 이벤트" },
    dataset: { testid: "left-drawer-tabs" },
  });
  for (const item of TAB_ITEMS) {
    root.append(
      el("button", {
        class: "left-drawer-tab",
        text: item.label,
        attrs: {
          type: "button",
          role: "tab",
          "aria-selected": "false",
        },
        dataset: { testid: `left-drawer-tab-${item.id}`, drawerTab: item.id },
        on: {
          click: () => options.onSelect(item.id),
        },
      }),
    );
  }
  syncLeftDrawerTabs(root, options.getActive());
  return root;
}

export function resetLeftDrawerTabForTests(): void {
  lastTileLayer = "lower";
  lastTileTool = "paint";
}
