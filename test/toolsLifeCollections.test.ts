// 생활 수집 저작 파사드(어종/낚시터/계절 채집/박물관/수집 도감)가 실제로 어느 Project 필드를
// 쓰는지, 그리고 잘못된 id 를 모델이 고칠 수 있는 메시지로 거부하는지 고정한다.
// 2026-08-27 커버리지 감사에서 "UI 는 쓰는데 툴은 못 쓰는" 필드로 지목된 지점들이다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext, ToolResult } from "@/editor/tools";

const ITEM_ID = "item_potion";
const OTHER_ITEM_ID = "item_capture_orb";

function context(): ToolContext {
  return { project: createBlankProject() };
}

function mapId(ctx: ToolContext): string {
  return ctx.project.startMapId;
}

function errorText(result: ToolResult): string {
  return [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" | ");
}

function seedFish(ctx: ToolContext, id: string, itemId = ITEM_ID): void {
  const result = runTool(ctx, "upsert_fish_species", { fish: { id, name: id, itemId, skillXp: 5 } });
  expect(result.ok, errorText(result)).toBe(true);
}

describe("upsert_fish_species / delete_fish_species → database.fishSpecies", () => {
  it("writes the record and updates in place on the second upsert", () => {
    const ctx = context();
    seedFish(ctx, "fish_river");
    expect(ctx.project.database.fishSpecies).toEqual([
      { id: "fish_river", name: "fish_river", itemId: ITEM_ID, skillXp: 5 },
    ]);

    const renamed = runTool(ctx, "upsert_fish_species", { fish: { id: "fish_river", name: "강 물고기", itemId: OTHER_ITEM_ID } });
    expect(renamed.ok, errorText(renamed)).toBe(true);
    expect(ctx.project.database.fishSpecies).toHaveLength(1);
    expect(ctx.project.database.fishSpecies?.[0]?.name).toBe("강 물고기");
    expect(ctx.project.database.fishSpecies?.[0]?.itemId).toBe(OTHER_ITEM_ID);
  });

  it("rejects an unknown itemId and names valid item ids", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_fish_species", { fish: { id: "fish_bad", name: "x", itemId: "item_nope" } });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain(ITEM_ID);
    expect(ctx.project.database.fishSpecies ?? []).toHaveLength(0);
  });

  it("deletes by id and prunes fishing catches that referenced the species", () => {
    const ctx = context();
    seedFish(ctx, "fish_river");
    seedFish(ctx, "fish_lake");
    const spots = runTool(ctx, "configure_fishing", {
      enabled: true,
      spots: [
        { id: "spot_river", mapId: mapId(ctx), area: { x: 0, y: 0, w: 3, h: 3 }, catches: [{ fishId: "fish_river", weight: 1 }] },
        { id: "spot_mixed", mapId: mapId(ctx), area: { x: 4, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_river", weight: 1 }, { fishId: "fish_lake", weight: 2 }] },
      ],
    });
    expect(spots.ok, errorText(spots)).toBe(true);

    const deleted = runTool(ctx, "delete_fish_species", { id: "fish_river" });
    expect(deleted.ok, errorText(deleted)).toBe(true);
    expect(ctx.project.database.fishSpecies?.map((row) => row.id)).toEqual(["fish_lake"]);
    expect(ctx.project.system.fishing?.spots.map((spot) => spot.id)).toEqual(["spot_mixed"]);
    expect(ctx.project.system.fishing?.spots[0]?.catches.map((row) => row.fishId)).toEqual(["fish_lake"]);
  });

  it("rejects deleting an unknown fish and names the existing ids", () => {
    const ctx = context();
    seedFish(ctx, "fish_river");
    const result = runTool(ctx, "delete_fish_species", { id: "fish_ghost" });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain("fish_river");
  });
});

describe("configure_fishing → system.fishing", () => {
  it("writes spots with area and catch filters, merges by id, and keeps sibling systems", () => {
    const ctx = context();
    seedFish(ctx, "fish_river");
    seedFish(ctx, "fish_lake");
    const museum = runTool(ctx, "configure_museum", {
      enabled: true,
      eligibleItemIds: [ITEM_ID],
      rewards: [{ id: "museum_first", name: "첫 기부", minDonations: 1, reward: { gold: 100 } }],
    });
    expect(museum.ok, errorText(museum)).toBe(true);

    const first = runTool(ctx, "configure_fishing", {
      enabled: true,
      energyCost: 2,
      spots: [{
        id: "spot_river",
        name: "강 낚시터",
        mapId: mapId(ctx),
        area: { x: 1, y: 2, w: 4, h: 3 },
        catches: [{ fishId: "fish_river", weight: 3, seasons: ["spring", "summer"], timePhases: ["morning"], weatherKinds: ["none", "rain"], minSkillLevel: 2 }],
      }],
    });
    expect(first.ok, errorText(first)).toBe(true);
    const fishing = ctx.project.system.fishing;
    expect(fishing?.enabled).toBe(true);
    expect(fishing?.energyCost).toBe(2);
    expect(fishing?.spots).toHaveLength(1);
    expect(fishing?.spots[0]?.area).toEqual({ x: 1, y: 2, w: 4, h: 3 });
    expect(fishing?.spots[0]?.catches[0]).toEqual({
      fishId: "fish_river",
      weight: 3,
      seasons: ["spring", "summer"],
      timePhases: ["morning"],
      weatherKinds: ["none", "rain"],
      minSkillLevel: 2,
    });

    const second = runTool(ctx, "configure_fishing", {
      spots: [{ id: "spot_lake", mapId: mapId(ctx), area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_lake", weight: 1 }] }],
    });
    expect(second.ok, errorText(second)).toBe(true);
    expect(ctx.project.system.fishing?.spots.map((spot) => spot.id)).toEqual(["spot_river", "spot_lake"]);
    expect(ctx.project.system.fishing?.energyCost).toBe(2);
    expect(ctx.project.system.museum?.rewards.map((row) => row.id)).toEqual(["museum_first"]);

    const replaced = runTool(ctx, "configure_fishing", {
      replaceSpots: true,
      spots: [{ id: "spot_lake", mapId: mapId(ctx), area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_lake", weight: 1 }] }],
    });
    expect(replaced.ok, errorText(replaced)).toBe(true);
    expect(ctx.project.system.fishing?.spots.map((spot) => spot.id)).toEqual(["spot_lake"]);
  });

  it("rejects an unknown mapId and names valid map ids", () => {
    const ctx = context();
    seedFish(ctx, "fish_river");
    const result = runTool(ctx, "configure_fishing", {
      spots: [{ id: "spot_bad", mapId: "map_nope", area: { x: 0, y: 0, w: 1, h: 1 }, catches: [{ fishId: "fish_river", weight: 1 }] }],
    });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain(mapId(ctx));
    expect(ctx.project.system.fishing).toBeUndefined();
  });

  it("rejects an unknown fishId and names valid fish ids", () => {
    const ctx = context();
    seedFish(ctx, "fish_river");
    const result = runTool(ctx, "configure_fishing", {
      spots: [{ id: "spot_bad", mapId: mapId(ctx), area: { x: 0, y: 0, w: 1, h: 1 }, catches: [{ fishId: "fish_ghost", weight: 1 }] }],
    });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain("fish_river");
  });
});

describe("configure_seasonal_forage → system.seasonalForage", () => {
  it("writes areas with spawn policy and merges a second area by id", () => {
    const ctx = context();
    const first = runTool(ctx, "configure_seasonal_forage", {
      enabled: true,
      areas: [{
        id: "forage_farm",
        name: "농장 채집",
        mapId: mapId(ctx),
        area: { x: 0, y: 0, w: 5, h: 5 },
        dailySpawnCount: 2,
        maxActive: 6,
        despawnAfterDays: 3,
        entries: [{ id: "forage_seasonal", weight: 1, seasonalDrops: { spring: ITEM_ID, winter: OTHER_ITEM_ID } }],
      }],
    });
    expect(first.ok, errorText(first)).toBe(true);
    const forage = ctx.project.system.seasonalForage;
    expect(forage?.enabled).toBe(true);
    expect(forage?.areas[0]).toEqual({
      id: "forage_farm",
      name: "농장 채집",
      mapId: mapId(ctx),
      area: { x: 0, y: 0, w: 5, h: 5 },
      dailySpawnCount: 2,
      maxActive: 6,
      despawnAfterDays: 3,
      entries: [{ id: "forage_seasonal", weight: 1, seasonalDrops: { spring: ITEM_ID, winter: OTHER_ITEM_ID } }],
    });

    const second = runTool(ctx, "configure_seasonal_forage", {
      areas: [{
        id: "forage_woods",
        mapId: mapId(ctx),
        area: { x: 6, y: 6, w: 3, h: 3 },
        dailySpawnCount: 1,
        maxActive: 2,
        despawnAfterDays: 2,
        entries: [{ id: "forage_wood", weight: 1, itemId: ITEM_ID }],
      }],
    });
    expect(second.ok, errorText(second)).toBe(true);
    expect(ctx.project.system.seasonalForage?.areas.map((area) => area.id)).toEqual(["forage_farm", "forage_woods"]);
  });

  it("rejects an unknown drop itemId and names valid item ids", () => {
    const ctx = context();
    const result = runTool(ctx, "configure_seasonal_forage", {
      areas: [{
        id: "forage_bad",
        mapId: mapId(ctx),
        area: { x: 0, y: 0, w: 1, h: 1 },
        dailySpawnCount: 1,
        maxActive: 1,
        despawnAfterDays: 1,
        entries: [{ id: "forage_x", weight: 1, itemId: "item_nope" }],
      }],
    });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain(ITEM_ID);
    expect(ctx.project.system.seasonalForage).toBeUndefined();
  });
});

describe("configure_museum → system.museum", () => {
  it("writes eligible items and rewards, unions ids and merges rewards by id", () => {
    const ctx = context();
    const first = runTool(ctx, "configure_museum", {
      enabled: true,
      eligibleItemIds: [ITEM_ID],
      rewards: [{ id: "museum_first", name: "첫 기부", minDonations: 1, reward: { gold: 50, itemRewards: [{ itemId: ITEM_ID, count: 1 }] } }],
    });
    expect(first.ok, errorText(first)).toBe(true);
    expect(ctx.project.system.museum?.eligibleItemIds).toEqual([ITEM_ID]);
    expect(ctx.project.system.museum?.rewards[0]).toEqual({
      id: "museum_first",
      name: "첫 기부",
      minDonations: 1,
      reward: { gold: 50, itemRewards: [{ itemId: ITEM_ID, count: 1 }] },
    });

    const second = runTool(ctx, "configure_museum", {
      eligibleItemIds: [OTHER_ITEM_ID],
      rewards: [{ id: "museum_full", requiredItemIds: [ITEM_ID, OTHER_ITEM_ID], reward: { gold: 500 } }],
    });
    expect(second.ok, errorText(second)).toBe(true);
    expect(ctx.project.system.museum?.eligibleItemIds).toEqual([ITEM_ID, OTHER_ITEM_ID]);
    expect(ctx.project.system.museum?.rewards.map((row) => row.id)).toEqual(["museum_first", "museum_full"]);
    expect(ctx.project.system.museum?.enabled).toBe(true);
  });

  it("rejects an unknown eligible itemId and names valid item ids", () => {
    const ctx = context();
    const result = runTool(ctx, "configure_museum", { enabled: true, eligibleItemIds: ["item_nope"] });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain(ITEM_ID);
    expect(ctx.project.system.museum).toBeUndefined();
  });
});

describe("configure_collections → system.collections", () => {
  it("writes trackedItemIds, unions on merge and replaces on demand", () => {
    const ctx = context();
    const first = runTool(ctx, "configure_collections", { enabled: true, trackedItemIds: [ITEM_ID] });
    expect(first.ok, errorText(first)).toBe(true);
    expect(ctx.project.system.collections).toEqual({ enabled: true, trackedItemIds: [ITEM_ID] });

    const second = runTool(ctx, "configure_collections", { trackedItemIds: [OTHER_ITEM_ID] });
    expect(second.ok, errorText(second)).toBe(true);
    expect(ctx.project.system.collections?.trackedItemIds).toEqual([ITEM_ID, OTHER_ITEM_ID]);

    const replaced = runTool(ctx, "configure_collections", { replaceTrackedItemIds: true, trackedItemIds: [OTHER_ITEM_ID] });
    expect(replaced.ok, errorText(replaced)).toBe(true);
    expect(ctx.project.system.collections?.trackedItemIds).toEqual([OTHER_ITEM_ID]);
  });

  it("rejects an unknown tracked itemId and names valid item ids", () => {
    const ctx = context();
    const result = runTool(ctx, "configure_collections", { enabled: true, trackedItemIds: ["item_nope"] });
    expect(result.ok).toBe(false);
    expect(errorText(result)).toContain(ITEM_ID);
    expect(ctx.project.system.collections).toBeUndefined();
  });
});
