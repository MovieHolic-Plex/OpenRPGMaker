import { findBlockingRuntimeEventAtInMap, initialRuntimeEventPositions } from "@/player/runtimeEventState";
import { canMove } from "@/project/collision";
import type { IceGrandExpansePoint } from "@/project/defaults/iceGrandExpanseMap";
import { ICE_GRAND_EXPANSE_START } from "@/project/defaults/iceGrandExpansePlan";
import type { PlaySession } from "@/project/session";
import type { GameMap, Project } from "@/project/types";

export function reachableIceGrandExpanseCells(project: Project, map: GameMap, session: PlaySession): ReadonlySet<number> {
  const positions = initialRuntimeEventPositions(map.events);
  const startIndex = ICE_GRAND_EXPANSE_START.y * map.width + ICE_GRAND_EXPANSE_START.x;
  const seen = new Set<number>([startIndex]);
  const queue: IceGrandExpansePoint[] = [{ ...ICE_GRAND_EXPANSE_START }];
  for (let head = 0; head < queue.length; head += 1) {
    const point = queue[head];
    if (point === undefined) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: point.x + dx, y: point.y + dy };
      const index = next.y * map.width + next.x;
      if (seen.has(index) || !canMove(project, map, point.x, point.y, next.x, next.y)) continue;
      if (findBlockingRuntimeEventAtInMap(project, map, session, positions, next.x, next.y) !== undefined) continue;
      seen.add(index);
      queue.push(next);
    }
  }
  return seen;
}

export function targetIceGrandExpanseReached(reachable: ReadonlySet<number>, map: GameMap, target: IceGrandExpansePoint): boolean {
  return ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    .some(([dx, dy]) => reachable.has((target.y + dy) * map.width + target.x + dx));
}
