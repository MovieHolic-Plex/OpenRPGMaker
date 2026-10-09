import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { CONCEPT_FLOOR_TILES } from "../src/editor/conceptBundleResolve";
import { own, requireOccurrenceAssociations, spatialId, resolveOccurrencePortId } from "../src/project/spatial/domain";
import { fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors } from "./support/spatialConnectionSceneFixture";
import { exteriorPlaceFixture } from "./support/spatialPlaceGeometryFixture";

describe("nested place geometry", () => {
  it("translates outdoor rasters when actual children move independently of their frozen slots", () => {
    // Given: actual coordinates deliberately differ from the frozen square slot.
    const fixture = placeCompilerFixture();
    const id = placeChild(fixture, placeRoot, "square");
    const input = replaceOccurrence(fixture, { ...own(fixtureDocument(fixture).occurrences, id), x: 7, y: 9 });
    // When: compile the enclosing place.
    const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
    // Then: the exact output rectangle honors the actual occurrence.
    expect(own(fixtureDocument(output).occurrences, id).bindings[0]?.rect).toEqual({ x: 7, y: 9, width: 20, height: 16 });
  });

  it("keeps the frozen mixed-layer exterior on its atlas when a natural place contains a facility", () => {
    // Given: a frozen section exterior, not a live kit lookup during compilation.
    const input = exteriorPlaceFixture();
    const innId = placeChild(input, placeRoot, "inn");
    const squareId = placeChild(input, placeRoot, "square");
    // When: compile actual nested children and exterior cells.
    const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
    // Then: same-plane outdoor surfaces share one atlas; the upper exterior cell is exact.
    const exterior = own(fixtureDocument(output).occurrences, innId).bindings.find(binding => binding.kind === undefined);
    const square = own(fixtureDocument(output).occurrences, squareId).bindings[0];
    expect(exterior?.mapId).toBe(square?.mapId);
    if (!exterior) throw new TypeError("Missing exterior ownership");
    const map = own(output.maps, exterior.mapId);
    const frozen = own(own(fixtureDocument(input).occurrences, innId).snapshot.kitCells, "nested-inn-design");
    for (const cell of frozen.cells) expect((cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[(8 + cell.y) * map.width + 24 + cell.x]).toBe(cell.tile);
    expect(stairFloors(output).map(floor => own(fixtureDocument(output).occurrences, floor.roomId).bindings[0]?.mapId))
      .not.toContain(exterior.mapId);
  });

  it("resolves a place's named port exactly when persisted local associations link its exterior to a room", () => {
    // Given: an exterior local port with an explicit persisted room connection.
    const input = exteriorPlaceFixture(true);
    // When: compile the natural place.
    const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
    // Then: the declared entry is neither moved nor inferred from containment.
    const inn = requireOccurrenceAssociations(own(fixtureDocument(output).occurrences, placeChild(input, placeRoot, "inn")));
    expect(inn.bindings.flatMap(binding => binding.ports)).toContainEqual({ portId: resolveOccurrencePortId(inn, spatialId("door")), x: 26, y: 10 });
    expect(output.mapConnections).toHaveLength(2);
  });

  it("keeps outdoor atlases separate when a frozen exterior uses a different atlas", () => {
    // Given: only this actual exterior snapshot changes atlas, not the live parent design.
    const fixture = exteriorPlaceFixture();
    const innId = placeChild(fixture, placeRoot, "inn");
    const inn = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, innId));
    const design = own(inn.snapshot.library.places, inn.source.id);
    const frozen = own(inn.snapshot.kitCells, design.id);
    const atlas = "easyrpg_chipset_interior";
    const input = replaceOccurrence(fixture, { ...inn, snapshot: { ...inn.snapshot,
      library: { ...inn.snapshot.library, places: { ...inn.snapshot.library.places,
        [design.id]: { ...design, exterior: { tilesetId: atlas, kitId: frozen.kitId } } } },
      kitCells: { ...inn.snapshot.kitCells, [design.id]: { ...frozen, tilesetId: atlas,
        cells: frozen.cells.filter(cell => cell.layer === "lower").map(cell => ({ ...cell, tile: CONCEPT_FLOOR_TILES.wood })) } } } });
    // When: compile both outdoor surfaces.
    const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
    // Then: incompatible atlases are never mixed in a single map.
    const exterior = own(fixtureDocument(output).occurrences, innId).bindings[0];
    const square = own(fixtureDocument(output).occurrences, placeChild(input, placeRoot, "square")).bindings[0];
    expect(exterior?.mapId).not.toBe(square?.mapId);
    if (!exterior) throw new TypeError("Missing exterior");
    expect(own(output.maps, exterior.mapId).tilesetId).toBe(atlas);
  });

  it("keeps actual levels separate when a square moves off the exterior's plane", () => {
    // Given: actual level differs from the frozen parent slot's level zero.
    const fixture = exteriorPlaceFixture();
    const squareId = placeChild(fixture, placeRoot, "square");
    const input = replaceOccurrence(fixture, { ...own(fixtureDocument(fixture).occurrences, squareId), level: 1 });
    // When: compile the nested place.
    const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
    // Then: same atlas and overlapping plane coordinates do not flatten different levels.
    const document = fixtureDocument(output);
    expect(own(document.occurrences, squareId).bindings[0]?.mapId)
      .not.toBe(own(document.occurrences, placeChild(input, placeRoot, "inn")).bindings[0]?.mapId);
  });

  it("keeps an authored automatic-slot override when its actual coordinates are no longer placeholders", () => {
    // Given: an actual bed moved from its unplaced 0,0 placeholder.
    const fixture = placeCompilerFixture();
    const floor = stairFloors(fixture)[0];
    if (!floor) throw new TypeError("Missing fixture floor");
    const bedId = placeChild(fixture, floor.roomId, "beds");
    const input = replaceOccurrence(fixture, { ...own(fixtureDocument(fixture).occurrences, bedId), x: 6, y: 3 });
    // When: compile the root, without replacing its actual bed child.
    const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
    // Then: the shell offset is the only coordinate translation.
    expect(own(fixtureDocument(output).occurrences, bedId).bindings[0]?.rect).toEqual({ x: 8, y: 7, width: 1, height: 2 });
  });
});
