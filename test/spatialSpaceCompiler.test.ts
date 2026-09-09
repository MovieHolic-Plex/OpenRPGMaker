import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { own, findOccurrenceChildId, spatialId, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { deleteSpatialOccurrence } from "../src/project/spatial/ownership";
import { emptySpatialLibrary } from "../src/project/spatial/resolve";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { deserialize, serialize, ProjectFormatError } from "../src/project/io";
import { interiorRoomRects } from "../src/project/interiorRoomFootprint";
import { isPassableLanding } from "../src/project/collision";
import { CONCEPT_FLOOR_TILES } from "../src/editor/conceptBundleResolve";
import { resolveMaterialSlots } from "../src/editor/operators/materialSlots";
import { SpatialCompileError } from "../src/editor/spatial/compilerTypes";
import { fixtureDocument, spaceCompilerFixture, spaceRoot, interiorAtlas, reinstantiateSpace, replaceOccurrence, outdoorCompilerFixture, objectStampFixture } from "./support/spatialSpaceCompilerFixture";
import { inspectCompiledSpace } from "./support/spatialCompilerAssertions";

describe("spatial space compiler", () => {
  it("paints the frozen mixed-layer assembly when a space is compiled", () => {
    // Given
    const input = spaceCompilerFixture();
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const binding = own(fixtureDocument(proposal).occurrences, spaceRoot).bindings[0];
    expect(binding).toBeDefined();
    if (!binding) throw new TypeError("Compiler returned no raster binding");
    const map = own(proposal.maps, binding.mapId);
    expect(map.lowerTiles[8 * map.width + 3]).toBe(402);
    expect(map.upperTiles[10 * map.width + 4]).toBe(124);
  });

  it.each(["rect", "l", "alcove"] as const)("preserves the %s footprint and two independent beds when composed", shape => {
    // Given
    const input = spaceCompilerFixture(19, shape);
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const receipt = inspectCompiledSpace(input, proposal);
    const beds = receipt.objects.filter(object => object.occurrenceId.includes("beds"));
    expect(beds).toHaveLength(2);
    expect(beds[0]?.rect).not.toEqual(beds[1]?.rect);
    const map = own(proposal.maps, receipt.mapId);
    const footprint = interiorRoomRects({ x: 2, y: 4, w: 16, h: 12, shape });
    for (let y = 4; y < 6; y++) for (let x = 2; x < 18; x++) {
      const inside = footprint.some(rect => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h);
      expect(isPassableLanding(proposal, map, x, y)).toBe(inside);
    }
  });

  it("co-locates named child and space ports without duplicate ownership when a fixed stair is the entry", () => {
    // Given
    const input = spaceCompilerFixture();
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const receipt = inspectCompiledSpace(input, proposal);
    expect(receipt.ports.map(port => [port.x, port.y])).toEqual([[10, 15], [10, 15]]);
    expect(new Set(receipt.ports.map(port => port.portId)).size).toBe(2);
    expect(receipt.requiredObjects).toBe(4);
  });

  it("uses the stored fixed coordinates when an occurrence has moved independently of its source slot", () => {
    // Given
    const base = spaceCompilerFixture();
    const hearth = Object.values(fixtureDocument(base).occurrences).find(child => child.source.id === "hearth-design");
    if (!hearth) throw new TypeError("Missing hearth");
    const input = replaceOccurrence(base, { ...hearth, x: 2, y: 5 });
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    expect(own(fixtureDocument(proposal).occurrences, hearth.id).bindings[0]?.rect).toMatchObject({ x: 4, y: 9 });
  });

  it("keeps the missing repetition absent when the first bed occurrence was deleted", () => {
    // Given
    const input = spaceCompilerFixture();
    const document = fixtureDocument(input);
    const deleted = findOccurrenceChildId(document, spaceRoot, { slotId: spatialId("beds"), index: 0 });
    if (!deleted) throw new TypeError("Missing repeated bed");
    input.spatialAuthoring = deleteSpatialOccurrence(document, input, { occurrenceId: deleted, externalConnections: "reject" });
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const receipt = inspectCompiledSpace(input, proposal);
    expect(receipt.objects).toHaveLength(3);
    expect(fixtureDocument(proposal).occurrences[deleted]).toBeUndefined();
    expect(receipt.eventIds.some(id => id.includes(deleted))).toBe(false);
  });

  it("preserves an opaque stored identity when the legacy adapter trims ordinary strings", () => {
    // Given
    const input = spaceCompilerFixture();
    const document = fixtureDocument(input);
    const oldId = findOccurrenceChildId(document, spaceRoot, { slotId: spatialId("beds"), index: 0 });
    const id = spatialId(" stored / bed : [7] ");
    input.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(child =>
      child.id === oldId ? [id, { ...child, id }] : [child.id, child])) };
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    expect(own(fixtureDocument(proposal).occurrences, id).bindings).toHaveLength(1);
    expect(own(proposal.maps, `spatial:${spaceRoot}`).events.some(event => event.id.includes(id))).toBe(true);
  });

  it("includes an outside-footprint anchor without moving the fixed raster when its local coordinate is negative", () => {
    // Given
    const base = spaceCompilerFixture();
    const document = fixtureDocument(base);
    const object = own(document.library.objects, "hearth-design");
    base.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
      [object.id]: { ...object, anchors: [{ id: spatialId("left-access"), name: "Left access", x: -1, y: 1 }] } } } };
    const input = reinstantiateSpace(base, space => space);
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const child = Object.values(fixtureDocument(proposal).occurrences).find(child => child.source.id === object.id);
    expect(child?.bindings[0]?.rect).toEqual({ x: 2, y: 8, width: 4, height: 3 });
    expect(child?.bindings[0]?.ports[0]).toMatchObject({ x: 2, y: 9 });
    expect(own(proposal.maps, `spatial:${spaceRoot}`).lowerTiles[8 * 20 + 3]).toBe(402);
  });

  it("preserves per-occurrence bed selections when one frozen child uses a horizontal bed", () => {
    // Given
    const base = spaceCompilerFixture();
    const id = findOccurrenceChildId(fixtureDocument(base), spaceRoot, { slotId: spatialId("beds"), index: 1 });
    if (!id) throw new TypeError("Missing bed");
    const child = requireOccurrenceAssociations(own(fixtureDocument(base).occurrences, id));
    const design = own(child.snapshot.library.objects, child.source.id);
    const graphic = { tilesetId: interiorAtlas, kitId: "bed_h" };
    const input = replaceOccurrence(base, { ...child, snapshot: { ...child.snapshot,
      library: { ...child.snapshot.library, objects: { [design.id]: { ...design, graphic } } },
      kitCells: { [design.id]: snapshotGraphic(base, graphic) } } });
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const receipt = inspectCompiledSpace(input, proposal);
    expect(receipt.objects.filter(object => object.occurrenceId.includes("beds")).map(object => [object.rect.width, object.rect.height])).toEqual([[1, 2], [2, 1]]);
  });

  it("keeps frozen cells when source designs are removed and the live kit is replaced", () => {
    // Given
    const input = spaceCompilerFixture();
    const before = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    input.spatialAuthoring = { ...fixtureDocument(input), library: emptySpatialLibrary() };
    const tileset = own(input.tilesets, interiorAtlas);
    tileset.structureKits = [];
    const callerBefore = JSON.stringify(input);
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    expect(own(proposal.maps, `spatial:${spaceRoot}`)).toEqual(own(before.maps, `spatial:${spaceRoot}`));
    expect(JSON.stringify(input)).toBe(callerBefore);
  });

  it("returns identical IDs, cells and events when compiled again after project IO", () => {
    // Given
    const input = spaceCompilerFixture(31);
    const first = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    const reloaded = deserialize(serialize(first));
    const before = JSON.stringify(reloaded);
    // When
    const proposal = compileSpatialOccurrence(reloaded, { occurrenceId: spaceRoot });
    // Then
    expect(proposal).toEqual(first);
    expect(JSON.stringify(reloaded)).toBe(before);
    expect(new Set(own(proposal.maps, `spatial:${spaceRoot}`).events.map(event => event.id)).size).toBe(3);
  });

  it.each(["port", "atlas", "required", "material", "entry", "blocked", "connection"] as const)("rejects atomically when %s is invalid", failure => {
    // Given
    const base = spaceCompilerFixture();
    const input = reinstantiateSpace(base, space => {
      switch (failure) {
        case "port": return { ...space, ports: [...space.ports, { id: spatialId("blocked-port"), name: "Blocked", x: 1, y: 4 }] };
        case "atlas": return { ...space, tilesetId: "easyrpg_chipset_combined_town" };
        case "required": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "beds" ? { ...slot, quantity: 80 } : slot) };
        case "material": return { ...space, floor: "unmapped-material" };
        case "entry": return { ...space, shape: "l", ports: [{ id: spatialId("entry"), name: "Entry", x: 15, y: 0 }] };
        case "blocked": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "stairs" ? { ...slot, placement: { mode: "fixed", x: 1, y: 4 } } : slot) };
        case "connection": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "hearth" ? { ...slot, chipOverrides: ["transfer"] } : slot) };
      }
    });
    const before = JSON.stringify(input);
    // When
    let rejection: unknown;
    try { compileSpatialOccurrence(input, { occurrenceId: spaceRoot }); }
    catch (error) { if (!(error instanceof SpatialCompileError)) throw error; rejection = error; }
    // Then
    expect(rejection).toBeInstanceOf(SpatialCompileError);
    expect(rejection).toMatchObject({ code: failure });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("omits optional repetitions when the room is full without changing required placement", () => {
    // Given
    const input = reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, objectSlots: space.objectSlots.map(slot =>
      slot.id === "beds" ? { ...slot, quantity: 80, required: false } : slot) }));
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const children = Object.values(fixtureDocument(proposal).occurrences);
    expect(children.filter(child => child.parentSlot?.slotId === "beds" && child.bindings.length === 0).length).toBeGreaterThan(0);
    expect(children.find(child => child.parentSlot?.slotId === "hearth")?.bindings).toHaveLength(1);
  });

  it("rejects ownership when generated pixels have been edited", () => {
    // Given
    const input = compileSpatialOccurrence(spaceCompilerFixture(), { occurrenceId: spaceRoot });
    own(input.maps, `spatial:${spaceRoot}`).lowerTiles[0] = CONCEPT_FLOOR_TILES.stone;
    const before = JSON.stringify(input);
    // When / Then
    expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(SpatialCompileError);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(["stone", "plank", "mat"] as const)("uses the backend %s floor without legacy filler when no objects remain", material => {
    // Given
    const input = reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, floor: material, objectSlots: [] }));
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const map = own(proposal.maps, `spatial:${spaceRoot}`);
    expect(map.lowerTiles[8 * map.width + 8]).toBe(CONCEPT_FLOOR_TILES[material]);
    expect(map.upperTiles.every(tile => tile === -1)).toBe(true);
    expect(map.events).toHaveLength(0);
  });

  it("rejects shared raster authority when a child projection is changed to an owned binding", () => {
    // Given
    const proposal = compileSpatialOccurrence(spaceCompilerFixture(), { occurrenceId: spaceRoot });
    const child = Object.values(fixtureDocument(proposal).occurrences).find(child => child.parentSlot?.slotId === "stairs");
    if (!child || !child.bindings[0]) throw new TypeError("Missing projected stair");
    const projection = child.bindings[0];
    const invalid = replaceOccurrence(proposal, { ...child, bindings: [{ mapId: projection.mapId, rect: projection.rect,
      ports: projection.ports, eventIds: [], connectionIds: [], contentDigest: "0".repeat(64) }] });
    // When / Then
    expect(() => deserialize(JSON.stringify(invalid))).toThrowError(ProjectFormatError);
  });

  it("honors frozen chip overrides when the source still has an inspect chip", () => {
    // Given
    const input = reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, objectSlots: space.objectSlots.map(slot =>
      slot.id === "hearth" ? { ...slot, chipOverrides: ["sleep"] } : slot) }));
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const events = own(proposal.maps, `spatial:${spaceRoot}`).events;
    expect(events.flatMap(event => event.pages?.flatMap(page => page.commands) ?? []).filter(command => command.kind === "inn")).toHaveLength(1);
  });

  it("paints explicit rectangle and polygon materials when an outdoor space is compiled", () => {
    // Given
    const input = outdoorCompilerFixture();
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const receipt = inspectCompiledSpace(input, proposal);
    const map = own(proposal.maps, receipt.mapId);
    const slots = resolveMaterialSlots(own(input.tilesets, map.tilesetId));
    expect(slots.path?.tiles).toContain(map.lowerTiles[13 * map.width + 5]);
    expect(slots.shore?.tiles).toContain(map.lowerTiles[4 * map.width + 15]);
    expect(slots.ground?.tiles).toContain(map.lowerTiles[3 * map.width + 10]);
    expect(receipt.objects).toHaveLength(3);
  });

  it("stamps exact cells into the explicit compatible rectangle when an object is standalone", () => {
    // Given
    const { project, ...request } = objectStampFixture();
    const before = JSON.stringify(project);
    // When
    const proposal = compileSpatialOccurrence(project, request);
    // Then
    const map = own(proposal.maps, request.target.mapId);
    expect(map.lowerTiles[3 * map.width + 3]).toBe(402);
    expect(map.upperTiles[5 * map.width + 4]).toBe(124);
    expect(map.lowerTiles[0]).toBe(CONCEPT_FLOOR_TILES.wood);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("keeps object event IDs stable when the same standalone stamp is compiled after reload", () => {
    // Given
    const { project, ...request } = objectStampFixture();
    const first = compileSpatialOccurrence(project, request);
    const input = deserialize(serialize(first));
    // When
    const proposal = compileSpatialOccurrence(input, request);
    // Then
    expect(proposal).toEqual(first);
    expect(own(proposal.maps, request.target.mapId).events).toHaveLength(1);
  });

  it.each(["atlas", "clipped", "blocked", "target"] as const)("rejects a standalone stamp atomically when %s fails", failure => {
    // Given
    const { project, ...request } = objectStampFixture();
    const map = own(project.maps, request.target.mapId);
    if (failure === "atlas") map.tilesetId = "easyrpg_chipset_combined_town";
    if (failure === "blocked") map.upperTiles[3 * map.width + 3] = 402;
    const target = failure === "clipped" ? { ...request.target, rect: { ...request.target.rect, width: 2 } } : request.target;
    const before = JSON.stringify(project);
    // When
    let rejection: unknown;
    try { compileSpatialOccurrence(project, failure === "target" ? { occurrenceId: request.occurrenceId } : { ...request, target }); }
    catch (error) { if (!(error instanceof SpatialCompileError)) throw error; rejection = error; }
    // Then
    expect(rejection).toMatchObject({ code: failure });
    expect(JSON.stringify(project)).toBe(before);
  });
});
