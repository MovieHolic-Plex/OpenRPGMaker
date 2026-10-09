import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { isPassableLanding } from "../src/project/collision";
import { serialize } from "../src/project/io";
import { own } from "../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

describe("bounded geography public compiler", () => {
  it.each(["region", "world"] as const)("emits traversable overview entries when a %s has positioned children", kind => {
    // Given: validated frozen geography containing the actual task9 nested-place fixture.
    const input = geographyFixture(kind);
    const before = serialize(input);
    // When: the existing public compiler receives the geographic root.
    const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: real overview tiles and transfers exist, not name/count-only results.
    const root = own(fixtureDocument(output).occurrences, geographyRoot);
    const binding = root.bindings.find(isOwnedSpatialBinding);
    expect(binding).toBeDefined();
    if (!binding) throw new TypeError("Missing geographic raster owner");
    const overview = own(output.maps, binding.mapId);
    expect(overview.tilesetId).toBe("easyrpg_chipset_world");
    expect(overview.lowerTiles.some(tile => tile >= 0)).toBe(true);
    const transfers = output.mapConnections?.filter(connection => connection.from.mapId === overview.id);
    expect(transfers?.length).toBeGreaterThan(0);
    for (const connection of transfers ?? []) {
      expect(isPassableLanding(output, own(output.maps, connection.to.mapId), connection.to.x, connection.to.y)).toBe(true);
    }
    expect(serialize(input)).toBe(before);
  });
});
