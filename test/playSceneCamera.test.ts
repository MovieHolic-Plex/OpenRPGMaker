import { describe, expect, it } from "vitest";
import { calculateScrollMapPanTarget } from "@/player/playSceneCamera";

describe("playSceneCamera scroll map", () => {
  it("calculates tile-distance pan targets by direction", () => {
    expect(calculateScrollMapPanTarget({ centerX: 160, centerY: 120, direction: "right", distanceTiles: 3, tileSize: 16 })).toEqual({
      x: 208,
      y: 120,
    });
    expect(calculateScrollMapPanTarget({ centerX: 160, centerY: 120, direction: "up", distanceTiles: 2, tileSize: 16 })).toEqual({
      x: 160,
      y: 88,
    });
  });

  it("clamps negative distance to no movement", () => {
    expect(calculateScrollMapPanTarget({ centerX: 10, centerY: 20, direction: "left", distanceTiles: -4, tileSize: 16 })).toEqual({
      x: 10,
      y: 20,
    });
  });
});
