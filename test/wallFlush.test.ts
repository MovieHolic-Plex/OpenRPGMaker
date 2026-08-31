// test/wallFlush.test.ts
// 조수가 벽에서 1칸 띄워 놓는 버릇: 출입구는 벽·맵 끝에 붙이고, 타일 채우기는 맵 안 벽과의 틈만 메운다.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { runTool, type ToolContext } from "@/editor/tools";
import { expandCellsAgainstWalls, snapFlushToWall } from "@/editor/tools/wallFlush";
import type { GameMap } from "@/project/types";

function ctxWithMaps(): ToolContext {
  const context: ToolContext = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: "map_b", name: "실내", width: 20, height: 15 }, { dryRun: false });
  expect(created.ok, created.summary).toBe(true);
  return context;
}

function paintNorthWall(map: GameMap): void {
  for (let x = 0; x < map.width; x += 1) map.lowerTiles[x] = TILE.WALL;
}

describe("snapFlushToWall", () => {
  it("맵 가장자리에서 1칸 안쪽 출입구를 가장자리로 당긴다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    expect(snapFlushToWall(project, map, 1, 7)).toEqual({ x: 0, y: 7 });
    expect(snapFlushToWall(project, map, map.width - 2, 7)).toEqual({ x: map.width - 1, y: 7 });
    expect(snapFlushToWall(project, map, 7, 1)).toEqual({ x: 7, y: 0 });
  });

  it("이미 가장자리에 붙어 있으면 그대로 둔다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    expect(snapFlushToWall(project, map, 0, 7)).toEqual({ x: 0, y: 7 });
  });

  it("방 한가운데는 당기지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    expect(snapFlushToWall(project, map, 10, 7)).toEqual({ x: 10, y: 7 });
  });

  it("북벽에서 1칸 떨어진 칸을 벽 바로 앞 통행 칸으로 당긴다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    paintNorthWall(map);
    expect(snapFlushToWall(project, map, 8, 2)).toEqual({ x: 8, y: 1 });
  });

  it("벽 칸 위 요청은 바로 앞 통행 칸으로 옮긴다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    paintNorthWall(map);
    expect(snapFlushToWall(project, map, 8, 0)).toEqual({ x: 8, y: 1 });
  });
});

describe("expandCellsAgainstWalls", () => {
  it("벽과 채운 영역 사이 1칸 틈을 메운다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    paintNorthWall(map);
    const filled = expandCellsAgainstWalls(project, map, [
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ]);
    expect(filled).toEqual(expect.arrayContaining([
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]));
    expect(filled).toHaveLength(4);
  });

  it("맵 가장자리 1칸은 메우지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const filled = expandCellsAgainstWalls(project, map, [{ x: 5, y: 1 }]);
    expect(filled).toEqual([{ x: 5, y: 1 }]);
  });
});

describe("create_transfer_pair 벽 밀착", () => {
  it("1칸 안쪽 좌표를 맵 가장자리로 당긴다", () => {
    const context = ctxWithMaps();
    const result = runTool(
      context,
      "create_transfer_pair",
      { a: { mapId: context.project.startMapId, x: 1, y: 7 }, b: { mapId: "map_b", x: 2, y: 2 } },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({
      gateA: { x: 0, y: 7 },
      adjustedA: true,
    });
    const map = context.project.maps[context.project.startMapId]!;
    const gate = map.events.find((event) => event.x === 0 && event.y === 7);
    expect(gate?.pages?.[0]?.trigger).toEqual({ kind: "playerTouch" });
  });

  it("북벽 1칸 앞이 아니라 벽과 맞닿은 칸에 출입구를 놓는다", () => {
    const context = ctxWithMaps();
    const map = context.project.maps[context.project.startMapId]!;
    paintNorthWall(map);
    const result = runTool(
      context,
      "create_transfer_pair",
      { a: { mapId: map.id, x: 8, y: 2 }, b: { mapId: "map_b", x: 4, y: 4 } },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({
      gateA: { x: 8, y: 1 },
      adjustedA: true,
    });
  });
});

describe("fill_region 벽 밀착", () => {
  it("북벽과 1칸 틈이 있으면 그 줄을 메운다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const map = context.project.maps[context.project.startMapId]!;
    paintNorthWall(map);
    context.project.startPos = { x: 10, y: 10 };
    const result = runTool(
      context,
      "fill_region",
      { mapId: map.id, rect: { x: 4, y: 2, w: 3, h: 2 }, material: "잔디" },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    const filled = Number((result.data as { filled?: number }).filled ?? 0);
    expect(filled).toBeGreaterThanOrEqual(9);
    expect(map.lowerTiles[1 * map.width + 4]).not.toBe(TILE.WALL);
    expect(map.lowerTiles[0]).toBe(TILE.WALL);
  });
});
