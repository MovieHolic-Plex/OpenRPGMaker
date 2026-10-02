import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { findParentMapId, findTreeNode } from "@/project/mapTree";

function contextWithMap(): { context: ToolContext; mapId: string } {
  const context: ToolContext = { project: createEmptyToolProject("전체 편집기 툴 커버리지") };
  const root = runTool(context, "create_map", {
    id: "map_root",
    name: "루트 맵",
    width: 8,
    height: 8,
  });
  expect(root.ok, root.summary).toBe(true);
  const created = runTool(context, "create_map", {
    id: "map_source",
    name: "원본 맵",
    width: 12,
    height: 10,
  });
  expect(created.ok, created.summary).toBe(true);
  return { context, mapId: "map_source" };
}

describe("AI assistant editor-wide project mutation coverage", () => {
  it("duplicates a map with authored metadata and places the copy next to its source", () => {
    const { context, mapId } = contextWithMap();
    const source = context.project.maps[mapId];
    source.bgm = { mode: "custom", resourceId: "bgm_field", fadeInMs: 350 };
    source.background = { imageId: "easyrpg-backdrop-sky1", scrollX: 1, scrollY: -1 };
    source.disableSave = true;
    source.minimap = { enabled: true, corner: "topLeft", showEvents: true };
    source.cloudShadows = { enabled: true, opacity: 0.3, speed: 40, angleDeg: 200, scale: 1.5 };

    const result = runTool(context, "duplicate_map", {
      mapId,
      id: "map_copy",
      name: "복제된 맵",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps.map_copy).toMatchObject({
      id: "map_copy",
      name: "복제된 맵",
      bgm: source.bgm,
      background: source.background,
      disableSave: true,
      minimap: source.minimap,
      cloudShadows: source.cloudShadows,
    });
    expect(findParentMapId(context.project.mapTree, "map_copy")).toBe(findParentMapId(context.project.mapTree, mapId));
  });

  it("edits every map property exposed by the map properties editor", () => {
    const { context, mapId } = contextWithMap();
    const tilesetId = Object.keys(context.project.tilesets).find((id) => id !== context.project.maps[mapId].tilesetId);
    expect(tilesetId).toBeDefined();

    const result = runTool(context, "set_map_properties", {
      mapId,
      name: "속성 완성 맵",
      tilesetId,
      bgm: { mode: "custom", resourceId: "bgm_dungeon", fadeInMs: 500 },
      background: { imageId: "easyrpg-backdrop-dawn1", scrollX: 2, scrollY: 0 },
      battleBackground: "battle_cave",
      flags: { disableSave: true, disableTeleport: true, disableEscape: false },
      minimap: { enabled: true, corner: "bottomRight", scale: 0.2, showEvents: false, fogOfWar: true },
      cloudShadows: { enabled: true, opacity: 0.4, speed: 52, angleDeg: 200, scale: 1.5 },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.mapPropertiesChanged).toBe(1);
    expect(context.project.maps[mapId]).toMatchObject({
      name: "속성 완성 맵",
      tilesetId,
      bgm: { mode: "custom", resourceId: "bgm_dungeon", fadeInMs: 500 },
      background: { imageId: "easyrpg-backdrop-dawn1", scrollX: 2, scrollY: 0 },
      battleBackground: "battle_cave",
      disableSave: true,
      disableTeleport: true,
      minimap: { enabled: true, corner: "bottomRight", scale: 0.2, showEvents: false, fogOfWar: true },
      cloudShadows: { enabled: true, opacity: 0.4, speed: 52, angleDeg: 200, scale: 1.5 },
    });
    expect(context.project.maps[mapId].disableEscape).toBeUndefined();
  });

  it("creates, renames, reparents, and dissolves map folders through one canonical facade", () => {
    const { context, mapId } = contextWithMap();
    const created = runTool(context, "manage_map_tree", {
      operation: "create_folder",
      folderId: "folder_story",
      name: "스토리 맵",
    });
    expect(created.ok, created.summary).toBe(true);

    const moved = runTool(context, "manage_map_tree", {
      operation: "move",
      mapId,
      parentId: "folder_story",
      index: 0,
    });
    expect(moved.ok, moved.summary).toBe(true);
    expect(findParentMapId(context.project.mapTree, mapId)).toBe("folder_story");

    const renamed = runTool(context, "manage_map_tree", {
      operation: "rename_folder",
      folderId: "folder_story",
      name: "1막",
    });
    expect(renamed.ok, renamed.summary).toBe(true);
    expect(findTreeNode(context.project.mapTree, "folder_story")).toMatchObject({ kind: "folder", name: "1막" });

    const dissolved = runTool(context, "manage_map_tree", {
      operation: "dissolve_folder",
      folderId: "folder_story",
    });
    expect(dissolved.ok, dissolved.summary).toBe(true);
    expect(findTreeNode(context.project.mapTree, "folder_story")).toBeNull();
    expect(findTreeNode(context.project.mapTree, mapId)).not.toBeNull();
  });

  it("duplicates and deletes database records through typed project tools", () => {
    const context: ToolContext = { project: createEmptyToolProject("DB 수명주기") };
    const inserted = runTool(context, "upsert_item", {
      item: { id: "item_seed", name: "씨앗", price: 20 },
    });
    expect(inserted.ok, inserted.summary).toBe(true);

    const duplicated = runTool(context, "duplicate_database_record", {
      collection: "items",
      id: "item_seed",
      newId: "item_seed_copy",
      name: "씨앗 사본",
    });
    expect(duplicated.ok, duplicated.summary).toBe(true);
    expect(context.project.database.items.find((item) => item.id === "item_seed_copy")).toMatchObject({ name: "씨앗 사본", price: 20 });

    const removed = runTool(context, "delete_database_record", {
      collection: "items",
      id: "item_seed",
    });
    expect(removed.ok, removed.summary).toBe(true);
    expect(context.project.database.items.some((item) => item.id === "item_seed")).toBe(false);
    expect(context.project.database.items.some((item) => item.id === "item_seed_copy")).toBe(true);
  });

  it("authors utility database records that have dedicated editor tabs", () => {
    const context: ToolContext = { project: createEmptyToolProject("유틸리티 DB") };

    const element = runTool(context, "upsert_database_utility", {
      collection: "elements",
      record: { id: "element_light", name: "빛", kind: "magical", damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    });
    const terrain = runTool(context, "upsert_database_utility", {
      collection: "terrains",
      record: {
        id: "terrain_swamp",
        name: "늪",
        damage: 3,
        encounterRatePercent: 140,
        characterDisplay: "normal",
        vehiclePassage: { boat: true, ship: false, airshipLand: false },
      },
    });
    const command = runTool(context, "upsert_database_utility", {
      collection: "battleCommands",
      record: { id: "command_capture", name: "포획", kind: "capture" },
    });

    expect(element.ok, element.summary).toBe(true);
    expect(terrain.ok, terrain.summary).toBe(true);
    expect(command.ok, command.summary).toBe(true);
    expect(context.project.database.elements?.find((record) => record.id === "element_light")?.kind).toBe("magical");
    expect(context.project.database.terrains?.find((record) => record.id === "terrain_swamp")?.damage).toBe(3);
    expect(context.project.database.battleCommands?.find((record) => record.id === "command_capture")?.kind).toBe("capture");
  });

  it("changes project identity, terms, display, resources, and battle defaults", () => {
    const context: ToolContext = { project: createEmptyToolProject("프로젝트 설정") };
    const actorId = context.project.database.actors[0]?.id;
    expect(actorId).toBeDefined();
    const enemy = runTool(context, "upsert_enemy", { enemy: { id: "enemy_settings", name: "설정용 적", monsterResourceId: "generated-enemy-orc-01" } });
    const troop = runTool(context, "upsert_troop", { troop: { id: "troop_settings", name: "설정용 적 그룹", enemyIds: ["enemy_settings"] } });
    expect(enemy.ok, enemy.summary).toBe(true);
    expect(troop.ok, troop.summary).toBe(true);
    const troopId = "troop_settings";
    expect(troopId).toBeDefined();

    const previousDefaultBgm = context.project.system.defaultBgmResourceId;
    const previousBattleBgm = context.project.system.battleBgmResourceId;

    const result = runTool(context, "set_project_settings", {
      title: "별빛 연대기",
      author: "AI 조수",
      terms: { attack: "타격", gold: "별가루" },
      playResolution: { width: 640, height: 360 },
      resources: { defaultBgmResourceId: previousBattleBgm, battleBgmResourceId: previousDefaultBgm },
      battle: { flow: "strict", uiStyle: "rm2003", activeSlots: 2, initialTroopId: troopId },
      startActorIds: [actorId],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.meta).toMatchObject({ title: "별빛 연대기", author: "AI 조수", terms: { attack: "타격", gold: "별가루" } });
    expect(context.project.system).toMatchObject({
      playResolution: { width: 640, height: 360 },
      defaultBgmResourceId: previousBattleBgm,
      battleBgmResourceId: previousDefaultBgm,
      battleFlow: "strict",
      battleUiStyle: "rm2003",
      activeSlots: 2,
      initialTroopId: troopId,
      startActorIds: [actorId],
    });
  });
});
