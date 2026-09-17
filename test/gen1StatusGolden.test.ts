import { describe, expect, it } from "vitest";
import {
  applyGen1MajorStatus,
  applyGen1PostActionResidual,
  gen1EffectChanceSucceeds,
  gen1EffectChanceThreshold,
  gen1MajorStatusBlockedByType,
  gen1BurnAdjustedAttack,
  gen1ParalyzedSpeed,
  readGen1MajorStatus,
  stepGen1MajorStatus,
  type Gen1StateRecordRef,
} from "@/battle/gen1/status";
import { gen1CanonicalTypeForId, gen1ElementIdForCanonical } from "@/battle/typeChart";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";

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

const states: readonly Gen1StateRecordRef[] = [
  { id: "state_poison", gen1MajorStatus: "poison" },
  { id: "state_burn", gen1MajorStatus: "burn" },
  { id: "state_sleep", gen1MajorStatus: "sleep" },
  { id: "state_freeze", gen1MajorStatus: "freeze" },
  { id: "state_paralysis", gen1MajorStatus: "paralysis" },
  { id: "state_buff" },
];

describe("Gen1 post-hit effect chance", () => {
  it("uses the cartridge percent-byte boundary and makes 100% unconditional", () => {
    expect(gen1EffectChanceThreshold(0)).toBe(0);
    expect(gen1EffectChanceThreshold(10)).toBe(26);
    expect(gen1EffectChanceThreshold(20)).toBe(52);
    expect(gen1EffectChanceThreshold(30)).toBe(77);
    expect(gen1EffectChanceThreshold(100)).toBe(256);

    expect(gen1EffectChanceSucceeds(10, bytes([25]).next)).toBe(true);
    expect(gen1EffectChanceSucceeds(10, bytes([26]).next)).toBe(false);
    const guaranteed = bytes([]);
    expect(gen1EffectChanceSucceeds(100, guaranteed.next)).toBe(true);
    expect(guaranteed.consumed()).toBe(0);
  });
});

describe("Gen1 major-status type immunity", () => {
  it("preserves Red/Blue poison, damaging-side-effect, and electric status rules", () => {
    expect(gen1MajorStatusBlockedByType("poison", "poison", ["poison"], "damage")).toBe(true);
    expect(gen1MajorStatusBlockedByType("burn", "fire", ["fire"], "damage")).toBe(true);
    expect(gen1MajorStatusBlockedByType("freeze", "ice", ["ice"], "damage")).toBe(true);
    expect(gen1MajorStatusBlockedByType("paralysis", "normal", ["normal"], "damage")).toBe(true);
    expect(gen1MajorStatusBlockedByType("paralysis", "electric", ["ground"], "status")).toBe(true);

    expect(gen1MajorStatusBlockedByType("paralysis", "normal", ["electric"], "damage")).toBe(false);
    expect(gen1MajorStatusBlockedByType("paralysis", "electric", ["electric"], "status")).toBe(false);
    expect(gen1MajorStatusBlockedByType("sleep", "grass", ["grass"], "status")).toBe(false);
  });

  it("resolves prefixed and localized authored type ids to cartridge semantics", () => {
    const project = createScarloxyPokemonDemoProject();
    project.system.typeChart!.types = project.system.typeChart!.types.map((typeId) =>
      typeId === "normal" ? "type_normal" : typeId,
    );

    expect(gen1CanonicalTypeForId(project, "type_fire")).toBe("fire");
    expect(gen1CanonicalTypeForId(project, "불꽃")).toBe("fire");
    expect(gen1CanonicalTypeForId(project, "type_ground")).toBe("ground");
    expect(gen1ElementIdForCanonical(project, "normal")).toBe("type_normal");
  });
});

describe("Gen1 single-major-status application", () => {
  it("break: rejects a second major status while preserving non-major states", () => {
    const rng = bytes([]);
    const result = applyGen1MajorStatus({
      stateIds: ["state_buff", "state_burn"],
      stateTurns: {},
      stateRecords: states,
      incomingStateId: "state_paralysis",
    }, rng.next);
    expect(result).toMatchObject({
      applied: false,
      reason: "majorStatusPresent",
      stateIds: ["state_buff", "state_burn"],
    });
    expect(readGen1MajorStatus(result.stateIds, result.stateTurns, states))
      .toEqual({ stateId: "state_burn", kind: "burn", turns: undefined });
    expect(rng.consumed()).toBe(0);
  });

  it("break: sleep rolls 1..7 with zero values rejected after masking", () => {
    const rng = bytes([0, 8, 7]);
    const result = applyGen1MajorStatus({
      stateIds: ["state_buff"],
      stateTurns: {},
      stateRecords: states,
      incomingStateId: "state_sleep",
    }, rng.next);
    expect(result).toMatchObject({
      applied: true,
      stateIds: ["state_buff", "state_sleep"],
      stateTurns: { state_sleep: 7 },
      trace: { rejectedSleepBytes: [0, 8], sleepByte: 7 },
    });
    expect(rng.consumed()).toBe(3);
  });
});

describe("Gen1 pre-action status", () => {
  it("break: the wake-up turn still loses its action and clears sleep", () => {
    const rng = bytes([]);
    const result = stepGen1MajorStatus({
      stateIds: ["state_buff", "state_sleep"],
      stateTurns: { state_sleep: 1 },
      stateRecords: states,
    }, rng.next);
    expect(result).toMatchObject({
      canAct: false,
      reason: "wokeUp",
      stateIds: ["state_buff"],
      stateTurns: {},
    });
    expect(rng.consumed()).toBe(0);
  });

  it("break: sleep decrements before blocking the action", () => {
    const rng = bytes([]);
    expect(stepGen1MajorStatus({
      stateIds: ["state_sleep"],
      stateTurns: { state_sleep: 2 },
      stateRecords: states,
    }, rng.next)).toMatchObject({
      canAct: false,
      reason: "asleep",
      stateIds: ["state_sleep"],
      stateTurns: { state_sleep: 1 },
    });
  });

  it("break: paralysis blocks bytes 0..62, exactly 63/256 outcomes", () => {
    const blockedRng = bytes([62]);
    const actsRng = bytes([63]);
    const input = {
      stateIds: ["state_paralysis"],
      stateTurns: {},
      stateRecords: states,
    };
    expect(stepGen1MajorStatus(input, blockedRng.next))
      .toMatchObject({ canAct: false, reason: "fullyParalyzed", trace: { paralysisByte: 62 } });
    expect(stepGen1MajorStatus(input, actsRng.next))
      .toMatchObject({ canAct: true, trace: { paralysisByte: 63 } });
  });

  it("break: freeze has no natural thaw roll and consumes no RNG", () => {
    const rng = bytes([]);
    expect(stepGen1MajorStatus({
      stateIds: ["state_freeze"],
      stateTurns: {},
      stateRecords: states,
    }, rng.next)).toMatchObject({
      canAct: false,
      reason: "frozen",
      stateIds: ["state_freeze"],
    });
    expect(rng.consumed()).toBe(0);
  });
});

describe("Gen1 burn, paralysis, and post-action residuals", () => {
  it("halves only noncritical physical Attack and quarters paralyzed Speed", () => {
    expect(gen1BurnAdjustedAttack(101, "physical", true, false)).toBe(50);
    expect(gen1BurnAdjustedAttack(101, "special", true, false)).toBe(101);
    expect(gen1BurnAdjustedAttack(101, "physical", true, true)).toBe(101);
    expect(gen1ParalyzedSpeed(101, true)).toBe(25);
  });

  it.each(["burn", "poison"] as const)("break: %s deals floor(MaxHP/16), minimum one, after the action", (kind) => {
    expect(applyGen1PostActionResidual({ kind, maxHp: 100, currentHp: 100 }))
      .toEqual({ damage: 6, currentHp: 94, fainted: false });
    expect(applyGen1PostActionResidual({ kind, maxHp: 15, currentHp: 1 }))
      .toEqual({ damage: 1, currentHp: 0, fainted: true });
  });

  it("does not apply residual damage for other major statuses", () => {
    expect(applyGen1PostActionResidual({ kind: "paralysis", maxHp: 100, currentHp: 50 }))
      .toEqual({ damage: 0, currentHp: 50, fainted: false });
  });
});
