import assert from "node:assert/strict";
import { deserialize } from "../../src/project/io";
import { own, spatialId } from "../../src/project/spatial/domain";
import { emptySpatialLibrary } from "../../src/project/spatial/resolve";
import type { PlaceDesign, SpatialDesignReference } from "../../src/project/spatial/types";
import { spatialHierarchyFixture, spatialWire } from "./spatialSchemaFixture";

export function instancesFixture() {
  const raw = spatialHierarchyFixture();
  const tilesetId = raw.document.library.objects.desk.graphic.tilesetId;
  const atlas = raw.project.tilesets[tilesetId];
  assert.ok(atlas);
  atlas.structureKits = [{ id: "kit", kind: "section", width: 2, height: 2,
    rows: [{ tiles: [3, -1], upperTiles: [7, 8] }, { tiles: [-1, 4], upperTiles: [-1, 9] }], learnedFrom: "db-authored" }];
  raw.document.library.spaces.room.objectSlots[0] = {
    id: "desk-slot", objectDesignId: "desk", quantity: 2, required: true,
    placement: { mode: "fixed", x: 2, y: 3 }, chipOverrides: ["paid", "custom-service"],
  };
  raw.document.library.spaces.room.revision = 5;
  const map = raw.project.maps[raw.project.startMapId];
  assert.ok(map);
  map.events = [
    { id: "owned-event", x: 2, y: 3, trigger: { kind: "action" }, commands: [{ kind: "text", body: "Owned fixture event" }] },
    { id: "unmanaged-event", x: 8, y: 8, trigger: { kind: "action" }, commands: [{ kind: "text", body: "Unmanaged fixture event" }] },
  ];
  const project = deserialize(spatialWire(raw.project, { ...raw.document, occurrences: {}, rootOccurrenceIds: [], connections: [] }));
  const document = project.spatialAuthoring;
  assert.ok(document);
  const world = document.library.worlds.kingdom;
  assert.ok(world);
  return { project, document, tilesetId, request: { source: { kind: "world", id: world.id } as const,
    rootId: "placed-world", x: 11, y: 12, level: 0, seed: 19, generatorVersion: "qa-7" } };
}

export function first<T extends readonly unknown[]>(values: T): T[number] {
  const value = values[0];
  assert.ok(value !== undefined);
  return value;
}

export function expansionFixture(depth: number, repetitions: number) {
  const fixture = instancesFixture();
  const places: Record<string, PlaceDesign> = {};
  let source: SpatialDesignReference<"space" | "place"> = { kind: "space", id: spatialId("room") };
  for (let i = 0; i < depth; i++) {
    const id = spatialId(`nested-${i}`);
    places[id] = { ...own(fixture.document.library.places, "inn"), id, ports: [], connections: [],
      children: Array.from({ length: repetitions }, (_, index) => ({ id: spatialId(`slot-${index}`), source, x: index, y: 0, level: 1 })) };
    source = { kind: "place", id };
  }
  return { ...fixture, request: { ...fixture.request, source }, document: { ...fixture.document, library: {
    ...emptySpatialLibrary(), objects: fixture.document.library.objects, spaces: fixture.document.library.spaces, places,
  } } };
}

export const selectedCells = [
  { x: 0, y: 0, layer: "lower", tile: 3 }, { x: 0, y: 0, layer: "upper", tile: 7 },
  { x: 1, y: 0, layer: "upper", tile: 8 }, { x: 1, y: 1, layer: "lower", tile: 4 },
  { x: 1, y: 1, layer: "upper", tile: 9 },
] as const;
