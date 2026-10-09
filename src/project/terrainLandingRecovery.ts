import { canMoveFootprint, inBounds, isPassable } from './collision';
import { characterFootprintCells } from './footprint';
import { playerPassageRect, resolvePlayerBody } from './playerFootprint';
import { findBlockingEventOverlappingRect, type RuntimeEventPositions } from './runtimeEventState';
import { runtimeMap } from './runtimeMap';
import type { PlaySession } from './session';
import type { GameMap, Project } from './types';

/** Recover a floor made solid by runtime tile changes, without rewriting authored terrain.
 * Deliberate authored placement on a wall, vehicles, and valid enclosed rooms are unchanged.
 * Call once after a terrain-changing event finishes, or after restoring a save.
 */
export function recoverPlayerFromTerrain(
  project: Project,
  session: PlaySession,
  positions: RuntimeEventPositions = {},
): { x: number; y: number } | undefined {
  const authored = project.maps[session.currentMapId];
  if (!authored || !session.mapOverrides?.[authored.id] || session.vehicle) return;
  const body = resolvePlayerBody(project, session);
  const floorFits = (map: GameMap, x: number, y: number): boolean => {
    if (characterFootprintCells(x, y, body.footprint).some(cell => !inBounds(map, cell.x, cell.y))) return false;
    const rect = playerPassageRect(body, x, y);
    for (let cy = rect.top; cy <= rect.bottom; cy++) {
      for (let cx = rect.left; cx <= rect.right; cx++) {
        if (!isPassable(project, map, cx, cy)) return false;
      }
    }
    return true;
  };
  const map = runtimeMap(authored, session);
  const { x, y } = session;
  if (!floorFits(authored, x, y) || floorFits(map, x, y)) return;
  const standingFits = (cx: number, cy: number): boolean => floorFits(map, cx, cy)
    && !findBlockingEventOverlappingRect(project, map, session, positions, playerPassageRect(body, cx, cy));
  const directions = [[0, 1], [-1, 0], [1, 0], [0, -1]] as const;
  const safe = (cx: number, cy: number): boolean => standingFits(cx, cy)
    && directions.some(([dx, dy]) => standingFits(cx + dx, cy + dy)
      && canMoveFootprint(project, map, cx, cy, body.footprint, cx + dx, cy + dy, body.passRows));
  // Prefer a neighbouring floor before any diagonal relocation; bounded to local recovery.
  for (let radius = 1; radius <= 8; radius++) {
    const candidates = directions.map(([dx, dy]) => ({ x: x + dx * radius, y: y + dy * radius }));
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) candidates.push({ x: x + dx, y: y + dy });
      }
    }
    const landing = candidates.find(point => safe(point.x, point.y));
    if (landing) {
      session.x = landing.x;
      session.y = landing.y;
      return landing;
    }
  }
  return;
}
