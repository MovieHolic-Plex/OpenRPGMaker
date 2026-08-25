// 맵 타일 레이어 → 2D 캔버스 렌더(오프스크린). mapScreenshot(전체 맵)과
// regionSnapshot(영역 크롭 썸네일)이 공유한다. scale은 픽셀 배율(연속값 허용).
import {
  supportsChipsetQuarterComposition,
  tilesetImageUrl,
} from "@/editor/tilesetImage";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import {
  chipsetQuarterComposition,
  type ChipsetQuarterComposition,
} from "@/project/defaults/terrainQuarterAutotile";
import { tileStackAt } from "@/project/mapOverlayTiles";
import type { GameMap, TilesetDef } from "@/project/types";

const tilesetImagePromises = new Map<string, Promise<HTMLImageElement>>();

export class MapTileDrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapTileDrawError";
  }
}

/** lower→lower스택→upper→upper스택 순서로 모든 타일 레이어를 그린다. */
export function drawMapTileLayers(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  scale: number,
): void {
  drawLayer(context, image, map, tileset, map.lowerTiles, scale);
  drawStackLayer(context, image, map, tileset, "lower", scale);
  drawLayer(context, image, map, tileset, map.upperTiles, scale);
  drawStackLayer(context, image, map, tileset, "upper", scale);
}

function drawStackLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  layer: "lower" | "upper",
  scale: number,
): void {
  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const tile of tileStackAt(map, layer, index)) drawRawTile(context, image, tileset, tile, x, y, scale);
  }
}

function drawLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  tiles: readonly number[],
  scale: number,
): void {
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index] ?? -1;
    if (tile < 0) continue;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함(supportsChipsetQuarterComposition).
    if (tiles === map.lowerTiles && supportsChipsetQuarterComposition(tileset) && isLakeAutotileTile(tile)) {
      drawLakeAutotile(context, image, map, tileset, x, y, scale);
      continue;
    }
    if (tiles === map.lowerTiles && supportsChipsetQuarterComposition(tileset)) {
      const composition = chipsetQuarterComposition(map, tileset, x, y);
      if (composition) {
        drawTerrainQuarter(context, image, tileset, x, y, composition, scale);
        continue;
      }
    }
    drawRawTile(context, image, tileset, tile, x, y, scale);
  }
}

function drawLakeAutotile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number,
  scale: number,
): void {
  for (const part of lakeAutotileQuarterSources(map, x, y)) {
    const sourceX = (part.tile % tileset.tilesPerRow) * tileset.tileSize + part.offsetX;
    const sourceY = Math.floor(part.tile / tileset.tilesPerRow) * tileset.tileSize + part.offsetY;
    const targetX = (x * tileset.tileSize + part.offsetX) * scale;
    const targetY = (y * tileset.tileSize + part.offsetY) * scale;
    const quarterSize = tileset.tileSize / 2;
    const drawSize = quarterSize * scale;
    context.drawImage(image, sourceX, sourceY, quarterSize, quarterSize, targetX, targetY, drawSize, drawSize);
  }
}

// 모래/흙길 지형 쿼터 합성: 각 쿼터는 계산된 소스 타일의 같은 위치를 사용한다.
function drawTerrainQuarter(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tileset: TilesetDef,
  x: number,
  y: number,
  composition: ChipsetQuarterComposition,
  scale: number,
): void {
  if (composition.underlayTile !== undefined) {
    drawRawTile(context, image, tileset, composition.underlayTile, x, y, scale);
  }
  for (const part of composition.sources) {
    const sourceX = (part.tile % tileset.tilesPerRow) * tileset.tileSize + part.offsetX;
    const sourceY = Math.floor(part.tile / tileset.tilesPerRow) * tileset.tileSize + part.offsetY;
    const targetX = (x * tileset.tileSize + part.offsetX) * scale;
    const targetY = (y * tileset.tileSize + part.offsetY) * scale;
    const quarterSize = tileset.tileSize / 2;
    const drawSize = quarterSize * scale;
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
  scale: number,
): void {
  const sourceX = (tile % tileset.tilesPerRow) * tileset.tileSize;
  const sourceY = Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize;
  const targetX = x * tileset.tileSize * scale;
  const targetY = y * tileset.tileSize * scale;
  const drawSize = tileset.tileSize * scale;
  context.drawImage(image, sourceX, sourceY, tileset.tileSize, tileset.tileSize, targetX, targetY, drawSize, drawSize);
}

export function loadTilesetImage(tileset: TilesetDef): Promise<HTMLImageElement> {
  const url = tilesetImageUrl(tileset);
  const existing = tilesetImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new MapTileDrawError("타일셋 이미지를 읽지 못했습니다."));
    image.src = url;
  });
  tilesetImagePromises.set(url, promise);
  return promise;
}
