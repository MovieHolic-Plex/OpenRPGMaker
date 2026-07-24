export const ICE_DIAGONAL_TILES = {
  left: { cap: 286, body: 316, base: 346 },
  right: { cap: 287, body: 317, base: 347 },
} as const;

export const ICE_DIAGONAL_CANONICAL_SOURCE = {
  projectId: "rpg-zzu-dungeon-theme-gallery",
  mapId: "map_g_ice_grand",
  name: "얼음 동굴 · 대형 (55×55)",
} as const;

export const ICE_SNOW_SUPPORT_TILES = [
  6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98,
] as const;

export const ICE_DIAGONAL_ISSUE_CODES = [
  "grid-size-mismatch",
  "left-cap-needs-left-body",
  "right-cap-needs-right-body",
  "left-cap-north-east-right-cap",
  "right-cap-north-west-left-cap",
  "left-body-needs-left-column-above",
  "left-body-needs-left-column-below",
  "right-body-needs-right-column-above",
  "right-body-needs-right-column-below",
  "left-base-needs-left-body",
  "right-base-needs-right-body",
  "left-base-needs-snow-support",
  "right-base-needs-snow-support",
  "right-base-vertical-stack",
  "right-base-south-west-right-body",
  "left-base-south-east-left-body",
  "column-invalid-height",
  "column-out-of-bounds",
  "column-overlap",
] as const;

export type IceDiagonalFace = keyof typeof ICE_DIAGONAL_TILES;
export type IceDiagonalLayer = keyof (typeof ICE_DIAGONAL_TILES)[IceDiagonalFace];
export type IceTerrainIssueCode = (typeof ICE_DIAGONAL_ISSUE_CODES)[number];

export type IceDiagonalRole = {
  readonly face: IceDiagonalFace;
  readonly layer: IceDiagonalLayer;
};

export type IceTerrainGrid = {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
};

export type IceDiagonalColumn = {
  readonly x: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly face: IceDiagonalFace;
};

export type IceTerrainIssue = {
  readonly code: IceTerrainIssueCode;
  readonly x: number;
  readonly y: number;
  readonly actual?: number;
};

export type IceStampResult =
  | {
    readonly ok: true;
    readonly lower: readonly number[];
    readonly changedCells: readonly { readonly x: number; readonly y: number }[];
  }
  | {
    readonly ok: false;
    readonly issues: readonly IceTerrainIssue[];
  };

const SNOW_SUPPORT = new Set<number>(ICE_SNOW_SUPPORT_TILES);
const REPLACEABLE_TILES = new Set<number>([-1, ...ICE_SNOW_SUPPORT_TILES]);
const LEFT_BODY_ABOVE = new Set<number>([ICE_DIAGONAL_TILES.left.cap, ICE_DIAGONAL_TILES.left.body, 343]);
const LEFT_BODY_BELOW = new Set<number>([
  ICE_DIAGONAL_TILES.left.body,
  ICE_DIAGONAL_TILES.left.base,
  ICE_DIAGONAL_TILES.right.cap,
]);
const RIGHT_BODY_ABOVE = new Set<number>([ICE_DIAGONAL_TILES.right.cap, ICE_DIAGONAL_TILES.right.body, 343]);
const RIGHT_BODY_BELOW = new Set<number>([
  ICE_DIAGONAL_TILES.right.body,
  ICE_DIAGONAL_TILES.right.base,
  ICE_DIAGONAL_TILES.left.cap,
]);

const CANONICAL_RIDGE_OFFSETS = [
  { x: 0, topY: 5, bottomY: 8, face: "right" },
  { x: 1, topY: 4, bottomY: 7, face: "right" },
  { x: 2, topY: 3, bottomY: 6, face: "right" },
  { x: 3, topY: 3, bottomY: 6, face: "left" },
  { x: 4, topY: 3, bottomY: 6, face: "right" },
  { x: 5, topY: 2, bottomY: 5, face: "right" },
  { x: 6, topY: 1, bottomY: 4, face: "right" },
  { x: 7, topY: 1, bottomY: 4, face: "left" },
  { x: 8, topY: 2, bottomY: 5, face: "left" },
  { x: 9, topY: 2, bottomY: 5, face: "right" },
  { x: 10, topY: 1, bottomY: 4, face: "right" },
  { x: 11, topY: 0, bottomY: 3, face: "right" },
] as const satisfies readonly IceDiagonalColumn[];

function issue(code: IceTerrainIssueCode, x: number, y: number, actual?: number): IceTerrainIssue {
  return actual === undefined ? { code, x, y } : { code, x, y, actual };
}

function tileAt(grid: IceTerrainGrid, x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return undefined;
  return grid.lower[y * grid.width + x];
}

function requireNeighbor(
  issues: IceTerrainIssue[],
  grid: IceTerrainGrid,
  sourceX: number,
  sourceY: number,
  neighborX: number,
  neighborY: number,
  allowed: ReadonlySet<number>,
  code: IceTerrainIssueCode,
): void {
  const actual = tileAt(grid, neighborX, neighborY);
  if (actual === undefined || !allowed.has(actual)) issues.push(issue(code, sourceX, sourceY, actual));
}

export function iceDiagonalRole(tile: number): IceDiagonalRole | null {
  switch (tile) {
    case ICE_DIAGONAL_TILES.left.cap: return { face: "left", layer: "cap" };
    case ICE_DIAGONAL_TILES.left.body: return { face: "left", layer: "body" };
    case ICE_DIAGONAL_TILES.left.base: return { face: "left", layer: "base" };
    case ICE_DIAGONAL_TILES.right.cap: return { face: "right", layer: "cap" };
    case ICE_DIAGONAL_TILES.right.body: return { face: "right", layer: "body" };
    case ICE_DIAGONAL_TILES.right.base: return { face: "right", layer: "base" };
    default: return null;
  }
}

export function mirrorIceDiagonalTile(tile: number): number {
  switch (tile) {
    case 6: return 8;
    case 8: return 6;
    case 36: return 38;
    case 38: return 36;
    case 66: return 68;
    case 68: return 66;
    case 96: return 98;
    case 98: return 96;
    case 408: return 409;
    case 409: return 408;
    case ICE_DIAGONAL_TILES.left.cap: return ICE_DIAGONAL_TILES.right.cap;
    case ICE_DIAGONAL_TILES.left.body: return ICE_DIAGONAL_TILES.right.body;
    case ICE_DIAGONAL_TILES.left.base: return ICE_DIAGONAL_TILES.right.base;
    case ICE_DIAGONAL_TILES.right.cap: return ICE_DIAGONAL_TILES.left.cap;
    case ICE_DIAGONAL_TILES.right.body: return ICE_DIAGONAL_TILES.left.body;
    case ICE_DIAGONAL_TILES.right.base: return ICE_DIAGONAL_TILES.left.base;
    default: return tile;
  }
}

export function validateIceDiagonalTerrain(grid: IceTerrainGrid): readonly IceTerrainIssue[] {
  if (grid.width <= 0 || grid.height <= 0 || grid.lower.length !== grid.width * grid.height) {
    return [issue("grid-size-mismatch", -1, -1, grid.lower.length)];
  }
  const issues: IceTerrainIssue[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const tile = tileAt(grid, x, y);
      if (tile === ICE_DIAGONAL_TILES.left.cap) {
        requireNeighbor(issues, grid, x, y, x, y + 1, new Set([ICE_DIAGONAL_TILES.left.body]), "left-cap-needs-left-body");
        if (tileAt(grid, x + 1, y - 1) === ICE_DIAGONAL_TILES.right.cap) issues.push(issue("left-cap-north-east-right-cap", x, y));
      } else if (tile === ICE_DIAGONAL_TILES.right.cap) {
        requireNeighbor(issues, grid, x, y, x, y + 1, new Set([ICE_DIAGONAL_TILES.right.body]), "right-cap-needs-right-body");
        if (tileAt(grid, x - 1, y - 1) === ICE_DIAGONAL_TILES.left.cap) issues.push(issue("right-cap-north-west-left-cap", x, y));
      } else if (tile === ICE_DIAGONAL_TILES.left.body) {
        requireNeighbor(issues, grid, x, y, x, y - 1, LEFT_BODY_ABOVE, "left-body-needs-left-column-above");
        requireNeighbor(issues, grid, x, y, x, y + 1, LEFT_BODY_BELOW, "left-body-needs-left-column-below");
      } else if (tile === ICE_DIAGONAL_TILES.right.body) {
        requireNeighbor(issues, grid, x, y, x, y - 1, RIGHT_BODY_ABOVE, "right-body-needs-right-column-above");
        requireNeighbor(issues, grid, x, y, x, y + 1, RIGHT_BODY_BELOW, "right-body-needs-right-column-below");
      } else if (tile === ICE_DIAGONAL_TILES.left.base) {
        requireNeighbor(issues, grid, x, y, x, y - 1, new Set([ICE_DIAGONAL_TILES.left.body]), "left-base-needs-left-body");
        const below = tileAt(grid, x, y + 1);
        if (below !== undefined && !SNOW_SUPPORT.has(below)) issues.push(issue("left-base-needs-snow-support", x, y, below));
        if (tileAt(grid, x + 1, y + 1) === ICE_DIAGONAL_TILES.left.body) issues.push(issue("left-base-south-east-left-body", x, y));
      } else if (tile === ICE_DIAGONAL_TILES.right.base) {
        requireNeighbor(issues, grid, x, y, x, y - 1, new Set([ICE_DIAGONAL_TILES.right.body]), "right-base-needs-right-body");
        const below = tileAt(grid, x, y + 1);
        if (below === ICE_DIAGONAL_TILES.right.base) issues.push(issue("right-base-vertical-stack", x, y, below));
        else if (below !== undefined && !SNOW_SUPPORT.has(below)) issues.push(issue("right-base-needs-snow-support", x, y, below));
        if (tileAt(grid, x - 1, y + 1) === ICE_DIAGONAL_TILES.right.body) issues.push(issue("right-base-south-west-right-body", x, y));
      }
    }
  }
  return issues;
}

export function stampIceDiagonalColumns(
  grid: IceTerrainGrid,
  columns: readonly IceDiagonalColumn[],
): IceStampResult {
  const issues = [...validateGridForStamp(grid)];
  const planned = new Map<number, number>();
  for (const column of columns) {
    if (!Number.isInteger(column.x) || !Number.isInteger(column.topY) || !Number.isInteger(column.bottomY) || column.bottomY - column.topY < 2) {
      issues.push(issue("column-invalid-height", column.x, column.topY, column.bottomY));
      continue;
    }
    if (column.x < 0 || column.x >= grid.width || column.topY < 0 || column.bottomY >= grid.height) {
      issues.push(issue("column-out-of-bounds", column.x, column.topY, column.bottomY));
      continue;
    }
    const tiles = ICE_DIAGONAL_TILES[column.face];
    for (let y = column.topY; y <= column.bottomY; y += 1) {
      const tile = y === column.topY ? tiles.cap : y === column.bottomY ? tiles.base : tiles.body;
      const index = y * grid.width + column.x;
      const alreadyPlanned = planned.get(index);
      const current = grid.lower[index];
      if ((alreadyPlanned !== undefined && alreadyPlanned !== tile) || (alreadyPlanned === undefined && current !== tile && !REPLACEABLE_TILES.has(current ?? -1))) {
        issues.push(issue("column-overlap", column.x, y, current));
      } else {
        planned.set(index, tile);
      }
    }
  }
  if (issues.length > 0) return { ok: false, issues };

  const lower = [...grid.lower];
  const changedCells: { readonly x: number; readonly y: number }[] = [];
  for (const [index, tile] of planned) {
    if (grid.lower[index] !== tile) {
      changedCells.push({ x: index % grid.width, y: Math.floor(index / grid.width) });
    }
    lower[index] = tile;
  }
  const terrainIssues = validateIceDiagonalTerrain({ width: grid.width, height: grid.height, lower });
  return terrainIssues.length === 0 ? { ok: true, lower, changedCells } : { ok: false, issues: terrainIssues };
}

function validateGridForStamp(grid: IceTerrainGrid): readonly IceTerrainIssue[] {
  return grid.width > 0 && grid.height > 0 && grid.lower.length === grid.width * grid.height
    ? []
    : [issue("grid-size-mismatch", -1, -1, grid.lower.length)];
}

export function canonicalIceRidgeColumns(originX: number, originY: number): readonly IceDiagonalColumn[] {
  return CANONICAL_RIDGE_OFFSETS.map((column) => ({
    x: originX + column.x,
    topY: originY + column.topY,
    bottomY: originY + column.bottomY,
    face: column.face,
  }));
}

export function stampCanonicalIceRidge(
  grid: IceTerrainGrid,
  origin: { readonly x: number; readonly y: number },
): IceStampResult {
  return stampIceDiagonalColumns(grid, canonicalIceRidgeColumns(origin.x, origin.y));
}
