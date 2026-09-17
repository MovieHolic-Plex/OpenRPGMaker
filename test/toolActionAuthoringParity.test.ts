import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { placeObject, ensureChest } from "@/project/placeables";
import { startSession } from "@/project/session";
import { resolveToolUseOnTile, toolActionRulesOf } from "@/project/toolActions";
import { farmIntentForHand, interactWithFarmPlot } from "@/player/farming";

function fixture() {
  const project = createFarmingDemoProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("fixture map missing");
  map.lowerTiles.fill(0);
  map.upperTiles.fill(-1);
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("fixture tileset missing");
  tileset.passability[0] = { up: true, down: true, left: true, right: true };
  project.session.farmBuildingPlacements = [];
  project.session.homeDecorationPlacements = [];
  const session = startSession(project, 1);
  session.inventory = { item_hoe: 1, item_watering_can: 1, item_potato_seed: 3 };
  session.equippedToolItemId = "item_hoe";
  return { project, map, session };
}

describe("authored tool authority", () => {
  it("keeps all four real defaults for absent and empty tables", () => {
    const { project } = fixture();
    const expected = ["till", "water", "chop", "mine"];
    expect(toolActionRulesOf(project).map((rule) => rule.action)).toEqual(expected);
    project.system.toolActions = [];
    expect(toolActionRulesOf(project).map((rule) => rule.action)).toEqual(expected);
  });

  it("does not merge defaults into an existing one-row table on load", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "only-fish", action: "fish", farmTool: "hoe" }];
    const restored = deserialize(serialize(project));
    expect(toolActionRulesOf(restored)).toEqual(project.system.toolActions);
    expect(resolveToolUseOnTile(restored, session, map, 4, 5, "till")).toBeUndefined();
  });

  it.each(["hoe", "wateringCan", "axe", "pickaxe"] as const)("matches a conditionless rule with a valid %s", (farmTool) => {
    const { project, map, session } = fixture();
    project.database.items.push(normalizeItemRecord({ id: "tool", name: "tool", farmTool, consumable: false }));
    session.inventory = { tool: 1 };
    session.equippedToolItemId = "tool";
    project.system.toolActions = [{ id: "any", action: "fish" }];
    expect(resolveToolUseOnTile(project, session, map, 4, 5, "fish")).toMatchObject({ itemId: "tool", farmTool, ruleId: "any" });
  });

  it.each(["item_potato_seed", "item_potion", "missing"])("does not treat %s as any farm tool or fall through an occupied hand", (itemId) => {
    const { project, map, session } = fixture();
    session.inventory[itemId] = 1;
    session.equippedToolItemId = itemId;
    project.system.toolActions = [{ id: "any", action: "fish" }];
    expect(resolveToolUseOnTile(project, session, map, 4, 5, "fish")).toBeUndefined();
  });

  it("resolves any tool from inventory when hand is empty", () => {
    const { project, map, session } = fixture();
    delete session.equippedToolItemId;
    project.system.toolActions = [{ id: "any", action: "fish" }];
    expect(resolveToolUseOnTile(project, session, map, 4, 5, "fish")?.itemId).toBe("item_hoe");
  });

  it.each(["seed", "normalGoods"] as const)("refuses a %s consumable even if it carries a farmTool field", (type) => {
    const { project, map, session } = fixture();
    project.database.items.push(normalizeItemRecord({ id: "not-tool", name: "not-tool", type, farmTool: "hoe", consumable: true }));
    session.inventory["not-tool"] = 1;
    session.equippedToolItemId = "not-tool";
    project.system.toolActions = [{ id: "any", action: "till", requiresFarmable: false }];
    const before = structuredClone(session);
    expect(resolveToolUseOnTile(project, session, map, 4, 5)).toBeUndefined();
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("ignored");
    expect(session).toEqual(before);
  });

  it("honors itemId over a contradictory kind, without reordering rows", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [
      { id: "first", action: "fish", itemId: "item_hoe", farmTool: "axe" },
      { id: "second", action: "fish", farmTool: "hoe" },
    ];
    expect(resolveToolUseOnTile(project, session, map, 4, 5)?.ruleId).toBe("first");
    project.system.toolActions.reverse();
    expect(resolveToolUseOnTile(project, session, map, 4, 5)?.ruleId).toBe("second");
    session.equippedToolItemId = "item_watering_can";
    expect(resolveToolUseOnTile(project, session, map, 4, 5)).toBeUndefined();
  });

  it("preserves explicit false through serialization and tills outside the region", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "outside", action: "till", farmTool: "hoe", requiresFarmable: false }];
    const restored = deserialize(serialize(project));
    expect(restored.system.toolActions?.[0]?.requiresFarmable).toBe(false);
    expect(interactWithFarmPlot(restored, session, map, 1, 1).kind).toBe("tilled");
  });

  it.each([undefined, true])("refuses till outside the region when requiresFarmable is %s", (requiresFarmable) => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "restricted", action: "till", farmTool: "hoe", requiresFarmable }];
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 1, 1).kind).toBe("ignored");
    expect(session).toEqual(before);
  });

  it("lets the authored water action override the held hoe's legacy intent", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "water-hoe", action: "water", itemId: "item_hoe", requiresFarmable: false }];
    session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false, cropId: "crop_potato", stage: 0 } } };
    expect(interactWithFarmPlot(project, session, map, 1, 1, farmIntentForHand(project, session)).kind).toBe("watered");
  });

  it("keeps the held hoe from auto-planting after the defaults are materialized", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = toolActionRulesOf(project).map((rule) => ({ ...rule }));
    session.farmPlots = { [map.id]: { "4,5": { tilled: true, watered: false } } };
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 4, 5, farmIntentForHand(project, session))).toMatchObject({ kind: "ignored", reason: "wrong-tool-for-plot" });
    expect(session).toEqual(before);
  });

  it.each(["item_hoe", "item_potato_seed"])("refuses mature crop harvest with %s when the authored rule requires a can", (itemId) => {
    const { project, map, session } = fixture();
    session.equippedToolItemId = itemId;
    project.system.toolActions = [{ id: "harvest-can", action: "harvest", farmTool: "wateringCan" }];
    session.farmPlots = { [map.id]: { "4,5": { tilled: true, watered: false, cropId: "crop_potato", stage: 2 } } };
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 4, 5, farmIntentForHand(project, session))).toMatchObject({ kind: "ignored", reason: "wrong-tool-for-plot" });
    expect(session).toEqual(before);
  });

  it("harvests with a matching authored rule outside the region", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "harvest-hoe", action: "harvest", farmTool: "hoe", requiresFarmable: false }];
    session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false, cropId: "crop_potato", stage: 2 } } };
    expect(interactWithFarmPlot(project, session, map, 1, 1, farmIntentForHand(project, session)).kind).toBe("harvested");
    expect(session.inventory.item_potato).toBe(1);
  });

  it("keeps legacy mature harvesting with a seed when no harvest rule exists", () => {
    const { project, map, session } = fixture();
    session.equippedToolItemId = "item_potato_seed";
    project.system.toolActions = [{ id: "only-till", action: "till", farmTool: "hoe" }];
    session.farmPlots = { [map.id]: { "4,5": { tilled: true, watered: false, cropId: "crop_potato", stage: 2 } } };
    expect(interactWithFarmPlot(project, session, map, 4, 5, "plant").kind).toBe("harvested");
  });

  it("does not allow seeds to plant outside farmable regions via a false tool rule", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "anywhere", action: "till", requiresFarmable: false }];
    session.equippedToolItemId = "item_potato_seed";
    session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false } } };
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 1, 1, "plant").kind).toBe("ignored");
    expect(session).toEqual(before);
  });

  it.each([[-1, 5], [4, -1], [999, 5], [4, 999], [4.5, 5], [NaN, 5]])("refuses invalid origin %s,%s even for a wide unrestricted tool", (x, y) => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "anywhere", action: "till", farmTool: "hoe", requiresFarmable: false }];
    project.system.itemUpgrades = [{ id: "wide", fromItemId: "item_watering_can", toItemId: "item_hoe", capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 1 } }];
    const before = structuredClone(session);
    expect(resolveToolUseOnTile(project, session, map, x, y)).toBeUndefined();
    expect(interactWithFarmPlot(project, session, map, x, y).kind).toBe("ignored");
    expect(session).toEqual(before);
  });

  it.each(["wall", "chest", "placeable", "building", "decoration"] as const)("does not let false bypass %s occupancy or terrain", (obstacle) => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "anywhere", action: "till", farmTool: "hoe", requiresFarmable: false }];
    map.farmableArea = [{ x: 1, y: 1, w: 1, h: 1 }];
    switch (obstacle) {
      case "wall": map.lowerTiles[map.width + 1] = -1; break;
      case "chest": ensureChest(session, { id: "chest", mapId: map.id, x: 1, y: 1 }); break;
      case "placeable": placeObject(session, { id: "object", mapId: map.id, x: 1, y: 1, kind: "fence" }); break;
      case "building": session.farmBuildingPlacements = { occupied: { instanceId: "occupied", typeId: "farm_building_workshop", mapId: map.id, x: 0, y: 1, orientation: "down", level: 1 } }; break;
      case "decoration": session.homeDecorationPlacements = { occupied: { instanceId: "occupied", typeId: "home_decor_sun_rug", mapId: map.id, x: 0, y: 1, orientation: "down" } }; break;
    }
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 1, 1).kind).toBe("ignored");
    expect(session).toEqual(before);
  });

  it("applies a wide tool only to safe cells and charges only those cells", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "wide", action: "till", farmTool: "hoe", requiresFarmable: false }];
    project.system.itemUpgrades = [{ id: "wide", fromItemId: "item_watering_can", toItemId: "item_hoe", capability: { areaWidth: 3, areaHeight: 1, energyMultiplier: 1 } }];
    project.system.energy = { max: 10, initial: 10 };
    session.energy = 10;
    ensureChest(session, { id: "chest", mapId: map.id, x: 0, y: 1 });
    map.lowerTiles[map.width + 2] = -1;
    expect(interactWithFarmPlot(project, session, map, 1, 1)).toMatchObject({ kind: "tilled", energySpent: 1, affectedTiles: [{ x: 1, y: 1, kind: "tilled" }] });
    expect(session.farmPlots?.[map.id]).toEqual({ "1,1": { tilled: true, watered: false } });
    expect(session.energy).toBe(9);
  });

  it.each(["tree", "rock"] as const)("refuses harvesting a %s underneath another occupied object", (kind) => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "special", action: kind === "tree" ? "chop" : "mine", itemId: "item_hoe", requiresFarmable: false }];
    placeObject(session, { id: "target", kind, itemId: "item_potato", mapId: map.id, x: 1, y: 1 });
    ensureChest(session, { id: "chest", mapId: map.id, x: 1, y: 1 });
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 1, 1).kind).toBe("ignored");
    expect(session).toEqual(before);
  });

  it("rolls back every wide-tool cell when energy is insufficient", () => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "wide", action: "till", farmTool: "hoe", requiresFarmable: false }];
    project.system.itemUpgrades = [{ id: "wide", fromItemId: "item_watering_can", toItemId: "item_hoe", capability: { areaWidth: 3, areaHeight: 1, energyMultiplier: 1 } }];
    project.system.energy = { max: 10, initial: 1 };
    session.energy = 1;
    const before = structuredClone(session);
    expect(interactWithFarmPlot(project, session, map, 1, 1)).toMatchObject({ kind: "ignored", reason: "insufficient-energy" });
    expect(session).toEqual(before);
  });

  it.each(["till", "water", "chop", "mine", "fish", "harvest"] as const)("checks authored region and target restrictions for %s", (action) => {
    const { project, map, session } = fixture();
    project.system.toolActions = [{ id: "rule", action, itemId: "item_hoe", requiresFarmable: true, targetPlaceableKind: "tree" }];
    expect(resolveToolUseOnTile(project, session, map, 4, 5, action)).toBeUndefined();
    placeObject(session, { id: "tree", kind: "tree", mapId: map.id, x: 4, y: 5 });
    expect(resolveToolUseOnTile(project, session, map, 4, 5, action)?.ruleId).toBe("rule");
    placeObject(session, { id: "outside", kind: "tree", mapId: map.id, x: 1, y: 1 });
    expect(resolveToolUseOnTile(project, session, map, 1, 1, action)).toBeUndefined();
  });
});
