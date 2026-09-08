import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own } from "@/project/spatial/domain";
import type { SpatialAuthoringDocument, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";

/** Validate the entire write set before cleanup. Projection extents never enter this set. */
export function releasePlaceOwnership(project: Project, document: SpatialAuthoringDocument, members: ReadonlySet<SpatialId>): void {
  const owned = [...members].flatMap(id => own(document.occurrences, id).bindings.filter(isOwnedSpatialBinding));
  const releasedConnections = new Set<string>();
  for (const binding of owned) {
    const map = own(project.maps, binding.mapId);
    if (spatialRasterDigest(map, binding) !== binding.contentDigest) throw new SpatialCompileError("ownership", binding.mapId);
    for (const event of map.events.filter(event => binding.eventIds.includes(event.id))) {
      const connection = project.mapConnections?.find(connection => connection.id === event.id);
      const commands = [...event.commands, ...event.pages?.flatMap(page => page.commands) ?? []];
      const transfer = commands.find(command => command.kind === "transfer");
      if (!transfer && !connection) continue;
      if (!connection) throw new SpatialCompileError("ownership", event.id);
      if (!transfer || connection.from.mapId !== map.id || connection.from.x !== event.x || connection.from.y !== event.y
        || connection.to.mapId !== transfer.mapId || connection.to.x !== transfer.x || connection.to.y !== transfer.y
        || !connection.playerEnabled || !connection.npcEnabled || connection.name !== undefined
        || connection.from.direction !== undefined || connection.to.direction !== undefined) {
        throw new SpatialCompileError("ownership", connection.id);
      }
      releasedConnections.add(connection.id);
    }
  }
  for (const binding of owned) {
    const map = own(project.maps, binding.mapId);
    for (let y = binding.rect.y; y < binding.rect.y + binding.rect.height; y++) for (let x = binding.rect.x; x < binding.rect.x + binding.rect.width; x++) {
      const index = y * map.width + x;
      map.lowerTiles[index] = -1;
      map.upperTiles[index] = -1;
      if (map.lowerTileStacks) delete map.lowerTileStacks[index];
      if (map.upperTileStacks) delete map.upperTileStacks[index];
    }
    map.events = map.events.filter(event => !binding.eventIds.includes(event.id));
  }
  if (project.mapConnections) project.mapConnections = project.mapConnections.filter(connection => !releasedConnections.has(connection.id));
}
