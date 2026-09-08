import { el } from "@/util/dom";
import { CAMERA_INSPECTION_PADDING, type CanvasRect } from "@/editor/cameraFocusViewport";

type Area = { readonly canvas: CanvasRect; readonly unoccluded: CanvasRect; readonly worldView: CanvasRect; readonly zoom: number };

/** Native scroll chrome is a projection of the camera, never another viewport store. */
export class CameraScrollbars {
  private readonly axes;
  private zoom = 1;
  private projection = "";

  constructor(host: HTMLElement, panBy: (x: number, y: number) => void) {
    this.axes = (["x", "y"] as const).map(axis => {
      const spacer = el("div", { attrs: { "aria-hidden": "true" } });
      const node = el("div", {
        class: `editor-camera-scroll editor-camera-scroll-${axis}`,
        attrs: { role: "region", tabindex: "0", "aria-label": axis === "x" ? "맵 가로 이동" : "맵 세로 이동" },
        dataset: { testid: `editor-camera-scroll-${axis}`, editorNavigationOwner: "true" },
        children: [spacer],
      });
      const entry = { axis, node, spacer, position: 0, layoutKey: "", ratio: 1 };
      node.addEventListener("scroll", () => {
        const position = axis === "x" ? node.scrollLeft : node.scrollTop;
        const delta = (position - entry.position) / this.zoom / entry.ratio;
        entry.position = position;
        if (delta !== 0) panBy(axis === "x" ? delta : 0, axis === "y" ? delta : 0);
      });
      host.append(node);
      return entry;
    });
  }

  sync(area: Area, mapWidth: number, mapHeight: number): void {
    const { canvas, unoccluded: view, worldView, zoom } = area;
    const projection = [mapWidth, mapHeight, canvas.x, canvas.y, view.x, view.y, view.width, view.height, worldView.x, worldView.y, zoom].join("|");
    if (projection === this.projection) return;
    this.projection = projection;
    this.zoom = zoom;
    for (const entry of this.axes) {
      const horizontal = entry.axis === "x";
      const span = horizontal ? view.width : view.height;
      const mapSpan = horizontal ? mapWidth : mapHeight;
      const offset = horizontal ? view.x - canvas.x : view.y - canvas.y;
      const worldStart = horizontal ? worldView.x : worldView.y;
      const position = worldStart * zoom + offset + span / 2 + CAMERA_INSPECTION_PADDING;
      const layoutKey = `${span}|${mapSpan}|${zoom}`;
      const nativePosition = horizontal ? entry.node.scrollLeft : entry.node.scrollTop;
      // A native scroll notification may arrive after the next engine frame.
      // Never overwrite that input with the camera's previous position.
      if (entry.layoutKey === layoutKey && nativePosition !== entry.position) continue;
      entry.layoutKey = layoutKey;
      Object.assign(entry.node.style, {
        left: `${view.x - canvas.x + (horizontal ? 0 : view.width - 16)}px`,
        top: `${view.y - canvas.y + (horizontal ? view.height - 16 : 0)}px`,
        width: horizontal ? `${view.width - 16}px` : "16px",
        height: horizontal ? "16px" : `${view.height - 16}px`,
      });
      // Track excludes the corner, so scale all metrics equally to preserve thumb ratios.
      const ratio = (span - 16) / span;
      const content = (mapSpan * zoom + span + CAMERA_INSPECTION_PADDING * 2) * ratio;
      entry.spacer.style.width = horizontal ? `${content}px` : "1px";
      entry.spacer.style.height = horizontal ? "1px" : `${content}px`;
      // Native pixels are scaled by the track ratio; the handler reverses it below.
      entry.ratio = ratio;
      entry.node.dataset.trackRatio = String(ratio);
      if (horizontal) entry.node.scrollLeft = position * ratio;
      else entry.node.scrollTop = position * ratio;
      entry.position = horizontal ? entry.node.scrollLeft : entry.node.scrollTop;
    }
  }

  destroy(): void { for (const { node } of this.axes) node.remove(); }
}
