import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import {
  formatLayoutValidationSummary,
  LAYOUT_TREE_TILE_IDS,
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import { repairLayoutPlacement } from "@/project/lint/layoutPlacementRepair";

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

  it("warns (does not block) when instruction asks for trees but none landed", () => {
    const project = createBlankProject();
    const issues = validateLayoutPlacement(project, {
      mapId: MAP,
      instruction: "호수 주변에 나무 심어",
      toolNames: ["place_props"],
    });
    expect(issues.some((i) => i.code === "layout-tree-missing")).toBe(true);
    expect(layoutValidationBlocking(issues)).toEqual([]);
    expect(formatLayoutValidationSummary(issues)).toContain("나무");
  });
});

describe("repairLayoutPlacement", () => {
  it("물 위 나무를 육지로 옮겨 검증을 통과시킨다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[5 * map.width + 5] = LAKE_AUTOTILE_TILE.BODY;
    map.upperTiles[5 * map.width + 5] = CONIFER_BOTTOM;
    const repaired = repairLayoutPlacement(project, { mapId: MAP });
    expect(map.upperTiles[5 * map.width + 5]).toBe(CONIFER_BOTTOM);
    expect(repaired.project.maps[MAP].upperTiles[5 * map.width + 5]).toBe(TILE.EMPTY);
    expect(repaired.counts.relocated + repaired.counts.removed).toBeGreaterThan(0);
    expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
  });

  it("밑동 없는 수관에 밑동을 붙여 통과시킨다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
    const repaired = repairLayoutPlacement(project, { mapId: MAP });
    expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
    expect(repaired.counts.trunksAdded + repaired.counts.removed).toBeGreaterThan(0);
  });

  it("지시만 있고 나무가 없으면 보식해서 통과시킨다", () => {
    const project = createBlankProject();
    const repaired = repairLayoutPlacement(project, {
      mapId: MAP,
      instruction: "호수 주변에 나무 심어",
      toolNames: ["place_props"],
    });
    expect(repaired.counts.treesPlanted).toBeGreaterThan(0);
    expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
  });

  it("이미 통과하는 숲은 타일을 바꾸지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[4 * map.width + 4] = TILE.GRASS;
    map.lowerTiles[5 * map.width + 4] = CONIFER_BOTTOM;
    map.upperTiles[4 * map.width + 4] = CONIFER_TOP;
    const beforeUpper = map.upperTiles.slice();
    const beforeLower = map.lowerTiles.slice();
    const repaired = repairLayoutPlacement(project, { mapId: MAP, instruction: "나무 3그루 놔줘" });
    expect(repaired.project.maps[MAP].upperTiles).toEqual(beforeUpper);
    expect(repaired.project.maps[MAP].lowerTiles).toEqual(beforeLower);
    expect(layoutRepairIdle(repaired.counts)).toBe(true);
    expect(layoutValidationBlocking(repaired.remaining)).toEqual([]);
  });

  it("region 을 주면 그 상자 안에만 보식한다 — 밖에 심으면 게이트는 여전히 0그루를 본다", () => {
    const project = createBlankProject();
    const region = { x: 2, y: 2, width: 6, height: 6 };
    const repaired = repairLayoutPlacement(project, {
      mapId: MAP,
      instruction: "나무 놓아줘",
      toolNames: ["place_props"],
      region,
    });

    expect(repaired.counts.treesPlanted).toBeGreaterThan(0);

    const map = repaired.project.maps[MAP];
    const planted: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        if (LAYOUT_TREE_TILE_IDS.has(map.upperTiles[index]) || LAYOUT_TREE_TILE_IDS.has(map.lowerTiles[index])) {
          planted.push({ x, y });
        }
      }
    }

    expect(planted.length).toBeGreaterThan(0);
    for (const cell of planted) {
      expect(cell.x).toBeGreaterThanOrEqual(region.x);
      expect(cell.x).toBeLessThan(region.x + region.width);
      expect(cell.y).toBeGreaterThanOrEqual(region.y);
      expect(cell.y).toBeLessThan(region.y + region.height);
    }
  });
});

function layoutRepairIdle(counts: { relocated: number; removed: number; trunksAdded: number; treesPlanted: number }): boolean {
  return counts.relocated + counts.removed + counts.trunksAdded + counts.treesPlanted === 0;
}
