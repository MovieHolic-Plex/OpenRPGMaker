import { computeReachableCells } from "@/project/lint/reachability";
import { villageWaterPredicate } from "./waterTiles";
import type { GameMap, Project } from "@/project/types";
import { ToolError } from "../types";
import type { Point } from "./constants";
import { BRIDGE_PLANK_TILE } from "./landscape";
import type { RiverVillagePlan } from "./riverPlan";

/** Validate the raster after all decoration, rather than accepting the blueprint. */
export function assertRiverVillage(project: Project, map: GameMap, river: RiverVillagePlan,
  fronts: readonly Point[], entry: Point): void {
  const fail = (message: string): never => { throw new ToolError(message, { code: "village-river-access", mapId: map.id }); };
  const isWater = villageWaterPredicate(map, project.tilesets[map.tilesetId]);
  if (river.cells.some(p => !isWater(map.lowerTiles[p.y * map.width + p.x] ?? -1))) fail("예약한 강이 시공 중 끊겼습니다.");
  if (!river.bridge.length || river.bridge.some(p => map.upperTiles[p.y * map.width + p.x] !== BRIDGE_PLANK_TILE)) fail("강 건널목이 시공되지 않았습니다.");
  const reachable = computeReachableCells(project, map, entry.x, entry.y);
  const destinations = [...fronts, ...river.bridge, river.westRoad[0]!, river.eastRoad[river.eastRoad.length - 1]!];
  if (destinations.some(p => !reachable.has(`${p.x},${p.y}`))) fail("강 양쪽의 길·집·건널목이 실제로 연결되지 않았습니다.");
}
