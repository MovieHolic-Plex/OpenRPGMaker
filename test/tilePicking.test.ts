import { describe, expect, it } from "vitest";

import { layerTilePickAt, visibleTilePickAt } from "@/editor/tilePicking";
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

describe("layer tile picking", () => {
  it("덧그림 빈 칸은 공백을 집는다 — 바닥 타일로 떨어지지 않는다", () => {
    const map = mapWithTiles({ lower: 75, upper: TILE.EMPTY });

    expect(layerTilePickAt(map, 0, "upper")).toEqual({ layer: "upper", tile: TILE.EMPTY });
  });

  it("덧그림에 타일이 있으면 그 타일을 집는다", () => {
    const map = mapWithTiles({ lower: 75, upper: 288 });

    expect(layerTilePickAt(map, 0, "upper")).toEqual({ layer: "upper", tile: 288 });
  });

  it("바닥 빈 칸은 집지 않는다", () => {
    const map = mapWithTiles({ lower: TILE.EMPTY, upper: TILE.EMPTY });

    expect(layerTilePickAt(map, 0, "lower")).toBeNull();
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
