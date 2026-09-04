// 여관 출구 재현: 벽에 붙은 문 자리에 이벤트가 있으면 gate가 1칸 안쪽으로 밀리는 결함.
import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { runTool, type ToolContext } from "@/editor/tools";

function ctxWithMaps(): ToolContext {
  const context: ToolContext = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: "map_b", name: "실내", width: 20, height: 15 }, { dryRun: false });
  expect(created.ok, created.summary).toBe(true);
  return context;
}

describe("create_transfer_pair 점유된 문 자리", () => {
  it("벽에 붙은 flush 칸에 이벤트가 있어도 1칸 안쪽 gate를 내놓지 않는다", () => {
    const context = ctxWithMaps();
    const map = context.project.maps[context.project.startMapId]!;
    // 북벽 + 문 자리(8,1) 점유 — 여관에서 이미 문 이벤트가 깔린 상태 재현.
    for (let x = 0; x < map.width; x += 1) map.lowerTiles[x] = TILE.WALL;
    map.events.push({
      id: "ev_door",
      x: 8,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
    });
    const result = runTool(
      context,
      "create_transfer_pair",
      { a: { mapId: map.id, x: 8, y: 2 }, b: { mapId: "map_b", x: 4, y: 4 } },
      { dryRun: false },
    );
    // 1칸 안쪽(8,2)에 gate를 깔면 버그 재현 — flush 칸이 막혔으면 실패하거나
    // 옆 flush 칸(7,1)/(9,1)이어야지 (8,2)는 안 된다.
    if (result.ok) {
      const gateA = (result.data as { gateA: { x: number; y: number } }).gateA;
      expect(gateA).not.toEqual({ x: 8, y: 2 });
      expect(gateA.y).toBe(1);
    }
  });
});
