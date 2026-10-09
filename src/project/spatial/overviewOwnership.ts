import { hasProjectedSpatialPort, isOwnedSpatialBinding } from "./bindings";
import { own } from "./domain";
import { hasOverviewRouteRepresentation, overviewEntryAuthorized, spatialEventOwner, spatialPortLanding } from "./overview";
import type * as S from "./types";

export type SpatialOverviewEntryImpact = {
  readonly occurrenceId: S.SpatialId; readonly bindingIndex: number; readonly mapId: string;
  readonly target: S.SpatialConnection["from"]; readonly eventId: string;
  readonly returnEventId: string; readonly returnMapId: string;
  readonly returnOccurrenceId: S.SpatialId; readonly returnBindingIndex: number;
};
/** Metadata-only fixed point: removing a representation can orphan its route's other marker.
 * Explicit event ownership and raster digests are unchanged. No map erase authority is created.
 */
export function pruneOverviewMetadata(document: S.SpatialAuthoringDocument): S.SpatialAuthoringDocument {
  let current = document;
  for (;;) {
    let changed = false;
    const occurrences = Object.fromEntries(Object.values(current.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
      bindings: occurrence.bindings.map(binding => {
        if (!isOwnedSpatialBinding(binding)) return binding;
        const { overviewEntries, ...extent } = binding;
        const authorized = overviewEntries === undefined ? undefined : overviewEntryAuthorized(current, occurrence, binding);
        const retained = overviewEntries?.filter(entry => {
          const landing = spatialPortLanding(current, entry.target);
          return landing !== undefined && binding.eventIds.includes(entry.eventId) && authorized?.(entry) &&
            spatialEventOwner(current, { mapId: landing.mapId, eventId: entry.returnEventId }) !== undefined;
        });
        const candidate = { ...extent, ...(retained?.length ? { overviewEntries: retained } : {}) };
        const connectionIds = binding.connectionIds.filter(id => current.connections.some(link => link.id === id &&
          (link.overviewRoute?.occurrenceId === occurrence.id ? hasOverviewRouteRepresentation(occurrence, candidate, link) :
            [link.from, link.to].some(endpoint => endpoint.occurrenceId === occurrence.id ||
              hasProjectedSpatialPort(own(current.occurrences, endpoint.occurrenceId), candidate, endpoint.portId)))));
        if (retained?.length !== overviewEntries?.length || connectionIds.length !== binding.connectionIds.length) changed = true;
        return { ...candidate, connectionIds };
      }),
    }]));
    if (!changed) return current;
    current = { ...current, occurrences };
  }
}
/** Compare exact associations, not coordinates or ID spelling. Used for delete, detach and future refresh proposals. */
export function inspectOverviewEntryChanges(before: S.SpatialAuthoringDocument, after: S.SpatialAuthoringDocument): readonly SpatialOverviewEntryImpact[] {
  const impacts: SpatialOverviewEntryImpact[] = [];
  for (const occurrence of Object.values(before.occurrences)) for (const [bindingIndex, binding] of occurrence.bindings.entries()) {
    if (!isOwnedSpatialBinding(binding)) continue;
    const surviving = Object.hasOwn(after.occurrences, occurrence.id) ? after.occurrences[occurrence.id] : undefined;
    for (const entry of binding.overviewEntries ?? []) {
      const landing = spatialPortLanding(before, entry.target);
      if (!landing) throw new TypeError("Parsed overview entry has no landing");
      const reverse = spatialEventOwner(before, { mapId: landing.mapId, eventId: entry.returnEventId });
      if (!reverse) throw new TypeError("Parsed overview entry has no reverse owner");
      const proposedLanding = spatialPortLanding(after, entry.target);
      const proposedReverse = proposedLanding && spatialEventOwner(after, { mapId: proposedLanding.mapId, eventId: entry.returnEventId });
      if (proposedLanding?.mapId === landing.mapId && proposedLanding.x === landing.x && proposedLanding.y === landing.y &&
        proposedReverse?.occurrenceId === reverse.occurrenceId &&
        surviving?.bindings.some(candidate => isOwnedSpatialBinding(candidate) && candidate.mapId === binding.mapId &&
          candidate.overviewEntries?.some(retained => retained.eventId === entry.eventId && retained.returnEventId === entry.returnEventId &&
            retained.target.occurrenceId === entry.target.occurrenceId && retained.target.portId === entry.target.portId &&
            retained.x === entry.x && retained.y === entry.y))) continue;
      impacts.push({ occurrenceId: occurrence.id, bindingIndex, mapId: binding.mapId, target: entry.target,
        eventId: entry.eventId, returnEventId: entry.returnEventId, returnMapId: landing.mapId,
        returnOccurrenceId: reverse.occurrenceId,
        returnBindingIndex: own(before.occurrences, reverse.occurrenceId).bindings.indexOf(reverse.binding) });
    }
  }
  return impacts;
}
