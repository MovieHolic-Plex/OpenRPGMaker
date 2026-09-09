import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { own, spatialId, occurrenceChildId, SpatialOperationError } from "@/project/spatial/domain";
import { duplicateSpatialOccurrence } from "@/project/spatial/duplicate";
import { deleteSpatialDesign, deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialDesignReferences, inspectSpatialOccurrenceDeletion } from "@/project/spatial/ownership";
import { emptySpatialLibrary, resolveSpatialDesign, resolveSpatialOccurrenceRefresh, SPATIAL_EXPANSION_LIMITS } from "@/project/spatial/resolve";
import { INTERIOR_OBJECT_CATALOG } from "@/project/defaults/interiorObjectCatalog";
import { INTERIOR_TILESET_ID } from "@/project/mapCreateSpec";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import type { SpatialRasterAdapter } from "@/project/spatial/snapshotRaster";
import { expansionFixture, first, instancesFixture, selectedCells } from "./support/spatialInstancesFixture";

describe("frozen spatial occurrences", () => {
  it("expands ordered independent descendants when a repeated transitive design is instantiated through IO", () => {
    // Given: actual schema-parsed world -> region -> repeated inn -> repeated room -> quantity two.
    const { project, document, request } = instancesFixture();
    const before = structuredClone(document);
    // When
    const result = instantiateSpatialDesign(document, project, request);
    const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
    // Then: 1 world + 1 region + 2 inns + 4 rooms + 8 objects; no aliases or source mutations.
    expect(Object.values(reloaded?.occurrences ?? {})).toHaveLength(16);
    expect(reloaded?.occurrences[request.rootId]?.snapshot.kitCells.desk?.cells).toEqual(selectedCells);
    expect(document).toEqual(before);
  });

  it("preserves contextual layout and effective overrides when repeated objects get their own snapshots", () => {
    // Given
    const { project, document, request } = instancesFixture();
    // When
    const result = instantiateSpatialDesign(document, project, request);
    // Then
    const rooms = Object.values(result.occurrences).filter(value => value.kind === "space");
    const objects = Object.values(result.occurrences).filter(value => value.kind === "object");
    expect(rooms.map(room => [room.x, room.y, room.level, room.source.revision])).toEqual([[0, 0, 1, 5], [8, 0, 1, 5], [0, 0, 1, 5], [8, 0, 1, 5]]);
    expect(objects.map(object => [object.x, object.y, object.snapshot.library.objects.desk?.chips])).toEqual(Array.from({ length: 8 }, () => [2, 3, ["paid", "custom-service"]]));
    expect(new Set(rooms.map(room => room.snapshot.library)).size).toBe(4);
    expect(result.occurrences[request.rootId]?.snapshot.library).not.toBe(document.library);
    expect(Object.isFrozen(objects[0]?.snapshot.kitCells.desk?.cells)).toBe(true);
    expect(result.connections).toHaveLength(3);
    expect(new Set(Object.values(result.occurrences).flatMap(value => value.snapshot.ports.map(port => port.id))).size).toBe(16);
  });

  it.each([serialize, serializePretty])("keeps frozen data when all source designs and authored kits disappear using %s", write => {
    // Given
    const { project, document, request, tilesetId } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const orphaned = { ...placed, library: emptySpatialLibrary() };
    const edited = { ...project, tilesets: { ...project.tilesets, [tilesetId]: { ...own(project.tilesets, tilesetId), structureKits: [] } } };
    // When
    const result = deserialize(write({ ...edited, spatialAuthoring: orphaned }));
    // Then
    expect(result.spatialAuthoring?.occurrences).toEqual(placed.occurrences);
    expect(() => resolveSpatialOccurrenceRefresh(orphaned, edited, spatialId(request.rootId))).toThrow(SpatialOperationError);
  });

  it("offers new cells and transitive revisions only when refresh is explicitly resolved", () => {
    // Given
    const { project, document, request, tilesetId } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const edited = { ...placed, library: { ...placed.library, spaces: { room: { ...own(placed.library.spaces, "room"), revision: 6, floor: "stone" } } } };
    const kit = own(project.tilesets, tilesetId).structureKits?.[0];
    if (!kit || kit.kind !== "section") throw new TypeError("Fixture section missing");
    kit.rows[0] = { tiles: [12, -1], upperTiles: [13, 14] };
    // When
    const proposal = resolveSpatialOccurrenceRefresh(edited, project, spatialId(request.rootId));
    // Then
    expect(proposal.snapshot.library.spaces.room?.revision).toBe(6);
    expect(proposal.snapshot.kitCells.desk?.cells[0]?.tile).toBe(12);
    expect(placed.occurrences[request.rootId]?.snapshot.kitCells.desk?.cells).toEqual(selectedCells);
    expect(edited.occurrences).toBe(placed.occurrences);
  });

  it("duplicates frozen descendants and remaps internal ports when live sources are missing", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const orphaned = { ...placed, library: emptySpatialLibrary() };
    // When
    const result = duplicateSpatialOccurrence(orphaned, project, { occurrenceId: spatialId(request.rootId), rootId: "copy", externalConnections: "omit" });
    // Then
    expect(Object.values(result.occurrences)).toHaveLength(32);
    expect(result.connections).toHaveLength(6);
    expect(result.occurrences.copy?.snapshot.kitCells).toEqual(placed.occurrences[request.rootId]?.snapshot.kitCells);
    expect(result.occurrences.copy?.snapshot.library).not.toBe(result.occurrences[request.rootId]?.snapshot.library);
    expect(result.rootOccurrenceIds).toEqual([request.rootId, "copy"]);
  });

  it.each(["omit", "copy"] as const)("handles external links by explicit %s policy when duplicating", externalConnections => {
    // Given
    const { project, document, request } = instancesFixture();
    const initial = instantiateSpatialDesign(document, project, request);
    const placed = instantiateSpatialDesign(initial, project, { ...request, rootId: "other" });
    const root = own(placed.occurrences, request.rootId);
    const other = own(placed.occurrences, "other");
    const link = { id: spatialId("external"), from: { occurrenceId: root.id, portId: first(root.snapshot.ports).id }, to: { occurrenceId: other.id, portId: first(other.snapshot.ports).id }, bidirectional: true };
    // When
    const result = duplicateSpatialOccurrence({ ...placed, connections: [...placed.connections, link] }, project, { occurrenceId: root.id, rootId: "copy", externalConnections });
    // Then
    expect(result.connections).toHaveLength(externalConnections === "copy" ? 11 : 10);
    expect(result.connections.filter(connection => connection.to.occurrenceId === other.id)).toHaveLength(externalConnections === "copy" ? 2 : 1);
  });

  it("reports strong and historical references when a nested design is inspected", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    // When
    const impact = inspectSpatialDesignReferences(placed, project, { kind: "space", id: spatialId("room") });
    // Then
    expect(impact.strong.map(ref => ref.path)).toEqual(["library.places.inn.children[0].source", "library.places.inn.children[1].source"]);
    expect(impact.historical).toHaveLength(8);
  });

  it("blocks deletion when a strong library reference remains", () => {
    // Given
    const { project, document } = instancesFixture();
    // When / Then
    expect(() => deleteSpatialDesign(document, project, { kind: "space", id: spatialId("room") })).toThrow(SpatialOperationError);
  });

  it("preserves history when the last strong source reference is explicitly removed", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const detached = { ...placed, library: { ...emptySpatialLibrary(), objects: placed.library.objects } };
    // When
    const result = deleteSpatialDesign(detached, project, { kind: "object", id: spatialId("desk") });
    // Then
    expect(result.library.objects).toEqual({});
    expect(result.occurrences).toEqual(placed.occurrences);
  });

  it("previews exact owned rectangles and preserves unmanaged maps when deleting a subtree", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const root = own(placed.occurrences, request.rootId);
    const binding = { mapId: project.startMapId, rect: { x: 1, y: 2, width: 3, height: 4 }, eventIds: ["owned-event"], connectionIds: [], ports: [], contentDigest: "a".repeat(64) };
    const bound = { ...placed, occurrences: { ...placed.occurrences, [root.id]: { ...root, bindings: [binding] } } };
    const before = structuredClone(project.maps);
    // When
    const impact = inspectSpatialOccurrenceDeletion(bound, project, root.id);
    // Then
    expect(impact.occurrenceIds).toHaveLength(16);
    expect(impact.artifacts).toEqual([{ occurrenceId: root.id, binding }]);
    expect(impact.connections).toHaveLength(3);
    expect(project.maps).toEqual(before);
  });

  it.each(["delete", "detach"] as const)("preserves map data when ownership is explicitly %s", operation => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const root = own(placed.occurrences, request.rootId);
    const bound = { ...placed, occurrences: { ...placed.occurrences, [root.id]: { ...root, bindings: [{ mapId: project.startMapId, rect: { x: 1, y: 2, width: 3, height: 4 }, eventIds: ["owned-event"], connectionIds: [], ports: [], contentDigest: "a".repeat(64) }] } } };
    const before = structuredClone(project.maps);
    // When
    const result = operation === "delete" ? deleteSpatialOccurrence(bound, project, { occurrenceId: root.id, externalConnections: "reject" }) : detachSpatialOccurrence(bound, project, root.id);
    // Then
    expect(Object.values(result.occurrences)).toHaveLength(operation === "delete" ? 0 : 16);
    expect(result.occurrences[root.id]?.bindings ?? []).toEqual([]);
    expect(project.maps).toEqual(before);
  });

  it.each(["parent", "cycle", "duplicate", "blank", "fractional"])("rejects invalid %s without caller mutation", scenario => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const root = own(placed.occurrences, request.rootId);
    const invalid = scenario === "parent" ? { ...placed, rootOccurrenceIds: [...placed.rootOccurrenceIds, occurrenceChildId(root.id, spatialId("country-slot"), 0)] }
      : scenario === "cycle" ? { ...document, library: { ...document.library, places: { inn: { ...own(document.library.places, "inn"), connections: [], children: [{ id: spatialId("cycle"), source: { kind: "place", id: spatialId("inn") }, x: 0, y: 0, level: 1 }] } } } } : placed;
    const attempt = { ...request, rootId: scenario === "blank" ? " " : scenario === "duplicate" ? request.rootId : "new", x: scenario === "fractional" ? 0.5 : 0 };
    const before = structuredClone(invalid);
    // When / Then
    expect(() => instantiateSpatialDesign(invalid, project, attempt)).toThrow(scenario === "cycle" ? /containment cycle/ : undefined);
    expect(invalid).toEqual(before);
  });

  it("preflights quantity before rasterization when an expansion exceeds the concrete bound", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const room = own(document.library.spaces, "room");
    const slot = first(room.objectSlots);
    const huge = { ...document, library: { ...document.library, spaces: { room: { ...room, objectSlots: [{ ...slot, quantity: Number.MAX_SAFE_INTEGER }] } } } };
    // When / Then
    expect(() => resolveSpatialDesign(huge, project, request.source)).toThrow(SpatialOperationError);
    expect(SPATIAL_EXPANSION_LIMITS.occurrences).toBe(4096);
  });

  it("rejects unsupported authored houses instead of falling back to builtin pixels", () => {
    // Given
    const { project, document, request } = instancesFixture();
    own(project.tilesets, INTERIOR_TILESET_ID).structureKits = [{ id: "bed_h", kind: "house", houseKitId: "old", wings: [{ x: 0, y: 0, w: 3, h: 3 }], learnedFrom: "db-authored" }];
    const input = { ...document, library: { ...document.library, objects: { desk: { ...own(document.library.objects, "desk"), graphic: { tilesetId: INTERIOR_TILESET_ID, kitId: "bed_h" } } } } };
    // When / Then
    expect(() => instantiateSpatialDesign(input, project, request)).toThrow(SpatialOperationError);
  });

  it.each([{ depth: 13, repetitions: 2 }, { depth: 129, repetitions: 1 }])("rejects bounded DAG/depth expansion when $depth levels have $repetitions references", ({ depth, repetitions }) => {
    // Given
    const { project, document, request } = expansionFixture(depth, repetitions);
    // When / Then
    expect(() => instantiateSpatialDesign(document, project, request)).toThrow(SpatialOperationError);
  });

  it("accepts a complete caller raster when a stored house needs a pure adapter", () => {
    // Given
    const { project, document, request, tilesetId } = instancesFixture();
    const kit = { id: "kit", kind: "house", houseKitId: "old", wings: [{ x: 0, y: 0, w: 3, h: 3 }], learnedFrom: "db-authored" } as const;
    own(project.tilesets, tilesetId).structureKits = [{ ...kit, wings: [...kit.wings] }];
    const rasterizeHouse: SpatialRasterAdapter = (graphic, supplied) => {
      expect(supplied).toEqual(kit);
      return { ...graphic, width: 2, height: 2, cells: selectedCells };
    };
    // When
    const result = instantiateSpatialDesign(document, { ...project, rasterizeHouse }, request);
    // Then
    expect(result.occurrences[request.rootId]?.snapshot.kitCells.desk?.cells).toEqual(selectedCells);
    expect(Object.isFrozen(kit.wings)).toBe(false);
  });

  it.each([{ cells: [] }, { cells: [{ x: 2, y: 0, layer: "lower", tile: 1 }] }, { cells: [{ x: 0, y: 0, layer: "lower", tile: 999999 }] }, { cells: [{ x: 0.5, y: 0, layer: "lower", tile: 1 }] }] as const)("rejects incomplete or schema-invalid adapter cells when raster is $cells", ({ cells }) => {
    // Given
    const { project, document, request, tilesetId } = instancesFixture();
    own(project.tilesets, tilesetId).structureKits = [{ id: "kit", kind: "house", houseKitId: "old", wings: [], learnedFrom: "db-authored" }];
    const rasterizeHouse: SpatialRasterAdapter = graphic => ({ ...graphic, width: 2, height: 2, cells });
    // When / Then
    expect(() => instantiateSpatialDesign(document, { ...project, rasterizeHouse }, request)).toThrow();
  });

  it.each(["reject", "remove"] as const)("enforces %s policy for incoming references when deleting a root", externalConnections => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(instantiateSpatialDesign(document, project, request), project, { ...request, rootId: "other" });
    const root = own(placed.occurrences, request.rootId);
    const other = own(placed.occurrences, "other");
    const link = { id: spatialId("incoming"), from: { occurrenceId: other.id, portId: first(other.snapshot.ports).id }, to: { occurrenceId: root.id, portId: first(root.snapshot.ports).id }, bidirectional: true };
    const connected = { ...placed, connections: [...placed.connections, link] };
    // When / Then
    switch (externalConnections) {
      case "reject": expect(() => deleteSpatialOccurrence(connected, project, { occurrenceId: root.id, externalConnections })).toThrow(SpatialOperationError); break;
      case "remove": {
        const result = deleteSpatialOccurrence(connected, project, { occurrenceId: root.id, externalConnections });
        expect(result.rootOccurrenceIds).toEqual([other.id]);
        expect(result.connections).toHaveLength(3);
        expect(result.occurrences[other.id]).toEqual(other);
        break;
      }
      default: externalConnections satisfies never;
    }
  });

  it.each(["__proto__", "constructor", "terrainTemplates"])("preserves opaque root %s when an occurrence is instantiated", rootId => {
    // Given
    const { project, document, request } = instancesFixture();
    // When
    const result = instantiateSpatialDesign(document, project, { ...request, rootId });
    // Then
    expect(deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring?.rootOccurrenceIds).toEqual([rootId]);
    expect(Object.values(result.occurrences)).toHaveLength(16);
  });

  it.each(["__proto__", "constructor", "terrainTemplates"])("preserves opaque root %s when a subtree is duplicated", rootId => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    // When
    const result = duplicateSpatialOccurrence(placed, project, { occurrenceId: spatialId(request.rootId), rootId, externalConnections: "omit" });
    // Then
    expect(deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring?.rootOccurrenceIds).toEqual([request.rootId, rootId]);
    expect(Object.values(result.occurrences)).toHaveLength(32);
  });

  it("rejects amplified cells before cloning when valid section pixels exceed the snapshot budget", () => {
    // Given
    const { project, document, request, tilesetId } = instancesFixture();
    own(project.tilesets, tilesetId).structureKits = [{ id: "kit", kind: "section", width: 64, height: 64, rows: Array.from({ length: 64 }, () => ({ tiles: Array.from({ length: 64 }, () => 1) })), learnedFrom: "db-authored" }];
    const room = own(document.library.spaces, "room");
    const input = { ...document, library: { ...document.library, spaces: { room: { ...room, objectSlots: [{ ...first(room.objectSlots), quantity: 1024 }] } } } };
    // When / Then
    expect(() => instantiateSpatialDesign(input, project, { ...request, source: { kind: "space", id: room.id } })).toThrow(SpatialOperationError);
  });

  it("stops requesting rasters when their transitive copy cost exceeds the cell budget", () => {
    // Given
    const { project, document, request, tilesetId } = instancesFixture();
    own(project.tilesets, tilesetId).structureKits = [{ id: "kit", kind: "house", houseKitId: "old", wings: [], learnedFrom: "db-authored" }];
    const room = own(document.library.spaces, "room");
    const objects = Array.from({ length: 9 }, (_, index) => ({ ...own(document.library.objects, "desk"), id: spatialId(`desk-${index}`) }));
    const cells = Array.from({ length: 256 * 256 }, (_, index) => ([
      { x: index % 256, y: Math.floor(index / 256), layer: "lower", tile: 1 },
      { x: index % 256, y: Math.floor(index / 256), layer: "upper", tile: 2 },
    ] as const)).flat();
    const input = { ...document, library: { ...emptySpatialLibrary(), objects: Object.fromEntries(objects.map(object => [object.id, object])), spaces: {
      room: { ...room, objectSlots: objects.map(object => ({ ...first(room.objectSlots), id: object.id, objectDesignId: object.id, quantity: 1 })) },
    } } };
    let calls = 0;
    const rasterizeHouse: SpatialRasterAdapter = graphic => { calls++; return { ...graphic, width: 256, height: 256, cells }; };
    // When
    expect(() => instantiateSpatialDesign(input, { ...project, rasterizeHouse }, { ...request, source: { kind: "space", id: room.id } })).toThrow(SpatialOperationError);
    // Then: each raster is copied in the parent and object snapshot; do not request the remaining four.
    expect(calls).toBe(5);
  });

  it("freezes exact builtin cells when the qualified shared resolver selects them", () => {
    // Given
    const { project, document } = instancesFixture();
    const builtin = INTERIOR_OBJECT_CATALOG.find(object => object.id === "bed_h");
    if (!builtin) throw new TypeError("Builtin fixture missing");
    const input = { ...document, library: { ...emptySpatialLibrary(), objects: { desk: { ...own(document.library.objects, "desk"), graphic: { tilesetId: INTERIOR_TILESET_ID, kitId: builtin.id } } } } };
    // When
    const result = resolveSpatialDesign(input, project, { kind: "object", id: spatialId("desk") });
    // Then
    expect(result.snapshot.kitCells.desk?.cells).toEqual(builtin.cells.map(({ dx, dy, layer, tile }) => ({ x: dx, y: dy, layer, tile })));
  });
});
