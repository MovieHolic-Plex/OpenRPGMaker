import { deserialize } from "@/project/io";
import { appendToTree, containsMap } from "@/project/mapTree";
import { computeReachableCells } from "@/project/lint/reachability";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { assertNever, own, resolveOccurrencePortId } from "@/project/spatial/domain";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import type { SpatialOccurrence } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { compileConnections } from "./compileConnections";
import { inspectRemovedAuthoringTransfers } from "./authoringConnections";
import { objectPorts } from "./compileObjects";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError, type SpatialCompileContext } from "./compilerTypes";
import { placeCanvases } from "./placeCanvases";
import { placeLayout, projectedPlacePort } from "./placeLayout";
import { releasePlaceOwnership } from "./placeOwnership";

/** Actual containment selects compilation work; navigation never drives this traversal. */
export function compilePlaces(context: SpatialCompileContext): Project {
  const { project, document } = context;
  const members = new Set(occurrenceSubtree(document, context.occurrence.id));
  const { positions, surfaces } = placeLayout(context);
  const eventOrder = new Map(Object.values(project.maps).map(map => [map.id, new Map(map.events.map((event, index) => [event.id, index]))]));
  const connectionOrder = new Map(project.mapConnections?.map((connection, index) => [connection.id, index]));
  // Capture exact ordinary transfers before their raster owners release them. Outside links are not this write set.
  const transfers = inspectRemovedAuthoringTransfers(project, document, { ...document,
    connections: document.connections.filter(link => !members.has(link.from.occurrenceId) && !members.has(link.to.occurrenceId)),
  });
  releasePlaceOwnership(project, document, members);
  const placed = placeCanvases({ project, document, rootId: context.occurrence.id }, surfaces);
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences };
  for (const id of members) occurrences[id] = { ...own(document.occurrences, id), bindings: [] };
  for (const { surface, map, offset } of placed) {
    const { occurrence, raster } = surface;
    const ports = raster.ports.map(port => ({ ...port, x: port.x + offset.x, y: port.y + offset.y }));
    const extent = { mapId: map.id, rect: { ...raster.rect, x: offset.x, y: offset.y }, ports,
      eventIds: raster.map.events.map(event => event.id), connectionIds: [] };
    occurrences[occurrence.id] = { ...occurrence, bindings: [{ ...extent, contentDigest: spatialRasterDigest(map, extent) }] };
    for (const object of raster.objects) occurrences[object.occurrence.id] = { ...object.occurrence,
      bindings: [{ kind: "projection", mapId: map.id,
        rect: { ...object.rect, x: object.rect.x + offset.x, y: object.rect.y + offset.y },
        ports: objectPorts(object).map(port => ({ ...port, x: port.x + offset.x, y: port.y + offset.y })) }] };
    for (const projection of surface.projections ?? []) {
      if (projection.occurrence.id === occurrence.id) continue;
      occurrences[projection.occurrence.id] = { ...projection.occurrence, bindings: [{ kind: "projection", mapId: map.id,
        rect: { ...projection.rect, x: projection.rect.x + offset.x, y: projection.rect.y + offset.y },
        ports: projection.ports.map(port => ({ ...port, x: port.x + offset.x, y: port.y + offset.y })) }] };
    }
  }
  // A place projects containment, not ownership. Its own ports must have an exact surface.
  for (const position of positions) {
    const { occurrence } = position;
    switch (occurrence.kind) {
      case "place": {
        const descendantIds = new Set(occurrenceSubtree(document, occurrence.id));
        const childMaps = placed.filter(item => descendantIds.has(item.surface.occurrence.id));
        const current = own(occurrences, occurrence.id);
        const boundPorts = new Set(current.bindings.flatMap(binding => binding.ports.map(port => port.portId)));
        const ports = occurrence.snapshot.ports.filter(port => !boundPorts.has(port.id)).map(port => {
          const { surface, world } = projectedPlacePort(position, surfaces, port);
          const target = placed.find(item => item.surface === surface);
          if (!target) throw new TypeError("Missing compiler surface");
          const point = { x: world.x - surface.world.x + target.offset.x, y: world.y - surface.world.y + target.offset.y };
          const reached = computeReachableCells(project, target.map, surface.raster.entry.x + target.offset.x, surface.raster.entry.y + target.offset.y);
          if (!reached.has(`${point.x},${point.y}`)) throw new SpatialCompileError("port", port.id);
          return { mapId: target.map.id, portId: resolveOccurrencePortId(occurrence, port.localPortId), ...point };
        });
        occurrences[occurrence.id] = { ...current, bindings: [...current.bindings,
          ...[...new Set([...childMaps.map(item => item.map.id), ...ports.map(port => port.mapId)])]
            .filter(id => !current.bindings.some(binding => binding.mapId === id)).map(id => {
            const map = own(project.maps, id);
            return { kind: "projection" as const, mapId: id, rect: { x: 0, y: 0, width: map.width, height: map.height },
              ports: ports.filter(port => port.mapId === id).map(({ mapId: _mapId, ...port }) => port) };
          }),
        ] };
        break;
      }
      case "space": break;
      case "object": case "region": case "world": break;
      default: assertNever(occurrence);
    }
  }
  for (const { surface, map } of placed) if (!containsMap(project.mapTree, map.id)) {
    let parentId = surface.occurrence.parentId;
    let parentMapId: string | undefined;
    while (parentId !== null && parentMapId === undefined) {
      const parent = own(occurrences, parentId);
      parentMapId = parent.bindings.find(binding => binding.mapId !== map.id && containsMap(project.mapTree, binding.mapId))?.mapId;
      parentId = parent.parentId;
    }
    appendToTree(project.mapTree, map.id, parentMapId);
  }
  const connected = compileConnections(project, { ...document, occurrences }, { members, transfers });
  for (const map of new Set(placed.map(item => item.map))) {
    const order = eventOrder.get(map.id);
    map.events.sort((a, b) => (order?.get(a.id) ?? Infinity) - (order?.get(b.id) ?? Infinity));
  }
  project.mapConnections?.sort((a, b) => (connectionOrder.get(a.id) ?? Infinity) - (connectionOrder.get(b.id) ?? Infinity));
  project.spatialAuthoring = { ...connected, occurrences: Object.fromEntries(Object.values(connected.occurrences).map(occurrence =>
    [occurrence.id, members.has(occurrence.id) ? { ...occurrence, bindings: occurrence.bindings.map(binding => isOwnedSpatialBinding(binding)
      ? { ...binding, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), binding) } : binding) } : occurrence])) };
  return deserialize(JSON.stringify(project));
}
