import { createHouseDoorStepEvent } from "../../src/editor/houseInteriors";
import { spatialRasterDigest } from "../../src/editor/spatial/compilerValidation";
import { MAP_GEN_TOOLS } from "../../src/editor/tools/generateMapTool";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { own, requireOccurrenceAssociations, resolveOccurrencePortId, spatialId } from "../../src/project/spatial/domain";
import type { SpatialConnection, SpatialOccurrence, SpatialOwnedBinding } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";
import { geographyFixture, geographyRoot } from "./spatialGeographyFixture";
import { fixtureDocument, replaceOccurrence } from "./spatialSpaceCompilerFixture";

export function overviewBinding(project: Project): SpatialOwnedBinding {
  const binding = own(fixtureDocument(project).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
  if (!binding) throw new TypeError("Missing overview fixture binding");
  return binding;
}
export function updateOverview(project: Project, update: (binding: SpatialOwnedBinding) => SpatialOwnedBinding): Project {
  const root = own(fixtureDocument(project).occurrences, geographyRoot);
  return replaceOccurrence(project, { ...root, bindings: root.bindings.map(binding => isOwnedSpatialBinding(binding) ? update(binding) : binding) });
}
export function updateRoute(project: Project, update: (link: SpatialConnection) => SpatialConnection): Project {
  const document = fixtureDocument(project);
  return { ...project, spatialAuthoring: { ...document, connections: document.connections.map(update) } };
}
/** World-entry-only diagnostic. Existing supported World raster generation; no geography compiler. */
export function worldEntryOutput(): Project {
  const project = geographyFixture("world", 109);
  const original = fixtureDocument(project);
  const initialRoot = requireOccurrenceAssociations(own(original.occurrences, geographyRoot));
  const worlds = Object.fromEntries(Object.entries(original.library.worlds).map(([id, world]) => [id, { ...world, connections: [] }]));
  const root = { ...initialRoot, snapshot: { ...initialRoot.snapshot, library: { ...initialRoot.snapshot.library, worlds } } };
  const document = { ...original, library: { ...original.library, worlds }, occurrences: { ...original.occurrences, [root.id]: root } };
  const child = Object.values(document.occurrences).find(child => child.parentId === root.id && child.parentSlot?.slotId === "first");
  if (!child) throw new TypeError("Missing selected world child");
  const generator = MAP_GEN_TOOLS.find(tool => tool.name === "generate_map");
  if (!generator) throw new TypeError("Missing supported map generator");
  const marker = { mapId: "world-overview", x: child.x, y: child.y };
  const landing = { mapId: "region-overview", x: 2, y: 8 };
  for (const point of [marker, landing]) generator.run(project, { id: point.mapId, tilesetId: "easyrpg_chipset_world",
    theme: "village", width: 32, height: 24, seed: 109, chokepoints: 0,
    entrance: { x: point.x, y: point.y }, pois: [], bgm: { mode: "none" } });
  const target = { occurrenceId: child.id, portId: resolveOccurrencePortId(child, spatialId("entry")) };
  const eventId = "__proto__";
  const returnEventId = "constructor";
  const sourceMap = own(project.maps, marker.mapId);
  const childMap = own(project.maps, landing.mapId);
  sourceMap.events.push(createHouseDoorStepEvent({ eventId, x: marker.x, y: marker.y,
    interiorMapId: landing.mapId, entryX: landing.x, entryY: landing.y }));
  childMap.events.push(createHouseDoorStepEvent({ eventId: returnEventId, x: landing.x, y: landing.y,
    interiorMapId: marker.mapId, entryX: marker.x, entryY: marker.y }));
  const rootExtent = { mapId: marker.mapId, rect: { x: 0, y: 0, width: 32, height: 24 }, ports: [], eventIds: [eventId], connectionIds: [],
    overviewEntries: [{ target, x: marker.x, y: marker.y, eventId, returnEventId }] };
  const childExtent = { mapId: landing.mapId, rect: rootExtent.rect, ports: [{ portId: target.portId, x: landing.x, y: landing.y }],
    eventIds: [returnEventId], connectionIds: [] };
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences,
    [root.id]: { ...root, bindings: [{ ...rootExtent, contentDigest: spatialRasterDigest(sourceMap, rootExtent) }] },
    [child.id]: { ...child, bindings: [{ ...childExtent, contentDigest: spatialRasterDigest(childMap, childExtent) }] } };
  return { ...project, spatialAuthoring: { ...document, connections: [], occurrences }, mapConnections: [
    { id: eventId, from: marker, to: landing, playerEnabled: true, npcEnabled: true },
    { id: returnEventId, from: landing, to: marker, playerEnabled: true, npcEnabled: true },
  ] };
}
