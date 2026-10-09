import { describe, expect, it } from "vitest";
import { createPaletteStampFromDisplayDrag, createPaletteStampFromDrag, paletteStampIncludesTile } from "@/editor/tilePaletteStamp";
import type { TilesetDef } from "@/project/types";

describe("tile palette drag stamps", () => {
  it("creates a source-preserving 3x3 stamp from dragged chipset tiles", () => {
    const tileset = testTileset();

    const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

    expect(stamp.width).toBe(3);
    expect(stamp.height).toBe(3);
    expect(stamp.cells.map((cell) => cell.tile)).toEqual([10, 11, 12, 18, 19, 20, 26, 27, 28]);
    expect(stamp.cells.find((cell) => cell.tile === 19)).toEqual({ dx: 1, dy: 1, layer: "upper", tile: 19 });
  });

  it("marks every source tile inside the dragged rectangle", () => {
    const tileset = testTileset();
    const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

    expect(paletteStampIncludesTile(stamp, 19, tileset.tilesPerRow)).toBe(true);
    expect(paletteStampIncludesTile(stamp, 29, tileset.tilesPerRow)).toBe(false);
  });

  it("creates a stamp from the visible reordered palette grid", () => {
    const tileset = testTileset();
    const displayTiles = [240, 303, 421, 424, 342, 343, 306, 366, 374, 375, 270, 120, 93, 123, 153, 246];

    const stamp = createPaletteStampFromDisplayDrag({
      displayTiles,
      displayTilesPerRow: 10,
      endTile: 270,
      startTile: 303,
      tileset: { ...tileset, count: 512 },
    });

    expect(stamp.width).toBe(2);
    expect(stamp.height).toBe(2);
    expect(stamp.cells.map((cell) => cell.tile)).toEqual([240, 303, 270, 120]);
    expect(paletteStampIncludesTile(stamp, 303, tileset.tilesPerRow)).toBe(true);
    expect(paletteStampIncludesTile(stamp, 342, tileset.tilesPerRow)).toBe(false);
  });
});

function testTileset(): TilesetDef {
  return {
    count: 64,
    id: "test",
    image: { id: "test-image", type: "uploaded" },
    name: "Test",
    passability: Array.from({ length: 64 }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: 64 }, (_, index) => index === 19 ? "upper" : "lower"),
    terrain: Array.from({ length: 64 }, () => 0),
    tileSize: 16,
    tilesPerRow: 8,
  };
}
