// editor/panels/canvasToolPill.ts
// 캔버스 가운데 위에 뜨는 알약 하나 — 칠하기 · 사각형 · 채우기 · 화면 밀기 | 되돌리기 | 배율.
//
// 2026-11 개편(시안 mock-editor-*.png): 캔버스 위에 떠 있는 것은 이 알약 하나다. 예전 오른쪽 위 막대의
// 로케이션·배경 미리보기·걷기 전투·AI 빠른 작업·「더 보기」(격자·맵 PNG)와 왼쪽 아래 저작 여정은
// 처음 30분에 쓰지 않는 것이라 ⌘K 명령으로만 닿는다(commandRegistry.ts CANVAS_MOVED_COMMANDS).
// 코드는 지우지 않았다 — 명령이 같은 함수를 부른다.
//
// 상태는 editorState 하나다. 도구 단추는 tileToolbarActions 의 selectTileTool/selectMapModeTool 을
// 그대로 불러 단축키(B·G·Space·숫자)와 같은 전이를 탄다. testid 는 옛 계약(tool-paint·tool-fill·tool-pan,
// editor-zoom-*)을 이 알약이 가진다 — 왼쪽 도구 줄의 같은 두 단추는 palette-tool-paint/fill 로 물러났다(한 화면에
// 같은 testid 가 둘이면 Playwright strict 모드가 깨진다). 되돌리기는 왼쪽 쌍이 oprn-tool-undo 를 지키므로 canvas-tool-undo.
import { editorState, EDITOR_ZOOM_LEVELS, type EditorState, type EditorZoom } from "@/editor/editorState";
import { runUndoWithFeedback } from "@/editor/hotkeys";
import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, pendingHistoryLabels } from "@/editor/mapEditHistory";
import { isLocationDrawMode } from "@/editor/locationDrawMode";
import { layerUiLabel, toolLabel } from "@/editor/uiCopy";
import { selectMapModeTool, selectTileTool, isTileToolbarItemActive } from "@/editor/panels/tileToolbarActions";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { runWhenPointerReleased } from "@/editor/pointerStrokeGate";
import { clearChildren, el } from "@/util/dom";

const SVG_NS = "http://www.w3.org/2000/svg";

const PILL_ICONS = {
  paint: "M10 2l4 4-6.5 6.5H3.5v-4z",
  rect: "",
  fill: "M3 7l5-5 5 5-5 5z M13.5 10.5c0 1-.7 2-1.5 2s-1.5-1-1.5-2 1.5-2.5 1.5-2.5 1.5 1.5 1.5 2.5z",
  pan: "M5 8V3.5a1 1 0 012 0V7 M7 6.5V2.5a1 1 0 012 0V7 M9 7V3.5a1 1 0 012 0V9c0 3-2 5-4.5 5S3 12 2.5 10L2 8.5a1 1 0 011.8-.8L5 9.5",
  undo: "M4 6.5h6a3.5 3.5 0 010 7H7 M6.5 3.5L3.5 6.5l3 3",
} as const;

function pillIcon(name: keyof typeof PILL_ICONS): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", "canvas-tool-pill-icon");
  if (name === "rect") {
    const rect = document.createElementNS(SVG_NS, "rect");
    for (const [key, value] of Object.entries({ x: "2.5", y: "3.5", width: "11", height: "9", rx: "1" })) rect.setAttribute(key, value);
    svg.append(rect);
  } else {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", PILL_ICONS[name]);
    svg.append(path);
  }
  return svg;
}

type PillTool = {
  readonly id: "paint" | "rect" | "fill" | "pan";
  readonly label: string;
  readonly hotkey?: string;
  readonly active: (state: EditorState) => boolean;
  readonly select: () => void;
};

// 「사각형」은 칠하기의 모양(paintShape rect)이다 — 영역 선택(V)은 칠하지 않는 사각형이라 처음 쓰는 사람이 헷갈린다.
// 영역 선택·지우기·타일 집기는 단축키(V·E·I)와 ⌘K 「도구: …」 명령으로 닿는다.
const PILL_TOOLS: readonly PillTool[] = [
  { id: "paint", label: toolLabel("paint"), hotkey: "B", active: (s) => isTileToolbarItemActive("pen", s.tool, s.paintShape), select: () => selectTileTool("pen") },
  { id: "rect", label: "사각형으로 칠하기", active: (s) => isTileToolbarItemActive("rect", s.tool, s.paintShape), select: () => selectTileTool("rect") },
  { id: "fill", label: toolLabel("fill"), hotkey: "G", active: (s) => isTileToolbarItemActive("fill", s.tool, s.paintShape), select: () => selectTileTool("fill") },
  { id: "pan", label: toolLabel("pan"), hotkey: "Space", active: (s) => !isLocationDrawMode() && s.tool === "pan", select: () => selectMapModeTool("pan") },
];

function tooltip(label: string, hotkey: string | undefined): string {
  return hotkey ? `${label} (${hotkey})` : label;
}

export function stepEditorZoom(delta: number, levels: readonly EditorZoom[], current: EditorZoom): EditorZoom {
  const index = Math.max(0, levels.indexOf(current));
  const next = index + delta;
  if (next < 0) return levels[0] ?? current;
  if (next >= levels.length) return levels[levels.length - 1] ?? current;
  return levels[next] ?? current;
}

export function zoomPercentLabel(zoom: EditorZoom): string {
  return `${Math.round(zoom * 100)}%`;
}

const pillRenderMemo = new WeakMap<HTMLElement, { readonly key: string; readonly first: Element | null }>();

function pillKey(state: EditorState): string {
  const history = getMapEditHistoryState();
  return [
    state.zoom,
    state.tool,
    state.paintShape,
    state.layer,
    isLocationDrawMode() ? 1 : 0,
    history.canUndo ? 1 : 0,
    pendingHistoryLabels().undo ?? "",
  ].join("|");
}

let historyListenerHost: HTMLElement | null = null;

/** 되돌리기 가능 여부는 editorState 가 아니라 히스토리 스택이 바꾼다 — 그 통지에도 알약을 맞춘다. */
function installHistoryRefresh(container: HTMLElement): void {
  if (historyListenerHost === container) return;
  const first = historyListenerHost === null;
  historyListenerHost = container;
  if (!first || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  window.addEventListener(MAP_EDIT_HISTORY_EVENT, () => runWhenPointerReleased(() => {
    if (historyListenerHost?.isConnected) renderCanvasToolPill(historyListenerHost);
  }));
}

/**
 * 알약을 container 안에 그린다. 출력은 (배율 · 도구 · 붓 모양 · 레이어 · 구역 그리기 · 되돌리기 가능)의 함수라
 * 같은 입력이면 DOM 을 그대로 둔다(칠하기 통지가 초당 수십 번 와도 단추를 다시 만들지 않는다).
 */
export function renderCanvasToolPill(container: HTMLElement): void {
  installHistoryRefresh(container);
  const state = editorState.get();
  const key = pillKey(state);
  const memo = pillRenderMemo.get(container);
  if (memo && memo.key === key && memo.first !== null && container.firstElementChild === memo.first && memo.first.isConnected) return;
  const zoomMenuWasOpen = container.querySelector(".canvas-tool-pill-zoom.is-menu-open") !== null;
  clearChildren(container);
  container.classList.add("canvas-tool-pill");
  container.setAttribute("role", "toolbar");
  container.setAttribute("aria-label", "캔버스 도구");

  // 이벤트 레이어에서는 타일 도구가 맞지 않는다 — 고르면 타일 레이어로 나가지만, 보여 줄 때는 숨겨 한 줄을 짧게 둔다.
  if (state.layer !== "event") {
    for (const tool of PILL_TOOLS) {
      const active = tool.active(state);
      container.append(el("button", {
        class: "canvas-tool-pill-button" + (active ? " is-active" : ""),
        children: [pillIcon(tool.id)],
        attrs: {
          type: "button",
          "aria-label": tool.label,
          "aria-pressed": String(active),
          title: tooltip(tool.label, tool.hotkey),
          ...(active ? { "aria-current": "true" } : {}),
        },
        dataset: { testid: `tool-${tool.id}` },
        on: { click: tool.select },
      }));
    }
    container.append(el("span", { class: "canvas-tool-pill-divider", attrs: { "aria-hidden": "true" } }));
  }

  const canUndo = getMapEditHistoryState().canUndo;
  const pending = pendingHistoryLabels().undo;
  const undoName = canUndo && pending ? `되돌리기: ${pending}` : "되돌리기";
  const undo = el("button", {
    class: "canvas-tool-pill-button",
    children: [pillIcon("undo")],
    attrs: { type: "button", "aria-label": undoName, title: `${undoName} (Ctrl+Z / ⌘Z)` },
    dataset: { testid: "canvas-tool-undo" },
    on: { click: () => { runUndoWithFeedback(); } },
  }) as HTMLButtonElement;
  undo.disabled = !canUndo;
  container.append(undo, makeZoomControl(state.zoom, zoomMenuWasOpen));
  installDelayedTooltips(container);
  pillRenderMemo.set(container, { key, first: container.firstElementChild });
}

/** 「200%」 글자 단추 — 누르면 배율 목록이 아래에 뜬다. −/+ 는 목록 맨 위 한 줄에 둔다. */
function makeZoomControl(current: EditorZoom, openInitially: boolean): HTMLElement {
  const group = el("div", {
    class: "canvas-tool-pill-zoom",
    attrs: { role: "group", "aria-label": "캔버스 확대" },
    dataset: { testid: "editor-zoom-group" },
  });
  const trigger = el("button", {
    class: "canvas-tool-pill-zoom-current",
    text: zoomPercentLabel(current),
    attrs: { type: "button", title: "배율 목록", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": `배율 ${zoomPercentLabel(current)}` },
    dataset: { testid: "editor-zoom-stepper" },
    on: { click: () => (group.classList.contains("is-menu-open") ? closeZoomMenu(group) : openZoomMenu(group)) },
  });
  const step = (delta: number): void => {
    closeZoomMenu(group);
    editorState.set({ zoom: stepEditorZoom(delta, EDITOR_ZOOM_LEVELS, current) });
  };
  const menu = el("div", {
    class: "canvas-tool-pill-zoom-menu",
    attrs: { role: "menu", "aria-label": "배율" },
    dataset: { testid: "editor-zoom-menu" },
    children: [
      el("div", {
        class: "canvas-tool-pill-zoom-steps",
        children: [
          el("button", { class: "canvas-tool-pill-zoom-item", text: "−", attrs: { type: "button", role: "menuitem", "aria-label": "축소", title: "축소" }, dataset: { testid: "editor-zoom-prev" }, on: { click: () => step(-1) } }),
          el("button", { class: "canvas-tool-pill-zoom-item", text: "+", attrs: { type: "button", role: "menuitem", "aria-label": "확대", title: "확대" }, dataset: { testid: "editor-zoom-next" }, on: { click: () => step(1) } }),
        ],
      }),
      ...EDITOR_ZOOM_LEVELS.map((zoom) => el("button", {
        class: "canvas-tool-pill-zoom-item" + (zoom === current ? " active" : ""),
        text: zoomPercentLabel(zoom),
        attrs: { type: "button", role: "menuitemradio", "aria-checked": String(zoom === current), "aria-label": `${zoomPercentLabel(zoom)} 배율` },
        dataset: { testid: `editor-zoom-${zoom}` },
        on: { click: () => { closeZoomMenu(group); editorState.set({ zoom }); } },
      })),
    ],
  });
  group.append(trigger, menu);
  if (openInitially) openZoomMenu(group);
  return group;
}

let detachZoomMenuDismiss: (() => void) | null = null;

/**
 * 배율 목록은 팝오버다 — Escape 와 바깥 누름으로 닫히고, 그 바깥 누름은 닫기에만 쓰인다(캔버스를 칠하지 않는다).
 * 옛 막대(editorZoomToolbar.ts openZoomMenu)와 같은 계약이다.
 */
function openZoomMenu(group: HTMLElement): void {
  detachZoomMenuDismiss?.();
  group.classList.add("is-menu-open");
  group.querySelector("[data-testid='editor-zoom-stepper']")?.setAttribute("aria-expanded", "true");
  const swallowClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (!group.isConnected) {
      detachZoomMenuDismiss?.();
      return;
    }
    if (event.target instanceof Node && group.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    closeZoomMenu(group);
    window.addEventListener("click", swallowClick, { capture: true, once: true });
    window.addEventListener("pointerdown", () => window.removeEventListener("click", swallowClick, { capture: true }), { capture: true, once: true });
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeZoomMenu(group);
    group.querySelector<HTMLElement>("[data-testid='editor-zoom-stepper']")?.focus();
  };
  window.addEventListener("pointerdown", onPointerDown, { capture: true });
  window.addEventListener("keydown", onKeyDown, { capture: true });
  detachZoomMenuDismiss = () => {
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    detachZoomMenuDismiss = null;
  };
}

function closeZoomMenu(group: HTMLElement): void {
  detachZoomMenuDismiss?.();
  group.classList.remove("is-menu-open");
  group.querySelector("[data-testid='editor-zoom-stepper']")?.setAttribute("aria-expanded", "false");
}

/**
 * 캔버스 왼쪽 아래의 옅은 상태 글자 「x 18 · y 12 · 바닥 레이어」. 좌표는 EditScene 이 포인터마다 쓰는
 * 숨은 진단 노드(cursor-position)를 따라간다. 좌표 조각은 번역하지 않고(translate=no) 레이어 이름 조각은
 * DOM 번역 계층이 번역한다 — 그래서 화면 글자를 다시 읽지 않고 마지막에 쓴 값만 기억한다.
 */
export function formatCanvasCoordinate(position: string): string {
  const match = /^(\d+),(\d+)$/.exec(position);
  return match ? `x ${match[1]} · y ${match[2]} · ` : "";
}

export function canvasStatusLayerText(layer: EditorState["layer"]): string {
  return `${layerUiLabel(layer)} 레이어`;
}

export function mountCanvasStatus(host: HTMLElement, positionNode: HTMLElement): () => void {
  const coordinate = el("span", { class: "canvas-status-coordinate", attrs: { translate: "no" }, dataset: { testid: "canvas-status-coordinate" } });
  const layer = el("span", { class: "canvas-status-layer", dataset: { testid: "canvas-status-layer" } });
  host.append(coordinate, layer);
  let lastCoordinate: string | null = null;
  let lastLayer: string | null = null;
  const paint = (): void => {
    const nextCoordinate = formatCanvasCoordinate(positionNode.textContent ?? "");
    const nextLayer = canvasStatusLayerText(editorState.get().layer);
    if (nextCoordinate !== lastCoordinate) { coordinate.textContent = nextCoordinate; lastCoordinate = nextCoordinate; }
    if (nextLayer !== lastLayer) { layer.textContent = nextLayer; lastLayer = nextLayer; }
  };
  paint();
  const observer = typeof MutationObserver === "function" ? new MutationObserver(paint) : null;
  observer?.observe(positionNode, { characterData: true, childList: true, subtree: true });
  const unsubscribe = editorState.subscribe(paint);
  return () => {
    observer?.disconnect();
    unsubscribe();
  };
}

export function resetCanvasToolPillForTests(): void {
  detachZoomMenuDismiss?.();
  historyListenerHost = null;
}
