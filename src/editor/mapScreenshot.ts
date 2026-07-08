import { isDefaultTilesetTexture, tilesetImageUrl } from "@/editor/tilesetImage";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { isTerrainInnerCornerTile, terrainInnerCornerQuarterSources } from "@/project/defaults/terrainQuarterAutotile";
import { tileStackAt } from "@/project/mapOverlayTiles";
import type { GameMap, Project, TilesetDef } from "@/project/types";

const SCREENSHOT_SCALE = 2;
const tilesetImagePromises = new Map<string, Promise<HTMLImageElement>>();

export type MapScreenshot = {
  readonly blob: Blob;
  readonly fileName: string;
};

export class MapScreenshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapScreenshotError";
  }
}

export async function createMapScreenshot(project: Project, map: GameMap): Promise<MapScreenshot> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new MapScreenshotError("현재 맵의 타일셋을 찾지 못했습니다.");

  const image = await loadTilesetImage(tileset);
  const canvas = document.createElement("canvas");
  canvas.width = map.width * map.tileSize * SCREENSHOT_SCALE;
  canvas.height = map.height * map.tileSize * SCREENSHOT_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new MapScreenshotError("맵 캡처 캔버스를 만들지 못했습니다.");

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawLayer(context, image, map, tileset, map.lowerTiles);
  drawStackLayer(context, image, map, tileset, "lower");
  drawLayer(context, image, map, tileset, map.upperTiles);
  drawStackLayer(context, image, map, tileset, "upper");

  return {
    blob: await canvasToPngBlob(canvas),
    fileName: mapScreenshotFileName(map),
  };
}

export function mapScreenshotFileName(map: GameMap): string {
  return `${sanitizeFileName(map.name)}-map.png`;
}

function drawStackLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  layer: "lower" | "upper",
): void {
  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const tile of tileStackAt(map, layer, index)) drawRawTile(context, image, tileset, tile, x, y);
  }
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
      drawLakeAutotile(context, image, map, tileset, x, y);
      continue;
    }
    if (tiles === map.lowerTiles && isDefaultTilesetTexture(tileset) && isTerrainInnerCornerTile(tile)) {
      drawTerrainInnerCorner(context, image, map, tileset, x, y);
      continue;
    }
    drawRawTile(context, image, tileset, tile, x, y);
  }
}

function drawLakeAutotile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number,
): void {
  for (const part of lakeAutotileQuarterSources(map, x, y)) {
    const sourceX = (part.tile % tileset.tilesPerRow) * tileset.tileSize + part.offsetX;
    const sourceY = Math.floor(part.tile / tileset.tilesPerRow) * tileset.tileSize + part.offsetY;
    const targetX = (x * tileset.tileSize + part.offsetX) * SCREENSHOT_SCALE;
    const targetY = (y * tileset.tileSize + part.offsetY) * SCREENSHOT_SCALE;
    const quarterSize = tileset.tileSize / 2;
    const drawSize = quarterSize * SCREENSHOT_SCALE;
    context.drawImage(image, sourceX, sourceY, quarterSize, quarterSize, targetX, targetY, drawSize, drawSize);
  }
}

// 오목 코너 합성 타일(365/362): 잔디 대각 귀퉁이만 오목 쿼터, 나머지는 몸통 쿼터.
function drawTerrainInnerCorner(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number,
): void {
  for (const part of terrainInnerCornerQuarterSources(map, x, y) ?? []) {
    const sourceX = (part.tile % tileset.tilesPerRow) * tileset.tileSize + part.offsetX;
    const sourceY = Math.floor(part.tile / tileset.tilesPerRow) * tileset.tileSize + part.offsetY;
    const targetX = (x * tileset.tileSize + part.offsetX) * SCREENSHOT_SCALE;
    const targetY = (y * tileset.tileSize + part.offsetY) * SCREENSHOT_SCALE;
    const quarterSize = tileset.tileSize / 2;
    const drawSize = quarterSize * SCREENSHOT_SCALE;
    context.drawImage(image, sourceX, sourceY, quarterSize, quarterSize, targetX, targetY, drawSize, drawSize);
  }
}

function drawRawTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tileset: TilesetDef,
  tile: number,
  x: number,
  y: number,
): void {
  const sourceX = (tile % tileset.tilesPerRow) * tileset.tileSize;
  const sourceY = Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize;
  const targetX = x * tileset.tileSize * SCREENSHOT_SCALE;
  const targetY = y * tileset.tileSize * SCREENSHOT_SCALE;
  const drawSize = tileset.tileSize * SCREENSHOT_SCALE;
  context.drawImage(image, sourceX, sourceY, tileset.tileSize, tileset.tileSize, targetX, targetY, drawSize, drawSize);
}

function loadTilesetImage(tileset: TilesetDef): Promise<HTMLImageElement> {
  const url = tilesetImageUrl(tileset);
  const existing = tilesetImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new MapScreenshotError("타일셋 이미지를 읽지 못했습니다."));
    image.src = url;
  });
  tilesetImagePromises.set(url, promise);
  return promise;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new MapScreenshotError("PNG 파일을 만들지 못했습니다."));
    }, "image/png");
  });
}

function sanitizeFileName(value: string): string {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_").replace(/\s+/g, "_");
  return sanitized.length > 0 ? sanitized : "map";
}
