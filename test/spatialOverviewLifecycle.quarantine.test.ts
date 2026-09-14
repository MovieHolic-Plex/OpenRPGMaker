import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own, spatialId } from "../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../src/project/spatial/duplicate";
import { inspectOverviewEntryChanges } from "../src/project/spatial/overviewOwnership";
import { deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialOccurrenceDeletion } from "../src/project/spatial/ownership";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";

describe("overview ownership consumers", () => {
  it("remaps declaring identity when an overview tree is duplicated", () => {
    // Given: a compiled tree with opaque route associations.
    const { complete } = geographyOutputContract(109);
    // When: duplicate through the public domain operation.
    const copied = duplicateSpatialOccurrence(complete.spatialAuthoring, complete,
      { occurrenceId: geographyRoot, rootId: "__proto__", externalConnections: "omit" });
    // Then: the copied route belongs to the copied overview and no copied artifacts remain.
    const link = copied.connections.find(link => link.overviewRoute?.occurrenceId === "__proto__");
    expect(link?.overviewRoute?.localConnectionId).toBe("road");
    expect(own(copied.occurrences, spatialId("__proto__")).bindings).toEqual([]);
  });
  it("releases entry proofs without releasing output or route identity when a child is detached", () => {
    // Given: a child referenced by a surviving overview pair.
    const { complete, markers } = geographyOutputContract(109);
    const target = markers[0];
    if (!target) throw new TypeError("Missing marker");
    const before = serialize(complete);
    const original = own(complete.spatialAuthoring.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    if (!original) throw new TypeError("Missing owner");
    // When: detach the target subtree's ordinary bindings.
    const detached = detachSpatialOccurrence(complete.spatialAuthoring, complete, target.endpoint.occurrenceId);
    // Then: neither half-proven route bookkeeping nor unauthorized surviving markers remain.
    const binding = own(detached.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    expect(binding?.overviewEntries).toBeUndefined();
    expect(binding?.connectionIds).toEqual([]);
    expect(detached.connections).toEqual(complete.spatialAuthoring.connections);
    expect(binding?.contentDigest).toBe(original.contentDigest);
    expect(serialize(complete)).toBe(before);
    if (!binding) throw new TypeError("Missing surviving raster");
    expect(spatialRasterDigest(own(complete.maps, binding.mapId), binding)).toBe(original.contentDigest);
  });
  it("reports exact entering and reverse owners when inspecting an incoming dependency", () => {
    // Given: a child landing whose reverse event is owned by a descendant raster.
    const { complete, markers } = geographyOutputContract(109);
    const target = markers[0];
    if (!target) throw new TypeError("Missing marker");
    // When: inspect before deletion.
    const impact = inspectSpatialOccurrenceDeletion(complete.spatialAuthoring, complete, target.endpoint.occurrenceId);
    // Then: the external raster is not erasable; only its exact entry-event impact is exposed.
    expect(impact.overviewEntries).toEqual(expect.arrayContaining([expect.objectContaining({ occurrenceId: geographyRoot,
      mapId: target.marker.mapId, eventId: `contract-enter:${target.endpoint.occurrenceId}`,
      returnEventId: `contract-return:${target.endpoint.occurrenceId}`, returnMapId: target.landing.mapId })]));
    expect(impact.overviewEntries).toHaveLength(2);
    expect(impact.artifacts.some(artifact => artifact.occurrenceId === geographyRoot)).toBe(false);
  });
  it("prunes dependent metadata while retaining map output when deletion explicitly removes dependencies", () => {
    // Given: an explicitly reviewed removal policy.
    const { complete, markers } = geographyOutputContract(109);
    const target = markers[0];
    if (!target) throw new TypeError("Missing marker");
    const before = serialize(complete);
    // When: domain-only removal, not an application artifact transaction.
    const removed = deleteSpatialOccurrence(complete.spatialAuthoring, complete,
      { occurrenceId: target.endpoint.occurrenceId, externalConnections: "remove" });
    // Then: logical dependencies disappear without map mutations.
    expect(removed.connections).toEqual([]);
    expect(own(removed.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding)?.overviewEntries).toBeUndefined();
    expect(serialize(complete)).toBe(before);
  });
  it("reports an exact entry-event impact when a proposal changes the referenced landing only", () => {
    // Given: the same semantic tuple and marker now resolve to a different local coordinate.
    const { complete, markers } = geographyOutputContract(109);
    const target = markers[0];
    if (!target) throw new TypeError("Missing marker");
    const document = complete.spatialAuthoring;
    const child = own(document.occurrences, target.endpoint.occurrenceId);
    const proposed = { ...document, occurrences: { ...document.occurrences, [child.id]: { ...child,
      bindings: child.bindings.map(binding => ({ ...binding, ports: binding.ports.map(port =>
        port.portId === target.endpoint.portId ? { ...port, x: port.x + 1 } : port) })) } } };
    // When: compare the logical proposal before task11 can preflight an artifact transaction.
    const impacts = inspectOverviewEntryChanges(document, proposed);
    // Then
    expect(impacts.map(impact => impact.eventId)).toEqual([`contract-enter:${target.endpoint.occurrenceId}`]);
  });
  it("rejects unmanaged retained child output when recompiling after detach", () => {
    // Given
    const { complete, markers } = geographyOutputContract(109);
    const target = markers[0];
    if (!target) throw new TypeError("Missing marker");
    const candidate = { ...complete, spatialAuthoring: detachSpatialOccurrence(complete.spatialAuthoring, complete, target.endpoint.occurrenceId) };
    const before = serialize(candidate);
    // When / Then
    expect(() => compileSpatialOccurrence(candidate, { occurrenceId: target.endpoint.occurrenceId }))
      .toThrowError(expect.objectContaining({ code: "ownership" }));
    expect(serialize(candidate)).toBe(before);
  });
  it("rejects before cleanup when a partial recompile would release an externally used landing", () => {
    // Given: the outside overview is not in the child compiler's write set.
    const { complete, markers } = geographyOutputContract(109);
    const target = markers[0];
    if (!target) throw new TypeError("Missing marker");
    const before = serialize(complete);
    // When: request a child-only recompile.
    const compile = () => compileSpatialOccurrence(complete, { occurrenceId: target.endpoint.occurrenceId });
    // Then: ownership preflight rejects without any mutation.
    expect(compile).toThrowError(expect.objectContaining({ code: "ownership" }));
    expect(serialize(complete)).toBe(before);
  });
});
