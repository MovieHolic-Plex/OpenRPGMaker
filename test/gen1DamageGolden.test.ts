import { describe, expect, it } from "vitest";
import {
  accuracyByteFromPercent,
  applyGen1StabAndType,
  computeGen1BaseDamageResult,
  gen1CriticalThreshold,
  resolveGen1DamagingMove,
  scaleGen1DamageStats,
  scaledGen1Accuracy,
} from "@/battle/gen1/damage";
import { createGen1ByteRng } from "@/battle/gen1/rng";
import { computeGen1BaseDamage } from "@/battle/battleDamage";

function bytes(values: readonly number[]): { readonly next: () => number; readonly consumed: () => number } {
  let index = 0;
  return {
    next: () => {
      const value = values[index];
      if (value === undefined) throw new Error(`unexpected RNG read at ${index}`);
      index += 1;
      return value;
    },
    consumed: () => index,
  };
}

const neutralMove = {
  level: 50,
  power: 40,
  damageClass: "physical" as const,
  baseSpeed: 100,
  criticalRate: "normal" as const,
  offense: { unmodified: 100, modified: 100 },
  defense: { unmodified: 100, modified: 100 },
  burned: false,
  stab: false,
  typeFactors: [] as readonly number[],
  baseAccuracyByte: 255,
};

describe("Gen1 byte RNG", () => {
  it("break: float RNG must map to the complete 0..255 byte domain", () => {
    const values = [0, 0.5, 0.999999999];
    const nextByte = createGen1ByteRng(() => values.shift() ?? 0);
    expect([nextByte(), nextByte(), nextByte()]).toEqual([0, 128, 255]);
  });
});

describe("Gen1 neutral damage arithmetic", () => {
  it("break: the nested-floor Lv50/P40/A100/D100 vector must remain 19", () => {
    expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 100 })).toBe(19);
  });

  it("break: either stat above 255 must quarter both stats before division", () => {
    expect(scaleGen1DamageStats(256, 5)).toEqual({ attack: 64, defense: 1 });
    expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 256, defense: 5 })).toBe(999);
  });

  it("break: a zero defense created by quarter-scaling must be reported, not silently changed to one", () => {
    expect(computeGen1BaseDamageResult({ level: 50, power: 40, attack: 256, defense: 3 })).toEqual({
      ok: false,
      reason: "divisionByZero",
      attack: 64,
      defense: 0,
    });
  });

  it("break: the neutral damage cap must be applied before STAB and type floors", () => {
    expect(applyGen1StabAndType(3, true, [20, 20])).toBe(16);
    expect(applyGen1StabAndType(999, true, [])).toBe(1498);
  });
});

describe("Gen1 critical, burn, random damage, and accuracy order", () => {
  it("break: normal and high critical classes must use base Speed thresholds", () => {
    expect(gen1CriticalThreshold(100, "normal", false)).toBe(50);
    expect(gen1CriticalThreshold(100, "high", false)).toBe(255);
    expect(gen1CriticalThreshold(100, "normal", true)).toBe(12);
  });

  it("break: burn must halve only a noncritical physical Attack", () => {
    const physicalRng = bytes([255, 255, 0]);
    const specialRng = bytes([255, 255, 0]);
    const physical = resolveGen1DamagingMove({ ...neutralMove, burned: true }, physicalRng.next);
    const special = resolveGen1DamagingMove(
      { ...neutralMove, damageClass: "special", burned: true },
      specialRng.next,
    );
    expect(physical.damage).toBe(10);
    expect(special.damage).toBe(19);
  });

  it("break: a critical must ignore burn and both battlers' modified stats", () => {
    // raw 38 rotated left three times is 49, below the normal threshold 50.
    const rng = bytes([38, 255, 0]);
    const result = resolveGen1DamagingMove({
      ...neutralMove,
      burned: true,
      offense: { unmodified: 100, modified: 200 },
      defense: { unmodified: 100, modified: 50 },
    }, rng.next);
    expect(result).toMatchObject({ hit: true, critical: true, damage: 35, neutralDamage: 35 });
  });

  it("break: damage randomness must reject rotated bytes below 217", () => {
    // raw 0 rotates to 0 and is rejected; raw 255 rotates to 255 and is accepted.
    const rng = bytes([255, 0, 255, 0]);
    const result = resolveGen1DamagingMove(neutralMove, rng.next);
    expect(result.damage).toBe(19);
    expect(result.trace.rejectedDamageBytes).toEqual([0]);
    expect(rng.consumed()).toBe(4);
  });

  it("break: raw 179 must rotate right to the minimum accepted damage roll 217", () => {
    const rng = bytes([255, 179, 0]);
    const result = resolveGen1DamagingMove(neutralMove, rng.next);
    expect(result.damage).toBe(16);
    expect(result.trace.damageByte).toBe(217);
  });

  it("break: nominal 100% accuracy must still miss on byte 255 after damage RNG is consumed", () => {
    const rng = bytes([255, 255, 255]);
    const result = resolveGen1DamagingMove(neutralMove, rng.next);
    expect(result).toMatchObject({ hit: false, damage: 0, missReason: "accuracy", scaledAccuracy: 255 });
    expect(result.trace).toMatchObject({ critByte: 255, damageByte: 255, accuracyByte: 255 });
    expect(rng.consumed()).toBe(3);
  });
});

describe("Gen1 accuracy stages", () => {
  it("break: authored percentages must use the cartridge's floor(percent*255/100) encoding", () => {
    expect(accuracyByteFromPercent(100)).toBe(255);
    expect(accuracyByteFromPercent(95)).toBe(242);
  });

  it("break: accuracy and reflected evasion ratios must floor sequentially", () => {
    expect(scaledGen1Accuracy(242, -1, 0)).toBe(159);
    expect(scaledGen1Accuracy(255, 0, 1)).toBe(168);
  });
});
