import { footprintBounds } from "@/project/footprint";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { runtimeEventViewsForMap, type RuntimeEventPositions } from "@/project/runtimeEventState";
import { orientedFootprint } from "@/project/spatialPlacements";
import type {
  SpatialLiveActor,
  SpatialLiveContext,
  SpatialLiveContextReader,
  SpatialPosition,
} from "@/project/spatialOccupancy";
import type { PlaySession } from "@/project/session";
import type { Dir, FootprintRect, GameMap, Project, SpatialFootprint } from "@/project/types";

/** Scene projection is missing or not a discrete body. Live UI must refuse, not drop the reader. */
export class LifePlacementSceneUnavailableError extends Error {
  constructor() {
    super("life placement scene is unavailable");
    this.name = "LifePlacementSceneUnavailableError";
  }
}

export type LifePlacementRenderedMove = {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  elapsedMs: number;
  readonly durationMs?: number;
};

export type LifePlacementSceneSource = {
  readonly map: GameMap;
  readonly session: PlaySession;
  readonly tileX: number;
  readonly tileY: number;
  readonly facing: Dir;
  readonly eventPositions: RuntimeEventPositions;
  readonly moving?: boolean;
  readonly movingFrom?: { readonly x: number; readonly y: number };
  readonly movingTo?: { readonly x: number; readonly y: number };
  readonly moveProgress?: number;
  readonly autonomousNPCs?: ReadonlyMap<string, {
    readonly activeMove: LifePlacementRenderedMove | null;
    readonly moveDurationMs: number;
  }>;
};

export function isUsableLiveActor(actor: SpatialLiveActor): boolean {
  return actor.mapId.length > 0
    && Number.isSafeInteger(actor.x)
    && Number.isSafeInteger(actor.y)
    && Number.isSafeInteger(actor.footprint.width)
    && Number.isSafeInteger(actor.footprint.height);
}

function walkingBlockingView(priority: string, overlapForbidden: boolean): boolean {
  return priority === "same" && overlapForbidden;
}

/**
 * Discrete live bodies for the core reader. Player uses the committed foot tile (origin
 * while a step is in flight). NPCs use runtimeEventView coordinates (destination at step
 * start). Page-less, erased and off-map ghosts are omitted. Pass-through/below/above
 * events are omitted here so last-exit walking does not treat them as walls; visible-body
 * construction protection is {@link placementBlockedByRenderedBodies}.
 */
export function readLifePlacementLiveContext(
  project: Project,
  scene: LifePlacementSceneSource,
): SpatialLiveContext | undefined {
  if (!scene.map || !Number.isSafeInteger(scene.tileX) || !Number.isSafeInteger(scene.tileY)) return undefined;
  const body = resolvePlayerBody(project, scene.session);
  const player: SpatialLiveActor = {
    mapId: scene.map.id,
    x: scene.tileX,
    y: scene.tileY,
    footprint: body.footprint,
    passRows: body.passRows,
  };
  if (!isUsableLiveActor(player)) return undefined;
  const npcs: SpatialLiveActor[] = [];
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    if (!view.page) continue;
    if (!walkingBlockingView(view.priority, view.overlapForbidden)) continue;
    if (!Number.isSafeInteger(view.x) || !Number.isSafeInteger(view.y)) continue;
    const actor: SpatialLiveActor = {
      mapId: scene.map.id,
      x: view.x,
      y: view.y,
      footprint: view.footprint,
      passRows: view.passRows,
    };
    if (isUsableLiveActor(actor)) npcs.push(actor);
  }
  return { player, npcs };
}

export function createLifePlacementLiveReader(
  getScene: () => LifePlacementSceneSource | undefined,
  getProject: () => Project,
): SpatialLiveContextReader {
  return () => {
    const scene = getScene();
    if (!scene) throw new LifePlacementSceneUnavailableError();
    const live = readLifePlacementLiveContext(getProject(), scene);
    if (!live) throw new LifePlacementSceneUnavailableError();
    return live;
  };
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/** Inclusive cell rects treated as unit squares so a body at y=3.1 still occupies row 3. */
function occupancyOverlap(a: FootprintRect, b: FootprintRect): boolean {
  return a.left < b.right + 1 && b.left < a.right + 1 && a.top < b.bottom + 1 && b.top < a.bottom + 1;
}

function targetRect(position: SpatialPosition, footprint: SpatialFootprint) {
  const size = orientedFootprint(footprint, position.orientation);
  return {
    left: position.x,
    right: position.x + size.width - 1,
    top: position.y,
    bottom: position.y + size.height - 1,
  };
}

/**
 * Target-specific visual occupancy. Fractional interpolating anchors are examined here
 * and never forwarded to core geometry. An in-flight player refuses until the step
 * commits. Visible above/below/pass-through bodies block construction on overlap but
 * are not walking walls. Unrelated movers that do not overlap the target do not ban
 * construction.
 */
export function placementBlockedByRenderedBodies(
  project: Project,
  scene: LifePlacementSceneSource,
  position: SpatialPosition,
  footprint: SpatialFootprint,
): boolean {
  if (!scene.map || position.mapId !== scene.map.id) return false;
  if (scene.moving) return true;
  const target = targetRect(position, footprint);
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    if (!view.page) continue;
    const mover = scene.autonomousNPCs?.get(view.event.id);
    const move = mover?.activeMove;
    let x = view.x;
    let y = view.y;
    if (move) {
      const duration = Math.max(1, move.durationMs ?? mover.moveDurationMs);
      const progress = Math.min(1, Math.max(0, move.elapsedMs / duration));
      x = lerp(move.fromX, move.toX, progress);
      y = lerp(move.fromY, move.toY, progress);
    }
    if (occupancyOverlap(target, footprintBounds(x, y, view.footprint))) return true;
  }
  return false;
}
