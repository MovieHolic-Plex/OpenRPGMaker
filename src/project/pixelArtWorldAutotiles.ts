import catalog from '@/assets/pixelArtWorldAutotiles.json';
import type { AutotileGroup, TilesetDef, TileGroupRole } from './types';
import { autotileNeighborMask } from './defaults/autotileEngine';

export interface PixelArtWorldAutotilePack {
  id: string;
  name: string;
  filename: string;
  sha256: string;
  sourcePage: string;
  downloadUrl: string;
  termsUrl: string;
  credit: string;
  checkedAt: string;
  description: string;
  defaultLayer: 'lower' | 'upper';
  passage: 'solid' | 'passable';
  role: TileGroupRole;
  surface: string;
  terrainTag: 0;
  underlay: 'none' | 'floor' | 'wall' | 'roof' | 'material';
  placement: 'lower-autoshape' | 'manual-mask';
  shapePolicy: 'blob' | 'rectangle';
  frames: 1 | 4;
  sourceWidth: number;
  sourceHeight: 128;
  quarterLayout: 'xp-full-edge-v1';
  fps?: number;
  timingProvenance?: 'editor-default-not-author-specified';
  framePixelHashes?: string[];
  aliases: { filename: string; downloadUrl: string; sourcePages: string[] }[];
  nonOpaqueMasks: number[];
  restrictions: string[];
}
export const PIXEL_ART_WORLD_AUTOTILES = catalog as readonly PixelArtWorldAutotilePack[];

/** A diagonal only matters when both incident cardinal neighbors connect. */
export function normalizeXpAutotileMask(mask: number): number {
  let result = mask & 15;
  for (const [diagonal, incident] of [[16, 3], [32, 6], [64, 12], [128, 9]]) {
    if ((mask & incident) === incident && (mask & diagonal)) result |= diagonal;
  }
  return result;
}
export const XP_AUTOTILE_MASKS = [...new Set(Array.from({ length: 256 }, (_, mask) => normalizeXpAutotileMask(mask)))].sort((a, b) => a - b);

/** Static XP 96×128 source. Each blit is exactly 16×16; no resizing or reflection. */
export function xpAutotileQuarters(mask: number): { sx: number; sy: number; dx: number; dy: number }[] {
  const normalized = normalizeXpAutotileMask(mask);
  return [0, 1, 2, 3].map(quarter => {
    const right = quarter % 2;
    const bottom = Math.floor(quarter / 2);
    const dx = right * 16, dy = bottom * 16;
    // XP has a dedicated isolated preview tile (important for authored variations).
    if (normalized === 0) return { sx: dx, sy: dy, dx, dy };
    const vertical = (normalized & (bottom ? 4 : 1)) !== 0;
    const horizontal = (normalized & (right ? 2 : 8)) !== 0;
    const diagonal = (normalized & (bottom ? (right ? 32 : 64) : (right ? 16 : 128))) !== 0;
    if (vertical && horizontal && !diagonal) return { sx: 64 + dx, sy: dy, dx, dy };
    return {
      sx: horizontal ? 32 + dx : (right ? 80 : 0),
      sy: vertical ? 64 + dy : (bottom ? 112 : 32),
      dx, dy,
    };
  });
}


/** Full XP edges span 32px: an opposite missing edge also selects the interior half.
 * Kept separate from the legacy helper used by existing authored city generators.
 * Coordinate geometry cross-checked with mkxp/src/autotiles.cpp (not copied code).
 */
export function xpFullAutotileQuarters(mask: number): ReturnType<typeof xpAutotileQuarters> {
  const normalized = normalizeXpAutotileMask(mask);
  const north = !!(normalized & 1), east = !!(normalized & 2), south = !!(normalized & 4), west = !!(normalized & 8);
  return [0, 1, 2, 3].map(quarter => {
    const right = quarter % 2, bottom = Math.floor(quarter / 2);
    const dx = right * 16, dy = bottom * 16;
    if (normalized === 0) return { sx: dx, sy: dy, dx, dy };
    const vertical = bottom ? south : north, horizontal = right ? east : west;
    const diagonal = normalized & (bottom ? (right ? 32 : 64) : (right ? 16 : 128));
    if (vertical && horizontal && !diagonal) return { sx: 64 + dx, sy: dy, dx, dy };
    const sx = right ? (!east ? 80 : !west ? 16 : 48) : (!west ? 0 : !east ? 64 : 32);
    const sy = bottom ? (!south ? 112 : !north ? 48 : 80) : (!north ? 32 : !south ? 96 : 64);
    return { sx, sy, dx, dy };
  });
}

export function xpAutotileGroup(pack: PixelArtWorldAutotilePack, offset: number, tileIds = XP_AUTOTILE_MASKS.map((_, i) => offset + i)): AutotileGroup {
  return {
    id: pack.id, name: pack.name, neighborhood: 8,
    memberTileIds: tileIds,
    variantMap: Object.fromEntries(Array.from({ length: 256 }, (_, mask) => [String(mask), tileIds[XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(mask))]])),
  };
}

/** Conservative merge target: no bundled semantics, pending grafts or color-key changes. */
export function canAppendPixelArtWorldAutotile(tileset: TilesetDef): boolean {
  return !tileset.id.startsWith('shared_') && tileset.image.type === 'uploaded' && tileset.kind === 'custom' && tileset.tileSize === 32
    && Number.isInteger(tileset.tilesPerRow) && tileset.tilesPerRow > 0 && tileset.tilesPerRow <= 128
    && Number.isInteger(tileset.count) && tileset.count > 0
    && !tileset.tileGrafts?.length && !tileset.transparentColor && !tileset.referenceSourceTilesetId;
}

/** Fixed specimen includes rectangle, hole/concave corners, thin runs, L/T junctions and a single cell. */
export function xpAutotileExample(offset: number) {
  const footprint = [
    '................',
    '.#####..#.......',
    '.#####..#..###.#',
    '.#####..#...#...',
    '........####....',
    '.#####..........',
    '.#...#...#......',
    '.#...#..###.....',
    '.#####...#......',
    '................',
  ];
  const width = footprint[0].length, height = footprint.length;
  const seed = footprint.join('').split('').map(char => char === '#' ? offset : -1);
  const view = { width, height, lowerTiles: seed };
  const lowerTiles = seed.map((tile, index) => tile < 0 ? -1 : offset + XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(
    autotileNeighborMask(view, index % width, Math.floor(index / width), id => id === offset, 8),
  )));
  return { width, height, lowerTiles, upperTiles: Array<number>(width * height).fill(-1) };
}

/** Verify complete fixed specimen arrays; this does not validate arbitrary room aesthetics/events. */
export function validateXpAutotileExample(offset: number, actual: ReturnType<typeof xpAutotileExample>) {
  const expected = xpAutotileExample(offset);
  const errors: { code: string; x: number; y: number }[] = [];
  if (actual.width !== expected.width || actual.height !== expected.height
    || actual.lowerTiles.length !== expected.lowerTiles.length || actual.upperTiles.length !== expected.upperTiles.length) {
    return [{ code: 'DIMENSIONS', x: 0, y: 0 }];
  }
  expected.lowerTiles.forEach((tile, i) => {
    if (tile !== actual.lowerTiles[i]) errors.push({ code: 'XP_CONNECTION', x: i % expected.width, y: Math.floor(i / expected.width) });
    if (actual.upperTiles[i] !== -1) errors.push({ code: 'XP_WRONG_LAYER', x: i % expected.width, y: Math.floor(i / expected.width) });
  });
  return errors;
}

/** Each temporal strip stays on one atlas row, including targets with odd row widths. */
export function xpAutotileAtlasLayout(offset: number, columns: number, frames: 1 | 4) {
  if (!Number.isInteger(columns) || columns < frames || !Number.isInteger(offset) || offset < 0 || offset % columns) {
    throw new Error(`XP ${frames}프레임은 최소 ${frames}열의 행 정렬된 아틀라스가 필요합니다.`);
  }
  let cursor = offset;
  const tileIds = XP_AUTOTILE_MASKS.map(() => {
    if (cursor % columns + frames > columns) cursor += columns - cursor % columns;
    const base = cursor; cursor += frames; return base;
  });
  return { tileIds, count: Math.ceil(cursor / columns) * columns };
}

/** Manual upper families use the same quarter dictionary without claiming upper brush shaping. */
export function xpAutotilePlacementExample(pack: PixelArtWorldAutotilePack, tileIds: number[]) {
  const sample = xpAutotileExample(0);
  let indices = sample.lowerTiles;
  if (pack.shapePolicy === 'rectangle') {
    const seed = Array.from({ length: sample.width * sample.height }, (_, i) => {
      const x = i % sample.width, y = Math.floor(i / sample.width);
      return x >= 2 && x <= 9 && y >= 2 && y <= 6 ? 0 : -1;
    });
    const view = { width: sample.width, height: sample.height, lowerTiles: seed };
    indices = seed.map((tile, i) => tile < 0 ? -1 : XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(
      autotileNeighborMask(view, i % sample.width, Math.floor(i / sample.width), id => id === 0, 8),
    )));
  }
  const placed = indices.map(i => i < 0 ? -1 : tileIds[i]);
  return { width: sample.width, height: sample.height,
    lowerTiles: pack.defaultLayer === 'lower' ? placed : placed.map(() => -1),
    upperTiles: pack.defaultLayer === 'upper' ? placed : placed.map(() => -1),
  };
}

/** Exact specimen validation only; does not certify scene traversal or event behavior. */
export function validateXpAutotilePlacementExample(pack: PixelArtWorldAutotilePack, tileIds: number[], actual: ReturnType<typeof xpAutotilePlacementExample>, backingTile: number | null = null) {
  const expected = xpAutotilePlacementExample(pack, tileIds);
  if (backingTile !== null) expected.lowerTiles = expected.lowerTiles.map(tile => tile < 0 ? backingTile : tile);
  if (actual.width !== expected.width || actual.height !== expected.height
    || actual.lowerTiles.length !== expected.lowerTiles.length || actual.upperTiles.length !== expected.upperTiles.length) return [{ code: 'DIMENSIONS', x: 0, y: 0 }];
  const home = pack.defaultLayer === 'lower' ? 'lowerTiles' : 'upperTiles';
  const other = pack.defaultLayer === 'lower' ? 'upperTiles' : 'lowerTiles';
  return expected[home].flatMap((tile, i) => {
    if (tile === actual[home][i] && expected[other][i] === actual[other][i]) return [];
    return [{ code: tileIds.includes(actual[other][i]) ? 'XP_WRONG_LAYER' : 'XP_CONNECTION', x: i % expected.width, y: Math.floor(i / expected.width) }];
  });
}
