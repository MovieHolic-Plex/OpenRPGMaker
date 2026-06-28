import { EDITOR_ZOOM_LEVELS, editorState } from "@/editor/editorState";
import { createMapScreenshot, MapScreenshotError, type MapScreenshot } from "@/editor/mapScreenshot";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

let mapScreenshotRequestSeq = 0;

export function renderCanvasToolbar(container: HTMLElement): void {
  clearChildren(container);
  const currentZoom = editorState.get().zoom;
  container.append(el("span", { class: "canvas-toolbar-label", text: "확대" }));
  for (const zoom of EDITOR_ZOOM_LEVELS) {
    container.append(
      el("button", {
        class: "rm2k3-tool-button zoom-button" + (currentZoom === zoom ? " active" : ""),
        text: `${zoom}x`,
        attrs: { title: `${zoom}배 확대`, "aria-label": `${zoom}배 확대`, "aria-pressed": String(currentZoom === zoom) },
        dataset: { testid: `editor-zoom-${zoom}` },
        on: { click: () => editorState.set({ zoom }) },
      })
    );
  }
  container.append(
    el("button", {
      class: "rm2k3-tool-button zoom-button",
      text: "맵 저장",
      attrs: { title: "현재 맵만 PNG로 저장", "aria-label": "현재 맵만 PNG로 저장" },
      dataset: { testid: "editor-map-screenshot-button" },
      on: { click: () => void downloadCurrentMapScreenshot() },
    })
  );
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
    anchor.click();
    URL.revokeObjectURL(url);
    toast(copiedToClipboard ? "맵 PNG를 저장하고 클립보드에 복사했습니다" : "맵 PNG를 저장했습니다", "ok");
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
  resultNode.textContent = JSON.stringify({
    byteLength: screenshot.blob.size,
    dataUrl: await blobToDataUrl(screenshot.blob),
    fileName: screenshot.fileName,
    mapId: map.id,
    mapName: map.name,
    mapSize: { height: map.height, width: map.width },
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
