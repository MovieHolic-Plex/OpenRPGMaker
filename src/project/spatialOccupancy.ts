import { inBounds, isPassable } from "@/project/collision";
import { footprintCells, isSpatialFootprint, isSpatialOrientation } from "@/project/spatialPlacements";
import type { PlaySession } from "@/project/session";
import type {
  Dir,
  FarmBuildingPlacement,
  HomeDecorationPlacement,
  Project,
  SpatialFootprint,
} from "@/project/types";

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
  for (const placeable of Object.values(session.placeables ?? {})) {
    if (placeable.mapId === position.mapId && target.has(cellKey(placeable.x, placeable.y))) return false;
  }
  for (const chest of Object.values(session.chests ?? {})) {
    if (chest.mapId === position.mapId && target.has(cellKey(chest.x, chest.y))) return false;
  }
  return true;
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
