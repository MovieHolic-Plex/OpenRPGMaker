import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "@/project/io";
import { validateProjectV4 } from "@/project/io/shape";
import { own, spatialId } from "@/project/spatial/domain";
import { duplicateSpatialOccurrence } from "@/project/spatial/duplicate";
import { deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialOccurrenceDeletion, occurrenceSubtree } from "@/project/spatial/ownership";
import { spatialBindingFixture } from "./support/spatialSchemaFixture";
import { projectionFixture, savedProjectionInput } from "./support/spatialProjectionFixture";

describe("non-owning compiled projections", () => {
  it.each([serialize, serializePretty])("retains authored coincident coordinates when full-space ownership and child projection roundtrip", encode => {
    // Given
    const { project, document } = projectionFixture();
    // When
    const loaded = deserialize(encode(deserialize(JSON.stringify({ ...project, spatialAuthoring: document }))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(document);
    expect(loaded.version).toBe(4);
    expect(loaded.spatialAuthoring?.version).toBe(1);
  });

  it("rejects coincident owned rectangles when the child still claims raster ownership", () => {
    // Given: even a parent-child relationship must not waive ownership exclusivity.
    const { project, document, root, child, projection, owned } = savedProjectionInput();
    const overlapping = { ...document, occurrences: { ...document.occurrences,
      [root.id]: { ...root, bindings: [owned] }, [child.id]: { ...child, bindings: [{ ...owned, rect: projection.rect, ports: projection.ports }] },
    } };
    // When
    const load = () => deserialize(JSON.stringify({ ...project, spatialAuthoring: overlapping }));
    // Then
    expect(load).toThrow(`occurrences.${child.id}.bindings[0].rect: overlapping ownership`);
  });

  it("accepts two logical projections at one cell when neither owns raster", () => {
    // Given
    const fixture = projectionFixture();
    const document = { ...fixture.document, occurrences: { ...fixture.document.occurrences,
      [fixture.root.id]: { ...fixture.root, bindings: [] },
    } };
    // When
    const loaded = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: document }));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(document);
  });

  it("retains a bounded placement extent when the frozen object has no anchors", () => {
    // Given
    const { project, document, child, projection } = savedProjectionInput();
    const object = own(child.snapshot.library.objects, child.source.id);
    const snapshot = { ...child.snapshot, ports: [], library: { ...child.snapshot.library, objects: { [object.id]: { ...object, anchors: [] } } } };
    const unanchored = { ...document, occurrences: { ...document.occurrences,
      [child.id]: { ...child, snapshot, bindings: [{ ...projection, rect: { x: 6, y: 10, width: 2, height: 2 }, ports: [] }] },
    } };
    // When
    const loaded = deserialize(JSON.stringify({ ...project, spatialAuthoring: unanchored }));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(unanchored);
  });

  it.each([
    { name: "foreign concrete port", patch: { ports: [{ portId: "foreign", x: 7, y: 11 }] }, path: "ports" },
    { name: "port outside extent", patch: { ports: [{ portId: "child-port", x: 8, y: 11 }] }, path: "ports" },
    { name: "missing map", patch: { mapId: "missing" }, path: "mapId" },
    { name: "extent outside map", patch: { rect: { x: 14, y: 11, width: 1, height: 1 } }, path: "rect" },
    { name: "extent crosses map edge", patch: { rect: { x: 13, y: 11, width: 2, height: 1 } }, path: "rect" },
    { name: "negative extent", patch: { rect: { x: -1, y: 11, width: 1, height: 1 } }, path: "rect" },
    { name: "zero extent", patch: { rect: { x: 7, y: 11, width: 0, height: 1 } }, path: "rect.width" },
    { name: "oversized extent", patch: { rect: { x: 7, y: 11, width: 257, height: 1 } }, path: "rect.width" },
    { name: "fractional extent", patch: { rect: { x: 7.5, y: 11, width: 1, height: 1 } }, path: "rect.x" },
    { name: "nonfinite extent", patch: { rect: { x: NaN, y: 11, width: 1, height: 1 } }, path: "rect.x" },
    { name: "unknown kind", patch: { kind: "owned" }, path: "kind" },
    { name: "null kind", patch: { kind: null }, path: "kind" },
    { name: "numeric kind", patch: { kind: 1 }, path: "kind" },
    { name: "present undefined kind", patch: { kind: undefined }, path: "kind" },
    { name: "event authority", patch: { eventIds: [] }, path: "eventIds" },
    { name: "connection authority", patch: { connectionIds: [] }, path: "connectionIds" },
    { name: "digest authority", patch: { contentDigest: "a".repeat(64) }, path: "contentDigest" },
    { name: "undefined event authority", patch: { eventIds: undefined }, path: "eventIds" },
    { name: "unknown field", patch: { arbitrary: {} }, path: "arbitrary" },
  ])("rejects $name when parsing a projection boundary", ({ patch, path }) => {
    // Given
    const { project, document, child, parentPort, childPort, projection } = savedProjectionInput();
    const ports = patch.ports?.map(port => ({ ...port, portId: port.portId === "child-port" ? childPort.portId : parentPort.portId })) ?? projection.ports;
    const candidate = { ...document, occurrences: { ...document.occurrences, [child.id]: { ...child, bindings: [{ ...projection, ...patch, ports }] } } };
    // When: direct shape boundary also sees undefined/NaN rather than JSON dropping them.
    const load = () => validateProjectV4({ ...project, spatialAuthoring: candidate });
    // Then
    expect(load).toThrow(ProjectFormatError);
    expect(load).toThrow(`occurrences.${child.id}.bindings[0].${path}`);
  });

  it.each(["kind", "mapId", "rect", "ports"])("rejects missing %s when a projection is incomplete", field => {
    // Given
    const { project, document, child, projection } = savedProjectionInput();
    const incomplete = Object.fromEntries(Object.entries(projection).filter(([key]) => key !== field));
    const candidate = { ...document, occurrences: { ...document.occurrences, [child.id]: { ...child, bindings: [incomplete] } } };
    // When
    const load = () => deserialize(JSON.stringify({ ...project, spatialAuthoring: candidate }));
    // Then
    expect(load).toThrow(ProjectFormatError);
  });

  it.each(["owned-first", "projection-first", "projection-only"] as const)("rejects duplicate concrete binding when order is %s", order => {
    // Given
    const { project, document, child, projection, owned } = savedProjectionInput();
    const claim = { ...owned, rect: projection.rect, ports: projection.ports };
    const variants = { "owned-first": [claim, projection], "projection-first": [projection, claim], "projection-only": [projection, projection] };
    const candidate = { ...document, occurrences: { ...document.occurrences, [child.id]: { ...child, bindings: variants[order] } } };
    // When
    const load = () => deserialize(JSON.stringify({ ...project, spatialAuthoring: candidate }));
    // Then
    expect(load).toThrow(`occurrences.${child.id}.bindings[1].ports: duplicate port binding`);
  });

  it.each([serialize, serializePretty])("preserves old untagged binding values when legacy IO roundtrips", encode => {
    // Given
    const { project, document } = spatialBindingFixture();
    // When
    const loaded = deserialize(encode(deserialize(JSON.stringify({ ...project, spatialAuthoring: document }))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(document);
    expect(Object.hasOwn(own(loaded.spatialAuthoring?.occurrences ?? {}, "occ-a").bindings[0] ?? {}, "kind")).toBe(false);
  });

  it("separates projection metadata from erasable artifacts when inspecting subtree deletion", () => {
    // Given
    const { project, document, root, child, rootOwned, projection } = projectionFixture();
    // When
    const impact = inspectSpatialOccurrenceDeletion(document, project, root.id);
    // Then
    expect(impact.artifacts).toStrictEqual([{ occurrenceId: root.id, binding: rootOwned }]);
    expect(impact.projections).toStrictEqual([{ occurrenceId: child.id, binding: projection }]);
  });

  it("prunes only owned link bookkeeping when deleting a projected child without its live source", () => {
    // Given
    const { project, document, root, child, peer, other, rootOwned, links } = projectionFixture();
    const before = structuredClone({ project, document });
    // When
    const result = deleteSpatialOccurrence(document, project, { occurrenceId: child.id, externalConnections: "remove" });
    // Then
    expect(result.occurrences[child.id]).toBeUndefined();
    expect(own(result.occurrences, root.id).bindings).toStrictEqual([{ ...rootOwned, connectionIds: [links[1]?.id] }]);
    expect(result.connections).toStrictEqual([links[1]]);
    expect(result.occurrences[peer.id]).toStrictEqual(document.occurrences[peer.id]);
    expect(result.occurrences[other.id]).toStrictEqual(document.occurrences[other.id]);
    expect({ project, document }).toStrictEqual(before);
  });

  it("rejects deletion with external navigation when removal was not authorized", () => {
    // Given
    const { project, document, child } = projectionFixture();
    // When
    const remove = () => deleteSpatialOccurrence(document, project, { occurrenceId: child.id, externalConnections: "reject" });
    // Then
    expect(remove).toThrow("external-connection");
  });

  it("clears both variants when detaching without a live source", () => {
    // Given
    const { project, document, root, child, peer, other } = projectionFixture();
    const before = structuredClone({ project, document });
    // When
    const detached = detachSpatialOccurrence(document, project, root.id);
    // Then
    expect(detached).toStrictEqual({ ...document, occurrences: { ...document.occurrences,
      [root.id]: { ...own(document.occurrences, root.id), bindings: [] }, [child.id]: { ...own(document.occurrences, child.id), bindings: [] },
    } });
    expect(detached.occurrences[peer.id]).toStrictEqual(document.occurrences[peer.id]);
    expect(detached.occurrences[other.id]).toStrictEqual(document.occurrences[other.id]);
    expect({ project, document }).toStrictEqual(before);
  });

  it("clears copied bindings and remaps logical connections when duplicating without a live source", () => {
    // Given
    const { project, document, root, child } = projectionFixture();
    const before = structuredClone({ project, document });
    // When
    const copy = duplicateSpatialOccurrence(document, project, { occurrenceId: root.id, rootId: "copy", externalConnections: "omit" });
    // Then
    const ids = occurrenceSubtree(copy, spatialId("copy"));
    expect(ids).toHaveLength(2);
    expect(ids.flatMap(id => own(copy.occurrences, id).bindings)).toStrictEqual([]);
    for (const original of Object.values(document.occurrences)) expect(copy.occurrences[original.id]).toStrictEqual(original);
    const copiedChild = Object.values(copy.occurrences).find(value => value.parentId === "copy");
    assert.ok(copiedChild);
    expect(copiedChild.snapshot.library).toStrictEqual(child.snapshot.library);
    expect(copiedChild.snapshot.kitCells).toStrictEqual(child.snapshot.kitCells);
    expect(copy.connections.slice(0, document.connections.length)).toStrictEqual(document.connections);
    const internal = copy.connections.slice(document.connections.length);
    expect(internal).toHaveLength(1);
    expect(internal[0]?.from.occurrenceId).toBe("copy");
    expect(internal[0]?.to.occurrenceId).toBe(copiedChild.id);
    expect(internal[0]?.to.portId).toBe(copiedChild.snapshot.ports[0]?.id);
    expect({ project, document }).toStrictEqual(before);
  });
});
