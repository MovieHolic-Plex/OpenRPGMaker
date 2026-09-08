import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own } from "@/project/spatial/domain";
import { spatialPortLanding } from "@/project/spatial/overview";
import { validateSpatialTransferPair } from "@/project/spatial/overviewPairs";
import type { SpatialAuthoringDocument, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { containsPoint } from "./compileObjects";
import { SpatialCompileError } from "./compilerTypes";

export type SpatialAuthoringOwnedEvent = {
  readonly mapId: string; readonly eventId: string;
  readonly occurrenceId: SpatialId; readonly bindingIndex: number;
};
/** Ordinary stair/door links resolve through concrete ports plus explicit event ownership, never event-ID spelling. */
export function inspectRemovedAuthoringTransfers(project: Project, before: SpatialAuthoringDocument, after: SpatialAuthoringDocument): readonly SpatialAuthoringOwnedEvent[] {
  const retained = new Set(after.connections.map(link => link.id));
  const events: SpatialAuthoringOwnedEvent[] = [];
  for (const link of before.connections) {
    if (link.overviewRoute !== undefined || retained.has(link.id)) continue;
    const directions = link.bidirectional ? [[link.from, link.to], [link.to, link.from]] as const : [[link.from, link.to]] as const;
    for (const [source, target] of directions) {
      const from = spatialPortLanding(before, source);
      const to = spatialPortLanding(before, target);
      if (!from || !to) continue; // A logical, uncompiled connection owns no transfer.
      const owner = Object.values(before.occurrences).flatMap(occurrence => occurrence.bindings.flatMap((binding, bindingIndex) =>
        isOwnedSpatialBinding(binding) && binding.mapId === from.mapId && containsPoint(binding.rect, from) && binding.connectionIds.includes(link.id)
          ? [{ occurrenceId: occurrence.id, bindingIndex, binding }] : []))[0];
      if (!owner) continue;
      const candidates = project.mapConnections?.filter(connection => owner.binding.eventIds.includes(connection.id) &&
        connection.from.mapId === from.mapId && connection.from.x === from.x && connection.from.y === from.y &&
        connection.to.mapId === to.mapId && connection.to.x === to.x && connection.to.y === to.y) ?? [];
      const projection = candidates[0];
      if (candidates.length !== 1 || !projection || !own(project.maps, from.mapId).events.some(event => event.id === projection.id)) {
        throw new SpatialCompileError("ownership", link.id);
      }
      validateSpatialTransferPair(project, { id: projection.id, from, to });
      events.push({ mapId: from.mapId, eventId: projection.id, occurrenceId: owner.occurrenceId, bindingIndex: owner.bindingIndex });
    }
  }
  return events;
}
