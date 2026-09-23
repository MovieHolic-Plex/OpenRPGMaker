import catalog from '@/assets/pixelArtWorldCatalog.json';
import type { TilesetDef } from './types';

export interface ExternalTileRecipe {
  id: string;
  name: string;
  sourceRect: { x: number; y: number; width: number; height: number };
  facing: string;
  tiles: number[][];
}
export interface ExternalTilesetPack {
  id: string;
  name: string;
  sourcePage: string;
  downloadUrl: string;
  termsUrl: string;
  credit: string;
  filename: string;
  width: number;
  height: number;
  tileSize: number;
  sha256: string;
  checkedAt: string;
  floorTile: number;
  notes: string;
  recipes: ExternalTileRecipe[];
}
export const EXTERNAL_TILESET_PACKS: readonly ExternalTilesetPack[] = catalog;

/** Full example: one-cell floor border, complete upper object, free approach. */
export function externalRecipeExample(pack: ExternalTilesetPack, recipe: ExternalTileRecipe) {
  const width = recipe.sourceRect.width + 2;
  const height = recipe.sourceRect.height + 2;
  const lowerTiles = Array<number>(width * height).fill(pack.floorTile);
  const upperTiles = Array<number>(width * height).fill(-1);
  recipe.tiles.forEach((row, y) => row.forEach((tile, x) => { upperTiles[(y + 1) * width + x + 1] = tile; }));
  const approach = { x: Math.floor(width / 2), y: recipe.facing === 'north' ? 0 : height - 1 };
  return { width, height, lowerTiles, upperTiles, approach };
}

/** Shape/occupancy check for the documented fixed example, not an aesthetic or event check. */
export function validateExternalRecipeExample(pack: ExternalTilesetPack, recipe: ExternalTileRecipe, actual: ReturnType<typeof externalRecipeExample>) {
  const expected = externalRecipeExample(pack, recipe);
  const errors: { code: string; x: number; y: number }[] = [];
  if (actual.width !== expected.width || actual.height !== expected.height || actual.lowerTiles.length !== expected.lowerTiles.length || actual.upperTiles.length !== expected.upperTiles.length) {
    return [{ code: 'DIMENSIONS', x: 0, y: 0 }];
  }
  expected.lowerTiles.forEach((tile, i) => {
    if (actual.lowerTiles[i] !== tile) errors.push({ code: 'FLOOR_REPLACED', x: i % expected.width, y: Math.floor(i / expected.width) });
    if (actual.upperTiles[i] !== expected.upperTiles[i]) errors.push({ code: 'OBJECT_CELL', x: i % expected.width, y: Math.floor(i / expected.width) });
  });
  const { x, y } = expected.approach;
  if (actual.upperTiles[y * expected.width + x] !== -1) errors.push({ code: 'APPROACH_BLOCKED', x, y });
  return errors;
}

/** Called only after exact bytes + decoded dimensions have been verified. No default project seeding. */
export function createExternalTileset(pack: ExternalTilesetPack, assetId: string, tilesetId: string): TilesetDef {
  const count = pack.width * pack.height / (pack.tileSize ** 2);
  const tileset: TilesetDef = {
    id: tilesetId, name: pack.name, kind: 'custom', image: { type: 'uploaded', id: assetId },
    tileSize: pack.tileSize, tilesPerRow: 8, count,
    passability: Array.from({ length: count }, () => ({ up: false, down: false, left: false, right: false })),
    priority: Array.from({ length: count }, () => 'lower' as const), terrain: Array<number>(count).fill(0),
    tileMeta: Array.from({ length: count }, () => ({ label: '미검토', description: '시범 사전 밖의 타일. 이미지와 통행·레이어를 직접 검토한 뒤 사용.', source: 'unknown' as const })),
    tileGroups: [], autotileGroups: [],
  };
  tileset.passability[pack.floorTile] = { up: true, down: true, left: true, right: true };
  tileset.tileMeta![pack.floorTile] = { label: '반복 바닥', description: '시범 가구 조립의 하위 바닥. 1칸 반복.', defaultLayer: 'lower', passage: 'passable', repeatability: 'repeat', source: 'imported' };
  for (const recipe of pack.recipes) {
    for (const tile of recipe.tiles.flat()) {
      tileset.priority[tile] = 'upper';
      tileset.tileMeta![tile] = { label: recipe.name, description: `${recipe.id}의 조각. 원본 배열 전체를 함께 배치. 사각 점유 영역 전체 통행 차단.`, defaultLayer: 'upper', passage: 'solid', repeatability: 'fixed', source: 'imported' };
    }
    const { approach: _approach, ...previewMap } = externalRecipeExample(pack, recipe);
    tileset.tileGroups!.push({
      id: recipe.id, name: recipe.name, role: 'prop', defaultLayer: 'upper', tileIds: recipe.tiles.flat(),
      sourceRect: { ...recipe.sourceRect }, source: 'imported', confidence: 'high',
      description: `고정 ${recipe.sourceRect.width}×${recipe.sourceRect.height}칸 가구. ${recipe.facing} 방향 접근.`,
      placementRules: '상위 레이어에 원본 순서로 전체 배치. 하위 바닥 보존. 좌우반전·중간 반복 금지. 앞쪽 한 칸 비움. 문/이벤트 자동 생성 없음.',
      previewMap,
    });
  }
  return tileset;
}
