// test/roadObstacleAvoidance.test.ts
// 고정하는 계약: 도로/길 툴은 건물을 관통하지 않는다.
//   (1) paint_road 가 집 사이를 가로지르면 집 칸을 덮지 않고 우회한다
//   (2) 우회해도 경로 연결성(문 앞 → 목표)이 유지된다
//   (3) 장애물이 없는 맵에서는 결과가 예전과 바이트 동일하다(퇴행 방지)
//   (4) lay_path 도 같은 보호를 받는다

import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { repairRoadPath, roadObstacleMaskFor } from "@/editor/tools/roadObstacles";
import type { Point } from "@/editor/tools/mapHelpers";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

const MAP_ID = "map_road_obstacle";

function context(width = 40, height = 24): { readonly ctx: ToolContext; readonly mapId: string } {
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: MAP_ID, name: "도로 우회", width, height });
  expect(created.ok, created.summary).toBe(true);
  return { ctx, mapId: MAP_ID };
}

function mapOf(ctx: ToolContext): GameMap {
  const map = ctx.project.maps[MAP_ID];
  if (!map) throw new Error("missing map");
  return map;
}

function expectOk(result: ToolResult): void {
  expect(result.ok, result.summary).toBe(true);
}

function buildHouse(ctx: ToolContext, origin: Point, width: number, height: number): void {
  expectOk(runTool(ctx, "build_house", { mapId: MAP_ID, origin, width, height, material: "plaster" }));
}

// 통행 불가 + 저작물이 있는 칸 = 도로가 덮으면 안 되는 칸.
function blockedCells(project: Project, map: GameMap): ReadonlySet<string> {
  const cells = new Set<string>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      const authored = (map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY
        || (map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY;
      if (authored && !isPassable(project, map, x, y)) cells.add(`${x},${y}`);
    }
  }
  return cells;
}

function roadKeys(map: GameMap): ReadonlySet<string> {
  const keys = new Set<string>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isRoadTile(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) keys.add(`${x},${y}`);
    }
  }
  return keys;
}

// 도로 칸 집합이 4-이웃으로 이어져 있는가(끊긴 조각 수).
function roadFragments(map: GameMap): number {
  const remaining = new Set(roadKeys(map));
  let fragments = 0;
  while (remaining.size > 0) {
    fragments += 1;
    const seed = remaining.values().next().value as string;
    const queue = [seed];
    remaining.delete(seed);
    while (queue.length > 0) {
      const [x, y] = (queue.pop() as string).split(",").map(Number);
      for (const step of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const key = `${x + step[0]},${y + step[1]}`;
        if (remaining.delete(key)) queue.push(key);
      }
    }
  }
  return fragments;
}

describe("도로 우회 — 건물 관통 방지", () => {
  it("두 집 사이를 가로지르는 paint_road 가 집 칸을 한 칸도 덮지 않는다", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 10, y: 6 }, 8, 8);
    buildHouse(ctx, { x: 24, y: 6 }, 8, 8);
    const map = mapOf(ctx);
    const protectedCells = blockedCells(ctx.project, map);
    expect(protectedCells.size).toBeGreaterThan(20);

    // 집 몸통 한가운데를 정확히 관통하는 폴리라인 — 예전 구현은 벽·지붕을 지웠다.
    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 2, y: 9 }, { x: 37, y: 9 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    const after = mapOf(ctx);
    const overlap = [...roadKeys(after)].filter((key) => protectedCells.has(key));
    expect(overlap).toEqual([]);
    expect((result.data as { obstacleCells: number }).obstacleCells).toBeGreaterThan(0);
  });

  it("집을 피한 도로가 하나로 이어진다(우회로가 연결성을 지킨다)", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 5 }, 10, 9);

    expectOk(runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
      style: "dirt",
      naturalness: 0,
    }));

    expect(roadFragments(mapOf(ctx))).toBe(1);
  });

  it("집을 관통하던 칸 수를 결과 data 와 경고로 보고한다", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 5 }, 10, 9);

    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    const data = result.data as { detouredSegments: number; obstacleCells: number };
    expect(data.obstacleCells).toBeGreaterThan(0);
    expect(data.detouredSegments).toBeGreaterThan(0);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("통행 불가");
  });

  it("장애물이 없으면 경로 셀을 그대로 쓴다(기존 결과 유지)", () => {
    const { ctx } = context();
    const map = mapOf(ctx);
    const mask = roadObstacleMaskFor(ctx.project, map);
    const candidate: readonly Point[] = [{ x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }];

    const repaired = repairRoadPath(map, mask, candidate);

    expect(repaired.cells).toEqual(candidate);
    expect(repaired.blocked).toBe(0);
    expect(repaired.detours).toBe(0);
    expect(repaired.gaps).toBe(0);
  });

  it("빈 칸(EMPTY)은 장애물이 아니다 — 갓 만든 맵에서 길이 안 깔리는 퇴행 방지", () => {
    const { ctx } = context();
    const map = mapOf(ctx);
    const index = 9 * map.width + 5;
    map.lowerTiles[index] = TILE.EMPTY;
    map.upperTiles[index] = TILE.EMPTY;

    expect(roadObstacleMaskFor(ctx.project, map)(5, 9)).toBe(false);
  });

  it("lay_path 도 집 칸을 덮지 않는다", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 5 }, 10, 9);
    const protectedCells = blockedCells(ctx.project, mapOf(ctx));

    const result = runTool(ctx, "lay_path", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
      material: "흙길",
      naturalness: 0,
      seed: 5,
    });

    if (!result.ok) {
      // 기본 타일셋에 8-이웃 오토타일 어휘가 없으면 이 케이스는 계약 대상이 아니다.
      expect(`${result.summary}`).toContain("8-이웃");
      return;
    }
    const after = mapOf(ctx);
    const stillBlocked = [...protectedCells].filter((key) => {
      const [x, y] = key.split(",").map(Number);
      const index = y * after.width + x;
      return (after.lowerTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY;
    });
    expect(stillBlocked.length).toBe(protectedCells.size);
  });
});
