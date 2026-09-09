import { describe, expect, it } from "vitest";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "@/project/io";
import { validateProjectV4 } from "@/project/io/shape";
import { emptySpatialDocument, placeDesign, spaceDesign, spatialBindingFixture, spatialFixture, spatialHierarchyFixture, spatialProject, spatialWire } from "./support/spatialSchemaFixture";

type FixtureDocument = ReturnType<typeof spatialFixture>["document"];
const invalidCases: readonly { name: string; path: string; change: (document: FixtureDocument) => unknown }[] = [
  { name: "unsupported version", path: "version", change: d => ({ ...d, version: 2 }) },
  { name: "future envelope", path: "spatialAuthoring.version", change: () => ({ version: 2 }) },
  { name: "missing collection", path: "library.spaces", change: d => ({ ...d, library: { ...d.library, spaces: undefined } }) },
  { name: "duplicate design id", path: "library.places.room", change: d => ({ ...d, library: { ...d.library, places: { room: placeDesign("room", "room") } } }) },
  { name: "key/id mismatch", path: "library.objects.desk.id", change: d => ({ ...d, library: { ...d.library, objects: { desk: { ...d.library.objects.desk, id: "other" } } } }) },
  { name: "zero revision", path: "revision", change: d => ({ ...d, library: { ...d.library, objects: { desk: { ...d.library.objects.desk, revision: 0 } } } }) },
  { name: "missing object", path: "objectDesignId", change: d => ({ ...d, library: { ...d.library, objects: {} } }) },
  { name: "inherited object name", path: "objectDesignId", change: d => ({ ...d, library: { ...d.library, spaces: { room: { ...d.library.spaces.room, objectSlots: [{ ...d.library.spaces.room.objectSlots[0], objectDesignId: "toString" }] } } } }) },
  { name: "missing kit", path: "graphic.kitId", change: d => ({ ...d, library: { ...d.library, objects: { desk: { ...d.library.objects.desk, graphic: { tilesetId: d.library.spaces.room.tilesetId, kitId: "absent" } } } } }) },
  { name: "inherited tileset", path: "graphic.tilesetId", change: d => ({ ...d, library: { ...d.library, objects: { desk: { ...d.library.objects.desk, graphic: { tilesetId: "constructor", kitId: "kit" } } } } }) },
  { name: "self cycle", path: "library.places.inn.children", change: d => ({ ...d, library: { ...d.library, places: { inn: placeDesign("inn", "inn", "place") } } }) },
  { name: "three-node cycle", path: "children", change: d => ({ ...d, library: { ...d.library, places: { a: placeDesign("a", "b", "place"), b: placeDesign("b", "c", "place"), c: placeDesign("c", "a", "place") } } }) },
  { name: "illegal kind edge", path: "source.kind", change: d => ({ ...d, library: { ...d.library, places: { inn: placeDesign("inn", "desk", "object") } } }) },
  { name: "zero size", path: "width", change: d => ({ ...d, library: { ...d.library, spaces: { room: { ...d.library.spaces.room, width: 0 } } } }) },
  { name: "unbounded size", path: "height", change: d => ({ ...d, library: { ...d.library, spaces: { room: { ...d.library.spaces.room, height: 257 } } } }) },
  { name: "fractional slot geometry", path: "placement.x", change: d => ({ ...d, library: { ...d.library, spaces: { room: { ...d.library.spaces.room, objectSlots: [{ ...d.library.spaces.room.objectSlots[0], placement: { mode: "fixed", x: 0.5, y: 1 } }] } } } }) },
  { name: "NaN wire geometry", path: "occurrences.occ-a.x", change: d => ({ ...d, occurrences: { ...d.occurrences, "occ-a": { ...d.occurrences["occ-a"], x: Number.NaN } } }) },
  { name: "fractional occurrence geometry", path: "occurrences.occ-a.y", change: d => ({ ...d, occurrences: { ...d.occurrences, "occ-a": { ...d.occurrences["occ-a"], y: 1.5 } } }) },
  { name: "multiple occurrence parents", path: "parentId", change: d => ({ ...d, occurrences: { ...d.occurrences, "occ-a": { ...d.occurrences["occ-a"], parentId: ["occ-b", "other"] } } }) },
  { name: "root also contained", path: "rootOccurrenceIds", change: d => ({ ...d, occurrences: { ...d.occurrences, "occ-a": { ...d.occurrences["occ-a"], parentId: "occ-b" } } }) },
  { name: "missing parent", path: "parentId", change: d => ({ ...d, rootOccurrenceIds: ["occ-b"], occurrences: { ...d.occurrences, "occ-a": { ...d.occurrences["occ-a"], parentId: "absent" } } }) },
  { name: "duplicate root", path: "rootOccurrenceIds", change: d => ({ ...d, rootOccurrenceIds: ["occ-a", "occ-a", "occ-b"] }) },
  { name: "omitted root", path: "rootOccurrenceIds", change: d => ({ ...d, rootOccurrenceIds: ["occ-a"] }) },
  { name: "missing occurrence", path: "connections[0].to.occurrenceId", change: d => ({ ...d, connections: [{ ...d.connections[0], to: { occurrenceId: "absent", portId: "port-b" } }] }) },
  { name: "foreign port", path: "connections[0].to.portId", change: d => ({ ...d, connections: [{ ...d.connections[0], to: { occurrenceId: "occ-b", portId: "port-a" } }] }) },
  { name: "inherited occurrence", path: "occurrenceId", change: d => ({ ...d, connections: [{ ...d.connections[0], to: { occurrenceId: "__proto__", portId: "port-b" } }] }) },
  { name: "unresolved snapshot object", path: "snapshot.kitCells", change: d => ({ ...d, occurrences: { ...d.occurrences, "occ-a": { ...d.occurrences["occ-a"], snapshot: { ...d.occurrences["occ-a"].snapshot, kitCells: {} } } } }) },
  { name: "malformed backup encoding", path: "legacyImport.backup.encoding", change: d => ({ ...d, legacyImport: { ...d.legacyImport, backup: { ...d.legacyImport.backup, encoding: "project" } } }) },
  { name: "malformed digest", path: "legacyImport.backup.sha256", change: d => ({ ...d, legacyImport: { ...d.legacyImport, backup: { ...d.legacyImport.backup, sha256: "invalid" } } }) },
  { name: "nested active backup", path: "legacyImport.backup.json", change: d => ({ ...d, legacyImport: { ...d.legacyImport, backup: { ...d.legacyImport.backup, json: { terrainTemplates: [] } } } }) },
];

describe("spatial authoring IO contract", () => {
  it.each(["rotation", "scale"])("rejects unsupported %s when a route point carries transform geometry", field => {
    // Given
    const { project, document } = spatialHierarchyFixture();
    Reflect.set(document.library.regions.country.routes[0].points[0], field, 2);
    // When
    const load = () => deserialize(spatialWire(project, document));
    // Then
    expect(load).toThrow(`routes[0].points[0].${field}`);
  });

  it.each([spatialHierarchyFixture, spatialBindingFixture])("preserves the complete hierarchy or disjoint owned bindings when serializer roundtrips", fixture => {
    // Given
    const { project, document } = fixture();
    // When
    const loaded = deserialize(serialize(deserialize(spatialWire(project, document))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(document);
  });

  it.each([
    { name: "overlap", path: "rect", patch: { rect: { x: 1, y: 0, width: 8, height: 8 } } },
    { name: "missing map", path: "mapId", patch: { mapId: "toString" } },
    { name: "missing event", path: "eventIds", patch: { eventIds: ["absent"] } },
    { name: "foreign port", path: "ports", patch: { ports: [{ portId: "port-a", x: 8, y: 2 }] } },
    { name: "missing connection", path: "connectionIds", patch: { connectionIds: ["absent"] } },
    { name: "out of bounds", path: "rect", patch: { rect: { x: 500, y: 0, width: 8, height: 8 } } },
  ])("rejects binding $name when loading owned map references", ({ patch, path }) => {
    // Given
    const { project, document } = spatialBindingFixture();
    const second = document.occurrences["occ-b"];
    const input = { ...document, occurrences: { ...document.occurrences, "occ-b": { ...second, bindings: [{ ...second.bindings[0], ...patch }] } } };
    // When
    const load = () => deserialize(spatialWire(project, input));
    // Then
    expect(load).toThrow(`spatialAuthoring.occurrences.occ-b.bindings[0].${path}`);
  });

  it.each(["region-kind", "world-kind", "entry-port", "route-port", "fourth-floor"])("rejects %s when a hierarchy reference breaks", scenario => {
    // Given
    const { project, document } = spatialHierarchyFixture();
    switch (scenario) {
      case "region-kind": document.library.regions.country.places[0].source.kind = "space"; break;
      case "world-kind": document.library.worlds.kingdom.regions[0].source.kind = "world"; break;
      case "entry-port": document.library.worlds.kingdom.entryPort.portId = "absent"; break;
      case "route-port": document.library.regions.country.routes[0].to.portId = "room-door"; break;
      case "fourth-floor": document.library.places.inn.children[0].level = 4; break;
      default: throw new Error(`Unknown fixture ${scenario}`);
    }
    // When
    const load = () => deserialize(spatialWire(project, document));
    // Then
    expect(load).toThrow(ProjectFormatError);
  });

  it("rejects occurrence cycles when three same-kind parents form a loop", () => {
    // Given
    const { project, document } = spatialFixture();
    const terminal = { ...placeDesign("terminal", "room"), children: [] };
    const occurrences = Object.fromEntries(["a", "b", "c"].map((id, i, all) => [id, {
      ...document.occurrences["occ-a"], id, kind: "place", parentId: all[(i + 1) % all.length], source: { kind: "place", id: "terminal", revision: 1 },
      snapshot: { root: { kind: "place", id: "terminal", revision: 1 }, library: { ...emptySpatialDocument().library, places: { terminal } }, kitCells: {}, ports: [] },
    }]));
    // When
    const load = () => deserialize(spatialWire(project, { ...document, occurrences, rootOccurrenceIds: [], connections: [] }));
    // Then
    expect(load).toThrow("parentId: containment cycle");
  });

  it("rejects an unresolved exterior when a frozen place snapshot omits its kit cells", () => {
    // Given
    const { project, document, tilesetId } = spatialFixture();
    const first = document.occurrences["occ-a"];
    const source = { kind: "place", id: "inn", revision: 1 };
    const inn = { ...document.library.places.inn, exterior: { tilesetId, kitId: "kit" } };
    const input = { ...document, occurrences: { ...document.occurrences, "occ-a": { ...first, kind: "place", source, snapshot: { ...first.snapshot, root: source, library: { ...document.library, places: { inn } } } } } };
    // When
    const load = () => deserialize(spatialWire(project, input));
    // Then
    expect(load).toThrow("snapshot.kitCells.inn");
  });

  it("preserves one parent with two independent room occurrences when loading containment", () => {
    // Given
    const { project, document } = spatialFixture();
    const first = document.occurrences["occ-a"];
    const source = { kind: "place", id: "inn", revision: 1 };
    const parent = { ...first, id: "inn-occ", kind: "place", source, snapshot: { ...first.snapshot, root: source, library: document.library, ports: [] } };
    const input = { ...document, rootOccurrenceIds: ["inn-occ"], occurrences: { "inn-occ": parent, "occ-a": { ...first, parentId: "inn-occ" }, "occ-b": { ...document.occurrences["occ-b"], parentId: "inn-occ" } } };
    // When
    const loaded = deserialize(serialize(deserialize(spatialWire(project, input))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(input);
  });

  it.each(invalidCases)("rejects $name with its record path when loading wire data", ({ change, path }) => {
    // Given
    const { project, document } = spatialFixture();
    const wire = spatialWire(project, change(document));
    // When
    const load = () => deserialize(wire);
    // Then
    expect(load).toThrow(ProjectFormatError);
    expect(load).toThrow(path);
  });

  it("preserves repeated design references and distinct occurrences when the real serializer roundtrips", () => {
    // Given
    const { project, document } = spatialFixture();
    const input = deserialize(spatialWire(project, document));
    // When
    const loaded = deserialize(serialize(input));
    // Then
    expect(Reflect.get(loaded, "spatialAuthoring")).toEqual(document);
    expect(loaded.version).toBe(4);
  });

  it("accepts navigation cycles when three independent occurrences form a loop", () => {
    // Given
    const { project, document } = spatialFixture();
    const third = { ...structuredClone(document.occurrences["occ-b"]), id: "occ-c" };
    third.snapshot.ports = [{ id: "port-c", name: "Door", x: 0, y: 2 }];
    const input = { ...document, occurrences: { ...document.occurrences, "occ-c": third }, rootOccurrenceIds: ["occ-a", "occ-b", "occ-c"], connections: [
      ...document.connections,
      { id: "b-c", from: { occurrenceId: "occ-b", portId: "port-b" }, to: { occurrenceId: "occ-c", portId: "port-c" }, bidirectional: true },
      { id: "c-a", from: { occurrenceId: "occ-c", portId: "port-c" }, to: { occurrenceId: "occ-a", portId: "port-a" }, bidirectional: true },
    ] };
    // When
    const loaded = deserialize(spatialWire(project, input));
    // Then
    expect(Reflect.get(loaded, "spatialAuthoring")).toEqual(input);
  });

  it("preserves an empty canonical document and opaque archive bytes when pretty serialization roundtrips", () => {
    // Given
    const { project } = spatialProject();
    const document = emptySpatialDocument();
    const loaded = deserialize(spatialWire(project, document));
    // When
    const result = deserialize(serializePretty(loaded));
    // Then
    expect(Reflect.get(result, "spatialAuthoring")).toEqual(document);
  });

  it("leaves canonical authoring absent when a legacy project loads", () => {
    // Given
    const { project } = spatialProject();
    // When
    const result = deserialize(serialize(project));
    // Then
    expect(Object.hasOwn(result, "spatialAuthoring")).toBe(false);
  });

  it("retains historical snapshots when their live source designs and kits have been deleted", () => {
    // Given
    const { project, document, tilesetId } = spatialFixture();
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("Fixture tileset missing");
    tileset.structureKits = [];
    const input = { ...document, library: emptySpatialDocument().library };
    // When
    const loaded = deserialize(spatialWire(project, input));
    // Then
    expect(Reflect.get(loaded, "spatialAuthoring")).toEqual(input);
  });

  it.each(["__proto__", "constructor", "toString"])("preserves opaque own ID %s when a dictionary roundtrips", id => {
    // Given
    const { project, tilesetId } = spatialProject();
    const input = { ...emptySpatialDocument(), library: { ...emptySpatialDocument().library, spaces: { [id]: spaceDesign(id, tilesetId) } } };
    // When
    const loaded = deserialize(serialize(deserialize(spatialWire(project, input))));
    // Then
    expect(Reflect.get(loaded, "spatialAuthoring")).toEqual(input);
  });

  it.each([Number.NaN, Infinity, -Infinity])("rejects nonfinite number %s before JSON cloning at the actual IO shape boundary", x => {
    // Given
    const { project, document } = spatialFixture();
    const input = { ...project, spatialAuthoring: { ...document, occurrences: { ...document.occurrences, "occ-a": { ...document.occurrences["occ-a"], x } } } };
    // When
    const load = () => validateProjectV4(input);
    // Then
    expect(load).toThrow("spatialAuthoring.occurrences.occ-a.x");
  });
});
