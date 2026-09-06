import { drawMapTileLayers, MapTileDrawError, type TilesetCanvasImage } from "./mapTileDrawCore";
import type { RegionRect } from "./regionTask/clipToRegion";
import { inRegion } from "./regionTask/clipToRegion";
import type { GameEvent, GameMap, TilesetDef } from "@/project/types";

export function regionSnapshotScale(regionWidthPx: number, targetWidth = 140): number {
  if (!Number.isFinite(regionWidthPx) || regionWidthPx <= 0) return 1;
  return Math.min(2, Math.max(0.0625, targetWidth / regionWidthPx));
}
export function eventsInRegion(map: GameMap, region: RegionRect): readonly GameEvent[] {
  return (map.events ?? []).filter(event => inRegion(event.x, event.y, region));
}
/** Same tile compositor and schematic markers as editor region previews, with an
 * already-resolved image. No live store, URL resolver, or project persistence. */
export function drawRegionSnapshot(map: GameMap, tileset: TilesetDef, image: TilesetCanvasImage,
  region: RegionRect, opts?: { readonly targetWidth?: number; readonly scale?: number }): HTMLCanvasElement {
  const tileSize = map.tileSize;
  const scale = opts?.scale ?? regionSnapshotScale(region.width * tileSize, opts?.targetWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * tileSize * scale));
  canvas.height = Math.max(1, Math.round(region.height * tileSize * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new MapTileDrawError("썸네일 캔버스를 만들지 못했습니다.");
  context.imageSmoothingEnabled = false;
  context.translate(-Math.round(region.x * tileSize * scale), -Math.round(region.y * tileSize * scale));
  drawMapTileLayers(context, image, map, tileset, scale);
  for (const event of eventsInRegion(map, region)) {
    context.beginPath();
    context.arc((event.x + 0.5) * tileSize * scale, (event.y + 0.5) * tileSize * scale,
      Math.max(2, tileSize * scale * 0.32), 0, Math.PI * 2);
    context.fillStyle = "rgba(21, 170, 191, 0.9)";
    context.fill();
    context.lineWidth = Math.max(1, scale);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.stroke();
  }
  return canvas;
}
