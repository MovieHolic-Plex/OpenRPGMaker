/**
 * Shared lava / stone / ice dungeon grid builders.
 * Used by scripts/build-dungeon-themed-maps.mts and scripts/extend-home-8pyeong-with-dungeons.mts
 * so map visuals do not diverge.
 */
import { shapeAutotileGroupAround } from "./autotileEngine";
import {
  createDungeonTerrainAutotileGroups,
  DUNGEON_TERRAIN_AUTOTILE_PREFIX,
} from "./dungeonTerrainAutotiles";
import type { AutotileGroup } from "../types";
import { stampCanonicalIceRidge } from "./iceDiagonalTerrain";

export const DUNGEON_MAP_WIDTH = 26;
export const DUNGEON_MAP_HEIGHT = 18;
export const DUNGEON_TILESET_ID = "easyrpg_chipset_dungeon";

export type DungeonGrid = {
  lower: number[];
  upper: number[];
};

export type DungeonTheme = "lava" | "stone" | "ice";

export type DungeonLandmark = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly role: "exit" | "encounter" | "boss";
};

export type BuiltDungeonThemeMap = {
  readonly theme: DungeonTheme;
  readonly width: number;
  readonly height: number;
  readonly tilesetId: string;
  readonly grid: DungeonGrid;
  readonly start: { x: number; y: number };
  readonly landmarks: readonly DungeonLandmark[];
};

type WallSet = {
  ceilKey: "abyss-blue" | "abyss-gray" | "pit-gold";
  ceilBody: number;
  band: readonly [number, number, number];
  bandBody: readonly [number, number, number];
};

const W = DUNGEON_MAP_WIDTH;
const H = DUNGEON_MAP_HEIGHT;

const groups = createDungeonTerrainAutotileGroups();

function group(key: string): AutotileGroup {
  const g = groups.find((c) => c.id === `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
  if (!g) throw new Error(`missing dungeon terrain group ${key}`);
  return g;
}

function idx(x: number, y: number): number {
  return y * W + x;
}

function blank(fill: number): DungeonGrid {
  return {
    lower: new Array<number>(W * H).fill(fill),
    upper: new Array<number>(W * H).fill(-1),
  };
}

function rect(
  g: DungeonGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: number,
  skip?: (x: number, y: number) => boolean,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (skip?.(x, y)) continue;
      g.lower[idx(x, y)] = tile;
      pts.push({ x, y });
    }
  }
  return pts;
}

function shape(g: DungeonGrid, key: string, pts: { x: number; y: number }[]): void {
  if (pts.length === 0) return;
  shapeAutotileGroupAround({ width: W, height: H, lowerTiles: g.lower }, group(key), pts);
}

function ceiling(g: DungeonGrid, ws: WallSet): void {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) g.lower[idx(x, y)] = ws.ceilBody;
    }
  }
  const pts: { x: number; y: number }[] = [];
  for (let y = 1; y < H - 1; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      if (x === 1 || y === 1 || x === W - 2 || y === H - 2) {
        g.lower[idx(x, y)] = ws.ceilBody;
        pts.push({ x, y });
      }
    }
  }
  shape(g, ws.ceilKey, pts);
}

function backWall(g: DungeonGrid, x0: number, x1: number, yTop: number, ws: WallSet): void {
  for (let x = x0; x <= x1; x += 1) {
    const c = x === x0 ? 0 : x === x1 ? 2 : 1;
    g.lower[idx(x, yTop)] = ws.band[c]!;
    g.lower[idx(x, yTop + 1)] = ws.bandBody[c]!;
  }
}

function plankV(g: DungeonGrid, x: number, y0: number, y1: number): void {
  g.upper[idx(x, y0)] = 171;
  for (let y = y0 + 1; y < y1; y += 1) g.upper[idx(x, y)] = 201;
  g.upper[idx(x, y1)] = 231;
}

function plankH(g: DungeonGrid, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) g.upper[idx(x, y)] = x === x0 ? 252 : x === x1 ? 254 : 253;
}

function setUpper(g: DungeonGrid, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  g.upper[idx(x, y)] = tile;
}

function stamp(g: DungeonGrid, x: number, y: number, matrix: readonly (readonly number[])[]): void {
  for (let dy = 0; dy < matrix.length; dy += 1) {
    for (let dx = 0; dx < matrix[dy]!.length; dx += 1) {
      setUpper(g, x + dx, y + dy, matrix[dy]![dx]!);
    }
  }
}

function torch(g: DungeonGrid, x: number, y: number): void {
  setUpper(g, x, y, 263);
  setUpper(g, x, y + 1, 293);
}

function wallTorch(g: DungeonGrid, x: number, y: number): void {
  setUpper(g, x, y, 264);
}

const WS_LAVA: WallSet = {
  ceilKey: "pit-gold",
  ceilBody: 310,
  band: [102, 103, 104],
  bandBody: [132, 133, 134],
};
const WS_STONE: WallSet = {
  ceilKey: "abyss-gray",
  ceilBody: 430,
  band: [21, 22, 23],
  bandBody: [51, 52, 53],
};
const WS_ICE: WallSet = {
  ceilKey: "abyss-blue",
  ceilBody: 427,
  band: [372, 373, 374],
  bandBody: [402, 403, 404],
};

/** Lava cave: entry foyer, lava chamber with bridge, throne annex. */
function buildLavaGrid(): DungeonGrid {
  const g = blank(301);
  ceiling(g, WS_LAVA);
  backWall(g, 2, W - 3, 2, WS_LAVA);

  g.lower[idx(13, 3)] = 75;
  wallTorch(g, 5, 2);
  wallTorch(g, 20, 2);

  // west chamber + lava pool (leave south walk ring)
  shape(g, "redrock", rect(g, 3, 5, 13, 15, 301));
  shape(g, "lava", rect(g, 5, 8, 11, 13, 304));
  shape(g, "redrock", rect(g, 5, 14, 11, 15, 301));
  plankH(g, 5, 11, 11);

  // east annex
  shape(g, "redrock", rect(g, 14, 5, 22, 15, 301));
  shape(g, "red-carpet", rect(g, 16, 6, 21, 10, 169));
  shape(g, "redrock", rect(g, 12, 9, 15, 12, 301));

  stamp(g, 18, 6, [
    [447, 448, 449],
    [477, 478, 479],
  ]);
  setUpper(g, 17, 6, 446);
  setUpper(g, 17, 7, 476);
  setUpper(g, 21, 6, 446);
  setUpper(g, 21, 7, 476);

  torch(g, 4, 5);
  torch(g, 12, 5);
  torch(g, 15, 13);
  setUpper(g, 15, 12, 208);
  setUpper(g, 6, 15, 299);
  setUpper(g, 18, 14, 299);
  setUpper(g, 4, 15, 260);
  setUpper(g, 22, 14, 259);
  setUpper(g, 22, 8, 265);
  setUpper(g, 3, 10, 268);
  setUpper(g, 22, 5, 269);
  setUpper(g, 8, 6, 267);
  stamp(g, 20, 13, [
    [318, 319],
    [348, 349],
  ]);

  return g;
}

/** Stone hall: left ritual room, right chasm with bridge, jail props. */
function buildStoneGrid(): DungeonGrid {
  const g = blank(187);
  ceiling(g, WS_STONE);
  backWall(g, 2, W - 3, 2, WS_STONE);

  shape(g, "stone", rect(g, 3, 5, 13, 15, 187));
  shape(g, "stone", rect(g, 14, 5, 22, 15, 187));
  shape(g, "stone", rect(g, 11, 8, 16, 12, 187));

  // chasm stops above south walk strip
  shape(g, "chasm", rect(g, 15, 6, 20, 12, 190));
  shape(g, "stone", rect(g, 15, 13, 22, 15, 187));
  plankV(g, 17, 6, 13);

  stamp(g, 5, 7, [
    [441, 442, 443],
    [471, 472, 473],
    [27, 28, 29],
  ]);
  setUpper(g, 4, 7, 145);
  setUpper(g, 4, 8, 175);
  setUpper(g, 8, 7, 146);
  setUpper(g, 8, 8, 176);

  setUpper(g, 3, 12, 329);
  setUpper(g, 3, 13, 359);
  setUpper(g, 4, 13, 385);
  setUpper(g, 5, 13, 386);
  setUpper(g, 6, 13, 387);
  setUpper(g, 7, 13, 356);

  setUpper(g, 9, 10, 294);
  setUpper(g, 9, 11, 324);
  setUpper(g, 9, 12, 354);

  stamp(g, 21, 10, [
    [204, 205, 206],
    [234, 235, 236],
  ]);
  wallTorch(g, 10, 2);
  wallTorch(g, 18, 2);
  torch(g, 12, 5);
  setUpper(g, 20, 8, 263);
  setUpper(g, 3, 6, 268);
  setUpper(g, 13, 14, 299);
  setUpper(g, 22, 6, 148);
  setUpper(g, 11, 14, 265);
  stamp(g, 14, 13, [
    [322, 323],
    [352, 353],
  ]);

  return g;
}

/** Ice cave: canonical user-authored diagonal ridge with an east ice basin. */
function buildIceGrid(): DungeonGrid {
  const g = blank(67);
  ceiling(g, WS_ICE);
  backWall(g, 2, W - 3, 2, WS_ICE);

  shape(g, "snow", rect(g, 3, 5, 22, 15, 67));
  shape(g, "ice", rect(g, 18, 8, 22, 11, 70));

  const ridge = stampCanonicalIceRidge(
    { width: W, height: H, lower: g.lower },
    { x: 4, y: 5 },
  );
  if (!ridge.ok) throw new Error(`canonical ice ridge rejected: ${ridge.issues.map((item) => item.code).join(", ")}`);
  g.lower.splice(0, g.lower.length, ...ridge.lower);

  stamp(g, 19, 5, [
    [320, 321],
    [350, 351],
  ]);
  stamp(g, 18, 12, [
    [282, 283, 284],
    [312, 313, 314],
    [342, 343, 344],
  ]);
  setUpper(g, 16, 13, 345);
  setUpper(g, 17, 6, 315);
  setUpper(g, 22, 13, 351);
  setUpper(g, 23, 8, 292);
  setUpper(g, 3, 6, 117);
  setUpper(g, 3, 7, 149);
  setUpper(g, 22, 6, 119);
  setUpper(g, 22, 7, 149);
  setUpper(g, 3, 14, 237);
  setUpper(g, 4, 14, 238);
  setUpper(g, 22, 14, 239);
  setUpper(g, 17, 14, 413);
  wallTorch(g, 8, 2);
  wallTorch(g, 18, 2);
  setUpper(g, 16, 14, 299);
  setUpper(g, 21, 6, 265);

  return g;
}

export function buildDungeonThemeMap(theme: DungeonTheme): BuiltDungeonThemeMap {
  if (theme === "lava") {
    return {
      theme,
      width: W,
      height: H,
      tilesetId: DUNGEON_TILESET_ID,
      grid: buildLavaGrid(),
      start: { x: 14, y: 7 },
      landmarks: [
        { id: "exit", x: 14, y: 7, role: "exit" },
        { id: "encounter_a", x: 8, y: 14, role: "encounter" },
        { id: "encounter_b", x: 19, y: 11, role: "boss" },
      ],
    };
  }
  if (theme === "stone") {
    return {
      theme,
      width: W,
      height: H,
      tilesetId: DUNGEON_TILESET_ID,
      grid: buildStoneGrid(),
      start: { x: 11, y: 9 },
      landmarks: [
        { id: "exit", x: 11, y: 9, role: "exit" },
        { id: "encounter_a", x: 6, y: 11, role: "boss" },
        { id: "encounter_b", x: 18, y: 14, role: "encounter" },
      ],
    };
  }
  return {
    theme: "ice",
    width: W,
    height: H,
    tilesetId: DUNGEON_TILESET_ID,
    grid: buildIceGrid(),
    start: { x: 13, y: 14 },
    landmarks: [
      { id: "exit", x: 13, y: 14, role: "exit" },
      { id: "encounter_a", x: 8, y: 14, role: "encounter" },
      { id: "encounter_b", x: 21, y: 14, role: "boss" },
    ],
  };
}

export function countUpperDecorations(grid: DungeonGrid): number {
  return grid.upper.reduce((n, t) => n + (t >= 0 ? 1 : 0), 0);
}

const HAZARD_LOWER = new Set<number>([
  243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335,
  129, 159, 189, 219, 130, 131, 160, 161, 190, 191, 220, 221,
  246, 247, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338, 249, 279, 309, 339,
  250, 251, 280, 281, 310, 311, 340, 341,
  366, 367, 368, 396, 397, 398, 426, 427, 428, 456, 457, 458,
  369, 399, 429, 459, 370, 371, 400, 401, 430, 431, 460, 461,
  9, 39, 69, 99, 10, 11, 40, 41, 70, 71, 100, 101,
  15, 45, 21, 22, 23, 51, 52, 53, 102, 103, 104, 132, 133, 134,
  372, 373, 374, 402, 403, 404,
  286, 287, 316, 317, 346, 347,
]);

const SOLID_UPPER = new Set<number>([
  145, 146, 147, 148, 149, 175, 176, 204, 205, 206, 207, 208, 209, 234, 235, 236,
  259, 260, 261, 262, 263, 264, 265, 266, 288, 289, 290, 291, 292, 293, 294, 295,
  296, 297, 298, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 348,
  349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 385, 386, 387, 388, 389,
  441, 442, 443, 444, 445, 446, 447, 448, 449, 471, 472, 473, 474, 475, 476, 477, 478, 479,
  117, 119, 345, 413,
]);

const WALK_UPPER = new Set<number>([
  171, 201, 231, 252, 253, 254, 141, 142, 143, 282, 283, 284, 312, 313, 314, 342, 343, 344, 237, 238, 239, 267, 268, 269, 299,
]);

export function isDungeonCellWalkable(grid: DungeonGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const lower = grid.lower[idx(x, y)] ?? -1;
  const upper = grid.upper[idx(x, y)] ?? -1;
  if (WALK_UPPER.has(upper)) return true;
  if (HAZARD_LOWER.has(lower)) return false;
  if (upper >= 0 && SOLID_UPPER.has(upper)) return false;
  if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) return false;
  if (y <= 3) return false;
  return true;
}

export function canReachDungeonLandmarks(built: BuiltDungeonThemeMap): boolean {
  const start = built.start;
  if (!isDungeonCellWalkable(built.grid, start.x, start.y)) return false;
  const goals = built.landmarks.map((l) => `${l.x},${l.y}`);
  const seen = new Set<string>();
  const q: { x: number; y: number }[] = [{ x: start.x, y: start.y }];
  seen.add(`${start.x},${start.y}`);
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const;
  while (q.length > 0) {
    const cur = q.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (!isDungeonCellWalkable(built.grid, nx, ny)) continue;
      seen.add(key);
      q.push({ x: nx, y: ny });
    }
  }
  return goals.every((g) => seen.has(g));
}

export function summarizeDungeonThemeMap(built: BuiltDungeonThemeMap): {
  theme: DungeonTheme;
  upperDecor: number;
  landmarksReachable: boolean;
  size: string;
} {
  return {
    theme: built.theme,
    upperDecor: countUpperDecorations(built.grid),
    landmarksReachable: canReachDungeonLandmarks(built),
    size: `${built.width}x${built.height}`,
  };
}
