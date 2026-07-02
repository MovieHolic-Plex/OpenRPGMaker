import { tileStackAt } from "@/project/mapOverlayTiles";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { isDefaultTilesetTexture, tilesetImageUrl } from "@/editor/tilesetImage";
import type { GameMap, MapId, Project, TilesetDef } from "@/project/types";

export type TransferPreviewSelection = {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
};

export type DrawTransferMapPreviewRequest = {
  readonly canvas: HTMLCanvasElement;
  readonly project: Project;
  readonly mapId: MapId;
  readonly selection: TransferPreviewSelection;
  readonly isCurrent?: () => boolean;
};

export type DrawTransferFallbackRequest = {
  readonly canvas: HTMLCanvasElement;
  readonly map: GameMap | undefined;
  readonly selection: TransferPreviewSelection;
};

export async function drawTransferMapPreview(request: DrawTransferMapPreviewRequest): Promise<void> {
  const map = request.project.maps[request.mapId];
  const tileset = map ? request.project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return;
  const image = await loadImage(tilesetImageUrl(tileset));
  if (request.isCurrent?.() === false) return;
  setupCanvas(request.canvas, map, request.selection.zoom);
  const context = request.canvas.getContext("2d");
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, request.canvas.width, request.canvas.height);
  drawLayer(context, image, map, tileset, map.lowerTiles);
  drawStack(context, image, map, tileset, "lower");
  drawLayer(context, image, map, tileset, map.upperTiles);
  drawStack(context, image, map, tileset, "upper");
  drawEventMarkers(context, map);
  drawMarker(context, map, request.selection);
}

export function drawTransferFallback(request: DrawTransferFallbackRequest): void {
  if (!request.map) return;
  setupCanvas(request.canvas, request.map, request.selection.zoom);
  const context = request.canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#003dcb";
  context.fillRect(0, 0, request.canvas.width, request.canvas.height);
  drawEventMarkers(context, request.map);
  drawMarker(context, request.map, request.selection);
}

function setupCanvas(canvas: HTMLCanvasElement, map: GameMap, zoom: number): void {
  canvas.width = map.width * map.tileSize;
  canvas.height = map.height * map.tileSize;
  canvas.style.width = `${canvas.width * zoom}px`;
  canvas.style.height = `${canvas.height * zoom}px`;
}

function drawLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  tiles: readonly number[],
): void {
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index] ?? -1;
    if (tile < 0) continue;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    if (tiles === map.lowerTiles && isDefaultTilesetTexture(tileset) && isLakeAutotileTile(tile)) {
      for (const part of lakeAutotileQuarterSources(map, x, y)) {
        drawRawTile(context, image, tileset, part.tile, x, y, part.offsetX, part.offsetY, tileset.tileSize / 2);
      }
      continue;
    }
    drawRawTile(context, image, tileset, tile, x, y, 0, 0, tileset.tileSize);
  }
}

function drawStack(context: CanvasRenderingContext2D, image: HTMLImageElement, map: GameMap, tileset: TilesetDef, layer: "lower" | "upper"): void {
  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const tile of tileStackAt(map, layer, index)) drawRawTile(context, image, tileset, tile, x, y, 0, 0, tileset.tileSize);
  }
}

function drawRawTile(context: CanvasRenderingContext2D, image: HTMLImageElement, tileset: TilesetDef, tile: number, x: number, y: number, offsetX: number, offsetY: number, size: number): void {
  const sx = (tile % tileset.tilesPerRow) * tileset.tileSize + offsetX;
  const sy = Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize + offsetY;
  context.drawImage(image, sx, sy, size, size, x * tileset.tileSize + offsetX, y * tileset.tileSize + offsetY, size, size);
}

function drawEventMarkers(context: CanvasRenderingContext2D, map: GameMap): void {
  for (const event of map.events) {
    const x = event.x * map.tileSize;
    const y = event.y * map.tileSize;
    const inset = Math.max(2, Math.floor(map.tileSize * 0.18));
    const size = map.tileSize - inset * 2;
    context.fillStyle = "#ff007a";
    context.fillRect(x + inset, y + inset, size, size);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(x + inset, y + inset, size, size);
    context.strokeStyle = "#1f2937";
    context.lineWidth = 1;
    context.strokeRect(x + inset + 2, y + inset + 2, Math.max(1, size - 4), Math.max(1, size - 4));
    context.fillStyle = "#ffffff";
    context.font = "bold 10px Tahoma, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("E", x + map.tileSize / 2, y + map.tileSize / 2 + 0.5);
  }
}

function drawMarker(context: CanvasRenderingContext2D, map: GameMap, selection: TransferPreviewSelection): void {
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.strokeRect(selection.x * map.tileSize + 1, selection.y * map.tileSize + 1, map.tileSize - 2, map.tileSize - 2);
  context.strokeStyle = "#111111";
  context.lineWidth = 1;
  context.strokeRect(selection.x * map.tileSize + 3, selection.y * map.tileSize + 3, map.tileSize - 6, map.tileSize - 6);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
