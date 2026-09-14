import { beforeAll, describe, expect, it } from "vitest";
import { deserialize, serialize } from "../src/project/io";
import { own } from "../src/project/spatial/domain";
import { deleteSpatialOccurrence } from "../src/project/spatial/ownership";
import type { Project } from "../src/project/types";
import { overviewBinding, updateOverview } from "./support/spatialOverviewFixture";
import { sharedWorldOutput } from "./support/spatialOverviewShared";
import { fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";

let fixture: Project;
beforeAll(() => { fixture = sharedWorldOutput(); });
describe("shared overview marker associations", () => {
  it("keeps one B pair and both route IDs when B is shared by routes and the world selector", () => {
    // Given / When
    const loaded = deserialize(serialize(fixture));
    // Then
    expect(overviewBinding(loaded).overviewEntries).toHaveLength(3);
    expect(overviewBinding(loaded).connectionIds).toEqual(["opaque:0", "opaque:1"]);
    expect(loaded.mapConnections).toHaveLength(6);
  });
  it("retains B and C when A is removed but B remains selected and connected", () => {
    // Given
    const first = overviewBinding(fixture).overviewEntries?.[0];
    if (!first) throw new TypeError("Missing A");
    // When
    const removed = deleteSpatialOccurrence(fixtureDocument(fixture), fixture,
      { occurrenceId: first.target.occurrenceId, externalConnections: "remove" });
    // Then: marker sharing survives exact dependency pruning.
    const binding = overviewBinding({ ...fixture, spatialAuthoring: removed });
    expect(binding.overviewEntries?.map(entry => entry.eventId)).toEqual(overviewBinding(fixture).overviewEntries?.slice(1).map(entry => entry.eventId));
    expect(binding.connectionIds).toEqual(["opaque:1"]);
  });
  it("rejects distinct automatic targets at the same source cell", () => {
    // Given: two valid direct children are placed at exactly the same overview position.
    const entries = overviewBinding(fixture).overviewEntries;
    const first = entries?.[0];
    const second = entries?.[1];
    if (!first || !second) throw new TypeError("Missing markers");
    const child = own(fixtureDocument(fixture).occurrences, second.target.occurrenceId);
    const candidate = updateOverview(replaceOccurrence(fixture, { ...child, x: first.x, y: first.y }), binding => ({ ...binding,
      overviewEntries: binding.overviewEntries?.map(entry => entry.eventId === second.eventId ? { ...entry, x: first.x, y: first.y } : entry) }));
    const before = serialize(candidate);
    // When / Then
    expect(() => deserialize(before)).toThrowError(/overviewEntries.position/);
    expect(serialize(candidate)).toBe(before);
  });
  it("rejects distinct targets whose automatic returns coincide on one landing", () => {
    // Given: B projects onto A's ordinary landing; both reverse events have that raster owner.
    const document = fixtureDocument(fixture);
    const entries = overviewBinding(fixture).overviewEntries;
    const first = entries?.[0];
    const second = entries?.[1];
    if (!first || !second) throw new TypeError("Missing markers");
    const a = own(document.occurrences, first.target.occurrenceId);
    const b = own(document.occurrences, second.target.occurrenceId);
    const aBinding = a.bindings[0];
    const bBinding = b.bindings[0];
    if (!aBinding || !bBinding || aBinding.kind !== undefined) throw new TypeError("Missing owners");
    const aMap = own(fixture.maps, aBinding.mapId);
    const bMap = own(fixture.maps, bBinding.mapId);
    const reverse = bMap.events.find(event => event.id === second.returnEventId);
    if (!reverse) throw new TypeError("Missing return event");
    const candidate = replaceOccurrence(replaceOccurrence(fixture, { ...a, bindings: [{ ...aBinding, eventIds: [...aBinding.eventIds, reverse.id] }] }),
      { ...b, bindings: [{ kind: "projection", mapId: aBinding.mapId, rect: aBinding.rect, ports: bBinding.ports }] });
    const paired = { ...candidate, maps: { ...candidate.maps, [aMap.id]: { ...aMap, events: [...aMap.events, reverse] } },
      mapConnections: candidate.mapConnections?.map(link => ({ ...link,
        from: link.id === reverse.id ? { ...link.from, mapId: aMap.id } : link.from,
        to: link.id === second.eventId ? { ...link.to, mapId: aMap.id } : link.to })) };
    const before = serialize(paired);
    // When / Then: domain collision rejects before competing returns can execute.
    expect(() => deserialize(before)).toThrowError(/overviewEntries.target/);
    expect(serialize(paired)).toBe(before);
  });
});
