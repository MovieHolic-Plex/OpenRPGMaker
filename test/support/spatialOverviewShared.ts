import { createHouseDoorStepEvent } from "../../src/editor/houseInteriors";
import { spatialRasterDigest } from "../../src/editor/spatial/compilerValidation";
import { MAP_GEN_TOOLS } from "../../src/editor/tools/generateMapTool";
import { own, requireOccurrenceAssociations, resolveOccurrencePortId, spatialId } from "../../src/project/spatial/domain";
import type { SpatialConnection, SpatialOccurrence, SpatialOverviewEntry } from "../../src/project/spatial/types";
import { geographyRoot } from "./spatialGeographyFixture";
import { overviewBinding, worldEntryOutput } from "./spatialOverviewFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

/** A-B-C with B selected by the world and shared by two distinct routes. */
export function sharedWorldOutput() {
  const project = worldEntryOutput();
  const document = fixtureDocument(project);
  const root = requireOccurrenceAssociations(own(document.occurrences, geographyRoot));
  const world = own(root.snapshot.library.worlds, root.source.id);
  const first = Object.values(document.occurrences).find(child => child.parentId === root.id && child.parentSlot?.slotId === "first");
  const second = Object.values(document.occurrences).find(child => child.parentId === root.id && child.parentSlot?.slotId === "second");
  if (!first || !second || second.parentSlot === undefined) throw new TypeError("Missing shared world children");
  const third: SpatialOccurrence = { ...second, id: spatialId("third-child"), parentId: root.id,
    parentSlot: { slotId: spatialId("third-slot"), index: 0 }, x: 16, y: 18, snapshot: { ...second.snapshot,
      ports: second.snapshot.ports.map(port => ({ ...port, id: spatialId("third-port") })) }, bindings: [] };
  const children = [first, second, third];
  const endpoints = children.map(child => ({ occurrenceId: child.id, portId: resolveOccurrencePortId(child, spatialId("entry")) }));
  const connections: SpatialConnection[] = [];
  const locals = children.slice(1).map((child, index) => {
    const from = endpoints[index];
    const to = endpoints[index + 1];
    const previous = children[index];
    if (!from || !to || !previous?.parentSlot || !child.parentSlot) throw new TypeError("Missing shared route");
    const id = spatialId(`authored:${index}`);
    connections.push({ id: spatialId(`opaque:${index}`), from, to, bidirectional: true,
      overviewRoute: { occurrenceId: root.id, localConnectionId: id } });
    return { id, from: { childId: previous.parentSlot.slotId, portId: spatialId("entry") },
      to: { childId: child.parentSlot.slotId, portId: spatialId("entry") }, bidirectional: true };
  });
  const updatedWorld = { ...world, regions: [...world.regions, { id: spatialId("third-slot"), source: { kind: "region" as const, id: third.source.id },
    x: third.x, y: third.y, level: 0 }], connections: locals, entryPort: { childId: spatialId("second"), portId: spatialId("entry") } };
  const binding = overviewBinding(project);
  const overviewEntries: SpatialOverviewEntry[] = [...binding.overviewEntries ?? []];
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences, [third.id]: third };
  const generator = MAP_GEN_TOOLS.find(tool => tool.name === "generate_map");
  if (!generator) throw new TypeError("Missing supported generator");
  const overview = own(project.maps, binding.mapId);
  for (const child of [second, third]) {
    const mapId = `shared-map:${child.id}`;
    generator.run(project, { id: mapId, tilesetId: "easyrpg_chipset_world", theme: "village", width: 32, height: 24,
      seed: 109, chokepoints: 0, entrance: { x: 2, y: 8 }, pois: [], bgm: { mode: "none" } });
    const map = own(project.maps, mapId);
    const eventId = `enter:${child.id}`;
    const returnEventId = `return:${child.id}`;
    const target = { occurrenceId: child.id, portId: resolveOccurrencePortId(child, spatialId("entry")) };
    overviewEntries.push({ target, x: child.x, y: child.y, eventId, returnEventId });
    overview.events.push(createHouseDoorStepEvent({ eventId, x: child.x, y: child.y, interiorMapId: map.id, entryX: 2, entryY: 8 }));
    map.events.push(createHouseDoorStepEvent({ eventId: returnEventId, x: 2, y: 8, interiorMapId: overview.id, entryX: child.x, entryY: child.y }));
    project.mapConnections?.push({ id: eventId, from: { mapId: overview.id, x: child.x, y: child.y }, to: { mapId, x: 2, y: 8 }, playerEnabled: true, npcEnabled: true },
      { id: returnEventId, from: { mapId, x: 2, y: 8 }, to: { mapId: overview.id, x: child.x, y: child.y }, playerEnabled: true, npcEnabled: true });
    const extent = { mapId, rect: binding.rect, ports: [{ portId: target.portId, x: 2, y: 8 }], eventIds: [returnEventId], connectionIds: [] };
    occurrences[child.id] = { ...child, bindings: [{ ...extent, contentDigest: spatialRasterDigest(map, extent) }] };
  }
  const extent = { ...binding, overviewEntries, connectionIds: connections.map(link => link.id), eventIds: overviewEntries.map(entry => entry.eventId) };
  occurrences[root.id] = { ...root, snapshot: { ...root.snapshot, library: { ...root.snapshot.library, worlds: { [world.id]: updatedWorld } } },
    bindings: [{ ...extent, contentDigest: spatialRasterDigest(overview, extent) }] };
  return { ...project, spatialAuthoring: { ...document, connections, occurrences, library: { ...document.library, worlds: { [world.id]: updatedWorld } } } };
}
