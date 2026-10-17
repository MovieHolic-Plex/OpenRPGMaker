// poke-depth PR4: 지닌 도구. 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import {
  heldBoostPercent,
  heldCuresStatus,
  heldEndureDamage,
  heldHealAmount,
  heldRegenAmount,
  normalizeHeldItemEffect,
} from "@/battle/heldItems";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { giveHeldItem, takeHeldItem } from "@/project/monsterHeldItems";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";

describe("normalizeHeldItemEffect", () => {
  it("drops unknown kinds and boostType without a type", () => {
    expect(normalizeHeldItemEffect(undefined)).toBeUndefined();
    expect(normalizeHeldItemEffect({ kind: "bogus" })).toBeUndefined();
    expect(normalizeHeldItemEffect({ kind: "boostType" })).toBeUndefined();
  });
  it("clamps and fills defaults", () => {
    expect(normalizeHeldItemEffect({ kind: "healBelow" })).toMatchObject({ thresholdPercent: 50, healPercent: 30 });
    expect(normalizeHeldItemEffect({ kind: "healBelow", thresholdPercent: 500, healPercent: 900 })).toMatchObject({ thresholdPercent: 100, healPercent: 100 });
    expect(normalizeHeldItemEffect({ kind: "boostType", type: "fire", percent: 5 })).toMatchObject({ percent: 101 });
    expect(normalizeHeldItemEffect({ kind: "regen", percent: 99 })).toMatchObject({ percent: 25 });
    expect(normalizeHeldItemEffect({ kind: "cureStatus", status: "nonsense" })).toMatchObject({ status: "any" });
    expect(normalizeHeldItemEffect({ kind: "endureOnce" })).toEqual({ kind: "endureOnce" });
  });
  it("is omitted from item records that do not set it (unchanged bytes)", () => {
    expect("heldEffect" in normalizeItemRecord({ id: "i", name: "i" })).toBe(false);
    expect(normalizeItemRecord({ id: "i", name: "i", heldEffect: { kind: "endureOnce" } }).heldEffect).toEqual({ kind: "endureOnce" });
  });
});

describe("held item effects", () => {
  it("healBelow heals only at or below the threshold and never overheals", () => {
    const berry = normalizeHeldItemEffect({ kind: "healBelow", thresholdPercent: 50, healPercent: 50 });
    expect(heldHealAmount(berry, 60, 100)).toBe(0);
    expect(heldHealAmount(berry, 50, 100)).toBe(50);
    expect(heldHealAmount(berry, 40, 100)).toBe(50);
    expect(heldHealAmount(berry, 10, 20)).toBe(10);
    expect(heldHealAmount(berry, 0, 100)).toBe(0);
  });
  it("boostType scales only the declared type", () => {
    const charm = normalizeHeldItemEffect({ kind: "boostType", type: "fire", percent: 150 });
    expect(heldBoostPercent(charm, "fire")).toBe(150);
    expect(heldBoostPercent(charm, "water")).toBe(100);
    expect(heldBoostPercent(undefined, "fire")).toBe(100);
  });
  it("endureOnce only saves a full-HP holder from a lethal hit", () => {
    const sash = normalizeHeldItemEffect({ kind: "endureOnce" });
    expect(heldEndureDamage(sash, 30, 30, 99)).toEqual({ damage: 29, endured: true });
    expect(heldEndureDamage(sash, 29, 30, 99)).toEqual({ damage: 99, endured: false });
    expect(heldEndureDamage(sash, 30, 30, 10)).toEqual({ damage: 10, endured: false });
  });
  it("regen heals at least 1 and stops at full HP; cureStatus matches the status or any", () => {
    const left = normalizeHeldItemEffect({ kind: "regen", percent: 10 });
    expect(heldRegenAmount(left, 10, 100)).toBe(10);
    expect(heldRegenAmount(left, 5, 6)).toBe(1);
    expect(heldRegenAmount(left, 100, 100)).toBe(0);
    expect(heldCuresStatus(normalizeHeldItemEffect({ kind: "cureStatus", status: "poison" }), "poison")).toBe(true);
    expect(heldCuresStatus(normalizeHeldItemEffect({ kind: "cureStatus", status: "poison" }), "burn")).toBe(false);
    expect(heldCuresStatus(normalizeHeldItemEffect({ kind: "cureStatus" }), "burn")).toBe(true);
  });
});

describe("give / take held item", () => {
  function setup() {
    const project: any = createScarloxyPokemonDemoProject();
    for (const id of ["h_a", "h_b"]) project.database.items.push(normalizeItemRecord({ id, name: id === "h_a" ? "열매" : "띠", heldEffect: { kind: "endureOnce" } }));
    const session: any = structuredClone(project.session);
    session.inventory = { h_a: 1, h_b: 1 };
    session.monsterInstances = { m1: { instanceId: "m1", speciesId: project.database.monsterSpecies[0].id, level: 5, exp: 0, skillIds: [], friendship: 70 } };
    session.monsterParty = ["m1"];
    return { project, session };
  }
  it("moves the item from the bag to the monster and swaps an old one back", () => {
    const { project, session } = setup();
    expect(giveHeldItem(project, session, "h_a", "m1").kind).toBe("done");
    expect(session.monsterInstances.m1.heldItemId).toBe("h_a");
    expect(session.inventory.h_a ?? 0).toBe(0);
    expect(giveHeldItem(project, session, "h_b", "m1").kind).toBe("done");
    expect(session.monsterInstances.m1.heldItemId).toBe("h_b");
    expect(session.inventory.h_a).toBe(1);
    expect(session.inventory.h_b ?? 0).toBe(0);
  });
  it("refuses non-holdable items, missing targets and an already held item", () => {
    const { project, session } = setup();
    project.database.items.push(normalizeItemRecord({ id: "plain", name: "돌" }));
    session.inventory.plain = 1;
    expect(giveHeldItem(project, session, "plain", "m1").kind).toBe("unusable");
    expect(giveHeldItem(project, session, "h_a", undefined).kind).toBe("unusable");
    giveHeldItem(project, session, "h_a", "m1");
    session.inventory.h_a = 1;
    expect(giveHeldItem(project, session, "h_a", "m1").kind).toBe("unusable");
  });
  it("takes the item back to the bag and clears the field", () => {
    const { project, session } = setup();
    giveHeldItem(project, session, "h_a", "m1");
    expect(takeHeldItem(project, session, "m1").kind).toBe("done");
    expect("heldItemId" in session.monsterInstances.m1).toBe(false);
    expect(session.inventory.h_a).toBe(1);
    expect(takeHeldItem(project, session, "m1").kind).toBe("unusable");
  });
});
