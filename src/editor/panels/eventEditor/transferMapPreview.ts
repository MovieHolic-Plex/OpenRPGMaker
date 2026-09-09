import { tileStackAt } from "@/project/mapOverlayTiles";
import { loadTilesetImage, type TilesetCanvasImage } from "@/editor/mapTileDraw";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import {
  supportsChipsetQuarterComposition,
} from "@/editor/tilesetImage";
import type { GameMap, MapId, Project, TilesetDef } from "@/project/types";

export type TransferPreviewSelection = {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
};

/** Optional CSS display box. When set, zoom=1 scales the map to fill the box (contain). */
export type TransferPreviewFitDisplay = {
  readonly maxWidth: number;
  readonly maxHeight: number;
};

export type DrawTransferMapPreviewRequest = {
  readonly canvas: HTMLCanvasElement;
  readonly project: Project;
  readonly mapId: MapId;
  readonly selection: TransferPreviewSelection;
  readonly fitDisplay?: TransferPreviewFitDisplay;
  readonly isCurrent?: () => boolean;
};

export type DrawTransferFallbackRequest = {
  readonly canvas: HTMLCanvasElement;
  readonly map: GameMap | undefined;
  readonly selection: TransferPreviewSelection;
  readonly fitDisplay?: TransferPreviewFitDisplay;
};

export async function drawTransferMapPreview(request: DrawTransferMapPreviewRequest): Promise<void> {
  const map = request.project.maps[request.mapId];
  const tileset = map ? request.project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return;
  const image = await loadTilesetImage(tileset);
  if (request.isCurrent?.() === false) return;
  setupCanvas(request.canvas, map, request.selection.zoom, request.fitDisplay);
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
  setupCanvas(request.canvas, request.map, request.selection.zoom, request.fitDisplay);
  const context = request.canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#003dcb";
  context.fillRect(0, 0, request.canvas.width, request.canvas.height);
  drawEventMarkers(context, request.map);
  drawMarker(context, request.map, request.selection);
}

function setupCanvas(
  canvas: HTMLCanvasElement,
  map: GameMap,
  zoom: number,
  fitDisplay?: TransferPreviewFitDisplay,
): void {
  canvas.width = map.width * map.tileSize;
  canvas.height = map.height * map.tileSize;
  let scale = Math.max(0.01, zoom);
  if (fitDisplay && fitDisplay.maxWidth > 0 && fitDisplay.maxHeight > 0) {
    // Contain: fill the preview box as much as possible while preserving aspect ratio.
    // User zoom (1 / 0.5 / 0.25) multiplies relative to that filled size.
    const fitScale = Math.min(fitDisplay.maxWidth / canvas.width, fitDisplay.maxHeight / canvas.height);
    scale = Math.max(0.01, fitScale * zoom);
  }
  canvas.style.width = `${Math.max(1, Math.round(canvas.width * scale))}px`;
  canvas.style.height = `${Math.max(1, Math.round(canvas.height * scale))}px`;
}

function drawLayer(
  context: CanvasRenderingContext2D,
  image: TilesetCanvasImage,
  map: GameMap,
  tileset: TilesetDef,
  tiles: readonly number[],
): void {
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index] ?? -1;
    if (tile < 0) continue;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함.
    if (tiles === map.lowerTiles && supportsChipsetQuarterComposition(tileset) && isLakeAutotileTile(tile, tileset)) {
      for (const part of lakeAutotileQuarterSources(map, x, y, tileset)) {
        drawRawTile(context, image, tileset, part.tile, x, y, part.offsetX, part.offsetY, tileset.tileSize / 2);
      }
      continue;
    }
    if (tiles === map.lowerTiles && supportsChipsetQuarterComposition(tileset)) {
      const composition = chipsetQuarterComposition(map, tileset, x, y);
      if (composition) {
        if (composition.underlayTile !== undefined) {
          drawRawTile(context, image, tileset, composition.underlayTile, x, y, 0, 0, tileset.tileSize);
        }
        for (const part of composition.sources) {
          drawRawTile(context, image, tileset, part.tile, x, y, part.offsetX, part.offsetY, tileset.tileSize / 2);
        }
        continue;
      }
    }
    drawRawTile(context, image, tileset, tile, x, y, 0, 0, tileset.tileSize);
  }
}

function drawStack(context: CanvasRenderingContext2D, image: TilesetCanvasImage, map: GameMap, tileset: TilesetDef, layer: "lower" | "upper"): void {
  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const tile of tileStackAt(map, layer, index)) drawRawTile(context, image, tileset, tile, x, y, 0, 0, tileset.tileSize);
  }
}

function drawRawTile(context: CanvasRenderingContext2D, image: TilesetCanvasImage, tileset: TilesetDef, tile: number, x: number, y: number, offsetX: number, offsetY: number, size: number): void {
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
    context.font = "bold 10px var(--font-ui, sans-serif), sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("E", x + map.tileSize / 2, y + map.tileSize / 2 + 0.5);
  }
}

/**
 * 고른 칸 표시. 타일 테두리 2겹 + 맵 전체를 가로지르는 십자 안내선.
 *
 * 왜 십자선인가 (실측): 캔버스는 맵 해상도로 그린 뒤 CSS 로 축소된다. 100×100 맵을 창에
 * 맞추면 배율이 0.4 밑으로 내려가 타일 한 칸 테두리(2px)는 1px 미만이 되어 사실상 보이지
 * 않았다. 안내선은 배율과 무관하게 화면을 가로지르므로 어느 줌에서도 고른 칸을 찾을 수 있다.
 */
function drawMarker(context: CanvasRenderingContext2D, map: GameMap, selection: TransferPreviewSelection): void {
  const centerX = selection.x * map.tileSize + map.tileSize / 2;
  const centerY = selection.y * map.tileSize + map.tileSize / 2;
  const width = map.width * map.tileSize;
  const height = map.height * map.tileSize;
  const guide = Math.max(3, Math.round(map.tileSize / 5));
  context.save();
  for (const [color, lineWidth] of [["#111111", guide * 2], ["#ffffff", guide]] as const) {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(0, centerY);
    context.lineTo(width, centerY);
    context.moveTo(centerX, 0);
    context.lineTo(centerX, height);
    context.stroke();
  }
  context.restore();
  // 십자선이 칸 자체를 덮지 않도록 칸 강조를 마지막에 그린다. 축소 배율에서 테두리만으로는
  // 칸이 사라지므로 반투명 채움을 함께 올린다.
  const left = selection.x * map.tileSize;
  const top = selection.y * map.tileSize;
  context.fillStyle = "rgba(255, 255, 255, 0.45)";
  context.fillRect(left, top, map.tileSize, map.tileSize);
  const box = Math.max(3, Math.round(map.tileSize / 6));
  context.strokeStyle = "#111111";
  context.lineWidth = box * 2;
  context.strokeRect(left, top, map.tileSize, map.tileSize);
  context.strokeStyle = "#ffffff";
  context.lineWidth = box;
  context.strokeRect(left, top, map.tileSize, map.tileSize);
}
