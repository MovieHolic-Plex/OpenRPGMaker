import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { MapLayoutPlan } from "@/project/types";

// mapLayoutPlan.test.ts 의 fixture plan 을 그대로 긁어 와서 blank 프로젝트 맵에 얹는다.
const FIXTURE_PLAN: MapLayoutPlan = {
  version: 1,
  kind: "test",
  seed: 1,
  regions: [
    {
      id: "house-blue",
      role: "house",
      label: "파랑 지붕 석벽 집 (ㄱ자)",
      x: 20,
      y: 20,
      w: 8,
      h: 8,
      kitId: "blue-stone",
      shape: "L",
      tags: ["house", "blue-stone", "centerish"],
    },
    {
      id: "market",
      role: "market",
      label: "중앙 상점(장터 데크)",
      x: 22,
      y: 16,
      w: 9,
      h: 8,
      tags: ["market", "shop", "centerish"],
    },
    {
      id: "forest",
      role: "forest",
      label: "동쪽 곡선 숲",
      x: 44,
      y: 12,
      w: 6,
      h: 32,
      tags: ["forest", "curved"],
    },
  ],
};

function projectWithPlan(): ReturnType<typeof createBlankProject> {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank 프로젝트에 시작 맵이 없습니다.");
  map.layoutPlan = FIXTURE_PLAN;
  return project;
}

describe("find_layout_regions tool", () => {
  it("registers the tool in the registry", () => {
    const tool = getTool("find_layout_regions");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("find_layout_regions");
    expect(tool?.mode).toBe("read");
  });

  it("center shop query returns the market region", () => {
    const tool = getTool("find_layout_regions");
    if (!tool) throw new Error("find_layout_regions 툴이 없습니다.");
    const result = tool.run(projectWithPlan(), { mapId: "map_blank_start", query: "가운데 상점" });
    const regions = (result.data as { regions: Array<{ role: string; id: string }> }).regions;
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some((r) => r.role === "market")).toBe(true);
    // 중앙 쿼리라 맵 중앙(market)이 첫 번째로 정렬된다.
    expect(regions[0]?.id).toBe("market");
  });

  it("returns [] for a query matching nothing", () => {
    const tool = getTool("find_layout_regions");
    if (!tool) throw new Error("find_layout_regions 툴이 없습니다.");
    const result = tool.run(projectWithPlan(), { mapId: "map_blank_start", query: "존재하지않는것" });
    expect((result.data as { regions: unknown[] }).regions).toEqual([]);
  });

  it("returns [] and notes missing layoutPlan when map has none", () => {
    const tool = getTool("find_layout_regions");
    if (!tool) throw new Error("find_layout_regions 툴이 없습니다.");
    const result = tool.run(createBlankProject(), { mapId: "map_blank_start", query: "가운데 상점" });
    expect((result.data as { regions: unknown[] }).regions).toEqual([]);
    expect(result.summary).toContain("layoutPlan");
  });
});
