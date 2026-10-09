import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { MAP_GEN_TOOLS } from "../../src/editor/tools/generateMapTool";
import { resolveCompiledPort } from "../../src/editor/spatial/compileConnections";
import { spatialRasterDigest } from "../../src/editor/spatial/compilerValidation";
import { createHouseDoorStepEvent } from "../../src/editor/houseInteriors";
import { serialize } from "../../src/project/io";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { own } from "../../src/project/spatial/domain";
import type { SpatialOccurrence } from "../../src/project/spatial/types";
import type { MapConnection, Project } from "../../src/project/types";
import { geographyFixture, geographyRegion, geographyRoot } from "./spatialGeographyFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

/** Diagnostic output witness ONLY. This is not a geography compiler or shipped fixture.
 * Places are compiled by the exact task9 public seam. The candidate overview is rasterized
 * by generate_map's supported World profile. Only binding metadata varies by control.
 */
export function geographyOutputContract(seed = 7) {
  const input = geographyFixture("region", seed);
  const before = serialize(input);
  const declared = fixtureDocument(input).connections;
  let compiled: Project = input;
  const children = Object.values(fixtureDocument(input).occurrences).filter(child => child.parentId === geographyRoot);
  for (const child of children) {
    const output = compileSpatialOccurrence(compiled, { occurrenceId: child.id });
    compiled = { ...output, spatialAuthoring: fixtureDocument(output) };
  }
  const document = fixtureDocument(compiled);
  const region = own(document.library.regions, geographyRegion);
  const root = own(document.occurrences, geographyRoot);
  const generator = MAP_GEN_TOOLS.find(tool => tool.name === "generate_map");
  if (!generator) throw new TypeError("Missing existing map generator");
  generator.run(compiled, { id: "geography-contract-overview", tilesetId: region.terrain.tilesetId,
    theme: "village", width: region.terrain.width, height: region.terrain.height,
    seed, chokepoints: 0, entrance: { x: 5, y: 8 }, pois: [{ x: 25, y: 8 }], bgm: { mode: "none" } });
  const map = own(compiled.maps, "geography-contract-overview");
  const navigation: MapConnection[] = [];
  const occurrences: Record<string, SpatialOccurrence> = { ...document.occurrences };
  const markers = children.map(child => {
    const endpoint = declared.flatMap(link => [link.from, link.to]).find(endpoint => endpoint.occurrenceId === child.id);
    if (!endpoint) throw new TypeError("Missing declared child endpoint");
    const landing = resolveCompiledPort({ project: compiled, occurrences }, endpoint);
    const marker = { mapId: map.id, x: child.x, y: child.y };
    const inwardId = `contract-enter:${child.id}`;
    const outwardId = `contract-return:${child.id}`;
    map.events.push(createHouseDoorStepEvent({ eventId: inwardId, x: marker.x, y: marker.y,
      interiorMapId: landing.mapId, entryX: landing.x, entryY: landing.y }));
    const childMap = own(compiled.maps, landing.mapId);
    childMap.events.push(createHouseDoorStepEvent({ eventId: outwardId, x: landing.x, y: landing.y,
      interiorMapId: marker.mapId, entryX: marker.x, entryY: marker.y }));
    navigation.push({ id: inwardId, from: marker, to: landing, playerEnabled: true, npcEnabled: true },
      { id: outwardId, from: landing, to: marker, playerEnabled: true, npcEnabled: true });
    const owner = Object.values(occurrences).find(occurrence => occurrence.bindings.some(binding =>
      isOwnedSpatialBinding(binding) && binding.mapId === landing.mapId));
    if (!owner) throw new TypeError("Missing real task9 raster owner");
    occurrences[owner.id] = { ...owner, bindings: owner.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding) || binding.mapId !== childMap.id) return binding;
      const extent = { ...binding, eventIds: [...binding.eventIds, outwardId],
        connectionIds: declared.filter(link => link.from.occurrenceId === child.id || link.to.occurrenceId === child.id).map(link => link.id) };
      return { ...extent, contentDigest: spatialRasterDigest(childMap, extent) };
    }) };
    return { endpoint, marker, landing };
  });
  const extent = { mapId: map.id, rect: { x: 0, y: 0, width: map.width, height: map.height },
    ports: root.snapshot.ports.map(port => ({ portId: port.id, x: port.x, y: port.y })),
    eventIds: map.events.map(event => event.id), connectionIds: declared.map(link => link.id),
    overviewEntries: markers.map(({ endpoint, marker }) => ({ target: endpoint, x: marker.x, y: marker.y,
      eventId: `contract-enter:${endpoint.occurrenceId}`, returnEventId: `contract-return:${endpoint.occurrenceId}` })) };
  occurrences[root.id] = { ...root, bindings: [{ ...extent, contentDigest: spatialRasterDigest(map, extent) }] };
  const complete = { ...compiled, mapConnections: navigation,
    spatialAuthoring: { ...document, connections: declared, occurrences } };
  // Numeric output is IDENTICAL. Omitting overview connection bookkeeping is not a fix.
  const incompleteControl = { ...complete, spatialAuthoring: { ...complete.spatialAuthoring, occurrences: {
    ...occurrences, [root.id]: { ...own(occurrences, root.id), bindings: [{ ...extent, connectionIds: [],
      contentDigest: spatialRasterDigest(map, extent) }] },
  } } };
  // Existing projection grammar cannot expose the same concrete child port on both maps.
  const duplicatedPorts = { ...complete, spatialAuthoring: { ...complete.spatialAuthoring, occurrences: {
    ...occurrences, ...Object.fromEntries(markers.map(({ endpoint, marker }) => {
      const child = own(occurrences, endpoint.occurrenceId);
      return [child.id, { ...child, bindings: [...child.bindings,
        { kind: "projection", mapId: map.id, rect: extent.rect, ports: [{ portId: endpoint.portId, x: marker.x, y: marker.y }] }] }];
    })),
  } } };
  return { input, before, complete, incompleteControl, duplicatedPorts, markers };
}
