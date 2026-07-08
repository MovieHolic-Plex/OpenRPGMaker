import { describe, expect, it } from "vitest";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults";
import {
  isTerrainQuarterTile,
  terrainQuarterSources,
  type TerrainQuarter,
} from "@/project/defaults/terrainQuarterAutotile";

type MapView = { width: number; height: number; lowerTiles: number[] };

function mapFromRows(rows: readonly (readonly number[])[]): MapView {
  return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
}

function quarterTile(sources: readonly { quarter: string; tile: number }[] | null, quarter: string): number | undefined {
  return sources?.find((entry) => entry.quarter === quarter)?.tile;
}

function expectQuarterTiles(
  sources: readonly { quarter: TerrainQuarter; tile: number }[] | null,
  expected: Record<TerrainQuarter, number>
): void {
  expect(sources).not.toBeNull();
  for (const quarter of ["nw", "ne", "sw", "se"] as const) {
    expect(quarterTile(sources, quarter), quarter).toBe(expected[quarter]);
  }
}

describe("terrain quarter rendering (모래/흙길 8x8 합성)", () => {
  it("9-슬라이스와 오목 코너, 흙길 BODY_ALT만 쿼터 대상으로 판정한다", () => {
    expect(isTerrainQuarterTile(SAND_TILE.BODY)).toBe(true);
    expect(isTerrainQuarterTile(SAND_TILE.EDGE_NORTH)).toBe(true);
    expect(isTerrainQuarterTile(SAND_TILE.CORNER_SOUTH_EAST)).toBe(true);
    expect(isTerrainQuarterTile(SAND_TILE.INNER_CORNER)).toBe(true);
    expect(isTerrainQuarterTile(DIRT_ROAD_TILE.INNER_CORNER)).toBe(true);
    expect(isTerrainQuarterTile(DIRT_ROAD_TILE.BODY_ALT)).toBe(true);
    expect(isTerrainQuarterTile(SAND_TILE.ISOLATED)).toBe(false);
    expect(isTerrainQuarterTile(364)).toBe(false);
    expect(isTerrainQuarterTile(TILE.GRASS)).toBe(false);
  });

  it("가로 3x1 길 가운데 칸은 위쪽 북변, 아래쪽 남변 쿼터를 합성한다", () => {
    const S = SAND_TILE.BODY, G = TILE.GRASS;
    const map = mapFromRows([
      [G, G, G],
      [S, SAND_TILE.EDGE_NORTH, S],
      [G, G, G],
    ]);
    const sources = terrainQuarterSources(map, 1, 1);
    expectQuarterTiles(sources, {
      nw: SAND_TILE.EDGE_NORTH,
      ne: SAND_TILE.EDGE_NORTH,
      sw: SAND_TILE.EDGE_SOUTH,
      se: SAND_TILE.EDGE_SOUTH,
    });
  });

  it("세로 1x3 길 가운데 칸은 왼쪽 서변, 오른쪽 동변 쿼터를 합성한다", () => {
    const R = DIRT_ROAD_TILE.BODY, G = TILE.GRASS;
    const map = mapFromRows([
      [G, R, G],
      [G, DIRT_ROAD_TILE.EDGE_WEST, G],
      [G, R, G],
    ]);
    const sources = terrainQuarterSources(map, 1, 1);
    expectQuarterTiles(sources, {
      nw: DIRT_ROAD_TILE.EDGE_WEST,
      ne: DIRT_ROAD_TILE.EDGE_EAST,
      sw: DIRT_ROAD_TILE.EDGE_WEST,
      se: DIRT_ROAD_TILE.EDGE_EAST,
    });
  });

  it("가로 3x1 서쪽 끝 칸은 서쪽 볼록 모서리와 동쪽 변 쿼터를 합성한다", () => {
    const S = SAND_TILE.BODY, G = TILE.GRASS;
    const map = mapFromRows([
      [G, G, G],
      [SAND_TILE.CORNER_NORTH_WEST, S, S],
      [G, G, G],
    ]);
    const sources = terrainQuarterSources(map, 0, 1);
    expectQuarterTiles(sources, {
      nw: SAND_TILE.CORNER_NORTH_WEST,
      ne: SAND_TILE.EDGE_NORTH,
      sw: SAND_TILE.CORNER_SOUTH_WEST,
      se: SAND_TILE.EDGE_SOUTH,
    });
  });

  it("잔디 대각 귀퉁이만 오목 쿼터, 나머지는 몸통 쿼터", () => {
    // 십자 교차로의 좌상 오목 칸: NW 대각만 잔디, 나머지 대각·4방은 모래.
    const S = SAND_TILE.BODY;
    const map = mapFromRows([
      [TILE.GRASS, S, S],
      [S, SAND_TILE.INNER_CORNER, S],
      [S, S, S],
    ]);
    const sources = terrainQuarterSources(map, 1, 1);
    expectQuarterTiles(sources, {
      nw: SAND_TILE.INNER_CORNER,
      ne: SAND_TILE.BODY,
      sw: SAND_TILE.BODY,
      se: SAND_TILE.BODY,
    });
    // 쿼터 오프셋 기하: nw(0,0)/ne(8,0)/sw(0,8)/se(8,8).
    expect(sources?.map((entry) => [entry.quarter, entry.offsetX, entry.offsetY])).toEqual([
      ["nw", 0, 0],
      ["ne", 8, 0],
      ["sw", 0, 8],
      ["se", 8, 8],
    ]);
  });

  it("십자 중심에서 대각 4곳 전부 잔디면 네 쿼터 모두 오목이다", () => {
    const S = SAND_TILE.BODY, G = TILE.GRASS;
    const map = mapFromRows([
      [G, S, G],
      [S, SAND_TILE.BODY, S],
      [G, S, G],
    ]);
    expectQuarterTiles(terrainQuarterSources(map, 1, 1), {
      nw: SAND_TILE.INNER_CORNER,
      ne: SAND_TILE.INNER_CORNER,
      sw: SAND_TILE.INNER_CORNER,
      se: SAND_TILE.INNER_CORNER,
    });
  });

  it("대각까지 전부 연결된 몸통 칸은 null로 통짜 렌더에 맡긴다", () => {
    const S = SAND_TILE.BODY;
    const map = mapFromRows([
      [S, S, S],
      [S, S, S],
      [S, S, S],
    ]);
    expect(terrainQuarterSources(map, 1, 1)).toBeNull();
  });

  it("모래는 물 대각을 연결로 취급한다(해변 접합) — 흙길은 아니다", () => {
    const S = SAND_TILE.BODY;
    const sandMap = mapFromRows([
      [TILE.WATER, S, S],
      [S, SAND_TILE.INNER_CORNER, S],
      [S, S, S],
    ]);
    expect(quarterTile(terrainQuarterSources(sandMap, 1, 1), "nw")).toBe(SAND_TILE.BODY);
    const R = DIRT_ROAD_TILE.BODY;
    const roadMap = mapFromRows([
      [TILE.WATER, R, R],
      [R, DIRT_ROAD_TILE.INNER_CORNER, R],
      [R, R, R],
    ]);
    expect(quarterTile(terrainQuarterSources(roadMap, 1, 1), "nw")).toBe(DIRT_ROAD_TILE.INNER_CORNER);
  });

  it("ISOLATED 363 저장 칸은 null로 통짜 렌더를 유지한다", () => {
    const map = mapFromRows([[SAND_TILE.ISOLATED]]);
    expect(terrainQuarterSources(map, 0, 0)).toBeNull();
  });

  it("흙길 ISOLATED 360 단독 저장 칸은 null로 통짜 렌더를 유지한다", () => {
    const map = mapFromRows([[DIRT_ROAD_TILE.ISOLATED]]);
    expect(terrainQuarterSources(map, 0, 0)).toBeNull();
  });

  it("흙길 BODY_ALT 저장 칸도 쿼터 합성 대상이다", () => {
    const R = DIRT_ROAD_TILE.BODY, G = TILE.GRASS;
    const map = mapFromRows([
      [G, G, G],
      [R, DIRT_ROAD_TILE.BODY_ALT, R],
      [G, G, G],
    ]);
    expectQuarterTiles(terrainQuarterSources(map, 1, 1), {
      nw: DIRT_ROAD_TILE.EDGE_NORTH,
      ne: DIRT_ROAD_TILE.EDGE_NORTH,
      sw: DIRT_ROAD_TILE.EDGE_SOUTH,
      se: DIRT_ROAD_TILE.EDGE_SOUTH,
    });
  });

  it("쿼터 대상이 아니거나 맵 밖이면 null", () => {
    const map = mapFromRows([[TILE.GRASS]]);
    expect(terrainQuarterSources(map, 0, 0)).toBeNull();
    expect(terrainQuarterSources(map, 5, 5)).toBeNull();
  });
});
