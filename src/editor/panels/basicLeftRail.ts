// editor/panels/basicLeftRail.ts
// 기본 모드 좌측 = 72px 라벨 레일 + 레이어 직접 선택 + 플라이아웃(타일/맵).
// 스펙: docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md §2.
// - 도구 6개는 기존 data-testid(tool-*)를 유지한다.
// - 하위/상위/이벤트 레이어는 레일에서 바로 고른다 (플라이아웃 없음).
// - 타일·맵 플라이아웃은 캔버스 위 오버레이 — 좌패널 폭을 바꾸지 않아 WebGL 리사이즈가 없다.
// - 상태는 모듈 레벨(재렌더에도 유지), 문서 리스너는 1회만 설치.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { uiLabel } from "@/editor/uiCopy";
import { subscribeEditorUiMode } from "@/editor/editorUiMode";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { canEditMap } from "@/editor/mapEditLocks";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
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
  type BasicFlyoutId,
  type BasicFlyoutState,
} from "@/editor/panels/basicRailFlyout";
import { eventAtPoint } from "@/project/eventFootprintQuery";

type BasicTool = {
  readonly id: Tool;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
  readonly hotkey: string;
};

// 아이콘 레일은 폭이 72px 이라 짧은 이름이 필요하다 — 그래도 어휘는 도구막대와 같은
// 계열을 쓴다(uiCopy TOOL_LABEL). "브러시/지우개/스포이트" 는 RM 도구 스트립 어휘였다.
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
 * 레이어마다 다른 글리프를 쓴다 — 72px 레일에서 아이콘이 1차 스캔 대상인데 같은 그림 3개는
 * 정보량이 0 이었다(tileToolbarIcons 의 layerGround/layerOverlay/layerEvent).
 * 기본 모드는 결과 중심 용어를 쓴다 — 초보에게 '하위/상위 레이어'는 개념 장벽이다. */
const BASIC_LAYERS: readonly BasicLayerRow[] = [
  { id: "lower", label: "바닥", hint: "잔디·길 등 지면을 칠하는 레이어", hotkey: "F5", icon: "layerGround" },
  // "장식"은 타일 **분류** 이름과 겹친다(팔레트 필터 칩 · tileMeta role) → 덧그림.
  { id: "upper", label: "덧그림", hint: "나무·가구 등 바닥 위에 얹는 레이어", hotkey: "F6", icon: "layerOverlay" },
  { id: "event", label: "이벤트", hint: "NPC·문·보물상자 등 상호작용 레이어", hotkey: "F7", icon: "layerEvent" },
] as const;

const BASIC_TILE_CAP = 48;
const FLYOUT_TITLES: Record<BasicFlyoutId, string> = { tiles: "타일", maps: "맵" };
const RAIL_GROUP_LABELS = { tools: "그리기 도구", layers: "레이어", panels: "타일·맵 패널" } as const;
const EVENT_LAYER_TILE_REASON = "이벤트 레이어에서는 타일을 선택하지 않습니다";
const FLYOUT_TOGGLE_TESTIDS: Record<BasicFlyoutId, string> = {
  tiles: "basic-rail-toggle-tiles",
  maps: "basic-rail-toggle-maps",
};

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
}

export function renderBasicLeftRail(container: HTMLElement): void {
  const focusSnapshot = captureFocus(container);
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
  if (flyoutState.open) {
    shell.append(makeFlyout(flyoutState.open, state.selectedTile, state.layer, tileset));
  }
  container.append(shell);
  restoreFocus(container, focusSnapshot);
  // 도구·레이어·패널 그룹을 각각 한 개의 탭 스톱으로 만들고 화살표 이동을 준다 — 표준 모드
  // 도구막대와 같은 헬퍼다(이전엔 레일 버튼 11개가 전부 별도 탭 스톱이었다).
  applyRovingTabindex(container);
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
              // 2026-08-18 UX 리뷰 P2-8 은 칠하기를 누를 때마다 플라이아웃을 열었다 — 그래서
              // 방금 닫은 사용자에게 다시 들이밀었고 DESIGN.md:417 과도 어긋났다. 칠할 타일이
              // 아직 없을 때만 연다: 원래 목표였던 "칠할 것을 못 고르는 상태"만 해소한다(U-4).
              if (flyoutState.open !== "tiles" && !hasUsableSelectedTile()) dispatchFlyout({ type: "toggle", id: "tiles" });
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

/**
 * 지금 칠할 수 있는 타일이 이미 골라지 있는가 — 칠하기 도구가 타일 플라이아웃을 여는 유일한 이유.
 * 현재 맵의 타일셋 범위 안에 있어야 "쓸 수 있는" 선택이다.
 */
function hasUsableSelectedTile(): boolean {
  const state = editorState.get();
  const project = store.getCurrent();
  const map = project.maps[state.currentMapId ?? project.startMapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!tileset) return false;
  return state.selectedTile >= 0 && state.selectedTile < tileset.count;
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
    class: "basic-rail-btn basic-rail-tile-toggle" + (flyoutState.open === "tiles" ? " is-open" : ""),
    attrs: {
      type: "button",
      title: tileDisabledReason ?? `타일 — 현재: ${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}`,
      "aria-label": "타일 패널",
      "aria-expanded": String(flyoutState.open === "tiles"),
    },
    dataset: { testid: "basic-rail-toggle-tiles" },
    on: { click: () => { if (!tileDisabled) dispatchFlyout({ type: "toggle", id: "tiles" }); } },
    children: [
      el("span", { class: "basic-rail-tile-thumb", attrs: { style: tileThumbStyle, "aria-hidden": "true" } }),
      el("span", { class: "basic-rail-label", text: "타일" }),
    ],
  });
  if (tileDisabled) tileButton.setAttribute("disabled", "");
  wrap.append(tileButton);

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

function makeFlyout(id: BasicFlyoutId, selectedTile: number, activeLayer: Layer, tileset: TilesetDef | undefined): HTMLElement {
  const body = el("div", { class: "basic-flyout-content" });
  if (id === "tiles") {
    if (activeLayer === "event") {
      body.append(el("div", { class: "basic-rail-hint", text: "이벤트 레이어 — 타일 대신 이벤트를 배치합니다.", dataset: { testid: "basic-event-layer-hint" } }));
    } else if (!tileset) {
      body.append(el("div", { class: "empty-hint", text: uiLabel("tilesetMissing") }));
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
    // 닫기는 포커스된 버튼 자신을 지우므로, 이 플라이아웃을 연 토글을 대체 앵커로 넣는다
    // (B-4: 이전엔 포커스가 <body> 로 추락해 키보드 사용자가 자리를 잃었다).
    anchorTestId: FLYOUT_TOGGLE_TESTIDS[id],
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
      text: selectedTile >= 0 && selectedTile < tileset.count ? `${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}` : "공백",
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
            // 고르면 물러난다 — 이 플라이아웃은 캔버스를 덮으므로 열려 있으면 방금 고른 타일을
            // 가려진 자리에 칠할 수 없다. 계속 고르고 싶으면 핀을 쓴다(dismiss 는 핀을 존중).
            // 예전에는 isStaleFlyoutState 오진이 이 닫기를 «우연히» 해 주고 있었다.
            dispatchFlyout({ type: "dismiss" });
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
