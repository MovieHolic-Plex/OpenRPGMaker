// Editor-wide AI capability parity.
// Authored editor mutations that a user can perform in the Database / map / resource
// surfaces must have a typed tool the assistant can discover and run. These cases
// name the missing contracts first (RED), then stay as the lock after implementation.
import { describe, expect, it } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { getTool, runTool, toOpenAiTools } from "@/editor/tools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ToolContext } from "@/editor/tools/types";

function context(): ToolContext {
  return { project: createEmptyToolProject("능력 패리티") };
}

function exposedNames(userText: string): string[] {
  const domains = computeActiveToolDomains(userText);
  return toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
}

describe("AI editor capability parity", () => {
  it("authors a life skill through a typed database facade", () => {
    const ctx = context();
    expect(getTool("upsert_life_skill")?.mode).toBe("write");
    const result = runTool(ctx, "upsert_life_skill", {
      skill: { id: "life_farming", name: "농사", skillType: "farming", maxLevel: 10 },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.database.lifeSkills?.some((skill) => skill.id === "life_farming" && skill.skillType === "farming")).toBe(true);
  });

  it("authors life-system weather and a farm animal species", () => {
    const ctx = context();
    expect(getTool("upsert_life_system")?.mode).toBe("write");
    const weather = runTool(ctx, "upsert_life_system", {
      dailyWeather: { enabled: true, forecastDays: 3, seasons: { spring: [{ kind: "rain", weight: 1 }] } },
    });
    expect(weather.ok, weather.summary).toBe(true);
    expect(ctx.project.system.dailyWeather?.enabled).toBe(true);

    expect(runTool(ctx, "upsert_item", { item: { id: "item_hay", name: "건초" } }).ok).toBe(true);
    expect(runTool(ctx, "upsert_item", { item: { id: "item_milk", name: "우유" } }).ok).toBe(true);
    const animal = runTool(ctx, "upsert_life_system", {
      farmAnimalSpecies: { id: "animal_cow", name: "젖소", feedItemId: "item_hay", productItemId: "item_milk", productCount: 1, productEveryDays: 1, petFriendship: 10 },
    });
    expect(animal.ok, animal.summary).toBe(true);
    expect(ctx.project.database.farmAnimalSpecies?.some((species) => species.id === "animal_cow")).toBe(true);
  });

  it("returns full database record fields when include=full", () => {
    const ctx = context();
    const created = runTool(ctx, "upsert_enemy", {
      enemy: { id: "enemy_parity", name: "패리티 슬라임", stats: { maxHp: 44, attack: 7 } },
    });
    expect(created.ok, created.summary).toBe(true);
    const listed = runTool(ctx, "get_database_records", { collection: "enemies", include: "full" });
    expect(listed.ok, listed.summary).toBe(true);
    const records = (listed.data as { records?: Array<Record<string, unknown>> } | undefined)?.records ?? [];
    const slime = records.find((record) => record.id === "enemy_parity");
    expect(slime).toMatchObject({ id: "enemy_parity", name: "패리티 슬라임" });
    expect((slime as { stats?: { maxHp?: number } } | undefined)?.stats?.maxHp).toBe(44);
  });

  it("upserts a battle animation record", () => {
    const ctx = context();
    expect(getTool("upsert_battle_animation")?.mode).toBe("write");
    const result = runTool(ctx, "upsert_battle_animation", {
      animation: { id: "anim_slash", name: "베기", scope: "singleTarget", position: "center" },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.database.battleAnimations.some((animation) => animation.id === "anim_slash" && animation.scope === "singleTarget")).toBe(true);
  });

  it("registers and deletes an authored resource through typed tools", () => {
    const ctx = context();
    expect(getTool("upsert_resource")?.mode).toBe("write");
    expect(getTool("delete_resource")?.mode).toBe("write");
    const created = runTool(ctx, "upsert_resource", {
      resource: { id: "res_parity_chip", name: "패리티 칩", kind: "chipset", mimeType: "image/png" },
    });
    expect(created.ok, created.summary).toBe(true);
    expect(ctx.project.assets.uploaded.res_parity_chip?.name).toBe("패리티 칩");
    const removed = runTool(ctx, "delete_resource", { resourceId: "res_parity_chip" });
    expect(removed.ok, removed.summary).toBe(true);
    expect(ctx.project.assets.uploaded.res_parity_chip).toBeUndefined();
  });

  it("registers a structure kit from a painted region", () => {
    const ctx = context();
    const mapId = "map_kit";
    expect(runTool(ctx, "create_map", { id: mapId, name: "킷 맵", width: 8, height: 8 }).ok).toBe(true);
    expect(getTool("register_structure_kit")?.mode).toBe("write");
    const result = runTool(ctx, "register_structure_kit", {
      mapId,
      kitId: "kit_parity_block",
      name: "패리티 블록",
      x: 1,
      y: 1,
      width: 2,
      height: 2,
    });
    expect(result.ok, result.summary).toBe(true);
    const tilesetId = ctx.project.maps[mapId]?.tilesetId;
    expect(tilesetId).toBeDefined();
    expect(ctx.project.tilesets[tilesetId ?? ""]?.structureKits?.some((kit) => kit.id === "kit_parity_block")).toBe(true);
  });

  it("shifts map tiles and events through a typed facade", () => {
    const ctx = context();
    const mapId = "map_shift";
    expect(runTool(ctx, "create_map", { id: mapId, name: "이동 맵", width: 8, height: 8 }).ok).toBe(true);
    expect(getTool("shift_map")?.mode).toBe("write");
    const result = runTool(ctx, "shift_map", { mapId, dx: 1, dy: 0 });
    expect(result.ok, result.summary).toBe(true);
  });

  it("discovers the new authored-data facades from Korean queries", () => {
    const ctx = context();
    const queries: ReadonlyArray<{ query: string; tool: string }> = [
      { query: "생활 스킬", tool: "upsert_life_skill" },
      { query: "전투 애니메이션", tool: "upsert_battle_animation" },
      { query: "리소스 가져오기", tool: "upsert_resource" },
      { query: "구조 킷 등록", tool: "register_structure_kit" },
      { query: "맵 내용 밀기", tool: "shift_map" },
    ];
    for (const { query, tool } of queries) {
      const result = runTool(ctx, "find_tools", { query });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result.data), query).toContain(tool);
    }
  });

  it("routes life and monster requests onto the domains that own the write tools", () => {
    expect(computeActiveToolDomains("생활 스킬이랑 레시피 추가해").has("database")).toBe(true);
    expect(exposedNames("생활 스킬이랑 레시피 추가해")).toContain("upsert_life_skill");

    const monsterNames = exposedNames("몬스터 포획 시스템을 켜고 사냥터를 만들어");
    expect(monsterNames).toContain("configure_monster_system");
    expect(monsterNames).toContain("make_hunting_ground");
  });
});
