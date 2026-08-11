import { describe, expect, it } from "vitest";
import { tilesetKind } from "@/project/tilesetKind";
import type { TilesetDef } from "@/project/types";

function tileset(overrides: Partial<TilesetDef> = {}): TilesetDef {
  const count = overrides.count ?? 480;
  return {
    id: "legacy_tileset",
    name: "Legacy tileset",
    image: { type: "bundled", id: "legacy_sheet" },
    tileSize: 16,
    tilesPerRow: 30,
    count,
    passability: Array.from({ length: count }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
    ...overrides,
  };
}

describe("tilesetKind legacy inference", () => {
  it("keeps a kind-less bundled 480-chip sheet RPG2K-compatible", () => {
    expect(tilesetKind(tileset())).toBe("rpg2k");
  });

  it("infers a kind-less uploaded atlas as custom", () => {
    expect(tilesetKind(tileset({ image: { type: "uploaded", id: "upload_legacy" } }))).toBe("custom");
  });

  it("infers a kind-less non-480 bundled atlas as custom", () => {
    expect(tilesetKind(tileset({ count: 256 }))).toBe("custom");
  });
});
