import { footprintCells } from "@/project/spatialPlacements";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import type { PlaySession } from "@/project/session";
import type { FarmBuildingPlacement, HomeDecorationPlacement, Project } from "@/project/types";

export type RuntimeSpatialPlacementRecords = {
  readonly farmBuildingPlacements?: Record<string, FarmBuildingPlacement>;
  readonly homeDecorationPlacements?: Record<string, HomeDecorationPlacement>;
};

/** Project-aware, deterministic fail-closed restoration for saves/checkpoints. */
export function restoreSpatialPlacementRecords(
  project: Project,
  session: PlaySession,
  source: RuntimeSpatialPlacementRecords,
): RuntimeSpatialPlacementRecords {
  const staging = {
    ...session,
    farmBuildingPlacements: {} as Record<string, FarmBuildingPlacement>,
    homeDecorationPlacements: {} as Record<string, HomeDecorationPlacement>,
  };

  if (source.farmBuildingPlacements !== undefined) {
    for (const placement of Object.values(source.farmBuildingPlacements)) {
      const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
      const level = type?.levels.find((entry) => entry.level === placement.level);
      if (!type || !level || !mapAllowed(type.allowedMapIds, placement.mapId)) continue;
      if (footprintCells(placement.x, placement.y, level.footprint, placement.orientation).some(({ x, y }) => session.farmPlots?.[placement.mapId]?.[`${x},${y}`])) continue;
      if (!canOccupySpatialFootprint(project, staging, placement, level.footprint)) continue;
      staging.farmBuildingPlacements[placement.instanceId] = structuredClone(placement);
    }
  }

  if (source.homeDecorationPlacements !== undefined) {
    for (const placement of Object.values(source.homeDecorationPlacements)) {
      const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
      if (!type
        || !type.allowedOrientations.includes(placement.orientation)
        || !mapAllowed(type.allowedMapIds, placement.mapId)) continue;
      if (footprintCells(placement.x, placement.y, type.footprint, placement.orientation).some(({ x, y }) => session.farmPlots?.[placement.mapId]?.[`${x},${y}`])) continue;
      if (!canOccupySpatialFootprint(project, staging, placement, type.footprint)) continue;
      staging.homeDecorationPlacements[placement.instanceId] = structuredClone(placement);
    }
  }

  return {
    ...(source.farmBuildingPlacements !== undefined
      ? { farmBuildingPlacements: staging.farmBuildingPlacements }
      : {}),
    ...(source.homeDecorationPlacements !== undefined
      ? { homeDecorationPlacements: staging.homeDecorationPlacements }
      : {}),
  };
}

function mapAllowed(allowedMapIds: readonly string[] | undefined, mapId: string): boolean {
  return !allowedMapIds || allowedMapIds.length === 0 || allowedMapIds.includes(mapId);
}
