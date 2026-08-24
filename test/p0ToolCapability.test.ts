import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { applyItemUpgrade, resolveToolCapability } from "@/project/upgrades";

describe("P0 upgraded tool capabilities", () => {
  it("resolves the upgraded item area and energy multiplier after replacement", () => {
    // Break caught: upgrade swaps item ids but runtime queries still see base 1x1/1.0 behavior.
    const project = createBlankProject();
    for (const id of ["item_hoe", "item_hoe_iron"]) {
      const record = normalizeItemRecord({ id, name: id, scope: "none", price: 50, farmTool: "hoe" });
      const index = project.database.items.findIndex((item) => item.id === id);
      if (index >= 0) project.database.items[index] = record;
      else project.database.items.push(record);
    }
    project.system.itemUpgrades = [{
      id: "upgrade_hoe_iron",
      fromItemId: "item_hoe",
      toItemId: "item_hoe_iron",
      capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.75 },
    }];
    const session = startSession(project, 1);
    session.inventory = { item_hoe: 1 };
    session.equippedToolItemId = "item_hoe";

    expect(resolveToolCapability(project, "item_hoe")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
    expect(applyItemUpgrade(project, session, "upgrade_hoe_iron").ok).toBe(true);
    expect(session.equippedToolItemId).toBe("item_hoe_iron");
    expect(resolveToolCapability(project, session.equippedToolItemId)).toEqual({
      areaWidth: 3,
      areaHeight: 3,
      energyMultiplier: 0.75,
    });
  });

  it("keeps legacy upgrade rows at safe default behavior and ignores malformed capability values", () => {
    // Break caught: omitted/invalid additive fields change legacy tools or emit NaN costs.
    const project = createBlankProject();
    project.system.itemUpgrades = [{ id: "legacy", fromItemId: "a", toItemId: "b" }];
    expect(resolveToolCapability(project, "b")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
    project.system.itemUpgrades = [{
      id: "bad",
      fromItemId: "a",
      toItemId: "c",
      capability: { areaWidth: 0, areaHeight: Number.NaN, energyMultiplier: -1 },
    }];
    expect(resolveToolCapability(project, "c")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
  });
});
