import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { repairTreePairsOnMap, repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { runTool } from "@/editor/tools/toolRunner";

const MAP = "map_blank_start";

describe("repairTreePairs", () => {
  it("places canopy upper above an orphan trunk on lower", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    // (5,5) 밑동만 있음 — (5,4) 수관 없음
    map.lowerTiles[5 * map.width + 5] = 290;
    map.upperTiles[5 * map.width + 5] = TILE.EMPTY;
    map.upperTiles[4 * map.width + 5] = TILE.EMPTY;
    map.lowerTiles[4 * map.width + 5] = TILE.GRASS;

    const result = repairTreePairsOnMap(map);
    expect(result.canopiesPlaced).toBe(1);
    expect(map.upperTiles[4 * map.width + 5]).toBe(260);
    expect(map.lowerTiles[5 * map.width + 5]).toBe(290);
  });

  it("removes trunk on top row where canopy cannot exist", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[0 * map.width + 3] = 290;

    const result = repairTreePairsOnMap(map);
    expect(result.orphanTrunksRemoved).toBe(1);
    expect(map.lowerTiles[0 * map.width + 3]).toBe(TILE.GRASS);
  });

  it("runTool write post-hook repairs orphan trunks after place_props", () => {
    const ctx = { project: createBlankProject() };
    const mapId = "map_tree_hook";
    runTool(ctx, "create_map", { id: mapId, name: "훅", width: 12, height: 12 });
    const map = ctx.project.maps[mapId];
    // 강제로 고아 밑동 심기
    map.lowerTiles[6 * map.width + 4] = 290;
    map.upperTiles[5 * map.width + 4] = TILE.EMPTY;

    // 아무 쓰기 툴이나 한 번 돌리면 post-hook 이 맵 전체를 보정
    const result = runTool(ctx, "place_npc", {
      mapId,
      x: 1,
      y: 1,
      name: "테스트",
      pages: [{ lines: ["ok"] }],
    });
    expect(result.ok).toBe(true);
    expect(ctx.project.maps[mapId].upperTiles[5 * map.width + 4]).toBe(260);
    expect(result.summary).toMatch(/수관 보완|나무 상·하/);
  });

  it("repairTreePairsOnProject scans all maps", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[3 * map.width + 3] = 292; // 활엽 좌하
    const result = repairTreePairsOnProject(project);
    expect(result.canopiesPlaced).toBeGreaterThanOrEqual(1);
    expect(map.upperTiles[2 * map.width + 3]).toBe(262);
  });
});
