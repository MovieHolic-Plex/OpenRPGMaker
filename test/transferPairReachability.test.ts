// 몬스터 수집 도그푸딩 재현: 숲에 막혀 시작 위치에서 닿지 않는 위 가장자리 칸에 도로 문을 달았다.
import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { runTool, type ToolContext } from "@/editor/tools";

function walledStart(): ToolContext {
  const context: ToolContext = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: "map_road", name: "도로", width: 20, height: 15 }, { dryRun: false }).ok).toBe(true);
  const map = context.project.maps[context.project.startMapId]!;
  // 세로 벽 x=10 이 맵을 가른다 — 시작 위치는 왼쪽, 요청 문 자리는 오른쪽 위 가장자리.
  for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 10] = TILE.WALL;
  context.project.startPos = { x: 3, y: 5 };
  return context;
}

describe("create_transfer_pair 도달성", () => {
  it("시작 위치에서 닿지 않는 가장자리 요청은 같은 가장자리의 닿는 칸으로 옮긴다", () => {
    const context = walledStart();
    const mapId = context.project.startMapId;
    const result = runTool(context, "create_transfer_pair", { a: { mapId, x: 15, y: 0 }, b: { mapId: "map_road", x: 10, y: 14 } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const gateA = (result.data as { gateA: { x: number; y: number } }).gateA;
    expect(gateA.y).toBe(0);
    expect(gateA.x).toBeLessThan(10);
    expect(result.diff?.warnings ?? []).toContainEqual(expect.stringContaining("걸어 닿지 않아"));
  });

  it("닿는 요청은 그대로 둔다", () => {
    const context = walledStart();
    const mapId = context.project.startMapId;
    const result = runTool(context, "create_transfer_pair", { a: { mapId, x: 5, y: 0 }, b: { mapId: "map_road", x: 10, y: 14 } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as { gateA: { x: number; y: number } }).gateA).toEqual({ x: 5, y: 0 });
    expect(result.diff?.warnings ?? []).not.toContainEqual(expect.stringContaining("닿지 않"));
  });

  it("한 칸 문간에 문을 놓아 같은 맵의 방이 갈라지지 않게 옆 칸에 둔다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_road", name: "도로", width: 12, height: 10 }, { dryRun: false }).ok).toBe(true);
    const map = context.project.maps[context.project.startMapId]!;
    const gapX = 5;
    const gapY = 4;
    for (let x = 0; x < map.width; x += 1) {
      if (x === gapX) continue;
      map.lowerTiles[gapY * map.width + x] = TILE.WALL;
    }
    context.project.startPos = { x: 2, y: 6 };
    const result = runTool(context, "create_transfer_pair", {
      a: { mapId: map.id, x: gapX, y: gapY },
      b: { mapId: "map_road", x: 2, y: 8 },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const gateA = (result.data as { gateA: { x: number; y: number } }).gateA;
    expect(gateA).not.toEqual({ x: gapX, y: gapY });
    expect(result.diff?.warnings ?? []).toContainEqual(expect.stringContaining("유일한 통로"));
    const blocked = map.events.some((event) => event.x === gapX && event.y === gapY);
    expect(blocked).toBe(false);
  });
});
