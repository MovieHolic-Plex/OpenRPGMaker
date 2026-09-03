// place_props 는 소품만 산포한다 — 바닥·벽·건물 재료가 들어오면 거절하고 면 채우기 툴로 보낸다.
// 2026-09-03 적대적 리뷰 01: 「돌바닥 3x3」이 fill 실패 뒤 place_props 로 통행 불가 타일 6칸이 됐다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

const MAP_ID = "map_blank_start";

describe("place_props 재료 역할 게이트", () => {
  it("바닥/건물 재료(돌바닥)는 소품으로 산포하지 않는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 5, y: 4, w: 3, h: 3 }, material: "돌바닥", count: 9 });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("material-not-prop");
    expect(result.summary).toContain("fill_region");
    const map = ctx.project.maps[MAP_ID];
    for (let y = 4; y < 7; y += 1) for (let x = 5; x < 8; x += 1) expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
  });

  it("소품 재료(침엽수)는 그대로 산포한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 3, y: 3, w: 8, h: 6 }, material: "침엽수", count: 3 });
    expect(result.ok, result.summary).toBe(true);
  });
});
