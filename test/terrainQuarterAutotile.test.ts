import { describe, expect, it } from "vitest";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults";
import {
  isTerrainInnerCornerTile,
  terrainInnerCornerQuarterSources,
} from "@/project/defaults/terrainQuarterAutotile";

type MapView = { width: number; height: number; lowerTiles: number[] };

function mapFromRows(rows: readonly (readonly number[])[]): MapView {
  return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
}

function quarterTile(sources: readonly { quarter: string; tile: number }[] | null, quarter: string): number | undefined {
  return sources?.find((entry) => entry.quarter === quarter)?.tile;
}

describe("terrain inner-corner quarter rendering (365/362 4등분)", () => {
  it("오목 코너 합성 타일만 쿼터 대상으로 판정한다", () => {
    expect(isTerrainInnerCornerTile(SAND_TILE.INNER_CORNER)).toBe(true);
    expect(isTerrainInnerCornerTile(DIRT_ROAD_TILE.INNER_CORNER)).toBe(true);
    expect(isTerrainInnerCornerTile(SAND_TILE.BODY)).toBe(false);
    expect(isTerrainInnerCornerTile(TILE.GRASS)).toBe(false);
  });

  it("잔디 대각 귀퉁이만 오목 쿼터, 나머지는 몸통 쿼터", () => {
    // 십자 교차로의 좌상 오목 칸: NW 대각만 잔디, 나머지 대각·4방은 모래.
    const S = SAND_TILE.BODY;
    const map = mapFromRows([
      [TILE.GRASS, S, S],
      [S, SAND_TILE.INNER_CORNER, S],
      [S, S, S],
    ]);
    const sources = terrainInnerCornerQuarterSources(map, 1, 1);
    expect(quarterTile(sources, "nw")).toBe(SAND_TILE.INNER_CORNER);
    expect(quarterTile(sources, "ne")).toBe(SAND_TILE.BODY);
    expect(quarterTile(sources, "sw")).toBe(SAND_TILE.BODY);
    expect(quarterTile(sources, "se")).toBe(SAND_TILE.BODY);
    // 쿼터 오프셋 기하: nw(0,0)/ne(8,0)/sw(0,8)/se(8,8).
    expect(sources?.map((entry) => [entry.quarter, entry.offsetX, entry.offsetY])).toEqual([
      ["nw", 0, 0],
      ["ne", 8, 0],
      ["sw", 0, 8],
      ["se", 8, 8],
    ]);
  });

  it("십자 중심(대각 4곳 전부 잔디)은 네 쿼터 모두 오목", () => {
    const S = SAND_TILE.BODY, G = TILE.GRASS;
    const map = mapFromRows([
      [G, S, G],
      [S, SAND_TILE.INNER_CORNER, S],
      [G, S, G],
    ]);
    const sources = terrainInnerCornerQuarterSources(map, 1, 1);
    for (const quarter of ["nw", "ne", "sw", "se"]) {
      expect(quarterTile(sources, quarter), quarter).toBe(SAND_TILE.INNER_CORNER);
    }
  });

  it("모래는 물 대각을 연결로 취급한다(해변 접합) — 흙길은 아니다", () => {
    const S = SAND_TILE.BODY;
    const sandMap = mapFromRows([
      [TILE.WATER, S, S],
      [S, SAND_TILE.INNER_CORNER, S],
      [S, S, S],
    ]);
    expect(quarterTile(terrainInnerCornerQuarterSources(sandMap, 1, 1), "nw")).toBe(SAND_TILE.BODY);
    const R = DIRT_ROAD_TILE.BODY;
    const roadMap = mapFromRows([
      [TILE.WATER, R, R],
      [R, DIRT_ROAD_TILE.INNER_CORNER, R],
      [R, R, R],
    ]);
    expect(quarterTile(terrainInnerCornerQuarterSources(roadMap, 1, 1), "nw")).toBe(DIRT_ROAD_TILE.INNER_CORNER);
  });

  it("오목 합성 타일이 아닌 셀은 null", () => {
    const map = mapFromRows([[SAND_TILE.BODY]]);
    expect(terrainInnerCornerQuarterSources(map, 0, 0)).toBeNull();
    expect(terrainInnerCornerQuarterSources(map, 5, 5)).toBeNull();
  });
});
