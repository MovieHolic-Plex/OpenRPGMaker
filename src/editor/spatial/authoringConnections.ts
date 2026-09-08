import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { ProjectFormatError } from "@/project/io/errors";
import { own } from "@/project/spatial/domain";
import { spatialPortLanding } from "@/project/spatial/overview";
import { validateSpatialTransferPair } from "@/project/spatial/overviewPairs";
import type { SpatialAuthoringDocument, SpatialConnection, SpatialId } from "@/project/spatial/types";
import type { GameEvent, MapConnection, Project } from "@/project/types";
import { containsPoint } from "./compileObjects";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";

export type SpatialAuthoringOwnedEvent = {
  readonly mapId: string; readonly eventId: string;
  readonly occurrenceId: SpatialId; readonly bindingIndex: number;
};
/** Transient proof only: association comes from exact old endpoints and ownership, not ID spelling. */
export type SpatialOwnedConnectionTransfer = SpatialAuthoringOwnedEvent & {
  readonly connectionId: SpatialId;
  readonly source: SpatialConnection["from"]; readonly target: SpatialConnection["to"];
  readonly event: GameEvent; readonly connection: MapConnection;
};
/** Ordinary stair/door links resolve through concrete ports plus explicit event ownership, never event-ID spelling. */
export function inspectRemovedAuthoringTransfers(project: Project, before: SpatialAuthoringDocument, after: SpatialAuthoringDocument): readonly SpatialOwnedConnectionTransfer[] {
  const retained = new Set(after.connections.map(link => link.id));
  const events: SpatialOwnedConnectionTransfer[] = [];
  for (const link of before.connections) {
    if (link.overviewRoute !== undefined || retained.has(link.id)) continue;
    const claims = Object.values(before.occurrences).flatMap(occurrence => occurrence.bindings.flatMap((binding, bindingIndex) =>
      isOwnedSpatialBinding(binding) && binding.connectionIds.includes(link.id)
        ? [{ occurrenceId: occurrence.id, bindingIndex, binding }] : []));
    const directions = link.bidirectional ? [[link.from, link.to], [link.to, link.from]] as const : [[link.from, link.to]] as const;
    for (const [source, target] of directions) {
      const from = spatialPortLanding(before, source);
      const to = spatialPortLanding(before, target);
      if (!from || !to) {
        if (claims.length) throw new SpatialCompileError("ownership", link.id);
        continue; // A logical, uncompiled connection owns no transfer.
      }
      const owners = claims.filter(owner => owner.binding.mapId === from.mapId && containsPoint(owner.binding.rect, from));
      const owner = owners[0];
      if (!owner) {
        if (claims.length || own(project.maps, from.mapId).events.some(event => event.x === from.x && event.y === from.y) ||
          project.mapConnections?.some(connection => connection.from.mapId === from.mapId && connection.from.x === from.x && connection.from.y === from.y)) {
          throw new SpatialCompileError("ownership", link.id);
        }
        continue;
      }
      if (owners.length !== 1) throw new SpatialCompileError("ownership", link.id);
      const map = own(project.maps, from.mapId);
      if (spatialRasterDigest(map, owner.binding) !== owner.binding.contentDigest) throw new SpatialCompileError("ownership", link.id);
      const candidates = project.mapConnections?.filter(connection => owner.binding.eventIds.includes(connection.id) &&
        connection.from.mapId === from.mapId && connection.from.x === from.x && connection.from.y === from.y &&
        connection.to.mapId === to.mapId && connection.to.x === to.x && connection.to.y === to.y) ?? [];
      const projection = candidates[0];
      const event = map.events.find(event => event.id === projection?.id);
      if (candidates.length !== 1 || !projection || !event) {
        throw new SpatialCompileError("ownership", link.id);
      }
      try { validateSpatialTransferPair(project, { id: projection.id, from, to }); }
      catch (error) {
        if (!(error instanceof ProjectFormatError)) throw error;
        throw new SpatialCompileError("ownership", `${link.id}: ${error.message}`);
      }
      events.push({ mapId: from.mapId, eventId: projection.id, occurrenceId: owner.occurrenceId, bindingIndex: owner.bindingIndex,
        connectionId: link.id, source, target, event, connection: projection });
    }
  }
  return events;
}
