import { describe, expect, it } from "vitest";
import { CHIPSET_TILE_GROUPS, describeChipsetTile, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { DEFAULT_TILE_COUNT } from "@/project/defaults/constants";

describe("chipset AI mapping", () => {
  it("keeps every default chipset cell addressable for AI tiling", () => {
    for (let index = 0; index < DEFAULT_TILE_COUNT; index += 1) {
      const tile = describeChipsetTile(index);
      expect(tile.label.length).toBeGreaterThan(0);
      expect(tile.description.length).toBeGreaterThan(0);
      expect(tile.aiLabel).toBe(tile.description);
      expect(tile.tags.length).toBeGreaterThan(0);
    }
  });

  it("describes expanded EasyRPG exterior decoration groups", () => {
    expect(CHIPSET_TILE_GROUPS.houseWoodWallUpperObjects).toEqual([102, 103, 104]);
    expect(CHIPSET_TILE_GROUPS.houseWoodWallBodyObjects).toEqual([132, 133, 134]);
    expect(CHIPSET_TILE_GROUPS.houseWoodWallLowerObjects).toEqual([162, 163, 164]);
    expect(CHIPSET_TILE_GROUPS.groundDetail).toContain(402);
    expect(CHIPSET_TILE_GROUPS.fenceObjects).toContain(379);
    expect(tileLabelForIndex(132)).toBe("House wood wall body");
    expect(describeChipsetTile(379)).toMatchObject({
      key: "fence_object",
      description: "Fence top/bottom horizontal rail: repeat this tile across the upper or lower run between fence corners or terminators.",
      aiLabel: "Fence top/bottom horizontal rail: repeat this tile across the upper or lower run between fence corners or terminators.",
      label: "Fence",
      layer: "upper",
      repeatRole: "object",
      usage: "decoration",
      tags: expect.arrayContaining(["fence", "horizontal", "repeat-horizontal"]),
      confirmed: true,
    });
    expect(describeChipsetTile(408)).toMatchObject({
      description: "Fence vertical rail: repeat this tile down the left or right side of a fenced enclosure.",
      tags: expect.arrayContaining(["fence", "vertical", "repeat-vertical"]),
    });
    expect(describeChipsetTile(410)).toMatchObject({
      description: "Fence lower-right turn: use where the right vertical fence bends into the lower horizontal fence.",
      tags: expect.arrayContaining(["fence", "corner", "lower-right"]),
    });
    expect(describeChipsetTile(132)).toMatchObject({
      key: "house_wood_wall_body_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wood", "wall", "body", "upper"]),
    });
    expect(describeChipsetTile(384)).toMatchObject({
      key: "house_roof_object",
      aiLabel: "House roof object: upper-layer exterior home roof section for AI-composed village houses.",
      usage: "structure",
      tags: expect.arrayContaining(["house", "roof", "building", "upper"]),
    });
    expect(CHIPSET_TILE_GROUPS.houseObjects).toEqual(expect.arrayContaining([
      12, 13, 14,
      42, 43, 44,
      72, 73, 74,
      102, 103, 104,
      132, 133, 134,
      162, 163, 164,
      329, 359,
      374, 375, 376,
      434, 435, 436,
      464, 465, 466,
    ]));
    expect(CHIPSET_TILE_GROUPS.houseObjects).not.toContain(284);
    expect(CHIPSET_TILE_GROUPS.houseObjects).not.toContain(193);
    expect(CHIPSET_TILE_GROUPS.houseObjects).not.toContain(444);
    expect(CHIPSET_TILE_GROUPS.houseWhiteWallUpperObjects).toEqual([15, 16, 17]);
    expect(CHIPSET_TILE_GROUPS.houseWhiteWallBodyObjects).toEqual([45, 46, 47]);
    expect(CHIPSET_TILE_GROUPS.houseWhiteWallLowerObjects).toEqual([75, 76, 77]);
    expect(CHIPSET_TILE_GROUPS.houseWhiteWallObjects).toEqual([15, 16, 17, 45, 46, 47, 75, 76, 77]);
    expect(CHIPSET_TILE_GROUPS.houseWhiteWallRepeatColumnObjects).toEqual([16, 46, 76]);
    expect(CHIPSET_TILE_GROUPS.houseEntranceUpperObjects).toEqual([329]);
    expect(CHIPSET_TILE_GROUPS.houseEntranceLowerObjects).toEqual([359]);
    expect(CHIPSET_TILE_GROUPS.houseEntranceObjects).toEqual([329, 359]);
    expect(describeChipsetTile(12)).toMatchObject({
      key: "house_purple_stone_wall_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "purple-stone", "upper"]),
    });
    expect(describeChipsetTile(15)).toMatchObject({
      key: "house_white_wall_upper_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "white", "upper-wall", "left-cap"]),
    });
    expect(describeChipsetTile(16)).toMatchObject({
      key: "house_white_wall_upper_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "white", "upper-wall", "repeat-horizontal"]),
    });
    expect(describeChipsetTile(45)).toMatchObject({
      key: "house_white_wall_body_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "white", "body", "left-cap"]),
    });
    expect(describeChipsetTile(76)).toMatchObject({
      key: "house_white_wall_lower_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "white", "lower-wall", "repeat-horizontal"]),
    });
    expect(describeChipsetTile(102)).toMatchObject({
      key: "house_wood_wall_upper_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wood", "wall", "upper-wall", "upper"]),
    });
    expect(describeChipsetTile(162)).toMatchObject({
      key: "house_wood_wall_lower_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wood", "wall", "lower-wall", "upper"]),
    });
    expect(describeChipsetTile(193)).toMatchObject({
      key: "timber_post_structure_object",
      usage: "structure",
      tags: expect.arrayContaining(["timber", "post", "needs-manual-composition", "upper"]),
    });
    expect(describeChipsetTile(434)).toMatchObject({
      key: "house_facade_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "facade", "upper"]),
    });
    expect(describeChipsetTile(464)).toMatchObject({
      key: "house_facade_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "wall", "facade", "upper"]),
    });
    expect(describeChipsetTile(329)).toMatchObject({
      key: "house_entrance_upper_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "entrance", "upper-half"]),
    });
    expect(describeChipsetTile(359)).toMatchObject({
      key: "house_entrance_lower_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "entrance", "lower-half"]),
    });
    expect(describeChipsetTile(465)).toMatchObject({
      key: "house_door_object",
      usage: "structure",
      tags: expect.arrayContaining(["house", "door", "entrance", "upper"]),
    });
    expect(describeChipsetTile(444).key).toBe("building_front_object");
    expect(describeChipsetTile(475).key).toBe("building_front_object");
    expect(describeChipsetTile(418)).toMatchObject({
      key: "tent_object",
      usage: "structure",
      tags: expect.arrayContaining(["tent", "shelter", "upper"]),
    });
    expect(describeChipsetTile(366)).toMatchObject({
      key: "dark_wall_body",
      usage: "structure",
      tags: expect.arrayContaining(["dark", "wall", "solid"]),
    });
    expect(describeChipsetTile(327)).toMatchObject({
      key: "bench_object",
      usage: "decoration",
      tags: expect.arrayContaining(["bench", "village", "upper"]),
    });
  });

  it("describes lake, waterfall, desert sand, and stake cells for AI placement", () => {
    expect(CHIPSET_TILE_GROUPS.lakeWaterBody).toContain(120);
    expect(CHIPSET_TILE_GROUPS.lakeWaterBody).not.toContain(121);
    expect(CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames).toEqual([120, 121, 122, 150, 151, 152, 180, 181, 182, 210, 211, 212]);
    expect(CHIPSET_TILE_GROUPS.waterBody).toContain(120);
    expect(CHIPSET_TILE_GROUPS.lakeWaterBody).not.toContain(123);
    expect(CHIPSET_TILE_GROUPS.lakeShoreEdges).toContain(60);
    expect(CHIPSET_TILE_GROUPS.lakeShoreEdges).not.toContain(61);
    expect(CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames).toContain(91);
    expect(CHIPSET_TILE_GROUPS.waterEdges).not.toContain(123);
    expect(CHIPSET_TILE_GROUPS.waterfallWater).toContain(123);
    expect(CHIPSET_TILE_GROUPS.waterfallWater).not.toContain(124);
    expect(CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames).toContain(124);
    expect(CHIPSET_TILE_GROUPS.desertSandBody).toContain(424);
    expect(CHIPSET_TILE_GROUPS.desertSandEdges).toContain(394);
    expect(CHIPSET_TILE_GROUPS.stakeObjects).toContain(378);
    expect(describeChipsetTile(120)).toMatchObject({
      key: "lake_water_body",
      usage: "terrain",
      repeatRole: "body",
      tags: expect.arrayContaining(["lake", "still-water", "body", "impassable"]),
    });
    expect(describeChipsetTile(121)).toMatchObject({
      key: "lake_water_body",
      usage: "terrain",
      repeatRole: "body",
      tags: expect.arrayContaining(["lake", "animation-frame"]),
    });
    expect(describeChipsetTile(60)).toMatchObject({
      key: "lake_shore_edge",
      usage: "edge",
      repeatRole: "edge",
      tags: expect.arrayContaining(["lake", "shore", "edge"]),
    });
    expect(describeChipsetTile(91)).toMatchObject({
      key: "lake_shore_edge",
      usage: "edge",
      repeatRole: "edge",
      tags: expect.arrayContaining(["lake", "animation-frame"]),
    });
    expect(describeChipsetTile(123)).toMatchObject({
      key: "waterfall_water",
      usage: "terrain",
      repeatRole: "detail",
      tags: expect.arrayContaining(["waterfall", "flowing-water"]),
    });
    expect(describeChipsetTile(424)).toMatchObject({
      key: "desert_sand_body",
      usage: "terrain",
      terrainTag: 2,
      tags: expect.arrayContaining(["desert", "sand", "body"]),
    });
    expect(describeChipsetTile(394)).toMatchObject({
      key: "desert_sand_edge",
      usage: "edge",
      repeatRole: "edge",
      tags: expect.arrayContaining(["desert", "sand", "edge"]),
    });
    expect(describeChipsetTile(378)).toMatchObject({
      key: "fence_object",
      description: "Fence upper-left corner: use at the top-left of a fenced enclosure before horizontal rail 379.",
      usage: "decoration",
      layer: "upper",
      tags: expect.arrayContaining(["fence", "corner", "upper-left"]),
    });
  });
});
