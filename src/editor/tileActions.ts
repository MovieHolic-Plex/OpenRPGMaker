import { store, type ProjectChangeCell } from "@/project/store";
import { TILE } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import type { AutotileGroup, GameMap, MapId, PassFlag, TilesetDef } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";

type RoadPoint = { readonly x: number; readonly y: number };

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
  const targetLayer = effectiveLayerForCurrentMap(mapId, layer, tile);
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const tileset = p.tilesets[m.tilesetId];
    const previousTile = tileAt(m, targetLayer, x, y);
    setTileSafe(m, targetLayer, x, y, tile);
    shapeTerrainAfterLowerEdit(m, tileset, { layer: targetLayer, points: [{ x, y }], previousTile, nextTile: tile, autoConnect: options.autoConnect ?? true });
  }, { scope: "map", mapId, cells: changedTileCellsForEdit(mapId, targetLayer, [{ x, y }], options.autoConnect ?? true) });
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
    const tileset = p.tilesets[m.tilesetId];
    const previousTile = tileAt(m, layer, x, y);
    setTileSafe(m, layer, x, y, TILE.EMPTY);
    shapeTerrainAfterLowerEdit(m, tileset, { layer, points: [{ x, y }], previousTile, nextTile: TILE.EMPTY, autoConnect: options.autoConnect ?? true });
  }, { scope: "map", mapId, cells: changedTileCellsForEdit(mapId, layer, [{ x, y }], options.autoConnect ?? true) });
}

export function fillTile(mapId: MapId, layer: TileLayer, x: number, y: number, newTile: number, options: TilePaintOptions = {}): void {
  const fillPlan = planFillTile(mapId, layer, x, y, newTile);
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
    shapeTerrainAfterLowerEdit(m, tileset, { layer: targetLayer, points: changedPoints, previousTile: target, nextTile: newTile, autoConnect: options.autoConnect ?? true });
  }, {
    scope: "map",
    mapId,
    cells: changedTileCellsForEdit(mapId, fillPlan.layer, fillPlan.points, options.autoConnect ?? true),
  });
}

function effectiveLayerForCurrentMap(mapId: MapId, requestedLayer: TileLayer, tile: number): TileLayer {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  return effectiveLayer(map ? project.tilesets[map.tilesetId] : undefined, requestedLayer, tile);
}

function planFillTile(mapId: MapId, layer: TileLayer, x: number, y: number, newTile: number): { readonly layer: TileLayer; readonly points: readonly RoadPoint[] } {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map || !inMap(map, x, y)) return { layer, points: [] };
  const targetLayer = effectiveLayer(project.tilesets[map.tilesetId], layer, newTile);
  const targetArr = targetLayer === "lower" ? map.lowerTiles : map.upperTiles;
  const startIdx = y * map.width + x;
  const target = targetArr[startIdx];
  const queue = [startIdx];
  const seen = new Set<number>([startIdx]);
  const points: RoadPoint[] = [];
  while (queue.length) {
    const idx = queue.shift();
    if (idx === undefined) break;
    const cx = idx % map.width;
    const cy = Math.floor(idx / map.width);
    points.push({ x: cx, y: cy });
    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ] as const;
    for (const [nx, ny] of neighbors) {
      if (!inMap(map, nx, ny)) continue;
      const ni = ny * map.width + nx;
      if (seen.has(ni)) continue;
      if (targetArr[ni] !== target) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return { layer: targetLayer, points };
}

function changedTileCellsForEdit(mapId: MapId, layer: TileLayer, points: readonly RoadPoint[], autoConnect: boolean): readonly ProjectChangeCell[] {
  const map = store.getCurrent().maps[mapId];
  const cells = new Map<string, ProjectChangeCell>();
  const add = (x: number, y: number): void => {
    if (map && !inMap(map, x, y)) return;
    cells.set(`${layer}:${x},${y}`, { x, y, layer });
  };
  for (const point of points) {
    add(point.x, point.y);
    if (layer !== "lower" || !autoConnect) continue;
    add(point.x, point.y - 1);
    add(point.x, point.y + 1);
    add(point.x - 1, point.y);
    add(point.x + 1, point.y);
  }
  return [...cells.values()];
}

function effectiveLayer(tileset: TilesetDef | undefined, requestedLayer: TileLayer, tile: number): TileLayer {
  if (!tileset) return requestedLayer;
  // RM2K3식 엄격 분류: 타일의 홈 레이어(하네스 그룹 → priority)가 단일 판정되면
  // 요청 레이어와 무관하게 그 레이어에 놓는다. mixed 그룹/미분류 타일셋만 요청을 따른다.
  // stackable 소품(울타리 등)은 tileLayerHome이 상위로 판정해 아래 지면을 보존한다
  // (upper가 solid면 collision 합성에서 그대로 통행을 막으므로 차단도 유지된다).
  const home = tileLayerHome(tileset, tile);
  return home === "both" ? requestedLayer : home;
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

// lower 레이어 편집 후 오토타일 그룹(타일셋 정의 또는 내장 기본값)을 재계산한다.
function shapeTerrainAfterLowerEdit(m: GameMap, tileset: TilesetDef | undefined, edit: LowerTileEdit): void {
  if (!edit.autoConnect) return;
  if (edit.layer !== "lower") return;
  const groups: readonly AutotileGroup[] = autotileGroupsForTileset(tileset);
  for (const group of groups) {
    if (autotileEditTriggersGroup(group, edit.previousTile, edit.nextTile)) {
      shapeAutotileGroupAround(m, group, edit.points);
    }
  }
}
