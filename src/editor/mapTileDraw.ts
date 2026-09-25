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
import { layerTileAt, shadowAt } from "@/project/mapLayers";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { createTransparentColorKeyCanvas, isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import type { GameMap, TilesetDef } from "@/project/types";

export type TilesetCanvasImage = HTMLImageElement | HTMLCanvasElement;

const tilesetImagePromises = new Map<string, Promise<TilesetCanvasImage>>();

export class MapTileDrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapTileDrawError";
  }
}

/** 1층→1층 스택→2층→그림자→3층→3층 스택→4층 순서로 모든 타일 레이어를 그린다. */
export function drawMapTileLayers(
  context: CanvasRenderingContext2D,
  image: TilesetCanvasImage,
  map: GameMap,
  tileset: TilesetDef,
  scale: number,
): void {
  drawMapTileLayer(context, image, map, tileset, "lower", scale);
  drawMapTileLayer(context, image, map, tileset, "upper", scale);
}

/** Shared capture layer; allows real event sprites between lower and upper tiles. */
export function drawMapTileLayer(
  context: CanvasRenderingContext2D, image: TilesetCanvasImage, map: GameMap,
  tileset: TilesetDef, layer: "lower" | "upper", scale: number,
): void {
  drawLayer(context, image, map, tileset, layer === "lower" ? map.lowerTiles : map.upperTiles, scale);
  drawStackLayer(context, image, map, tileset, layer, scale);
  // 2층(lower)·4층(upper)은 합성·받침 없이 칩 그대로. 옛 맵에는 칸이 없어 아무것도 안 그린다.
  const overlayLayer = layer === "lower" ? 2 : 4;
  for (let index = 0; index < map.width * map.height; index += 1) {
    const overlay = layerTileAt(map, overlayLayer, index);
    if (overlay >= 0) drawRawTile(context, image, tileset, overlay, index % map.width, Math.floor(index / map.width), scale);
  }
  if (layer !== "lower" || !map.shadowBits) return;
  const size = tileset.tileSize * scale;
  for (let index = 0; index < map.width * map.height; index += 1) {
    drawShadowQuarters(context, index % map.width, Math.floor(index / map.width), size, shadowAt(map, index));
  }
}

/** 그림자 조각(칸의 ¼)마다 반투명 검정 사각형. bit0 왼위·bit1 오른위·bit2 왼아래·bit3 오른아래. size = 그려지는 칸 크기(px). */
export function drawShadowQuarters(context: CanvasRenderingContext2D, x: number, y: number, size: number, bits: number): void {
  if (bits === 0) return;
  const half = size / 2;
  context.save();
  context.fillStyle = "rgba(0,0,0,0.5)";
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (bits & (1 << quarter)) context.fillRect(x * size + (quarter % 2) * half, y * size + Math.floor(quarter / 2) * half, half, half);
  }
  context.restore();
}

function drawStackLayer(
  context: CanvasRenderingContext2D,
  image: TilesetCanvasImage,
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
  image: TilesetCanvasImage,
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
      // 투명 칩이 하위에 단독으로 앉으면 그 아래가 검게 뚫린다 — 정책이 정한 받침을
      // 먼저 깔고 합성한다. 런타임(`playSceneMapRuntime`)·편집기 캔버스
      // (`chipsetTileRender`)가 이미 하는 처리이고, 캔버스 계열 렌더러(맵 썸네일·
      // 스크린샷·미니맵·구운 마을 전경)만 빠져 있어 나무 밑동 아래 검은 사각형이
      // 남았다(실측: 마을 40×40 에서 밑동 57칸 6,641px, 원형 전경 1.51%).
      // 받침은 **하위 레이어에만** 의미가 있다 — 상위는 아래 지면이 이미 있다.
      if (tiles === map.lowerTiles) {
        const backing = tileBackingTile(tileset, tile);
        if (backing !== null) drawRawTile(context, image, tileset, backing, x, y, scale);
      }
      // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함(supportsChipsetQuarterComposition).
    if (tiles === map.lowerTiles && supportsChipsetQuarterComposition(tileset) && isLakeAutotileTile(tile, tileset)) {
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
  image: TilesetCanvasImage,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number,
  scale: number,
): void {
  for (const part of lakeAutotileQuarterSources(map, x, y, tileset)) {
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
  image: TilesetCanvasImage,
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
  image: TilesetCanvasImage,
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

/** Canvas previews share the same explicit/known color-key contract as Phaser textures. */
export function loadTilesetImage(tileset: TilesetDef): Promise<TilesetCanvasImage> {
  const url = tilesetImageUrl(tileset);
  const color = normalizeRgbHexColor(tileset.transparentColor ?? "");
  // Unknown sheets without an explicit key stay untouched: their top-left pixel may be water.
  const knownKey = tileset.image.type === "bundled" && isColorKeyedChipsetTextureKey(tileset.image.id)
    ? tileset.image.id : null;
  const sourceKey = color ? { image: { ...tileset.image }, transparentColor: color } : knownKey;
  const cacheKey = JSON.stringify([url, color ?? knownKey]);
  const existing = tilesetImagePromises.get(cacheKey);
  if (existing) return existing;
  const promise = new Promise<TilesetCanvasImage>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        resolve(sourceKey ? createTransparentColorKeyCanvas(sourceKey, image) ?? image : image);
      } catch {
        reject(new MapTileDrawError("타일셋 투명색을 처리하지 못했습니다."));
      }
    };
    image.onerror = () => reject(new MapTileDrawError("타일셋 이미지를 읽지 못했습니다."));
    image.src = url;
  });
  tilesetImagePromises.set(cacheKey, promise);
  void promise.catch(() => { tilesetImagePromises.delete(cacheKey); });
  return promise;
}
