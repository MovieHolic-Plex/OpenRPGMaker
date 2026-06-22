import type Phaser from "phaser";
import { TEX_TILESET, TILE_SIZE } from "@/assets/bundled";
import { isDefaultTilesetTexture, tilesetTextureKey } from "@/editor/tilesetImage";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import {
  isLakeAutotileTile,
  lakeAutotileQuarterSources,
  type LakeAutotileQuarter,
  type LakeAutotileQuarterSource,
} from "@/project/defaults/lakeAutotile";
import { store } from "@/project/store";
import type { GameMap, TilesetDef } from "@/project/types";

type ChipsetTileObject =
  | Phaser.GameObjects.Container
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Sprite;
type ChipsetTilePiece = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

export function createChipsetTileObject(
  scene: Phaser.Scene,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number
): ChipsetTileObject;
export function createChipsetTileObject(
  scene: Phaser.Scene,
  map: GameMap,
  x: number,
  y: number,
  tile: number
): ChipsetTileObject;
export function createChipsetTileObject(
  scene: Phaser.Scene,
  map: GameMap,
  tilesetOrX: TilesetDef | number,
  xOrY: number,
  yOrTile: number,
  tileOrUndefined?: number
): ChipsetTileObject {
  const resolved = resolveRenderArgs(map, tilesetOrX, xOrY, yOrTile, tileOrUndefined);
  if (!resolved) return createMissingTileObject(scene, xOrY, yOrTile);
  const { tile, tileset, x, y } = resolved;
  if (isDefaultTilesetTexture(tileset) && isLakeAutotileTile(tile)) return createLakeAutotileObject(scene, map, x, y);
  return createRawTileObject(scene, tileset, x * TILE_SIZE, y * TILE_SIZE, tile);
}

function resolveRenderArgs(
  map: GameMap,
  tilesetOrX: TilesetDef | number,
  xOrY: number,
  yOrTile: number,
  tileOrUndefined?: number
): { readonly tile: number; readonly tileset: TilesetDef; readonly x: number; readonly y: number } | null {
  if (typeof tilesetOrX === "number") {
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return null;
    return { tileset, x: tilesetOrX, y: xOrY, tile: yOrTile };
  }
  if (tileOrUndefined === undefined) return null;
  return { tileset: tilesetOrX, x: xOrY, y: yOrTile, tile: tileOrUndefined };
}

function createMissingTileObject(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x000000, 0);
  rect.setOrigin(0, 0);
  return rect;
}

function createLakeAutotileObject(scene: Phaser.Scene, map: GameMap, x: number, y: number): Phaser.GameObjects.Container {
  const container = scene.add.container(x * TILE_SIZE, y * TILE_SIZE);
  container.setSize(TILE_SIZE, TILE_SIZE);
  for (const part of lakeAutotileQuarterSources(map, x, y)) {
    container.add(createLakeQuarterObject(scene, part));
  }
  return container;
}

function createLakeQuarterObject(scene: Phaser.Scene, part: LakeAutotileQuarterSource): ChipsetTilePiece {
  const animationKey = quarterAnimationKey(part.tile, part.quarter);
  const frameName = quarterFrameName(part.tile, part.quarter);
  const image = animationKey
    ? scene.add.sprite(part.offsetX, part.offsetY, TEX_TILESET, frameName).play(animationKey)
    : scene.add.image(part.offsetX, part.offsetY, TEX_TILESET, frameName);
  image.setOrigin(0, 0);
  return image;
}

function createRawTileObject(scene: Phaser.Scene, tileset: TilesetDef, pixelX: number, pixelY: number, tile: number): ChipsetTilePiece {
  const textureKey = tilesetTextureKey(tileset);
  const animationKey = isDefaultTilesetTexture(tileset) ? animationKeyForTile(tile) : null;
  const image = animationKey
    ? scene.add.sprite(pixelX, pixelY, textureKey, `tile_${tile}`).play(animationKey)
    : scene.add.image(pixelX, pixelY, textureKey, `tile_${tile}`);
  image.setOrigin(0, 0);
  return image;
}

function quarterFrameName(tile: number, quarter: LakeAutotileQuarter): string {
  return `tile_${tile}_${quarter}`;
}

function quarterAnimationKey(tile: number, quarter: LakeAutotileQuarter): string | null {
  const animationKey = animationKeyForTile(tile);
  return animationKey ? `${animationKey}_${quarter}` : null;
}
