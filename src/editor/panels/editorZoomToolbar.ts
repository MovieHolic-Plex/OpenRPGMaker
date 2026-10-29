import { makeSvgIcon } from "./tileToolbarIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { EDITOR_ZOOM_LEVELS, editorState, type EditorZoom } from "@/editor/editorState";
import { createMapScreenshot, MapScreenshotError, type MapScreenshot } from "@/editor/mapScreenshot";
import { renderCanvasAiWorkbench } from "@/editor/panels/canvasAiWorkbench";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { openWalkEncounterList } from "@/editor/panels/walkEncounterModal";
import { locationLayerState, toggleLocationLayer } from "@/editor/mapLocationLayerState";
import { mapBackgroundPreviewEnabled, toggleMapBackgroundPreview } from "@/editor/mapBackgroundPreviewState";

let mapScreenshotRequestSeq = 0;

const SVG_NS = "http://www.w3.org/2000/svg";
/** 확대·축소 단추의 − / + 글자 대신 currentColor 선 아이콘(16px). */
function strokeIcon(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}

export const CANVAS_TOOLBAR_EXPANDED_KEY = "oprn:canvas-toolbar-expanded";

export function stepEditorZoom(delta: number, levels: readonly EditorZoom[], current: EditorZoom): EditorZoom {
  const index = Math.max(0, levels.indexOf(current));
  const next = index + delta;
  if (next < 0) return levels[0] ?? current;
  if (next >= levels.length) return levels[levels.length - 1] ?? current;
  return levels[next] ?? current;
}

/**
 * 도구막대 출력은 (배율 · 로케이션 켬 · 배경 미리보기 켬 · 펼침) 넷의 함수다. 타일 칠하기처럼 이 넷이 안 바뀌는
 * store 통지가 초당 수십 번 와도 같은 DOM 을 그대로 둔다 — 예전엔 매 통지마다 버튼 20여 개 + 툴팁 설치를 통째로
 * 다시 만들었다(2026-09-30 실측: 22칸 스트로크 = 툴바 변이 594건). 컨테이너의 첫 자식이 지난번 우리가 만든 것이
 * 아니면(외부가 비웠거나 갈아끼움) 키가 같아도 다시 만든다.
 */
const toolbarRenderMemo = new WeakMap<HTMLElement, { readonly key: string; readonly first: Element | null }>();

export function renderCanvasToolbar(container: HTMLElement): void {
  const currentZoom = editorState.get().zoom;
  const showGrid = editorState.get().showGrid;
  const key = `${currentZoom}|${locationLayerState().enabled ? 1 : 0}|${mapBackgroundPreviewEnabled() ? 1 : 0}|${readCanvasToolbarExpanded() ? 1 : 0}|${showGrid ? 1 : 0}`;
  const memo = toolbarRenderMemo.get(container);
  if (memo && memo.key === key && memo.first !== null && container.firstElementChild === memo.first && memo.first.isConnected) return;
  clearChildren(container);
  container.dataset.uiDensity = "expert";
  container.classList.add("is-zoom-stepper", "is-icon-toolbar");
  container.setAttribute("role", "toolbar");
  container.setAttribute("aria-label", "맵 도구바");
  container.classList.toggle("is-expanded", readCanvasToolbarExpanded());

  const levels = EDITOR_ZOOM_LEVELS;
  const zoomGroup = el("div", {
    class: "canvas-toolbar-zoom-group is-stepper",
    attrs: { "aria-label": "캔버스 확대", role: "group" },
    dataset: { testid: "editor-zoom-group" },
  });
  zoomGroup.append(
    el("button", {
      class: "oprn-tool-button zoom-stepper-btn",
      children: [strokeIcon("M3.5 8h9")],
      attrs: { type: "button", title: "축소", "aria-label": "축소" },
      dataset: { testid: "editor-zoom-prev" },
      on: { click: () => editorState.set({ zoom: stepEditorZoom(-1, levels, currentZoom) }) },
    }),
    el("button", {
      class: "oprn-tool-button zoom-stepper-current",
      text: `${currentZoom}x`,
      attrs: { type: "button", title: "배율 목록", "aria-expanded": "false", "aria-label": `현재 ${currentZoom}배` },
      dataset: { testid: "editor-zoom-stepper" },
      on: {
        click: () => {
          if (zoomGroup.classList.contains("is-menu-open")) closeZoomMenu(zoomGroup);
          else openZoomMenu(zoomGroup);
        },
      },
    }),
    el("button", {
      class: "oprn-tool-button zoom-stepper-btn",
      children: [strokeIcon("M3.5 8h9M8 3.5v9")],
      attrs: { type: "button", title: "확대", "aria-label": "확대" },
      dataset: { testid: "editor-zoom-next" },
      on: { click: () => editorState.set({ zoom: stepEditorZoom(1, levels, currentZoom) }) },
    }),
  );
  const menu = el("div", {
    class: "canvas-toolbar-zoom-menu",
    dataset: { testid: "editor-zoom-menu" },
  });
  for (const zoom of levels) {
    menu.append(
      el("button", {
        class: "oprn-tool-button zoom-button" + (currentZoom === zoom ? " active" : ""),
        text: `${zoom}x`,
        attrs: { title: `${zoom}배 확대`, "aria-label": `${zoom}배 확대`, "aria-pressed": String(currentZoom === zoom) },
        dataset: { testid: `editor-zoom-${zoom}` },
        on: { click: () => { closeZoomMenu(zoomGroup); editorState.set({ zoom }); } },
      }),
    );
  }
  zoomGroup.append(menu);
  container.append(el("button", {
    class: "btn walk-encounter-list-button", children: [makeSvgIcon("combat")],
    attrs: { type: "button", title: "범위 목록 · 추가 · 편집 · 삭제" },
    dataset: { testid: "walk-encounter-list-open" }, on: { click: openWalkEncounterList },
  }));
  // 로케이션 레이어는 모든 편집 모드에서 같은 자리에 있다 — 이벤트 조건·인카운터·조수가
  // 공유하는 층이라 전문가 전용으로 숨기면 애초에 만들어지지 않는다.
  const locationLayerOn = locationLayerState().enabled;
  container.append(el("button", {
    class: `btn map-location-layer-button${locationLayerOn ? " is-active" : ""}`,
    children: [makeSvgIcon("pin")],
    attrs: {
      type: "button",
      title: locationLayerOn
        ? "로케이션 켜짐 — 맵 위에 이름 붙은 구역(로케이션)이 보이고, 드래그하면 새로 그립니다. 타일 칠하기는 이 버튼을 끄거나 브러시를 다시 고르면 돌아옵니다."
        : "로케이션 보기·그리기 — 켜면 이름 붙은 구역(로케이션)이 맵 위에 보이고 드래그로 새로 그립니다. 이벤트 조건과 랜덤 인카운터가 그 이름을 가리킬 수 있습니다.",
      "aria-pressed": String(locationLayerOn),
      ...(locationLayerOn ? { "aria-current": "true" } : {}),
    },
    dataset: { testid: "map-location-layer-toggle" },
    on: { click: () => toggleLocationLayer() },
  }));
  // 맵 배경 미리보기는 기본값이 «꺼짐» 이다 — 빈 칸 체커가 "바닥 없음" 신호를 계속 말해야 하고,
  // 켜면 그 체커가 옅어지며 뒤의 배경이 비친다. 팔레트와 무관한 «보기» 축이라 로케이션과 같은 줄에 둔다.
  const backgroundPreviewOn = mapBackgroundPreviewEnabled();
  container.append(el("button", {
    class: `btn map-background-preview-button${backgroundPreviewOn ? " is-active" : ""}`,
    children: [makeSvgIcon("image")],
    attrs: {
      type: "button",
      title: backgroundPreviewOn
        ? "맵 배경 미리보기가 켜져 있습니다. 빈 칸 체커가 옅게 그려지고 그 뒤로 배경 그림이 보입니다. 끄면 체커가 원래대로 돌아옵니다."
        : "맵 배경 미리보기 — 켜면 「맵 배경」 탭에서 고른 그림을 캔버스에서 확인할 수 있습니다(플레이와 같이 화면 고정). 빈 칸 체커는 옅어진 채로 남습니다.",
      "aria-pressed": String(backgroundPreviewOn),
      ...(backgroundPreviewOn ? { "aria-current": "true" } : {}),
    },
    dataset: { testid: "map-background-preview-toggle" },
    on: { click: () => toggleMapBackgroundPreview() },
  }));
  // 배율 · ⋯ 펼치기 · AI 빠른 작업 · 격자 · 맵 저장.
  // 격자는 잘 안 끄는 보기 옵션이라 ⋯ 펼침 안에 둔다. 상태는 editorState.showGrid(기본 켜짐) 하나다.
  // 「더 보기」는 막대 안에 펼치지 않고 단추 아래 떠 있는 판으로 연다 — 막대 폭이 그대로라 같은 자리를 다시 눌러도 같은 단추다.
  const saveAction = el("div", {
    class: "canvas-toolbar-save-group",
    attrs: { "aria-label": "맵 보기 · 이미지 저장", role: "group", id: "canvas-toolbar-more" },
    dataset: { testid: "editor-map-save-group", uiDensity: "expert" },
    children: [
      el("button", {
        class: "oprn-tool-button map-grid-toggle",
        children: [makeSvgIcon("grid"), el("span", { class: "canvas-toolbar-more-label", text: "격자" })],
        attrs: {
          type: "button",
          title: showGrid ? "격자 숨기기" : "격자 보이기",
          "aria-label": "격자 보이기/숨기기",
          "aria-pressed": String(showGrid),
        },
        dataset: { testid: "editor-grid-toggle" },
        on: { click: () => editorState.set({ showGrid: !editorState.get().showGrid }) },
      }),
      el("button", {
        class: "oprn-tool-button map-save-button",
        children: [makeSvgIcon("image"), el("span", { class: "canvas-toolbar-more-label", text: "맵 저장 (PNG 그림)" })],
        attrs: { type: "button", title: "현재 맵만 PNG로 저장", "aria-label": "현재 맵만 PNG로 저장" },
        dataset: { testid: "editor-map-screenshot-button" },
        on: { click: () => void downloadCurrentMapScreenshot() },
      }),
    ],
  });
  const aiWorkbench = renderCanvasAiWorkbench();
  const setExpanded = (expanded: boolean, persist = true): void => {
    container.classList.toggle("is-expanded", expanded);
    expandButton.setAttribute("aria-expanded", String(expanded));
    if (persist) writeCanvasToolbarExpanded(expanded);
    if (expanded) attachMoreDismiss(container, () => { setExpanded(false); expandButton.focus(); }, () => setExpanded(false));
    else detachMoreDismiss?.();
  };
  const expandButton = el("button", {
      class: "canvas-toolbar-expand",
      children: [makeSvgIcon("more")],
      attrs: { type: "button", title: "더 보기 — 격자 · 맵 그림 저장", "aria-label": "더 보기", "aria-controls": "canvas-toolbar-more", "aria-expanded": String(container.classList.contains("is-expanded")) },
      dataset: { testid: "editor-canvas-toolbar-expand", uiDensity: "expert" },
      on: { click: () => setExpanded(!container.classList.contains("is-expanded")) },
    });
  if (container.classList.contains("is-expanded")) attachMoreDismiss(container, () => { setExpanded(false); expandButton.focus(); }, () => setExpanded(false));
  container.append(zoomGroup, aiWorkbench, expandButton, saveAction);
  installDelayedTooltips(container);
  toolbarRenderMemo.set(container, { key, first: container.firstElementChild });
  // 처음 그릴 때는 막대가 아직 문서에 붙기 전일 수 있다 — 붙은 뒤 한 프레임에 맞춘다.
  fitCanvasToolbar(container);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      observeToolbarFit(container);
      fitCanvasToolbar(container);
    });
  }
}

/** 막대에서 「더 보기」 판으로 옮길 수 있는 단추에 붙이는 짧은 이름(판 안에서는 아이콘 옆에 글자로 보인다). */
const OVERFLOW_LABELS: Readonly<Record<string, string>> = {
  "walk-encounter-list-open": "인카운터 범위",
  "map-location-layer-toggle": "로케이션",
  "map-background-preview-toggle": "배경 미리보기",
};

type OverflowMove = { readonly node: HTMLElement; readonly parent: HTMLElement; readonly next: Node | null };
const toolbarOverflow = new WeakMap<HTMLElement, OverflowMove[]>();
const toolbarFitObservers = new WeakMap<HTMLElement, ResizeObserver>();

/**
 * 막대가 캔버스 폭을 넘으면 두 줄로 접지 않고, 끝에서부터 단추를 「더 보기」 판으로 옮긴다(조수 AI 빠른 작업 → 보기 단추 순).
 * 폭이 다시 넓어지면 제자리로 돌려놓는다. 옮긴 단추는 같은 노드라 동작·상태가 그대로다.
 */
function fitCanvasToolbar(container: HTMLElement): void {
  const more = container.querySelector<HTMLElement>(".canvas-toolbar-save-group");
  if (!more || !container.isConnected) return;
  const moved = toolbarOverflow.get(container) ?? [];
  for (const move of moved.reverse()) {
    move.node.classList.remove("is-overflow-item");
    move.node.querySelector(":scope > .canvas-toolbar-overflow-label")?.remove();
    move.parent.insertBefore(move.node, move.next && move.next.parentNode === move.parent ? move.next : null);
  }
  const nextMoves: OverflowMove[] = [];
  toolbarOverflow.set(container, nextMoves);
  const workbench = container.querySelector<HTMLElement>(".canvas-ai-workbench");
  const candidates: HTMLElement[] = [
    ...(workbench ? Array.from(workbench.children).filter((child): child is HTMLElement => child instanceof HTMLElement).reverse() : []),
    ...["map-background-preview-toggle", "map-location-layer-toggle", "walk-encounter-list-open"]
      .map((testid) => container.querySelector<HTMLElement>(`:scope > [data-testid="${testid}"]`))
      .filter((node): node is HTMLElement => node !== null),
  ];
  // 막대가 내용 폭으로 늘어나는 배치(max-content)도 있어, 자기 넘침과 캔버스 폭(좌우 여백 12px씩) 둘 다 본다.
  const host = container.parentElement;
  const overflowing = (): boolean => container.scrollWidth > container.clientWidth + 1
    || (host !== null && container.getBoundingClientRect().width > host.getBoundingClientRect().width - 24);
  let firstMoreItem: Node | null = more.firstChild;
  while (overflowing() && candidates.length > 0) {
    const node = candidates.shift()!;
    nextMoves.push({ node, parent: node.parentElement as HTMLElement, next: node.nextSibling });
    const shortLabel = OVERFLOW_LABELS[node.dataset.testid ?? ""];
    if (shortLabel) node.append(el("span", { class: "canvas-toolbar-more-label canvas-toolbar-overflow-label", text: shortLabel }));
    node.classList.add("is-overflow-item");
    more.insertBefore(node, firstMoreItem);
    firstMoreItem = node;
  }
  container.classList.toggle("has-overflow-items", nextMoves.length > 0);
}

function observeToolbarFit(container: HTMLElement): void {
  if (toolbarFitObservers.has(container) || typeof ResizeObserver === "undefined") return;
  const host = container.parentElement;
  if (!host || !container.isConnected) return;
  let frame = 0;
  const schedule = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fitCanvasToolbar(container);
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(host);
  observer.observe(container);
  toolbarFitObservers.set(container, observer);
  // 좁은 창에서 조수 도크를 펴면 캔버스 크기는 그대로이고 막대의 최대 폭만 줄어든다(32-ai-workspace.css) — 도크 접힘 상태도 본다.
  const dock = document.querySelector(".ai-right-dock");
  if (dock && typeof MutationObserver !== "undefined") {
    new MutationObserver(schedule).observe(dock, { attributes: true, attributeFilter: ["class"] });
  }
}

/** 열린 「더 보기」 판을 닫는 문서 리스너(Escape · 막대 바깥 누름). */
let detachMoreDismiss: (() => void) | null = null;

function attachMoreDismiss(container: HTMLElement, onEscape: () => void, onOutside: () => void): void {
  detachMoreDismiss?.();
  const onPointerDown = (event: PointerEvent): void => {
    if (!container.isConnected) { detachMoreDismiss?.(); return; }
    if (event.target instanceof Node && container.contains(event.target)) return;
    onOutside();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !container.classList.contains("is-expanded")) return;
    event.preventDefault();
    event.stopPropagation();
    onEscape();
  };
  window.addEventListener("pointerdown", onPointerDown, { capture: true });
  window.addEventListener("keydown", onKeyDown, { capture: true });
  detachMoreDismiss = () => {
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    detachMoreDismiss = null;
  };
}

/** 열린 배율 목록을 닫는 문서 리스너. 목록은 한 번에 하나만 열린다. */
let detachZoomMenuDismiss: (() => void) | null = null;

/**
 * 배율 목록은 팝오버다 — Escape 와 바깥 누름으로 닫히고, 그 바깥 누름은 닫기에만 쓰인다.
 * 예전에는 배율을 고르는 것 말고는 닫을 길이 없었고, 열린 채 캠버스를 누르면 타일이 칠해졌다.
 * Phaser 는 mousedown 을 듣는다. pointerdown 의 preventDefault 가 뒤따르는 mousedown 을 막고,
 * 캡처 단계 stopPropagation 이 다른 리스너를, 한 번만 도는 click 삼키기가 DOM 단추의 동작을 막는다.
 */
function openZoomMenu(zoomGroup: HTMLElement): void {
  detachZoomMenuDismiss?.();
  zoomGroup.classList.add("is-menu-open");
  zoomGroup.querySelector("[data-testid='editor-zoom-stepper']")?.setAttribute("aria-expanded", "true");
  const swallowClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (!zoomGroup.isConnected) {
      detachZoomMenuDismiss?.();
      return;
    }
    if (event.target instanceof Node && zoomGroup.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    closeZoomMenu(zoomGroup);
    window.addEventListener("click", swallowClick, { capture: true, once: true });
    // 누른 자리와 뗅 자리가 달라 click 이 안 오면 다음 누름 전에 치운다.
    window.addEventListener("pointerdown", () => window.removeEventListener("click", swallowClick, { capture: true }), { capture: true, once: true });
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeZoomMenu(zoomGroup);
    zoomGroup.querySelector<HTMLElement>("[data-testid='editor-zoom-stepper']")?.focus();
  };
  window.addEventListener("pointerdown", onPointerDown, { capture: true });
  window.addEventListener("keydown", onKeyDown, { capture: true });
  detachZoomMenuDismiss = () => {
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    detachZoomMenuDismiss = null;
  };
}

function closeZoomMenu(zoomGroup: HTMLElement): void {
  detachZoomMenuDismiss?.();
  zoomGroup.classList.remove("is-menu-open");
  zoomGroup.querySelector("[data-testid='editor-zoom-stepper']")?.setAttribute("aria-expanded", "false");
}

function readCanvasToolbarExpanded(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CANVAS_TOOLBAR_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCanvasToolbarExpanded(expanded: boolean): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CANVAS_TOOLBAR_EXPANDED_KEY, expanded ? "1" : "0");
    }
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
}

export async function downloadCurrentMapScreenshot(): Promise<void> {
  const requestSeq = ++mapScreenshotRequestSeq;
  try {
    const project = store.getCurrent();
    const mapId = editorState.get().currentMapId ?? project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new MapScreenshotError("현재 맵을 찾지 못했습니다.");
    publishMapScreenshotPending(map);
    const screenshot = await createMapScreenshot(project, map);
    if (requestSeq !== mapScreenshotRequestSeq) return;
    await publishMapScreenshotResult(screenshot, map);
    const copiedToClipboard = await copyMapScreenshotToClipboard(screenshot.blob);
    const url = URL.createObjectURL(screenshot.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = screenshot.fileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // revoke 를 너무 빨리 하면 다운로드 실패하는 브라우저 있음
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    toast(
      copiedToClipboard
        ? `맵 PNG 저장·복사 (${screenshot.width}×${screenshot.height}, ×${screenshot.scale})`
        : `맵 PNG 저장 (${screenshot.width}×${screenshot.height}, ×${screenshot.scale})`,
      "ok",
    );
  } catch (error) {
    if (requestSeq !== mapScreenshotRequestSeq) return;
    if (error instanceof MapScreenshotError) {
      toast(`맵 저장 실패: ${error.message}`, "error");
      return;
    }
    throw error;
  }
}

async function copyMapScreenshotToClipboard(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
  try {
    const pngBlob = blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    return true;
  } catch (error) {
    if (error instanceof DOMException || error instanceof TypeError) return false;
    throw error;
  }
}

function publishMapScreenshotPending(map: GameMap): void {
  const resultNode = mapScreenshotResultNode();
  resultNode.textContent = JSON.stringify({
    mapId: map.id,
    mapName: map.name,
    mapSize: { height: map.height, width: map.width },
    state: "pending",
  });
}

async function publishMapScreenshotResult(screenshot: MapScreenshot, map: GameMap): Promise<void> {
  const resultNode = mapScreenshotResultNode();
  // 큰 dataUrl 을 DOM 에 넣으면 UI 가 멈추므로 작은 맵만 포함
  const includeDataUrl = screenshot.blob.size < 1_500_000;
  resultNode.textContent = JSON.stringify({
    byteLength: screenshot.blob.size,
    ...(includeDataUrl ? { dataUrl: await blobToDataUrl(screenshot.blob) } : {}),
    fileName: screenshot.fileName,
    mapId: map.id,
    mapName: map.name,
    mapSize: { height: map.height, width: map.width },
    pixelSize: { height: screenshot.height, width: screenshot.width },
    scale: screenshot.scale,
    state: "done",
  });
}

function mapScreenshotResultNode(): HTMLPreElement {
  const existing = document.querySelector<HTMLPreElement>('[data-testid="editor-map-screenshot-result"]');
  if (existing) return existing;
  const node = document.createElement("pre");
  node.hidden = true;
  node.dataset.testid = "editor-map-screenshot-result";
  document.body.append(node);
  return node;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new MapScreenshotError("PNG 결과를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}
