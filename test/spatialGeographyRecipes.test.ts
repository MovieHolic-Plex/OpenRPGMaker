import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { canMove } from "../src/project/collision";
import { WORLD_STRUCTURE_RULES } from "../src/project/defaults/worldStructureRules";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own } from "../src/project/spatial/domain";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyRecipeFixture, regionRecipes, worldRecipes } from "./support/spatialGeographyRecipes";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

describe("real geography contract recipes", () => {
  it.each([...regionRecipes.map(recipe => recipe.id), ...worldRecipes])("compiles exact terrain and entry identities when %s is instantiated", recipeId => {
    // Given: six differentiated authored rasters and two exact three-region chains.
    const input = geographyRecipeFixture(recipeId);
    const before = serialize(input);
    // When: compile through the existing public seam.
    const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: actual maps, pair ownership and canonical reload survive.
    const document = fixtureDocument(output);
    const owner = own(document.occurrences, geographyRoot);
    const binding = owner.bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Missing geographic owner");
    const map = own(output.maps, binding.mapId);
    expect([map.width, map.height]).toEqual(owner.kind === "world" ? [96, 64] : [128, 96]);
    expect(binding.overviewEntries?.map(entry => entry.target.occurrenceId)).toEqual(Object.values(document.occurrences)
      .filter(child => child.parentId === owner.id).map(child => child.id));
    expect(serialize(deserialize(serialize(output)))).toBe(serialize(output));
    expect(serialize(input)).toBe(before);
  });

  it("uses a real directional bridge when an authored route crosses lake water", () => {
    // Given: a full-height water strip with an explicit east-west crossing.
    const input = geographyRecipeFixture("lake-country");
    // When: compile the region.
    const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: deck/support remain real World primitives, not water erased to dirt.
    const binding = own(fixtureDocument(output).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Missing owner");
    const map = own(output.maps, binding.mapId);
    expect(map.upperTiles[40 * map.width + 55]).toBe(WORLD_STRUCTURE_RULES.bridge.horizontal.deck);
    expect(map.upperTiles[41 * map.width + 55]).toBe(WORLD_STRUCTURE_RULES.bridge.horizontal.support);
    expect(canMove(output, map, 54, 40, 55, 40)).toBe(true);
    expect(canMove(output, map, 55, 40, 55, 41)).toBe(false);
  });

  it("retains stair passage when the explicit high-pass route climbs the mountain", () => {
    // Given: a bounded authored mountain rectangle and a route through its central stair.
    const input = geographyRecipeFixture("high-pass");
    // When: compile the region.
    const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: the primitive staircase survives path painting.
    const binding = own(fixtureDocument(output).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Missing owner");
    const map = own(output.maps, binding.mapId);
    expect(map.lowerTiles[35 * map.width + 55]).toBe(WORLD_STRUCTURE_RULES.mountain.stair);
    expect(canMove(output, map, 55, 36, 55, 35)).toBe(true);
    expect(canMove(output, map, 55, 35, 54, 35)).toBe(false);
  });
});
