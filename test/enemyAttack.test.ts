import { describe, expect, it } from "vitest";
import { attackIsEligible, pickEnemyAttack, MAX_ENEMY_KIT_EXTRA_ATTACKS } from "@/battle/action/enemyKit";
import { normalizeEnemyActionProfile, normalizeEnemyActionAttack } from "@/project/actionCombat";
import type { EnemyActionAttack, CharacterFootprint } from "@/project/types";
import { enemyMeleeCells, telegraphAlpha } from "@/battle/action/areaPattern";
import { swingArcCellsFromBody } from "@/battle/action/hitbox";
import { footprintBounds } from "@/project/footprint";
import { isolateTimers } from "./mergedTeardown";

describe("enemyAttackKit", () => {
  isolateTimers();
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
      expect(pickEnemyAttack(kit, 0, ctx(3, true))).toBe(1);
      expect(pickEnemyAttack(kit, 1, ctx(3, true))).toBe(2);
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
});

describe("enemyAttackShape", () => {
  isolateTimers();
  const UNIT: CharacterFootprint = { width: 1, height: 1 };
  const GOLEM: CharacterFootprint = { width: 3, height: 3 };
  const keys = (cells: readonly { x: number; y: number }[]): string[] => cells.map((c) => `${c.x},${c.y}`).sort();
  describe("enemyMeleeCells", () => {
    it("keeps the old forward arc when no shape is given or arc is named", () => {
      const old = swingArcCellsFromBody("right", 10, 10, 2, UNIT);
      expect(keys(enemyMeleeCells(undefined, "right", 10, 10, 2, UNIT))).toEqual(keys(old));
      expect(keys(enemyMeleeCells("arc", "right", 10, 10, 2, UNIT))).toEqual(keys(old));
    });

    it("circle covers every cell within range of a 1x1 body, diagonals included, except the body", () => {
      const cells = enemyMeleeCells("circle", "down", 10, 10, 2, UNIT);
      expect(cells).toHaveLength(24);
      expect(keys(cells)).toContain("8,10");
      expect(keys(cells)).toContain("12,12");
      expect(keys(cells)).not.toContain("10,10");
      expect(keys(cells)).not.toContain("13,10");
    });

    it("circle of range 1 reaches the diagonal neighbour the attack start gate accepts", () => {
      const cells = enemyMeleeCells("circle", "down", 10, 10, 1, UNIT);
      expect(cells).toHaveLength(8);
      expect(keys(cells)).toContain("11,11");
    });

    it("ring leaves the inner layer safe", () => {
      const cells = enemyMeleeCells("ring", "down", 10, 10, 2, UNIT);
      expect(cells).toHaveLength(16);
      expect(keys(cells)).not.toContain("11,10");
      expect(keys(cells)).not.toContain("11,11");
      expect(keys(cells)).toContain("12,10");
      expect(keys(cells)).toContain("12,12");
    });

    it("cross runs straight out of the four sides", () => {
      const cells = enemyMeleeCells("cross", "left", 10, 10, 2, UNIT);
      expect(keys(cells)).toEqual(keys([
        { x: 10, y: 8 }, { x: 10, y: 9 }, { x: 10, y: 11 }, { x: 10, y: 12 },
        { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 },
      ]));
    });

    it("measures from the whole body of a 3x3 and never covers the body itself", () => {
      const body = footprintBounds(10, 10, GOLEM);
      for (const shape of ["circle", "ring", "cross"] as const) {
        const cells = enemyMeleeCells(shape, "down", 10, 10, 1, GOLEM);
        expect(cells.length).toBeGreaterThan(0);
        for (const cell of cells) {
          const inside = cell.x >= body.left && cell.x <= body.right && cell.y >= body.top && cell.y <= body.bottom;
          expect(inside).toBe(false);
        }
      }
      expect(enemyMeleeCells("cross", "down", 10, 10, 1, GOLEM)).toHaveLength(12);
    });
  });
  describe("telegraphAlpha", () => {
    it("rises from the start alpha to the end alpha over the windup", () => {
      expect(telegraphAlpha(0, 800)).toBeCloseTo(0.28, 5);
      expect(telegraphAlpha(400, 800)).toBeCloseTo(0.415, 5);
      expect(telegraphAlpha(800, 800)).toBeCloseTo(0.55, 5);
    });

    it("clamps out-of-range elapsed time and a zero windup to the end alpha", () => {
      expect(telegraphAlpha(-50, 800)).toBeCloseTo(0.28, 5);
      expect(telegraphAlpha(5000, 800)).toBeCloseTo(0.55, 5);
      expect(telegraphAlpha(0, 0)).toBeCloseTo(0.55, 5);
    });
  });
  describe("normalizeEnemyActionAttack shape", () => {
    const base = { windupMs: 600, recoverMs: 400, damage: 5, range: 2 };

    it("keeps a non-default shape on a melee attack", () => {
      expect(normalizeEnemyActionAttack({ ...base, kind: "melee", shape: "ring" })?.shape).toBe("ring");
    });

    it("drops arc, unknown shapes and shapes on non-melee attacks", () => {
      expect(normalizeEnemyActionAttack({ ...base, kind: "melee", shape: "arc" })).not.toHaveProperty("shape");
      expect(normalizeEnemyActionAttack({ ...base, kind: "melee", shape: "spiral" as never })).not.toHaveProperty("shape");
      expect(normalizeEnemyActionAttack({ ...base, kind: "projectile", shape: "circle" })).not.toHaveProperty("shape");
    });
  });
});
