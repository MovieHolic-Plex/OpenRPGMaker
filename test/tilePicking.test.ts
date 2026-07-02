import { describe, expect, it } from "vitest";

import { visibleTilePickAt } from "@/editor/tilePicking";
import { TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";

describe("visible tile picking", () => {
  it("picks the upper tile when an upper tile is visible over a lower tile", () => {
    const map = mapWithTiles({ lower: 75, upper: 288 });

    const pick = visibleTilePickAt(map, 0);

    expect(pick).toEqual({ layer: "upper", tile: 288 });
  });

  it("falls back to the lower tile when the upper tile is empty", () => {
    const map = mapWithTiles({ lower: 75, upper: TILE.EMPTY });

    const pick = visibleTilePickAt(map, 0);

    expect(pick).toEqual({ layer: "lower", tile: 75 });
  });
});

function mapWithTiles(input: { readonly lower: number; readonly upper: number }): GameMap {
  return {
    events: [],
    height: 1,
    id: "m",
    lowerTiles: [input.lower],
    name: "m",
    tileSize: 16,
    tilesetId: "default",
    upperTiles: [input.upper],
    width: 1,
  };
}
