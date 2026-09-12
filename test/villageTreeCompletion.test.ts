import { describe, expect, it } from "vitest";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { completeVillageTrees } from "@/editor/tools/village/treeCompletion";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { COBBLE_TILE } from "@/project/defaults/chipsetMapping";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";

describe("tree stamping preserves planned cross-layer overlaps", () => {
  it("keeps a new canopy when adding grass backing on empty ground", () => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    map.lowerTiles[3 * map.width + 3] = TILE.EMPTY;
    placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7,
    });
    expect(map.lowerTiles[3 * map.width + 3]).toBe(TILE.GRASS);
    expect(map.upperTiles[3 * map.width + 3]).toBe(260);
    expect(validateClusterRules(project, map.id).filter(issue => issue.groupId.includes("tree"))).toEqual([]);
  });
  it.each(["침엽수", "활엽수"])("keeps every companion when lower trunks are painted last: %s", (material) => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    const result = placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 2, h: 3 }, material,
      count: 2, packing: "dense", seed: 7, origins: [{ x: 3, y: 4 }, { x: 3, y: 3 }],
    });
    expect(result.data).toMatchObject({ placed: 2 });
    expect(validateClusterRules(project, map.id).filter(issue => issue.groupId.includes("tree"))).toEqual([]);
    expect(map.upperTiles[4 * map.width + 3]).toBe(material === "침엽수" ? 260 : 262);
    expect(map.lowerTiles[4 * map.width + 3]).toBe(material === "침엽수" ? 290 : 292);
  });

  it.each(["natural", "dense"] as const)("keeps vertical and horizontal companions in a seeded batch: %s", (packing) => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 12, h: 12 }, material: "활엽수",
      count: 20, minGap: 0, packing, seed: 982,
    });
    placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 12, h: 12 }, material: "침엽수",
      count: 20, minGap: 0, packing, seed: 161,
    });
    expect(validateClusterRules(project, map.id).filter(issue => issue.groupId.includes("tree"))).toEqual([]);
  });
});

describe("village environmental tree completion", () => {
  const area = { x: 2, y: 2, w: 12, h: 12 };
  it.each([262, 263, 292, 293])("completes all four broadleaf parts from surviving corner %i", (survivor) => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    const index = 4 * map.width + 4 + (survivor === 263 || survivor === 293 ? 1 : 0)
      + (survivor >= 290 ? map.width : 0);
    map[survivor < 290 ? "upperTiles" : "lowerTiles"][index] = survivor;
    const completed = completeVillageTrees(project, map, area);
    expect(completed.canopiesPlaced + completed.trunksPlaced).toBe(3);
    expect(validateClusterRules(project, map.id).filter(issue => issue.groupId.includes("tree"))).toEqual([]);
    expect(completeVillageTrees(project, map, area)).toEqual({ canopiesPlaced: 0, trunksPlaced: 0, orphanTrunksRemoved: 0 });
  });

  it("respects the authored broadleaf diagonal overlap alternative", () => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    for (const [x, y] of [[3, 3], [4, 4]]) {
      map.upperTiles[y! * map.width + x!] = 262;
      map.upperTiles[y! * map.width + x! + 1] = 263;
      map.lowerTiles[(y! + 1) * map.width + x!] = 292;
    }
    map.lowerTiles[5 * map.width + 5] = 293;
    const before = structuredClone(map);
    expect(validateClusterRules(project, map.id).filter(issue => issue.groupId.includes("tree"))).toEqual([]);
    expect(completeVillageTrees(project, map, area)).toEqual({ canopiesPlaced: 0, trunksPlaced: 0, orphanTrunksRemoved: 0 });
    expect(map).toEqual(before);
  });

  it("removes an unattached conifer trunk when a later prop occupies its canopy", () => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    map.upperTiles[3 * map.width + 3] = 439;
    map.lowerTiles[4 * map.width + 3] = 290;
    // A second complete tree overlaps the removed trunk; preserve its canopy.
    map.upperTiles[4 * map.width + 3] = 260;
    map.lowerTiles[5 * map.width + 3] = 290;
    expect(completeVillageTrees(project, map, area)).toEqual({ canopiesPlaced: 0, trunksPlaced: 0, orphanTrunksRemoved: 1 });
    expect(map.upperTiles[3 * map.width + 3]).toBe(439);
    expect(map.upperTiles[4 * map.width + 3]).toBe(260);
    expect(map.lowerTiles[4 * map.width + 3]).toBe(TILE.GRASS);
    expect(validateClusterRules(project, map.id).filter(issue => issue.groupId.includes("tree"))).toEqual([]);
  });

  it.each(["house", "water", "road", "broadleaf prop", "stack", "species", "scope"])("refuses %s conflicts atomically", (obstacle) => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    // First repair is safe, second is not: no prefix of the planned writes leaks.
    map.lowerTiles[4 * map.width + 3] = 290;
    map.lowerTiles[7 * map.width + 6] = 290;
    const target = 6 * map.width + 6;
    if (obstacle === "house") map.layoutPlan = { version: 1, kind: "houses", regions: [
      { id: "sealed-house", role: "house", x: 6, y: 6, w: 1, h: 1 },
    ] };
    if (obstacle === "water") map.lowerTiles[target] = LAKE_AUTOTILE_TILE.OUTER_CORNER;
    if (obstacle === "road") map.lowerTiles[target] = COBBLE_TILE.BODY;
    if (obstacle === "broadleaf prop") {
      map.lowerTiles[7 * map.width + 6] = 292;
      map.upperTiles[target] = 409;
    }
    if (obstacle === "stack") map.upperTileStacks = { [target]: [409] };
    if (obstacle === "species") map.upperTiles[target] = 261;
    const before = structuredClone(map);
    const scope = obstacle === "scope" ? { x: 2, y: 7, w: 12, h: 7 } : area;
    expect(() => completeVillageTrees(project, map, scope)).toThrowError(expect.objectContaining({ code: "village-tree-completion-conflict" }));
    expect(map).toEqual(before);
  });
});
