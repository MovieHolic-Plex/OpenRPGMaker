import { tilePassability } from "@/project/collision";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import {
  acceptedCompanionTiles, adjacencyCompanionSatisfied, clusterAdjacencyParams,
  type ClusterAdjacencyParams,
} from "@/project/lint/clusterRuleValidators";
import { isCombinedTownTileset, isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import type { GameMap, Project, Rect } from "@/project/types";
import { protectedHouseCells } from "../houseProtection";
import { inMapBounds } from "../mapHelpers";
import { protectedEventCells } from "../placementTools";
import { ToolError } from "../types";
import { ROAD_TILES } from "./constants";

type Requirement = { readonly dx: number; readonly dy: number; readonly accepted: readonly number[] };
export type VillageTreeCompletion = {
  readonly canopiesPlaced: number;
  readonly trunksPlaced: number;
  readonly orphanTrunksRemoved: number;
};
const isTree = (tile: number): boolean => isTreeCanopyTileId(tile) || isTreeTrunkTileId(tile);

/** Finish only this village's tree companions before the final audit. Uses the
 * actual hard adjacency rules, including broadleaf diagonal overlap alternatives.
 * A lone 1×2-tree trunk whose lost canopy was occupied by a later prop is removed;
 * the prop and any overlapping tree stay intact. Other conflicts fail before any
 * writes, preserving houses, paths, water, props, stacks and every other map.
 * This is an environmental construction step, never a global runner repair. */
export function completeVillageTrees(project: Project, map: GameMap, area: Rect): VillageTreeCompletion {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || !isCombinedTownTileset(tileset)) return { canopiesPlaced: 0, trunksPlaced: 0, orphanTrunksRemoved: 0 };
  const requirements = new Map<number, Requirement[]>();
  for (const group of tileset.tileGroups ?? []) {
    if (!group.tileIds.length || !group.tileIds.every(isTree)) continue;
    for (const rule of group.rules ?? []) {
      if (rule.kind !== "adjacency" || rule.strength !== "hard") continue;
      const params = clusterAdjacencyParams(rule.params);
      if (!params || !isTree(params.a) || !isTree(params.b)) continue;
      const { dx, dy } = offset(params);
      for (const [tile, direction, sign] of [[params.a, "forward", 1], [params.b, "reverse", -1]] as const) {
        const list = requirements.get(tile) ?? [];
        list.push({ dx: dx * sign, dy: dy * sign, accepted: acceptedCompanionTiles(params, direction) });
        requirements.set(tile, list);
      }
    }
  }

  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => `${x},${y}`));
  for (const key of protectedEventCells(project, map)) protectedCells.add(key);
  const staged: GameMap = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
  const inArea = (x: number, y: number): boolean => inMapBounds(map, x, y)
    && x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
  const queue: { x: number; y: number; tile: number }[] = [];
  const writes: { index: number; tile: number; layer: "lower" | "upper" }[] = [];
  for (let y = Math.max(0, area.y); y < Math.min(map.height, area.y + area.h); y += 1) {
    for (let x = Math.max(0, area.x); x < Math.min(map.width, area.x + area.w); x += 1) {
      const index = y * map.width + x;
      for (const tile of [staged.lowerTiles[index]!, staged.upperTiles[index]!]) {
        if (requirements.has(tile)) queue.push({ x, y, tile });
      }
    }
  }
  const fail = (x: number, y: number, tile: number): never => {
    throw new ToolError(`나무 동반 조각 ${tile}을 (${x},${y})에 완성할 수 없습니다. 집·길·물·소품을 보존하고 나무 배치를 조정하세요.`,
      { code: "village-tree-completion-conflict", mapId: map.id, x, y });
  };
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor]!;
    const sourceIndex = source.y * map.width + source.x;
    if (staged.lowerTiles[sourceIndex] !== source.tile && staged.upperTiles[sourceIndex] !== source.tile) continue;
    for (const requirement of requirements.get(source.tile) ?? []) {
      const x = source.x + requirement.dx;
      const y = source.y + requirement.dy;
      if (adjacencyCompanionSatisfied(staged, { x, y }, requirement.accepted)) continue;
      const tile = requirement.accepted[0]!;
      if (!inArea(x, y) || protectedCells.has(`${source.x},${source.y}`) || protectedCells.has(`${x},${y}`)) fail(x, y, tile);
      const index = y * map.width + x;
      const lower = staged.lowerTiles[index] ?? TILE.EMPTY;
      const upper = staged.upperTiles[index] ?? TILE.EMPTY;
      if (map.lowerTileStacks?.[index]?.length || map.upperTileStacks?.[index]?.length
        || ROAD_TILES.has(lower) || isWaterChipsetTile(lower)) fail(x, y, tile);
      const layer = isTreeCanopyTileId(tile) ? "upper" : "lower";
      if (layer === "upper") {
        const pass = tilePassability(tileset, lower, TILE.EMPTY);
        // A late prop can occupy the erased canopy of an already orphaned 1×2
        // tree. Remove only its unattached lower trunk, never a broadleaf half or
        // any upper canopy that belongs to a different overlapping tree.
        if (upper !== TILE.EMPTY && !isTree(upper) && (source.tile === 290 || source.tile === 291)
          && requirement.dx === 0 && requirement.dy === -1 && staged.lowerTiles[sourceIndex] === source.tile
          && !map.lowerTileStacks?.[sourceIndex]?.length && !map.upperTileStacks?.[sourceIndex]?.length) {
          staged.lowerTiles[sourceIndex] = TILE.GRASS;
          writes.push({ index: sourceIndex, tile: TILE.GRASS, layer: "lower" });
          continue;
        }
        if (upper !== TILE.EMPTY || (!isTreeTrunkTileId(lower) && !(pass.up || pass.down || pass.left || pass.right))) fail(x, y, tile);
      } else if ((lower !== TILE.GRASS && lower !== TILE.EMPTY) || (upper !== TILE.EMPTY && !isTreeCanopyTileId(upper))) {
        fail(x, y, tile);
      }
      // A transparent canopy needs a backing, but empty terrain is not a license
      // to invent land in final environmental finishing.
      if (layer === "upper" && lower === TILE.EMPTY) fail(x, y, tile);
      staged[layer === "upper" ? "upperTiles" : "lowerTiles"][index] = tile;
      writes.push({ index, tile, layer });
      queue.push({ x, y, tile });
    }
  }
  for (const { index, tile, layer } of writes) map[layer === "upper" ? "upperTiles" : "lowerTiles"][index] = tile;
  return {
    canopiesPlaced: writes.filter(write => write.layer === "upper").length,
    trunksPlaced: writes.filter(write => isTreeTrunkTileId(write.tile)).length,
    orphanTrunksRemoved: writes.filter(write => write.tile === TILE.GRASS).length,
  };
}

function offset(params: ClusterAdjacencyParams): { dx: number; dy: number } {
  switch (params.relation) {
    case "aAboveB": return { dx: 0, dy: 1 };
    case "aBelowB": return { dx: 0, dy: -1 };
    case "aLeftOfB": return { dx: 1, dy: 0 };
    case "aRightOfB": return { dx: -1, dy: 0 };
  }
}
