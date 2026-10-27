import { expect, it } from "vitest";
import { retiredEasyRpgTileset, RETIRED_INTERIOR_TILESET_ID } from "./support/retiredEasyRpgTilesets";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById } from "@/editor/interiorObjectCatalog";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { applyEasyRpgThemeMetadataPacks, INTERIOR_HARNESS_GROUPS } from "@/project/tilesetHarness/themePacks";

// Removed beforeAll that built an inn with place_concept: place_concept was removed from the tool registry on purpose.

// Removed it "uses one complete 1x1 stair": place_concept was removed from the tool registry on purpose.

// Removed it "marks the lower entrance with tile 176": place_concept was removed from the tool registry on purpose.

// Removed it "puts the entrance marker on the south wall": place_concept was removed from the tool registry on purpose.

it("removes rejected tiles from classification, groups and generated furniture", () => {
  const rejected = [408, 409, 410];
  // The rejected tiles and theme packs are EasyRPG interior numbers; that sheet is retired, so build its old definition explicitly.
  const tileset = retiredEasyRpgTileset(RETIRED_INTERIOR_TILESET_ID);
  for (const tile of rejected) {
    tileset.tileMeta![tile] = { label: "old-counter", description: "", source: "bundled-default", tags: ["counter"] };
  }
  applyEasyRpgThemeMetadataPacks(tileset);
  for (const tile of rejected) {
    expect(INTERIOR_TILE_SEMANTICS.some(entry => entry.index === tile)).toBe(false);
    expect(INTERIOR_HARNESS_GROUPS.some(group => group.tileIds.includes(tile))).toBe(false);
    expect(INTERIOR_OBJECT_CATALOG.some(object => object.cells.some(cell => cell.tile === tile))).toBe(false);
    expect(tileset.tileMeta?.[tile]?.source).toBe("unknown");
  }
  // Removed the generated-inn check: place_concept was removed from the tool registry on purpose.
});

it("classifies 209 and 239 as a vertical flue assembly", () => {
  for (const tile of [209, 239]) {
    const semantic = INTERIOR_TILE_SEMANTICS.find(entry => entry.index === tile);
    expect(semantic?.tags).toContain("flue");
    expect(semantic?.tags).not.toContain("boiler");
  }
  expect(interiorObjectById("flue")?.cells.map(cell => [cell.dx, cell.dy, cell.tile])).toEqual([[0, 0, 209], [0, 1, 239]]);
});
