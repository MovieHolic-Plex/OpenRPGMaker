// 홀드 가드 규칙.
// 가드 키를 누르고 있는 동안 피해가 줄지만 스태미나를 태운다. 스태미나가 0 이면
// 가드가 열리지 않고 전부 맞는다. 회피(무적)와는 겹치지 않는다.
import { describe, expect, it } from "vitest";

import { guardedDamage, resolveGuardStep } from "@/battle/action/guard";
import {
  DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT,
  DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC,
  normalizeActionCombatConfig,
  resolveActionCombatConfig,
} from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { RuntimeKeyHoldTracker } from "@/player/input";
import { isGuardKey } from "@/player/keyBindings";

const BASE = {
  reductionPercent: 50,
  drainPerSec: 20,
  deltaMs: 1000,
  requested: true,
  dodging: false,
} as const;

describe("resolveGuardStep", () => {
  it("guards while stamina lasts and drains it by the authored rate", () => {
    const out = resolveGuardStep({ ...BASE, stamina: 100 });
    expect(out.guarding).toBe(true);
    expect(out.stamina).toBe(80);
    expect(out.damageMultiplier).toBeCloseTo(0.5, 6);
  });

  it("scales the drain with the frame delta", () => {
    const out = resolveGuardStep({ ...BASE, stamina: 50, deltaMs: 250 });
    expect(out.guarding).toBe(true);
    expect(out.stamina).toBeCloseTo(45, 6);
  });

  it("gives no reduction at empty stamina", () => {
    const out = resolveGuardStep({ ...BASE, stamina: 0 });
    expect(out.guarding).toBe(false);
    expect(out.stamina).toBe(0);
    expect(out.damageMultiplier).toBe(1);
  });

  it("burns the last sliver of stamina and then stops guarding", () => {
    const first = resolveGuardStep({ ...BASE, stamina: 5 });
    expect(first.guarding).toBe(true);
    expect(first.stamina).toBe(0);
    const second = resolveGuardStep({ ...BASE, stamina: first.stamina });
    expect(second.guarding).toBe(false);
    expect(second.damageMultiplier).toBe(1);
  });

  it("does not guard without input and does not drain then", () => {
    const out = resolveGuardStep({ ...BASE, stamina: 100, requested: false });
    expect(out.guarding).toBe(false);
    expect(out.stamina).toBe(100);
    expect(out.damageMultiplier).toBe(1);
  });

  it("cannot be combined with a dodge", () => {
    const out = resolveGuardStep({ ...BASE, stamina: 100, dodging: true });
    expect(out.guarding).toBe(false);
    expect(out.stamina).toBe(100);
    expect(out.damageMultiplier).toBe(1);
  });

  it("clamps an absurd authored reduction into a survivable band", () => {
    const overshoot = resolveGuardStep({ ...BASE, stamina: 100, reductionPercent: 400 });
    expect(overshoot.damageMultiplier).toBeGreaterThan(0);
    expect(overshoot.damageMultiplier).toBeLessThanOrEqual(0.1);
    const negative = resolveGuardStep({ ...BASE, stamina: 100, reductionPercent: -50 });
    expect(negative.damageMultiplier).toBe(1);
  });
});

describe("guardedDamage", () => {
  it("reduces incoming damage while guarding but never below one", () => {
    expect(guardedDamage(40, 0.5)).toBe(20);
    expect(guardedDamage(3, 0.1)).toBe(1);
    expect(guardedDamage(40, 1)).toBe(40);
  });

  it("leaves zero damage alone", () => {
    expect(guardedDamage(0, 0.5)).toBe(0);
  });
});

describe("guard schema", () => {
  it("resolves defaults on an action map", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    const config = resolveActionCombatConfig(project);
    expect(config.guardDamageReductionPercent).toBe(DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT);
    expect(config.guardStaminaDrainPerSec).toBe(DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC);
  });

  it("resolves authored overrides", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true, guardDamageReductionPercent: 70, guardStaminaDrainPerSec: 35 };
    const config = resolveActionCombatConfig(project);
    expect(config.guardDamageReductionPercent).toBe(70);
    expect(config.guardStaminaDrainPerSec).toBe(35);
  });

  it("clamps on normalization and does not persist defaults", () => {
    expect(normalizeActionCombatConfig({ enabled: true })).toEqual({ enabled: true });
    const clamped = normalizeActionCombatConfig({
      enabled: true,
      guardDamageReductionPercent: 999,
      guardStaminaDrainPerSec: -12,
    });
    expect(clamped?.guardDamageReductionPercent).toBe(90);
    expect(clamped?.guardStaminaDrainPerSec).toBe(0);
  });
});

describe("guard input", () => {
  it("binds a hold key that collides with nothing else in the runtime contract", () => {
    expect(isGuardKey("c")).toBe(true);
    expect(isGuardKey("C")).toBe(true);
    for (const key of ["q", "r", "z", "x", "Enter", " ", "w", "a", "s", "d", "Shift", "f"]) {
      expect(isGuardKey(key), key).toBe(false);
    }
  });

  it("tracks the hold state and clears it on release and focus loss", () => {
    const tracker = new RuntimeKeyHoldTracker();
    expect(tracker.isGuarding()).toBe(false);
    tracker.keyDown("c");
    expect(tracker.isGuarding()).toBe(true);
    tracker.keyUp("c");
    expect(tracker.isGuarding()).toBe(false);
    tracker.keyDown("C");
    expect(tracker.isGuarding()).toBe(true);
    tracker.releaseAll();
    expect(tracker.isGuarding()).toBe(false);
  });
});
