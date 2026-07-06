import { TILE } from "@/project/defaults/constants";
import { isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import type { ClusterRule, GameMap, TileGroupMetadata, TilesetDef } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";

type ClusterRelation = "aAboveB" | "aBelowB" | "aLeftOfB" | "aRightOfB";
type Layer = "lower" | "upper";

interface HardAdjacencyContext {
  readonly a: number;
  readonly b: number;
  readonly group: TileGroupMetadata;
  readonly relation: ClusterRelation;
  readonly rule: ClusterRule;
}

interface PlannedTile {
  readonly layer: Layer;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
}

export interface HardClusterTileEdit extends PlannedTile {}

export interface HardClusterPlacementResult {
  readonly autoTiles: number;
  readonly edits: readonly HardClusterTileEdit[];
  readonly ok: boolean;
  readonly reason?: string;
}

export function expandHardClusterPlacement(input: {
  readonly blocked?: ReadonlySet<string>;
  readonly map: GameMap;
  readonly origin: Point;
  readonly originLayer: Layer;
  readonly tile: number;
  readonly tileset: TilesetDef;
}): HardClusterPlacementResult {
  const { blocked, map, origin, originLayer, tile, tileset } = input;
  const planned = new Map<string, PlannedTile>();
  const add = (entry: PlannedTile): string | null => {
    const existing = planned.get(coordKey(entry.x, entry.y));
    if (existing && (existing.tile !== entry.tile || existing.layer !== entry.layer)) {
      return `hard 규칙 동반 타일 충돌: (${entry.x},${entry.y}) ${existing.tile} vs ${entry.tile}`;
    }
    planned.set(coordKey(entry.x, entry.y), entry);
    return null;
  };

  const firstError = add({ layer: originLayer, tile, x: origin.x, y: origin.y });
  if (firstError) return { autoTiles: 0, edits: [], ok: false, reason: firstError };
  if (tile === TILE.EMPTY) return validatePlanned(map, planned, blocked, 0);

  let changed = true;
  while (changed) {
    changed = false;
    const snapshot = [...planned.values()];
    for (const entry of snapshot) {
      for (const context of hardAdjacencyContexts(tileset, entry.tile)) {
        const companion = companionFor(entry, context);
        if (!companion) continue;
        const next: PlannedTile = {
          layer: layerForClusterTile(tileset, context.group, companion.tile),
          tile: companion.tile,
          x: companion.x,
          y: companion.y,
        };
        if (planned.has(coordKey(next.x, next.y))) continue;
        const error = add(next);
        if (error) return { autoTiles: Math.max(0, planned.size - 1), edits: [], ok: false, reason: error };
        changed = true;
      }
    }
  }

  return validatePlanned(map, planned, blocked, Math.max(0, planned.size - 1));
}

export function hardClusterRuleCount(group: TileGroupMetadata): number {
  return (group.rules ?? []).filter((rule) => rule.kind === "adjacency" && rule.strength === "hard").length;
}

export function nonEmptyFootprintTileCount(input: { readonly lower: readonly number[]; readonly upper: readonly number[] }): number {
  let count = 0;
  const size = Math.max(input.lower.length, input.upper.length);
  for (let index = 0; index < size; index += 1) {
    if ((input.lower[index] ?? TILE.EMPTY) !== TILE.EMPTY || (input.upper[index] ?? TILE.EMPTY) !== TILE.EMPTY) count += 1;
  }
  return count;
}

function validatePlanned(
  map: GameMap,
  planned: ReadonlyMap<string, PlannedTile>,
  blocked: ReadonlySet<string> | undefined,
  autoTiles: number
): HardClusterPlacementResult {
  for (const entry of planned.values()) {
    if (!inMapBounds(map, entry.x, entry.y)) {
      return { autoTiles, edits: [], ok: false, reason: `hard 규칙 동반 타일이 맵 경계를 벗어남: (${entry.x},${entry.y})` };
    }
    if (blocked?.has(coordKey(entry.x, entry.y))) {
      return { autoTiles, edits: [], ok: false, reason: `hard 규칙 동반 타일이 보호셀과 겹침: (${entry.x},${entry.y})` };
    }
  }
  return { autoTiles, edits: [...planned.values()], ok: true };
}

function hardAdjacencyContexts(tileset: TilesetDef, tile: number): readonly HardAdjacencyContext[] {
  const contexts: HardAdjacencyContext[] = [];
  for (const group of tileset.tileGroups ?? []) {
    for (const rule of group.rules ?? []) {
      if (rule.kind !== "adjacency" || rule.strength !== "hard") continue;
      const params = adjacencyParams(rule.params);
      if (!params || (params.a !== tile && params.b !== tile)) continue;
      contexts.push({ ...params, group, rule });
    }
  }
  return contexts;
}

function adjacencyParams(params: Record<string, unknown>): { readonly a: number; readonly b: number; readonly relation: ClusterRelation } | null {
  const a = integerParam(params.a);
  const b = integerParam(params.b);
  const relation = relationParam(params.relation);
  return a === null || b === null || !relation ? null : { a, b, relation };
}

function companionFor(entry: PlannedTile, context: HardAdjacencyContext): { readonly tile: number; readonly x: number; readonly y: number } | null {
  if (entry.tile === context.a) {
    const point = neighbor(entry, context.relation);
    return { ...point, tile: context.b };
  }
  if (entry.tile === context.b) {
    const point = neighbor(entry, oppositeRelation(context.relation));
    return { ...point, tile: context.a };
  }
  return null;
}

function neighbor(point: Point, relation: ClusterRelation): Point {
  switch (relation) {
    case "aAboveB":
      return { x: point.x, y: point.y + 1 };
    case "aBelowB":
      return { x: point.x, y: point.y - 1 };
    case "aLeftOfB":
      return { x: point.x + 1, y: point.y };
    case "aRightOfB":
      return { x: point.x - 1, y: point.y };
  }
}

function oppositeRelation(relation: ClusterRelation): ClusterRelation {
  switch (relation) {
    case "aAboveB":
      return "aBelowB";
    case "aBelowB":
      return "aAboveB";
    case "aLeftOfB":
      return "aRightOfB";
    case "aRightOfB":
      return "aLeftOfB";
  }
}

function layerForClusterTile(tileset: TilesetDef, group: TileGroupMetadata, tile: number): Layer {
  if (group.defaultLayer === "upper" || group.role === "prop" || isUpperOnlyOverlayTile(tileset, tile)) return "upper";
  return tileset.priority[tile] === "upper" ? "upper" : "lower";
}

function integerParam(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function relationParam(value: unknown): ClusterRelation | null {
  switch (value) {
    case "aAboveB":
    case "aBelowB":
    case "aLeftOfB":
    case "aRightOfB":
      return value;
    default:
      return null;
  }
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}
