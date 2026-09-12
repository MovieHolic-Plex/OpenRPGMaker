import { tileLayerHome } from "@/editor/tileLayerClassification";
import { canMove, tilePassability } from "@/project/collision";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { isCombinedTownTileset, isTreeCanopyTileId } from "@/project/tilesetHarness";
import type { GameMap, MapLayoutRegion, Project, Rect, TilesetDef } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
import { protectedHouseCells } from "../houseProtection";
import { yardAreaForHouse } from "../houseLotDecor";
import { protectedEventCells } from "../placementTools";
import { ToolError } from "../types";
import { environmentalRoadAt, ROAD_TILES } from "./constants";

type Point = { x: number; y: number };
type ExteriorRegion = MapLayoutRegion & {
  objectExterior?: { doorApproaches: Point[]; privateAccess: Point[] };
};
export interface CompactTreeCounts {
  broadleafTrees: number; conifers: number; footprintCells: number; eligibleCells: number;
  edgeCells: number; innerCells: number; groves: number;
}
export interface CompactGroundCounts {
  tallGrassCells: number; tallGrassPatches: number; flowerCells: number; flowerClusters: number;
}

/** House/road construction must finish and register ownership first. This stage
 * plants whole 2×2 broadleaf and 1×2 conifer atoms in continuous outer woods and
 * irregular interior groves. It never paints the ground dressing or a water cell. */
export function plantCompactVillageTrees(project: Project, map: GameMap, area: Rect, seed: number,
  reservedWater: ReadonlySet<number>): CompactTreeCounts {
  const tileset = townTileset(project, map);
  for (const tile of [260, 262, 263]) requireLayer(tileset, tile, "upper");
  for (const tile of [290, 292, 293]) requireLayer(tileset, tile, "lower");
  const blocked = protection(project, map, area, reservedWater);
  const eligible = cellsIn(map, area).filter(index => !blocked.has(index)
    && map.lowerTiles[index] === TILE.GRASS && map.upperTiles[index] === TILE.EMPTY);
  const rng = mulberry32(seed ^ 0x76b421);
  const field = groveField(map, area, eligible, rng);
  const planted = new Set<number>();
  const result: CompactTreeCounts = { broadleafTrees: 0, conifers: 0, footprintCells: 0,
    eligibleCells: eligible.length, edgeCells: 0, innerCells: 0, groves: 0 };
  const origins = shuffle([...field], rng);
  const stamp = (origin: number, width: 1 | 2): boolean => {
    const x = origin % map.width;
    const y = Math.floor(origin / map.width);
    if (!inside(map, area, x + width - 1, y + 1)) return false;
    const footprint = Array.from({ length: width * 2 }, (_, offset) => origin + offset % width + Math.floor(offset / width) * map.width);
    if (footprint.some(index => !field.has(index) || planted.has(index))) return false;
    for (let dx = 0; dx < width; dx += 1) {
      map.upperTiles[origin + dx] = width === 2 ? 262 + dx : 260;
      map.lowerTiles[origin + map.width + dx] = width === 2 ? 292 + dx : 290;
    }
    for (const index of footprint) planted.add(index);
    return true;
  };
  // The larger crowns establish the mass first; conifers fill its narrow pockets.
  const broadleafAreaTarget = field.size * 0.57;
  for (const origin of origins) {
    if (result.broadleafTrees * 4 >= broadleafAreaTarget) break;
    if (stamp(origin, 2)) result.broadleafTrees += 1;
  }
  for (const origin of shuffle(origins, rng)) if (stamp(origin, 1)) result.conifers += 1;
  result.footprintCells = planted.size;
  for (const index of planted) {
    if (edgeDistance(map, area, index) < 8) result.edgeCells += 1;
    else result.innerCells += 1;
  }
  result.groves = components(map, planted).filter(group => group.length >= 8).length;
  return result;
}

/** Final decoration, after water and trees. Tall grass is a connected 243-block
 * terrain mask shaped by its actual autotile group, never scattered anchor chips.
 * Flowers are passable upper clusters; neither operation erases existing trees. */
export function dressCompactVillageGround(project: Project, map: GameMap, area: Rect, seed: number,
  reservedWater: ReadonlySet<number>): CompactGroundCounts {
  const tileset = townTileset(project, map);
  const group = autotileGroupsForTileset(tileset).find(candidate => candidate.memberTileIds.includes(243)
    && candidate.memberTileIds.includes(304));
  if (!group) throw new ToolError("243 계열 키큰 풀 오토타일 그룹이 필요합니다.", { code: "compact-vegetation-grass-group", mapId: map.id });
  for (const tile of group.memberTileIds) {
    requireLayer(tileset, tile, "lower");
    const pass = tilePassability(tileset, tile, TILE.EMPTY);
    if (!(pass.up && pass.down && pass.left && pass.right)) {
      throw new ToolError("키큰 풀 패치는 통행 가능한 지형이어야 합니다.", { code: "compact-vegetation-grass-blocked", mapId: map.id });
    }
  }
  for (const tile of [288, 348]) requireLayer(tileset, tile, "upper");
  const blocked = protection(project, map, area, reservedWater);
  const members = new Set(group.memberTileIds);
  const eligible = cellsIn(map, area).filter(index => !blocked.has(index) && map.lowerTiles[index] === TILE.GRASS
    && (map.upperTiles[index] === TILE.EMPTY || isTreeCanopyTileId(map.upperTiles[index]!))
    // Keep previously authored grass boundaries exact, including owned neighbors.
    && !neighbors(map, index, true).some(other => members.has(map.lowerTiles[other]!)));
  const rng = mulberry32(seed ^ 0x43935);
  const field = groveField(map, area, eligible, rng);
  const patches = components(map, field).filter(patch => patch.length >= 9);
  const painted = new Set(patches.flat());
  const points = [...painted].map(index => ({ x: index % map.width, y: Math.floor(index / map.width) }));
  const body = group.variantMap["255"];
  if (body === undefined || !members.has(body)) throw new ToolError("키큰 풀 몸통 변형이 없습니다.", { code: "compact-vegetation-grass-group", mapId: map.id });
  for (const index of painted) map.lowerTiles[index] = body;
  shapeAutotileGroupAround(map, group, points, (x, y) => painted.has(y * map.width + x));
  const result: CompactGroundCounts = { tallGrassCells: painted.size, tallGrassPatches: patches.length, flowerCells: 0, flowerClusters: 0 };
  const flowerCenters: number[] = [];
  for (const center of shuffle([...painted], rng)) {
    if (flowerCenters.length >= Math.ceil(painted.size / 65)) break;
    if (flowerCenters.some(other => distance(map, center, other) < 5)) continue;
    const cluster = [center, ...neighbors(map, center, true)].filter(index => painted.has(index)
      && map.upperTiles[index] === TILE.EMPTY && !blocked.has(index));
    if (cluster.length < 3) continue;
    const selected = shuffle(cluster, rng).slice(0, 3 + Math.floor(rng() * 3));
    for (const index of selected) map.upperTiles[index] = rng() < 0.65 ? 288 : 348;
    flowerCenters.push(center); result.flowerCells += selected.length; result.flowerClusters += 1;
  }
  return result;
}

function townTileset(project: Project, map: GameMap): TilesetDef {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || !isCombinedTownTileset(tileset)) throw new ToolError("마을 식생은 combined_town 타일셋이 필요합니다.", { code: "compact-vegetation-tileset", mapId: map.id });
  return tileset;
}
function requireLayer(tileset: TilesetDef, tile: number, layer: "lower" | "upper"): void {
  const home = tileLayerHome(tileset, tile);
  if (home !== layer && home !== "both") throw new ToolError(`식생 타일 ${tile}의 ${layer} 레이어가 허용되지 않습니다.`, { code: "compact-vegetation-layer" });
}

function protection(project: Project, map: GameMap, area: Rect, water: ReadonlySet<number>): Set<number> {
  const blocked = new Set(water);
  const add = (point: Point, radius = 0): void => {
    for (let y = point.y - radius; y <= point.y + radius; y += 1) for (let x = point.x - radius; x <= point.x + radius; x += 1) {
      if (inside(map, area, x, y)) blocked.add(y * map.width + x);
    }
  };
  for (const point of protectedHouseCells(map)) add(point);
  const anchors: Point[] = [];
  for (const key of protectedEventCells(project, map)) {
    const [x, y] = key.split(",").map(Number); const point = { x: x!, y: y! };
    add(point, 1); anchors.push(point);
  }
  for (const region of map.layoutPlan?.regions ?? []) {
    if (region.role !== "house") continue;
    const exterior = (region as ExteriorRegion).objectExterior;
    const yard = yardAreaForHouse(map, [region], region.doorAt);
    for (const index of cellsIn(map, yard)) blocked.add(index);
    for (const point of [...(exterior?.privateAccess ?? []), ...(exterior?.doorApproaches ?? [])]) add(point, 1);
    const front = region.front ?? (region.doorAt ? { x: region.doorAt.x, y: region.doorAt.y + 1 }
      : { x: region.x + Math.floor(region.w / 2), y: region.y + region.h });
    add(front, 1); anchors.push(front);
  }
  for (const index of cellsIn(map, area)) {
    if (map.lowerTileStacks?.[index]?.length || map.upperTileStacks?.[index]?.length
      || ROAD_TILES.has(map.lowerTiles[index]!) || isWaterChipsetTile(map.lowerTiles[index]!)) blocked.add(index);
  }
  // Keep one already walkable route from each event/gate to the public network.
  // A halo alone could leave the event isolated inside a newly planted grove.
  const road = environmentalRoadAt(map);
  const previous = new Map<number, number>();
  const queue = cellsIn(map, area).filter(index => road(index % map.width, Math.floor(index / map.width)));
  for (const index of queue) previous.set(index, index);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]!;
    for (const next of neighbors(map, index)) {
      const x = next % map.width, y = Math.floor(next / map.width);
      if (previous.has(next) || water.has(next) || !inside(map, area, x, y)) continue;
      if (!canMove(project, map, x, y, index % map.width, Math.floor(index / map.width))) continue;
      previous.set(next, index); queue.push(next);
    }
  }
  for (const point of anchors) {
    let index = point.y * map.width + point.x;
    while (previous.has(index)) {
      blocked.add(index);
      const next = previous.get(index)!;
      if (next === index) break;
      index = next;
    }
  }
  return blocked;
}

function groveField(map: GameMap, area: Rect, eligible: readonly number[], rng: Rng): Set<number> {
  const available = new Set(eligible), field = new Set<number>();
  const centers: { index: number; radiusX: number; radiusY: number }[] = [];
  for (const index of shuffle([...eligible], rng)) {
    if (centers.length >= Math.ceil(eligible.length / 155)) break;
    if (edgeDistance(map, area, index) < 8 || centers.some(center => distance(map, index, center.index) < 8)) continue;
    centers.push({ index, radiusX: 3 + rng() * 2, radiusY: 3 + rng() * 2 });
  }
  for (const index of eligible) {
    const x = index % map.width, y = Math.floor(index / map.width);
    const band = 6.5 + Math.sin(x * 0.31) + Math.cos(y * 0.27);
    if (edgeDistance(map, area, index) < band) field.add(index);
  }
  for (const center of centers) {
    const cx = center.index % map.width, cy = Math.floor(center.index / map.width);
    for (let y = Math.floor(cy - center.radiusY); y <= cy + center.radiusY; y += 1) {
      for (let x = Math.floor(cx - center.radiusX); x <= cx + center.radiusX; x += 1) {
        const index = y * map.width + x;
        if (inside(map, area, x, y) && available.has(index)
          && ((x - cx) / center.radiusX) ** 2 + ((y - cy) / center.radiusY) ** 2 <= 1) field.add(index);
      }
    }
  }
  return field;
}
function inside(map: GameMap, area: Rect, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height && x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
}
function cellsIn(map: GameMap, area: Rect): number[] {
  const result: number[] = [];
  for (let y = Math.max(0, area.y); y < Math.min(map.height, area.y + area.h); y += 1) {
    for (let x = Math.max(0, area.x); x < Math.min(map.width, area.x + area.w); x += 1) result.push(y * map.width + x);
  }
  return result;
}
function neighbors(map: GameMap, index: number, diagonal = false): number[] {
  const x = index % map.width, y = Math.floor(index / map.width), result: number[] = [];
  for (const [dx, dy] of diagonal ? [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] : [[0,-1],[1,0],[0,1],[-1,0]]) {
    if (x + dx! >= 0 && x + dx! < map.width && y + dy! >= 0 && y + dy! < map.height) result.push((y + dy!) * map.width + x + dx!);
  }
  return result;
}
function components(map: GameMap, cells: ReadonlySet<number>): number[][] {
  const unseen = new Set(cells), result: number[][] = [];
  for (const first of cells) {
    if (!unseen.delete(first)) continue;
    const group = [first];
    for (let cursor = 0; cursor < group.length; cursor += 1) for (const next of neighbors(map, group[cursor]!)) {
      if (unseen.delete(next)) group.push(next);
    }
    result.push(group);
  }
  return result;
}
function edgeDistance(map: GameMap, area: Rect, index: number): number {
  const x = index % map.width, y = Math.floor(index / map.width);
  return Math.min(x - area.x, y - area.y, area.x + area.w - 1 - x, area.y + area.h - 1 - y);
}
function distance(map: GameMap, a: number, b: number): number {
  return Math.hypot(a % map.width - b % map.width, Math.floor(a / map.width) - Math.floor(b / map.width));
}
function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
  return items;
}
