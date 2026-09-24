// fill_region 으로 맵 전체를 한 바닥으로 채우면 「빈 판」 다음 단계를 경고로 알린다 — 2026-09-24 꿈 세계 도그푸딩.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const MAP_ID = "map_blank_start";

function interiorContext(): ToolContext {
  const project = createBlankProject();
  const map = project.maps[MAP_ID]!;
  map.tilesetId = "easyrpg_chipset_interior";
  map.lowerTiles.fill(0);
  map.upperTiles.fill(0);
  return { project };
}

const warningsOf = (result: ReturnType<typeof runTool>) => (result.diff?.warnings ?? []).join("\n");

describe("fill_region 빈 판 안내", () => {
  it("맵 전체를 한 바닥으로 채우면 place_props 로 사물을 깔라고 알린다", () => {
    const ctx = interiorContext();
    const map = ctx.project.maps[MAP_ID]!;
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 0, y: 0, w: map.width, h: map.height }, material: "실내 나무 바닥" });
    expect(result.ok, result.summary).toBe(true);
    expect(warningsOf(result)).toContain("빈 판");
    expect(warningsOf(result)).toContain("place_props");
  });

  it("작은 영역만 채우면 알리지 않는다", () => {
    const ctx = interiorContext();
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 4, h: 3 }, material: "실내 나무 바닥" });
    expect(result.ok, result.summary).toBe(true);
    expect(warningsOf(result)).not.toContain("빈 판");
  });
});
