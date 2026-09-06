import { describe, expect, it } from "vitest";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { repairTreePairsOnProject } from "@/project/lint/repairTreePairs";

// A single candidate proves rejection happens before either half is written.
// No runner rollback or cleanup can conceal a partial tree here.
describe.each(["natural", "dense"] as const)("tree footprint eligibility (%s)", (packing) => {
  it.each(["canopy over wall", "trunk over fence", "recorded stacked house", "recorded empty house"])("rejects the whole object: %s", (obstacle) => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    const top = 3 * map.width + 3;
    const bottom = top + map.width;
    if (obstacle === "canopy over wall") map.lowerTiles[top] = 76;
    if (obstacle === "trunk over fence") map.upperTiles[bottom] = 409;
    if (obstacle === "recorded stacked house") map.lowerTileStacks = { [top]: [TILE.GRASS, 76] };
    if (obstacle.startsWith("recorded")) map.layoutPlan = {
      version: 1, kind: "houses", regions: [{ id: "house", role: "house", x: 3, y: 3, w: 1, h: 1 }],
    };
    const before = structuredClone(map);
    expect(() => placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7, packing,
    })).toThrowError(expect.objectContaining({ code: "placement-zero" }));
    expect(map).toEqual(before);
    expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
  });

  it("keeps legitimate canopy-over-trunk forest overlap", () => {
    const project = createBlankProject();
    const map = project.maps.map_blank_start;
    const top = 3 * map.width + 3;
    map.lowerTiles[top] = 290;
    map.upperTiles[top - map.width] = 260;
    const result = placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7, packing,
    });
    expect(result.data).toMatchObject({ placed: 1 });
    expect(map.lowerTiles[top]).toBe(290);
    expect(map.upperTiles[top]).toBe(260);
    expect(map.lowerTiles[top + map.width]).toBe(290);
    expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
  });
});
