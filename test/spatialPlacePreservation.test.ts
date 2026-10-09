import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { deleteSpatialOccurrence } from "../src/project/spatial/ownership";
import { fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialConnectionSceneFixture";

const request = { occurrenceId: placeRoot };

describe("nested compilation preservation", () => {
  it("replaces stale interior plan metadata while retaining unrelated map metadata", () => {
    const input = compileSpatialOccurrence(placeCompilerFixture(), request);
    const floor = stairFloors(input)[0]!;
    const binding = own(fixtureDocument(input).occurrences, floor.roomId).bindings[0]!;
    const map = own(input.maps, binding.mapId);
    const expected = structuredClone(map.roomHarnessPlan!);
    map.roomHarnessPlan = { ...expected, plan: { ...expected.plan,
      door: { ...expected.plan.door, x: expected.plan.door.x + 1 } } };
    map.name = "Manual map title";
    const output = compileSpatialOccurrence(deserialize(serialize(input)), request);
    expect(output.maps[map.id]!.roomHarnessPlan).toEqual(expected);
    expect(output.maps[map.id]!.name).toBe("Manual map title");
    expect(input.maps[map.id]!.roomHarnessPlan).not.toEqual(expected);
  });

  it("retains identical IDs and projections when real serializer reload precedes repeated compilation", () => {
    // Given: a fully compiled three-floor project reloaded by the actual serializer.
    const input = deserialize(serialize(compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), request)));
    // When: compile the same occurrence again.
    const output = compileSpatialOccurrence(input, request);
    // Then: no maps, events, connections, or tree nodes duplicate.
    expect(output).toEqual(input);
  });

  it("preserves unmanaged maps, events, connections and map metadata when generated pixels are unchanged", () => {
    // Given: unrelated records alongside a valid owned raster.
    const input = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), request);
    const floor = stairFloors(input)[0];
    if (!floor) throw new TypeError("Missing floor");
    const binding = own(fixtureDocument(input).occurrences, floor.roomId).bindings[0];
    if (!binding) throw new TypeError("Missing binding");
    const map = own(input.maps, binding.mapId);
    map.name = "Manual map metadata";
    map.events.push({ id: "unmanaged-event", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
    input.mapConnections?.push({ id: "manual-connection", from: { mapId: map.id, x: 10, y: 15 },
      to: { mapId: map.id, x: 11, y: 15 }, playerEnabled: false, npcEnabled: true });
    const before = serialize(input);
    // When: recompile the nested root.
    const output = compileSpatialOccurrence(input, request);
    // Then: all unrelated data and the caller survive, with identical generated records.
    expect(output).toEqual(input);
    expect(serialize(input)).toBe(before);
  });

  it.each(["tile", "event", "connection"] as const)("rejects an owned %s edit atomically when its generated contract is stale", kind => {
    // Given: a deliberate manual change in generated content.
    const input = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), request);
    const connection = input.mapConnections?.[0];
    if (!connection) throw new TypeError("Missing connection");
    const map = own(input.maps, connection.from.mapId);
    switch (kind) {
      case "tile": map.lowerTiles[0] = map.lowerTiles[0] === -1 ? 0 : -1; break;
      case "event": {
        const event = map.events.find(event => event.id === connection.id);
        if (!event) throw new TypeError("Missing owned event");
        event.x += 1;
        break;
      }
      case "connection": connection.npcEnabled = false; break;
      default: kind satisfies never;
    }
    const before = serialize(input);
    // When / Then: replacement fails at ownership and cannot mutate the caller.
    expect(() => compileSpatialOccurrence(input, request)).toThrowError(expect.objectContaining({ code: "ownership" }));
    expect(serialize(input)).toBe(before);
  });

  it("leaves deleted child gaps absent when a floor and an object repetition were removed", () => {
    // Given: deletion changes actual containment but does not rewrite frozen slots.
    const input = placeCompilerFixture();
    const floors = stairFloors(input);
    const first = floors[0], second = floors[1];
    if (!first || !second) throw new TypeError("Missing floors");
    const bed = placeChild(input, first.roomId, "beds");
    input.spatialAuthoring = deleteSpatialOccurrence(fixtureDocument(input), input, { occurrenceId: second.roomId, externalConnections: "reject" });
    input.spatialAuthoring = deleteSpatialOccurrence(fixtureDocument(input), input, { occurrenceId: bed, externalConnections: "reject" });
    // When: compile the remaining occurrence tree.
    const output = compileSpatialOccurrence(input, request);
    // Then: compilation never re-expands the missing authored slots.
    expect(Object.keys(fixtureDocument(output).occurrences).sort()).toEqual(Object.keys(fixtureDocument(input).occurrences).sort());
    expect(Object.keys(output.maps)).not.toContain(`spatial:${second.roomId}`);
  });

  it("uses frozen rasters when all live source designs and kits have been removed", () => {
    // Given: all composition authority lives in snapshots, not the now-empty live library.
    const fixture = placeCompilerFixture();
    const expected = compileSpatialOccurrence(fixture, request);
    const input = { ...fixture, spatialAuthoring: { ...fixtureDocument(fixture), library: { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} } },
      tilesets: Object.fromEntries(Object.entries(fixture.tilesets).map(([id, atlas]) => [id, { ...atlas, structureKits: [] }])) };
    // When: compile after source/kit removal.
    const output = compileSpatialOccurrence(input, request);
    // Then: generated raster and event output is identical, not randomly replaced.
    expect(output.maps).toEqual(expected.maps);
  });

  it("allows navigation cycles when distinct declared ports close a three-floor loop", () => {
    // Given: containment is still a tree; only navigation has a cycle.
    const input = withStairConnections(placeCompilerFixture());
    const first = stairFloors(input)[0], third = stairFloors(input)[2];
    if (!first || !third) throw new TypeError("Missing floors");
    const document = fixtureDocument(input);
    input.spatialAuthoring = { ...document, connections: [...document.connections, { id: spatialId("loop"),
      from: { occurrenceId: third.upId, portId: third.upPortId }, to: { occurrenceId: first.stairId, portId: first.portId }, bidirectional: true }] };
    // When: compile the legal navigation cycle.
    const output = compileSpatialOccurrence(input, request);
    // Then: each of three links has both requested directions exactly once.
    expect(output.mapConnections).toHaveLength(6);
  });

  it("emits only the requested direction when a declared stair connection is one-way", () => {
    // Given: one concrete forward connection.
    const input = withStairConnections(placeCompilerFixture());
    const document = fixtureDocument(input);
    const link = document.connections[0];
    if (!link) throw new TypeError("Missing connection");
    input.spatialAuthoring = { ...document, connections: [{ ...link, bidirectional: false }] };
    // When: compile the root.
    const output = compileSpatialOccurrence(input, request);
    // Then: containment does not invent its inverse.
    expect(output.mapConnections).toHaveLength(1);
  });

  it("rejects an unlinked blocked container port when its exact coordinate hits a tree", () => {
    // Given: a port on the village, projected onto the square's blocked tree.
    const fixture = placeCompilerFixture();
    const root = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, placeRoot));
    const local = { id: spatialId("tree"), name: "Tree", x: 4, y: 6 };
    const design = own(root.snapshot.library.places, root.source.id);
    const input = replaceOccurrence(fixture, { ...root, snapshot: { ...root.snapshot,
      library: { ...root.snapshot.library, places: { ...root.snapshot.library.places, [design.id]: { ...design, ports: [local] } } },
      ports: [{ ...local, id: spatialId("root-tree-port"), localPortId: local.id }] } });
    // When / Then: even without a navigation link, a declared port must be passable.
    expect(() => compileSpatialOccurrence(input, request)).toThrowError(expect.objectContaining({ code: "port" }));
  });
});
