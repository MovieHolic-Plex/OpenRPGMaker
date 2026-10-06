import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { repairTreePairsOnMap, repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { runTool } from "@/editor/tools/toolRunner";
import { resolveForestCanopyReplacementExemptTileIds } from "@/editor/tools/forestComposition";

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

    const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId]);
    expect(result.canopiesPlaced).toBe(1);
    expect(map.upperTiles[4 * map.width + 5]).toBe(260);
    expect(map.lowerTiles[5 * map.width + 5]).toBe(290);
  });

  it("removes trunk on top row where canopy cannot exist", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[0 * map.width + 3] = 290;

    const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId]);
    expect(result.orphanTrunksRemoved).toBe(1);
    expect(map.lowerTiles[0 * map.width + 3]).toBe(TILE.GRASS);
  });

  it("event writes preserve pre-existing orphan trunks", () => {
    const ctx = { project: createBlankProject() };
    const mapId = "map_tree_hook";
    runTool(ctx, "create_map", { id: mapId, name: "훅", width: 12, height: 12 });
    const map = ctx.project.maps[mapId];
    // 강제로 고아 밑동 심기
    map.lowerTiles[6 * map.width + 4] = 290;
    map.upperTiles[5 * map.width + 4] = TILE.EMPTY;

    // Event-only writes must not repair the existing raster.
    const result = runTool(ctx, "place_npc", {
      mapId,
      x: 1,
      y: 1,
      name: "테스트",
      pages: [{ lines: ["ok"] }],
    });
    expect(result.ok).toBe(true);
    expect(ctx.project.maps[mapId].upperTiles[5 * map.width + 4]).toBe(TILE.EMPTY);
    expect(result.summary).not.toMatch(/수관 보완|나무 상·하/);
  });

  it("tile writes repair only the raster map changed by the tool", () => {
    const ctx = { project: createBlankProject() };
    const other = structuredClone(ctx.project.maps[MAP]);
    other.id = "map_unrelated";
    other.lowerTiles[3 * other.width + 3] = 290;
    ctx.project.maps[other.id] = other;
    const sentinel = structuredClone(other);
    const result = runTool(ctx, "paint_tiles", { mapId: MAP, layer: "lower", mode: "cells", tile: 290, cells: [{ x: 5, y: 5 }] });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[MAP].upperTiles[4 * other.width + 5]).toBe(260);
    expect(ctx.project.maps[other.id]).toEqual(sentinel);
  });

  it("repairTreePairsOnProject scans all maps", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[3 * map.width + 3] = 292; // 활엽 좌하
    map.lowerTiles[3 * map.width + 4] = 293; // 활엽 우하 — 2×2 는 짝으로만 존재한다
    const result = repairTreePairsOnProject(project);
    expect(result.canopiesPlaced).toBeGreaterThanOrEqual(2);
    expect(map.upperTiles[2 * map.width + 3]).toBe(262);
    expect(map.upperTiles[2 * map.width + 4]).toBe(263);
  });

  it("짝 없는 활엽수 반쪽은 수관을 올리지 않고 통째로 걷어낸다 — tile_erase 가 2×2 를 반만 물었을 때", () => {
    // 2026-09-18 실측: 반쪽 위에 수관을 다시 올리면 lint hard 규칙(262 왼쪽에 263)이 영구히 깨져 초안 적용이 막혔다.
    const project = createBlankProject();
    const map = project.maps[MAP];
    const at = (x: number, y: number) => y * map.width + x;
    map.upperTiles[at(3, 2)] = 262; map.upperTiles[at(4, 2)] = 263;
    map.lowerTiles[at(3, 3)] = 292; map.lowerTiles[at(4, 3)] = 293;
    // 오른쪽 열만 지운 상태(erase rect 가 x=4 부터 시작)
    map.upperTiles[at(4, 2)] = TILE.EMPTY; map.lowerTiles[at(4, 3)] = TILE.GRASS;
    const result = repairTreePairsOnProject(project);
    expect(result.orphanTrunksRemoved).toBe(1);
    expect(map.lowerTiles[at(3, 3)]).toBe(TILE.GRASS);
    expect(map.upperTiles[at(3, 2)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(4, 2)]).toBe(TILE.EMPTY);
  });

  it("대각으로 겹친 활엽수(293 자리에 다음 나무의 262)는 반쪽으로 보지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP];
    const at = (x: number, y: number) => y * map.width + x;
    // 첫 나무 (3,2)-(4,3), 둘째 나무 (4,3)-(5,4): 둘째의 262 가 첫째의 293 칸(upper)에 앉는다.
    map.upperTiles[at(3, 2)] = 262; map.upperTiles[at(4, 2)] = 263;
    map.lowerTiles[at(3, 3)] = 292; map.lowerTiles[at(4, 3)] = 293;
    map.upperTiles[at(4, 3)] = 262; map.upperTiles[at(5, 3)] = 263;
    map.lowerTiles[at(4, 4)] = 292; map.lowerTiles[at(5, 4)] = 293;
    const before = structuredClone(map);
    const result = repairTreePairsOnProject(project);
    expect(result.orphanTrunksRemoved).toBe(0);
    expect(map.lowerTiles).toEqual(before.lowerTiles);
    expect(map.upperTiles).toEqual(before.upperTiles);
  });

  it("밑동 위 덤불은 수관으로 덮어쓰지 않는다 — impassable 숲이 다시 뚫린다", () => {
    // 수관 타일(260·262·263)은 칩셋에서 4방향 통행 가능이다(주인공이 나무 뒤로 지나가는 관례).
    // 그래서 impassable 숲은 그 칸의 상위 레이어에 막는 칩(덤불 289)을 둬서 경로를 끊는다.
    // 보정이 덤불을 수관으로 되돌리면 그 경로가 살아난다(실측: 밴드 통행 13%→35%).
    const project = createBlankProject();
    const map = project.maps[MAP];
    map.lowerTiles[5 * map.width + 5] = 290; // 침엽 밑동
    map.upperTiles[4 * map.width + 5] = 289; // 그 위에 덤불(저작 의도)
    const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId], {
      canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(project),
    });
    expect(map.upperTiles[4 * map.width + 5]).toBe(289);
    expect(result.canopiesPlaced).toBe(0);
  });

  it("밑동 위 일반 소품은 수관으로 보정한다 — post-write hook 계약을 우회하지 못한다", () => {
    // 왜 이 케이스인가(실측): 나무 상자 237도 "다른 오버레이" 예외에 들어가 수관 없는 밑동과
    // 머리 위 상자가 그대로 hook을 통과했다. forest gap-closing 덤불 id 외에는 원래 계약대로 보정한다.
    const directProject = createBlankProject();
    const directMap = directProject.maps[MAP];
    directMap.lowerTiles[5 * directMap.width + 5] = 290;
    directMap.upperTiles[4 * directMap.width + 5] = 237;

    const direct = repairTreePairsOnMap(directMap, directProject.tilesets[directMap.tilesetId], {
      canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(directProject),
    });
    expect(direct.canopiesPlaced).toBe(1);
    expect(directMap.upperTiles[4 * directMap.width + 5]).toBe(260);

    const ctx = { project: createBlankProject() };
    const hookedMap = ctx.project.maps[MAP];
    hookedMap.lowerTiles[5 * hookedMap.width + 5] = 290;
    hookedMap.upperTiles[4 * hookedMap.width + 5] = 237;
    const hooked = runTool(ctx, "place_npc", {
      mapId: MAP,
      x: 1,
      y: 1,
      name: "테스트",
      pages: [{ lines: ["ok"] }],
    });
    expect(hooked.ok).toBe(true);
    expect(ctx.project.maps[MAP].upperTiles[4 * hookedMap.width + 5]).toBe(260);
  });
});
