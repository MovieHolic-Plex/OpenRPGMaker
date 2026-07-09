import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import {
  formatLayoutValidationSummary,
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";

const MAP = "map_blank_start";
const CONIFER_TOP = 260;
const CONIFER_BOTTOM = 290;

describe("validateLayoutPlacement", () => {
  it("flags props on water as error", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[5 * map.width + 5] = LAKE_AUTOTILE_TILE.BODY;
    map.upperTiles[5 * map.width + 5] = CONIFER_BOTTOM;
    const issues = validateLayoutPlacement(project, { mapId: MAP });
    expect(issues.some((i) => i.code === "layout-prop-on-water")).toBe(true);
    expect(layoutValidationBlocking(issues).length).toBeGreaterThan(0);
  });

  it("flags incomplete conifer pair", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
    // no bottom
    const issues = validateLayoutPlacement(project, { mapId: MAP });
    expect(issues.some((i) => i.code === "layout-tree-incomplete")).toBe(true);
  });

  it("passes complete conifer on grass (canopy upper + trunk lower)", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[4 * map.width + 4] = TILE.GRASS;
    map.lowerTiles[5 * map.width + 4] = CONIFER_BOTTOM;
    map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
    map.upperTiles[5 * map.width + 4] = TILE.EMPTY;
    const issues = validateLayoutPlacement(project, {
      mapId: MAP,
      instruction: "나무 3그루 놔줘",
    });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("passes forest stack where canopy sits on trunk cell", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    // 그루1: top@4, trunk lower@5 / 그루2: top upper@5, trunk lower@6
    map.lowerTiles[5 * map.width + 4] = CONIFER_BOTTOM;
    map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
    map.lowerTiles[6 * map.width + 4] = CONIFER_BOTTOM;
    map.upperTiles[5 * map.width + 4] = CONIFER_TOP;
    const issues = validateLayoutPlacement(project, { mapId: MAP, instruction: "숲" });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags missing trees when instruction asks for trees", () => {
    const project = createBlankProject();
    const issues = validateLayoutPlacement(project, {
      mapId: MAP,
      instruction: "호수 주변에 나무 심어",
      toolNames: ["place_props"],
    });
    expect(issues.some((i) => i.code === "layout-tree-missing")).toBe(true);
    expect(formatLayoutValidationSummary(issues)).toContain("나무");
  });
});
