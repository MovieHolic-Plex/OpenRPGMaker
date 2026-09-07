import { createHash } from "node:crypto";
import { createBlankProject } from "../../src/project/defaults/defaultProject";

export function emptySpatialDocument() {
  const json = '{ "terrainTemplates": [{"id":"retired"}] }\n';
  const sha256 = createHash("sha256").update(json).digest("hex");
  return {
    version: 1,
    library: { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} },
    occurrences: {}, rootOccurrenceIds: [], connections: [],
    legacyImport: {
      version: 1, sourceHash: sha256, mapping: [],
      backup: { encoding: "raw-json", json, sha256 },
    },
  };
}

export function spatialProject() {
  const project = createBlankProject();
  const tileset = Object.values(project.tilesets)[0];
  if (!tileset) throw new Error("Blank fixture has no tileset");
  tileset.structureKits = [{ id: "kit", kind: "section", width: 1, height: 1, rows: [{ tiles: [0] }], learnedFrom: "user-paint" }];
  return { project, tilesetId: tileset.id };
}

export function designBase(id: string) {
  return { id, name: id, revision: 1, tags: [], provenance: { origin: "user" } };
}

export function spaceDesign(id: string, tilesetId: string) {
  return {
    ...designBase(id), environment: "interior", tilesetId, shape: "rect", width: 8, height: 8,
    floor: "wood", wall: "cream", role: "room", objectSlots: [],
    ports: [{ id: `${id}-door`, name: "Door", x: 0, y: 2 }],
  };
}

export function placeDesign(id: string, designId: string, kind = "space") {
  return {
    ...designBase(id), kind: "facility", layout: "manual",
    children: [{ id: `${id}-slot`, source: { kind, id: designId }, x: 0, y: 0, level: 1 }],
    ports: [], connections: [],
  };
}

export function spatialFixture() {
  const { project, tilesetId } = spatialProject();
  const library = {
    objects: { desk: { ...designBase("desk"), graphic: { tilesetId, kitId: "kit" }, anchors: [{ id: "desk-anchor", name: "Front", x: 0, y: 0 }], chips: ["block", "custom"] } },
    spaces: { room: { ...spaceDesign("room", tilesetId), objectSlots: [{ id: "desk-slot", objectDesignId: "desk", quantity: 1, required: true, placement: { mode: "fixed", x: 2, y: 3 }, chipOverrides: ["pass"] }] } },
    places: {
      inn: { ...placeDesign("inn", "room"), children: [
        { id: "guest-a", source: { kind: "space", id: "room" }, x: 0, y: 0, level: 1 },
        { id: "guest-b", source: { kind: "space", id: "room" }, x: 8, y: 0, level: 1 },
      ] },
    },
    regions: {}, worlds: {},
  };
  const snapshot = {
    root: { kind: "space", id: "room", revision: 1 },
    library: { ...structuredClone(library), places: {} },
    kitCells: { desk: { tilesetId, kitId: "kit", width: 1, height: 1, cells: [{ x: 0, y: 0, layer: "lower", tile: 0 }] } },
    ports: [{ id: "port-a", name: "Door", x: 0, y: 2 }],
  };
  const first = {
    id: "occ-a", kind: "space", parentId: null, source: { kind: "space", id: "room", revision: 1 },
    x: 0, y: 0, level: 1, seed: 7, snapshot, generatorVersion: "1", bindings: [],
  };
  const second = { ...structuredClone(first), id: "occ-b", snapshot: { ...structuredClone(snapshot), ports: [{ id: "port-b", name: "Door", x: 0, y: 2 }] } };
  const document = {
    ...emptySpatialDocument(), library, occurrences: { "occ-a": first, "occ-b": second },
    rootOccurrenceIds: ["occ-a", "occ-b"],
    connections: [{ id: "a-b", from: { occurrenceId: "occ-a", portId: "port-a" }, to: { occurrenceId: "occ-b", portId: "port-b" }, bidirectional: true }],
  };
  return { project, document, tilesetId };
}

export function spatialHierarchyFixture() {
  const { project, document, tilesetId } = spatialFixture();
  const door = (id: string) => ({ id, name: "Door", x: 0, y: 2 });
  const terrain = { tilesetId, width: 32, height: 24, floor: "grass", areas: [{ kind: "rect", material: "stone", x: 1, y: 1, width: 5, height: 4 }] };
  const inn = { ...document.library.places.inn, ports: [door("inn-door")], connections: [{ id: "guest-link", from: { childId: "guest-a", portId: "room-door" }, to: { childId: "guest-b", portId: "room-door" }, bidirectional: true }] };
  const region = { ...designBase("country"), terrain, places: [
    { id: "inn-a", source: { kind: "place", id: "inn" }, x: 2, y: 2, level: 0 },
    { id: "inn-b", source: { kind: "place", id: "inn" }, x: 20, y: 2, level: 0 },
  ], ports: [door("country-door")], routes: [{ id: "road", from: { childId: "inn-a", portId: "inn-door" }, to: { childId: "inn-b", portId: "inn-door" }, bidirectional: true, points: [{ x: 2, y: 2 }, { x: 20, y: 2 }] }] };
  const world = { ...designBase("kingdom"), terrain, regions: [{ id: "country-slot", source: { kind: "region", id: "country" }, x: 3, y: 4, level: 0 }], ports: [door("world-door")], connections: [], entryPort: { childId: "country-slot", portId: "country-door" } };
  return { project, document: { ...document, library: { ...document.library, places: { inn }, regions: { country: region }, worlds: { kingdom: world } } } };
}

export function spatialBindingFixture() {
  const { project, document } = spatialFixture();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Fixture map missing");
  const binding = { mapId: map.id, rect: { x: 0, y: 0, width: 8, height: 8 }, eventIds: [], connectionIds: ["a-b"], ports: [{ portId: "port-a", x: 0, y: 2 }], contentDigest: "a".repeat(64) };
  return { project, document: { ...document, occurrences: { ...document.occurrences, "occ-a": { ...document.occurrences["occ-a"], bindings: [binding] }, "occ-b": { ...document.occurrences["occ-b"], bindings: [{ ...binding, rect: { ...binding.rect, x: 8 }, ports: [{ portId: "port-b", x: 8, y: 2 }] }] } } } };
}

/** Rename whole identifier values, including references, without changing archive bytes. */
export function spatialOpaqueIdFixtures() {
  const { project, document } = spatialHierarchyFixture();
  document.occurrences["occ-a"].snapshot.library.objects.desk.name = "Frozen desk A";
  document.occurrences["occ-b"].snapshot.library.objects.desk.name = "Frozen desk B";
  document.occurrences["occ-a"].snapshot.library.spaces.room.floor = "stone";
  document.occurrences["occ-b"].snapshot.library.spaces.room.floor = "mat";
  // Keep the role token distinct from the room identifier being renamed.
  document.library.spaces.room.role = "entrance";
  document.occurrences["occ-a"].snapshot.library.spaces.room.role = "entrance";
  document.occurrences["occ-b"].snapshot.library.spaces.room.role = "entrance";
  const cases = [
    ...["desk", "room", "inn", "country", "kingdom", "occ-a"].map(id => ({ scenario: `opaque-${id}`, id, document })),
    { scenario: "opaque-unreferenced-space", id: "room", document: { ...emptySpatialDocument(),
      library: { ...emptySpatialDocument().library, spaces: { room: { ...document.library.spaces.room, objectSlots: [] } } },
    } },
    { scenario: "opaque-historical-snapshot", id: "desk", document: { ...document, library: emptySpatialDocument().library } },
  ];
  return cases.map(({ scenario, id, document: input }) => {
    const renamed: unknown = JSON.parse(JSON.stringify(input).replaceAll(JSON.stringify(id), JSON.stringify("terrainTemplates")));
    return { scenario, project, document: renamed };
  });
}

export function spatialWire(project: ReturnType<typeof spatialProject>["project"], document: unknown): string {
  return JSON.stringify({ ...project, spatialAuthoring: document });
}
