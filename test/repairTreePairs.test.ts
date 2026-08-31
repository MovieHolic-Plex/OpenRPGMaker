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

  it("밑동 위 덤불은 수관으로 덮어쓰지 않는다 — impassable 숲이 다시 뚫린다", () => {
    // 수관 타일(260·262·263)은 칩셋에서 4방향 통행 가능이다(주인공이 나무 뒤로 지나가는 관례).
    // 그래서 impassable 숲은 그 칸의 상위 레이어에 막는 칩(덤불 289)을 둬서 경로를 끊는다.
    // 보정이 덤불을 수관으로 되돌리면 그 경로가 살아난다(실측: 밴드 통행 13%→35%).
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[5 * map.width + 5] = 290; // 침엽 밑동
    map.upperTiles[4 * map.width + 5] = 289; // 그 위에 덤불(저작 의도)
    const result = repairTreePairsOnMap(map);
    expect(map.upperTiles[4 * map.width + 5]).toBe(289);
    expect(result.canopiesPlaced).toBe(0);
  });
});
