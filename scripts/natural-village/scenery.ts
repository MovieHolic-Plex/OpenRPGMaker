import type { Point } from "./blueprint";

export type RoadStroke = {
  readonly width: 1 | 2;
  readonly points: readonly Point[];
};

export type TilePlacement = Point & { readonly tile: number };

export const GRASS_TILES = [270, 271, 300, 301, 330, 331] as const;
export const DARK_GRASS_TILES = [273, 274, 303, 304, 333, 334] as const;

export const CREEK_BANDS = [
  { y0: 0, y1: 7, x0: 4, x1: 7 },
  { y0: 8, y1: 15, x0: 3, x1: 6 },
  { y0: 16, y1: 23, x0: 4, x1: 8 },
  { y0: 24, y1: 31, x0: 3, x1: 7 },
  { y0: 32, y1: 39, x0: 2, x1: 6 },
  { y0: 40, y1: 47, x0: 3, x1: 7 },
  { y0: 48, y1: 55, x0: 4, x1: 8 },
] as const;

export const DARK_GRASS_PATCHES = [
  { cx: 15, cy: 15, rx: 7, ry: 5 },
  { cx: 47, cy: 16, rx: 8, ry: 5 },
  { cx: 22, cy: 33, rx: 7, ry: 4 },
  { cx: 47, cy: 47, rx: 8, ry: 5 },
] as const;

export const ROAD_STROKES = [
  { width: 2, points: [{ x: 32, y: 0 }, { x: 31, y: 6 }, { x: 34, y: 12 }, { x: 32, y: 19 }, { x: 30, y: 23 }] },
  { width: 2, points: [{ x: 0, y: 28 }, { x: 10, y: 28 }, { x: 17, y: 30 }, { x: 23, y: 28 }, { x: 27, y: 28 }] },
  { width: 2, points: [{ x: 37, y: 30 }, { x: 44, y: 32 }, { x: 51, y: 31 }, { x: 58, y: 31 }, { x: 63, y: 32 }] },
  { width: 2, points: [{ x: 33, y: 33 }, { x: 35, y: 39 }, { x: 37, y: 45 }, { x: 36, y: 50 }, { x: 35, y: 55 }] },
  { width: 2, points: [{ x: 30, y: 23 }, { x: 35, y: 24 }, { x: 38, y: 29 }, { x: 35, y: 34 }, { x: 29, y: 33 }, { x: 26, y: 28 }, { x: 30, y: 23 }] },
  { width: 1, points: [{ x: 14, y: 12 }, { x: 17, y: 16 }, { x: 22, y: 20 }, { x: 28, y: 24 }] },
  { width: 1, points: [{ x: 25, y: 11 }, { x: 27, y: 16 }, { x: 29, y: 20 }, { x: 30, y: 23 }] },
  { width: 1, points: [{ x: 42, y: 13 }, { x: 40, y: 17 }, { x: 37, y: 21 }, { x: 35, y: 24 }] },
  { width: 1, points: [{ x: 56, y: 13 }, { x: 54, y: 17 }, { x: 50, y: 20 }, { x: 50, y: 28 }, { x: 47, y: 31 }] },
  { width: 1, points: [{ x: 14, y: 26 }, { x: 20, y: 27 }, { x: 26, y: 28 }] },
  { width: 1, points: [{ x: 12, y: 41 }, { x: 9, y: 41 }, { x: 9, y: 32 }, { x: 18, y: 31 }, { x: 27, y: 31 }] },
  { width: 1, points: [{ x: 29, y: 47 }, { x: 35, y: 47 }, { x: 36, y: 43 }] },
  { width: 1, points: [{ x: 45, y: 43 }, { x: 38, y: 43 }, { x: 38, y: 38 }, { x: 35, y: 34 }] },
  { width: 1, points: [{ x: 55, y: 31 }, { x: 55, y: 32 }] },
  { width: 1, points: [{ x: 55, y: 48 }, { x: 50, y: 48 }, { x: 44, y: 46 }, { x: 37, y: 45 }] },
] as const satisfies readonly RoadStroke[];

export const BROADLEAF_TREES = [
  { x: 0, y: 2 }, { x: 8, y: 2 }, { x: 0, y: 14 }, { x: 9, y: 14 },
  { x: 0, y: 35 }, { x: 0, y: 47 }, { x: 8, y: 49 }, { x: 19, y: 1 },
  { x: 20, y: 14 }, { x: 21, y: 20 }, { x: 22, y: 31 }, { x: 20, y: 48 },
  { x: 37, y: 1 }, { x: 47, y: 1 }, { x: 60, y: 1 }, { x: 37, y: 14 },
  { x: 47, y: 14 }, { x: 60, y: 14 }, { x: 36, y: 19 }, { x: 48, y: 35 },
  { x: 60, y: 35 }, { x: 20, y: 36 }, { x: 22, y: 52 }, { x: 39, y: 48 },
  { x: 47, y: 49 }, { x: 60, y: 50 }, { x: 9, y: 5 }, { x: 9, y: 11 },
  { x: 20, y: 5 }, { x: 21, y: 13 }, { x: 32, y: 2 }, { x: 47, y: 6 },
  { x: 60, y: 5 }, { x: 60, y: 10 }, { x: 0, y: 21 }, { x: 9, y: 21 },
  { x: 21, y: 24 }, { x: 39, y: 17 }, { x: 60, y: 21 }, { x: 0, y: 30 },
  { x: 23, y: 35 }, { x: 50, y: 34 }, { x: 60, y: 40 }, { x: 0, y: 41 },
  { x: 9, y: 44 }, { x: 20, y: 44 }, { x: 39, y: 44 }, { x: 47, y: 53 },
] as const satisfies readonly Point[];

export const CONIFER_TREES = [
  { x: 9, y: 9 }, { x: 10, y: 18 }, { x: 9, y: 24 }, { x: 9, y: 40 }, { x: 10, y: 53 },
  { x: 18, y: 2 }, { x: 19, y: 17 }, { x: 21, y: 26 }, { x: 22, y: 43 },
  { x: 35, y: 3 }, { x: 37, y: 12 }, { x: 38, y: 18 }, { x: 38, y: 34 }, { x: 38, y: 43 },
  { x: 49, y: 4 }, { x: 49, y: 10 }, { x: 50, y: 17 }, { x: 50, y: 35 }, { x: 50, y: 44 },
  { x: 59, y: 8 }, { x: 61, y: 24 }, { x: 61, y: 42 }, { x: 10, y: 0 },
  { x: 10, y: 7 }, { x: 21, y: 3 }, { x: 21, y: 12 }, { x: 36, y: 7 },
  { x: 48, y: 8 }, { x: 61, y: 18 }, { x: 10, y: 29 }, { x: 22, y: 28 },
  { x: 39, y: 22 }, { x: 48, y: 19 }, { x: 61, y: 28 }, { x: 1, y: 33 },
  { x: 21, y: 38 }, { x: 24, y: 47 }, { x: 39, y: 40 }, { x: 49, y: 39 },
  { x: 61, y: 46 }, { x: 10, y: 51 }, { x: 19, y: 53 }, { x: 40, y: 53 },
] as const satisfies readonly Point[];

export const PROPS = [
  { x: 42, y: 24, tile: 234 }, { x: 43, y: 24, tile: 235 }, { x: 44, y: 24, tile: 236 },
  { x: 40, y: 27, tile: 202 }, { x: 41, y: 27, tile: 203 }, { x: 47, y: 26, tile: 237 },
  { x: 45, y: 28, tile: 327 }, { x: 46, y: 28, tile: 328 }, { x: 50, y: 30, tile: 320 },
  { x: 28, y: 25, tile: 440 }, { x: 36, y: 30, tile: 441 },
  { x: 18, y: 13, tile: 288 }, { x: 11, y: 27, tile: 288 }, { x: 20, y: 41, tile: 288 }, { x: 51, y: 39, tile: 288 },
  { x: 19, y: 12, tile: 289 }, { x: 10, y: 25, tile: 289 }, { x: 49, y: 43, tile: 289 },
  { x: 9, y: 46, tile: 259 },
  { x: 20, y: 9, tile: 349 }, { x: 21, y: 9, tile: 350 }, { x: 20, y: 10, tile: 351 }, { x: 21, y: 10, tile: 352 },
  { x: 29, y: 27, tile: 318 }, { x: 29, y: 28, tile: 348 }, { x: 38, y: 29, tile: 411 },
  { x: 41, y: 26, tile: 234 }, { x: 42, y: 26, tile: 235 }, { x: 43, y: 26, tile: 235 }, { x: 44, y: 26, tile: 236 },
  { x: 47, y: 23, tile: 202 }, { x: 48, y: 23, tile: 203 }, { x: 48, y: 27, tile: 237 },
  { x: 31, y: 25, tile: 327 }, { x: 32, y: 25, tile: 328 }, { x: 34, y: 32, tile: 358 }, { x: 34, y: 33, tile: 388 },
  { x: 20, y: 12, tile: 350 }, { x: 19, y: 15, tile: 351 }, { x: 21, y: 11, tile: 352 },
  { x: 59, y: 14, tile: 349 }, { x: 18, y: 26, tile: 350 }, { x: 20, y: 40, tile: 351 },
  { x: 39, y: 43, tile: 349 }, { x: 49, y: 45, tile: 352 }, { x: 60, y: 48, tile: 350 },
  { x: 22, y: 22, tile: 288 }, { x: 24, y: 25, tile: 289 }, { x: 37, y: 18, tile: 288 },
  { x: 50, y: 16, tile: 289 }, { x: 22, y: 46, tile: 288 }, { x: 48, y: 38, tile: 289 },
] as const satisfies readonly TilePlacement[];

export const FENCE_ROWS = [
  { x0: 10, x1: 13, y: 14 }, { x0: 16, x1: 19, y: 14 },
  { x0: 11, x1: 13, y: 28 }, { x0: 16, x1: 18, y: 28 },
  { x0: 52, x1: 54, y: 52 }, { x0: 57, x1: 59, y: 52 },
] as const;
