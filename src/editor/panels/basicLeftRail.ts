// editor/panels/basicLeftRail.ts
// 초보: 상시 타일 팔레트 + 라벨 도구 + 맵 플라이아웃.
// 스펙: docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md §2.
// - 도구 6개는 기존 data-testid(tool-*)를 유지한다.
// - 하위/상위/이벤트 레이어는 레일에서 바로 고른다 (플라이아웃 없음).
// - 맵만 플라이아웃으로 연다. 타일 선택은 상시 팔레트를 닫지 않는다.
// - 상태는 모듈 레벨(재렌더에도 유지), 문서 리스너는 1회만 설치.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { uiLabel } from "@/editor/uiCopy";
import { getEditorChrome, subscribeEditorUiMode } from "@/editor/editorUiMode";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { canEditMap } from "@/editor/mapEditLocks";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { basicTileLabel, makeBasicTilePalette } from "@/editor/panels/basicTilePalette";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { renderMapList } from "@/editor/panels/mapList";
import { applyRovingTabindex, captureFocus, restoreFocus } from "@/editor/panels/sidebarFocus";
import {
  basicFlyoutReducer,
  buildFlyoutShell,
  INITIAL_BASIC_FLYOUT_STATE,
  type BasicFlyoutAction,
  type BasicFlyoutState,
} from "@/editor/panels/basicRailFlyout";
import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { eventAtPoint } from "@/project/eventFootprintQuery";

type BasicTool = {
  readonly id: Tool;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
  readonly hotkey: string;
};

// 도구 이름은 결과 중심의 짧은 라벨로 표시한다.
const BASIC_TOOLS: readonly BasicTool[] = [
  { id: "select", label: "선택", hint: "영역 선택", icon: "select", hotkey: "V" },
  { id: "paint", label: "칠하기", hint: "고른 타일로 칠합니다", icon: "brush", hotkey: "B" },
  { id: "erase", label: "지우기", hint: "이 레이어에서 지웁니다", icon: "eraser", hotkey: "E" },
  { id: "fill", label: "채우기", hint: "이어진 영역을 채웁니다", icon: "fill", hotkey: "G" },
  { id: "event", label: "장면", hint: "이벤트를 놓거나 고칩니다", icon: "event", hotkey: "N" },
  { id: "eyedropper", label: "집기", hint: "맵에 놓인 타일을 집습니다", icon: "eyedropper", hotkey: "I" },
] as const;

type BasicLayerRow = {
  readonly id: Layer;
  readonly label: string;
  readonly hint: string;
  readonly hotkey: string;
  readonly icon: SvgIconName;
};

/** Rail order: 바닥 → 장식 → 이벤트 (직접 선택, 플라이아웃 없음).
 * 레이어마다 다른 글리프를 쓴다(layerGround/layerOverlay/layerEvent).
 * 기본 모드는 결과 중심 용어를 쓴다 — 초보에게 '하위/상위 레이어'는 개념 장벽이다. */
const BASIC_LAYERS: readonly BasicLayerRow[] = [
  { id: "lower", label: "바닥", hint: "잔디·길 등 지면을 칠하는 레이어", hotkey: "F5", icon: "layerGround" },
  // "장식"은 타일 **분류** 이름과 겹친다(팔레트 필터 칩 · tileMeta role) → 덧그림.
  { id: "upper", label: "덧그림", hint: "나무·가구 등 바닥 위에 얹는 레이어", hotkey: "F6", icon: "layerOverlay" },
  { id: "event", label: "이벤트", hint: "NPC·문·보물상자 등 상호작용 레이어", hotkey: "F7", icon: "layerEvent" },
] as const;

const RAIL_GROUP_LABELS = { tools: "그리기 도구", layers: "레이어", panels: "타일·맵 패널" } as const;
const EVENT_LAYER_TILE_REASON = "이벤트 레이어에서는 타일을 선택하지 않습니다";

// 재렌더에도 살아남는 모듈 상태. tilePalette의 activeWorkTab 패턴과 동일.
let flyoutState: BasicFlyoutState = INITIAL_BASIC_FLYOUT_STATE;
let lastContainer: HTMLElement | null = null;
let tileSearchQuery = "";
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
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(MAP_EDIT_HISTORY_EVENT, () => {
      if (getEditorChrome().paletteRail && lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
    });
  }
  // 모드가 바뀌면 레일은 허물어진다 — 그때 열림 상태를 남기면 초보로 돌아오는 순간 사용자가
  // 열지 않은 오버레이가 아무 조작 없이 캔버스를 덮는다(B-5).
  subscribeEditorUiMode(() => {
    flyoutState = INITIAL_BASIC_FLYOUT_STATE;
  });
  document.addEventListener("pointerdown", (event) => {
    if (flyoutState.open === null) return;
    const target = event.target;
    if (target instanceof Node && lastContainer?.contains(target)) return;
    dispatchFlyout({ type: "dismiss" });
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

export function resetBasicLeftRailForTests(): void {
  flyoutState = INITIAL_BASIC_FLYOUT_STATE;
  lastContainer = null;
  tileSearchQuery = "";
}

export function renderBasicLeftRail(container: HTMLElement): void {
  const focusSnapshot = captureFocus(container);
  const previousSheet = container.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
  const scroll = { top: previousSheet?.scrollTop ?? 0, left: previousSheet?.scrollLeft ?? 0 };
  if (isStaleFlyoutState(container)) flyoutState = INITIAL_BASIC_FLYOUT_STATE;
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
  if (state.layer === "event") {
    shell.append(el("div", { class: "basic-rail-hint", text: "이벤트 레이어 — 타일 대신 이벤트를 배치합니다.", dataset: { testid: "basic-event-layer-hint" } }));
  } else if (!tileset) {
    shell.append(el("div", { class: "empty-hint", text: uiLabel("tilesetMissing") }));
  } else {
    shell.append(makeTilesBody(state.selectedTile, state.layer, tileset));
  }
  if (flyoutState.open === "maps") shell.append(makeMapFlyout());
  container.append(shell);
  restoreFocus(container, focusSnapshot);
  // 도구·레이어·패널 그룹을 각각 한 개의 탭 스톱으로 만들고 화살표 이동을 준다 — 표준 모드
  // 도구막대와 같은 헬퍼다(이전엔 레일 버튼 11개가 전부 별도 탭 스톱이었다).
  applyRovingTabindex(container);
  const sheet = container.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
  if (sheet) {
    sheet.scrollTop = scroll.top;
    sheet.scrollLeft = scroll.left;
  }
}

/**
 * 모듈에 남은 열림 상태가 지금 그리려는 DOM 과 어긋나는가.
 * 컨테이너가 바뀌었거나 끊겼으면 이 렌더는 "이어서 그리기"가 아니므로 열림은 사용자 의도가 아니다.
 *
 * 예전에는 `container.querySelector('[data-testid="basic-left-rail"]') === null` 도 함께 봤다
 * ("다른 모드가 덮어썼다"를 잡으려는 의도였다). 그 조건은 의도한 것을 한 번도 잡지 못하면서
 * 정상 경로를 매번 오진했다 — renderTilePalette 는 clearChildren 뒤에 이 함수를 부르므로
 * 레일은 **항상** 없다. 결과: 맵을 고르면 editorState 변경 → 좌패널 재렌더 → 열림 상태 초기화로
 * 맵 플라이아웃이 스스로 닫혔다(실측: 행 클릭 후 basic-rail-flyout 이 DOM 에서 사라짐).
 * 모드 전환은 subscribeEditorUiMode 가 이미 초기화한다.
 */
function isStaleFlyoutState(container: HTMLElement): boolean {
  if (flyoutState.open === null) return false;
  if (lastContainer !== container) return true;
  return lastContainer.isConnected === false;
}

function makeToolsColumn(activeTool: Tool): HTMLElement {
  const list = el("div", {
    class: "basic-rail-icons",
    dataset: { testid: "basic-tool-list", roving: "true" },
    attrs: { role: "toolbar", "aria-orientation": "vertical", "aria-label": RAIL_GROUP_LABELS.tools },
  });
  for (const tool of BASIC_TOOLS) {
    const active = activeTool === tool.id;
    list.append(
      el("button", {
        class: "basic-rail-btn" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${tool.label} (${tool.hotkey}) — ${tool.hint}`,
          "aria-label": tool.label,
          // 상호배타 선택이므로 aria-current 다 — aria-pressed 는 독립 토글 6개로 읽혔다(A-3).
          // 비활성에는 속성을 달지 않는다 — leftLayerSwitcher 와 같은 표기를 쓴다.
          ...(active ? { "aria-current": "true" } : {}),
        },
        dataset: { testid: `tool-${tool.id}`, basicTool: tool.id },
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
        children: [
          makeSvgIcon(tool.icon),
          el("span", { class: "basic-rail-label", text: tool.label }),
        ],
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
    dataset: { testid: "basic-layer-list", roving: "true" },
    attrs: { role: "group", "aria-label": RAIL_GROUP_LABELS.layers },
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
          ...(active ? { "aria-current": "true" } : {}),
        },
        dataset: {
          testid: layer.id === "lower" ? "layer-lower" : layer.id === "upper" ? "layer-upper" : "layer-event",
          basicLayer: layer.id,
        },
        on: { click: () => applyLayerSelection(layer.id) },
        children: [
          makeSvgIcon(layer.icon),
          el("span", { class: "basic-rail-label", text: layer.label }),
        ],
      }),
    );
  }
  return list;
}

function makePanelToggles(selectedTile: number, activeLayer: Layer, tileset: TilesetDef | undefined): HTMLElement {
  const wrap = el("div", {
    class: "basic-rail-icons basic-rail-panel-toggles",
    dataset: { testid: "basic-panel-toggles", roving: "true" },
    attrs: { role: "group", "aria-label": RAIL_GROUP_LABELS.panels },
  });

  // 타일: 현재 선택 타일 썸네일을 아이콘으로. 이벤트 레이어에선 비활성.
  const tileDisabledReason = activeLayer === "event" ? EVENT_LAYER_TILE_REASON : !tileset ? uiLabel("tilesetMissing") : null;
  const tileDisabled = tileDisabledReason !== null;
  const thumbSize = 26;
  const tileThumbStyle =
    !tileDisabled && tileset && selectedTile >= 0 && selectedTile < tileset.count
      ? `width:${thumbSize}px;height:${thumbSize}px;${tilesetTileBackgroundStyle(tileset, selectedTile, thumbSize)}`
      : `width:${thumbSize}px;height:${thumbSize}px;`;
  const tileButton = el("button", {
    class: "basic-rail-btn basic-rail-tile-toggle",
    attrs: {
      type: "button",
      title: tileDisabledReason ?? `타일 — 현재: ${tileset ? basicTileLabel(tileset, selectedTile) : "공백"}`,
      "aria-label": "타일 고르기로 이동",
    },
    dataset: { testid: "basic-rail-toggle-tiles" },
    on: { click: () => {
      if (!tileDisabled) lastContainer?.querySelector<HTMLElement>('[data-testid="basic-tile-grid"] .chipset-tile[tabindex="0"]')?.focus();
    } },
    children: [
      el("span", { class: "basic-rail-tile-thumb", attrs: { style: tileThumbStyle, "aria-hidden": "true" } }),
      el("span", { class: "basic-rail-label", text: "타일" }),
    ],
  });
  if (tileDisabled) tileButton.setAttribute("disabled", "");
  wrap.append(tileButton);
  const undo = el("button", {
    class: "basic-rail-btn",
    attrs: { type: "button", "aria-label": "되돌리기", title: "되돌리기 (Ctrl+Z)" },
    dataset: { testid: "oprn-tool-undo" },
    children: [makeSvgIcon("undo"), el("span", { class: "basic-rail-label", text: "되돌리기" })],
    on: { click: () => { undoMapEdit(); } },
  });
  undo.disabled = !getMapEditHistoryState().canUndo;
  undo.setAttribute("aria-disabled", String(undo.disabled));
  wrap.append(undo);

  wrap.append(
    el("button", {
      class: "basic-rail-btn" + (flyoutState.open === "maps" ? " is-open" : ""),
      attrs: { type: "button", title: "맵 트리", "aria-label": "맵 패널", "aria-expanded": String(flyoutState.open === "maps") },
      dataset: { testid: "basic-rail-toggle-maps" },
      on: { click: () => dispatchFlyout({ type: "toggle", id: "maps" }) },
      children: [
        makeSvgIcon("map"),
        el("span", { class: "basic-rail-label", text: "맵" }),
      ],
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
        const occupied = map ? eventAtPoint(map, pending.x, pending.y) !== undefined : false;
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

function makeMapFlyout(): HTMLElement {
  const host = el("div", { class: "basic-flyout-map-host", dataset: { testid: "basic-map-list-host" } });
  renderMapList(host, { variant: "basic" });
  const shell = buildFlyoutShell({
    title: "맵",
    pinned: flyoutState.pinned,
    anchorTestId: "basic-rail-toggle-maps",
    onPinToggle: () => dispatchFlyout({ type: "pin-toggle" }),
    onClose: () => dispatchFlyout({ type: "escape" }),
    body: el("div", { class: "basic-flyout-content", children: [host] }),
  });
  shell.classList.add("is-maps");
  return shell;
}

function makeTilesBody(selectedTile: number, layer: "lower" | "upper", tileset: TilesetDef): HTMLElement {
  return makeBasicTilePalette({
    selectedTile, layer, tileset, query: tileSearchQuery,
    onQuery: (query) => {
      tileSearchQuery = query;
      if (lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
      const sheet = lastContainer?.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
      if (sheet) sheet.scrollTop = 0;
    },
    onSelect: (index) => {
      const home = tileLayerHome(tileset, index);
      editorState.set({
        selectedTile: index, tool: "paint", paintShape: "pen", activePaletteStamp: null,
        layer: home === "both" ? layer : home,
      });
    },
  });
}
