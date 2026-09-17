import { describe, expect, it } from "vitest";
import { contributeBundle } from "@/project/bundles";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { placeableKey } from "@/project/placeables";
import { changeItem, startSession } from "@/project/session";
import { depositShipping } from "@/project/shipping";
import { applyItemUpgrade } from "@/project/upgrades";
import { interactWithFarmPlot } from "@/player/farming";
import { startMaker } from "@/project/makers";

const ITEM_MAX = 9_999_999;

function addItem(project: ReturnType<typeof createBlankProject>, id: string, farmTool?: "axe"): void {
  const item = normalizeItemRecord({ id, name: id, scope: "none", price: 20, farmTool });
  const index = project.database.items.findIndex((entry) => entry.id === id);
  if (index >= 0) project.database.items[index] = item;
  else project.database.items.push(item);
}

describe("P0 hostile item quantity hardening", () => {
  it.each([
    { current: 1e300, op: "+=" as const, amount: 1 },
    { current: ITEM_MAX, op: "+=" as const, amount: 1 },
    { current: 1, op: "+=" as const, amount: Number.MAX_SAFE_INTEGER },
    { current: 1, op: "=" as const, amount: 1e300 },
  ])("rejects unsafe current/delta/result without touching inventory or charge cursors: $current $op $amount", ({ current, op, amount }) => {
    // Break caught: changeItem forwards unsafe arithmetic to itemTransitions,
    // silently sanitizing or overflowing state instead of failing atomically.
    const project = createBlankProject();
    const session = startSession(project, 1);
    session.inventory = { item_target: current, item_other: 2 };
    session.itemUseCharges = { item_target: 1, item_other: 1 };
    const before = structuredClone({ inventory: session.inventory, itemUseCharges: session.itemUseCharges });

    expect(changeItem(session, "item_target", op, amount)).toBe(false);
    expect({ inventory: session.inventory, itemUseCharges: session.itemUseCharges }).toEqual(before);
  });

  it("keeps shipping, bundle, and upgrade transactions unchanged for forged 1e300 stacks", () => {
    // Break caught: domain prechecks accept a finite integer like 1e300, then
    // subtraction loses precision and the same forged stack buys multiple outputs.
    const project = createBlankProject();
    for (const id of ["item_input", "item_reward", "item_tool"]) addItem(project, id);
    project.system.shipping = { enabled: true };
    project.system.sellPrices = [{ itemId: "item_input", price: 10 }];
    project.system.bundles = [{
      id: "bundle",
      requirements: [{ itemId: "item_input", count: 1 }],
      reward: { itemRewards: [{ itemId: "item_reward", count: 1 }] },
    }];
    project.system.itemUpgrades = [{
      id: "upgrade",
      fromItemId: "item_input",
      toItemId: "item_tool",
    }];
    const session = startSession(project, 2);
    session.inventory = { item_input: 1e300 };

    for (const action of [
      () => depositShipping(project, session, "item_input", 1),
      () => contributeBundle(project, session, "bundle", "item_input", 1),
      () => applyItemUpgrade(project, session, "upgrade"),
    ]) {
      const before = structuredClone(session);
      expect(action()).toMatchObject({ ok: false });
      expect(session).toEqual(before);
    }
  });

  it("does not consume a ready crop when its output stack is unsafe or full", () => {
    // Break caught: harvest advances/removes the crop even when changeItem cannot
    // represent the rewarded stack, allowing repeat harvest or silent loss.
    const project = createFarmingDemoProject();
    const session = startSession(project, 3);
    const map = project.maps[project.startMapId]!;
    session.inventory.item_potato = 1e300;
    session.farmPlots = {
      [map.id]: {
        "4,5": { tilled: true, watered: false, cropId: "crop_potato", stage: 2, growthDays: 2, dead: false },
      },
    };
    const before = structuredClone(session);

    expect(interactWithFarmPlot(project, session, map, 4, 5)).toMatchObject({ kind: "ignored" });
    expect(session).toEqual(before);
  });

  it("does not start a maker from a safe-integer stack above the shared item cap", () => {
    const project = createBlankProject();
    addItem(project, "item_input");
    addItem(project, "item_output");
    project.system.makers = [{
      id: "maker",
      inputs: [{ itemId: "item_input", count: 1 }],
      outputs: [{ itemId: "item_output", count: 1 }],
      durationMinutes: 10,
    }];
    const session = startSession(project, 5);
    session.inventory = { item_input: ITEM_MAX + 1 };
    const before = structuredClone(session);

    expect(startMaker(project, session, "farm:0,0", "maker", 100)).toMatchObject({ ok: false });
    expect(session).toEqual(before);
  });

  it("intersects a wide tool area with map bounds before visiting placeables", () => {
    // Break caught: capabilityTiles emits negative/out-of-map coordinates and
    // tryPlaceableToolHarvest runs before the farmable bounds check.
    const project = createFarmingDemoProject();
    addItem(project, "item_safety_axe", "axe");
    project.system.itemUpgrades = [{
      id: "upgrade_safety_axe",
      fromItemId: "item_safety_axe",
      toItemId: "item_safety_axe",
      capability: { areaWidth: 9, areaHeight: 9, energyMultiplier: 1 },
    }];
    const session = startSession(project, 4);
    const map = project.maps[project.startMapId]!;
    session.inventory = { item_safety_axe: 1 };
    session.equippedToolItemId = "item_safety_axe";
    const outsideKey = placeableKey(map.id, -1, -1);
    session.placeables = {
      [outsideKey]: { id: "outside", mapId: map.id, x: -1, y: -1, kind: "tree", itemId: "item_potato" },
    };

    expect(interactWithFarmPlot(project, session, map, 0, 0)).toMatchObject({ kind: "ignored" });
    expect(session.placeables?.[outsideKey]).toBeDefined();
    expect(session.inventory.item_potato).toBeUndefined();
  });
});
