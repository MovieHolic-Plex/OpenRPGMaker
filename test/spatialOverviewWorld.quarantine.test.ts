import { beforeAll, describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { resolveOverviewEntry, validateOverviewAccess } from "../src/editor/spatial/overviewEntries";
import { resolveCompiledPort } from "../src/editor/spatial/compileConnections";
import { deserialize, serialize, serializePretty } from "../src/project/io";
import { checkedDocument, own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialOccurrenceDeletion } from "../src/project/spatial/ownership";
import type { Project } from "../src/project/types";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { overviewBinding, worldEntryOutput } from "./support/spatialOverviewFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";

let fixture: Project;
beforeAll(() => { fixture = worldEntryOutput(); });
function selectedEntry() {
  const entry = overviewBinding(fixture).overviewEntries?.[0];
  if (!entry) throw new TypeError("Missing selected entry");
  return entry;
}
describe("standalone world entry", () => {
  it.each([serialize, serializePretty])("preserves one pair with no route when reloading %s", save => {
    // Given: zero authored world routes, one explicit child selector.
    const before = save(fixture);
    // When
    const loaded = deserialize(before);
    // Then: no fake route or port, opaque event identities survive.
    expect(fixtureDocument(loaded).connections).toEqual([]);
    expect(overviewBinding(loaded).connectionIds).toEqual([]);
    expect(overviewBinding(loaded).ports).toEqual([]);
    expect(overviewBinding(loaded).overviewEntries).toEqual([selectedEntry()]);
    expect(loaded.mapConnections?.map(link => link.id)).toEqual(["__proto__", "constructor"]);
  });
  it("rejects omitted route bookkeeping when the world selector independently authorizes its marker", () => {
    // Given: a frozen loop through the selected child, with deliberately omitted bookkeeping.
    const document = fixtureDocument(fixture);
    const root = requireOccurrenceAssociations(own(document.occurrences, geographyRoot));
    const world = own(root.snapshot.library.worlds, root.source.id);
    const local = { id: spatialId("world-loop"), from: world.entryPort, to: world.entryPort, bidirectional: true };
    const candidate = { ...fixture, spatialAuthoring: { ...document, connections: [{ id: spatialId("opaque-loop"),
      from: selectedEntry().target, to: selectedEntry().target, bidirectional: true,
      overviewRoute: { occurrenceId: geographyRoot, localConnectionId: local.id } }],
    occurrences: { ...document.occurrences, [root.id]: { ...root, snapshot: { ...root.snapshot,
      library: { ...root.snapshot.library, worlds: { [world.id]: { ...world, connections: [local] } } } } } } } };
    // When / Then: world-entry authorization cannot hide implemented authored route bookkeeping.
    expect(() => deserialize(serialize(candidate))).toThrowError(/connectionIds/);
  });
  it("blocks deletion when an entry-only dependency exists without a logical link", () => {
    // Given
    const before = serialize(fixture);
    // When
    const remove = () => deleteSpatialOccurrence(fixtureDocument(fixture), fixture,
      { occurrenceId: selectedEntry().target.occurrenceId, externalConnections: "reject" });
    // Then
    expect(remove).toThrowError(expect.objectContaining({ code: "external-connection" }));
    expect(serialize(fixture)).toBe(before);
  });
  it("reports exact entry-only event impact when inspecting deletion", () => {
    // Given
    const entry = selectedEntry();
    // When
    const impact = inspectSpatialOccurrenceDeletion(fixtureDocument(fixture), fixture, entry.target.occurrenceId);
    // Then
    expect(impact.connections).toEqual([]);
    expect(impact.overviewEntries).toEqual([{ occurrenceId: geographyRoot, bindingIndex: 0, mapId: "world-overview",
      target: entry.target, eventId: "__proto__", returnEventId: "constructor", returnMapId: "region-overview",
      returnOccurrenceId: entry.target.occurrenceId, returnBindingIndex: 0 }]);
  });
  it("keeps output when explicit domain deletion removes the only world entry", () => {
    // Given
    const before = serialize(fixture);
    // When
    const removed = deleteSpatialOccurrence(fixtureDocument(fixture), fixture,
      { occurrenceId: selectedEntry().target.occurrenceId, externalConnections: "remove" });
    // Then
    expect(own(removed.occurrences, geographyRoot).bindings[0]?.overviewEntries).toBeUndefined();
    expect(removed.connections).toEqual([]);
    expect(serialize(fixture)).toBe(before);
  });
  it("reports the missing selected slot when resolving a deleted world entry", () => {
    // Given
    const removed = deleteSpatialOccurrence(fixtureDocument(fixture), fixture,
      { occurrenceId: selectedEntry().target.occurrenceId, externalConnections: "remove" });
    // When
    const resolve = () => validateOverviewAccess({ ...fixture, spatialAuthoring: removed }, geographyRoot,
      { mapId: "world-overview", x: 6, y: 10 });
    // Then: no other child becomes the entry by default.
    expect(resolve).toThrowError(/overview: missing child slot first/);
  });
  it("uses the ordinary own port without a marker association when the world selects itself", () => {
    // Given: a self selector with one ordinary overview port. Existing unrelated output is retained.
    const document = fixtureDocument(fixture);
    const root = requireOccurrenceAssociations(own(document.occurrences, geographyRoot));
    const world = own(root.snapshot.library.worlds, root.source.id);
    const port = root.snapshot.ports[0];
    if (!port) throw new TypeError("Missing own port");
    const { overviewEntries: _entries, ...extent } = overviewBinding(fixture);
    const candidate = { ...fixture, spatialAuthoring: { ...document, occurrences: { ...document.occurrences,
      [root.id]: { ...root, snapshot: { ...root.snapshot, library: { ...root.snapshot.library,
        worlds: { [world.id]: { ...world, entryPort: { childId: null, portId: port.localPortId } } } } },
      bindings: [{ ...extent, ports: [{ portId: port.id, x: port.x, y: port.y }] }] } } } };
    const before = serialize(candidate);
    // When
    validateOverviewAccess(candidate, geographyRoot, { mapId: extent.mapId, x: port.x, y: port.y });
    // Then: no child marker/port or logical route is synthesized.
    expect(overviewBinding(candidate).overviewEntries).toBeUndefined();
    expect(candidate.spatialAuthoring.connections).toEqual([]);
    expect(serialize(candidate)).toBe(before);
  });
  it("resolves marker source separately when the concrete local port remains singly bound", () => {
    // Given
    const document = fixtureDocument(fixture);
    // When
    const marker = resolveOverviewEntry(document, geographyRoot, selectedEntry().target);
    // Then
    expect({ mapId: marker.mapId, x: marker.x, y: marker.y }).toEqual({ mapId: "world-overview", x: 6, y: 10 });
    expect(resolveCompiledPort({ project: fixture, occurrences: document.occurrences }, selectedEntry().target))
      .toEqual({ mapId: "region-overview", x: 2, y: 8 });
  });
  it("executes the exact pair when the production interpreter enters and returns", () => {
    // Given
    validateOverviewAccess(fixture, geographyRoot, { mapId: "world-overview", x: 6, y: 10 });
    // When
    const traversal = inspectNestedTraversal(fixture);
    // Then
    expect(traversal.routes.map(route => route.to.mapId)).toEqual(["region-overview", "world-overview"]);
    expect(traversal.routes.every(route => route.interpreterExecuted && route.landingPassable)).toBe(true);
  });
  it("keeps frozen entry associations when the live world source disappears", () => {
    // Given
    const document = fixtureDocument(fixture);
    const candidate = { ...document, library: { ...document.library, worlds: {} } };
    // When: ordinary domain resolution reads snapshots only.
    const loaded = checkedDocument(candidate, fixture);
    // Then
    expect(own(loaded.occurrences, geographyRoot).bindings).toEqual(own(document.occurrences, geographyRoot).bindings);
  });
  it("refuses to adopt detached output when a child is subsequently compiled alone", () => {
    // Given
    const document = detachSpatialOccurrence(fixtureDocument(fixture), fixture, selectedEntry().target.occurrenceId);
    const candidate = { ...fixture, spatialAuthoring: document };
    const before = serialize(candidate);
    // When: task10 kind generation remains unsupported, rather than adopting retained events.
    const compile = () => compileSpatialOccurrence(candidate, { occurrenceId: selectedEntry().target.occurrenceId });
    // Then
    expect(compile).toThrowError(expect.objectContaining({ code: "kind" }));
    expect(serialize(candidate)).toBe(before);
  });
});
