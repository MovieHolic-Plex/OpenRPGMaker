import schoolSewerCatalog from '@/assets/pixelArtWorldSchoolSewerCatalog.json';
import catalog from '@/assets/pixelArtWorldCatalog.json';
import urbanCatalog from '@/assets/pixelArtWorldUrbanCatalog.json';
import schoolCatalog from '@/assets/pixelArtWorldSchoolCatalog.json';
import facilityCatalog from '@/assets/pixelArtWorldFacilitiesCatalog.json';
import homeCatalog from '@/assets/pixelArtWorldHomeCatalog.json';
import staticExpansionCatalog from '@/assets/pixelArtWorldStaticExpansionCatalog.json';
import nativeComplementsCatalog from '@/assets/pixelArtWorldNativeComplementsCatalog.json';
import hospitalityComplementsCatalog from '@/assets/pixelArtWorldHospitalityComplementsCatalog.json';
import mansionExteriorsCatalog from '@/assets/pixelArtWorldMansionExteriorsCatalog.json';
import mansionInteriorsCatalog from '@/assets/pixelArtWorldMansionInteriorsCatalog.json';
import japaneseInteriorsCatalog from '@/assets/pixelArtWorldJapaneseInteriorsCatalog.json';
import bathGymCatalog from '@/assets/pixelArtWorldBathGymCatalog.json';
import type { TilesetDef } from './types';

export interface ExternalTileRecipe {
  id: string;
  name: string;
  sourceRect: { x: number; y: number; width: number; height: number };
  facing: string;
  tiles: number[][];
  placementKind?: string;
  supportCells?: { x: number; y: number }[];
  supportTileIds?: number[];
  /** Optional wall rows behind a wall fixture in its standalone teaching example. */
  exampleWallRows?: number[];
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
  scenes?: ExternalTileScene[];
}
/** Metadata-only authored example; every tile belongs to this pack's source PNG. */
export interface ExternalTileScene {
  id: string;
  name: string;
  width: number;
  height: number;
  lowerTiles: number[];
  upperTiles: number[];
  approachCells: { x: number; y: number }[];
  placements: { recipeId: string; x: number; y: number }[];
  notes: string;
  passableTiles?: number[];
  lowerTileIds?: number[];
  /** Wall-cap footprint, resolved with the user's separately imported XP WallA01. */
  ceilingCells?: { x: number; y: number }[];
  rooms?: { id: string; name: string; x: number; y: number; width: number; height: number }[];
  doors?: { sceneId: string; x: number; y: number; approach: { x: number; y: number } }[];
  doorways?: { from: string; to: string; x: number; y: number; width: number; height: number }[];
}
export const EXTERNAL_TILESET_PACKS: readonly ExternalTilesetPack[] = [...catalog, ...urbanCatalog, ...schoolCatalog, ...facilityCatalog, ...homeCatalog, ...staticExpansionCatalog, ...nativeComplementsCatalog, ...hospitalityComplementsCatalog, ...bathGymCatalog, ...japaneseInteriorsCatalog, ...mansionInteriorsCatalog, ...schoolSewerCatalog, ...mansionExteriorsCatalog];

export function validateExternalTileScenes(pack: ExternalTilesetPack): void {
  const count = pack.width * pack.height / (pack.tileSize ** 2);
  const ids = new Set<string>();
  for (const scene of pack.scenes ?? []) {
    if (!/^[\w.-]{1,90}$/.test(scene.id) || ids.has(scene.id)) throw new Error('장면 ID가 잘못되었거나 중복됩니다.');
    ids.add(scene.id);
    if (!Number.isInteger(scene.width) || !Number.isInteger(scene.height) || scene.width < 1 || scene.height < 1 || scene.width * scene.height > 4096) throw new Error('장면 크기가 잘못되었습니다.');
    const length = scene.width * scene.height;
    if (scene.lowerTiles.length !== length || scene.upperTiles.length !== length) throw new Error('장면 타일 배열 길이가 다릅니다.');
    for (const tile of [...scene.lowerTiles, ...scene.upperTiles]) if (!Number.isInteger(tile) || tile < -1 || tile >= count) throw new Error('장면 타일 번호가 원본 범위 밖입니다.');
    for (const tile of [...(scene.lowerTileIds ?? []), ...(scene.passableTiles ?? [])]) if (!Number.isInteger(tile) || tile < 0 || tile >= count) throw new Error('장면 통행/레이어 타일 번호 오류');
    for (const { x, y } of scene.approachCells) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= scene.width || y >= scene.height || scene.upperTiles[y * scene.width + x] !== -1) throw new Error('장면 접근칸이 잘못되었거나 막혀 있습니다.');
      if (!(scene.passableTiles ?? [pack.floorTile]).includes(scene.lowerTiles[y * scene.width + x])) throw new Error('장면 접근칸의 바닥이 통행 불가입니다.');
    }
    const upperIds = new Set(scene.upperTiles.filter(tile => tile >= 0));
    if ((scene.lowerTileIds ?? []).some(tile => upperIds.has(tile))) throw new Error('같은 타일 번호를 하위와 상위의 홈 레이어로 중복 지정할 수 없습니다.');
  }
}

/** Full example: one-cell floor border, complete upper object, free approach. */
export function externalRecipeExample(pack: ExternalTilesetPack, recipe: ExternalTileRecipe) {
  const width = recipe.sourceRect.width + 2;
  const height = recipe.sourceRect.height + 2;
  const lowerTiles = Array<number>(width * height).fill(pack.floorTile);
  const upperTiles = Array<number>(width * height).fill(-1);
  if (recipe.placementKind === 'wall-mounted' && recipe.exampleWallRows?.length) {
    if (recipe.exampleWallRows.length !== recipe.sourceRect.height || recipe.exampleWallRows.some(tile => !Number.isInteger(tile) || tile < 0 || tile >= pack.width * pack.height / (pack.tileSize ** 2))) throw new Error('벽 부착 예제의 받침 행이 원본 규격과 다릅니다.');
    for (let y = 0; y <= recipe.sourceRect.height; y++) {
      lowerTiles.fill(recipe.exampleWallRows[Math.max(0, y - 1)]!, y * width, (y + 1) * width);
    }
  }
  recipe.tiles.forEach((row, y) => row.forEach((tile, x) => { upperTiles[(y + 1) * width + x + 1] = tile; }));
  const approach = recipe.facing === 'west' ? { x: 0, y: Math.floor(height / 2) }
    : recipe.facing === 'east' ? { x: width - 1, y: Math.floor(height / 2) }
    : { x: Math.floor(width / 2), y: recipe.facing === 'north' ? 0 : height - 1 };
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
  validateExternalTileScenes(pack);
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
  for (const scene of pack.scenes ?? []) {
    for (const tile of scene.lowerTileIds ?? []) {
      tileset.priority[tile] = 'lower';
      if (tileset.tileMeta![tile].source === 'unknown') tileset.tileMeta![tile] = { label: '장면 구조 타일', description: `${scene.name}의 전체 배열 참조.`, defaultLayer: 'lower', source: 'imported' };
    }
    for (const tile of scene.passableTiles ?? []) {
      tileset.passability[tile] = { up: true, down: true, left: true, right: true };
      tileset.tileMeta![tile] = { ...tileset.tileMeta![tile], passage: 'passable' };
    }
    for (const tile of new Set(scene.upperTiles.filter(tile => tile >= 0))) {
      tileset.priority[tile] = 'upper';
      if (tileset.tileMeta![tile].source === 'unknown') tileset.tileMeta![tile] = { label: '장면 상위 조각', description: `${scene.name}의 전체 배열·설명 참조.`, defaultLayer: 'upper', source: 'imported' };
    }
  }
  return tileset;
}
