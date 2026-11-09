import { describe, expect, it } from "vitest";
import { attackIsEligible, pickEnemyAttack, MAX_ENEMY_KIT_EXTRA_ATTACKS } from "@/battle/action/enemyKit";
import { normalizeEnemyActionProfile } from "@/project/actionCombat";
import type { EnemyActionAttack } from "@/project/types";

const base = { windupMs: 500, recoverMs: 400, damage: 4 };
const melee: EnemyActionAttack = { ...base, kind: "melee", range: 1 };
const bolt: EnemyActionAttack = { ...base, kind: "projectile", range: 6 };
const lunge: EnemyActionAttack = { ...base, kind: "dash", range: 4 };
const rage: EnemyActionAttack = { ...base, kind: "melee", range: 2, hpBelowPercent: 50 };

const ctx = (distance: number, aligned = false, hpPercent = 100) => ({ distance, aligned, hpPercent });

describe("attackIsEligible", () => {
  it("applies the same range rules as a single attack", () => {
    expect(attackIsEligible(melee, ctx(1))).toBe(true);
    expect(attackIsEligible(melee, ctx(2))).toBe(false);
    expect(attackIsEligible(bolt, ctx(1))).toBe(false);
    expect(attackIsEligible(bolt, ctx(6))).toBe(true);
    expect(attackIsEligible(lunge, ctx(3, false))).toBe(false);
    expect(attackIsEligible(lunge, ctx(3, true))).toBe(true);
  });

  it("gates a health-conditioned attack on remaining hp", () => {
    expect(attackIsEligible(rage, ctx(1, false, 80))).toBe(false);
    expect(attackIsEligible(rage, ctx(1, false, 50))).toBe(true);
    expect(attackIsEligible(rage, ctx(1, false, 20))).toBe(true);
  });
});

describe("pickEnemyAttack", () => {
  const kit = [melee, bolt, lunge];

  it("starts at the attack after the last one and wraps around", () => {
    expect(pickEnemyAttack(kit, -1, ctx(1))).toBe(0);
    expect(pickEnemyAttack(kit, 0, ctx(3, true))).toBe(2);
    expect(pickEnemyAttack(kit, 2, ctx(1))).toBe(0);
  });

  it("alternates between attacks that are both usable instead of repeating one", () => {
    expect(pickEnemyAttack([melee, rage], 0, ctx(1, false, 30))).toBe(1);
    expect(pickEnemyAttack([melee, rage], 1, ctx(1, false, 30))).toBe(0);
  });

  it("falls back to the last attack only when it is the sole usable one", () => {
    expect(pickEnemyAttack(kit, 1, ctx(5))).toBe(1);
  });

  it("returns -1 when nothing is usable", () => {
    expect(pickEnemyAttack([melee, bolt], -1, ctx(20))).toBe(-1);
    expect(pickEnemyAttack([], -1, ctx(1))).toBe(-1);
  });
});

describe("normalizeEnemyActionProfile extraAttacks", () => {
  const attack = { kind: "melee" as const, windupMs: 500, recoverMs: 400, damage: 3, range: 1 };

  it("keeps up to the cap and normalizes each entry", () => {
    const out = normalizeEnemyActionProfile({
      attack,
      extraAttacks: [
        { ...attack, kind: "projectile", range: 99, hpBelowPercent: 200 },
        attack,
        attack,
        attack,
        attack,
      ],
    });
    expect(out?.extraAttacks).toHaveLength(MAX_ENEMY_KIT_EXTRA_ATTACKS);
    expect(out?.extraAttacks?.[0]).toMatchObject({ kind: "projectile", range: 20, hpBelowPercent: 99 });
  });

  it("never keeps a health condition on the base attack, which would stop a lone-attack enemy from ever attacking", () => {
    const out = normalizeEnemyActionProfile({ attack: { ...attack, hpBelowPercent: 40 }, extraAttacks: [{ ...attack, hpBelowPercent: 40 }] });
    expect(out?.attack).not.toHaveProperty("hpBelowPercent");
    expect(out?.extraAttacks?.[0]?.hpBelowPercent).toBe(40);
  });

  it("drops invalid extras and ignores extras when there is no base attack", () => {
    expect(normalizeEnemyActionProfile({ attack, extraAttacks: [{ kind: "spin" } as never] })).not.toHaveProperty("extraAttacks");
    expect(normalizeEnemyActionProfile({ extraAttacks: [attack] })).toBeUndefined();
  });
});
