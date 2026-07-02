import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, repairInteriorTransparentPropLayers, TILE } from "@/project/defaults";

describe("repairInteriorTransparentPropLayers", () => {
  it("moves saved interior transparent props from lower to upper and restores the floor", () => {
    const project = createBlankProject();
    const map = createBlankMap("샘플 실내", 5, 5, "easyrpg_chipset_interior");
    project.maps[map.id] = map;
    const targetIndex = 2;
    const secondTargetIndex = 3;
    map.lowerTiles[targetIndex - 1] = 270;
    map.lowerTiles[targetIndex] = 268;
    map.lowerTiles[secondTargetIndex] = 115;
    map.upperTiles[targetIndex] = TILE.EMPTY;
    map.upperTiles[secondTargetIndex] = TILE.EMPTY;

    const changed = repairInteriorTransparentPropLayers(project);

    expect(changed).toBe(true);
    expect(map.lowerTiles[targetIndex]).toBe(270);
    expect(map.upperTiles[targetIndex]).toBe(268);
    expect(map.lowerTiles[secondTargetIndex]).toBe(270);
    expect(map.upperTiles[secondTargetIndex]).toBe(115);
  });
});
