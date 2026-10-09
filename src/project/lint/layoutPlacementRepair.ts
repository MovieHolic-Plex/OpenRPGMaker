// 배치 검증 실패를 사람에게 돌리지 않는다. 충돌 칸을 육지로 옮기거나 정리한 뒤 다시 검사한다.
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import type { LintIssue } from "./projectLint";
import {
  isLowerTerrainPassable,
  LAYOUT_TREE_CANOPY_IDS,
  LAYOUT_TREE_TILE_IDS,
  LAYOUT_TREE_TRUNK_IDS,
  scrubPlacementConflicts,
  validateLayoutPlacement,
  type LayoutRegion,
  type LayoutValidateOptions,
} from "./layoutPlacementValidate";

export type LayoutRepairCounts = {
  relocated: number;
  removed: number;
  trunksAdded: number;
  treesPlanted: number;
};

export type LayoutRepairResult = {
  readonly project: Project;
  readonly counts: LayoutRepairCounts;
  readonly remaining: readonly LintIssue[];
};

export function layoutRepairDidWork(counts: LayoutRepairCounts): boolean {
  return counts.relocated + counts.removed + counts.trunksAdded + counts.treesPlanted > 0;
}

export function formatLayoutRepairSummary(counts: LayoutRepairCounts): string {
  const parts: string[] = [];
  if (counts.relocated > 0) parts.push(`충돌 ${counts.relocated}칸을 육지로 옮김`);
  if (counts.removed > 0) parts.push(`${counts.removed}칸 정리`);
  if (counts.trunksAdded > 0) parts.push(`밑동 ${counts.trunksAdded}그루 보완`);
  if (counts.treesPlanted > 0) parts.push(`나무 ${counts.treesPlanted}그루 보식`);
  return parts.length === 0 ? "" : `배치 충돌을 자동 정리했습니다: ${parts.join(" · ")}`;
}

export function repairLayoutPlacement(project: Project, opts: LayoutValidateOptions = {}): LayoutRepairResult {
  const mapIds = opts.mapId ? [opts.mapId] : Object.keys(project.maps);
  const next = cloneMaps(project, mapIds);
  const counts: LayoutRepairCounts = { relocated: 0, removed: 0, trunksAdded: 0, treesPlanted: 0 };
  for (const mapId of mapIds) {
    const map = next.maps[mapId];
    if (!map) continue;
    relocateConflicts(next, map, counts);
    completeOrDropTrees(next, map, counts);
    const scrubbed = scrubPlacementConflicts(next, map);
    counts.removed += scrubbed.propsOnWater + scrubbed.treesOnImpassable;
  }
  let remaining = validateLayoutPlacement(next, opts);
  if (remaining.some((issue) => issue.code === "layout-tree-missing")) {
    for (const mapId of mapIds) {
      const map = next.maps[mapId];
      if (map) plantMissingTrees(next, map, counts, opts.region);
    }
    remaining = validateLayoutPlacement(next, opts);
  }
  return { project: next, counts, remaining };
}

function cloneMaps(project: Project, mapIds: readonly string[]): Project {
  const maps = { ...project.maps };
  for (const id of mapIds) {
    const map = maps[id];
    if (!map) continue;
    maps[id] = {
      ...map,
      lowerTiles: map.lowerTiles.slice(),
      upperTiles: map.upperTiles.slice(),
    };
  }
  return { ...project, maps };
}

function indexOf(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function inMap(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function isWater(map: GameMap, x: number, y: number): boolean {
  return isLakeAutotileTile(map.lowerTiles[indexOf(map, x, y)] ?? TILE.EMPTY);
}

function isFreeLand(project: Project, map: GameMap, x: number, y: number): boolean {
  if (!inMap(map, x, y) || isWater(map, x, y)) return false;
  const i = indexOf(map, x, y);
  const upper = map.upperTiles[i] ?? TILE.EMPTY;
  const lower = map.lowerTiles[i] ?? TILE.EMPTY;
  if (upper !== TILE.EMPTY && upper >= 0) return false;
  if (LAYOUT_TREE_TILE_IDS.has(lower)) return false;
  return isLowerTerrainPassable(project, map, x, y);
}

function nearestFreeLand(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  extra?: (nx: number, ny: number) => boolean,
): { x: number; y: number } | null {
  const maxR = Math.max(map.width, map.height);
  for (let r = 1; r <= maxR; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!isFreeLand(project, map, nx, ny)) continue;
        if (extra && !extra(nx, ny)) continue;
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

function clearUpper(map: GameMap, x: number, y: number): void {
  map.upperTiles[indexOf(map, x, y)] = TILE.EMPTY;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  map.upperTiles[indexOf(map, x, y)] = tile;
}

function conflictUpper(project: Project, map: GameMap, x: number, y: number): boolean {
  const i = indexOf(map, x, y);
  const upper = map.upperTiles[i] ?? TILE.EMPTY;
  if (upper === TILE.EMPTY || upper < 0) return false;
  if (isWater(map, x, y)) return true;
  if (!LAYOUT_TREE_TILE_IDS.has(upper)) return false;
  if (LAYOUT_TREE_TILE_IDS.has(map.lowerTiles[i] ?? TILE.EMPTY)) return false;
  const lower = map.lowerTiles[i] ?? TILE.EMPTY;
  if (lower === TILE.WALL || lower === TILE.EMPTY) return true;
  return !isLowerTerrainPassable(project, map, x, y);
}

function relocateConflicts(project: Project, map: GameMap, counts: LayoutRepairCounts): void {
  const moves: { x: number; y: number; tile: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (conflictUpper(project, map, x, y)) {
        moves.push({ x, y, tile: map.upperTiles[indexOf(map, x, y)] ?? TILE.EMPTY });
      }
    }
  }
  for (const item of moves) {
    const dest = LAYOUT_TREE_CANOPY_IDS.has(item.tile)
      ? nearestFreeLand(project, map, item.x, item.y, (nx, ny) => isFreeLand(project, map, nx, ny + 1))
      : nearestFreeLand(project, map, item.x, item.y);
    clearUpper(map, item.x, item.y);
    if (!dest) {
      counts.removed += 1;
      continue;
    }
    setUpper(map, dest.x, dest.y, item.tile);
    if (LAYOUT_TREE_CANOPY_IDS.has(item.tile) && inMap(map, item.x, item.y + 1)) {
      const below = indexOf(map, item.x, item.y + 1);
      const trunkLower = map.lowerTiles[below] ?? TILE.EMPTY;
      const trunkUpper = map.upperTiles[below] ?? TILE.EMPTY;
      const destBelow = indexOf(map, dest.x, dest.y + 1);
      if (LAYOUT_TREE_TRUNK_IDS.has(trunkLower)) {
        map.lowerTiles[destBelow] = trunkLower;
        map.lowerTiles[below] = TILE.GRASS;
      } else if (LAYOUT_TREE_TRUNK_IDS.has(trunkUpper)) {
        map.upperTiles[destBelow] = trunkUpper;
        map.upperTiles[below] = TILE.EMPTY;
      }
    }
    counts.relocated += 1;
  }
}

function completeOrDropTrees(project: Project, map: GameMap, counts: LayoutRepairCounts): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = indexOf(map, x, y);
      const upper = map.upperTiles[i] ?? TILE.EMPTY;
      if (!LAYOUT_TREE_CANOPY_IDS.has(upper)) continue;
      if (!inMap(map, x, y + 1)) {
        clearUpper(map, x, y);
        counts.removed += 1;
        continue;
      }
      const below = indexOf(map, x, y + 1);
      if (LAYOUT_TREE_TRUNK_IDS.has(map.lowerTiles[below] ?? TILE.EMPTY)) continue;
      if (LAYOUT_TREE_TRUNK_IDS.has(map.upperTiles[below] ?? TILE.EMPTY)) continue;
      if (!isWater(map, x, y + 1) && isLowerTerrainPassable(project, map, x, y + 1)) {
        const belowLower = map.lowerTiles[below] ?? TILE.EMPTY;
        if (!LAYOUT_TREE_TILE_IDS.has(belowLower)) map.lowerTiles[below] = TILE.TREE;
        counts.trunksAdded += 1;
        continue;
      }
      clearUpper(map, x, y);
      counts.removed += 1;
    }
  }
}

// 보식은 **검사한 영역 안에서만** 한다. 검증은 region 한정인데 보식이 맵 전체를 훑으면
// 영역 밖에 심고도 게이트는 그대로 0그루를 보는 어긋남이 생겼다(선택 영역 작업 경로).
function plantMissingTrees(
  project: Project,
  map: GameMap,
  counts: LayoutRepairCounts,
  region?: LayoutRegion,
): void {
  const x0 = Math.max(0, region?.x ?? 0);
  const y0 = Math.max(0, region?.y ?? 0);
  const x1 = Math.min(map.width, region ? region.x + region.width : map.width);
  const y1 = Math.min(map.height - 1, region ? region.y + region.height : map.height - 1);
  const cells = Math.max(1, (x1 - x0) * (y1 - y0));
  const budget = Math.min(8, Math.max(2, Math.floor(cells / 80)));
  let planted = 0;
  for (let y = y0; y < y1 && planted < budget; y += 1) {
    for (let x = x0; x < x1 && planted < budget; x += 1) {
      if (!isFreeLand(project, map, x, y) || !isFreeLand(project, map, x, y + 1)) continue;
      if (
        project.startMapId === map.id
        && project.startPos.x === x
        && (project.startPos.y === y || project.startPos.y === y + 1)
      ) {
        continue;
      }
      setUpper(map, x, y, 260);
      map.lowerTiles[indexOf(map, x, y + 1)] = TILE.TREE;
      planted += 1;
      counts.treesPlanted += 1;
    }
  }
}
