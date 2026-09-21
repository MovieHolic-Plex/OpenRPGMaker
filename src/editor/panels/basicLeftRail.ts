// editor/panels/basicLeftRail.ts
// 초보: 상시 타일 팔레트 + 라벨 도구 + 하단 인라인 맵 필드 + 맵 플라이아웃.
// 스펙: docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md §2.
// - 도구 6개는 기존 data-testid(tool-*)를 유지한다.
// - 하위/상위/이벤트 레이어는 레일에서 바로 고른다 (플라이아웃 없음).
// - 맵은 하단 필드에서 바로 고르고, 전체 트리·필터·상세는 플라이아웃이 집이다.
// - 상태는 모듈 레벨(재렌더에도 유지), 문서 리스너는 1회만 설치.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { openMapCreateDialog } from "@/editor/panels/mapCreateDialog";
import { isMapTreeFolder } from "@/project/mapTree";
import { makeTileBrushControls } from "@/editor/panels/tilePaletteStampStatus";
import { dismissLocationDrawModeForTool, isLocationDrawMode } from "@/editor/locationDrawMode";
import { selectMapModeTool, selectTileTool, selectPaletteStamp } from "@/editor/panels/tileToolbarActions";
import { uiLabel } from "@/editor/uiCopy";
import { getEditorChrome, subscribeEditorUiMode } from "@/editor/editorUiMode";
import { renderEventEditor } from "./eventEditor";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { canEditMap } from "@/editor/mapEditLocks";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { basicTileLabel, makeBasicTilePalette, type BasicTilePaletteCache } from "@/editor/panels/basicTilePalette";
import { store } from "@/project/store";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import type { MapId, MapTreeNode, Project, TilesetDef } from "@/project/types";
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

const RAIL_GROUP_LABELS = { tools: "그리기 도구", panels: "타일·맵 패널" } as const;
const EVENT_LAYER_TILE_REASON = "이벤트 레이어에서는 타일을 선택하지 않습니다";

// 재렌더에도 살아남는 모듈 상태. tilePalette의 activeWorkTab 패턴과 동일.
let flyoutState: BasicFlyoutState = INITIAL_BASIC_FLYOUT_STATE;
let lastContainer: HTMLElement | null = null;
let tileSearchQuery = "";
let documentListenersInstalled = false;
const tilePaletteCache: BasicTilePaletteCache = {};

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
  tilePaletteCache.current = undefined;
}

export function renderBasicLeftRail(container: HTMLElement): void {
  if (lastContainer !== container) tilePaletteCache.current = undefined;
  const focusSnapshot = captureFocus(container);
  const previousSheet = container.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
  const scroll = { top: previousSheet?.scrollTop ?? 0, left: previousSheet?.scrollLeft ?? 0 };
  if (isStaleFlyoutState(container)) flyoutState = INITIAL_BASIC_FLYOUT_STATE;
  lastContainer = container;
  installDocumentListeners();

  const state = editorState.get();
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  const tilesBody = tileset && state.layer !== "event" ? makeTilesBody(state.selectedTile, state.layer, tileset) : null;
  const oldShell = container.querySelector<HTMLElement>('[data-testid="basic-left-rail"]');
  const keepTilesInPlace = tilesBody !== null && tilesBody.parentElement === oldShell;

  const shell = el("div", {
    class: "basic-left-rail is-icon-rail",
    dataset: { testid: "basic-left-rail", uiDensity: "beginner" },
  });
  shell.append(makeToolsColumn(state.tool));
  shell.append(el("div", { class: "basic-rail-sep", attrs: { "aria-hidden": "true" } }));
  shell.append(makeTileBrushControls(state, () => renderBasicLeftRail(container)));
  shell.append(el("div", { class: "basic-rail-sep", attrs: { "aria-hidden": "true" } }));
  shell.append(makePanelToggles(state.selectedTile, state.layer, tileset));
  if (state.pendingEventCoordinate && state.layer === "event" && state.tool === "event") {
    shell.append(makePendingEventCta(state.pendingEventCoordinate));
  }
  if (state.layer === "event") {
    renderEventEditor(shell);
  } else if (!tileset) {
    shell.append(el("div", { class: "empty-hint", text: uiLabel("tilesetMissing") }));
  }
  const mapFlyout = flyoutState.open === "maps" ? makeMapFlyout() : null;
  if (keepTilesInPlace && oldShell) {
    for (const child of Array.from(oldShell.children)) if (child !== tilesBody) child.remove();
    for (const child of Array.from(shell.children)) oldShell.insertBefore(child, tilesBody);
    oldShell.append(makeInlineMapField(project, mapId));
    if (mapFlyout) oldShell.append(mapFlyout);
  } else {
    if (tilesBody) shell.append(tilesBody);
    shell.append(makeInlineMapField(project, mapId));
    if (mapFlyout) shell.append(mapFlyout);
    clearChildren(container);
    container.append(shell);
  }

  restoreFocus(container, focusSnapshot);
  // 도구·패널 그룹을 각각 한 개의 탭 스톱으로 만들고 화살표 이동을 준다 — 표준 모드
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
    const active = !isLocationDrawMode() && activeTool === tool.id;
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
              selectTileTool("pen");
            } else if (tool.id === "event") selectMapModeTool("event");
            else if (tool.id === "eyedropper") selectMapModeTool("eyedropper");
            else if (tool.id === "select") selectTileTool("select");
            else if (tool.id === "erase") selectTileTool("erase");
            else if (tool.id === "fill") selectTileTool("fill");
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
/**
 * 초보 레일 하단의 상시 맵 필드 — 토글 없이 바로 여러 맵을 보고 고른다.
 * 왜 목록 전체가 아니라 상위 5행인가: 레일은 타일 시트가 주인이고 맵은 아래 한 줄이다.
 * 6행째부터는 플라이아웃(전체 트리·필터·상세)이 집이므로 여기서 두 번째 트리를 만들지 않는다.
 */
function makeInlineMapField(project: Project, activeId: MapId): HTMLElement {
  const rows: Array<{ readonly id: MapId; readonly label: string; readonly meta: string; readonly isStart: boolean }> = [];
  const walk = (node: MapTreeNode): void => {
    if (rows.length >= 5) return;
    if (!isMapTreeFolder(node) && node.mapId && project.maps[node.mapId]) {
      const map = project.maps[node.mapId];
      rows.push({
        id: node.mapId,
        label: map.name?.trim() ? map.name : node.mapId,
        meta: `${map.width}×${map.height}`,
        isStart: node.mapId === project.startMapId,
      });
    }
    for (const child of node.children) {
      if (rows.length >= 5) return;
      walk(child);
    }
  };
  walk(project.mapTree);
  const field = el("div", {
    class: "basic-rail-map-field",
    attrs: { role: "group", "aria-label": "맵 바로 가기" },
    dataset: { testid: "basic-map-field" },
  });
  const head = el("div", {
    class: "basic-rail-map-head",
    children: [
      el("span", { class: "basic-rail-map-title", text: `맵 ${Object.keys(project.maps).length}` }),
      el("button", {
        class: "basic-rail-map-add",
        text: "+ 새 맵",
        attrs: { type: "button", title: "맵 추가" },
        dataset: { testid: "basic-map-field-add" },
        on: { click: () => openMapCreateDialog({ preset: "blank" }) },
      }),
    ],
  });
  field.append(head);
  const list = el("div", {
    class: "basic-rail-map-list",
    attrs: { role: "listbox", "aria-label": "맵 목록" },
    dataset: { testid: "basic-map-field-list" },
  });
  for (const row of rows) {
    const active = row.id === activeId;
    list.append(el("button", {
      class: "basic-rail-map-row" + (active ? " is-active" : ""),
      attrs: {
        type: "button",
        role: "option",
        "aria-selected": String(active),
        title: active ? `${row.label} — 보고 있는 맵` : `${row.label} (${row.meta})로 이동`,
      },
      dataset: { testid: `basic-map-field-row-${row.id}` },
      on: { click: () => selectEditorMap(row.id) },
      children: [
        el("span", { class: "basic-rail-map-name", text: row.label + (row.isStart ? " · 시작" : "") }),
        el("span", { class: "basic-rail-map-meta", text: row.meta, attrs: { "aria-hidden": "true" } }),
      ],
    }));
  }
  field.append(list);
  field.append(el("button", {
    class: "basic-rail-map-more",
    text: "맵 전체 보기",
    attrs: { type: "button", title: "맵 전체 목록 열기" },
    dataset: { testid: "basic-map-field-more" },
    on: { click: () => dispatchFlyout({ type: "toggle", id: "maps" }) },
  }));
  return field;
}

function makeTilesBody(selectedTile: number, layer: "lower" | "upper", tileset: TilesetDef): HTMLElement {
  return makeBasicTilePalette({
    selectedTile, layer, tileset, query: tileSearchQuery,
    onCreatePaletteStamp: selectPaletteStamp,
    onQuery: (query) => {
      tileSearchQuery = query;
      if (lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
      const sheet = lastContainer?.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
      if (sheet) sheet.scrollTop = 0;
    },
    onResetQuery: () => {
      tileSearchQuery = "";
      if (lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
      lastContainer?.querySelector<HTMLElement>('[data-testid="basic-tile-search"]')?.focus();
    },
    onSelect: (index) => {
      const home = tileLayerHome(tileset, index);
      dismissLocationDrawModeForTool("paint");
      editorState.set({
        selectedTile: index, tool: "paint", paintShape: "pen", activePaletteStamp: null,
        layer: home === "both" ? layer : home,
      });
    },
  }, tilePaletteCache);
}
