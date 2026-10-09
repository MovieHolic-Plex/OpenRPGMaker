import { TILE } from "@/project/defaults/constants";
import type { GameMap, TileGroupMetadata, TilesetDef } from "@/project/types";

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Point = { readonly x: number; readonly y: number };
type JunctionRule = NonNullable<TileGroupMetadata["junctions"]>[number];
type OverlayRule = NonNullable<TileGroupMetadata["overlays"]>[number];

export type StructureCellEdit = { readonly x: number; readonly y: number; readonly layer: "lower" | "upper"; readonly tile: number };

export function resolvePlacementStructure(input: {
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly group: TileGroupMetadata;
  readonly placed: readonly Rect[];
}): readonly StructureCellEdit[] {
  if (!input.group.junctions?.length && !input.group.overlays?.length) return [];

  const edits: StructureCellEdit[] = [];
  for (const rect of input.placed) {
    for (const overlay of input.group.overlays ?? []) {
      edits.push(...overlayEdits(input.map, rect, overlay));
    }
    for (const junction of input.group.junctions ?? []) {
      edits.push(...junctionEdits(input.map, input.tileset, rect, junction));
    }
  }
  return edits;
}

function overlayEdits(map: GameMap, rect: Rect, overlay: OverlayRule): readonly StructureCellEdit[] {
  if (rect.w < 1 || rect.h < 1) return [];

  const edits: StructureCellEdit[] = [];
  const points = overlayPoints(rect, overlay.when);
  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex];
    const tile = sequenceTile(overlay.tileIds, pointIndex);
    if (!point || tile === undefined || !isInside(map, point.x, point.y)) continue;
    edits.push({ layer: "upper", tile, x: point.x, y: point.y });
  }
  return edits;
}

function overlayPoints(rect: Rect, when: OverlayRule["when"]): readonly Point[] {
  switch (when) {
    case "ridge":
      return [{ x: rect.x + Math.floor(rect.w / 2), y: rect.y }];
    case "eaveEnd":
      return [
        { x: rect.x, y: rect.y + rect.h - 1 },
        { x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 },
      ];
    case "diagonalCorner":
      return [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w - 1, y: rect.y },
        { x: rect.x, y: rect.y + rect.h - 1 },
        { x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 },
      ];
    case "innerCorner":
      return [{ x: rect.x + Math.floor(rect.w / 2), y: rect.y + Math.floor(rect.h / 2) }];
    default:
      return assertNever(when);
  }
}

function junctionEdits(map: GameMap, tileset: TilesetDef, rect: Rect, junction: JunctionRule): readonly StructureCellEdit[] {
  if (rect.w < 1 || rect.h < 1) return [];

  const neighborTiles = roleTiles(tileset, junction.withRole);
  if (neighborTiles.size === 0) return [];

  const edits: StructureCellEdit[] = [];
  let matched = 0;
  for (const cell of edgeCells(rect, junction.side)) {
    if (!isInside(map, cell.x, cell.y) || !isInside(map, cell.neighbor.x, cell.neighbor.y)) continue;
    if (!hasAnyTileAt(map, cell.neighbor.x, cell.neighbor.y, neighborTiles)) continue;

    const layer = displayLayer(map, cell.x, cell.y);
    if (junction.action === "omit") {
      edits.push({ layer, tile: TILE.EMPTY, x: cell.x, y: cell.y });
      matched += 1;
      continue;
    }

    const tile = sequenceTile(junction.replaceWith ?? [], matched);
    if (tile !== undefined) edits.push({ layer, tile, x: cell.x, y: cell.y });
    matched += 1;
  }
  return edits;
}

function edgeCells(rect: Rect, side: JunctionRule["side"]): readonly (Point & { readonly neighbor: Point })[] {
  const cells: (Point & { readonly neighbor: Point })[] = [];
  switch (side) {
    case "below":
      for (let x = rect.x; x < rect.x + rect.w; x += 1) cells.push({ neighbor: { x, y: rect.y + rect.h }, x, y: rect.y + rect.h - 1 });
      return cells;
    case "above":
      for (let x = rect.x; x < rect.x + rect.w; x += 1) cells.push({ neighbor: { x, y: rect.y - 1 }, x, y: rect.y });
      return cells;
    case "leftOf":
      for (let y = rect.y; y < rect.y + rect.h; y += 1) cells.push({ neighbor: { x: rect.x - 1, y }, x: rect.x, y });
      return cells;
    case "rightOf":
      for (let y = rect.y; y < rect.y + rect.h; y += 1) cells.push({ neighbor: { x: rect.x + rect.w, y }, x: rect.x + rect.w - 1, y });
      return cells;
    default:
      return assertNever(side);
  }
}

function roleTiles(tileset: TilesetDef, role: TileGroupMetadata["role"]): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const group of tileset.tileGroups ?? []) {
    if (group.role !== role) continue;
    for (const tile of group.tileIds) ids.add(tile);
  }
  return ids;
}

function hasAnyTileAt(map: GameMap, x: number, y: number, tileIds: ReadonlySet<number>): boolean {
  const index = cellIndex(map, x, y);
  if (tileIds.has(map.lowerTiles[index] ?? TILE.EMPTY)) return true;
  if (tileIds.has(map.upperTiles[index] ?? TILE.EMPTY)) return true;
  for (const tile of map.lowerTileStacks?.[index] ?? []) if (tileIds.has(tile)) return true;
  for (const tile of map.upperTileStacks?.[index] ?? []) if (tileIds.has(tile)) return true;
  return false;
}

function displayLayer(map: GameMap, x: number, y: number): StructureCellEdit["layer"] {
  return (map.upperTiles[cellIndex(map, x, y)] ?? TILE.EMPTY) !== TILE.EMPTY ? "upper" : "lower";
}

function sequenceTile(tileIds: readonly number[], index: number): number | undefined {
  const first = tileIds[0];
  if (first === undefined) return undefined;
  return tileIds[index] ?? first;
}

function cellIndex(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 구조 규칙입니다: ${String(value)}`);
}
