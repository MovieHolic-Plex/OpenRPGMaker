import {
  supportsChipsetQuarterComposition,
  tilesetImageUrl,
} from "@/editor/tilesetImage";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import { tileStackAt } from "@/project/mapOverlayTiles";
import type { GameMap, TilesetDef } from "@/project/types";

const PREVIEW_SCALE = 2;

const tilesetImagePromises = new Map<string, Promise<HTMLImageElement>>();

export async function renderTempMapImage(map: GameMap, tileset: TilesetDef): Promise<string> {
  const image = await loadTilesetImage(tileset);
  const canvas = document.createElement("canvas");
  canvas.width = map.width * tileset.tileSize * PREVIEW_SCALE;
  canvas.height = map.height * tileset.tileSize * PREVIEW_SCALE;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#20232a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawLayer(context, image, map.lowerTiles, map, tileset, "lower");
  drawStackLayer(context, image, "lower", map, tileset);
  drawLayer(context, image, map.upperTiles, map, tileset, "upper");
  drawStackLayer(context, image, "upper", map, tileset);
  return canvas.toDataURL("image/png");
}

export async function renderTilesetAtlasImage(tileset: TilesetDef): Promise<string> {
  const height = Math.ceil(tileset.count / tileset.tilesPerRow);
  const cellCount = height * tileset.tilesPerRow;
  const map: GameMap = {
    events: [],
    height,
    id: "ai-tileset-atlas",
    lowerTiles: Array.from({ length: cellCount }, (_cell, index) => index < tileset.count ? index : -1),
    name: "AI tileset atlas",
    tileSize: tileset.tileSize,
    tilesetId: tileset.id,
    upperTiles: Array.from({ length: cellCount }, () => -1),
    width: tileset.tilesPerRow,
  };
  return renderTempMapImage(map, tileset);
}

function drawStackLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  layer: "lower" | "upper",
  map: GameMap,
  tileset: TilesetDef,
): void {
  for (let index = 0; index < map.width * map.height; index += 1) {
    for (const tile of tileStackAt(map, layer, index)) drawTile(context, image, tile, index, map, tileset);
  }
}

function drawLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tiles: readonly number[],
  map: GameMap,
  tileset: TilesetDef,
  layer: "lower" | "upper",
): void {
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index] ?? -1;
    if (tile < 0) continue;
    if (layer === "lower" && supportsChipsetQuarterComposition(tileset)) {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      const composition = chipsetQuarterComposition(map, tileset, x, y);
      if (composition) {
        if (composition.underlayTile !== undefined) drawTile(context, image, composition.underlayTile, index, map, tileset);
        for (const part of composition.sources) {
          drawTilePart(context, image, part.tile, index, map, tileset, part.offsetX, part.offsetY);
        }
        continue;
      }
    }
    drawTile(context, image, tile, index, map, tileset);
  }
}

function drawTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tile: number,
  index: number,
  map: GameMap,
  tileset: TilesetDef,
): void {
  const tileSize = tileset.tileSize;
  const drawSize = tileSize * PREVIEW_SCALE;
  const sourceX = (tile % tileset.tilesPerRow) * tileSize;
  const sourceY = Math.floor(tile / tileset.tilesPerRow) * tileSize;
  const targetX = (index % map.width) * drawSize;
  const targetY = Math.floor(index / map.width) * drawSize;
  context.drawImage(image, sourceX, sourceY, tileSize, tileSize, targetX, targetY, drawSize, drawSize);
}

function drawTilePart(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tile: number,
  index: number,
  map: GameMap,
  tileset: TilesetDef,
  offsetX: 0 | 8,
  offsetY: 0 | 8,
): void {
  const tileSize = tileset.tileSize;
  const drawSize = tileSize * PREVIEW_SCALE;
  const sourceX = (tile % tileset.tilesPerRow) * tileSize + offsetX;
  const sourceY = Math.floor(tile / tileset.tilesPerRow) * tileSize + offsetY;
  const targetX = (index % map.width) * drawSize + offsetX * PREVIEW_SCALE;
  const targetY = Math.floor(index / map.width) * drawSize + offsetY * PREVIEW_SCALE;
  context.drawImage(image, sourceX, sourceY, tileSize / 2, tileSize / 2, targetX, targetY, drawSize / 2, drawSize / 2);
}

function loadTilesetImage(tileset: TilesetDef): Promise<HTMLImageElement> {
  const url = tilesetImageUrl(tileset);
  const existing = tilesetImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("타일셋 이미지를 읽지 못했습니다."));
    image.src = url;
  });
  tilesetImagePromises.set(url, promise);
  return promise;
}
