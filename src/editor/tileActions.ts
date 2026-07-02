import { store } from "@/project/store";
import { TILE } from "@/project/defaults";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isRoadTile, shapeRoadAround, type RoadPoint } from "@/project/defaults/roadAutotile";
import { isSandTile, shapeSandAround } from "@/project/defaults/sandAutotile";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { harnessLayerForTile } from "@/project/tilesetHarness";
import type { GameMap, MapId, PassFlag } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";

export type TileLayer = "lower" | "upper";
export type TilePaintOptions = {
  readonly autoConnect?: boolean;
};
type LowerTileEdit = {
  readonly layer: TileLayer;
  readonly points: readonly RoadPoint[];
  readonly previousTile: number | undefined;
  readonly nextTile: number;
} & Required<TilePaintOptions>;

export function paintTile(mapId: MapId, layer: TileLayer, x: number, y: number, tile: number, options: TilePaintOptions = {}): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const tileset = p.tilesets[m.tilesetId];
    const targetLayer = effectiveLayer(tileset, layer, tile);
    const previousTile = tileAt(m, targetLayer, x, y);
    setTileSafe(m, targetLayer, x, y, tile);
    shapeTerrainAfterLowerEdit(m, { layer: targetLayer, points: [{ x, y }], previousTile, nextTile: tile, autoConnect: options.autoConnect ?? true });
  });
}

export function toggleCollision(mapId: MapId, x: number, y: number): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    if (!inMap(m, x, y)) return;
    const ts = p.tilesets[m.tilesetId];
    if (!ts) return;
    const i = y * m.width + x;
    const upperTile = m.upperTiles[i];
    const lowerTile = m.lowerTiles[i];
    const tileIdx = upperTile >= 0 ? upperTile : lowerTile;
    if (tileIdx < 0 || tileIdx >= ts.passability.length) return;
    const cur = ts.passability[tileIdx];
    const allOpen = cur.up && cur.down && cur.left && cur.right;
    const next: PassFlag = allOpen
      ? { up: false, down: false, left: false, right: false }
      : { up: true, down: true, left: true, right: true };
    ts.passability[tileIdx] = next;
    markUserTileRuntimeMetadata(ts, tileIdx, { passage: allOpen ? "solid" : "passable" });
  });
}

export function eraseTile(mapId: MapId, layer: TileLayer, x: number, y: number, options: TilePaintOptions = {}): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const previousTile = tileAt(m, layer, x, y);
    setTileSafe(m, layer, x, y, TILE.EMPTY);
    shapeTerrainAfterLowerEdit(m, { layer, points: [{ x, y }], previousTile, nextTile: TILE.EMPTY, autoConnect: options.autoConnect ?? true });
  });
}

export function fillTile(mapId: MapId, layer: TileLayer, x: number, y: number, newTile: number, options: TilePaintOptions = {}): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m || !inMap(m, x, y)) return;
    const tileset = p.tilesets[m.tilesetId];
    const targetLayer = effectiveLayer(tileset, layer, newTile);
    const targetArr = targetLayer === "lower" ? m.lowerTiles : m.upperTiles;
    const startIdx = y * m.width + x;
    const target = targetArr[startIdx];
    const queue = [startIdx];
    const seen = new Set<number>([startIdx]);
    const changedPoints: RoadPoint[] = [];
    while (queue.length) {
      const idx = queue.shift();
      if (idx === undefined) break;
      const cx = idx % m.width;
      const cy = Math.floor(idx / m.width);
      setTileSafe(m, targetLayer, cx, cy, newTile);
      changedPoints.push({ x: cx, y: cy });
      const neighbors = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ] as const;
      for (const [nx, ny] of neighbors) {
        if (!inMap(m, nx, ny)) continue;
        const ni = ny * m.width + nx;
        if (seen.has(ni)) continue;
        if (targetArr[ni] !== target) continue;
        seen.add(ni);
        queue.push(ni);
      }
    }
    shapeTerrainAfterLowerEdit(m, { layer: targetLayer, points: changedPoints, previousTile: target, nextTile: newTile, autoConnect: options.autoConnect ?? true });
  });
}

function effectiveLayer(tileset: Parameters<typeof harnessLayerForTile>[0] | undefined, requestedLayer: TileLayer, tile: number): TileLayer {
  if (!tileset) return requestedLayer;
  return harnessLayerForTile(tileset, tile) ?? requestedLayer;
}

function inMap(m: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < m.width && y < m.height;
}

function setTileSafe(m: GameMap, layer: TileLayer, x: number, y: number, tile: number): void {
  if (!inMap(m, x, y)) return;
  const i = y * m.width + x;
  clearTileStack(m, layer, i);
  if (layer === "lower") {
    m.lowerTiles[i] = tile;
  } else {
    m.upperTiles[i] = tile;
  }
}

function tileAt(m: GameMap, layer: TileLayer, x: number, y: number): number | undefined {
  if (!inMap(m, x, y)) return undefined;
  const i = y * m.width + x;
  return layer === "lower" ? m.lowerTiles[i] : m.upperTiles[i];
}

function shapeTerrainAfterLowerEdit(m: GameMap, edit: LowerTileEdit): void {
  if (!edit.autoConnect) return;
  if (edit.layer !== "lower") return;
  if (isRoadEdit(edit)) shapeRoadAround(m, edit.points);
  if (isSandOrWaterEdit(edit)) shapeSandAround(m, edit.points);
}

function isRoadEdit(edit: LowerTileEdit): boolean {
  return isRoadTile(edit.nextTile) || (edit.previousTile !== undefined && isRoadTile(edit.previousTile));
}

function isSandOrWaterEdit(edit: LowerTileEdit): boolean {
  return isSandOrWaterTile(edit.nextTile) || (edit.previousTile !== undefined && isSandOrWaterTile(edit.previousTile));
}

function isSandOrWaterTile(tile: number): boolean {
  return isSandTile(tile) || isLakeAutotileTile(tile);
}
