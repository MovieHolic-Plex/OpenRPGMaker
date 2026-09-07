import { own, requireOccurrenceAssociations, spatialId } from "../../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import type { SpatialConnection, SpatialOccurrence } from "../../src/project/spatial/types";
import { projectionFixture } from "./spatialProjectionFixture";

/** Independent endpoints (including an external root), opaque persisted identities,
 * two concrete child ports with identical labels, and unrelated bookkeeping.
 */
export function connectionOwnershipFixture() {
  const saved = projectionFixture();
  const aliases = new Map([
    [saved.root.id, spatialId("__proto__")], [saved.child.id, spatialId("constructor")],
    [saved.peer.id, spatialId("terrainTemplates")], [saved.other.id, spatialId("opaque/external")],
  ]);
  const concrete = new Map(Object.values(saved.document.occurrences).flatMap((occurrence, index) =>
    occurrence.snapshot.ports.map((port, portIndex) => [port.id, spatialId(`opaque.port/${index}/${portIndex}`)] as const)));
  const aliasRecords = Object.fromEntries(aliases);
  const portRecords = Object.fromEntries(concrete);
  const occurrences = Object.fromEntries(Object.values(saved.document.occurrences).map(value => {
    const occurrence = requireOccurrenceAssociations(value);
    const id = own(aliasRecords, occurrence.id);
    const parent = occurrence.parentSlot === null ? { parentId: null, parentSlot: null } as const
      : { parentId: own(aliasRecords, occurrence.parentId), parentSlot: occurrence.parentSlot };
    return [id, { ...occurrence, ...parent, id,
      snapshot: { ...occurrence.snapshot, ports: occurrence.snapshot.ports.map(port => ({ ...port, id: own(portRecords, port.id) })) },
      bindings: occurrence.bindings.map(binding => ({ ...binding, ports: binding.ports.map(port => ({ ...port, portId: own(portRecords, port.portId) })) })),
    }];
  }));
  const owner = own(occurrences, "__proto__");
  const child = own(occurrences, "constructor");
  const peer = own(occurrences, "terrainTemplates");
  const other = own(occurrences, "opaque/external");
  const endpoint = (occurrence: SpatialOccurrence) => {
    const port = occurrence.snapshot.ports[0];
    if (!port) throw new TypeError("Missing fixture concrete port");
    return { occurrenceId: occurrence.id, portId: port.id };
  };
  const link: SpatialConnection = { id: spatialId("opaque.link/first"), from: endpoint(child), to: endpoint(other), bidirectional: true };
  const unrelated: SpatialConnection = { id: spatialId("opaque.link/retained"), from: endpoint(peer), to: endpoint(other), bidirectional: false };
  const secondLocal = spatialId("second-local");
  const secondPort = spatialId("opaque.port/second");
  const object = own(child.snapshot.library.objects, child.source.id);
  const firstPort = child.snapshot.ports[0];
  if (!firstPort) throw new TypeError("Missing fixture child port");
  const expandedChild = { ...child, snapshot: { ...child.snapshot,
    ports: [...child.snapshot.ports, { ...firstPort, id: secondPort, localPortId: secondLocal }],
    library: { ...child.snapshot.library, objects: { [object.id]: { ...object,
      anchors: [...object.anchors, { id: secondLocal, name: firstPort.name, x: firstPort.x, y: firstPort.y }] } } },
  } };
  const owned = { ...saved.rootOwned, ports: owner.bindings.flatMap(binding => binding.ports), connectionIds: [link.id, unrelated.id] };
  const document = { ...saved.document, rootOccurrenceIds: saved.document.rootOccurrenceIds.map(id => own(aliasRecords, id)),
    connections: [link, unrelated], occurrences: { ...occurrences, [owner.id]: { ...owner, bindings: [owned] }, [child.id]: expandedChild } };
  const project = { ...saved.project, spatialAuthoring: document };
  const projection = expandedChild.bindings[0];
  if (!projection || isOwnedSpatialBinding(projection)) throw new TypeError("Missing fixture projection");
  return { project, document, owner: own(document.occurrences, owner.id), child: expandedChild, peer, other, owned, projection, link, unrelated, secondPort };
}

/** Deliberately invalid wire candidates; only deserialize consumes these values. */
export function connectionRejections() {
  const f = connectionOwnershipFixture();
  const childBindings = (bindings: readonly unknown[]) => ({ ...f.project, spatialAuthoring: { ...f.document,
    occurrences: { ...f.document.occurrences, [f.child.id]: { ...f.child, bindings } } } });
  const ownerBindings = (connectionIds: readonly string[]) => ({ ...f.project, spatialAuthoring: { ...f.document,
    occurrences: { ...f.document.occurrences, [f.owner.id]: { ...f.owner, bindings: [{ ...f.owned, connectionIds }] } } } });
  return [
    { name: "wrong-map", input: childBindings([{ ...f.projection, mapId: f.project.startMapId }]) },
    { name: "absent-projection", input: childBindings([]) },
    { name: "unbound-port", input: childBindings([{ ...f.projection, ports: [] }]) },
    { name: "wrong-projected-port", input: childBindings([{ ...f.projection, ports: f.projection.ports.map(port => ({ ...port, portId: f.secondPort })) }]) },
    { name: "missing-connection", input: ownerBindings(["missing"]) },
    { name: "duplicate-bookkeeping", input: ownerBindings([f.link.id, f.link.id]) },
    { name: "duplicate-projected-port", input: childBindings([f.projection, f.projection]) },
    { name: "projection-connectionIds", input: childBindings([{ ...f.projection, connectionIds: [f.link.id] }]) },
    { name: "projection-eventIds", input: childBindings([{ ...f.projection, eventIds: [] }]) },
    { name: "projection-digest", input: childBindings([{ ...f.projection, contentDigest: f.owned.contentDigest }]) },
    { name: "overlapping-child-ownership", input: childBindings([{ ...f.owned, rect: f.projection.rect, ports: f.projection.ports, eventIds: [] }]) },
    { name: "missing-endpoint", input: { ...f.project, spatialAuthoring: { ...f.document, connections: [{ ...f.link, from: { ...f.link.from, occurrenceId: "missing" } }, f.unrelated] } } },
    { name: "missing-endpoint-port", input: { ...f.project, spatialAuthoring: { ...f.document, connections: [{ ...f.link, from: { ...f.link.from, portId: "missing" } }, f.unrelated] } } },
  ];
}
