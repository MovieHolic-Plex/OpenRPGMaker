// 산출물 계약: 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)가
// 집어낸 "에디터 UI 는 쓰는데 어떤 툴도 못 쓰는" 저작 필드 32곳의 툴 이름·스키마·도달성.
// 필드별 쓰기 동작은 각 파사드 파일의 전용 테스트가 직접 증명한다.
// 도달성이 빠지면 툴이 있어도 모델은 "그 기능이 없습니다"로 답한다(openwiki/editor-ai-tools.md 2026-08-23 사건).
import { describe, expect, it } from "vitest";
import { activeTools, getTool, runTool, toOpenAiTools } from "@/editor/tools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { buildToolCapabilityIndex } from "@/ai/toolCapabilityIndex";
import type { JsonSchema, ToolContext } from "@/editor/tools";

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
