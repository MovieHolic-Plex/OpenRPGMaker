import { releasePlaceOwnership } from "./placeOwnership";
import { inspectRemovedAuthoringTransfers } from "./authoringConnections";
import { isolateProject } from "./compileIsolation";
import { appendToTree, containsMap } from "@/project/mapTree";
import { own } from "@/project/spatial/domain";
import type { SpatialOccurrence } from "@/project/spatial/types";
import { mixedCompositionRaster } from "./mixedCompositionRaster";
import { compileObjectEvents, requireSpaceOwnership, spatialRasterDigest, validateRasterAccess } from "./compilerValidation";
import { compileConnections } from "./compileConnections";
import { type SpatialCompileContext } from "./compilerTypes";

export function compileMixedComposition(context: SpatialCompileContext) {
  const { project, document, occurrence } = context;
  const raster = mixedCompositionRaster(context);
  requireSpaceOwnership(context, raster);
  const members = new Set(raster.projections.map(projection => projection.occurrence.id));
  const transfers = inspectRemovedAuthoringTransfers(project, document, { ...document,
    connections: document.connections.filter(link => !members.has(link.from.occurrenceId) && !members.has(link.to.occurrenceId)) });
  releasePlaceOwnership(project, document, members);
  validateRasterAccess(project, { ...raster, ports: raster.projections.flatMap(projection => projection.ports) });
  compileObjectEvents(raster, new Set(document.connections.flatMap(link => [link.from.occurrenceId, link.to.occurrenceId])));
  const extent = { mapId: raster.map.id, rect: raster.rect, ports: raster.ports,
    eventIds: raster.map.events.map(event => event.id), connectionIds: [] };
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences };
  for (const projection of raster.projections) {
    const original = projection.occurrence;
    occurrences[original.id] = original.id === occurrence.id
      ? { ...original, bindings: [{ ...extent, contentDigest: spatialRasterDigest(raster.map, extent) }] }
      : { ...original, bindings: [{ kind: "projection", mapId: raster.map.id, rect: projection.rect, ports: projection.ports }] };
  }
  for (const id of raster.omitted) occurrences[id] = { ...own(document.occurrences, id), bindings: [] };
  project.maps[raster.map.id] = raster.map;
  if (!containsMap(project.mapTree, raster.map.id)) appendToTree(project.mapTree, raster.map.id);
  project.spatialAuthoring = compileConnections(project, { ...document, occurrences }, { members, transfers });
  return isolateProject(project);
}
