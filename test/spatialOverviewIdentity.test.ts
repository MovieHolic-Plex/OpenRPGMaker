import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { checkedDocument, own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../src/project/spatial/duplicate";
import { detachSpatialOccurrence } from "../src/project/spatial/ownership";
import { geographyRegion, geographyRoot } from "./support/spatialGeographyFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

function parallelOverview() {
  const { complete } = geographyOutputContract(109);
  const document = fixtureDocument(complete);
  const root = requireOccurrenceAssociations(own(document.occurrences, geographyRoot));
  const region = own(root.snapshot.library.regions, geographyRegion);
  const route = region.routes[0];
  const link = document.connections[0];
  if (!route || !link) throw new TypeError("Missing fixture route");
  const localIds = [spatialId("road"), spatialId("constructor")];
  const concreteIds = [spatialId("__proto__"), spatialId("terrainTemplates")];
  const routes = localIds.map((id, index) => ({ ...route, id, points: index === 0 ? route.points : [{ x: 5, y: 8 }, { x: 9, y: 13 }, { x: 25, y: 8 }] }));
  const connections = concreteIds.map((id, index) => {
    const localConnectionId = localIds[index];
    if (!localConnectionId) throw new TypeError("Missing local identity");
    return { ...link, id, overviewRoute: { occurrenceId: root.id, localConnectionId } };
  }).reverse();
  const occurrences = Object.fromEntries(Object.values(document.occurrences).map(requireOccurrenceAssociations).reverse().map(occurrence => [occurrence.id, { ...occurrence,
    ...(occurrence.id === root.id ? { snapshot: { ...root.snapshot,
      library: { ...root.snapshot.library, regions: { [region.id]: { ...region, routes: routes.reverse() } } } } } : {}),
    bindings: occurrence.bindings.map(binding => isOwnedSpatialBinding(binding) ? { ...binding,
      connectionIds: binding.connectionIds.includes(link.id) ? concreteIds : binding.connectionIds } : binding),
  }]));
  return { ...complete, spatialAuthoring: { ...document, occurrences, connections } };
}

describe("opaque overview identity", () => {
  it.each([serialize, serializePretty])("preserves parallel equal-endpoint routes when reloading %s", save => {
    // Given: reordered opaque concrete IDs and distinct frozen polylines.
    const input = parallelOverview();
    // When
    const loaded = deserialize(save(input));
    // Then: route identity is explicit, never selected by equal endpoints or order.
    expect(fixtureDocument(loaded).connections.map(link => [link.id, link.overviewRoute?.localConnectionId]))
      .toEqual([["terrainTemplates", "constructor"], ["__proto__", "road"]]);
    expect(own(fixtureDocument(loaded).occurrences, geographyRoot).bindings[0]?.overviewEntries).toHaveLength(2);
  });
  it("retains parallel local identities when a detached parent is duplicated", () => {
    // Given: compiled association arrays are gone before duplication.
    const input = parallelOverview();
    const detached = detachSpatialOccurrence(input.spatialAuthoring, input, geographyRoot);
    // When
    const copied = duplicateSpatialOccurrence(detached, input, { occurrenceId: geographyRoot, rootId: "constructor", externalConnections: "omit" });
    // Then: exact declaring owner/local identities survive with fresh endpoints.
    const links = copied.connections.filter(link => link.overviewRoute?.occurrenceId === "constructor");
    expect(links.map(link => link.overviewRoute?.localConnectionId)).toEqual(["constructor", "road"]);
    expect(links.every(link => link.from.occurrenceId !== input.spatialAuthoring.connections[0]?.from.occurrenceId)).toBe(true);
    expect(own(copied.occurrences, spatialId("constructor")).bindings).toEqual([]);
  });
  it("omits provenance only on the new link when explicitly copying a child boundary", () => {
    // Given: the declaring overview is outside the copied subtree.
    const input = parallelOverview();
    const link = input.spatialAuthoring.connections[0];
    if (!link) throw new TypeError("Missing link");
    // When
    const copied = duplicateSpatialOccurrence(input.spatialAuthoring, input,
      { occurrenceId: link.from.occurrenceId, rootId: "external-copy", externalConnections: "copy" });
    // Then: new ordinary links do not claim a second instance of the outside owner's route.
    expect(copied.connections.filter(link => link.from.occurrenceId === "external-copy").map(link => Object.hasOwn(link, "overviewRoute"))).toEqual([false, false]);
    expect(copied.connections.slice(0, 2)).toEqual(input.spatialAuthoring.connections);
  });
  it("does not backfill old absent provenance when historical records are duplicated", () => {
    // Given: old connections stay legal without new route provenance, uncompiled.
    const input = parallelOverview();
    const detached = detachSpatialOccurrence(input.spatialAuthoring, input, geographyRoot);
    const old = { ...detached, connections: detached.connections.map(({ overviewRoute: _route, ...link }) => link) };
    // When
    const copied = duplicateSpatialOccurrence(old, input, { occurrenceId: geographyRoot, rootId: "old-copy", externalConnections: "omit" });
    // Then
    expect(copied.connections.every(link => !Object.hasOwn(link, "overviewRoute"))).toBe(true);
    expect(checkedDocument(copied, input).legacyImport.backup).toEqual(old.legacyImport.backup);
  });
});
