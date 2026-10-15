// poke-depth PR3: 특성(선언형 일곱 종류). 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import {
  abilityBlocksStatus,
  abilityContactStatus,
  abilityDamagePercent,
  abilityDefensePercent,
  abilityEndureDamage,
  abilityOffensePercent,
  abilityTypeImmunity,
  normalizeMonsterAbility,
  scaleDamageByPercent,
} from "@/battle/abilities";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";

describe("normalizeMonsterAbility", () => {
  it("drops abilities missing their required parameter or kind", () => {
    expect(normalizeMonsterAbility(undefined)).toBeUndefined();
    expect(normalizeMonsterAbility({ name: "x", kind: "bogus" })).toBeUndefined();
    expect(normalizeMonsterAbility({ name: "x", kind: "immuneType" })).toBeUndefined();
    expect(normalizeMonsterAbility({ name: "x", kind: "immuneStatus", status: "confusion" })).toBeUndefined();
    expect(normalizeMonsterAbility({ kind: "endure" })).toBeUndefined();
  });
  it("clamps percentages per kind and fills defaults", () => {
    expect(normalizeMonsterAbility({ name: "a", kind: "resistType", type: "fire" })).toMatchObject({ percent: 50 });
    expect(normalizeMonsterAbility({ name: "a", kind: "resistType", type: "fire", percent: 500 })).toMatchObject({ percent: 99 });
    expect(normalizeMonsterAbility({ name: "a", kind: "boostLowHp", type: "fire", percent: 50 })).toMatchObject({ percent: 101 });
    expect(normalizeMonsterAbility({ name: "a", kind: "contactStatus", status: "burn", percent: 0 })).toMatchObject({ percent: 1 });
    expect(normalizeMonsterAbility({ name: "a", kind: "statMultiplier", stat: "mind", percent: 9999 })).toMatchObject({ percent: 400 });
    expect(normalizeMonsterAbility({ name: "a", kind: "immuneType", type: "water", healPercent: 25 })).toMatchObject({ healPercent: 25 });
    expect(normalizeMonsterAbility({ name: "a", kind: "endure" })).toEqual({ name: "a", kind: "endure" });
  });
  it("is omitted from species records that do not set it (unchanged bytes)", () => {
    expect("ability" in normalizeMonsterSpeciesRecord({ id: "s", name: "s" })).toBe(false);
    expect(normalizeMonsterSpeciesRecord({ id: "s", name: "s", ability: { name: "a", kind: "endure" } }).ability).toEqual({ name: "a", kind: "endure" });
  });
});

describe("ability effects", () => {
  it("type immunity matches only the declared type and reports the heal percent", () => {
    const ability = normalizeMonsterAbility({ name: "a", kind: "immuneType", type: "water", healPercent: 25 });
    expect(abilityTypeImmunity(ability, "water")).toEqual({ healPercent: 25 });
    expect(abilityTypeImmunity(ability, "fire")).toBeUndefined();
    expect(abilityTypeImmunity(undefined, "water")).toBeUndefined();
  });
  it("stat multiplier hits only its own side of the formula", () => {
    const atk = normalizeMonsterAbility({ name: "a", kind: "statMultiplier", stat: "attack", percent: 150 });
    expect(abilityOffensePercent(atk, false)).toBe(150);
    expect(abilityOffensePercent(atk, true)).toBe(100);
    expect(abilityDefensePercent(atk, false)).toBe(100);
    const mind = normalizeMonsterAbility({ name: "a", kind: "statMultiplier", stat: "mind", percent: 200 });
    expect(abilityOffensePercent(mind, true)).toBe(200);
    expect(abilityDefensePercent(mind, true)).toBe(200);
  });
  it("low-HP boost needs HP <= 1/3 and the same type; resist stacks multiplicatively", () => {
    const boost = normalizeMonsterAbility({ name: "a", kind: "boostLowHp", type: "fire", percent: 150 });
    const resist = normalizeMonsterAbility({ name: "b", kind: "resistType", type: "fire", percent: 50 });
    expect(abilityDamagePercent({ ability: boost, hp: 30, maxHp: 100 }, {}, "fire")).toBe(150);
    expect(abilityDamagePercent({ ability: boost, hp: 40, maxHp: 100 }, {}, "fire")).toBe(100);
    expect(abilityDamagePercent({ ability: boost, hp: 30, maxHp: 100 }, {}, "water")).toBe(100);
    expect(abilityDamagePercent({ ability: boost, hp: 30, maxHp: 100 }, { ability: resist }, "fire")).toBe(75);
    expect(scaleDamageByPercent(1, 50)).toBe(1);
    expect(scaleDamageByPercent(0, 150)).toBe(0);
  });
  it("status immunity and contact status", () => {
    expect(abilityBlocksStatus(normalizeMonsterAbility({ name: "a", kind: "immuneStatus", status: "sleep" }), "sleep")).toBe(true);
    expect(abilityBlocksStatus(normalizeMonsterAbility({ name: "a", kind: "immuneStatus", status: "sleep" }), "burn")).toBe(false);
    expect(abilityContactStatus(normalizeMonsterAbility({ name: "a", kind: "contactStatus", status: "paralysis", percent: 30 }))).toEqual({ status: "paralysis", percent: 30 });
  });
  it("endure only saves a full-HP holder from a lethal hit", () => {
    const endure = normalizeMonsterAbility({ name: "a", kind: "endure" });
    expect(abilityEndureDamage(endure, 50, 50, 80)).toEqual({ damage: 49, endured: true });
    expect(abilityEndureDamage(endure, 40, 50, 80)).toEqual({ damage: 80, endured: false });
    expect(abilityEndureDamage(endure, 50, 50, 10)).toEqual({ damage: 10, endured: false });
  });
});
