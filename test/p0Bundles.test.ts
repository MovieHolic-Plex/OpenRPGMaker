import { describe, expect, it } from "vitest";
import { contributeBundle } from "@/project/bundles";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { GOLD_MAX, startSession } from "@/project/session";

function bundleProject() {
  const project = createBlankProject();
  for (const id of ["item_turnip", "item_reward"]) {
    const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
    const index = project.database.items.findIndex((item) => item.id === id);
    if (index >= 0) project.database.items[index] = record;
    else project.database.items.push(record);
  }
  project.switches.push(
    { id: "sw_bundle", name: "Bundle" },
    { id: "sw_bridge", name: "Bridge" },
  );
  project.system.craftRecipes = [{ id: "recipe_preserves", ingredients: [], outputItemId: "item_reward" }];
  project.system.worldUnlocks = [{ id: "region_bridge", switchId: "sw_bridge" }];
  project.system.bundles = [{
    id: "bundle_spring",
    requirements: [{ itemId: "item_turnip", count: 3 }],
    reward: {
      gold: 50,
      itemRewards: [{ itemId: "item_reward", count: 2 }],
      switchId: "sw_bundle",
      worldUnlockIds: ["region_bridge"],
      recipeIds: ["recipe_preserves"],
    },
  }];
  return project;
}

describe("P0 bundle contribution rules", () => {
  it("tracks partial progress, then applies completion rewards exactly once", () => {
    // Break caught: partial donation completes early or a repeated completion re-grants rewards.
    const project = bundleProject();
    const session = startSession(project, 1);
    session.inventory = { item_turnip: 3 };
    session.gold = GOLD_MAX - 25;

    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 2)).toMatchObject({
      ok: true,
      contributed: 2,
      required: 3,
      completed: false,
      rewardApplied: false,
    });
    expect(session.inventory.item_turnip).toBe(1);
    expect(session.bundleContributions?.bundle_spring?.item_turnip).toBe(2);

    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 1)).toMatchObject({
      ok: true,
      contributed: 3,
      completed: true,
      rewardApplied: true,
    });
    expect(session.inventory.item_turnip).toBeUndefined();
    expect(session.inventory.item_reward).toBe(2);
    expect(session.gold).toBe(GOLD_MAX);
    expect(session.switches.sw_bundle).toBe(true);
    expect(session.switches.sw_bridge).toBe(true);
    expect(session.completedBundleIds).toEqual(["bundle_spring"]);
    expect(session.bundleRewardAppliedIds).toEqual(["bundle_spring"]);
    expect(session.unlockedRegionIds).toEqual(["region_bridge"]);
    expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);

    const frozen = structuredClone(session);
    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 1)).toMatchObject({
      ok: false,
      reason: "already-complete",
    });
    expect(session).toEqual(frozen);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects malformed contribution count %s without mutation",
    (count) => {
      // Break caught: malformed contributions mutate inventory or progress.
      const project = bundleProject();
      const session = startSession(project, 2);
      session.inventory = { item_turnip: 3 };
      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", count)).toMatchObject({
        ok: false,
        reason: "invalid-count",
      });
      expect(session.inventory).toEqual({ item_turnip: 3 });
      expect(session.bundleContributions).toEqual({});
    },
  );

  it("rejects over-donation, insufficient inventory, and unknown targets without item loss", () => {
    // Break caught: an invalid contribution consumes the offered stack before checking the requirement.
    const project = bundleProject();
    const session = startSession(project, 3);
    session.inventory = { item_turnip: 2 };
    const before = structuredClone(session);

    expect(contributeBundle(project, session, "bundle_missing", "item_turnip", 1)).toMatchObject({ ok: false, reason: "missing-bundle" });
    expect(contributeBundle(project, session, "bundle_spring", "item_missing", 1)).toMatchObject({ ok: false, reason: "item-not-required" });
    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 4)).toMatchObject({ ok: false, reason: "exceeds-requirement" });
    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({ ok: false, reason: "insufficient-inventory" });
    expect(session).toEqual(before);
  });

  it("validates every completion reward before consuming the final contribution", () => {
    // Break caught: a missing reward reference is discovered after the donated item is gone.
    const project = bundleProject();
    project.system.bundles![0] = {
      ...project.system.bundles![0]!,
      reward: {
        itemRewards: [{ itemId: "item_missing_reward", count: 1 }],
        switchId: "sw_missing",
        worldUnlockIds: ["region_missing"],
        recipeIds: ["recipe_missing"],
      },
    };
    const session = startSession(project, 4);
    session.inventory = { item_turnip: 3 };
    const before = structuredClone(session);

    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({
      ok: false,
      reason: "invalid-reward",
    });
    expect(session).toEqual(before);
  });

  it("rejects duplicate reward item rows before their combined count can overflow", () => {
    // Break caught: duplicate rows each pass an isolated overflow check, then both mutate inventory.
    const project = bundleProject();
    project.system.bundles![0] = {
      ...project.system.bundles![0]!,
      reward: {
        itemRewards: [
          { itemId: "item_reward", count: 1 },
          { itemId: "item_reward", count: 1 },
        ],
      },
    };
    const session = startSession(project, 6);
    session.inventory = { item_turnip: 3, item_reward: 9_999_998 };
    const before = structuredClone(session);
    expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({
      ok: false,
      reason: "invalid-reward",
    });
    expect(session).toEqual(before);
  });
});
