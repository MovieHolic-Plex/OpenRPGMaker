import { describe, expect, it } from "vitest";
import { resolveDodgeStep, tickDodgeIframes } from "@/battle/action/dodge";
import { normalizeActionCombatConfig, resolveActionCombatConfig, DEFAULT_DODGE_IFRAMES_MS, DEFAULT_DODGE_STAMINA_COST } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";

const BASE = { cost: 25, iframesMs: 300, activeIframesMs: 0, deltaMs: 16, requested: true } as const;

describe("resolveDodgeStep", () => {
  it("starts a dodge and spends stamina when there is enough", () => {
    const out = resolveDodgeStep({ ...BASE, stamina: 100 });
    expect(out.started).toBe(true);
    expect(out.stamina).toBe(75);
    expect(out.iframesRemainingMs).toBe(300);
    expect(out.invulnerable).toBe(true);
  });

  it("refuses the dodge with empty stamina and grants no i-frames", () => {
    const out = resolveDodgeStep({ ...BASE, stamina: 0 });
    expect(out.started).toBe(false);
    expect(out.stamina).toBe(0);
    expect(out.iframesRemainingMs).toBe(0);
    expect(out.invulnerable).toBe(false);
  });

  it("refuses when stamina is just short of the cost", () => {
    const out = resolveDodgeStep({ ...BASE, stamina: 24.9 });
    expect(out.started).toBe(false);
    expect(out.stamina).toBeCloseTo(24.9, 6);
    expect(out.invulnerable).toBe(false);
  });

  it("does not restart or double-charge while a dodge is already active", () => {
    const out = resolveDodgeStep({ ...BASE, stamina: 100, activeIframesMs: 300, deltaMs: 100 });
    expect(out.started).toBe(false);
    expect(out.stamina).toBe(100);
    expect(out.iframesRemainingMs).toBe(200);
    expect(out.invulnerable).toBe(true);
  });

  it("lets the i-frame window expire, after which damage lands again", () => {
    const out = resolveDodgeStep({ ...BASE, stamina: 0, requested: false, activeIframesMs: 40, deltaMs: 40 });
    expect(out.iframesRemainingMs).toBe(0);
    expect(out.invulnerable).toBe(false);
    expect(out.started).toBe(false);
  });

  it("does not start without a dash request", () => {
    const out = resolveDodgeStep({ ...BASE, stamina: 100, requested: false });
    expect(out.started).toBe(false);
    expect(out.stamina).toBe(100);
    expect(out.iframesRemainingMs).toBe(0);
  });

  it("re-arms a fresh dodge only after the window drains", () => {
    let stamina = 100;
    let window = 0;
    for (let frame = 0; frame < 3; frame += 1) {
      const out = resolveDodgeStep({ ...BASE, stamina, activeIframesMs: window, deltaMs: 300 });
      stamina = out.stamina;
      window = out.iframesRemainingMs;
    }
    expect(stamina).toBe(25);
    expect(window).toBe(300);
  });

  it("clamps a nonsense window and cost", () => {
    const out = resolveDodgeStep({ stamina: 100, cost: -5, iframesMs: -20, activeIframesMs: 0, deltaMs: 16, requested: true });
    expect(out.started).toBe(true);
    expect(out.stamina).toBe(100);
    expect(out.iframesRemainingMs).toBe(0);
    expect(out.invulnerable).toBe(false);
  });
});

describe("tickDodgeIframes", () => {
  it("drains toward zero without going negative", () => {
    expect(tickDodgeIframes(120, 50)).toBe(70);
    expect(tickDodgeIframes(30, 50)).toBe(0);
    expect(tickDodgeIframes(0, 50)).toBe(0);
  });
});

describe("dodge schema", () => {
  it("stamina rule is on by default on action maps while hud.stamina stays display-only", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    const config = resolveActionCombatConfig(project);
    expect(config.staminaEnabled).toBe(true);
    expect(config.stamina).toBe(false);
    expect(config.dodgeStaminaCost).toBe(DEFAULT_DODGE_STAMINA_COST);
    expect(config.dodgeIframesMs).toBe(DEFAULT_DODGE_IFRAMES_MS);
  });

  it("resolves authored dodge overrides", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true, dodgeStaminaCost: 40, dodgeIframesMs: 500, hud: { stamina: true } };
    const config = resolveActionCombatConfig(project);
    expect(config.dodgeStaminaCost).toBe(40);
    expect(config.dodgeIframesMs).toBe(500);
    expect(config.stamina).toBe(true);
    expect(config.staminaEnabled).toBe(true);
  });

  it("normalizes with clamping and does not persist defaults", () => {
    expect(normalizeActionCombatConfig({ enabled: true })).toEqual({ enabled: true });
    const clamped = normalizeActionCombatConfig({ enabled: true, dodgeStaminaCost: 9999, dodgeIframesMs: -10 });
    expect(clamped?.dodgeStaminaCost).toBe(100);
    expect(clamped?.dodgeIframesMs).toBe(0);
  });
});
