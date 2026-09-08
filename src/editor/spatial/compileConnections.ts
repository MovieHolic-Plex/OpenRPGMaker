import { isPassableLanding } from "@/project/collision";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own } from "@/project/spatial/domain";
import type { SpatialAuthoringDocument, SpatialConnection, SpatialId, SpatialOccurrence } from "@/project/spatial/types";
import type { MapConnection, Project } from "@/project/types";
import { createHouseDoorStepEvent } from "../houseInteriors";
import { containsPoint } from "./compileObjects";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError } from "./compilerTypes";

/** Resolve concrete persisted IDs, never labels, ancestry or an opaque ID's spelling. */
export function resolveCompiledPort(context: { readonly project: Project; readonly occurrences: Readonly<Record<string, SpatialOccurrence>> }, endpoint: SpatialConnection["from"]) {
  const occurrence = own(context.occurrences, endpoint.occurrenceId);
  const binding = occurrence.bindings.find(binding => binding.ports.some(port => port.portId === endpoint.portId));
  const port = binding?.ports.find(port => port.portId === endpoint.portId);
  if (!binding || !port || !isPassableLanding(context.project, own(context.project.maps, binding.mapId), port.x, port.y)) {
    throw new SpatialCompileError("port", endpoint.portId);
  }
  return { mapId: binding.mapId, x: port.x, y: port.y };
}

/** Private proposal mutation. Raster owners, not overlapping projections, own emitted events. */
export function compileConnections(project: Project, document: SpatialAuthoringDocument, members: ReadonlySet<SpatialId>): SpatialAuthoringDocument {
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences };
  const context = { project, occurrences };
  const connections: MapConnection[] = [...project.mapConnections ?? []];
  for (const link of document.connections) {
    if (!members.has(link.from.occurrenceId) && !members.has(link.to.occurrenceId)) continue;
    const directions = link.bidirectional ? [[link.from, link.to], [link.to, link.from]] as const : [[link.from, link.to]] as const;
    for (const [source, target] of directions) {
      const from = resolveCompiledPort(context, source);
      const to = resolveCompiledPort(context, target);
      const owner = Object.values(occurrences).find(occurrence => members.has(occurrence.id) && occurrence.bindings.some(binding =>
        isOwnedSpatialBinding(binding) && binding.mapId === from.mapId && containsPoint(binding.rect, from)));
      if (!owner) throw new SpatialCompileError("ownership", source.occurrenceId);
      const id = `spatial-transfer:${link.id.length}:${link.id}:${source.portId.length}:${source.portId}`;
      const map = own(project.maps, from.mapId);
      if (connections.some(connection => connection.id === id) || map.events.some(event => event.id === id || event.x === from.x && event.y === from.y)) {
        throw new SpatialCompileError("connection", `${link.id}: occupied source ${from.mapId}@${from.x},${from.y}`);
      }
      map.events.push(createHouseDoorStepEvent({ eventId: id, x: from.x, y: from.y,
        interiorMapId: to.mapId, entryX: to.x, entryY: to.y }));
      connections.push({ id, from, to, playerEnabled: true, npcEnabled: true });
      occurrences[owner.id] = { ...owner, bindings: owner.bindings.map(binding => {
        if (!isOwnedSpatialBinding(binding) || binding.mapId !== map.id || !containsPoint(binding.rect, from)) return binding;
        const extent = { ...binding, eventIds: [...binding.eventIds, id], connectionIds: [...new Set([...binding.connectionIds, link.id])] };
        return { ...extent, contentDigest: spatialRasterDigest(map, extent) };
      }) };
    }
  }
  project.mapConnections = connections;
  return { ...document, occurrences };
}
