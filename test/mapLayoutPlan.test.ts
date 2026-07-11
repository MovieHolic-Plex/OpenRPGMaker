import { describe, expect, it } from "vitest";
import { findLayoutRegions, rankRegionsByCenter } from "@/project/mapLayoutPlan";
import type { GameMap, MapLayoutPlan } from "@/project/types";
import { TILE } from "@/project/defaults/constants";

function bareMap(plan: MapLayoutPlan): GameMap {
  return {
    id: "m1",
    name: "t",
    width: 50,
    height: 50,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(2500).fill(TILE.GRASS),
    upperTiles: new Array(2500).fill(TILE.EMPTY),
    events: [],
    layoutPlan: plan,
  };
}

describe("mapLayoutPlan", () => {
  const plan: MapLayoutPlan = {
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

  it("finds house by korean kit words", () => {
    const map = bareMap(plan);
    const hits = findLayoutRegions(map, "파란 집");
    expect(hits.some((r) => r.id === "house-blue")).toBe(true);
  });

  it("finds market by 상점", () => {
    const map = bareMap(plan);
    const hits = findLayoutRegions(map, "가운데 상점");
    expect(hits.some((r) => r.role === "market")).toBe(true);
  });

  it("ranks centerish regions nearer map center", () => {
    const map = bareMap(plan);
    const ranked = rankRegionsByCenter(map, plan.regions);
    expect(ranked[0]?.role === "house" || ranked[0]?.role === "market").toBe(true);
  });
});
