import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";

type Mutable = Record<string, any>;

function configuredProject() {
  const project = createBlankProject() as unknown as Mutable;
  project.database.items.push(normalizeItemRecord({ id: "item_trout", name: "Trout", scope: "none", price: 80 }));
  project.database.items.push(normalizeItemRecord({ id: "item_berry", name: "Berry", scope: "none", price: 20 }));
  project.database.fishSpecies = [{ id: "fish_trout", name: "Trout", itemId: "item_trout", skillXp: 12 }];
  project.system.fishing = {
    enabled: true,
    energyCost: 3,
    spots: [{
      id: "spot_pond",
      name: "Pond",
      mapId: project.startMapId,
      area: { x: 0, y: 0, w: 4, h: 4 },
      catches: [{ fishId: "fish_trout", weight: 2, seasons: ["spring"], timePhases: ["morning"], weatherKinds: ["none"] }],
    }],
  };
  project.system.seasonalForage = {
    enabled: true,
    areas: [{
      id: "forage_farm",
      name: "Farm forage",
      mapId: project.startMapId,
      area: { x: 0, y: 0, w: 4, h: 4 },
      dailySpawnCount: 2,
      maxActive: 4,
      spawnEveryDays: 1,
      despawnAfterDays: 3,
      entries: [{ id: "berry", weight: 1, seasonalDrops: { spring: "item_berry" } }],
    }],
  };
  project.system.collections = { enabled: true, trackedItemIds: ["item_trout", "item_berry"] };
  project.system.museum = {
    enabled: true,
    eligibleItemIds: ["item_trout"],
    rewards: [{ id: "reward_first", minDonations: 1, reward: { gold: 50, itemRewards: [{ itemId: "item_berry", count: 1 }] } }],
  };
  return project;
}

describe("P2 authored foundation schema", () => {
  it("round-trips fishing, forage, collection, museum, and fish definitions", () => {
    // Break caught: the schema normalizer drops every P2 optional authoring package.
    const project = configuredProject();
    const loaded = deserialize(serialize(project as never)) as unknown as Mutable;

    expect(loaded.database.fishSpecies).toEqual(project.database.fishSpecies);
    expect(loaded.system.fishing).toEqual(project.system.fishing);
    expect(loaded.system.seasonalForage).toEqual(project.system.seasonalForage);
    expect(loaded.system.collections).toEqual(project.system.collections);
    expect(loaded.system.museum).toEqual(project.system.museum);
  });

  it("keeps legacy projects byte-stable without P2 fields", () => {
    // Break caught: P2 normalization invents empty packages in an old project.
    const before = serialize(createBlankProject());
    const loaded = deserialize(before) as unknown as Mutable;
    expect(loaded.database.fishSpecies).toBeUndefined();
    expect(loaded.system.fishing).toBeUndefined();
    expect(loaded.system.seasonalForage).toBeUndefined();
    expect(loaded.system.collections).toBeUndefined();
    expect(loaded.system.museum).toBeUndefined();
    expect(serialize(loaded as never)).toBe(before);
  });

  it("rejects duplicate ids and unsafe authored geometry at the wire boundary", () => {
    // Break caught: ambiguous catch/forage authority and unsafe rectangles reach runtime.
    const duplicate = JSON.parse(serialize(configuredProject() as never)) as Mutable;
    duplicate.database.fishSpecies.push({ ...duplicate.database.fishSpecies[0] });
    expect(() => deserialize(JSON.stringify(duplicate))).toThrow(/fishSpecies.*duplicat/i);

    const unsafe = JSON.parse(serialize(configuredProject() as never)) as Mutable;
    unsafe.system.seasonalForage.areas[0].area.w = 0;
    expect(() => deserialize(JSON.stringify(unsafe))).toThrow(/seasonalForage.*area\.w/i);
  });

  it("reports dangling fish, map, item, and museum reward references", () => {
    // Break caught: deleting referenced P2 records leaves silent runtime dead paths.
    const project = configuredProject();
    project.database.fishSpecies[0].itemId = "item_missing_fish";
    project.system.fishing.spots[0].mapId = "map_missing";
    project.system.fishing.spots[0].catches[0].fishId = "fish_missing";
    project.system.seasonalForage.areas[0].entries[0].seasonalDrops.spring = "item_missing_forage";
    project.system.collections.trackedItemIds = ["item_missing_collection"];
    project.system.museum.eligibleItemIds = ["item_missing_museum"];
    project.system.museum.rewards[0].reward.recipeIds = ["recipe_missing"];

    const issues = collectProjectReferenceIssues(project as never).join("\n");
    for (const id of [
      "item_missing_fish",
      "map_missing",
      "fish_missing",
      "item_missing_forage",
      "item_missing_collection",
      "item_missing_museum",
      "recipe_missing",
    ]) expect(issues).toContain(id);
  });
});
