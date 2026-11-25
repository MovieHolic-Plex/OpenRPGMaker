import { describe, expect, it, vi } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { declaredIntent } from "./intentFixture";
import { getTool, runTool, toOpenAiTools, activeTools, type JsonSchema } from "@/editor/tools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ToolContext } from "@/editor/tools/types";
import { buildToolCapabilityIndex } from "@/ai/toolCapabilityIndex";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

vi.mock("../electron/shared/lifeSim", () => ({ LIFE_SIM_ENABLED: true, LIFE_SIM_CLOSED_TITLE: "", LIFE_SIM_CLOSED_BODY: "", LIFE_SIM_CLOSED_NOTICE: "" }));

// Editor-wide AI capability parity.
// Authored editor mutations that a user can perform in the Database / map / resource
// surfaces must have a typed tool the assistant can discover and run. These cases
// name the missing contracts first (RED), then stay as the lock after implementation.
describe("aiEditorCapabilityParity", () => {
  isolateTimers();
  function context(): ToolContext {
    return { project: createEmptyToolProject("능력 패리티") };
  }
  function exposedNames(intent: IntentDeclaration): string[] {
    const domains = computeActiveToolDomains(intent);
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
        enemy: { id: "enemy_parity", name: "패리티 슬라임", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 44, attack: 7 } },
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

    it("routes life and monster declarations onto the domains that own the write tools", () => {
      const ctx = context();
      expect(computeActiveToolDomains(declaredIntent({ tools: ["upsert_life_skill"] })).has("database")).toBe(true);
      expect(JSON.stringify(runTool(ctx, "find_tools", { query: "생활 스킬" }).data)).toContain("upsert_life_skill");

      const monster = declaredIntent({ tools: ["configure_monster_system", "make_hunting_ground"] });
      const monsterDomains = computeActiveToolDomains(monster);
      expect(monsterDomains.has("system")).toBe(true);
      expect(monsterDomains.has("map")).toBe(true);
      expect(exposedNames(monster)).toContain("make_hunting_ground");
      expect(JSON.stringify(runTool(ctx, "find_tools", { query: "몬스터 시스템" }).data)).toContain("configure_monster_system");
    });
  });
});

// 산출물 계약: 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)가
// 집어낸 "에디터 UI 는 쓰는데 어떤 툴도 못 쓰는" 저작 필드 32곳의 툴 이름·스키마·도달성.
// 필드별 쓰기 동작은 각 파사드 파일의 전용 테스트가 직접 증명한다.
// 도달성이 빠지면 툴이 있어도 모델은 "그 기능이 없습니다"로 답한다(openwiki/editor-ai-tools.md 2026-08-23 사건).
describe("aiEditorReachParity", () => {
  isolateTimers();
  interface ReachCase {
    readonly tool: string;
    readonly field: string;
  }
  const REQUIRED_FACADES: readonly ReachCase[] = [
    { tool: "upsert_craft_recipe", field: "system.craftRecipes" },
    { tool: "delete_craft_recipe", field: "system.craftRecipes" },
    { tool: "upsert_item_upgrade", field: "system.itemUpgrades" },
    { tool: "set_sell_prices", field: "system.sellPrices" },
    { tool: "upsert_tool_action", field: "system.toolActions" },
    { tool: "configure_life_economy", field: "system.energy/shipping/bundles/worldUnlocks/makers" },
    { tool: "upsert_fish_species", field: "database.fishSpecies" },
    { tool: "delete_fish_species", field: "database.fishSpecies" },
    { tool: "configure_fishing", field: "system.fishing" },
    { tool: "configure_seasonal_forage", field: "system.seasonalForage" },
    { tool: "configure_museum", field: "system.museum" },
    { tool: "configure_collections", field: "system.collections" },
    { tool: "upsert_farm_building_type", field: "database.farmBuildingTypes" },
    { tool: "upsert_home_decoration_type", field: "database.homeDecorationTypes" },
    { tool: "upsert_farm_animal_building", field: "system.farmAnimalBuildings" },
    { tool: "set_session_farm_state", field: "session.farmAnimals/farmBuildingPlacements/homeDecorationPlacements" },
    { tool: "configure_game_systems", field: "system.battleModel/giftSystem/rewardPolicy/monsterCare/skillSystem" },
    { tool: "set_project_genre", field: "system.genre" },
    { tool: "create_tileset", field: "tilesets[*]" },
    { tool: "set_tileset_properties", field: "tilesets[*].name/image/tileSize/tilesPerRow/count/transparentColor" },
    { tool: "upsert_autotile_group", field: "tilesets[*].autotileGroups" },
    { tool: "delete_autotile_group", field: "tilesets[*].autotileGroups" },
    { tool: "set_animation_strips", field: "tilesets[*].animationStrips" },
    { tool: "set_tile_grafts", field: "tilesets[*].tileGrafts" },
    { tool: "upsert_map_connection", field: "mapConnections" },
    { tool: "delete_map_connection", field: "mapConnections" },
    // world.entities / world.relations 는 의도적으로 AI 사정거리 밖이다 — 2026-08-28 세계관 AI 배제.
    // 커버리지 구멍이 아니라 결정이므로 여기 다시 넣지 말 것. 계약: test/worldAiExclusion.test.ts.
    { tool: "upsert_village_document", field: "villageInfoDocuments" },
    { tool: "delete_village_document", field: "villageInfoDocuments" },
    { tool: "upsert_resource_profile", field: "resourceProfiles" },
    { tool: "delete_resource_profile", field: "resourceProfiles" },
    { tool: "upsert_character_profile", field: "characters" },
    { tool: "upsert_test_preset", field: "testPresets" },
    { tool: "delete_test_preset", field: "testPresets" },
    { tool: "manage_flag_slot", field: "switches/variables" },
    { tool: "set_opening", field: "system.opening" },
    { tool: "set_game_over", field: "system.gameOver" },
  ];
  const EXTRA_DELETABLE_COLLECTIONS = [
    "monsterSpecies",
    "crops",
    "lifeSkills",
    "farmAnimalSpecies",
    "fishSpecies",
    "farmBuildingTypes",
    "homeDecorationTypes",
  ] as const;
  function context(): ToolContext {
    return { project: createEmptyToolProject("도달성 패리티") };
  }
  function schemaHasUnion(schema: JsonSchema | undefined): boolean {
    if (!schema || typeof schema !== "object") return false;
    const record = schema as unknown as Record<string, unknown>;
    if ("oneOf" in record || "anyOf" in record) return true;
    return Object.values(record).some((value) => {
      if (Array.isArray(value)) return value.some((entry) => schemaHasUnion(entry as JsonSchema));
      if (value && typeof value === "object") return schemaHasUnion(value as JsonSchema);
      return false;
    });
  }
  function arrayNodesHaveItems(schema: JsonSchema | undefined): boolean {
    if (!schema || typeof schema !== "object") return true;
    const record = schema as unknown as Record<string, unknown>;
    if (record.type === "array" && record.items === undefined) return false;
    return Object.values(record).every((value) => {
      if (Array.isArray(value)) return value.every((entry) => arrayNodesHaveItems(entry as JsonSchema));
      if (value && typeof value === "object") return arrayNodesHaveItems(value as JsonSchema);
      return true;
    });
  }
  describe("AI editor reach parity — every audited authored-data surface has a typed facade", () => {
    it.each(REQUIRED_FACADES)("$tool exists as a write facade for $field", ({ tool }) => {
      const definition = getTool(tool);
      expect(definition, `${tool} is not registered`).toBeDefined();
      expect(definition?.mode).toBe("write");
      expect(definition?.deprecated).not.toBe(true);
      expect(Object.keys((definition?.parameters as { properties?: Record<string, unknown> })?.properties ?? {}).length)
        .toBeGreaterThan(0);
    });

    it("every new facade ships a provider-compatible schema", () => {
      const offenders = REQUIRED_FACADES.map(({ tool }) => getTool(tool))
        .filter((definition) => definition !== undefined)
        .filter((definition) => schemaHasUnion(definition.parameters) || !arrayNodesHaveItems(definition.parameters))
        .map((definition) => definition.name);
      expect(offenders).toEqual([]);
    });

    it("every new facade is advertised in the prompt capability index", () => {
      const index = buildToolCapabilityIndex();
      const missing = REQUIRED_FACADES.map(({ tool }) => tool).filter((name) => !index.includes(name));
      expect(missing).toEqual([]);
    });

    it("every new facade is in the registry the assistant can search", () => {
      const registered = new Set(activeTools().map((tool) => tool.name));
      const missing = REQUIRED_FACADES.map(({ tool }) => tool).filter((name) => !registered.has(name));
      expect(missing).toEqual([]);
      const exposable = new Set(toOpenAiTools().map((tool) => tool.function.name));
      expect(REQUIRED_FACADES.map(({ tool }) => tool).filter((name) => !exposable.has(name))).toEqual([]);
    });

    it("record delete and duplicate reach the life and monster collections too", () => {
      for (const collection of EXTRA_DELETABLE_COLLECTIONS) {
        for (const name of ["delete_database_record", "duplicate_database_record"] as const) {
          const schema = getTool(name)?.parameters as
            | { properties?: { collection?: { enum?: readonly string[] } } }
            | undefined;
          expect(schema?.properties?.collection?.enum, `${name} cannot target ${collection}`).toContain(collection);
        }
      }
    });

    it("title screen authoring reaches background layers, particles and intro", () => {
      const ctx = context();
      const result = runTool(ctx, "set_title_screen", {
        backgroundLayers: [{ resourceId: "title_sky", scrollXPerSec: 4, parallax: 0.5, opacity: 0.8 }],
        particles: { preset: "snow", density: 0.4 },
        intro: { delayMs: 300, staggerMs: 80 },
      });
      expect(result.ok, result.summary).toBe(true);
      const titleScreen = ctx.project.system.titleScreen;
      expect(titleScreen?.backgroundLayers?.[0]?.resourceId).toBe("title_sky");
      expect(titleScreen?.particles?.preset).toBe("snow");
      expect(titleScreen?.intro?.delayMs).toBe(300);
    });
  });
});

// 생활·경제 저작 파사드(LIFE_ECONOMY_TOOLS)가 실제로 어떤 Project 필드를 쓰는지 고정한다.
// 2026-08-27 커버리지 감사: 에디터 UI 는 쓰는데 어떤 툴도 못 쓰던 필드들.
describe("toolsLifeEconomy", () => {
  isolateTimers();
  function project(): Project {
    const created = createEmptyToolProject("생활 경제");
    created.database.items = [
      normalizeItemRecord({ id: "wood", name: "목재", price: 20 }),
      normalizeItemRecord({ id: "plank", name: "판자", price: 60 }),
      normalizeItemRecord({ id: "hoe_basic", name: "낡은 괭이", farmTool: "hoe" }),
      normalizeItemRecord({ id: "hoe_gold", name: "황금 괭이", farmTool: "hoe" }),
    ];
    created.switches.push({ id: "sw_town", name: "마을 해금" });
    created.session.switches.sw_town = false;
    return created;
  }
  describe("upsert_craft_recipe → system.craftRecipes", () => {
    it("writes and then updates the recipe by id", () => {
      const ctx = { project: project() };
      const added = runTool(ctx, "upsert_craft_recipe", {
        recipe: { id: "r_plank", name: "판자 제작", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank", outputCount: 1, goldCost: 5, requiresUnlock: true },
      });
      expect(added.ok, added.summary).toBe(true);
      expect(ctx.project.system.craftRecipes).toEqual([
        { id: "r_plank", name: "판자 제작", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank", outputCount: 1, goldCost: 5, requiresUnlock: true },
      ]);

      const updated = runTool(ctx, "upsert_craft_recipe", {
        recipe: { id: "r_plank", ingredients: [{ itemId: "wood", count: 4 }], outputItemId: "plank", outputCount: 2 },
      });
      expect(updated.ok, updated.summary).toBe(true);
      expect(ctx.project.system.craftRecipes).toHaveLength(1);
      expect(ctx.project.system.craftRecipes?.[0]?.ingredients).toEqual([{ itemId: "wood", count: 4 }]);
      expect(ctx.project.system.craftRecipes?.[0]?.outputCount).toBe(2);
    });

    it("rejects an unknown itemId and names valid item ids", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "upsert_craft_recipe", {
        recipe: { id: "r_bad", ingredients: [{ itemId: "ghost", count: 1 }], outputItemId: "plank" },
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("wood");
      expect(result.summary).toContain("plank");
      expect(ctx.project.system.craftRecipes ?? []).toEqual([]);
    });
  });
  describe("delete_craft_recipe → system.craftRecipes", () => {
    it("removes exactly the requested recipe", () => {
      const ctx = { project: project() };
      ctx.project.system.craftRecipes = [
        { id: "r_a", ingredients: [{ itemId: "wood", count: 1 }], outputItemId: "plank" },
        { id: "r_b", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank" },
      ];
      const result = runTool(ctx, "delete_craft_recipe", { id: "r_a" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.craftRecipes?.map((recipe) => recipe.id)).toEqual(["r_b"]);
    });

    it("reports a missing id with the existing recipe ids", () => {
      const ctx = { project: project() };
      ctx.project.system.craftRecipes = [{ id: "r_b", ingredients: [], outputItemId: "plank" }];
      const result = runTool(ctx, "delete_craft_recipe", { id: "r_missing" });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("r_b");
      expect(ctx.project.system.craftRecipes).toHaveLength(1);
    });
  });
  describe("upsert_item_upgrade → system.itemUpgrades", () => {
    it("writes the upgrade row with tool capability", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "upsert_item_upgrade", {
        upgrade: {
          id: "u_hoe",
          fromItemId: "hoe_basic",
          toItemId: "hoe_gold",
          goldCost: 300,
          ingredients: [{ itemId: "wood", count: 3 }],
          capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.5 },
        },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.itemUpgrades).toEqual([
        {
          id: "u_hoe",
          fromItemId: "hoe_basic",
          toItemId: "hoe_gold",
          goldCost: 300,
          ingredients: [{ itemId: "wood", count: 3 }],
          capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.5 },
        },
      ]);
    });

    it("rejects an unknown toItemId and names valid item ids", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "upsert_item_upgrade", { upgrade: { id: "u_bad", fromItemId: "hoe_basic", toItemId: "ghost" } });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("hoe_gold");
      expect(ctx.project.system.itemUpgrades ?? []).toEqual([]);
    });

    it("rejects an out-of-range capability", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "upsert_item_upgrade", {
        upgrade: { id: "u_big", fromItemId: "hoe_basic", toItemId: "hoe_gold", capability: { areaWidth: 20, areaHeight: 20, energyMultiplier: 1 } },
      });
      expect(result.ok).toBe(false);
      expect(ctx.project.system.itemUpgrades ?? []).toEqual([]);
    });
  });
  describe("set_sell_prices → system.sellPrices", () => {
    it("upserts entries and removes by removeItemIds", () => {
      const ctx = { project: project() };
      const written = runTool(ctx, "set_sell_prices", { entries: [{ itemId: "wood", price: 12 }, { itemId: "plank", price: 40 }] });
      expect(written.ok, written.summary).toBe(true);
      expect(ctx.project.system.sellPrices).toEqual([{ itemId: "wood", price: 12 }, { itemId: "plank", price: 40 }]);

      const changed = runTool(ctx, "set_sell_prices", { entries: [{ itemId: "wood", price: 30 }], removeItemIds: ["plank"] });
      expect(changed.ok, changed.summary).toBe(true);
      expect(ctx.project.system.sellPrices).toEqual([{ itemId: "wood", price: 30 }]);
    });

    it("rejects an unknown itemId and names valid item ids", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "set_sell_prices", { entries: [{ itemId: "ghost", price: 1 }] });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("wood");
      expect(ctx.project.system.sellPrices ?? []).toEqual([]);
    });
  });
  describe("upsert_tool_action → system.toolActions", () => {
    it("writes the rule row", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "upsert_tool_action", {
        rule: { id: "ta_chop", farmTool: "axe", itemId: "hoe_gold", requiresFarmable: false, targetPlaceableKind: "tree", action: "chop" },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.toolActions).toEqual([
        { id: "ta_chop", farmTool: "axe", itemId: "hoe_gold", requiresFarmable: false, targetPlaceableKind: "tree", action: "chop" },
      ]);
    });

    it("rejects an unknown itemId and names valid item ids", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "upsert_tool_action", { rule: { id: "ta_bad", itemId: "ghost", action: "till" } });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("hoe_basic");
      expect(ctx.project.system.toolActions ?? []).toEqual([]);
    });
  });
  describe("configure_life_economy → energy/shipping/bundles/worldUnlocks/makers", () => {
    it("writes only the sections passed and preserves the others", () => {
      const ctx = { project: project() };
      const energy = runTool(ctx, "configure_life_economy", { energy: { max: 100, initial: 80, restorePerDay: 90 } });
      expect(energy.ok, energy.summary).toBe(true);
      expect(ctx.project.system.energy).toEqual({ max: 100, initial: 80, restorePerDay: 90 });

      const shipping = runTool(ctx, "configure_life_economy", { shipping: { enabled: true, historyLimit: 30, allowedItemIds: ["wood"] } });
      expect(shipping.ok, shipping.summary).toBe(true);
      expect(ctx.project.system.shipping).toEqual({ enabled: true, historyLimit: 30, allowedItemIds: ["wood"] });
      expect(ctx.project.system.energy).toEqual({ max: 100, initial: 80, restorePerDay: 90 });

      const rest = runTool(ctx, "configure_life_economy", {
        worldUnlocks: [{ id: "wu_beach", name: "해변", switchId: "sw_town" }],
        bundles: [{ id: "b_wood", name: "목재 꾸러미", requirements: [{ itemId: "wood", count: 5 }], reward: { gold: 100, itemRewards: [{ itemId: "plank", count: 1 }], switchId: "sw_town", worldUnlockIds: ["wu_beach"] } }],
        makers: [{ id: "m_saw", name: "제재기", inputs: [{ itemId: "wood", count: 2 }], outputs: [{ itemId: "plank", count: 1 }], durationMinutes: 120 }],
      });
      expect(rest.ok, rest.summary).toBe(true);
      expect(ctx.project.system.worldUnlocks).toEqual([{ id: "wu_beach", name: "해변", switchId: "sw_town" }]);
      expect(ctx.project.system.bundles?.[0]?.requirements).toEqual([{ itemId: "wood", count: 5 }]);
      expect(ctx.project.system.bundles?.[0]?.reward).toEqual({ gold: 100, itemRewards: [{ itemId: "plank", count: 1 }], switchId: "sw_town", worldUnlockIds: ["wu_beach"] });
      expect(ctx.project.system.makers).toEqual([
        { id: "m_saw", name: "제재기", inputs: [{ itemId: "wood", count: 2 }], outputs: [{ itemId: "plank", count: 1 }], durationMinutes: 120 },
      ]);
      expect(ctx.project.system.energy?.max).toBe(100);
      expect(ctx.project.system.shipping?.enabled).toBe(true);
    });

    it("rejects an unknown switchId and names valid switch ids", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "configure_life_economy", { worldUnlocks: [{ id: "wu_bad", switchId: "sw_ghost" }] });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("sw_town");
      expect(ctx.project.system.worldUnlocks).toBeUndefined();
    });

    it("rejects a bundle recipeId that no craft recipe defines", () => {
      const ctx = { project: project() };
      ctx.project.system.craftRecipes = [{ id: "r_known", ingredients: [], outputItemId: "plank" }];
      const result = runTool(ctx, "configure_life_economy", {
        bundles: [{ id: "b_bad", requirements: [{ itemId: "wood", count: 1 }], reward: { recipeIds: ["r_ghost"] } }],
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("r_known");
      expect(ctx.project.system.bundles).toBeUndefined();
    });

    it("rejects an empty call so the model cannot silently no-op", () => {
      const ctx = { project: project() };
      const result = runTool(ctx, "configure_life_economy", {});
      expect(result.ok).toBe(false);
    });
  });
});
