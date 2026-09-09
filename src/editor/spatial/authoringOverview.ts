import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own } from "@/project/spatial/domain";
import { spatialEventOwner } from "@/project/spatial/overview";
import { inspectOverviewEntryChanges, pruneOverviewMetadata } from "@/project/spatial/overviewOwnership";
import { validateSpatialProject } from "@/project/spatial/overviewPairs";
import type { SpatialAuthoringDocument } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";
import { inspectRemovedAuthoringTransfers } from "./authoringConnections";

/** Exact incoming pair cleanup, never authority to erase the surviving owner's raster. */
export function releaseAuthoringOverviewEntries(project: Project, before: SpatialAuthoringDocument, after: SpatialAuthoringDocument) {
  const impacts = inspectOverviewEntryChanges(before, after);
  const pairs = [...inspectRemovedAuthoringTransfers(project, before, after), ...impacts.flatMap(impact => [
    { mapId: impact.mapId, eventId: impact.eventId, occurrenceId: impact.occurrenceId, bindingIndex: impact.bindingIndex },
    { mapId: impact.returnMapId, eventId: impact.returnEventId, occurrenceId: impact.returnOccurrenceId, bindingIndex: impact.returnBindingIndex },
  ])];
  if (pairs.length === 0) return { before, after };
  validateSpatialProject(before, project);
  const events = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const owner = spatialEventOwner(before, pair);
    const binding = own(before.occurrences, pair.occurrenceId).bindings[pair.bindingIndex];
    if (!owner || owner.occurrenceId !== pair.occurrenceId || owner.binding !== binding ||
      spatialRasterDigest(own(project.maps, pair.mapId), owner.binding) !== owner.binding.contentDigest) {
      throw new SpatialCompileError("ownership", pair.eventId);
    }
    const ids = events.get(pair.mapId) ?? new Set<string>();
    ids.add(pair.eventId);
    events.set(pair.mapId, ids);
  }
  // Every exact event owner and projection has passed preflight before even the private write set is changed.
  for (const [mapId, ids] of events) {
    const map = own(project.maps, mapId);
    map.events = map.events.filter(event => !ids.has(event.id));
  }
  if (project.mapConnections) project.mapConnections = project.mapConnections.filter(connection =>
    !events.get(connection.from.mapId)?.has(connection.id));
  const cleaned = (document: SpatialAuthoringDocument): SpatialAuthoringDocument => pruneOverviewMetadata({ ...document,
    occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
      bindings: occurrence.bindings.map(binding => {
        if (!isOwnedSpatialBinding(binding)) return binding;
        const ids = events.get(binding.mapId);
        if (!ids || !binding.eventIds.some(id => ids.has(id))) return binding;
        const next = { ...binding, eventIds: binding.eventIds.filter(id => !ids.has(id)) };
        return { ...next, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), next) };
      }),
    }])),
  });
  return { before: cleaned(before), after: cleaned(after) };
}
