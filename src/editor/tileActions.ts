import { store, type ProjectChangeCell } from "@/project/store";
import { TILE } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { expandHardClusterPlacement, type HardClusterTileEdit } from "@/editor/tools/clusterRulePlacement";
import { toast } from "@/util/toast";
import type { AutotileGroup, Command, GameMap, MapId, PassFlag, Project, TilesetDef } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";

type RoadPoint = { readonly x: number; readonly y: number };

export type TileLayer = "lower" | "upper";
export type TilePaintOptions = {
  readonly autoConnect?: boolean;
  /** false면 hard 클러스터 동반 타일 확장을 건너뛴다 — 스탬프처럼 "고른 그대로" 찍는 도구용. */
  readonly clusterExpand?: boolean;
};
type LowerTileEdit = {
  readonly layer: TileLayer;
  readonly points: readonly RoadPoint[];
  readonly previousTile: number | undefined;
  readonly nextTile: number;
} & Required<Pick<TilePaintOptions, "autoConnect">>;
type PlannedTileEdit = HardClusterTileEdit;
type TilePaintPlan =
  | { readonly edits: readonly PlannedTileEdit[]; readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function paintTile(mapId: MapId, layer: TileLayer, x: number, y: number, tile: number, options: TilePaintOptions = {}): void {
  const targetLayer = effectiveLayerForCurrentMap(mapId, layer, tile);
  const current = store.getCurrent();
  const currentMap = current.maps[mapId];
  const tileset = currentMap ? current.tilesets[currentMap.tilesetId] : undefined;
  const plan = !currentMap
    ? { ok: true as const, edits: [] }
    : options.clusterExpand === false
      ? { ok: true as const, edits: inMap(currentMap, x, y) ? [{ layer: targetLayer, tile, x, y }] : [] }
      : planManualClusterPaint(current, currentMap, tileset, targetLayer, x, y, tile);
  if (!plan.ok) {
    showClusterRejectionToast(plan.reason);
    return;
  }
  if (plan.edits.length === 0) return;
  store.updateMap(mapId, (m) => {
    const lowerEdits: LowerTileEdit[] = [];
    for (const edit of plan.edits) {
      const previousTile = tileAt(m, edit.layer, edit.x, edit.y);
      setTileSafe(m, edit.layer, edit.x, edit.y, edit.tile);
      if (edit.layer === "lower") {
        lowerEdits.push({
          autoConnect: options.autoConnect ?? true,
          layer: edit.layer,
          nextTile: edit.tile,
          points: [{ x: edit.x, y: edit.y }],
          previousTile,
        });
      }
    }
    for (const edit of lowerEdits) shapeTerrainAfterLowerEdit(m, tileset, edit);
  }, { cells: changedTileCellsForPlannedEdits(mapId, plan.edits, options.autoConnect ?? true) });
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

// 지우개 도구용: 선택 레이어가 비어 있으면 실제로 점유된(보이는) 레이어를 지운다.
// 팔레트의 자동 레이어 전환(장식 타일 클릭 → 상위) 직후 빈 상위 레이어만 지워져
// "지우개가 안 먹는" 무반응 버그의 수정 — 의도한 레이어에 내용이 있으면 그 레이어를 지운다.
export function eraseVisibleTile(mapId: MapId, preferredLayer: TileLayer, x: number, y: number, options: TilePaintOptions = {}): void {
  const map = store.getCurrent().maps[mapId];
  if (!map || !inMap(map, x, y)) return;
  const index = y * map.width + x;
  const occupied = (layer: TileLayer): boolean =>
    ((layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index]) ?? TILE.EMPTY) !== TILE.EMPTY;
  const fallback: TileLayer = preferredLayer === "upper" ? "lower" : "upper";
  const layer = occupied(preferredLayer) ? preferredLayer : occupied(fallback) ? fallback : preferredLayer;
  eraseTile(mapId, layer, x, y, options);
}

export function eraseTile(mapId: MapId, layer: TileLayer, x: number, y: number, options: TilePaintOptions = {}): void {
  const current = store.getCurrent();
  const currentMap = current.maps[mapId];
  const tileset = currentMap ? current.tilesets[currentMap.tilesetId] : undefined;
  store.updateMap(mapId, (m) => {
    const previousTile = tileAt(m, layer, x, y);
    setTileSafe(m, layer, x, y, TILE.EMPTY);
    shapeTerrainAfterLowerEdit(m, tileset, { layer, points: [{ x, y }], previousTile, nextTile: TILE.EMPTY, autoConnect: options.autoConnect ?? true });
  }, { cells: changedTileCellsForEdit(mapId, layer, [{ x, y }], options.autoConnect ?? true) });
}

export function fillTile(mapId: MapId, layer: TileLayer, x: number, y: number, newTile: number, options: TilePaintOptions = {}): void {
  const fillPlan = planFillTile(mapId, layer, x, y, newTile);
  const current = store.getCurrent();
  const currentMap = current.maps[mapId];
  const tileset = currentMap ? current.tilesets[currentMap.tilesetId] : undefined;
  store.updateMap(mapId, (m) => {
    if (!inMap(m, x, y)) return;
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

function changedTileCellsForPlannedEdits(mapId: MapId, edits: readonly PlannedTileEdit[], autoConnect: boolean): readonly ProjectChangeCell[] {
  const cells = new Map<string, ProjectChangeCell>();
  for (const edit of edits) {
    for (const cell of changedTileCellsForEdit(mapId, edit.layer, [{ x: edit.x, y: edit.y }], autoConnect)) {
      cells.set(`${cell.layer}:${cell.x},${cell.y}`, cell);
    }
  }
  return [...cells.values()];
}

function planManualClusterPaint(
  project: Project,
  map: GameMap,
  tileset: TilesetDef | undefined,
  layer: TileLayer,
  x: number,
  y: number,
  tile: number
): TilePaintPlan {
  if (!inMap(map, x, y)) return { ok: true, edits: [] };
  if (!tileset) return { ok: true, edits: [{ layer, tile, x, y }] };
  const expansion = expandHardClusterPlacement({
    map,
    origin: { x, y },
    originLayer: layer,
    tile,
    tileset,
  });
  if (!expansion.ok) return { ok: false, reason: expansion.reason ?? "동반 타일 배치 불가" };
  if (expansion.autoTiles === 0) return { ok: true, edits: expansion.edits };
  const protectedExpansion = expandHardClusterPlacement({
    blocked: protectedClusterCells(project, map),
    map,
    origin: { x, y },
    originLayer: layer,
    tile,
    tileset,
  });
  if (!protectedExpansion.ok) return { ok: false, reason: protectedExpansion.reason ?? "동반 타일 배치 불가" };
  return { ok: true, edits: protectedExpansion.edits };
}

function showClusterRejectionToast(reason: string): void {
  if (typeof document === "undefined") return;
  toast(`클러스터 규칙 때문에 배치할 수 없습니다: ${reason}`, "error");
}

// 보호 셀 집합은 이벤트/시작점에서만 유도되고 타일 값과 무관하다. 페인트 드래그는 셀마다
// 이 함수를 타므로, 전 맵 이벤트 순회를 매 셀 반복하지 않도록 캐시한다.
// 무효화: 타일 전용 변경(scope map + cells)이 아닌 모든 store 변경.
let protectedCellsCache: { readonly mapId: MapId; readonly cells: ReadonlySet<string> } | null = null;
let protectedCellsInvalidatorInstalled = false;

function installProtectedCellsInvalidator(): void {
  if (protectedCellsInvalidatorInstalled) return;
  protectedCellsInvalidatorInstalled = true;
  store.subscribe((_project, change) => {
    if (change.scope === "map" && change.cells?.length) return;
    protectedCellsCache = null;
  });
}

function protectedClusterCells(project: Project, map: GameMap): ReadonlySet<string> {
  installProtectedCellsInvalidator();
  if (protectedCellsCache?.mapId === map.id) return protectedCellsCache.cells;
  const blocked = new Set<string>();
  if (project.startMapId === map.id) blocked.add(coordKey(project.startPos.x, project.startPos.y));
  for (const event of map.events) {
    blocked.add(coordKey(event.x, event.y));
    collectTransferTargets(event.commands, map.id, blocked);
    for (const page of event.pages ?? []) collectTransferTargets(page.commands, map.id, blocked);
  }
  for (const sourceMap of Object.values(project.maps)) {
    if (sourceMap.id === map.id) continue;
    for (const event of sourceMap.events) {
      collectTransferTargets(event.commands, map.id, blocked);
      for (const page of event.pages ?? []) collectTransferTargets(page.commands, map.id, blocked);
    }
  }
  for (const commonEvent of project.commonEvents) collectTransferTargets(commonEvent.commands, map.id, blocked);
  protectedCellsCache = { cells: blocked, mapId: map.id };
  return blocked;
}

function collectTransferTargets(commands: readonly Command[], mapId: string, blocked: Set<string>): void {
  for (const command of commands) {
    switch (command.kind) {
      case "transfer":
        if (command.mapId === mapId) blocked.add(coordKey(command.x, command.y));
        break;
      case "choices":
        for (const option of command.options) collectTransferTargets(option.branch, mapId, blocked);
        collectTransferTargets(command.cancelBranch ?? [], mapId, blocked);
        break;
      case "fork":
        collectTransferTargets(command.then, mapId, blocked);
        collectTransferTargets(command.else ?? [], mapId, blocked);
        break;
      case "loop":
        collectTransferTargets(command.body, mapId, blocked);
        break;
      default:
        break;
    }
  }
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

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
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
