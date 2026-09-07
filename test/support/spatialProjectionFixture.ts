import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBlankProject } from "../../src/project/defaults/defaultProject";
import { deserialize } from "../../src/project/io";
import { findOccurrenceChildId, own, resolveOccurrencePortId, spatialId } from "../../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../../src/project/spatial/duplicate";
import { emptySpatialLibrary } from "../../src/project/spatial/resolve";
import seed7 from "../fixtures/spatial-projections/seed-7.json";
import seed19 from "../fixtures/spatial-projections/seed-19.json";
import seed31 from "../fixtures/spatial-projections/seed-31.json";

/** Saved parent probe output, never compiler-shaped output manufactured by this test. */
export function savedProjectionInput(seed: 7 | 19 | 31 = 7) {
  const saved = { 7: seed7, 19: seed19, 31: seed31 }[seed];
  const blank = createBlankProject();
  const project = deserialize(JSON.stringify({ ...blank, maps: { ...blank.maps, [saved.map.id]: saved.map }, spatialAuthoring: saved.spatialAuthoring }));
  const document = project.spatialAuthoring;
  assert.ok(document);
  const root = own(document.occurrences, "space-occurrence");
  const childId = findOccurrenceChildId(document, root.id, { slotId: spatialId("stair-slot"), index: 0 });
  assert.ok(childId);
  const child = own(document.occurrences, childId);
  const map = own(project.maps, saved.map.id);
  const point = { x: 7, y: 11 };
  const parentPort = { portId: resolveOccurrencePortId(root, spatialId("space-entry")), ...point };
  const childPort = { portId: resolveOccurrencePortId(child, spatialId("stair-anchor")), ...point };
  const projection = { kind: "projection", mapId: map.id, rect: { ...point, width: 1, height: 1 }, ports: [childPort] } as const;
  const owned = { mapId: map.id, rect: { x: 0, y: 0, width: map.width, height: map.height },
    ports: [parentPort], eventIds: [], connectionIds: [], contentDigest: createHash("sha256").update(JSON.stringify({ map, ports: [parentPort] })).digest("hex") };
  return { project, document, root, child, map, projection, owned, parentPort, childPort };
}

/** Lifecycle fixtures intentionally remove live designs; frozen associations stay authoritative. */
export function projectionFixture() {
  const saved = savedProjectionInput();
  const { root, child, projection, owned } = saved;
  const project = { ...saved.project, maps: { ...saved.project.maps, [saved.map.id]: { ...saved.map, events: [
    { id: "owned-event", x: 7, y: 11, trigger: { kind: "action" } as const, commands: [] },
    { id: "unmanaged-event", x: 8, y: 11, trigger: { kind: "action" } as const, commands: [] },
  ] } } };
  const copied = duplicateSpatialOccurrence(saved.document, project, { occurrenceId: child.id, rootId: "peer-projection", externalConnections: "omit" });
  const expanded = duplicateSpatialOccurrence(copied, project, { occurrenceId: child.id, rootId: "unrelated-owner", externalConnections: "omit" });
  const peer = own(expanded.occurrences, "peer-projection");
  const other = own(expanded.occurrences, "unrelated-owner");
  const peerProjection = { ...projection, ports: [{ ...saved.childPort, portId: resolveOccurrencePortId(peer, spatialId("stair-anchor")) }] };
  const links = [child, peer].map(target => ({ id: spatialId(`link-${target.id}`),
    from: { occurrenceId: root.id, portId: saved.parentPort.portId },
    to: { occurrenceId: target.id, portId: resolveOccurrencePortId(target, spatialId("stair-anchor")) }, bidirectional: true }));
  const rootOwned = { ...owned, eventIds: ["owned-event"], connectionIds: links.map(link => link.id),
    contentDigest: createHash("sha256").update(JSON.stringify({ map: own(project.maps, saved.map.id), ports: owned.ports })).digest("hex") };
  const document = { ...expanded, library: emptySpatialLibrary(), connections: links, occurrences: {
    ...expanded.occurrences, [root.id]: { ...root, bindings: [rootOwned] },
    [child.id]: { ...child, bindings: [projection] }, [peer.id]: { ...peer, bindings: [peerProjection] },
    [other.id]: { ...other, bindings: [{ ...owned, mapId: project.startMapId, rect: { x: 1, y: 1, width: 1, height: 1 }, ports: [] }] },
  } };
  return { ...saved, project, document, peer, other, rootOwned, peerProjection, links };
}
