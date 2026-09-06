import { describe, expect, it } from "vitest";
import { interactWithFarmPlot } from "@/player/farming";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { attemptFishingCatch, resolveFishingAvailability } from "@/project/fishing";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { awardLifeSkillXp, changeLifeSkillXp } from "@/project/lifeSkillProgress";
import { placeableKey } from "@/project/placeables";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { startSession } from "@/project/session";
import { p2LifeProject } from "./fixtures/p2LifeSystems";

const harvests = ["crop", "rock", "tree", "fish", "forage"] as const;
type Harvest = typeof harvests[number];
type Mode = "enabled" | "disabled" | "omitted";

function harvestFixture(kind: Harvest, mode: Mode) {
  const project = p2LifeProject();
  project.database.items.push(
    normalizeItemRecord({ id: "pick", name: "Pick", farmTool: "pickaxe", scope: "none" }),
    normalizeItemRecord({ id: "axe", name: "Axe", farmTool: "axe", scope: "none" }),
    normalizeItemRecord({ id: "seed", name: "Seed", type: "seed", scope: "none" }),
  );
  const skillType = { crop: "farming", rock: "mining", tree: "foraging", fish: "fishing", forage: "foraging" } as const;
  const skill = { id: "harvest-skill", name: "Harvest", skillType: skillType[kind], maxLevel: 10, levelUpRewards: [] };
  project.database.lifeSkills = [skill];
  project.database.crops = [{ id: "crop", name: "Crop", seedItemId: "seed", harvestItemId: "item_berry", harvestCount: 1, stages: [{ days: 1 }], seasons: ["spring"] }];
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing fixture map");
  map.farmableArea = [{ x: 0, y: 0, w: 4, h: 4 }];
  if (mode === "omitted") delete project.system.skillSystem;
  else project.system.skillSystem = { enabled: mode === "enabled" };
  const session = startSession(project, 606);
  // Retained progress must not be erased or advanced by disabled automatic XP.
  session.lifeSkills = { [skill.id]: { xp: 99, level: 1 } };
  session.inventory.pick = 1;
  session.inventory.axe = 1;
  let x = 1;
  let y = 1;
  if (kind === "crop") {
    session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false, cropId: "crop", growthDays: 1, stage: 1 } } };
  } else if (kind === "rock" || kind === "tree") {
    session.equippedToolItemId = kind === "rock" ? "pick" : "axe";
    session.placeables = { [placeableKey(map.id, x, y)]: { id: kind, kind, mapId: map.id, x, y, itemId: "item_berry" } };
  } else if (kind === "forage") {
    const date = session.gameTime;
    if (!date) throw new Error("Missing fixture date");
    expect(advanceSeasonalForage(project, session, date)).toMatchObject({ ok: true, spawned: 2 });
    const target = Object.values(session.placeables ?? {}).find((entry) => entry.forageSpawn);
    if (!target) throw new Error("Missing generated forage owner");
    x = target.x;
    y = target.y;
  }
  const itemId = kind === "fish" ? "item_trout" : "item_berry";
  const xp = kind === "fish" ? 12 : kind === "forage" ? 1 : 10;
  const energy = kind === "fish" ? 3 : kind === "forage" ? 0 : 1;
  const key = placeableKey(map.id, x, y);
  const owner = kind === "crop" ? session.farmPlots?.[map.id]?.["1,1"]
    : kind === "fish" ? project.system.fishing?.spots[0] : session.placeables?.[key];
  expect(owner).toBeDefined();
  const perform = () => {
    if (kind === "fish") return attemptFishingCatch(project, session, { mapId: map.id, x, y });
    if (kind === "forage") return collectForageAt(project, session, map.id, x, y);
    return interactWithFarmPlot(project, session, map, x, y);
  };
  const success = kind === "fish" || kind === "forage" ? { ok: true, itemId } : { kind: "harvested", source: kind, itemId, count: 1 };
  const failure = (reason: "xp" | "energy" | "inventory") => kind === "fish" || kind === "forage"
    ? { ok: false, reason }
    : { kind: "ignored", reason: { xp: "invalid-life-skill", energy: "insufficient-energy", inventory: "inventory-full" }[reason] };
  return { project, session, skill, itemId, xp, energy, key, map, perform, success, failure };
}

describe.each(harvests)("%s automatic harvest XP", (kind) => {
  it.each(["disabled", "omitted", "enabled"] as const)("keeps the real reward when skillSystem is %s", (mode) => {
    const f = harvestFixture(kind, mode);
    const before = structuredClone(f.session);
    const result = f.perform();
    expect(result).toMatchObject(f.success);
    expect(f.session.inventory[f.itemId]).toBe((before.inventory[f.itemId] ?? 0) + 1);
    expect(f.session.energy).toBe(Number(before.energy) - f.energy);
    expect(f.session.collections?.[f.itemId]?.discovered).toBe(true);
    expect(f.session.switches).toEqual(before.switches);
    expect(f.session.unlockedRecipeIds).toEqual(before.unlockedRecipeIds);
    if (mode === "enabled") expect(f.session.lifeSkills?.[f.skill.id]).toEqual({ xp: 99 + f.xp, level: 2 });
    else expect(f.session.lifeSkills).toEqual(before.lifeSkills);
    if (kind === "fish") {
      expect(f.session.collections?.[f.itemId]?.caughtCount).toBe(1);
      expect(f.session.rng).not.toEqual(before.rng);
    } else {
      expect(f.session.rng).toEqual(before.rng);
      if (kind === "crop") expect(f.session.farmPlots?.[f.map.id]?.["1,1"]?.cropId).toBeUndefined();
      else expect(f.session.placeables?.[f.key]).toBeUndefined();
      if (kind !== "forage") expect(result).toMatchObject({ xpAwarded: mode === "enabled" ? { [f.skill.skillType]: 10 } : {} });
    }
  });

  it.each(["switch", "recipe"] as const)("rolls back the entire active transaction for an invalid %s reward", (reward) => {
    const f = harvestFixture(kind, "enabled");
    f.project.database.lifeSkills = [{ ...f.skill, levelUpRewards: [reward === "switch"
      ? { level: 2, switchId: "missing-switch" } : { level: 2, recipeId: "missing-recipe" }] }];
    const before = structuredClone(f.session);
    expect(f.perform()).toMatchObject(f.failure("xp"));
    expect(f.session).toEqual(before);
    expect(f.session.rng).toEqual(before.rng);
  });

  it.each(["enabled", "disabled"] as const)("preserves complete state at inventory capacity with XP %s", (mode) => {
    const f = harvestFixture(kind, mode);
    f.session.inventory[f.itemId] = ITEM_QUANTITY_MAX;
    const before = structuredClone(f.session);
    expect(f.perform()).toMatchObject(f.failure("inventory"));
    expect(f.session).toEqual(before);
    expect(f.session.rng).toEqual(before.rng);
  });
});

describe.each(["crop", "rock", "tree", "fish"] as const)("%s energy refusal", (kind) => {
  it.each(["enabled", "disabled"] as const)("preserves all state with XP %s", (mode) => {
    const f = harvestFixture(kind, mode);
    f.session.energy = 0;
    const before = structuredClone(f.session);
    expect(f.perform()).toMatchObject(f.failure("energy"));
    expect(f.session).toEqual(before);
    expect(f.session.rng).toEqual(before.rng);
  });
});

describe("explicit XP and fishing qualification stay independent", () => {
  it.each(["disabled", "omitted"] as const)("keeps explicit APIs disabled when skillSystem is %s", (mode) => {
    const f = harvestFixture("fish", mode);
    const before = structuredClone(f.session);
    expect(awardLifeSkillXp(f.project, f.session, f.skill.id, 12)).toEqual({ ok: false, reason: "disabled", skillId: f.skill.id });
    for (const op of ["=", "+=", "-="] as const) {
      expect(changeLifeSkillXp(f.project, f.session, f.skill.id, op, 12)).toEqual({ ok: false, reason: "disabled", skillId: f.skill.id });
    }
    expect(awardLifeSkillXp(f.project, f.session, f.skill.id, 0)).toEqual({ ok: false, reason: "invalid-amount", skillId: f.skill.id });
    expect(f.session).toEqual(before);
  });

  it.each(["disabled", "omitted"] as const)("still rejects insufficient fishing skill with XP %s", (mode) => {
    const f = harvestFixture("fish", mode);
    const fishing = f.project.system.fishing;
    if (!fishing) throw new Error("Missing fishing configuration owner");
    f.project.system.fishing = { ...fishing, spots: fishing.spots.map(spot => ({
      ...spot, catches: spot.catches.map(rule => ({ ...rule, minSkillLevel: 2 })),
    })) };
    const before = structuredClone(f.session);
    expect(resolveFishingAvailability(f.project, f.session, { mapId: f.map.id, x: 1, y: 1 })).toEqual({ ok: false, reason: "unavailable" });
    expect(f.perform()).toEqual({ ok: false, reason: "unavailable" });
    expect(f.session).toEqual(before);
  });

  it.each(["disabled", "omitted"] as const)("allows earned fishing qualification without adding XP when %s", (mode) => {
    const f = harvestFixture("fish", mode);
    const fishing = f.project.system.fishing;
    if (!fishing) throw new Error("Missing fishing configuration owner");
    f.project.system.fishing = { ...fishing, spots: fishing.spots.map(spot => ({
      ...spot, catches: spot.catches.map(rule => ({ ...rule, minSkillLevel: 2 })),
    })) };
    f.session.lifeSkills = { [f.skill.id]: { xp: 100, level: 2 } };
    const before = structuredClone(f.session.lifeSkills);
    expect(f.perform()).toMatchObject(f.success);
    expect(f.session.lifeSkills).toEqual(before);
    expect(f.session.inventory.item_trout).toBe(1);
  });
});
