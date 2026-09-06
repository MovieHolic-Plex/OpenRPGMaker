import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { startSession } from "@/project/session";
import { createLegacyLifeProject } from "./fixtures/life-full/legacyProject";

function addItem(project: ReturnType<typeof createBlankProject>, id: string): void {
  const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
  const index = project.database.items.findIndex((item) => item.id === id);
  if (index >= 0) project.database.items[index] = record;
  else project.database.items.push(record);
}

describe("P0 authored system records", () => {
  it("round-trips optional energy, shipping, bundle/unlock, and maker definitions", () => {
    // Break caught: normalizeSystemRecords drops every newly-authored P0 package.
    const project = createBlankProject();
    for (const id of ["item_turnip", "item_milk", "item_mayo"]) addItem(project, id);
    project.switches.push({ id: "sw_bridge", name: "Bridge restored" });
    project.system.craftRecipes = [{
      id: "recipe_mayo",
      ingredients: [{ itemId: "item_milk", count: 1 }],
      outputItemId: "item_mayo",
    }];
    project.system.energy = { max: 100, initial: 65, restorePerDay: 25 };
    project.system.shipping = { enabled: true, historyLimit: 3, allowedItemIds: ["item_turnip"] };
    project.system.worldUnlocks = [{ id: "region_bridge", name: "Bridge", switchId: "sw_bridge" }];
    project.system.bundles = [{
      id: "bundle_spring",
      name: "Spring crops",
      requirements: [{ itemId: "item_turnip", count: 2 }],
      reward: {
        gold: 250,
        itemRewards: [{ itemId: "item_milk", count: 1 }],
        switchId: "sw_bridge",
        worldUnlockIds: ["region_bridge"],
        recipeIds: ["recipe_mayo"],
      },
    }];
    project.system.makers = [{
      id: "maker_mayo",
      name: "Mayonnaise machine",
      inputs: [{ itemId: "item_milk", count: 1 }],
      outputs: [{ itemId: "item_mayo", count: 1 }],
      durationMinutes: 1_440,
    }];

    const loaded = deserialize(serialize(project));
    expect(loaded.system.energy).toEqual({ max: 100, initial: 65, restorePerDay: 25 });
    expect(loaded.system.shipping).toEqual({ enabled: true, historyLimit: 3, allowedItemIds: ["item_turnip"] });
    expect(loaded.system.bundles?.[0]?.reward?.worldUnlockIds).toEqual(["region_bridge"]);
    expect(loaded.system.worldUnlocks?.[0]).toMatchObject({ id: "region_bridge", switchId: "sw_bridge" });
    expect(loaded.system.makers?.[0]).toMatchObject({ id: "maker_mayo", durationMinutes: 1_440 });

    const session = startSession(loaded, 1);
    expect(session.energy).toBe(65);
    expect(session.shippingQueue).toEqual({});
    expect(session.bundleContributions).toEqual({});
    expect(session.unlockedRecipeIds).toEqual([]);
    expect(session.makerInstances).toEqual({});
  });

  it("keeps old projects free of newly invented optional fields and byte-stable", () => {
    // Break caught: normalization injects empty P0 objects into projects that never authored them.
    const project = createLegacyLifeProject();
    const before = serialize(project);
    const loaded = deserialize(before);
    expect(loaded.system.energy).toBeUndefined();
    expect(loaded.system.shipping).toBeUndefined();
    expect(loaded.system.bundles).toBeUndefined();
    expect(loaded.system.worldUnlocks).toBeUndefined();
    expect(loaded.system.makers).toBeUndefined();
    expect(serialize(loaded)).toBe(before);
    expect(serialize(deserialize(serialize(loaded)))).toBe(before);
  });

  it("omits only the redundant text-only title seed on the first load", () => {
    const project = createBlankProject();
    const before = serialize(project);
    expect(project.system.titleScreen?.titleGraphic).toEqual({ mode: "text", x: 32, y: 62 });

    const loaded = deserialize(before);

    expect(loaded.system.titleScreen?.titleGraphic).toBeUndefined();
    expect(serialize(loaded)).toBe(serialize(createLegacyLifeProject()));
    expect(serialize(deserialize(serialize(loaded)))).toBe(serialize(loaded));
    expect(serialize(project)).toBe(before);
  });

  it.each(["text", "graphic", "both"] as const)("preserves authored %s title graphics across repeated loads", (mode) => {
    const project = createLegacyLifeProject();
    const title = project.system.titleScreen;
    if (!title) throw new Error("missing title fixture");
    title.titleGraphic = { mode, resourceId: "oprn-title-field", x: 19, y: 73 };

    const loaded = deserialize(serialize(project));

    expect(loaded.system.titleScreen?.titleGraphic).toEqual(title.titleGraphic);
    expect(serialize(deserialize(serialize(loaded)))).toBe(serialize(loaded));
  });

  it("rejects malformed P0 package shapes before normalization", () => {
    // Break caught: an object-shaped but invalid config reaches runtime with string numeric fields.
    const wire = JSON.parse(serialize(createBlankProject())) as Record<string, unknown>;
    const system = wire.system as Record<string, unknown>;
    system.energy = { max: "full" };
    expect(() => deserialize(JSON.stringify(wire))).toThrow(/system\.energy\.max/i);
  });

  it("reports every dangling P0 item, recipe, switch, and unlock reference", () => {
    // Break caught: deleting a referenced record leaves authored P0 definitions silently unusable.
    const project = createBlankProject();
    project.system.shipping = { enabled: true, allowedItemIds: ["item_missing_ship"] };
    project.system.worldUnlocks = [{ id: "region_bridge", switchId: "sw_missing_unlock" }];
    project.system.bundles = [{
      id: "bundle_bad",
      requirements: [{ itemId: "item_missing_requirement", count: 1 }],
      reward: {
        itemRewards: [{ itemId: "item_missing_reward", count: 1 }],
        switchId: "sw_missing_bundle",
        worldUnlockIds: ["region_missing"],
        recipeIds: ["recipe_missing"],
      },
    }];
    project.system.makers = [{
      id: "maker_bad",
      inputs: [{ itemId: "item_missing_input", count: 1 }],
      outputs: [{ itemId: "item_missing_output", count: 1 }],
      durationMinutes: 60,
    }];

    const issues = collectProjectReferenceIssues(project).join("\n");
    for (const id of [
      "item_missing_ship",
      "sw_missing_unlock",
      "item_missing_requirement",
      "item_missing_reward",
      "sw_missing_bundle",
      "region_missing",
      "recipe_missing",
      "item_missing_input",
      "item_missing_output",
    ]) expect(issues).toContain(id);
  });

  it("rejects duplicate P0 definition ids at the wire boundary and reference lint boundary", () => {
    // Break caught: duplicate ids make lookup/order decide which reward or timer is authoritative.
    for (const [field, rows] of [
      ["bundles", [
        { id: "duplicate", requirements: [{ itemId: "item_herb", count: 1 }] },
        { id: "duplicate", requirements: [{ itemId: "item_herb", count: 2 }] },
      ]],
      ["worldUnlocks", [{ id: "duplicate" }, { id: "duplicate" }]],
      ["makers", [
        { id: "duplicate", inputs: [], outputs: [{ itemId: "item_herb", count: 1 }], durationMinutes: 10 },
        { id: "duplicate", inputs: [], outputs: [{ itemId: "item_herb", count: 1 }], durationMinutes: 20 },
      ]],
    ] as const) {
      const wire = JSON.parse(serialize(createBlankProject())) as Record<string, unknown>;
      (wire.system as Record<string, unknown>)[field] = rows;
      expect(() => deserialize(JSON.stringify(wire)), field).toThrow(/duplicat/i);

      const direct = createBlankProject();
      (direct.system as unknown as Record<string, unknown>)[field] = rows;
      expect(collectProjectReferenceIssues(direct).join("\n"), field).toMatch(/duplicate/i);
    }
  });

  it("validates upgraded-tool capability shape", () => {
    // Break caught: malformed multipliers survive authoring validation.
    const wire = JSON.parse(serialize(createBlankProject())) as Record<string, unknown>;
    (wire.system as Record<string, unknown>).itemUpgrades = [{
      id: "upgrade_bad",
      fromItemId: "item_base",
      toItemId: "item_better",
      capability: { areaWidth: 0, areaHeight: 3, energyMultiplier: 0.75 },
    }];
    expect(() => deserialize(JSON.stringify(wire))).toThrow(/capability\.areaWidth/i);

    ((wire.system as Record<string, unknown>).itemUpgrades as Array<Record<string, unknown>>)[0]!.capability = {
      areaWidth: 10,
      areaHeight: 9,
      energyMultiplier: 0.75,
    };
    expect(() => deserialize(JSON.stringify(wire))).toThrow(/capability\.areaWidth/i);
  });

  it("rejects malformed sell-price rows used by shipping settlement", () => {
    const wire = JSON.parse(serialize(createBlankProject())) as Record<string, unknown>;
    (wire.system as Record<string, unknown>).sellPrices = [{ itemId: "item_herb", price: -1 }];
    expect(() => deserialize(JSON.stringify(wire))).toThrow(/sellPrices\[0\]\.price/i);
  });
});
