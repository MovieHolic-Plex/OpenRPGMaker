import { beforeAll, describe, expect, it } from "vitest";
import { deserialize, serialize } from "../src/project/io";
import { checkedDocument, own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../src/project/spatial/duplicate";
import { occurrenceSubtree } from "../src/project/spatial/ownership";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { updateOverview } from "./support/spatialOverviewFixture";
import type { Project } from "../src/project/types";

let fixture: Project;
beforeAll(() => { fixture = geographyFixture("region", 109); });
describe("frozen route association forgery", () => {
  it("requires persisted child associations when legacy identity is absent", () => {
    // Given
    const document = fixtureDocument(fixture);
    const child = Object.values(document.occurrences).find(value => value.parentId === geographyRoot);
    if (!child) throw new TypeError("Missing child");
    const { parentSlot: _slot, snapshot, ...legacy } = child;
    const candidate = { ...document, occurrences: { ...document.occurrences, [child.id]: { ...legacy, snapshot: { ...snapshot,
      ports: snapshot.ports.map(({ localPortId: _local, ...port }) => port) } } } };
    const before = JSON.stringify(candidate);
    // When / Then
    expect(() => checkedDocument(candidate, fixture)).toThrowError(expect.objectContaining({ code: "association-required" }));
    expect(JSON.stringify(candidate)).toBe(before);
  });
  it("rejects grandchild substitution even when its concrete port exists", () => {
    // Given
    const document = fixtureDocument(fixture);
    const link = document.connections[0];
    if (!link) throw new TypeError("Missing route");
    const descendant = Object.values(document.occurrences).find(value => value.parentId === link.from.occurrenceId && value.snapshot.ports.length > 0);
    const port = descendant?.snapshot.ports[0];
    if (!descendant || !port) throw new TypeError("Missing descendant port");
    const candidate = { ...document, connections: [{ ...link, from: { occurrenceId: descendant.id, portId: port.id } }] };
    // When / Then
    expect(() => checkedDocument(candidate, fixture)).toThrowError(/overviewRoute.from/);
  });
  it("rejects missing actual slots without reconstructing their generated IDs", () => {
    // Given
    const document = fixtureDocument(fixture);
    const link = document.connections[0];
    if (!link) throw new TypeError("Missing route");
    const removed = new Set(occurrenceSubtree(document, link.from.occurrenceId));
    const candidate = { ...document, occurrences: Object.fromEntries(Object.entries(document.occurrences).filter(([id]) => !removed.has(spatialId(id)))) };
    // When / Then
    expect(() => checkedDocument(candidate, fixture)).toThrowError(/from.occurrenceId/);
  });
  it("rejects a foreign overview route claimed by an otherwise identical raster", () => {
    // Given
    const { complete } = geographyOutputContract(109);
    const copied = duplicateSpatialOccurrence(complete.spatialAuthoring, complete,
      { occurrenceId: geographyRoot, rootId: "foreign-overview", externalConnections: "omit" });
    const foreign = copied.connections.find(link => link.overviewRoute?.occurrenceId === "foreign-overview");
    if (!foreign) throw new TypeError("Missing foreign route");
    const candidate = updateOverview({ ...complete, spatialAuthoring: copied }, binding => ({ ...binding, connectionIds: [foreign.id] }));
    const before = serialize(candidate);
    // When / Then
    expect(() => deserialize(before)).toThrowError(/connectionIds/);
    expect(serialize(candidate)).toBe(before);
  });
  it("does not infer a region child portal from containment alone", () => {
    // Given
    const { complete } = geographyOutputContract(109);
    const root = requireOccurrenceAssociations(own(complete.spatialAuthoring.occurrences, geographyRoot));
    const region = own(root.snapshot.library.regions, root.source.id);
    const candidate = updateOverview({ ...complete, spatialAuthoring: { ...complete.spatialAuthoring, connections: [],
      occurrences: { ...complete.spatialAuthoring.occurrences, [root.id]: { ...root, snapshot: { ...root.snapshot,
        library: { ...root.snapshot.library, regions: { [region.id]: { ...region, routes: [] } } } } } } } }, binding => ({ ...binding, connectionIds: [] }));
    // When / Then: child ownership bookkeeping is stripped solely to isolate entry authorization.
    const document = fixtureDocument(candidate);
    const clean = { ...candidate, spatialAuthoring: { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(value =>
      [value.id, { ...value, bindings: value.bindings.map(binding => binding.kind === undefined ? { ...binding, connectionIds: [] } : binding) }])) } };
    expect(() => deserialize(serialize(clean))).toThrowError(/overviewEntries.target/);
  });
});
