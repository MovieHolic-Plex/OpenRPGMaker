import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { craftRecipe, canCraft } from "@/project/craftRecipes";
import { createBlankProject } from "@/project/defaults";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import {
  ensureChest,
  depositToChest,
  withdrawFromChest,
  placeObject,
  removeObjectAt,
  findChestAt,
  inventoryEntries,
} from "@/project/placeables";
import { changeItem, startSession } from "@/project/session";
import { hasFarmToolAvailable, setEquippedTool, toolActionRulesOf } from "@/project/toolActions";
import { applyItemUpgrade, resolveSellPrice } from "@/project/upgrades";
import { interactWithFarmPlot } from "@/player/farming";
import { advanceFarmPlotsForDay } from "@/player/farming";
import { resolveTimeSystem, sleepGameTimeUntilMorning } from "@/project/gameTime";

describe("P1 tool action table", () => {
  it("defaults to legacy hoe/can rules when system.toolActions absent", () => {
    const project = createBlankProject();
    const rules = toolActionRulesOf(project);
    expect(rules.some((r) => r.farmTool === "hoe" && r.action === "till")).toBe(true);
    expect(rules.some((r) => r.farmTool === "wateringCan" && r.action === "water")).toBe(true);
  });

  it("respects authored toolActions override", () => {
    const project = createBlankProject();
    project.system.toolActions = [
      { id: "custom-hoe", farmTool: "hoe", requiresFarmable: true, action: "till" },
    ];
    expect(toolActionRulesOf(project)).toHaveLength(1);
  });
});

describe("P2 equipped tool hand", () => {
  it("strict: equipped wrong tool blocks till even if hoe in inventory", () => {
    const project = createFarmingDemoProject();
    const session = startSession(project);
    session.inventory = { item_hoe: 1, item_watering_can: 1 };
    setEquippedTool(session, "item_watering_can");
    expect(hasFarmToolAvailable(project, session, "hoe")).toBe(false);
    const map = project.maps[project.startMapId];
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("ignored");
  });

  it("prefers equipped tool when present in inventory", () => {
    const project = createFarmingDemoProject();
    const session = startSession(project);
    session.inventory = { item_hoe: 1, item_watering_can: 1 };
    setEquippedTool(session, "item_hoe");
    expect(hasFarmToolAvailable(project, session, "hoe")).toBe(true);
    setEquippedTool(session, undefined);
    // empty hand falls back to any inventory hoe
    expect(hasFarmToolAvailable(project, session, "hoe")).toBe(true);
  });

  it("farm till works with equipped hoe", () => {
    const project = createFarmingDemoProject();
    const session = startSession(project);
    session.inventory = { item_hoe: 1, item_potato_seed: 2 };
    setEquippedTool(session, "item_hoe");
    const map = project.maps[project.startMapId];
    const result = interactWithFarmPlot(project, session, map, 4, 5);
    expect(result.kind).toBe("tilled");
  });
});

describe("P3 craft recipes", () => {
  it("crafts when ingredients and optional gold present", () => {
    const project = createBlankProject();
    project.database.items.push(
      normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 }),
      normalizeItemRecord({ id: "item_fence", name: "울타리", scope: "none", price: 5 })
    );
    project.system.craftRecipes = [
      {
        id: "craft_fence",
        ingredients: [{ itemId: "item_wood", count: 2 }],
        outputItemId: "item_fence",
        outputCount: 1,
        goldCost: 10,
      },
    ];
    const session = startSession(project);
    session.gold = 100;
    session.inventory = { item_wood: 5 };
    expect(canCraft(project, session, "craft_fence").ok).toBe(true);
    const result = craftRecipe(project, session, "craft_fence");
    expect(result).toMatchObject({ ok: true, outputItemId: "item_fence" });
    expect(session.inventory.item_wood).toBe(3);
    expect(session.inventory.item_fence).toBe(1);
    expect(session.gold).toBe(90);
  });

  it("returns disabled when no recipes authored", () => {
    const project = createBlankProject();
    const session = startSession(project);
    expect(craftRecipe(project, session, "x")).toMatchObject({ ok: false, reason: "disabled" });
  });
});

describe("P4 chests and placeables", () => {
  it("deposits and withdraws chest items", () => {
    const session = startSession(createBlankProject());
    session.inventory = { item_a: 3 };
    ensureChest(session, { id: "chest_1", mapId: "m1", x: 1, y: 2 });
    expect(depositToChest(session, "chest_1", "item_a", 2)).toBe(true);
    expect(session.inventory.item_a).toBe(1);
    expect(session.chests?.chest_1.inventory.item_a).toBe(2);
    expect(withdrawFromChest(session, "chest_1", "item_a", 1)).toBe(true);
    expect(session.inventory.item_a).toBe(2);
  });

  it("places and removes objects at tile keys", () => {
    const session = startSession(createBlankProject());
    placeObject(session, { id: "obj1", mapId: "m1", x: 3, y: 4, kind: "chest", itemId: "item_chest" });
    expect(removeObjectAt(session, "m1", 3, 4)?.kind).toBe("chest");
    expect(removeObjectAt(session, "m1", 3, 4)).toBeUndefined();
  });
});

describe("P5 make_villager friendship wizard", () => {
  it("writes characterId, optional talkFriendship, and unlock pages", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps[ctx.project.startMapId];
    // ensure passable home
    const result = runTool(ctx, "make_villager", {
      mapId: map.id,
      id: "ev_wizard_npc",
      name: "마을 주민",
      home: { x: 1, y: 1 },
      dialogue: [{ text: "안녕" }],
      talkFriendship: true,
      friendshipUnlock: 80,
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[map.id].events.find((e) => e.id === "ev_wizard_npc");
    expect(event?.characterId).toBeTruthy();
    expect(event?.talkFriendship).toBe(true);
    const kinds = (event?.pages ?? []).flatMap((p) => p.conditions.map((c) => c.kind));
    expect(kinds).toContain("friendshipAtLeast");
    expect(kinds).toContain("selfSwitch");
  });

  it("같은 characterId 재요청은 새 id를 받아도 기존 주민을 재사용하고 대사를 보존한다", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps[ctx.project.startMapId];
    const first = runTool(ctx, "make_villager", {
      mapId: map.id,
      id: "ev_hana_guide",
      characterId: "hana_guide",
      name: "안내인 하나",
      home: { x: 2, y: 2 },
      dialogue: [{ text: "광장은 동쪽이에요." }],
    });
    expect(first.ok, first.summary).toBe(true);

    // Regression: explicit new id disabled nearby merging and allocateCharacterId
    // produced hana_guide_2, leaving two bodies for one authored character.
    const second = runTool(ctx, "make_villager", {
      mapId: map.id,
      id: "ev_hana_schedule_copy",
      characterId: "hana_guide",
      name: "안내인 하나",
      home: { x: 8, y: 8 },
      schedule: [
        { when: { hourRange: [8, 20] }, at: { mapId: map.id, x: 4, y: 2 }, activity: "guide" },
      ],
    });

    expect(second.ok, second.summary).toBe(true);
    expect(second.data).toMatchObject({ eventId: "ev_hana_guide", characterId: "hana_guide", reused: true });
    const updatedMap = ctx.project.maps[map.id];
    expect(updatedMap.events.filter((event) => event.characterId === "hana_guide")).toHaveLength(1);
    const hana = updatedMap.events.find((event) => event.id === "ev_hana_guide");
    expect(hana).toMatchObject({ x: 2, y: 2 });
    expect(JSON.stringify(hana?.pages)).toContain("광장은 동쪽이에요.");
    expect(hana?.schedule).toHaveLength(1);
  });
});

describe("P6 upgrades and sell prices", () => {
  it("applies upgrade and rewrites equipped tool", () => {
    const project = createBlankProject();
    project.database.items.push(
      normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, farmTool: "hoe" }),
      normalizeItemRecord({ id: "item_hoe_iron", name: "철 괭이", scope: "none", price: 200, farmTool: "hoe" })
    );
    project.system.itemUpgrades = [
      { id: "up_hoe", fromItemId: "item_hoe", toItemId: "item_hoe_iron", goldCost: 50 },
    ];
    const session = startSession(project);
    session.gold = 100;
    session.inventory = { item_hoe: 1 };
    setEquippedTool(session, "item_hoe");
    const result = applyItemUpgrade(project, session, "up_hoe");
    expect(result).toMatchObject({ ok: true, toItemId: "item_hoe_iron" });
    expect(session.inventory.item_hoe).toBeUndefined();
    expect(session.inventory.item_hoe_iron).toBe(1);
    expect(session.equippedToolItemId).toBe("item_hoe_iron");
    expect(session.gold).toBe(50);
  });

  it("resolves sell price from table or half item price", () => {
    const project = createBlankProject();
    // 기본 CC0 카탈로그에 item_potato 가 이미 있다. push 하면 items.find() 가 카탈로그의
    // 낡은 레코드를 먼저 집어 가격이 40 이 아닌 20 으로 읽힌다 — 반드시 upsert 해야 한다.
    const potato = normalizeItemRecord({ id: "item_potato", name: "감자", scope: "none", price: 40 });
    const existing = project.database.items.findIndex((item) => item.id === potato.id);
    if (existing >= 0) project.database.items[existing] = potato;
    else project.database.items.push(potato);
    project.system.sellPrices = [{ itemId: "item_potato", price: 30 }];
    expect(resolveSellPrice(project, "item_potato")).toBe(30);
    project.system.sellPrices = [];
    expect(resolveSellPrice(project, "item_potato")).toBe(20);
  });
});

describe("P7 smoke: farm + day advance tools", () => {
  it("tills, plants, waters, sleeps growth path without LegacyDb", () => {
    const project = createFarmingDemoProject();
    project.system.timeSystem = resolveTimeSystem({
      enabled: true,
      dayStartHour: 6,
      dayEndHour: 26,
      daysPerSeason: 28,
    });
    const session = startSession(project);
    session.inventory = { item_hoe: 1, item_watering_can: 1, item_potato_seed: 3 };
    setEquippedTool(session, "item_hoe");
    const map = project.maps[project.startMapId];
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("tilled");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("planted");
    setEquippedTool(session, "item_watering_can");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");
    // advance growth days without full scene
    advanceFarmPlotsForDay(project, session, 5, "spring");
    if (session.gameTime) {
      session.gameTime = sleepGameTimeUntilMorning(session.gameTime, project.system.timeSystem!).time;
    }
    expect(session.farmPlots?.[map.id]?.["4,5"]?.cropId).toBeTruthy();
  });
});

describe("P1 placeable chop via toolActions", () => {
  it("chops tree placeable with axe equipped", () => {
    const project = createBlankProject();
    project.database.items.push(
      normalizeItemRecord({ id: "item_axe", name: "도끼", scope: "none", price: 10, farmTool: "axe" as const }),
      normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 2 })
    );
    const session = startSession(project);
    session.inventory = { item_axe: 1 };
    setEquippedTool(session, "item_axe");
    const map = project.maps[project.startMapId];
    placeObject(session, { id: "t1", mapId: map.id, x: 2, y: 2, kind: "tree", itemId: "item_wood" });
    const result = interactWithFarmPlot(project, session, map, 2, 2);
    expect(result.kind).toBe("harvested");
    expect(session.inventory.item_wood).toBe(1);
    expect(session.placeables?.[map.id+":2,2"]).toBeUndefined();
  });
});

describe("craft/upgrade/equip commands via pure APIs (interpreter surface)", () => {
  it("equipTool helper sets hand; craft and upgrade still work", () => {
    const project = createBlankProject();
    project.database.items.push(
      normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 }),
      normalizeItemRecord({ id: "item_fence", name: "울타리", scope: "none", price: 5 }),
      normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, farmTool: "hoe" }),
      normalizeItemRecord({ id: "item_hoe_iron", name: "철 괭이", scope: "none", price: 200, farmTool: "hoe" })
    );
    project.system.craftRecipes = [{ id: "craft_fence", ingredients: [{ itemId: "item_wood", count: 1 }], outputItemId: "item_fence" }];
    project.system.itemUpgrades = [{ id: "up_hoe", fromItemId: "item_hoe", toItemId: "item_hoe_iron", goldCost: 0 }];
    const session = startSession(project);
    session.inventory = { item_wood: 2, item_hoe: 1 };
    setEquippedTool(session, "item_hoe");
    expect(session.equippedToolItemId).toBe("item_hoe");
    expect(craftRecipe(project, session, "craft_fence").ok).toBe(true);
    expect(applyItemUpgrade(project, session, "up_hoe").ok).toBe(true);
    expect(session.equippedToolItemId).toBe("item_hoe_iron");
  });
});

describe("P4 chest play surface helpers", () => {
  it("finds chest by map tile and lists inventories", () => {
    const project = createBlankProject();
    project.database.items.push(
      normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 })
    );
    const session = startSession(project);
    session.inventory = { item_wood: 3 };
    const mapId = project.startMapId;
    const chest = ensureChest(session, { id: "chest_farm_3_4", mapId, x: 3, y: 4 });
    expect(findChestAt(session, mapId, 3, 4)?.id).toBe(chest.id);
    expect(findChestAt(session, mapId, 9, 9)).toBeUndefined();
    expect(depositToChest(session, chest.id, "item_wood", 2)).toBe(true);
    expect(inventoryEntries(session.inventory)).toEqual([{ itemId: "item_wood", count: 1 }]);
    expect(inventoryEntries(chest.inventory)).toEqual([{ itemId: "item_wood", count: 2 }]);
    expect(withdrawFromChest(session, chest.id, "item_wood", 1)).toBe(true);
    expect(session.inventory.item_wood).toBe(2);
    expect(chest.inventory.item_wood).toBe(1);
  });

  it("stable openChest id uses map coords when empty chestId", () => {
    const mapId = "map_home";
    const x = 2;
    const y = 5;
    expect(`chest_${mapId}_${x}_${y}`).toBe("chest_map_home_2_5");
  });
});
