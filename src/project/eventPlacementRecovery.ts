import { canMove, canMoveFootprint, inBounds, isPassable } from "./collision";
import { eventBodyRect, eventPassageRect } from "./eventFootprintQuery";
import { normalizeCharacterFootprint, normalizePassRows, pointRect, rectCells, rectsOverlap } from "./footprint";
import { firesOnPlayerCollision } from "./eventTouchRules";
import { playerBodyRect, resolvePlayerBody } from "./playerFootprint";
import { computeReachableCells, type Point } from "./lint/reachability";
import type { GameEvent, GameMap, Project } from "./types";

/** A sprite alone is not a character: RTP object sheets also contain doors/signs. */
export function eventRequiresPassableTile(event: GameEvent): boolean {
  if (event.placementRole === "npc" || event.characterId || event.schedule?.length || event.moveRoute) return true;
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

const STEPS = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;

export function eventIsMovable(event: GameEvent): boolean {
  return Boolean(event.moveRoute || event.schedule?.length || event.pages?.some(page =>
    page.movement.type !== "fixed" || page.interaction?.kind === "pushable"));
}

/** One synchronous, immutable analysis only. Never retain across a project mutation. */
export class EventPlacementAnalysis {
  private occupancy?: Map<string, { bodies: Set<string>; blockers: Set<string> }>;
  private readonly floods = new Map<string, ReadonlySet<string>>();
  private readonly suggestions = new Map<GameEvent, Map<string, EventRelocation>>();

  constructor(private readonly project: Project, private readonly map: GameMap) {}

  reachable(from?: Point): ReadonlySet<string> | undefined {
    const origin = from ?? (this.map.id === this.project.startMapId ? this.project.startPos : undefined);
    if (!origin || !isPassable(this.project, this.map, origin.x, origin.y)) return undefined;
    const key = `${origin.x},${origin.y}`;
    let seen = this.floods.get(key);
    if (!seen) {
      seen = computeReachableCells(this.project, this.map, origin.x, origin.y);
      this.floods.set(key, seen);
    }
    return seen;
  }

  private occupied(x: number, y: number, ignoreId: string, kind: "bodies" | "blockers"): boolean {
    if (!this.occupancy) {
      this.occupancy = new Map();
      for (const event of this.map.events) {
        const page = event.pages?.[0];
        const blocks = (page?.priority ?? "same") === "same" && page?.overlapForbidden !== false;
        const passage = eventPassageRect(event);
        for (const cell of rectCells(eventBodyRect(event))) {
          const key = `${cell.x},${cell.y}`;
          let ids = this.occupancy.get(key);
          if (!ids) this.occupancy.set(key, ids = { bodies: new Set(), blockers: new Set() });
          ids.bodies.add(event.id);
          if (blocks && rectsOverlap(passage, pointRect(cell.x, cell.y))) ids.blockers.add(event.id);
        }
      }
    }
    const ids = this.occupancy.get(`${x},${y}`)?.[kind];
    return ids !== undefined && (ids.size > 1 || (ids.size === 1 && !ids.has(ignoreId)));
  }

  canOccupy(event: GameEvent): boolean {
    const body = eventBodyRect(event);
    if (rectCells(body).some(cell => !inBounds(this.map, cell.x, cell.y) || this.occupied(cell.x, cell.y, event.id, "bodies"))) return false;
    return this.map.id !== this.project.startMapId || !rectsOverlap(body,
      playerBodyRect(resolvePlayerBody(this.project), this.project.startPos.x, this.project.startPos.y));
  }

  passageOpen(event: GameEvent): boolean {
    return rectCells(eventPassageRect(event)).every(cell => isPassable(this.project, this.map, cell.x, cell.y));
  }

  /** Runtime traversal uses passage rectangles, not authored destination reservations. */
  private canTraverse(event: GameEvent): boolean {
    if (rectCells(eventBodyRect(event)).some(cell => !inBounds(this.map, cell.x, cell.y))) return false;
    return rectCells(eventPassageRect(event)).every(cell => !this.occupied(cell.x, cell.y, event.id, "blockers")
      // canNpcMove checks the player's current anchor against the mover's passage.
      && !(this.map.id === this.project.startMapId && cell.x === this.project.startPos.x && cell.y === this.project.startPos.y));
  }

  /** A player's approach is not evidence that a wider NPC can leave its landing. */
  hasMovementStep(event: GameEvent): boolean {
    const page = event.pages?.[0];
    const footprint = normalizeCharacterFootprint(page?.footprint);
    const passRows = normalizePassRows(page?.passRows, footprint.height);
    return STEPS.some(([dx, dy]) => canMoveFootprint(this.project, this.map,
      event.x, event.y, footprint, event.x + dx, event.y + dy, passRows)
      && this.canTraverse({ ...event, x: event.x + dx, y: event.y + dy }));
  }

  hasInteractionPosition(event: GameEvent, from?: Point): boolean {
    const body = eventBodyRect(event), seen = this.reachable(from);
    const open = (x: number, y: number): boolean => isPassable(this.project, this.map, x, y)
      && (!seen || seen.has(`${x},${y}`)) && !this.occupied(x, y, event.id, "blockers");
    // Match the existing first-page geometry convention for trigger/blocking too.
    const page = event.pages?.[0];
    const touch = firesOnPlayerCollision((page?.trigger ?? event.trigger).kind);
    const blocks = (page?.priority ?? "same") === "same" && page?.overlapForbidden !== false;
    const passage = eventPassageRect(event);
    const incoming = (x: number, y: number): boolean => STEPS.some(([dx, dy]) =>
      !rectsOverlap(body, pointRect(x + dx, y + dy)) && open(x + dx, y + dy)
      && canMove(this.project, this.map, x + dx, y + dy, x, y));
    // Touch must reach the trigger body (or legally bump its blocking passage).
    // An adjacent floor tile does not establish that a directional tile is enterable.
    if (rectCells(body).some(cell => open(cell.x, cell.y)
      && (!blocks || !rectsOverlap(passage, pointRect(cell.x, cell.y)))
      && (seen !== undefined || incoming(cell.x, cell.y)))) return true;
    if (touch) return blocks && rectCells(body).some(cell => incoming(cell.x, cell.y));
    // Action signs can be inspected from outside without traversing their wall.
    for (let x = body.left; x <= body.right; x++) if (open(x, body.top - 1) || open(x, body.bottom + 1)) return true;
    for (let y = body.top; y <= body.bottom; y++) if (open(body.left - 1, y) || open(body.right + 1, y)) return true;
    return false;
  }

  validDestination(event: GameEvent, mustStandOnPassable: boolean, from?: Point): boolean {
    return this.canOccupy(event)
      && (!mustStandOnPassable || this.passageOpen(event))
      && (!(eventRequiresPassableTile(event) || eventIsMovable(event)) || this.hasMovementStep(event))
      && this.hasInteractionPosition(event, from);
  }

  candidates(event: GameEvent, from?: Point): EventRelocation {
    const origin = from ?? (this.map.id === this.project.startMapId ? this.project.startPos : undefined);
    const key = origin ? `${origin.x},${origin.y}` : "local";
    let byOrigin = this.suggestions.get(event);
    const cached = byOrigin?.get(key);
    if (cached) return cached;
    const candidates: EventRelocation["candidates"][number][] = [];
    for (let radius = 1; radius <= 3 && candidates.length < 3; radius++) {
      for (let dy = -radius; dy <= radius && candidates.length < 3; dy++) {
        for (let dx = -radius; dx <= radius && candidates.length < 3; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = event.x + dx, y = event.y + dy;
          if (!this.validDestination({ ...event, x, y }, true, from)) continue;
          candidates.push({ name: "move_event", args: { mapId: this.map.id, eventId: event.id, x, y } });
        }
      }
    }
    const result: EventRelocation = { eventId: event.id, searchRadius: 3, candidates };
    if (!byOrigin) this.suggestions.set(event, byOrigin = new Map());
    byOrigin.set(key, result);
    return result;
  }
}

/** Lazy invocation-local map index; no flood or body scan until actually needed. */
export function createEventPlacementAnalysis(project: Project): (map: GameMap) => EventPlacementAnalysis {
  const maps = new Map<GameMap, EventPlacementAnalysis>();
  return map => {
    let analysis = maps.get(map);
    if (!analysis) maps.set(map, analysis = new EventPlacementAnalysis(project, map));
    return analysis;
  };
}

/** Standalone read-only search. Lint shares one analysis across all its diagnostics. */
export function eventRelocationCandidates(project: Project, map: GameMap, event: GameEvent, from?: Point): EventRelocation {
  return new EventPlacementAnalysis(project, map).candidates(event, from);
}
