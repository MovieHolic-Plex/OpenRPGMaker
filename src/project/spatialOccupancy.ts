import { canMoveFootprint, inBounds, isPassable } from "@/project/collision";
import { footprintBounds, passageBounds, pointRect, rectsOverlap } from "@/project/footprint";
import { footprintCells, isSpatialFootprint, isSpatialOrientation, orientedFootprint } from "@/project/spatialPlacements";
import type { PlaySession } from "@/project/session";
import type {
  CharacterFootprint,
  Dir,
  FarmBuildingPlacement,
  FootprintRect,
  HomeDecorationPlacement,
  Project,
  SpatialFootprint,
} from "@/project/types";

/** Call-scoped scene projection, never part of a placement, session or save. */
export type SpatialLiveActor = {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly footprint: CharacterFootprint;
  readonly passRows?: number;
};

export type SpatialLiveContext = {
  readonly player: SpatialLiveActor;
  readonly npcs: readonly SpatialLiveActor[];
};

/** Read actual current scene state on each preview AND transaction invocation. */
export type SpatialLiveContextReader = () => SpatialLiveContext;

export function adjacentSpatialPosition(
  player: SpatialLiveActor,
  direction: Dir,
  footprint: SpatialFootprint,
  orientation: Dir,
): SpatialPosition {
  const body = actorBody(player);
  const size = orientedFootprint(footprint, orientation);
  return {
    mapId: player.mapId,
    x: direction === "left" ? body.left - size.width : direction === "right" ? body.right + 1 : body.left,
    y: direction === "up" ? body.top - size.height : direction === "down" ? body.bottom + 1 : body.top,
    orientation,
  };
}

export type SpatialPlacementKind = "farmBuilding" | "homeDecoration";

export type SpatialPosition = {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly orientation: Dir;
};

export type SpatialPlacementIdentity = {
  readonly kind: SpatialPlacementKind;
  readonly instanceId: string;
};

export function isSpatialPlacementBlocking(
  project: Project,
  session: PlaySession,
  mapId: string,
  rect: FootprintRect,
): boolean {
  for (const placement of Object.values(session.farmBuildingPlacements ?? {})) {
    const footprint = resolveBuildingFootprint(project, placement);
    if (placement.mapId === mapId && footprint && placementOverlapsRect(placement, footprint, rect)) return true;
  }
  for (const placement of Object.values(session.homeDecorationPlacements ?? {})) {
    const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
    if (placement.mapId === mapId && type?.blocksMovement && isSpatialFootprint(type.footprint)
      && placementOverlapsRect(placement, type.footprint, rect)) return true;
  }
  return false;
}

/**
 * Checks the complete rotated footprint against the authored map and every
 * independent runtime placement collection. The caller can exclude the object
 * being moved or rotated, so those mutations stay atomic.
 */
export function canOccupySpatialFootprint(
  project: Project,
  session: PlaySession,
  position: SpatialPosition,
  footprint: SpatialFootprint,
  exclude?: SpatialPlacementIdentity,
): boolean {
  if (!isSpatialOrientation(position.orientation) || !isSpatialFootprint(footprint)) return false;
  const map = project.maps[position.mapId];
  if (!map) return false;
  const cells = footprintCells(position.x, position.y, footprint, position.orientation);
  if (cells.length !== footprint.width * footprint.height) return false;
  const target = new Set<string>();
  for (const cell of cells) {
    if (!inBounds(map, cell.x, cell.y) || !isPassable(project, map, cell.x, cell.y)) return false;
    target.add(cellKey(cell.x, cell.y));
  }

  for (const placement of Object.values(session.farmBuildingPlacements ?? {})) {
    if (exclude?.kind === "farmBuilding" && exclude.instanceId === placement.instanceId) continue;
    if (placement.mapId !== position.mapId) continue;
    const other = resolveBuildingFootprint(project, placement);
    if (!other || footprintsIntersect(target, placement, other)) return false;
  }
  for (const placement of Object.values(session.homeDecorationPlacements ?? {})) {
    if (exclude?.kind === "homeDecoration" && exclude.instanceId === placement.instanceId) continue;
    if (placement.mapId !== position.mapId) continue;
    const other = resolveDecorationFootprint(project, placement);
    if (!other || footprintsIntersect(target, placement, other)) return false;
  }
  for (const cell of cells) {
    if (session.farmPlots?.[position.mapId]?.[cellKey(cell.x, cell.y)]) return false;
  }
  for (const placeable of Object.values(session.placeables ?? {})) {
    if (placeable.mapId === position.mapId && target.has(cellKey(placeable.x, placeable.y))) return false;
  }
  for (const chest of Object.values(session.chests ?? {})) {
    if (chest.mapId === position.mapId && target.has(cellKey(chest.x, chest.y))) return false;
  }
  return true;
}

/** Persistent occupancy plus current full bodies and preservation of a local exit.
 * Omitting the reader is the legacy/static path, not a claim of live scene safety.
 */
export function canPlaceSpatialFootprint(
  project: Project,
  session: PlaySession,
  position: SpatialPosition,
  footprint: SpatialFootprint,
  readLive?: SpatialLiveContextReader,
  exclude?: SpatialPlacementIdentity,
  blocksMovement = true,
): boolean {
  if (!canOccupySpatialFootprint(project, session, position, footprint, exclude)) return false;
  if (!readLive) return true;
  const live = readLive();
  const size = orientedFootprint(footprint, position.orientation);
  const target = { left: position.x, right: position.x + size.width - 1, top: position.y, bottom: position.y + size.height - 1 };
  if ([live.player, ...live.npcs].some((actor) => actor.mapId === position.mapId && rectsOverlap(target, actorBody(actor)))) return false;
  if (!blocksMovement || live.player.mapId !== position.mapId) return true;

  // Compare before/after: existing edge overhang or pre-existing confinement must
  // not globally invalidate unrelated construction. No global pathfinding claim.
  const exits = localExits(project, session, live);
  if (exits.length === 0) return true;
  const remaining = localExits(project, session, live, exclude);
  return remaining.some((rect) => !rectsOverlap(rect, target));
}

function actorBody(actor: SpatialLiveActor): FootprintRect {
  return footprintBounds(actor.x, actor.y, actor.footprint);
}

function actorPassage(actor: SpatialLiveActor): FootprintRect {
  return passageBounds(actor.x, actor.y, actor.footprint, actor.passRows ?? actor.footprint.height);
}

function localExits(
  project: Project,
  session: PlaySession,
  live: SpatialLiveContext,
  exclude?: SpatialPlacementIdentity,
): FootprintRect[] {
  const player = live.player;
  const map = project.maps[player.mapId];
  if (!map) return [];
  const result: FootprintRect[] = [];
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    if (!canMoveFootprint(project, map, player.x, player.y, player.footprint, player.x + dx, player.y + dy, player.passRows)) continue;
    const rect = actorPassage({ ...player, x: player.x + dx, y: player.y + dy });
    if (live.npcs.some((npc) => npc.mapId === player.mapId && rectsOverlap(rect, actorPassage(npc)))) continue;
    if (Object.values(session.farmBuildingPlacements ?? {}).some((placement) => {
      if (placement.mapId !== player.mapId || (exclude?.kind === "farmBuilding" && exclude.instanceId === placement.instanceId)) return false;
      const fp = resolveBuildingFootprint(project, placement);
      return !fp || placementOverlapsRect(placement, fp, rect);
    })) continue;
    if (Object.values(session.homeDecorationPlacements ?? {}).some((placement) => {
      if (placement.mapId !== player.mapId || (exclude?.kind === "homeDecoration" && exclude.instanceId === placement.instanceId)) return false;
      const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
      return type?.blocksMovement && placementOverlapsRect(placement, type.footprint, rect);
    })) continue;
    if ([...Object.values(session.placeables ?? {}), ...Object.values(session.chests ?? {})]
      .some((object) => object.mapId === player.mapId && rectsOverlap(rect, pointRect(object.x, object.y)))) continue;
    // Plots and nonblocking rugs reserve construction space, not walking space.
    result.push(rect);
  }
  return result;
}

export function resolveBuildingFootprint(
  project: Project,
  placement: FarmBuildingPlacement,
): SpatialFootprint | undefined {
  const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
  const level = type?.levels.find((entry) => entry.level === placement.level);
  return level && isSpatialFootprint(level.footprint) ? level.footprint : undefined;
}

export function resolveDecorationFootprint(
  project: Project,
  placement: HomeDecorationPlacement,
): SpatialFootprint | undefined {
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
  return type && isSpatialFootprint(type.footprint) ? type.footprint : undefined;
}

function placementOverlapsRect(
  placement: FarmBuildingPlacement | HomeDecorationPlacement,
  footprint: SpatialFootprint,
  rect: FootprintRect,
): boolean {
  if (!isSpatialOrientation(placement.orientation)) return true;
  const size = orientedFootprint(footprint, placement.orientation);
  return rectsOverlap(rect, {
    left: placement.x, right: placement.x + size.width - 1,
    top: placement.y, bottom: placement.y + size.height - 1,
  });
}

function footprintsIntersect(
  target: ReadonlySet<string>,
  placement: FarmBuildingPlacement | HomeDecorationPlacement,
  footprint: SpatialFootprint,
): boolean {
  if (!isSpatialOrientation(placement.orientation)) return true;
  const cells = footprintCells(placement.x, placement.y, footprint, placement.orientation);
  if (cells.length !== footprint.width * footprint.height) return true;
  return cells.some((cell) => target.has(cellKey(cell.x, cell.y)));
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
