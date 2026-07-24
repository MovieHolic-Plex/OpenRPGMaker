import { describe, expect, it } from "vitest";
import { computeContactDamage, computeSwingDamage } from "@/action/combatMath";

describe("computeSwingDamage", () => {
  it("is attack plus bonus minus half defense, minimum 1", () => {
    const damage = computeSwingDamage({ attackerAttack: 20, defenderDefense: 10, bonus: 5, rand: () => 0.5 });
    expect(damage).toBe(20);
  });

  it("clamps to 1 when defense overwhelms attack", () => {
    const damage = computeSwingDamage({ attackerAttack: 4, defenderDefense: 99, bonus: 0, rand: () => 0.5 });
    expect(damage).toBe(1);
  });

  it("applies ±10% variance deterministically from rand", () => {
    const low = computeSwingDamage({ attackerAttack: 10, defenderDefense: 0, bonus: 0, rand: () => 0 });
    const high = computeSwingDamage({ attackerAttack: 10, defenderDefense: 0, bonus: 0, rand: () => 0.999 });
    expect(low).toBe(9);
    expect(high).toBe(11);
  });
});

describe("computeContactDamage", () => {
  it("prefers authored contactDamage reduced by quarter defense", () => {
    expect(computeContactDamage({ contactDamage: 8, enemyAttack: 99, defenderDefense: 8 })).toBe(6);
  });

  it("falls back to half attack when no profile", () => {
    expect(computeContactDamage({ contactDamage: undefined, enemyAttack: 12, defenderDefense: 0 })).toBe(6);
  });

  it("never drops below 1", () => {
    expect(computeContactDamage({ contactDamage: 1, enemyAttack: 1, defenderDefense: 99 })).toBe(1);
  });
});
