import type Phaser from "phaser";
import { createSharedAnimatedTile } from "@/editor/sharedTileAnimation";
import { chipsetAnimationKey, TILE_SIZE } from "@/assets/bundled";
import {
  ensureTilesetTexture,
  isDefaultTilesetTexture,
  supportsChipsetQuarterComposition,
  tilesetAnimationKeyForTile,
} from "@/editor/tilesetImage";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import {
  isLakeAutotileTile,
  lakeAutotileQuarterSources,
  type LakeAutotileQuarter,
  type LakeAutotileQuarterSource,
} from "@/project/defaults/lakeAutotile";
import { roadAutotileTileForCell } from "@/project/defaults/roadAutotile";
import {
  chipsetQuarterComposition,
  type ChipsetQuarterComposition,
} from "@/project/defaults/terrainQuarterAutotile";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
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
  if (!resolved) return createMissingTileObject(scene, typeof tilesetOrX === "number" ? tilesetOrX : xOrY, typeof tilesetOrX === "number" ? xOrY : yOrTile, mapTileSize(map));
  const { tile, tileset, x, y } = resolved;
  // 좌표 단위는 맵(=타일셋)이 정한다. 16 을 박아 두면 32px 타일셋에서 칸마다 절반씩 겹쳐
  // 그려지고 클릭 칸과 어긋난다.
  const tileSize = mapTileSize(map, tileset);
  // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함.
  if (supportsChipsetQuarterComposition(tileset) && isLakeAutotileTile(tile, tileset)) {
    return createLakeAutotileObject(scene, map, tileset, x, y);
  }
  if (supportsChipsetQuarterComposition(tileset) && map.lowerTiles[y * map.width + x] === tile) {
    const composition = chipsetQuarterComposition(map, tileset, x, y);
    if (composition) return createTerrainQuarterObject(scene, tileset, x, y, composition);
  }
  const roadTile = isDefaultTilesetTexture(tileset) ? roadAutotileTileForCell(map, { x, y }) : null;
  if (roadTile !== null) return createRawTileObject(scene, tileset, x * tileSize, y * tileSize, roadTile);
  // 투명 칩이 lower 에 단독이면 투명 부분이 검게 보임 → 정책이 정한 받침 타일과 합성.
  const backingTile = tileBackingTile(tileset, tile);
  if (backingTile !== null) {
    return createBackedTileObject(scene, tileset, x, y, tile, backingTile, tileSize);
  }
  return createRawTileObject(scene, tileset, x * tileSize, y * tileSize, tile);
}

/**
 * 타일 한 칸을 원래 모양 그대로 — 지형 쿼터 합성·호수 자동타일·길 변형·받침 없이.
 * 2층·4층은 저자가 고른 칩 그대로 그린다(게임 renderRawTile 과 같은 규칙).
 */
export function createRawChipsetTileObject(
  scene: Phaser.Scene,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number
): ChipsetTilePiece {
  const tileSize = mapTileSize(map, tileset);
  return createRawTileObject(scene, tileset, x * tileSize, y * tileSize, tile);
}

function createBackedTileObject(
  scene: Phaser.Scene,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  backingTile: number,
  tileSize: number,
): Phaser.GameObjects.Container {
  // 받침은 커스텀·업로드 칩셋에도 적용된다(내장 전용이 아니다) — 컨테이너도 좌표 단위를 따라야 한다.
  const container = scene.add.container(x * tileSize, y * tileSize);
  container.setSize(tileSize, tileSize);
  container.add(createRawTileObject(scene, tileset, 0, 0, backingTile));
  container.add(createRawTileObject(scene, tileset, 0, 0, tile));
  return container;
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

function createMissingTileObject(scene: Phaser.Scene, x: number, y: number, tileSize: number): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(x * tileSize, y * tileSize, tileSize, tileSize, 0x000000, 0);
  rect.setOrigin(0, 0);
  return rect;
}

function createLakeAutotileObject(
  scene: Phaser.Scene,
  map: GameMap,
  tileset: TilesetDef,
  x: number,
  y: number
): Phaser.GameObjects.Container {
  const container = scene.add.container(x * TILE_SIZE, y * TILE_SIZE);
  container.setSize(TILE_SIZE, TILE_SIZE);
  const textureKey = ensureTilesetTexture(scene, tileset);
  for (const part of lakeAutotileQuarterSources(map, x, y, tileset)) {
    container.add(createLakeQuarterObject(scene, textureKey, part));
  }
  return container;
}

function createLakeQuarterObject(
  scene: Phaser.Scene,
  textureKey: string,
  part: LakeAutotileQuarterSource
): ChipsetTilePiece {
  // 맵 셀 배치 위치(part.quarter/offset)와 타일 그림판 크롭(sourceQuarter)을 분리한다.
  // 예: se 자리 ← tile 90/91/92 각각의 nw 8×8 애니.
  const sourceQ = part.sourceQuarter;
  const animationKey = quarterAnimationKey(textureKey, part.tile, sourceQ);
  const frameName = quarterFrameName(part.tile, sourceQ);
  const image = animationKey
    ? createSharedAnimatedTile(scene, part.offsetX, part.offsetY, textureKey, frameName, animationKey)
    : scene.add.image(part.offsetX, part.offsetY, textureKey, frameName);
  image.setOrigin(0, 0);
  return image;
}

// 모래/흙길 지형 쿼터 합성: 각 쿼터는 계산된 소스 타일의 같은 위치를 사용한다.
function createTerrainQuarterObject(
  scene: Phaser.Scene,
  tileset: TilesetDef,
  x: number,
  y: number,
  composition: ChipsetQuarterComposition
): Phaser.GameObjects.Container {
  const container = scene.add.container(x * TILE_SIZE, y * TILE_SIZE);
  container.setSize(TILE_SIZE, TILE_SIZE);
  if (composition.underlayTile !== undefined) {
    container.add(createRawTileObject(scene, tileset, 0, 0, composition.underlayTile));
  }
  const textureKey = ensureTilesetTexture(scene, tileset);
  for (const part of composition.sources) {
    const image = scene.add.image(part.offsetX, part.offsetY, textureKey, `tile_${part.tile}_${part.quarter}`);
    image.setOrigin(0, 0);
    container.add(image);
  }
  return container;
}

function createRawTileObject(scene: Phaser.Scene, tileset: TilesetDef, pixelX: number, pixelY: number, tile: number): ChipsetTilePiece {
  const textureKey = ensureTilesetTexture(scene, tileset);
  const baseAnimationKey = tilesetAnimationKeyForTile(tileset, tile);
  const animationKey = baseAnimationKey ? chipsetAnimationKey(textureKey, baseAnimationKey) : null;
  const image = animationKey
    ? createSharedAnimatedTile(scene, pixelX, pixelY, textureKey, `tile_${tile}`, animationKey)
    : scene.add.image(pixelX, pixelY, textureKey, `tile_${tile}`);
  image.setOrigin(0, 0);
  return image;
}

function quarterFrameName(tile: number, quarter: LakeAutotileQuarter): string {
  return `tile_${tile}_${quarter}`;
}

function quarterAnimationKey(textureKey: string, tile: number, quarter: LakeAutotileQuarter): string | null {
  const animationKey = animationKeyForTile(tile);
  return animationKey ? chipsetAnimationKey(textureKey, `${animationKey}_${quarter}`) : null;
}
