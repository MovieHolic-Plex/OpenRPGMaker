import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults/blankProject";

function withSecondMap() {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { name: "저택 1층", width: 20, height: 15 });
  expect(created.ok, JSON.stringify(created)).toBe(true);
  const oldStart = ctx.project.startMapId;
  const mapId = Object.keys(ctx.project.maps).find((id) => id !== oldStart)!;
  return { ctx, oldStart, mapId };
}

describe("set_start_position 이 빈 옛 시작 맵을 알린다", () => {
  it("이벤트·문 없는 옛 시작 맵이면 remove_map 을 안내한다", () => {
    const { ctx, oldStart, mapId } = withSecondMap();
    ctx.project.maps[oldStart].events = [];
    const result = runTool(ctx, "set_start_position", { mapId, x: 5, y: 5 });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(ctx.project.startMapId).toBe(mapId);
    expect(JSON.stringify(result)).toContain(`remove_map { mapId: \\"${oldStart}\\" }`);
  });

  it("옛 시작 맵에 이벤트가 있으면 조용하다", () => {
    const { ctx, oldStart, mapId } = withSecondMap();
    ctx.project.maps[oldStart].events = [{ id: "ev", name: "npc", x: 1, y: 1, trigger: { kind: "action" }, commands: [] } as never];
    const result = runTool(ctx, "set_start_position", { mapId, x: 5, y: 5 });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("remove_map");
  });
});
