import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence, SpatialCompileError } from "../src/editor/spatial/compileSpatialOccurrence";
import { resolveMaterialSlots } from "../src/editor/operators/materialSlots";
import { canMove, isPassableLanding } from "../src/project/collision";
import { autotileGroupsForTileset } from "../src/project/defaults/autotileGroups";
import { SAND_TILE } from "../src/project/defaults/chipsetMapping";
import { deserialize, serialize } from "../src/project/io";
import { computeReachableCells } from "../src/project/lint/reachability";
import { own, spatialId } from "../src/project/spatial/domain";
import { outdoorShapeFixture } from "./support/spatialOutdoorShapeFixture";
import { fixtureDocument, reinstantiateSpace, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { inspectCompiledSpace } from "./support/spatialCompilerAssertions";
import { inspectOutdoorShape } from "./support/spatialOutdoorAssertions";

const shapes = ["rect", "l", "alcove"] as const;
describe("outdoor compiler footprint", () => {
  it.each(shapes)("clips material rectangles and polygons to the %s shape when rasterizing 22x16", shape => {
    // Given: an independent cell oracle, not the compiler's footprint helper.
    const input = reinstantiateSpace(outdoorShapeFixture(19, shape), space => ({ ...space, objectSlots: [] }));
    const before = JSON.stringify(input);
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then: every material cell and every excluded corner obey real engine collision.
    const map = own(proposal.maps, `spatial:${spaceRoot}`);
    const tileset = own(proposal.tilesets, map.tilesetId);
    const slots = resolveMaterialSlots(tileset);
    const materialTiles = Object.fromEntries(Object.entries(slots).map(([id, slot]) => [id, [
      ...slot.tiles, ...autotileGroupsForTileset(tileset).filter(group => group.memberTileIds.includes(slot.body ?? slot.tiles[0] ?? -1))
        .flatMap(group => Object.values(group.variantMap)),
    ]]));
    const reached = computeReachableCells(proposal, map, 10, 14);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) {
      const inside = shape === "rect" || y >= 2 || (x < 15 && (shape === "l" || x >= 2));
      const tile = map.lowerTiles[y * 22 + x];
      const material = x >= 12 && y <= x - 12 ? "shore" : y < 3 ? "path" : "ground";
      if (inside) expect(own(materialTiles, material)).toContain(tile);
      else expect([tile, map.upperTiles[y * 22 + x]]).toEqual([-1, -1]);
      expect(isPassableLanding(proposal, map, x, y)).toBe(inside);
      expect(reached.has(`${x},${y}`)).toBe(inside);
    }
    expect(reached.size).toBe(shape === "rect" ? 352 : shape === "l" ? 338 : 334);
    expect(map.lowerTiles[14]).toBe(shape === "rect" ? SAND_TILE.EDGE_NORTH : SAND_TILE.CORNER_NORTH_EAST);
    expect(canMove(proposal, map, 14, 0, 15, 0)).toBe(shape === "rect");
    expect(canMove(proposal, map, 21, 2, 21, 1)).toBe(shape === "rect");
    expect(deserialize(serialize(proposal)).maps[map.id]).toEqual(map);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(shapes)("keeps required fixed and automatic objects inside %s when composing frozen occurrences", shape => {
    // Given
    const input = outdoorShapeFixture(31, shape);
    const before = JSON.stringify(input);
    // When
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then
    const receipt = inspectCompiledSpace(input, proposal);
    expect(receipt.accessibleRequiredObjects).toBe(3);
    expect(inspectOutdoorShape(proposal).checkedCells).toBe(352);
    expect(receipt.objects.find(object => object.occurrenceId.includes("tree-slot"))?.rect).toEqual({ x: 2, y: 2, width: 1, height: 2 });
    for (const object of receipt.objects) for (const cell of object.cells) {
      expect(shape === "rect" || cell.y >= 2 || (cell.x < 15 && (shape === "l" || cell.x >= 2))).toBe(true);
    }
    expect(compileSpatialOccurrence(deserialize(serialize(proposal)), { occurrenceId: spaceRoot })).toEqual(proposal);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(["l", "alcove"] as const)("rejects required fixed cells atomically when they straddle the %s cutout", shape => {
    // Given
    const input = reinstantiateSpace(outdoorShapeFixture(7, shape), space => ({ ...space, objectSlots: space.objectSlots.map(slot =>
      slot.id === "tree-slot" ? { ...slot, placement: { mode: "fixed", x: 15, y: 1 } } : slot) }));
    const before = JSON.stringify(input);
    // When / Then
    expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(expect.objectContaining({ code: "clipped" }));
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(["entry", "port"] as const)("rejects an outside-shape %s atomically instead of relocating it", failure => {
    // Given
    const input = reinstantiateSpace(outdoorShapeFixture(7, "alcove"), space => ({ ...space, objectSlots: [],
      ports: failure === "entry" ? [{ id: spatialId("corner"), name: "Corner", x: 0, y: 0 }]
        : [...space.ports, { id: spatialId("corner"), name: "Corner", x: 21, y: 0 }] }));
    const before = JSON.stringify(input);
    // When / Then
    expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(expect.objectContaining({ code: failure }));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects a child port when its authored offset lands outside the containing shape", () => {
    // Given: the flower is inside at (14,1), but its anchor at (15,1) is outside.
    const base = outdoorShapeFixture(19, "l");
    const document = fixtureDocument(base);
    const flower = own(document.library.objects, "flower");
    base.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
      flower: { ...flower, anchors: [{ id: spatialId("edge"), name: "Edge", x: 1, y: 0 }] } } } };
    const input = reinstantiateSpace(base, space => ({ ...space, objectSlots: space.objectSlots.filter(slot => slot.id === "flower-slot")
      .map(slot => ({ ...slot, quantity: 1, placement: { mode: "fixed", x: 14, y: 1 } })) }));
    const before = JSON.stringify(input);
    // When / Then
    expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(SpatialCompileError);
    expect(JSON.stringify(input)).toBe(before);
  });
});
