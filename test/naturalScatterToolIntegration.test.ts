import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { inMapBounds, lineCells, type Point } from "@/editor/tools/mapHelpers";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { shapeRoadAround, isRoadTile } from "@/project/defaults/roadAutotile";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { GameMap } from "@/project/types";

const CONIFER_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;

type OriginData = {
  readonly origin: Point;
};

type ScatterData = {
  readonly mode: "uniform" | "poisson" | "cluster";
  readonly naturalness: number;
  readonly placed: number;
};

function context(width = 30, height = 30): { readonly ctx: ToolContext; readonly mapId: string } {
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "map_natural_tools", name: "자연 툴", width, height });
  expect(created.ok, created.summary).toBe(true);
  return { ctx, mapId: "map_natural_tools" };
}

function currentMap(ctx: ToolContext, mapId: string): GameMap {
  const map = ctx.project.maps[mapId];
  if (!map) throw new Error(`missing map: ${mapId}`);
  return map;
}

function expectOk(result: ToolResult): void {
  expect(result.ok, result.summary).toBe(true);
}

function dataRecord<T>(result: ToolResult): T {
  if (!result.data || typeof result.data !== "object") throw new Error(`missing data: ${result.summary}`);
  return result.data as T;
}

function legacyRoadMap(source: GameMap, points: readonly Point[]): GameMap {
  const map = structuredClone(source);
  const painted: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const segment = index === 0 ? [points[0]] : lineCells(points[index - 1], points[index]);
    for (const cell of segment) {
      if (!inMapBounds(map, cell.x, cell.y)) continue;
      const tileIndex = cell.y * map.width + cell.x;
      map.lowerTiles[tileIndex] = DIRT_ROAD_TILE.BODY;
      map.upperTiles[tileIndex] = TILE.EMPTY;
      painted.push(cell);
    }
  }
  shapeRoadAround(map, painted);
  return map;
}

function roadCells(map: GameMap): readonly Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isRoadTile(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) cells.push({ x, y });
    }
  }
  return cells;
}

function coniferPairs(map: GameMap): readonly Point[] {
  const pairs: Point[] = [];
  for (let y = 0; y < map.height - 1; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.upperTiles[y * map.width + x] === 260 && map.upperTiles[(y + 1) * map.width + x] === 290) pairs.push({ x, y });
    }
  }
  return pairs;
}

function runScatter(ctx: ToolContext, mapId: string, args: Record<string, unknown> = {}): ToolResult {
  return runTool(ctx, "scatter_object", {
    area: { x: 2, y: 2, w: 20, h: 20 },
    avoidProtected: false,
    count: 6,
    groupId: CONIFER_GROUP_ID,
    mapId,
    maxGap: 5,
    minGap: 0,
    ...args,
  });
}

describe("natural scatter tool integration", () => {
  it("paint_road naturalness 0 matches the legacy lineCells/autotile path exactly", () => {
    const { ctx, mapId } = context();
    const points = [{ x: 2, y: 8 }, { x: 14, y: 8 }, { x: 14, y: 18 }];
    const before = currentMap(ctx, mapId);
    const expected = legacyRoadMap(before, points);

    const result = runTool(ctx, "paint_road", { mapId, points, style: "dirt", naturalness: 0, seed: 9 });

    expectOk(result);
    const actual = currentMap(ctx, mapId);
    expect(actual.lowerTiles).toEqual(expected.lowerTiles);
    expect(actual.upperTiles).toEqual(expected.upperTiles);
  });

  it("paint_road naturalness 0.8 creates a non-straight, longer road footprint", () => {
    const { ctx, mapId } = context();
    const points = [{ x: 2, y: 12 }, { x: 24, y: 12 }];

    const result = runTool(ctx, "paint_road", { mapId, points, style: "dirt", naturalness: 0.8, seed: 1234 });

    expectOk(result);
    const cells = roadCells(currentMap(ctx, mapId));
    expect(cells.length).toBeGreaterThan(lineCells(points[0], points[1]).length);
    expect(cells.some((cell) => cell.y !== 12)).toBe(true);
    expect(result.summary).toContain("자연도 0.8 / 경로");
  });

  it("paint_road replays the same natural path for the same seed", () => {
    const first = context();
    const second = context();
    const args = { mapId: first.mapId, points: [{ x: 2, y: 5 }, { x: 20, y: 16 }], style: "dirt", naturalness: 0.9, seed: 77 };

    expectOk(runTool(first.ctx, "paint_road", args));
    expectOk(runTool(second.ctx, "paint_road", { ...args, mapId: second.mapId }));

    expect(currentMap(first.ctx, first.mapId).lowerTiles).toEqual(currentMap(second.ctx, second.mapId).lowerTiles);
  });

  it("scatter_object auto-selects uniform below naturalness 0.3", () => {
    const { ctx, mapId } = context();

    const result = runScatter(ctx, mapId, { naturalness: 0.2 });

    expectOk(result);
    expect(dataRecord<ScatterData>(result).mode).toBe("uniform");
  });

  it("scatter_object auto-selects poisson from naturalness 0.3 through 0.7", () => {
    const { ctx, mapId } = context();

    const result = runScatter(ctx, mapId, { naturalness: 0.5 });

    expectOk(result);
    expect(dataRecord<ScatterData>(result).mode).toBe("poisson");
  });

  it("scatter_object auto-selects cluster above naturalness 0.7", () => {
    const { ctx, mapId } = context();

    const result = runScatter(ctx, mapId, { naturalness: 0.85 });

    expectOk(result);
    expect(dataRecord<ScatterData>(result).mode).toBe("cluster");
  });

  it("scatter_object explicit mode overrides the naturalness threshold", () => {
    const { ctx, mapId } = context();

    const result = runScatter(ctx, mapId, { mode: "cluster", naturalness: 0.1 });

    expectOk(result);
    expect(dataRecord<ScatterData>(result).mode).toBe("cluster");
  });

  it("scatter_object keeps hard conifer companion placement under cluster naturalness", () => {
    const { ctx, mapId } = context();

    const result = runScatter(ctx, mapId, { naturalness: 0.9, seed: 44 });

    expectOk(result);
    const data = dataRecord<ScatterData>(result);
    expect(result.summary).toContain("클러스터 동반");
    expect(coniferPairs(currentMap(ctx, mapId))).toHaveLength(data.placed);
  });

  it("scatter_object replays the same poisson placement for the same seed", () => {
    const first = context();
    const second = context();

    expectOk(runScatter(first.ctx, first.mapId, { naturalness: 0.5, seed: 20260707 }));
    expectOk(runScatter(second.ctx, second.mapId, { naturalness: 0.5, seed: 20260707 }));

    expect(coniferPairs(currentMap(first.ctx, first.mapId))).toEqual(coniferPairs(currentMap(second.ctx, second.mapId)));
  });

  it("build_house naturalness 0 preserves the requested origin", () => {
    const { ctx, mapId } = context(16, 16);

    const result = runTool(ctx, "build_house", { mapId, origin: { x: 2, y: 2 }, width: 10, height: 10, material: "plaster", naturalness: 0 });

    expectOk(result);
    expect(dataRecord<OriginData>(result).origin).toEqual({ x: 2, y: 2 });
  });

  it("build_house jitter falls back to the original origin when every offset overflows", () => {
    const { ctx, mapId } = context(12, 12);

    const result = runTool(ctx, "build_house", { mapId, origin: { x: 0, y: 0 }, width: 12, height: 12, material: "wood", naturalness: 1, seed: 17 });

    expectOk(result);
    expect(dataRecord<OriginData>(result).origin).toEqual({ x: 0, y: 0 });
  });

  it("stamp_structure jitters within the two-cell maximum and is seed-replayable", () => {
    const first = context();
    const second = context();
    const args = { template: "plaster", origin: { x: 8, y: 8 }, naturalness: 1, seed: 88 };

    const firstResult = runTool(first.ctx, "stamp_structure", { mapId: first.mapId, ...args });
    const secondResult = runTool(second.ctx, "stamp_structure", { mapId: second.mapId, ...args });

    expectOk(firstResult);
    expectOk(secondResult);
    const firstOrigin = dataRecord<OriginData>(firstResult).origin;
    expect(firstOrigin).not.toEqual(args.origin);
    expect(Math.max(Math.abs(firstOrigin.x - args.origin.x), Math.abs(firstOrigin.y - args.origin.y))).toBeLessThanOrEqual(2);
    expect(firstOrigin).toEqual(dataRecord<OriginData>(secondResult).origin);
  });
});

describe("wobblePath 닫힌 폴리라인 (2026-07-08 회귀)", () => {
  it("닫힌 사각 루프 + naturalness>0이 1칸으로 퇴화하지 않는다", async () => {
    const { wobblePath } = await import("@/editor/tools/naturalScatter");
    const square = [
      { x: 22, y: 22 }, { x: 29, y: 22 }, { x: 29, y: 29 }, { x: 22, y: 29 }, { x: 22, y: 22 },
    ];
    let seed = 7;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const result = wobblePath(square, 0.3, rng);
    expect(result.path.length).toBeGreaterThanOrEqual(20); // 둘레(~28) 근처여야 정상
  });
});
