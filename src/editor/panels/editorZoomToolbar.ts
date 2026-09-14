import { EDITOR_ZOOM_LEVELS, editorState, type EditorZoom } from "@/editor/editorState";
import { getEditorChrome } from "@/editor/editorUiMode";
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

export const CANVAS_TOOLBAR_EXPANDED_KEY = "oprn:canvas-toolbar-expanded";

// 기본 모드는 자주 쓰는 배율만 노출한다 — 7컨트롤(라벨+6버튼)은 초보에게 소음.
// 현재 배율이 목록 밖(3/6/8x)이면 활성 표시를 위해 끼워 넣는다.
const BASIC_ZOOM_LEVELS: readonly EditorZoom[] = [1, 2, 4];

export function visibleZoomLevels(dense: boolean, currentZoom: EditorZoom): readonly EditorZoom[] {
  if (dense) return EDITOR_ZOOM_LEVELS;
  if (BASIC_ZOOM_LEVELS.includes(currentZoom)) return BASIC_ZOOM_LEVELS;
  return [...BASIC_ZOOM_LEVELS, currentZoom].sort((a, b) => a - b);
}

export function stepEditorZoom(delta: number, levels: readonly EditorZoom[], current: EditorZoom): EditorZoom {
  const index = Math.max(0, levels.indexOf(current));
  const next = index + delta;
  if (next < 0) return levels[0] ?? current;
  if (next >= levels.length) return levels[levels.length - 1] ?? current;
  return levels[next] ?? current;
}

export function renderCanvasToolbar(container: HTMLElement): void {
  clearChildren(container);
  const chrome = getEditorChrome();
  const currentZoom = editorState.get().zoom;
  container.dataset.uiDensity = chrome.canvasChromeDense ? "expert" : "beginner";
  container.classList.add("is-zoom-stepper");
  if (!chrome.canvasChromeDense) {
    container.classList.add("is-basic-chrome");
    container.classList.add("is-docked-chrome");
    // is-expanded를 항상 켜둘 때 줄 목록(1x/2x/4x)이 스테퍼와 상시 중복 노출됐다
    // (2026-08-18 UX 리뷜 P2-11) — 목록은 배율 버튼(is-menu-open)으로만 연다.
  } else {
    container.classList.remove("is-basic-chrome");
    container.classList.remove("is-docked-chrome");
    container.classList.toggle("is-expanded", readCanvasToolbarExpanded());
  }

  const levels = visibleZoomLevels(chrome.canvasChromeDense, currentZoom);
  const zoomGroup = el("div", {
    class: "canvas-toolbar-zoom-group is-stepper",
    attrs: { "aria-label": "캔버스 확대", role: "group" },
    dataset: { testid: "editor-zoom-group" },
  });
  zoomGroup.append(
    el("button", {
      class: "oprn-tool-button zoom-stepper-btn",
      text: "−",
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
          const open = zoomGroup.classList.toggle("is-menu-open");
          zoomGroup.querySelector("[data-testid='editor-zoom-stepper']")?.setAttribute("aria-expanded", String(open));
        },
      },
    }),
    el("button", {
      class: "oprn-tool-button zoom-stepper-btn",
      text: "+",
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
        on: { click: () => { zoomGroup.classList.remove("is-menu-open"); editorState.set({ zoom }); } },
      }),
    );
  }
  zoomGroup.append(menu);
  container.append(el("button", {
    class: "btn walk-encounter-list-button", text: "걸을 때 적 만나기",
    attrs: { type: "button", title: "범위 목록 · 추가 · 편집 · 삭제" },
    dataset: { testid: "walk-encounter-list-open" }, on: { click: openWalkEncounterList },
  }));
  // 로케이션 레이어는 모든 편집 모드에서 같은 자리에 있다 — 이벤트 조건·인카운터·조수가
  // 공유하는 층이라 전문가 전용으로 숨기면 애초에 만들어지지 않는다.
  const locationLayerOn = locationLayerState().enabled;
  container.append(el("button", {
    class: `btn map-location-layer-button${locationLayerOn ? " is-active" : ""}`,
    text: locationLayerOn ? "구역 그리기" : "로케이션",
    attrs: {
      type: "button",
      title: locationLayerOn
        ? "구역 그리기 도구가 켜져 있습니다. 맵을 드래그해 이름 붙은 구역을 만듭니다. 타일 칠하기는 이 버튼을 끄거나 브러시를 다시 고르면 돌아옵니다."
        : "구역 그리기 — 켜면 맵을 드래그해 이름 붙은 구역을 만듭니다. 이벤트 조건과 랜덤 인카운터가 그 이름을 가리킬 수 있습니다.",
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
    text: "맵 배경",
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
  // Basic: zoom only (always expanded). Expert: ⋯ expand + build palette + map screenshot.
  if (!chrome.canvasChromeDense) {
    container.append(zoomGroup);
    return;
  }
  const saveAction = el("div", {
    class: "canvas-toolbar-save-group",
    attrs: { "aria-label": "맵 이미지 저장", role: "group" },
    dataset: { testid: "editor-map-save-group", uiDensity: "expert" },
    children: [
      el("button", {
        class: "oprn-tool-button map-save-button",
        text: "맵 저장",
        attrs: { title: "현재 맵만 PNG로 저장", "aria-label": "현재 맵만 PNG로 저장" },
        dataset: { testid: "editor-map-screenshot-button" },
        on: { click: () => void downloadCurrentMapScreenshot() },
      }),
    ],
  });
  const aiWorkbench = renderCanvasAiWorkbench();
  const expandButton = el("button", {
      class: "canvas-toolbar-expand",
      text: "⋯",
      // hover 자동 노출을 없앴으므로 이 버튼이 확대/맵저장 컨트롤을 여닫는 유일한 토글이다.
      attrs: { type: "button", title: "확대·맵 저장 펼치기/접기", "aria-label": "확대·맵 저장 펼치기/접기", "aria-expanded": String(container.classList.contains("is-expanded")) },
      dataset: { testid: "editor-canvas-toolbar-expand", uiDensity: "expert" },
      on: {
        click: () => {
          const expanded = !container.classList.contains("is-expanded");
          if (expanded) container.classList.add("is-expanded");
          else container.classList.remove("is-expanded");
          expandButton.setAttribute("aria-expanded", String(expanded));
          writeCanvasToolbarExpanded(expanded);
        },
      },
    });
  container.append(zoomGroup, expandButton, aiWorkbench, saveAction);
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
