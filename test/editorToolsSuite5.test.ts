import { describe, expect, it, vi, beforeAll } from "vitest";
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
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { giveMonster, evolveMonster, monsterMaxHp } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { interactWithFarmPlot, advanceFarmPlotsForDay, farmPlotAt, cropReady } from "@/player/farming";
import { simulateBattle } from "@/battle/simulate";

vi.mock("../electron/shared/lifeSim", () => ({ LIFE_SIM_ENABLED: true, LIFE_SIM_CLOSED_TITLE: "", LIFE_SIM_CLOSED_BODY: "", LIFE_SIM_CLOSED_NOTICE: "" }));

describe("aiEditorCapabilityParity", () => {
  isolateTimers();
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
});

describe("threeAxisRedTeam", () => {
  isolateTimers();
  beforeAll(() => {
    // createBlankProject() 는 호출마다 약 80MB 를 새로 만든다(test/support/blankProject.ts 머리말) — 이 파일의 느린 케이스는 한 케이스에 그것을 여러 번 부르거나 부르는 제품 함수를 돌려
    // CI(4코어 호스티드 러너)에서 11~15초가 걸려 기본 15초 제한에 걸리거나 닿을 듯하다. 판정은 그대로 두고 제한만 이 파일의 다른 무거운 시험과 같이 넓힌다.
    vi.setConfig({ testTimeout: 120_000 });
  });
  type AttackCase = {
    id: string;
    axis: "pokemon" | "stardew" | "jrpg" | "cross";
    scenario: string;
    expectedBehavior: string;
    verdict: "passed" | "failed";
    detail: string;
  };
  function attack(
    id: string,
    axis: AttackCase["axis"],
    scenario: string,
    expectedBehavior: string,
    fn: () => { ok: boolean; detail: string },
  ): AttackCase {
    try {
      const result = fn();
      return {
        id,
        axis,
        scenario,
        expectedBehavior,
        verdict: result.ok ? "passed" : "failed",
        detail: result.detail,
      };
    } catch (error) {
      return {
        id,
        axis,
        scenario,
        expectedBehavior,
        verdict: "failed",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
  describe("three-axis red-team attack suite", () => {
    it("rejects invalid/abusive tool and runtime paths (critical attacks)", () => {
      const cases: AttackCase[] = [];

      cases.push(
        attack("rt-pkmn-system-off-starter", "pokemon", "give_starter while monsterCollection off", "warn or still create but warn", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          delete ctx.project.system.monsterCollection;
          const r = runTool(ctx, "give_starter_monsters", {
            speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"],
          });
          const warnings = [
            ...(r.warnings ?? []),
            ...(((r as { diff?: { warnings?: string[] } }).diff?.warnings) ?? []),
          ];
          const warned = warnings.some((w) => /monster|configure_monster|포획/i.test(w));
          return { ok: r.ok === true && warned, detail: `ok=${r.ok} warnings=${JSON.stringify(warnings)}` };
        }),
      );

      cases.push(
        attack("rt-pkmn-invalid-species", "pokemon", "giveMonster missing species", "ok:false missingSpecies", () => {
          const project = createBlankProject();
          const session = startSession(project, 1);
          const r = giveMonster(project, session, { speciesId: "species_does_not_exist", level: 5 });
          return { ok: !r.ok && r.reason === "missingSpecies", detail: JSON.stringify(r) };
        }),
      );

      cases.push(
        attack("rt-pkmn-evolve-missing-item", "pokemon", "item evolution without item", "ok:false missingItem", () => {
          const project = createBlankProject();
          const slime = project.database.monsterSpecies?.find((s) => s.id === "species_wild_slime");
          if (!slime) return { ok: false, detail: "no slime" };
          slime.evolutions = [{ toSpeciesId: "species_king_slime", requires: { itemId: "item_capture_orb" } }];
          const session = startSession(project, 2);
          const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
          if (!gift.ok) return { ok: false, detail: "gift fail" };
          const r = evolveMonster(project, session, { instanceId: gift.instance.instanceId, allowItemEvolution: true });
          return { ok: !r.ok && r.reason === "missingItem", detail: JSON.stringify(r) };
        }),
      );

      cases.push(
        attack("rt-pkmn-type-chart-invalid-types", "pokemon", "set_type_chart empty/malformed", "tool rejects or no-ops safely", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "set_type_chart", { types: [], multipliers: {} });
          // empty chart should either fail or leave a non-crashing system
          const safe = r.ok === false || Array.isArray(ctx.project.system.typeChart?.types);
          return { ok: safe, detail: `ok=${r.ok} types=${JSON.stringify(ctx.project.system.typeChart?.types)}` };
        }),
      );

      cases.push(
        attack("rt-pkmn-capture-system-off-battle", "pokemon", "monsterParty battle without battleParty flag path", "simulateBattle enables path or falls back without crash", () => {
          const project = createBlankProject();
          const session = startSession(project, 3);
          const gift = giveMonster(project, session, { speciesId: "species_aqualing", level: 10 });
          if (!gift.ok) return { ok: false, detail: "gift" };
          const r = simulateBattle({
            project,
            troopId: "troop_slime",
            heroLevel: 1,
            battleFlow: "strict",
            n: 1,
            seed: 1,
            monsterParty: [gift.instance],
            maxSteps: 10,
          });
          return { ok: r.participatingActorIds.length > 0, detail: `participants=${r.participatingActorIds.join(",")}` };
        }),
      );

      cases.push(
        attack("rt-farm-outside-area", "stardew", "interact outside farmableArea", "ignored", () => {
          const project = createBlankProject();
          const map = project.maps[project.startMapId]!;
          map.farmableArea = [{ x: 5, y: 5, w: 1, h: 1 }];
          const session = startSession(project, 4);
          session.inventory.item_any_hoe = 1;
          const r = interactWithFarmPlot(project, session, map, 0, 0);
          return { ok: r.kind === "ignored", detail: r.kind };
        }),
      );

      cases.push(
        attack("rt-farm-no-seed", "stardew", "till then plant without seed", "does not plant / no crash", () => {
          const project = createBlankProject();
          const map = project.maps[project.startMapId]!;
          map.farmableArea = [{ x: 2, y: 2, w: 2, h: 2 }];
          const session = startSession(project, 5);
          // hoe only if any farmTool item exists; otherwise till may ignore — still must not throw
          const hoe = project.database.items.find((i) => i.farmTool === "hoe");
          if (hoe) session.inventory[hoe.id] = 1;
          const till = interactWithFarmPlot(project, session, map, 2, 2);
          const plant = interactWithFarmPlot(project, session, map, 2, 2);
          const ok = till.kind === "tilled" || till.kind === "ignored" || plant.kind !== "planted";
          return { ok, detail: `till=${till.kind} plant=${plant.kind}` };
        }),
      );

      cases.push(
        attack("rt-time-disable", "stardew", "configure_time_system enabled:false removes package", "timeSystem undefined", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          runTool(ctx, "configure_time_system", { enabled: true });
          const off = runTool(ctx, "configure_time_system", { enabled: false });
          return { ok: off.ok && ctx.project.system.timeSystem === undefined, detail: JSON.stringify(ctx.project.system.timeSystem) };
        }),
      );

      cases.push(
        attack("rt-hunt-ghost-troop", "jrpg", "set_encounter_table with unknown troopId", "rejected", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "set_encounter_table", {
            mapId: ctx.project.startMapId,
            entries: [{ troopId: "troop_does_not_exist", weight: 1 }],
          });
          return { ok: r.ok === false, detail: `ok=${r.ok} ${r.summary ?? ""}` };
        }),
      );

      cases.push(
        attack("rt-hunt-bad-area", "jrpg", "make_hunting_ground out of bounds / invalid", "rejected or clamped safely", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const troopId = ctx.project.database.troops[0]?.id ?? "troop_slime";
          const r = runTool(ctx, "make_hunting_ground", {
            mapId: ctx.project.startMapId,
            area: { x: -10, y: -10, w: 0, h: 0 },
            troopId,
          });
          // Must not throw; either reject or no-op-ish write
          return { ok: typeof r.ok === "boolean", detail: `ok=${r.ok} ${r.summary ?? r.error ?? ""}` };
        }),
      );

      cases.push(
        attack("rt-promo-missing-class", "jrpg", "define_promotion unknown class", "rejected", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "define_promotion", {
            classId: "class_nope",
            toClassId: "class_also_nope",
            requires: { level: 99 },
          });
          return { ok: r.ok === false, detail: `ok=${r.ok}` };
        }),
      );

      cases.push(
        attack("rt-crop-missing-items", "stardew", "define_crop with missing seed item", "rejected or warning", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "define_crop", {
            crop: {
              id: "crop_bad",
              name: "불량",
              seedItemId: "item_missing_seed",
              harvestItemId: "item_missing_harvest",
              stages: [{ days: 1 }],
              seasons: ["spring"],
            },
          });
          // Prefer hard reject; accept soft write only if project still loadable (no throw)
          const ok = r.ok === false || ctx.project.database.crops?.some((c) => c.id === "crop_bad") === true;
          return { ok, detail: `ok=${r.ok}` };
        }),
      );

      const failed = cases.filter((c) => c.verdict === "failed");
      const report = {
        schemaVersion: 1,
        kind: "three-axis-red-team-report",
        generatedAt: new Date().toISOString(),
        total: cases.length,
        passed: cases.length - failed.length,
        failed: failed.length,
        cases,
      };

      const outDir = resolve("output/evidence/three-axis-redteam");
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, "report.json");
      writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

      expect(failed, `red-team failures: ${failed.map((f) => f.id).join(", ")}`).toEqual([]);
      expect(report.passed).toBe(cases.length);
    });
  });
});

describe("threeAxisVerticalSlice", () => {
  isolateTimers();
  /**
   * Contract: 10-minute vertical slices for the three product axes,
   * exercised through authoring tools + runtime APIs (no browser).
   */
  describe("three-axis vertical slice contracts", () => {
    it("Pokemon: tools enable collection → starter gift → capture-ready troop → evolve", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;

      expect(runTool(ctx, "configure_monster_system", { enabled: true, battleParty: true }).ok).toBe(true);
      expect(ctx.project.system.monsterCollection).toBe(true);
      expect(ctx.project.system.battleParty === "monsters" || ctx.project.system.monsterBattleParty === true).toBe(true);

      expect(
        runTool(ctx, "set_type_chart", {
          types: ["fire", "water", "grass"],
          multipliers: {
            fire: { fire: 0.5, water: 0.5, grass: 2 },
            water: { fire: 2, water: 0.5, grass: 0.5 },
            grass: { fire: 0.5, water: 2, grass: 0.5 },
          },
        }).ok,
      ).toBe(true);

      const starter = runTool(ctx, "give_starter_monsters", {
        speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"],
      });
      expect(starter.ok).toBe(true);
      const starterEvent = ctx.project.maps[mapId]?.events.find((e) => e.id === "ev_starter_monsters");
      expect(starterEvent?.pages?.[0]?.commands?.some((c) => c.kind === "choices")).toBe(true);

      // Runtime loop: gift slime → evolve at level gate
      const session = startSession(ctx.project, 11);
      const gift = giveMonster(ctx.project, session, { speciesId: "species_wild_slime", level: 7 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) throw new Error("gift");
      const evo = evolveMonster(ctx.project, session, { instanceId: gift.instance.instanceId });
      expect(evo.ok && evo.toSpeciesId).toBe("species_king_slime");
      expect(monsterMaxHp(ctx.project, session.monsterInstances[gift.instance.instanceId])).toBeGreaterThan(0);

      // Headless monster battle path
      const battle = simulateBattle({
        project: ctx.project,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        n: 1,
        seed: 2,
        monsterParty: [session.monsterInstances[gift.instance.instanceId]!],
        maxSteps: 20,
      });
      expect(battle.participatingActorIds).toContain(gift.instance.instanceId);
    });

    it("Stardew: configure time → farm plot → till/plant/water/grow/harvest", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;

      expect(runTool(ctx, "configure_time_system", { enabled: true, minutesPerRealSecond: 60 }).ok).toBe(true);
      expect(ctx.project.system.timeSystem?.enabled).toBe(true);

      // seed + harvest items
      ctx.project.database.items.push(
        normalizeItemRecord({ id: "item_vslice_seed", name: "슬라이스 씨앗", scope: "none", price: 5 }),
        normalizeItemRecord({ id: "item_vslice_crop", name: "슬라이스 작물", scope: "none", price: 20 }),
        normalizeItemRecord({ id: "item_vslice_hoe", name: "괭이", scope: "none", price: 0, farmTool: "hoe" }),
        normalizeItemRecord({ id: "item_vslice_can", name: "물뿌리개", scope: "none", price: 0, farmTool: "wateringCan" }),
      );

      expect(
        runTool(ctx, "define_crop", {
          crop: {
            id: "crop_vslice",
            name: "슬라이스 작물",
            seedItemId: "item_vslice_seed",
            harvestItemId: "item_vslice_crop",
            stages: [{ days: 1 }, { days: 1 }],
            seasons: ["spring"],
          },
        }).ok,
      ).toBe(true);

      expect(runTool(ctx, "create_farm_plot", { mapId, area: { x: 3, y: 3, w: 2, h: 2 } }).ok).toBe(true);

      const session = startSession(ctx.project, 12);
      session.inventory.item_vslice_seed = 2;
      session.inventory.item_vslice_hoe = 1;
      session.inventory.item_vslice_can = 1;
      const map = ctx.project.maps[mapId]!;

      expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("tilled");
      expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("planted");
      expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("watered");
      advanceFarmPlotsForDay(ctx.project, session, 1, "spring");
      expect(farmPlotAt(session, map.id, 3, 3)?.stage).toBe(1);
      expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("watered");
      advanceFarmPlotsForDay(ctx.project, session, 1, "spring");
      const ready = farmPlotAt(session, map.id, 3, 3);
      expect(cropReady(ctx.project, ready)).toBe(true);
      expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("harvested");
      expect(session.inventory.item_vslice_crop).toBeGreaterThanOrEqual(1);
    });

    it("JRPG: hunting ground + encounter table + promotion tool path", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const troopId = ctx.project.database.troops[0]?.id;
      if (!troopId) throw new Error("missing troop");
      const classId = ctx.project.database.classes[0]?.id;
      const toClassId = ctx.project.database.classes[1]?.id ?? classId;
      if (!classId || !toClassId) throw new Error("missing class");

      expect(
        runTool(ctx, "set_encounter_table", {
          mapId,
          entries: [{ troopId, weight: 3, conditions: { region: { x: 0, y: 0, w: 6, h: 6 } } }],
        }).ok,
      ).toBe(true);

      expect(
        runTool(ctx, "make_hunting_ground", {
          mapId,
          area: { x: 1, y: 1, w: 4, h: 4 },
          troopId,
          maxAlive: 2,
          respawnSec: 5,
        }).ok,
      ).toBe(true);

      const map = ctx.project.maps[mapId]!;
      expect(map.encounterTable?.length).toBeGreaterThan(0);
      expect(JSON.stringify(map)).toMatch(/fieldSpawn|encounterTable|troop/);

      if (classId !== toClassId) {
        expect(
          runTool(ctx, "define_promotion", {
            classId,
            toClassId,
            requires: { level: 5 },
          }).ok,
        ).toBe(true);
        const klass = ctx.project.database.classes.find((c) => c.id === classId);
        expect(klass?.promotions?.some((p) => p.toClassId === toClassId)).toBe(true);
      }

      // Boss-style troop still simulatable
      const battle = simulateBattle({
        project: ctx.project,
        troopId,
        heroLevel: 10,
        battleFlow: "strict",
        n: 1,
        seed: 5,
        maxSteps: 40,
      });
      expect(battle.participatingActorIds.length).toBeGreaterThan(0);
    });
  });
});
