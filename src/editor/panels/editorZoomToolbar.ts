import { EDITOR_ZOOM_LEVELS, editorState, type EditorZoom } from "@/editor/editorState";
import { getEditorChrome } from "@/editor/editorUiMode";
import { createMapScreenshot, MapScreenshotError, type MapScreenshot } from "@/editor/mapScreenshot";
import { renderBuildPaletteToggle } from "@/editor/panels/buildPalette";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

let mapScreenshotRequestSeq = 0;

// 기본 모드는 자주 쓰는 배율만 노출한다 — 7컨트롤(라벨+6버튼)은 초보에게 소음.
// 현재 배율이 목록 밖(3/6/8x)이면 활성 표시를 위해 끼워 넣는다.
const BASIC_ZOOM_LEVELS: readonly EditorZoom[] = [1, 2, 4];

export function visibleZoomLevels(dense: boolean, currentZoom: EditorZoom): readonly EditorZoom[] {
  if (dense) return EDITOR_ZOOM_LEVELS;
  if (BASIC_ZOOM_LEVELS.includes(currentZoom)) return BASIC_ZOOM_LEVELS;
  return [...BASIC_ZOOM_LEVELS, currentZoom].sort((a, b) => a - b);
}

export function renderCanvasToolbar(container: HTMLElement): void {
  clearChildren(container);
  const chrome = getEditorChrome();
  const currentZoom = editorState.get().zoom;
  container.dataset.uiDensity = chrome.canvasChromeDense ? "expert" : "basic";
  // figma-editor.css hides .zoom-button until .is-expanded (⋯ gate for expert).
  // Basic has no expand control — always expand so 1x/2x/4x/8x stay reachable.
  if (!chrome.canvasChromeDense) {
    container.classList.add("is-basic-chrome");
    container.classList.add("is-expanded");
  } else {
    container.classList.remove("is-basic-chrome");
    container.classList.remove("is-expanded");
  }

  const zoomGroup = el("div", {
    class: "canvas-toolbar-zoom-group",
    attrs: { "aria-label": "캔버스 확대", role: "group" },
    dataset: { testid: "editor-zoom-group" },
    children: [el("span", { class: "canvas-toolbar-label", text: "확대" })],
  });
  for (const zoom of visibleZoomLevels(chrome.canvasChromeDense, currentZoom)) {
    zoomGroup.append(
      el("button", {
        class: "rm2k3-tool-button zoom-button" + (currentZoom === zoom ? " active" : ""),
        text: `${zoom}x`,
        attrs: { title: `${zoom}배 확대`, "aria-label": `${zoom}배 확대`, "aria-pressed": String(currentZoom === zoom) },
        dataset: { testid: `editor-zoom-${zoom}` },
        on: { click: () => editorState.set({ zoom }) },
      })
    );
  }
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
        class: "rm2k3-tool-button map-save-button",
        text: "맵 저장",
        attrs: { title: "현재 맵만 PNG로 저장", "aria-label": "현재 맵만 PNG로 저장" },
        dataset: { testid: "editor-map-screenshot-button" },
        on: { click: () => void downloadCurrentMapScreenshot() },
      }),
    ],
  });
  const buildGroup = el("div", {
    class: "canvas-toolbar-build-group",
    attrs: { "aria-label": "건축 팔레트", role: "group" },
    dataset: { testid: "editor-build-palette-group", uiDensity: "expert" },
    children: [renderBuildPaletteToggle()],
  });
  const expandButton = el("button", {
      class: "canvas-toolbar-expand",
      text: "⋯",
      // hover 자동 노출을 없앴으므로 이 버튼이 확대/맵저장 컨트롤을 여닫는 유일한 토글이다.
      attrs: { type: "button", title: "확대·맵 저장 펼치기/접기", "aria-label": "확대·맵 저장 펼치기/접기", "aria-expanded": "false" },
      dataset: { testid: "editor-canvas-toolbar-expand", uiDensity: "expert" },
      on: {
        click: () => {
          const expanded = !container.classList.contains("is-expanded");
          if (expanded) container.classList.add("is-expanded");
          else container.classList.remove("is-expanded");
          expandButton.setAttribute("aria-expanded", String(expanded));
        },
      },
    });
  container.append(zoomGroup, expandButton, buildGroup, saveAction);
}

async function downloadCurrentMapScreenshot(): Promise<void> {
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
