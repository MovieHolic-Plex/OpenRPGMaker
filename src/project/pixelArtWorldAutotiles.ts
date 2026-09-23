import catalog from '@/assets/pixelArtWorldAutotiles.json';
import type { AutotileGroup, TilesetDef } from './types';
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
  // The shared terrain shaper authors lowerTiles. Do not advertise upper auto-shaping.
  defaultLayer: 'lower';
  passage: 'solid' | 'passable';
  role: 'wall' | 'terrain' | 'roof';
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

export function xpAutotileGroup(pack: PixelArtWorldAutotilePack, offset: number): AutotileGroup {
  return {
    id: pack.id, name: pack.name, neighborhood: 8,
    memberTileIds: XP_AUTOTILE_MASKS.map((_, index) => offset + index),
    variantMap: Object.fromEntries(Array.from({ length: 256 }, (_, mask) => [String(mask), offset + XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(mask))])),
  };
}

/** Conservative merge target: no bundled semantics, pending grafts or color-key changes. */
export function canAppendPixelArtWorldAutotile(tileset: TilesetDef): boolean {
  return tileset.image.type === 'uploaded' && tileset.kind === 'custom' && tileset.tileSize === 32
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
