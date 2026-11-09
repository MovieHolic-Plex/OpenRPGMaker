import { describe, expect, it } from "vitest";
import { enemyMeleeCells, telegraphAlpha } from "@/battle/action/areaPattern";
import { swingArcCellsFromBody } from "@/battle/action/hitbox";
import { normalizeEnemyActionAttack } from "@/project/actionCombat";
import { footprintBounds } from "@/project/footprint";
import type { CharacterFootprint } from "@/project/types";

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
