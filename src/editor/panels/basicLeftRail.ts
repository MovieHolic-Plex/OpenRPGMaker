// editor/panels/basicLeftRail.ts
// 초보 「그리기」 탭: 아이콘 도구 한 줄 + 붓 상태 한 줄 + 상시 타일 팔레트(이벤트 레이어면 이벤트 목록).
// 스펙: docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md §2,
//       2026-09-24 사이드바 정리(탭 하나 = 질문 하나 — 「무엇으로 그리지?」).
// - 도구 6개는 기존 data-testid(tool-*)를 유지한다. 라벨은 DOM 에 남기고 화면에서는 아이콘만 보인다.
// - 맵 고르기는 사이드바 「맵」 탭 하나가 집이다. 예전 하단 맵 필드·맵 플라이아웃·「타일」「맵」 지름길은
//   같은 목록을 두 곳에 두고 탭 안에서 옆 탭을 다시 불러 걷었다.
// - 이벤트 레이어에서는 타일 도구(칠하기·지우기·채우기·집기)를 숨긴다 — 누를 수 없는 것은 보이지 않는다.
// - 상태는 모듈 레벨(재렌더에도 유지), 문서 리스너는 1회만 설치.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { makeTileBrushControls } from "@/editor/panels/tilePaletteStampStatus";
import { dismissLocationDrawModeForTool, isLocationDrawMode } from "@/editor/locationDrawMode";
import { selectMapModeTool, selectTileTool, selectPaletteStamp } from "@/editor/panels/tileToolbarActions";
import { uiLabel } from "@/editor/uiCopy";
import { getEditorChrome } from "@/editor/editorUiMode";
import { renderEventEditor } from "./eventEditor";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { canEditMap } from "@/editor/mapEditLocks";
import { makeBasicTilePalette, type BasicTilePaletteCache } from "@/editor/panels/basicTilePalette";
import { store } from "@/project/store";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { applyRovingTabindex, captureFocus, restoreFocus } from "@/editor/panels/sidebarFocus";
import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { eventAtPoint } from "@/project/eventFootprintQuery";

type BasicTool = {
  readonly id: Tool;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
  readonly hotkey: string;
  /** 타일을 다루는 도구 — 이벤트 레이어에서는 숨긴다. */
  readonly tileOnly?: boolean;
};

// 도구 이름은 결과 중심의 짧은 라벨로 표시한다.
const BASIC_TOOLS: readonly BasicTool[] = [
  { id: "select", label: "선택", hint: "영역 선택", icon: "select", hotkey: "V" },
  { id: "paint", label: "칠하기", hint: "고른 타일로 칠합니다", icon: "brush", hotkey: "B", tileOnly: true },
  { id: "erase", label: "지우기", hint: "이 레이어에서 지웁니다", icon: "eraser", hotkey: "E", tileOnly: true },
  { id: "fill", label: "채우기", hint: "이어진 영역을 채웁니다", icon: "fill", hotkey: "G", tileOnly: true },
  { id: "event", label: "장면", hint: "이벤트를 놓거나 고칩니다", icon: "event", hotkey: "N" },
  { id: "eyedropper", label: "집기", hint: "맵에 놓인 타일을 집습니다", icon: "eyedropper", hotkey: "I", tileOnly: true },
] as const;

const RAIL_GROUP_LABELS = { tools: "그리기 도구" } as const;

// 재렌더에도 살아남는 모듈 상태. tilePalette의 activeWorkTab 패턴과 동일.
let lastContainer: HTMLElement | null = null;
let tileSearchQuery = "";
let documentListenersInstalled = false;
const tilePaletteCache: BasicTilePaletteCache = {};

function installDocumentListeners(): void {
  if (documentListenersInstalled || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  documentListenersInstalled = true;
  // 되돌리기 단추의 켜짐은 맵 편집 기록이 정한다 — 기록이 바뀌면 레일을 다시 그린다.
  window.addEventListener(MAP_EDIT_HISTORY_EVENT, () => {
    if (getEditorChrome().paletteRail && lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
  });
}

export function resetBasicLeftRailForTests(): void {
  lastContainer = null;
  tileSearchQuery = "";
  tilePaletteCache.current = undefined;
}

export function renderBasicLeftRail(container: HTMLElement): void {
  if (lastContainer !== container) tilePaletteCache.current = undefined;
  const focusSnapshot = captureFocus(container);
  const previousSheet = container.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
  const scroll = { top: previousSheet?.scrollTop ?? 0, left: previousSheet?.scrollLeft ?? 0 };
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
  shell.append(makeToolsColumn(state.tool, state.layer));
  shell.append(makeStatusRow(makeTileBrushControls(state, () => renderBasicLeftRail(container))));
  if (state.pendingEventCoordinate && state.layer === "event" && state.tool === "event") {
    shell.append(makePendingEventCta(state.pendingEventCoordinate));
  }
  if (state.layer === "event") {
    renderEventEditor(shell);
  } else if (!tileset) {
    shell.append(el("div", { class: "empty-hint", text: uiLabel("tilesetMissing") }));
  }
  if (keepTilesInPlace && oldShell) {
    for (const child of Array.from(oldShell.children)) if (child !== tilesBody) child.remove();
    for (const child of Array.from(shell.children)) oldShell.insertBefore(child, tilesBody);
  } else {
    if (tilesBody) shell.append(tilesBody);
    clearChildren(container);
    container.append(shell);
  }

  restoreFocus(container, focusSnapshot);
  // 도구·붓 크기 그룹을 각각 한 개의 탭 스톱으로 만들고 화살표 이동을 준다 — 표준 모드
  // 도구막대와 같은 헬퍼다(이전엔 레일 버튼 11개가 전부 별도 탭 스톱이었다).
  applyRovingTabindex(container);
  const sheet = container.querySelector<HTMLElement>('[data-testid="basic-tile-grid"]');
  if (sheet) {
    sheet.scrollTop = scroll.top;
    sheet.scrollLeft = scroll.left;
  }
}

function makeToolsColumn(activeTool: Tool, layer: Layer): HTMLElement {
  const list = el("div", {
    class: "basic-rail-icons",
    dataset: { testid: "basic-tool-list", roving: "true" },
    attrs: { role: "toolbar", "aria-orientation": "horizontal", "aria-label": RAIL_GROUP_LABELS.tools },
  });
  for (const tool of BASIC_TOOLS) {
    if (layer === "event" && tool.tileOnly) continue;
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

/** 붓 상태(무엇으로 · 어느 레이어) 한 줄 + 되돌리기. 크기 단추는 크기가 뜻 있는 도구일 때만 붓 줄에 나온다. */
function makeStatusRow(brushControls: HTMLElement): HTMLElement {
  const undo = el("button", {
    class: "basic-rail-btn basic-rail-undo",
    attrs: { type: "button", "aria-label": "되돌리기", title: "되돌리기 (Ctrl+Z)" },
    dataset: { testid: "oprn-tool-undo" },
    children: [makeSvgIcon("undo"), el("span", { class: "basic-rail-label", text: "되돌리기" })],
    on: { click: () => { undoMapEdit(); } },
  });
  undo.disabled = !getMapEditHistoryState().canUndo;
  undo.setAttribute("aria-disabled", String(undo.disabled));
  return el("div", { class: "basic-rail-status", dataset: { testid: "basic-rail-status" }, children: [brushControls, undo] });
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
