// editor/panels/basicLeftRail.ts
// 기본 모드 좌측 = 48px 아이콘 레일 + 레이어 직접 선택 + 플라이아웃(타일/맵).
// 스펙: docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md §2.
// - 도구 6개는 기존 data-testid(tool-*)를 유지한다.
// - 하위/상위/이벤트 레이어는 레일에서 바로 고른다 (플라이아웃 없음).
// - 타일·맵 플라이아웃은 캔버스 위 오버레이 — 좌패널 폭을 바꾸지 않아 WebGL 리사이즈가 없다.
// - 상태는 모듈 레벨(재렌더에도 유지), 문서 리스너는 1회만 설치.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { canEditMap } from "@/editor/mapEditLocks";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/rpgMakerTileToolbarIcons";
import { renderMapList } from "@/editor/panels/mapList";
import {
  basicFlyoutReducer,
  buildFlyoutShell,
  INITIAL_BASIC_FLYOUT_STATE,
  type BasicFlyoutAction,
  type BasicFlyoutId,
  type BasicFlyoutState,
} from "@/editor/panels/basicRailFlyout";

type BasicTool = {
  readonly id: Tool;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
  readonly hotkey: string;
};

const BASIC_TOOLS: readonly BasicTool[] = [
  { id: "select", label: "선택", hint: "영역 선택", icon: "select", hotkey: "V" },
  { id: "paint", label: "브러시", hint: "타일 칠하기", icon: "brush", hotkey: "B" },
  { id: "erase", label: "지우개", hint: "현재 레이어 지우기", icon: "eraser", hotkey: "E" },
  { id: "fill", label: "채우기", hint: "영역 채우기", icon: "fill", hotkey: "G" },
  { id: "event", label: "이벤트", hint: "이벤트 배치·편집", icon: "event", hotkey: "N" },
  { id: "eyedropper", label: "스포이트", hint: "맵에서 타일 집기", icon: "eyedropper", hotkey: "I" },
] as const;

type BasicLayerRow = {
  readonly id: Layer;
  readonly label: string;
  readonly short: string;
  readonly hint: string;
  readonly icon: SvgIconName;
  readonly hotkey: string;
};

/** Rail order: 바닥 → 장식 → 이벤트 (직접 선택, 플라이아웃 없음).
 * 기본 모드는 결과 중심 용어를 쓴다 — 초보에게 '하위/상위 레이어'는 개념 장벽이다. */
const BASIC_LAYERS: readonly BasicLayerRow[] = [
  { id: "lower", label: "바닥", short: "바", hint: "잔디·길 등 지면을 칠하는 레이어", icon: "tile", hotkey: "F5" },
  { id: "upper", label: "장식", short: "장", hint: "나무·가구 등 바닥 위에 얹는 레이어", icon: "layers", hotkey: "F6" },
  { id: "event", label: "이벤트", short: "이", hint: "NPC·문·보물상자 등 상호작용 레이어", icon: "event", hotkey: "F7" },
] as const;

const BASIC_TILE_CAP = 48;
const FLYOUT_TITLES: Record<BasicFlyoutId, string> = { tiles: "타일", maps: "맵" };

// 재렌더에도 살아남는 모듈 상태. tilePalette의 activeWorkTab 패턴과 동일.
let flyoutState: BasicFlyoutState = INITIAL_BASIC_FLYOUT_STATE;
let lastContainer: HTMLElement | null = null;
let documentListenersInstalled = false;

function dispatchFlyout(action: BasicFlyoutAction): void {
  const next = basicFlyoutReducer(flyoutState, action);
  if (next === flyoutState) return;
  flyoutState = next;
  if (lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
}

function installDocumentListeners(): void {
  if (documentListenersInstalled || typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  documentListenersInstalled = true;
  document.addEventListener("pointerdown", (event) => {
    if (flyoutState.open === null) return;
    const target = event.target;
    if (target instanceof Node && lastContainer?.contains(target)) return;
    dispatchFlyout({ type: "outside-click" });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || flyoutState.open === null) return;
    const target = event.target;
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
    }
    dispatchFlyout({ type: "escape" });
  });
}

export function renderBasicLeftRail(container: HTMLElement): void {
  clearChildren(container);
  lastContainer = container;
  installDocumentListeners();

  const state = editorState.get();
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;

  const shell = el("div", {
    class: "basic-left-rail is-icon-rail",
    dataset: { testid: "basic-left-rail", uiDensity: "beginner" },
  });
  shell.append(makeToolsColumn(state.tool));
  shell.append(el("div", { class: "basic-rail-sep", attrs: { "aria-hidden": "true" } }));
  shell.append(makeLayerSwitcher(state.layer));
  shell.append(el("div", { class: "basic-rail-sep", attrs: { "aria-hidden": "true" } }));
  shell.append(makePanelToggles(state.selectedTile, state.layer, tileset));
  if (state.pendingEventCoordinate && state.layer === "event" && state.tool === "event") {
    shell.append(makePendingEventCta(state.pendingEventCoordinate));
  }
  if (flyoutState.open) {
    shell.append(makeFlyout(flyoutState.open, state.selectedTile, state.layer, tileset));
  }
  container.append(shell);
}

function makeToolsColumn(activeTool: Tool): HTMLElement {
  const list = el("div", { class: "basic-rail-icons", dataset: { testid: "basic-tool-list" } });
  for (const tool of BASIC_TOOLS) {
    const active = activeTool === tool.id;
    list.append(
      el("button", {
        class: "basic-rail-btn" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${tool.label} (${tool.hotkey}) — ${tool.hint}`,
          "aria-label": tool.label,
          "aria-pressed": String(active),
        },
        dataset: { testid: `tool-${tool.id}`, basicTool: tool.id, railLabel: `${tool.label} ${tool.hotkey}` },
        on: {
          click: () => {
            if (tool.id === "paint") {
              editorState.set(
                editorState.get().layer === "event"
                  ? { tool: "paint", paintShape: "pen", layer: "lower" }
                  : { tool: "paint", paintShape: "pen" },
              );
            } else if (tool.id === "event") editorState.set({ tool: "event", layer: "event" });
            else if (editorState.get().layer === "event") editorState.set({ tool: tool.id, layer: "lower" });
            else editorState.set({ tool: tool.id });
          },
        },
        children: [makeSvgIcon(tool.icon)],
      }),
    );
  }
  return list;
}

function applyLayerSelection(layer: Layer): void {
  if (layer === "event") {
    editorState.set({ layer: "event", tool: "event" });
    return;
  }
  const tool = editorState.get().tool === "event" ? "paint" : editorState.get().tool;
  editorState.set({ layer, tool });
}

function makeLayerSwitcher(activeLayer: Layer): HTMLElement {
  const list = el("div", {
    class: "basic-rail-icons basic-rail-layer-switcher",
    dataset: { testid: "basic-layer-list" },
    attrs: { role: "group", "aria-label": "레이어" },
  });
  for (const layer of BASIC_LAYERS) {
    const active = activeLayer === layer.id;
    list.append(
      el("button", {
        class: "basic-rail-btn" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${layer.label} (${layer.hotkey}) — ${layer.hint}`,
          "aria-label": layer.label,
          "aria-pressed": String(active),
        },
        dataset: {
          testid: layer.id === "lower" ? "layer-lower" : layer.id === "upper" ? "layer-upper" : "layer-event",
          basicLayer: layer.id,
          railLabel: `${layer.label} ${layer.hotkey}`,
        },
        on: { click: () => applyLayerSelection(layer.id) },
        children: [makeSvgIcon(layer.icon), el("span", { class: "basic-rail-badge", text: layer.short })],
      }),
    );
  }
  return list;
}

function makePanelToggles(selectedTile: number, activeLayer: Layer, tileset: TilesetDef | undefined): HTMLElement {
  const wrap = el("div", { class: "basic-rail-icons basic-rail-panel-toggles" });

  // 타일: 현재 선택 타일 썸네일을 아이콘으로. 이벤트 레이어에선 비활성.
  const tileDisabled = activeLayer === "event" || !tileset;
  const thumbSize = 26;
  const tileThumbStyle =
    !tileDisabled && tileset && selectedTile >= 0 && selectedTile < tileset.count
      ? `width:${thumbSize}px;height:${thumbSize}px;${tilesetTileBackgroundStyle(tileset, selectedTile, thumbSize)}`
      : `width:${thumbSize}px;height:${thumbSize}px;`;
  const tileButton = el("button", {
    class: "basic-rail-btn basic-rail-tile-toggle" + (flyoutState.open === "tiles" ? " is-open" : ""),
    attrs: {
      type: "button",
      title: tileDisabled ? "이벤트 레이어에서는 타일을 선택하지 않습니다" : `타일 — 현재: ${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}`,
      "aria-label": "타일 패널",
      "aria-expanded": String(flyoutState.open === "tiles"),
    },
    dataset: { testid: "basic-rail-toggle-tiles", railLabel: "타일 고르기" },
    on: { click: () => { if (!tileDisabled) dispatchFlyout({ type: "toggle", id: "tiles" }); } },
    children: [el("span", { class: "basic-rail-tile-thumb", attrs: { style: tileThumbStyle, "aria-hidden": "true" } })],
  });
  if (tileDisabled) tileButton.setAttribute("disabled", "");
  wrap.append(tileButton);

  wrap.append(
    el("button", {
      class: "basic-rail-btn" + (flyoutState.open === "maps" ? " is-open" : ""),
      attrs: { type: "button", title: "맵 트리", "aria-label": "맵 패널", "aria-expanded": String(flyoutState.open === "maps") },
      dataset: { testid: "basic-rail-toggle-maps", railLabel: "맵 목록" },
      on: { click: () => dispatchFlyout({ type: "toggle", id: "maps" }) },
      children: [makeSvgIcon("map")],
    }),
  );
  return wrap;
}

function makePendingEventCta(coordinate: { readonly mapId: string; readonly x: number; readonly y: number }): HTMLElement {
  return el("button", {
    class: "basic-pending-event-cta",
    attrs: {
      type: "button",
      title: `${coordinate.x},${coordinate.y}에 새 이벤트 만들기`,
      "aria-label": `${coordinate.x},${coordinate.y}에 새 이벤트 만들기`,
    },
    dataset: { testid: "basic-create-selected-event" },
    on: {
      click: () => {
        const pending = editorState.get().pendingEventCoordinate;
        if (!pending || pending.mapId !== coordinate.mapId || pending.x !== coordinate.x || pending.y !== coordinate.y) return;
        const map = store.getCurrent().maps[pending.mapId];
        const occupied = map?.events.some((event) => event.x === pending.x && event.y === pending.y);
        if (!map || !canEditMap(pending.mapId) || pending.x < 0 || pending.y < 0 || pending.x >= map.width || pending.y >= map.height || occupied) {
          editorState.set({ pendingEventCoordinate: null });
          return;
        }
        editorState.set({ pendingEventCoordinate: null });
        openNewEventEditorModal(pending.mapId, pending.x, pending.y);
      },
    },
    children: [
      el("span", { class: "basic-pending-event-cta-mark", text: "+", attrs: { "aria-hidden": "true" } }),
      el("span", { text: "이벤트 만들기" }),
      el("span", { class: "basic-pending-event-cta-coord", text: `${coordinate.x},${coordinate.y}` }),
    ],
  });
}

function makeFlyout(id: BasicFlyoutId, selectedTile: number, activeLayer: Layer, tileset: TilesetDef | undefined): HTMLElement {
  const body = el("div", { class: "basic-flyout-content" });
  if (id === "tiles") {
    if (activeLayer === "event") {
      body.append(el("div", { class: "basic-rail-hint", text: "이벤트 레이어 — 타일 대신 이벤트를 배치합니다.", dataset: { testid: "basic-event-layer-hint" } }));
    } else if (!tileset) {
      body.append(el("div", { class: "empty-hint", text: "타일셋이 없습니다." }));
    } else {
      body.append(makeTilesBody(selectedTile, tileset));
    }
  } else {
    const host = el("div", { class: "basic-flyout-map-host", dataset: { testid: "basic-map-list-host" } });
    renderMapList(host, { variant: "basic" });
    body.append(host);
  }
  const shell = buildFlyoutShell({
    title: FLYOUT_TITLES[id],
    pinned: flyoutState.pinned,
    onPinToggle: () => dispatchFlyout({ type: "pin-toggle" }),
    onClose: () => dispatchFlyout({ type: "escape" }),
    body,
  });
  if (id === "maps") shell.classList.add("is-maps");
  if (id === "tiles") shell.classList.add("is-tiles");
  return shell;
}

function makeTilesBody(selectedTile: number, tileset: TilesetDef): HTMLElement {
  const section = el("div", { class: "basic-rail-section", dataset: { testid: "basic-tiles-section" } });
  section.append(
    el("div", {
      class: "basic-selected-tile",
      text: selectedTile >= 0 && selectedTile < tileset.count ? `${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}` : "없음",
      dataset: { testid: "selected-tile-status" },
    }),
  );
  const grid = el("div", { class: "basic-tile-grid", dataset: { testid: "basic-tile-grid" } });
  for (const index of pickBasicTileIndexes(tileset, selectedTile)) {
    const active = index === selectedTile;
    const cellSize = TILE_SIZE * 2;
    grid.append(
      el("button", {
        class: "basic-tile-cell" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${index} ${tileDisplayLabelForIndex(index)}`,
          "aria-label": `타일 ${index}`,
          "aria-pressed": String(active),
          style: `width:${cellSize}px;height:${cellSize}px;${tilesetTileBackgroundStyle(tileset, index, cellSize)}`,
        },
        dataset: { testid: `basic-tile-${index}`, tileIndex: String(index) },
        on: {
          click: () => {
            const layer = editorState.get().layer === "event" ? "lower" : editorState.get().layer;
            editorState.set({ selectedTile: index, tool: "paint", paintShape: "pen", layer });
          },
        },
      }),
    );
  }
  section.append(grid);
  return section;
}

/** Prefer terrain-looking low indexes + keep current selection visible. (기존 로직 유지) */
function pickBasicTileIndexes(tileset: TilesetDef, selectedTile: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (n: number): void => {
    if (n < 0 || n >= tileset.count || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  if (selectedTile >= 0) push(selectedTile);
  for (let i = 0; i < Math.min(tileset.count, 80); i += 1) push(i);
  for (let i = 80; i < tileset.count && out.length < BASIC_TILE_CAP; i += 8) push(i);
  return out.slice(0, BASIC_TILE_CAP);
}
