import type { GameMap, Project } from "@/project/types";
import { isPassableLanding } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { computeReachableCells } from "@/project/lint/reachability";
import { coordKey, environmentalRoadAt, type Point, type Rect } from "./constants";
import { ToolError } from "../types";
import { connectVillageAccessPoints, paintRoadStrip } from "./roads";
import type { RoadStyle } from "../villagePlan";

export interface VillageLakeside { readonly pad: Rect; readonly entry: Point; readonly water: Rect }

/** Reserve and connect a dry shore clearing during the ROAD phase; water is still unpainted. */
export function prepareVillageLakesides(project: Project, map: GameMap, area: Rect, waterRects: readonly Rect[],
  style: RoadStyle, blocked: ReadonlySet<string>): VillageLakeside[] {
  const result: VillageLakeside[] = [];
  for (const water of waterRects) {
    const cx = water.x + Math.floor(water.w / 2), cy = water.y + Math.floor(water.h / 2);
    const candidates: Rect[] = [
      { x: water.x + water.w, y: cy - 1, w: 3, h: 3 },
      { x: cx - 1, y: water.y + water.h, w: 3, h: 3 },
      { x: water.x - 3, y: cy - 1, w: 3, h: 3 },
      { x: cx - 1, y: water.y - 3, w: 3, h: 3 },
    ];
    // Compact housing can occupy the four bank midpoints. Look along the rest
    // of each bank before deciding that this lake has no usable rest clearing.
    for (let x = water.x; x + 3 <= water.x + water.w; x += 2) {
      candidates.push({ x, y: water.y + water.h, w: 3, h: 3 }, { x, y: water.y - 3, w: 3, h: 3 });
    }
    for (let y = water.y; y + 3 <= water.y + water.h; y += 2) {
      candidates.push({ x: water.x - 3, y, w: 3, h: 3 }, { x: water.x + water.w, y, w: 3, h: 3 });
    }
    const pad = candidates.find(rect => cells(rect).every(p => p.x >= area.x && p.y >= area.y
      && p.x < area.x + area.w && p.y < area.y + area.h && !blocked.has(coordKey(p.x, p.y))
      && map.lowerTiles[p.y * map.width + p.x] === TILE.GRASS && map.upperTiles[p.y * map.width + p.x] === TILE.EMPTY
      && !map.lowerTileStacks?.[p.y * map.width + p.x]?.length && !map.upperTileStacks?.[p.y * map.width + p.x]?.length
      && isPassableLanding(project, map, p.x, p.y) && !map.events.some(event => event.x === p.x && event.y === p.y)));
    if (!pad) continue;
    const entry = { x: pad.x + 1, y: pad.y + 2 };
    // Connect before painting the pad, so a disconnected clearing cannot become its own destination.
    connectVillageAccessPoints(map, area, [entry], style, blocked);
    paintRoadStrip(map, style, cells(pad));
    result.push({ pad, entry, water });
  }
  return result;
}

/** Dress the requested water only. Do not invent a second lake, snow or dungeon in a grass village. */
export function finishVillageLakesides(project: Project, map: GameMap, shores: readonly VillageLakeside[]): number {
  let placed = 0;
  for (const { pad, entry } of shores) {
    const before = computeReachableCells(project, map, entry.x, entry.y);
    const isRoad = environmentalRoadAt(map);
    const approaches = cells({ x: pad.x - 1, y: pad.y - 1, w: pad.w + 2, h: pad.h + 2 })
      .filter(p => (p.x < pad.x || p.x >= pad.x + pad.w || p.y < pad.y || p.y >= pad.y + pad.h)
        && isRoad(p.x, p.y) && before.has(coordKey(p.x, p.y)));
    if (!approaches.length) continue;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const bench = [{ x: pad.x + dx, y: pad.y + dy, tile: 327 }, { x: pad.x + dx + 1, y: pad.y + dy, tile: 328 }];
      if (bench.some(p => map.upperTiles[p.y * map.width + p.x] !== TILE.EMPTY
        || isLakeAutotileTile(map.lowerTiles[p.y * map.width + p.x] ?? -1))) continue;
      for (const p of bench) map.upperTiles[p.y * map.width + p.x] = p.tile;
      const after = computeReachableCells(project, map, entry.x, entry.y);
      if (approaches.every(p => after.has(coordKey(p.x, p.y)))
        && bench.some(p => after.has(coordKey(p.x, p.y + 1)))) {
        placed += bench.length; break;
      }
      for (const p of bench) map.upperTiles[p.y * map.width + p.x] = TILE.EMPTY;
    }
  }
  return placed;
}

/** Actual landing cells, not merely a tile adjacent to a blocked destination. */
export function assertVillagePublicAccess(project: Project, map: GameMap, start: Point): void {
  const targets = (map.layoutPlan?.regions ?? []).flatMap(region => [
    ...(region.objectExterior?.doorApproaches ?? []),
    ...(region.front && (region.tags?.includes("market-display") || region.tags?.includes("lakeside")) ? [region.front] : []),
  ]);
  const reachable = computeReachableCells(project, map, start.x, start.y);
  const blocked = targets.filter(p => !reachable.has(coordKey(p.x, p.y)) || !isPassableLanding(project, map, p.x, p.y));
  if (blocked.length) throw new ToolError(`마을 접근로가 막혔습니다: 현관·가판·쉼터 ${blocked.length}곳 (${blocked[0]!.x},${blocked[0]!.y}).`, { code: "village-public-access", mapId: map.id });
}

function cells(rect: Rect): Point[] {
  return Array.from({ length: rect.w * rect.h }, (_, i) => ({ x: rect.x + i % rect.w, y: rect.y + Math.floor(i / rect.w) }));
}
