import { isForestHarmonyTileset } from "@/project/defaults/forestHarmony";
import { FOREST_GROVE_GROUP } from "@/project/defaults/forestGrove";
import { OUTDOOR_OBJECT_CATALOG } from "@/project/defaults/spatial/outdoorObjectCatalog";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { protectedHouseCells } from "../houseProtection";
import { ROAD_TILES, shuffled, type BuiltHouse, type Point, type Rect } from "./constants";

type Cell = { dx: number; dy: number; tile: number };
type Detail = { name: string; cells: readonly Cell[] };
// Reuse complete catalog objects; never scatter halves of furniture independently.
const object = (id: string, x: number, y: number): Cell[] =>
  OUTDOOR_OBJECT_CATALOG.find(item => item.id === id)!.cells.map(cell =>
    ({ dx: x + cell.dx, dy: y + cell.dy, tile: cell.tile }));
// Small props and furniture follow the forest atlas's inherited, authored groups:
// house-yard-props (349–352), table-horizontal (234–236), table-chairs (175–206).
const DETAILS: readonly Detail[] = [
  { name: "화단", cells: [{ dx: 0, dy: 0, tile: 351 }, { dx: 2, dy: 0, tile: 288 },
    { dx: 1, dy: 1, tile: 288 }, { dx: 2, dy: 1, tile: 289 }] },
  { name: "장작과 통", cells: [...object("outdoor-barrel", 0, 0),
    { dx: 2, dy: 1, tile: 349 }, { dx: 3, dy: 1, tile: 349 }] },
  { name: "야외 탁자", cells: [{ dx: 1, dy: 0, tile: 175 },
    { dx: 0, dy: 1, tile: 234 }, { dx: 1, dy: 1, tile: 235 }, { dx: 2, dy: 1, tile: 236 },
    { dx: 1, dy: 2, tile: 176 }, { dx: 4, dy: 1, tile: 351 }] },
  { name: "수확 상자", cells: [...object("outdoor-crate", 0, 1),
    { dx: 3, dy: 0, tile: 202 }, { dx: 4, dy: 0, tile: 203 }, { dx: 3, dy: 1, tile: 352 }] },
];
const REST: Detail = { name: "길가 쉼터", cells: [...object("outdoor-bench", 0, 0),
  { dx: 3, dy: 0, tile: 288 }, { dx: 3, dy: 1, tile: 351 }] };
const UNDERGROWTH: Detail = { name: "숲 가장자리 꽃덤불", cells: [
  { dx: 0, dy: 0, tile: 289 }, { dx: 2, dy: 0, tile: 288 }, { dx: 1, dy: 1, tile: 288 }] };

/** Dress usable spaces near houses, roads and forest edges. Every cluster keeps
 * its walking gaps and skips occupied ground, routes, events and sealed houses. */
export function dressForestVillage(project: Project, map: GameMap, area: Rect,
  houses: readonly BuiltHouse[], seed: number, warnings: string[]): number {
  const tileset = project.tilesets[map.tilesetId];
  if (!isForestHarmonyTileset(tileset)) return 0;
  const W = map.width;
  const reserved = new Set(protectedHouseCells(map).map(p => p.y * W + p.x));
  const protect = (point: Point): void => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserved.add((point.y + dy) * W + point.x + dx);
  };
  houses.forEach(house => protect(house.front));
  map.events.forEach(protect);
  if (project.startMapId === map.id) protect(project.startPos);
  const free = (x: number, y: number): boolean => x >= Math.max(0, area.x) && y >= Math.max(0, area.y)
    && x < Math.min(W, area.x + area.w) && y < Math.min(map.height, area.y + area.h)
    && !reserved.has(y * W + x) && map.lowerTiles[y * W + x] === TILE.GRASS
    && map.upperTiles[y * W + x] === TILE.EMPTY
    && !map.lowerTileStacks?.[y * W + x]?.length && !map.upperTileStacks?.[y * W + x]?.length;
  const rng = mulberry32((seed ^ 0x746f776e) >>> 0);
  const counts = new Map<string, number>();
  let placed = 0;
  const stamp = (detail: Detail, point: Point): boolean => {
    const width = Math.max(...detail.cells.map(c => c.dx)) + 1;
    const height = Math.max(...detail.cells.map(c => c.dy)) + 1;
    // Reserve the complete composition, including its internal walking space.
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
      if (!free(point.x + dx, point.y + dy)) return false;
    }
    for (const cell of detail.cells) map.upperTiles[(point.y + cell.dy) * W + point.x + cell.dx] = cell.tile;
    for (let dy = -1; dy <= height; dy++) for (let dx = -1; dx <= width; dx++) reserved.add((point.y + dy) * W + point.x + dx);
    placed += detail.cells.length;
    counts.set(detail.name, (counts.get(detail.name) ?? 0) + 1);
    return true;
  };
  for (const [index, house] of houses.entries()) {
    const b = house.bbox;
    const anchors: Point[] = [];
    for (let y = b.y + Math.floor(b.h / 2); y <= b.y + b.h + 3; y++) {
      for (let x = b.x - 6; x <= b.x + b.w + 2; x++) anchors.push({ x, y });
    }
    // A household activity plus a flower patch, with seed-derived placement.
    for (const detail of [DETAILS[1 + index % 3]!, DETAILS[0]!]) {
      shuffled(anchors, rng).some(point => stamp(detail, point));
    }
  }
  const canopy = new Set(tileset?.autotileGroups?.find(group => group.id === FOREST_GROVE_GROUP)?.memberTileIds ?? []);
  const roadAnchors: Point[] = [], forestAnchors: Point[] = [];
  for (let y = area.y + 2; y < area.y + area.h - 3; y++) for (let x = area.x + 2; x < area.x + area.w - 5; x++) {
    if (!free(x, y)) continue;
    if ([-2, 2].some(dx => ROAD_TILES.has(map.lowerTiles[y * W + x + dx]!))) roadAnchors.push({ x, y });
    if ([[0, -2], [-2, 0], [3, 0]].some(([dx, dy]) => canopy.has(map.upperTiles[(y + dy!) * W + x + dx!]!))) forestAnchors.push({ x, y });
  }
  const spread = (candidates: Point[], detail: Detail, limit: number): void => {
    const centres: Point[] = [];
    for (const point of shuffled(candidates, rng)) {
      if (centres.length >= limit) break;
      if (centres.some(p => Math.abs(p.x - point.x) + Math.abs(p.y - point.y) < 9)) continue;
      if (stamp(detail, point)) centres.push(point);
    }
  };
  spread(roadAnchors, REST, Math.max(2, Math.ceil(houses.length / 3)));
  spread(forestAnchors, UNDERGROWTH, Math.max(4, houses.length));
  warnings.push(`숲마을 생활 소품: ${[...counts].map(([name, count]) => `${name} ${count}곳`).join(", ")} (${placed}칸)`);
  return placed;
}
