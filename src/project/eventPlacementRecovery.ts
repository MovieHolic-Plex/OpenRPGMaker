import { inBounds, isPassable } from "./collision";
import { eventBodyRect, eventPassageRect } from "./eventFootprintQuery";
import { rectCells, rectsOverlap } from "./footprint";
import { computeReachableCells, type Point } from "./lint/reachability";
import type { GameEvent, GameMap, Project } from "./types";

/** A sprite alone is not a character: RTP object sheets also contain doors/signs. */
export function eventRequiresPassableTile(event: GameEvent): boolean {
  if (event.characterId || event.schedule?.length || event.moveRoute) return true;
  const characterSprite = (id: string | undefined): boolean =>
    id !== undefined && /^tex_easyrpg_charset_(?:people|actor|animal|monster)\d*$/.test(id);
  if (!event.pages?.length) return characterSprite(event.sprite?.id);
  return event.pages.some(page => page.movement.type !== "fixed"
    || page.interaction?.kind === "pushable"
    || characterSprite(page.graphic.sprite?.id));
}

export interface EventRelocation {
  readonly eventId: string;
  readonly searchRadius: 3;
  readonly candidates: readonly {
    readonly name: "move_event";
    readonly args: { readonly mapId: string; readonly eventId: string; readonly x: number; readonly y: number };
  }[];
}

/** Advisory candidates only. Execution still goes through move_event and all write guards. */
export function eventRelocationCandidates(
  project: Project, map: GameMap, event: GameEvent, from?: Point,
): EventRelocation {
  const origin = from ?? (map.id === project.startMapId ? project.startPos : undefined);
  const reachable = origin && isPassable(project, map, origin.x, origin.y)
    ? computeReachableCells(project, map, origin.x, origin.y) : undefined;
  const others = map.events.filter(other => other.id !== event.id).map(eventBodyRect);
  const candidates: EventRelocation["candidates"][number][] = [];
  for (let radius = 1; radius <= 3 && candidates.length < 3; radius++) {
    for (let dy = -radius; dy <= radius && candidates.length < 3; dy++) {
      for (let dx = -radius; dx <= radius && candidates.length < 3; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = event.x + dx, y = event.y + dy;
        const moved = { ...event, x, y };
        const body = eventBodyRect(moved);
        if (rectCells(body).some(cell => !inBounds(map, cell.x, cell.y))) continue;
        if (others.some(other => rectsOverlap(body, other))) continue;
        if (!rectCells(eventPassageRect(moved)).every(cell => isPassable(project, map, cell.x, cell.y))) continue;
        if (map.id === project.startMapId && rectCells(body).some(cell => cell.x === project.startPos.x && cell.y === project.startPos.y)) continue;
        // Avoid another isolated floor pocket; when an entry is known, use its tile component.
        if (reachable && !reachable.has(`${x},${y}`)) continue;
        const hasApproach = rectCells(body).some(cell => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([nx, ny]) => {
          const point = { x: cell.x + nx, y: cell.y + ny };
          return isPassable(project, map, point.x, point.y)
            && (!reachable || reachable.has(`${point.x},${point.y}`))
            && ![body, ...others].some(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
        }));
        if (!hasApproach) continue;
        candidates.push({ name: "move_event", args: { mapId: map.id, eventId: event.id, x, y } });
      }
    }
  }
  return { eventId: event.id, searchRadius: 3, candidates };
}
