import { deserialize } from "@/project/io";
import { appendToTree, containsMap } from "@/project/mapTree";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { assertNever, checkedDocument, own, requireOccurrenceAssociations } from "@/project/spatial/domain";
import type { SpatialCompiledBinding, SpatialOccurrence } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { compileObjects, objectPorts, placedObject } from "./compileObjects";
import { compileSpaces } from "./compileSpaces";
import { compilePlaces } from "./compilePlaces";
import { compileRegions } from "./compileRegions";
import { compileWorlds } from "./compileWorlds";
import { compileObjectEvents, requireSpaceOwnership, spatialRasterDigest, validateRasterAccess } from "./compilerValidation";
import { SpatialCompileError, type SpatialRasterProposal } from "./compilerTypes";
import { parseCompileRequest } from "./compileRequest";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import { requireOverviewWriteSet } from "./overviewEntries";
export { SpatialCompileError } from "./compilerTypes";
export type { SpatialCompileRequest } from "./compilerTypes";

/** Pure proposal boundary: no store, history, browser, remote writes, or live design expansion. */
export function compileSpatialOccurrence(input: Project, value: unknown): Project {
  const request = parseCompileRequest(value);
  const project = deserialize(JSON.stringify(input));
  const document = checkedDocument(project.spatialAuthoring, project);
  const occurrence = requireOccurrenceAssociations(own(document.occurrences, request.occurrenceId));
  const context = { project, document, occurrence };
  requireOverviewWriteSet(document, new Set(occurrenceSubtree(document, occurrence.id)));
  let raster: SpatialRasterProposal;
  switch (occurrence.kind) {
    case "object": {
      if (!request.target) throw new SpatialCompileError("target", occurrence.id);
      const previous = occurrence.bindings[0];
      if (previous) {
        const map = structuredClone(own(project.maps, request.target.mapId));
        const target = request.target.rect;
        if (occurrence.bindings.length !== 1 || !isOwnedSpatialBinding(previous) || previous.mapId !== map.id
          || previous.rect.x !== target.x || previous.rect.y !== target.y || previous.rect.width !== target.width || previous.rect.height !== target.height
          || spatialRasterDigest(map, previous) !== previous.contentDigest) throw new SpatialCompileError("ownership", occurrence.id);
        const object = placedObject(occurrence, target, true);
        map.events = map.events.filter(event => !previous.eventIds.includes(event.id));
        raster = { map, entry: request.target.entry, rect: target, objects: [object], ports: objectPorts(object), omitted: [] };
      } else {
        raster = compileObjects(context, request.target);
      }
      break;
    }
    case "space":
      if (request.target) throw new SpatialCompileError("target", `${occurrence.id}: spaces generate their own map`);
      raster = compileSpaces(context);
      requireSpaceOwnership(context, raster);
      break;
    case "place":
      if (request.target) throw new SpatialCompileError("target", occurrence.id);
      return compilePlaces(context);
    case "region":
      if (request.target) throw new SpatialCompileError("target", occurrence.id);
      return compileRegions(context);
    case "world":
      if (request.target) throw new SpatialCompileError("target", occurrence.id);
      return compileWorlds(context);
    default: return assertNever(occurrence);
  }
  const members = new Set([occurrence.id, ...raster.objects.map(object => object.occurrence.id), ...raster.omitted]);
  if (document.connections.some(link => members.has(link.from.occurrenceId) || members.has(link.to.occurrenceId))) {
    throw new SpatialCompileError("connection", `${occurrence.id}: explicit connections require the connection compiler`);
  }
  for (const child of Object.values(document.occurrences)) {
    if (child.id !== occurrence.id && members.has(child.id) && child.bindings.some(isOwnedSpatialBinding)) {
      throw new SpatialCompileError("ownership", child.id);
    }
  }
  const previousEventIds = new Set(raster.map.events.map(event => event.id));
  validateRasterAccess(project, raster);
  compileObjectEvents(raster);
  const eventIds = raster.map.events.filter(event => !previousEventIds.has(event.id)).map(event => event.id);
  const extent = { mapId: raster.map.id, rect: raster.rect, ports: raster.ports, eventIds, connectionIds: [] };
  const binding: SpatialCompiledBinding = { ...extent, contentDigest: spatialRasterDigest(raster.map, extent) };
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences, [occurrence.id]: { ...occurrence, bindings: [binding] } };
  for (const object of raster.objects) {
    if (object.occurrence.id === occurrence.id) continue;
    occurrences[object.occurrence.id] = { ...object.occurrence, bindings: [{ kind: "projection", mapId: raster.map.id,
      rect: object.rect, ports: objectPorts(object) }] };
  }
  for (const id of raster.omitted) occurrences[id] = { ...own(document.occurrences, id), bindings: [] };
  project.maps[raster.map.id] = raster.map;
  if (!containsMap(project.mapTree, raster.map.id)) appendToTree(project.mapTree, raster.map.id);
  project.spatialAuthoring = { ...document, occurrences };
  // Full project IO validates map data and the real owned/projection/reference contracts together.
  return deserialize(JSON.stringify(project));
}
