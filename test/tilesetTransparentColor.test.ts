import { describe, expect, it } from "vitest";
import { resolveTransparentColorKeys } from "@/assets/chipsetTransparency";
import type { TilesetDef } from "@/project/types";

function tileset(patch: Partial<TilesetDef> = {}): TilesetDef {
  return {
    id: "test_tileset",
    name: "Test Tileset",
    image: { type: "bundled", id: "tex_easyrpg_chipset_interior" },
    tileSize: 16,
    tilesPerRow: 30,
    count: 1,
    passability: [{ up: true, down: true, left: true, right: true }],
    priority: ["lower"],
    terrain: [0],
    ...patch,
  };
}

describe("resolveTransparentColorKeys", () => {
  it("uses the user transparent color when the tileset stores valid lowercase hex", () => {
    const keys = resolveTransparentColorKeys(tileset({ transparentColor: "#00ff00" }));

    expect(keys).toEqual([{ r: 0, g: 255, b: 0 }]);
  });

  it("uses the user transparent color when the tileset stores valid uppercase hex", () => {
    const keys = resolveTransparentColorKeys(tileset({ transparentColor: "#00FF00" }));

    expect(keys).toEqual([{ r: 0, g: 255, b: 0 }]);
  });

  it("falls back to chipset defaults when transparent color is unset", () => {
    const keys = resolveTransparentColorKeys(tileset());

    expect(keys).toEqual([{ r: 255, g: 103, b: 139 }]);
  });

  it("falls back to chipset defaults when transparent color is invalid", () => {
    const keys = resolveTransparentColorKeys(tileset({ transparentColor: "garbage" }));

    expect(keys).toEqual([{ r: 255, g: 103, b: 139 }]);
  });
});
