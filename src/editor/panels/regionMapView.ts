import { editorState } from "@/editor/editorState";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { drawMapTileLayers, loadTilesetImage } from "@/editor/mapTileDraw";
import { visibleAuthoringProject } from "./spatialAuthoringAccess";
import { el } from "@/util/dom";

export function regionMapPreview(mapId: string, thumbnail = false): HTMLElement {
  const project = visibleAuthoringProject();
  const map = project.maps[mapId];
  const tileset = map && project.tilesets[map.tilesetId];
  if (!map || !tileset) return el("p", { text: "연결된 맵을 찾을 수 없습니다." });
  const canvas = document.createElement("canvas");
  const scale = thumbnail ? Math.min(160 / (map.width * map.tileSize), 128 / (map.height * map.tileSize)) : 1;
  canvas.width = Math.max(1, Math.round(map.width * map.tileSize * scale));
  canvas.height = Math.max(1, Math.round(map.height * map.tileSize * scale));
  canvas.dataset.testid = thumbnail ? "region-map-thumbnail" : "region-map-preview";
  canvas.dataset.painted = "pending";
  canvas.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated";
  void loadTilesetImage(tileset).then(image => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawMapTileLayers(ctx, image, map, tileset, scale);
    canvas.dataset.painted = "atlas";
  }).catch(() => { canvas.dataset.painted = "error"; canvas.replaceWith(el("p", { text: "맵 이미지를 불러오지 못했습니다." })); });
  return canvas;
}

export function regionMapInspector(mapId: string, name: string): HTMLElement {
  const map = visibleAuthoringProject().maps[mapId];
  if (!map) return el("p", { text: "연결된 맵을 찾을 수 없습니다." });
  return el("div", { dataset: { testid: "region-map-inspector" }, children: [
    el("h3", { text: name }),
    el("p", { text: `완성 맵 · ${map.width}×${map.height} 타일` }),
    el("p", { text: "연결된 맵의 현재 모습을 표시합니다. 지형과 이벤트는 맵 편집기에서 수정할 수 있습니다." }),
    el("button", { text: "맵 열기", class: "spatial-action", attrs: { type: "button" }, dataset: { testid: "region-map-open" }, on: { click: async () => {
      const { requestDatabaseModalClose } = await import("./databaseModal");
      editorState.set({ currentMapId: mapId, selection: null });
      requestEditorCameraFocus({ mapId, tileX: map.width / 2, tileY: map.height / 2,
        bounds: { x: 0, y: 0, width: map.width, height: map.height } });
      requestDatabaseModalClose("x");
    } } }),
  ] });
}
