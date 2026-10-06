import { terrainLineOfSight, terrainVisionRange } from "@/project/terrainGameplay";
import { isPassable } from '@/project/collision';
import { pointRect } from '@/project/footprint';
import { findBlockingEventOverlappingRect, type RuntimeEventView } from '@/project/runtimeEventState';
import { isSpatialPlacementBlocking } from '@/project/spatialOccupancy';
import type { Dir, NpcSight } from '@/project/types';
import { isInSafeZone, type ChasePoint } from './chaseAi';
import type { PursuitWorld } from './pursuitNavigation';

/** Explicit policy, current facing, and a supercover ray (including corner-touching cells). */
export function npcSeesPoint(world: PursuitWorld, view: RuntimeEventView, target: ChasePoint, sight: NpcSight, facing: Dir = view.direction ?? 'down'): boolean {
  const dx = target.x - view.x, dy = target.y - view.y;
  if (isInSafeZone(world.map.safeZones, target) || Math.abs(dx) + Math.abs(dy) > terrainVisionRange(world.map, view, sight.range)) return false;
  if (sight.facing === 'forward') {
    const forward = facing === 'down' ? dx === 0 && dy >= 0 : facing === 'up' ? dx === 0 && dy <= 0
      : facing === 'right' ? dy === 0 && dx >= 0 : dy === 0 && dx <= 0;
    if (!forward) return false;
  }
  if (!terrainLineOfSight(world.map, view, target, world.project.tilesets[world.map.tilesetId])) return false;
  if (!sight.lineOfSight) return true;
  const blocked = (x: number, y: number): boolean => {
    if ((x === view.x && y === view.y) || (x === target.x && y === target.y)) return false;
    const rect = pointRect(x, y);
    return !isPassable(world.project, world.map, x, y)
      || isSpatialPlacementBlocking(world.project, world.session, world.map.id, rect)
      || !!findBlockingEventOverlappingRect(world.project, world.map, world.session, world.positions, rect, view.event.id);
  };
  const nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  let x = view.x, y = view.y, ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    const acrossX = (1 + 2 * ix) * ny, acrossY = (1 + 2 * iy) * nx;
    if (acrossX === acrossY) {
      if (blocked(x + sx, y) || blocked(x, y + sy)) return false;
      x += sx; y += sy; ix++; iy++;
    } else if (acrossX < acrossY) { x += sx; ix++; }
    else { y += sy; iy++; }
    if (blocked(x, y)) return false;
  }
  return true;
}
