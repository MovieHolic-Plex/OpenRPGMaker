import { deserialize } from "@/project/io";
import { appendToTree, containsMap } from "@/project/mapTree";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { own, requireOccurrenceAssociations } from "@/project/spatial/domain";
import { overviewDesign, resolveOverviewEndpoint } from "@/project/spatial/overview";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import type { SpatialConnection, SpatialPoint } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { spatialRasterDigest } from "./compilerValidation";
import { SpatialCompileError, type SpatialCompileContext } from "./compilerTypes";
import { compileGeographyEntries, releaseGeographyEntries } from "./geographyEntries";
import { geographyTerrain, paintGeographyRoute } from "./geographyTerrain";
import { validateOverviewAccess } from "./overviewEntries";

/** Shared bounded raster/association assembly; callers select the actual child compiler. */
export function compileGeography(context: SpatialCompileContext, compileChild: (context: SpatialCompileContext) => Project): Project {
  const { occurrence } = context;
  const design = overviewDesign(occurrence);
  const members = new Set(occurrenceSubtree(context.document, occurrence.id));
  const connectionOrder = new Map(context.project.mapConnections?.map((link, index) => [link.id, index]));
  const eventOrder = new Map(Object.values(context.project.maps).map(map => [map.id, new Map(map.events.map((event, index) => [event.id, index]))]));
  const localRoutes = "routes" in design ? design.routes : design.connections;
  const links = localRoutes.map(local => {
    const link = context.document.connections.find(link => link.overviewRoute?.occurrenceId === occurrence.id && link.overviewRoute.localConnectionId === local.id);
    if (!link || !link.bidirectional) throw new SpatialCompileError("connection", local.id);
    return link;
  });
  const targets = links.flatMap(link => [link.from, link.to]);
  const selected = "entryPort" in design ? resolveOverviewEndpoint(context.document, occurrence.id, design.entryPort) : undefined;
  if (selected) targets.push(selected);
  const pointFor = (target: SpatialConnection["from"]): SpatialPoint => {
    const child = own(context.document.occurrences, target.occurrenceId);
    const point = target.occurrenceId === occurrence.id ? occurrence.snapshot.ports.find(port => port.id === target.portId) : child;
    if (!point || point.x < 0 || point.y < 0 || point.x >= design.terrain.width || point.y >= design.terrain.height || child.level !== 0) {
      throw new SpatialCompileError("clipped", target.portId);
    }
    return { x: point.x, y: point.y };
  };
  for (const target of targets) pointFor(target);
  for (const child of Object.values(context.document.occurrences).filter(child => child.parentId === occurrence.id)) {
    if (child.x < 0 || child.y < 0 || child.x >= design.terrain.width || child.y >= design.terrain.height || child.level !== 0) throw new SpatialCompileError("clipped", child.id);
  }
  const id = `spatial-geography:${occurrence.id.length}:${occurrence.id}`;
  const binding = occurrence.bindings.find(isOwnedSpatialBinding);
  if (occurrence.bindings.length && (occurrence.bindings.length !== 1 || !binding || binding.mapId !== id)) {
    throw new SpatialCompileError("ownership", occurrence.id);
  }
  const raster = geographyTerrain(context.project, design.terrain, { id, name: design.name });
  for (const [index, link] of links.entries()) {
    const local = localRoutes[index];
    if (!local) throw new TypeError("Missing frozen route");
    const from = pointFor(link.from), to = pointFor(link.to);
    const points = "routes" in design ? design.routes[index]?.points : [from, { x: to.x, y: from.y }, to];
    if (!points) throw new SpatialCompileError("connection", local.id);
    const first = points[0], last = points[points.length - 1];
    if (!first || !last || first.x !== from.x || first.y !== from.y || last.x !== to.x || last.y !== to.y) {
      throw new SpatialCompileError("connection", `${local.id}: polyline endpoints do not match overview markers`);
    }
    paintGeographyRoute(context.project, raster, { id: local.id, points });
  }
  let project = context.project;
  const released = releaseGeographyEntries(project, context.document, { ownerId: occurrence.id });
  let document = released.document;
  project.spatialAuthoring = document;
  const previous = project.maps[id];
  if (previous && (!binding || binding.mapId !== id || binding.rect.x !== 0 || binding.rect.y !== 0 ||
    binding.rect.width !== previous.width || binding.rect.height !== previous.height || previous.width !== raster.width || previous.height !== raster.height)) {
    throw new SpatialCompileError("ownership", id);
  }
  // Compile every actual contained child, including children without a portal intent.
  for (const child of Object.values(document.occurrences).filter(child => child.parentId === occurrence.id)) {
    project = compileChild({ project, document, occurrence: requireOccurrenceAssociations(own(document.occurrences, child.id)) });
    if (!project.spatialAuthoring) throw new TypeError("Child compiler lost document");
    document = project.spatialAuthoring;
  }
  const { lowerTileStacks: _lower, upperTileStacks: _upper, ...retained } = previous ?? raster;
  const map = { ...retained, tilesetId: raster.tilesetId, lowerTiles: raster.lowerTiles, upperTiles: raster.upperTiles, events: [...retained.events] };
  project.maps[id] = map;
  if (!containsMap(project.mapTree, id)) appendToTree(project.mapTree, id);
  const compiled = compileGeographyEntries(project, document, { ownerId: occurrence.id, map, targets, previous: released.previous });
  const extent = { mapId: id, rect: { x: 0, y: 0, width: map.width, height: map.height },
    ports: occurrence.snapshot.ports.map(port => ({ portId: port.id, x: port.x, y: port.y })),
    eventIds: compiled.entries.map(entry => entry.eventId), connectionIds: links.map(link => link.id),
    ...(compiled.entries.length ? { overviewEntries: compiled.entries } : {}) };
  project.spatialAuthoring = { ...compiled.document, occurrences: { ...compiled.document.occurrences,
    [occurrence.id]: { ...occurrence, bindings: [{ ...extent, contentDigest: spatialRasterDigest(map, extent) }] } } };
  project.mapConnections?.sort((a, b) => (connectionOrder.get(a.id) ?? Infinity) - (connectionOrder.get(b.id) ?? Infinity));
  const assembled = project.spatialAuthoring;
  project.spatialAuthoring = { ...assembled, occurrences: Object.fromEntries(Object.values(assembled.occurrences).map(owner => [owner.id,
    members.has(owner.id) ? { ...owner, bindings: owner.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding)) return binding;
      const map = own(project.maps, binding.mapId);
      const order = eventOrder.get(map.id);
      map.events.sort((a, b) => (order?.get(a.id) ?? Infinity) - (order?.get(b.id) ?? Infinity));
      return { ...binding, contentDigest: spatialRasterDigest(map, binding) };
    }) } : owner])) };
  const start = selected ? pointFor(selected) : extent.ports[0] ?? compiled.entries[0];
  if (!start) throw new SpatialCompileError("entry", occurrence.id);
  validateOverviewAccess(project, occurrence.id, { mapId: id, x: start.x, y: start.y });
  return deserialize(JSON.stringify(project));
}
