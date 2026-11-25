import { describe, expect, it } from "vitest";
import { ATTACK_BUFFER_LIFETIME_MS, bufferAttackPress, createAttackBuffer, tickAttackBuffer } from "@/battle/action/attackWindow";
import { resolveDodgeStep, tickDodgeIframes } from "@/battle/action/dodge";
import { normalizeActionCombatConfig, resolveActionCombatConfig, DEFAULT_DODGE_IFRAMES_MS, DEFAULT_DODGE_STAMINA_COST, DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT, DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { guardedDamage, resolveGuardStep } from "@/battle/action/guard";
import { RuntimeKeyHoldTracker } from "@/player/input";
import { isGuardKey, isSkillCycleKey, isSkillKey } from "@/player/keyBindings";
import { consumeHitstop } from "@/battle/action/hitstop";
import { kiteBandForAttack, resolveKiteIntent } from "@/battle/action/kiting";
import { nextChaseDecision, type ChaseRuntimeState } from "@/player/chaseAi";
import type { EnemyActionAttack, GameMap, Project } from "@/project/types";
import { resolveKnockback, type KnockbackInput } from "@/battle/action/knockback";
import { ACTION_SKILL_SLOT_MAX, activeActionSkillId, cycleActionSkillSlot, resolveActionSkillSlots } from "@/battle/action/skillSlots";
import { DEFAULT_STAGGER_MS, canActInMode, resolveStaggerOnHit, tickStagger, type ActionModeName } from "@/battle/action/stagger";
import { isolateTimers } from "./mergedTeardown";

describe("actionAttackWindow", () => {
  isolateTimers();
  // 씬과 동일한 규칙으로 버퍼를 구동하는 고정 델타 리플레이. 쿨다운 감소는
  // tickAttackBuffer 가 returning cooldownRemainingMs 로 책임진다.
  function replay(cooldownMs: number, totalMs: number, stepMs: number, pressAtElapsedMs: number[] = []): {
    swings: number;
    pressCount: number;
  } {
    const buffer = createAttackBuffer();
    let cooldown = cooldownMs;
    let elapsed = 0;
    let swings = 0;
    let pressCount = 0;
    while (elapsed < totalMs) {
      if (pressAtElapsedMs.includes(elapsed)) {
        bufferAttackPress(buffer);
        pressCount += 1;
      }
      const before = cooldown;
      const tick = tickAttackBuffer(buffer, before, stepMs);
      cooldown = tick.cooldownRemainingMs;
      if (tick.fired) swings += 1;
      elapsed += stepMs;
    }
    return { swings, pressCount };
  }
  describe("attackWindow buffer", () => {
    it("releases exactly one swing when the cooldown reaches zero", () => {
      const out = replay(200, 600, 16, [0]);
      expect(out.pressCount).toBe(1);
      expect(out.swings).toBe(1);
    });

    it("never releases a second swing for one press", () => {
      const buffer = createAttackBuffer();
      bufferAttackPress(buffer);
      let cooldown = 200;
      let fired = 0;
      for (let i = 0; i < 60; i += 1) {
        const tick = tickAttackBuffer(buffer, cooldown, 16);
        cooldown = tick.cooldownRemainingMs;
        if (tick.fired) fired += 1;
      }
      expect(cooldown).toBe(0);
      expect(fired).toBe(1);
    });

    it("does not fire without a buffered press", () => {
      expect(replay(200, 600, 16).swings).toBe(0);
    });

    it("does not fire from a tick that starts already off cooldown", () => {
      const buffer = createAttackBuffer();
      const tick = tickAttackBuffer(buffer, 0, 16);
      expect(tick.fired).toBe(false);
      expect(tick.cooldownRemainingMs).toBe(0);
    });

    it("drops the buffered press once the bounded lifetime expires", () => {
      // 쿨다운이 버퍼 수명보다 길면 오래된 입력은 절대 발화하지 않는다.
      expect(ATTACK_BUFFER_LIFETIME_MS).toBeLessThan(400);
      expect(replay(400, 800, 16, [0]).swings).toBe(0);
      expect(replay(400, 800, 50, [0]).swings).toBe(0);
    });

    it("ignores extra presses while a press is already buffered", () => {
      const out = replay(200, 600, 16, [0, 32, 64, 96]);
      expect(out.pressCount).toBe(4);
      expect(out.swings).toBe(1);
    });

    it("16ms steps and 50ms steps over the same total time agree", () => {
      const fine = replay(200, 600, 16, [0]);
      const coarse = replay(200, 600, 50, [0]);
      expect(fine.swings).toBe(1);
      expect(coarse.swings).toBe(1);
    });

    it("16ms and 50ms replays also agree on the expiry case", () => {
      const fine = replay(400, 800, 16, [0]);
      const coarse = replay(400, 800, 50, [0]);
      expect(fine.swings).toBe(0);
      expect(coarse.swings).toBe(0);
    });
  });
});

describe("actionDodge", () => {
  isolateTimers();
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
});

// 홀드 가드 규칙.
// 가드 키를 누르고 있는 동안 피해가 줄지만 스태미나를 태운다. 스태미나가 0 이면
// 가드가 열리지 않고 전부 맞는다. 회피(무적)와는 겹치지 않는다.
describe("actionGuard", () => {
  isolateTimers();
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
});

describe("actionHitstop", () => {
  isolateTimers();
  describe("consumeHitstop", () => {
    it("does not skip the update when no hitstop remains", () => {
      const result = consumeHitstop(0, 16);
      expect(result.skipUpdate).toBe(false);
      expect(result.nextRemainingMs).toBe(0);
    });

    it("normalizes negative remaining time to zero without skipping", () => {
      const result = consumeHitstop(-40, 16);
      expect(result.skipUpdate).toBe(false);
      expect(result.nextRemainingMs).toBe(0);
    });

    it("consumes part of a longer hitstop and skips the frame", () => {
      const result = consumeHitstop(80, 30);
      expect(result.skipUpdate).toBe(true);
      expect(result.nextRemainingMs).toBe(50);
    });

    it("clamps to zero when delta exceeds the remaining hitstop but still skips", () => {
      const result = consumeHitstop(20, 60);
      expect(result.skipUpdate).toBe(true);
      expect(result.nextRemainingMs).toBe(0);
    });

    it("keeps the full remaining time when the frame delta is zero", () => {
      const result = consumeHitstop(60, 0);
      expect(result.skipUpdate).toBe(true);
      expect(result.nextRemainingMs).toBe(60);
    });
  });
});

// 원거리 적의 거리 유지(kiting) + 어그로 획득/포기.
// 예전에는 적이 전부 같은 추격 묘버를 써서, 활을 든 해골 궁수도 플레이어 얼굴까지
// 걸어와 접촉 피해로 싸웠다. 투사체 적은 최소 거리 안으로 들어오면 물러나고
// 선호 거리보다 멀면 다가온다.
describe("actionKiting", () => {
  isolateTimers();
  const PROJECTILE: EnemyActionAttack = {
    kind: "projectile",
    windupMs: 700,
    recoverMs: 300,
    damage: 18,
    range: 8,
    cooldownMs: 1400,
  };
  const MELEE: EnemyActionAttack = { kind: "melee", windupMs: 300, recoverMs: 250, damage: 14, range: 1 };
  function fixture(): { project: Project; map: GameMap } {
    const project = createBlankProject();
    const map = Object.values(project.maps)[0] as GameMap;
    return { project, map };
  }
  function mover(): ChaseRuntimeState {
    return { timer: 999, moveIntervalMs: 0 };
  }
  describe("kiteBandForAttack", () => {
    it("gives a band only to projectile attackers", () => {
      const band = kiteBandForAttack(PROJECTILE);
      expect(band).not.toBeNull();
      expect(band?.minRange).toBeGreaterThanOrEqual(2);
      expect(band?.preferredRange).toBeLessThanOrEqual(PROJECTILE.range);
      expect(band?.preferredRange).toBeGreaterThan(band?.minRange ?? 0);
      expect(kiteBandForAttack(MELEE)).toBeNull();
      expect(kiteBandForAttack(undefined)).toBeNull();
    });

    it("keeps the band coherent for a very short-ranged projectile", () => {
      const band = kiteBandForAttack({ ...PROJECTILE, range: 2 });
      expect(band).not.toBeNull();
      expect(band?.preferredRange).toBeGreaterThan(band?.minRange ?? 0);
    });
  });
  describe("resolveKiteIntent", () => {
    const band = { minRange: 3, preferredRange: 6 } as const;

    it("retreats when the player closes inside the minimum range", () => {
      expect(resolveKiteIntent({ distance: 0, band })).toBe("retreat");
      expect(resolveKiteIntent({ distance: 3, band })).toBe("retreat");
    });

    it("holds inside the preferred band", () => {
      expect(resolveKiteIntent({ distance: 4, band })).toBe("hold");
      expect(resolveKiteIntent({ distance: 6, band })).toBe("hold");
    });

    it("advances when out of the preferred band", () => {
      expect(resolveKiteIntent({ distance: 7, band })).toBe("advance");
      expect(resolveKiteIntent({ distance: 20, band })).toBe("advance");
    });
  });
  describe("nextChaseDecision with a kite band", () => {
    it("backs away from the player when inside the minimum range", () => {
      const { project, map } = fixture();
      const player = { x: 6, y: 7 };
      const decision = nextChaseDecision({
        project,
        map,
        from: { x: 8, y: 7 },
        player,
        deltaMs: 16,
        mover: mover(),
        sightRange: 12,
        giveUpRange: 20,
        pathfind: true,
        kite: { minRange: 3, preferredRange: 6 },
      });
      expect(decision.kind).toBe("move");
      if (decision.kind !== "move") return;
      expect(Math.max(Math.abs(decision.x - player.x), Math.abs(decision.y - player.y))).toBeGreaterThan(2);
      expect(decision.x).toBe(9);
      expect(decision.y).toBe(7);
    });

    it("holds position while inside the preferred band", () => {
      const { project, map } = fixture();
      const decision = nextChaseDecision({
        project,
        map,
        from: { x: 11, y: 7 },
        player: { x: 6, y: 7 },
        deltaMs: 16,
        mover: mover(),
        sightRange: 12,
        giveUpRange: 20,
        pathfind: true,
        kite: { minRange: 3, preferredRange: 6 },
      });
      expect(decision).toEqual({ kind: "wait" });
    });

    it("advances when the player is beyond the preferred band", () => {
      const { project, map } = fixture();
      const player = { x: 6, y: 7 };
      const from = { x: 15, y: 7 };
      const decision = nextChaseDecision({
        project,
        map,
        from,
        player,
        deltaMs: 16,
        mover: mover(),
        sightRange: 14,
        giveUpRange: 24,
        pathfind: true,
        kite: { minRange: 3, preferredRange: 6 },
      });
      expect(decision.kind).toBe("move");
      if (decision.kind !== "move") return;
      const before = Math.abs(from.x - player.x) + Math.abs(from.y - player.y);
      const after = Math.abs(decision.x - player.x) + Math.abs(decision.y - player.y);
      expect(after).toBeLessThan(before);
    });

    it("never walks into contact even when the player is adjacent", () => {
      const { project, map } = fixture();
      const player = { x: 6, y: 7 };
      const decision = nextChaseDecision({
        project,
        map,
        from: { x: 7, y: 7 },
        player,
        deltaMs: 16,
        mover: mover(),
        sightRange: 12,
        giveUpRange: 20,
        pathfind: true,
        kite: { minRange: 3, preferredRange: 6 },
      });
      expect(decision.kind).not.toBe("touch");
      if (decision.kind !== "move") return;
      expect(Math.abs(decision.x - player.x) + Math.abs(decision.y - player.y)).toBeGreaterThan(1);
    });
  });
  describe("aggro acquisition and give-up", () => {
    it("stays put until the player enters the aggro range, then keeps chasing", () => {
      const { project, map } = fixture();
      const state = mover();
      const far = nextChaseDecision({
        project, map, from: { x: 16, y: 7 }, player: { x: 6, y: 7 },
        deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
      });
      expect(far).toEqual({ kind: "wait" });
      expect(state.chaseActive).not.toBe(true);

      state.timer = 999;
      const near = nextChaseDecision({
        project, map, from: { x: 10, y: 7 }, player: { x: 6, y: 7 },
        deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
      });
      expect(near.kind).toBe("move");
      expect(state.chaseActive).toBe(true);
    });

    it("gives up aggro past the give-up range and has to re-acquire", () => {
      const { project, map } = fixture();
      const state: ChaseRuntimeState = { timer: 999, moveIntervalMs: 0, chaseActive: true };
      const lost = nextChaseDecision({
        project, map, from: { x: 19, y: 7 }, player: { x: 6, y: 7 },
        deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
      });
      expect(lost).toEqual({ kind: "wait" });
      expect(state.chaseActive).toBe(false);

      state.timer = 999;
      const stillLost = nextChaseDecision({
        project, map, from: { x: 14, y: 7 }, player: { x: 6, y: 7 },
        deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
      });
      expect(stillLost).toEqual({ kind: "wait" });
    });
  });
});

describe("actionKnockback", () => {
  isolateTimers();
  const OPEN: Pick<KnockbackInput, "inBounds" | "isPassable" | "isOccupied"> = {
    inBounds: () => true,
    isPassable: () => true,
    isOccupied: () => false,
  };
  function base(overrides: Partial<KnockbackInput> = {}): KnockbackInput {
    return {
      enemyTile: { x: 6, y: 4 },
      playerTile: { x: 5, y: 4 },
      knockbackResist: 0,
      roll: 0.5,
      ...OPEN,
      ...overrides,
    };
  }
  describe("resolveKnockback", () => {
    it("플레이어 반대편 한 칸으로 실제로 밀어낸다", () => {
      const out = resolveKnockback(base());
      expect(out.displaced).toBe(true);
      expect(out.resisted).toBe(false);
      expect(out.x).toBe(7);
      expect(out.y).toBe(4);
      expect(out.dirX).toBe(1);
      expect(out.dirY).toBe(0);
    });

    it("세로로 붙어 있으면 세로로 밀린다", () => {
      const out = resolveKnockback(base({ enemyTile: { x: 5, y: 3 }, playerTile: { x: 5, y: 6 } }));
      expect(out.displaced).toBe(true);
      expect(out.x).toBe(5);
      expect(out.y).toBe(2);
    });

    it("맵 밖으로는 밀리지 않는다", () => {
      const out = resolveKnockback(base({ inBounds: (x) => x < 7 }));
      expect(out.displaced).toBe(false);
      expect(out.reason).toBe("out-of-bounds");
      expect(out.x).toBe(6);
      expect(out.y).toBe(4);
    });

    it("벽으로는 밀리지 않는다", () => {
      const out = resolveKnockback(base({ isPassable: (x, y) => !(x === 7 && y === 4) }));
      expect(out.displaced).toBe(false);
      expect(out.reason).toBe("blocked");
      expect(out.x).toBe(6);
      expect(out.y).toBe(4);
    });

    it("다른 적이 서 있는 칸으로는 밀리지 않는다", () => {
      const out = resolveKnockback(base({ isOccupied: (x, y) => x === 7 && y === 4 }));
      expect(out.displaced).toBe(false);
      expect(out.reason).toBe("occupied");
    });

    it("knockbackResist 1 은 항상 저항한다", () => {
      for (const roll of [0, 0.25, 0.5, 0.999999, 1]) {
        const out = resolveKnockback(base({ knockbackResist: 1, roll }));
        expect(out.displaced).toBe(false);
        expect(out.resisted).toBe(true);
        expect(out.reason).toBe("resisted");
        expect(out.x).toBe(6);
        expect(out.y).toBe(4);
      }
    });

    it("knockbackResist 는 확률이다 — 굴림이 저항값보다 낮으면 버틴다", () => {
      expect(resolveKnockback(base({ knockbackResist: 0.5, roll: 0.49 })).displaced).toBe(false);
      expect(resolveKnockback(base({ knockbackResist: 0.5, roll: 0.51 })).displaced).toBe(true);
    });

    it("knockbackResist 0 은 굴림과 무관하게 밀린다", () => {
      for (const roll of [0, 0.001, 0.9]) {
        expect(resolveKnockback(base({ knockbackResist: 0, roll })).displaced).toBe(true);
      }
    });

    it("같은 칸이면 방향이 없어 밀지 않는다", () => {
      const out = resolveKnockback(base({ enemyTile: { x: 5, y: 5 }, playerTile: { x: 5, y: 5 } }));
      expect(out.displaced).toBe(false);
      expect(out.reason).toBe("no-direction");
    });

    it("대각 상황은 축이 더 큰 쪽으로만 밀어낸다(한 칸 이동 유지)", () => {
      const out = resolveKnockback(base({ enemyTile: { x: 8, y: 5 }, playerTile: { x: 5, y: 4 } }));
      expect(out.x).toBe(9);
      expect(out.y).toBe(5);
      const vertical = resolveKnockback(base({ enemyTile: { x: 6, y: 9 }, playerTile: { x: 5, y: 4 } }));
      expect(vertical.x).toBe(6);
      expect(vertical.y).toBe(10);
    });
  });
});

// 액션 스킬 슬롯 규칙.
// 예전에는 tryActionSkillCast 가 배운 스킬 중 actionSkill 프로필이 있는 **첫 번째**를
// find 로 집었다. 스킬을 두 개 배워도 두 번째는 영원히 못 쓴다. 슬롯 해석 + 순환 +
// "활성 슬롯으로 캐스트" 를 순수 규칙으로 고정한다.
describe("actionSkillSlots", () => {
  isolateTimers();
  const HAS_ACTION = (id: string): boolean => id.startsWith("act_");
  describe("resolveActionSkillSlots", () => {
    it("keeps only action skills, in learned order", () => {
      expect(resolveActionSkillSlots(["heal", "act_fire", "buff", "act_ice"], HAS_ACTION)).toEqual([
        "act_fire",
        "act_ice",
      ]);
    });

    it("caps the slot count and drops duplicates", () => {
      const slots = resolveActionSkillSlots(
        ["act_a", "act_a", "act_b", "act_c", "act_d", "act_e"],
        HAS_ACTION
      );
      expect(slots).toEqual(["act_a", "act_b", "act_c"]);
      expect(slots.length).toBe(ACTION_SKILL_SLOT_MAX);
      expect(ACTION_SKILL_SLOT_MAX).toBeGreaterThanOrEqual(2);
    });

    it("returns an empty slot list when nothing is castable", () => {
      expect(resolveActionSkillSlots(["heal", "buff"], HAS_ACTION)).toEqual([]);
      expect(resolveActionSkillSlots([], HAS_ACTION)).toEqual([]);
    });
  });
  describe("cycleActionSkillSlot", () => {
    it("wraps forward through every slot", () => {
      expect(cycleActionSkillSlot(0, 3)).toBe(1);
      expect(cycleActionSkillSlot(1, 3)).toBe(2);
      expect(cycleActionSkillSlot(2, 3)).toBe(0);
    });

    it("cycles backward and clamps a stale index back into range", () => {
      expect(cycleActionSkillSlot(0, 3, -1)).toBe(2);
      expect(cycleActionSkillSlot(9, 2)).toBe(0);
      expect(cycleActionSkillSlot(-4, 2)).toBe(0);
    });

    it("stays at zero with zero or one slot", () => {
      expect(cycleActionSkillSlot(0, 0)).toBe(0);
      expect(cycleActionSkillSlot(0, 1)).toBe(0);
    });
  });
  describe("activeActionSkillId", () => {
    it("casts the active slot, not the first learned skill", () => {
      const slots = resolveActionSkillSlots(["act_fire", "act_ice", "act_bolt"], HAS_ACTION);
      expect(activeActionSkillId(slots, 0)).toBe("act_fire");
      const next = cycleActionSkillSlot(0, slots.length);
      expect(activeActionSkillId(slots, next)).toBe("act_ice");
      expect(activeActionSkillId(slots, cycleActionSkillSlot(next, slots.length))).toBe("act_bolt");
    });

    it("is undefined without slots and clamps an out-of-range index", () => {
      expect(activeActionSkillId([], 0)).toBeUndefined();
      expect(activeActionSkillId(["act_fire"], 7)).toBe("act_fire");
    });
  });
  describe("slot cycle input", () => {
    it("binds a cycle key that does not collide with cast/move/confirm keys", () => {
      expect(isSkillCycleKey("r")).toBe(true);
      expect(isSkillCycleKey("R")).toBe(true);
      for (const key of ["q", "z", "x", "Enter", " ", "w", "a", "s", "d", "Shift", "f"]) {
        expect(isSkillCycleKey(key), key).toBe(false);
      }
      expect(isSkillKey("r")).toBe(false);
    });

    it("raises exactly one cycle edge per press and ignores OS key repeat", () => {
      const tracker = new RuntimeKeyHoldTracker();
      tracker.keyDown("r");
      expect(tracker.consumeSkillCycleEdge()).toBe(true);
      expect(tracker.consumeSkillCycleEdge()).toBe(false);
      tracker.keyDown("r", true);
      expect(tracker.consumeSkillCycleEdge()).toBe(false);
      tracker.keyUp("r");
      tracker.keyDown("r");
      expect(tracker.consumeSkillCycleEdge()).toBe(true);
    });

    it("releaseAll drops a pending cycle edge (focus loss)", () => {
      const tracker = new RuntimeKeyHoldTracker();
      tracker.keyDown("r");
      tracker.releaseAll();
      expect(tracker.consumeSkillCycleEdge()).toBe(false);
    });
  });
});

describe("actionStagger", () => {
  isolateTimers();
  // 씬(updateEnemyModes)의 모드 전이를 그대로 축소한 미니 리듀서.
  // 스태거 규칙이 실제 소비처에서 어떻게 동작하는지 순수하게 재현한다.
  interface MiniEnemy {
    mode: ActionModeName;
    modeTimerMs: number;
    attackCooldownMs: number;
    strikes: number;
  }
  const ATTACK = { windupMs: 400, cooldownMs: 1200 } as const;
  function stepFrame(enemy: MiniEnemy, deltaMs: number): void {
    enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - deltaMs);
    switch (enemy.mode) {
      case "combat": {
        if (enemy.attackCooldownMs > 0) break;
        enemy.mode = "windup";
        enemy.modeTimerMs = ATTACK.windupMs;
        break;
      }
      case "windup": {
        enemy.modeTimerMs -= deltaMs;
        if (enemy.modeTimerMs <= 0) {
          enemy.strikes += 1;
          enemy.mode = "recover";
          enemy.modeTimerMs = 200;
        }
        break;
      }
      case "stagger": {
        const out = tickStagger({
          modeTimerMs: enemy.modeTimerMs,
          deltaMs,
          attackCooldownMs: enemy.attackCooldownMs,
          armCooldownMs: ATTACK.cooldownMs,
        });
        enemy.mode = out.mode;
        enemy.modeTimerMs = out.modeTimerMs;
        enemy.attackCooldownMs = out.attackCooldownMs;
        break;
      }
      case "recover": {
        enemy.modeTimerMs -= deltaMs;
        if (enemy.modeTimerMs <= 0) {
          enemy.mode = "combat";
          enemy.attackCooldownMs = ATTACK.cooldownMs;
        }
        break;
      }
      default:
        break;
    }
  }
  describe("resolveStaggerOnHit", () => {
    it("windup 중 피격은 선딜을 끊고 스태거로 바꾼다", () => {
      const out = resolveStaggerOnHit({ mode: "windup" });
      expect(out.mode).toBe("stagger");
      expect(out.modeTimerMs).toBe(DEFAULT_STAGGER_MS);
      expect(out.cancelWindup).toBe(true);
      expect(out.cancelDash).toBe(false);
    });

    it("dash 중 피격은 진행 중인 돌진 상태를 버린다", () => {
      const out = resolveStaggerOnHit({ mode: "dash" });
      expect(out.cancelWindup).toBe(false);
      expect(out.cancelDash).toBe(true);
      expect(out.mode).toBe("stagger");
    });

    it("combat/recover 중 피격도 스태거로 들어가되 취소할 것이 없다", () => {
      for (const mode of ["combat", "recover"] as const) {
        const out = resolveStaggerOnHit({ mode });
        expect(out.mode).toBe("stagger");
        expect(out.cancelWindup).toBe(false);
        expect(out.cancelDash).toBe(false);
      }
    });

    it("저작된 스태거 길이를 존중하고 쓰레기 값은 기본값으로 클램프한다", () => {
      expect(resolveStaggerOnHit({ mode: "windup", staggerMs: 90 }).modeTimerMs).toBe(90);
      expect(resolveStaggerOnHit({ mode: "windup", staggerMs: -5 }).modeTimerMs).toBe(0);
      expect(resolveStaggerOnHit({ mode: "windup", staggerMs: Number.NaN }).modeTimerMs).toBe(DEFAULT_STAGGER_MS);
    });
  });
  describe("canActInMode", () => {
    it("스태거 동안에는 행동하지 않는다", () => {
      expect(canActInMode("stagger")).toBe(false);
      expect(canActInMode("combat")).toBe(true);
      expect(canActInMode("windup")).toBe(true);
      expect(canActInMode("dash")).toBe(true);
      expect(canActInMode("recover")).toBe(true);
    });
  });
  describe("tickStagger", () => {
    it("창이 남아 있으면 스태거를 유지한다", () => {
      const out = tickStagger({ modeTimerMs: 220, deltaMs: 60, attackCooldownMs: 0, armCooldownMs: 1200 });
      expect(out.mode).toBe("stagger");
      expect(out.modeTimerMs).toBe(160);
      expect(out.attackCooldownMs).toBe(0);
    });

    it("창이 끝나면 전투로 돌아가고 공격 쿨다운을 채운다", () => {
      const out = tickStagger({ modeTimerMs: 40, deltaMs: 60, attackCooldownMs: 0, armCooldownMs: 1200 });
      expect(out.mode).toBe("combat");
      expect(out.modeTimerMs).toBe(0);
      expect(out.attackCooldownMs).toBe(1200);
    });

    it("이미 남아 있는 더 긴 쿨다운을 짧게 줄이지 않는다", () => {
      const out = tickStagger({ modeTimerMs: 10, deltaMs: 20, attackCooldownMs: 2000, armCooldownMs: 1200 });
      expect(out.mode).toBe("combat");
      expect(out.attackCooldownMs).toBe(2000);
    });
  });
  describe("스태거 시나리오(씬 전이 축소판)", () => {
    it("선딜 중 맞은 적은 그 공격을 못 때리고, 스태거가 끝난 뒤 쿨다운을 지나 다시 노린다", () => {
      const enemy: MiniEnemy = { mode: "windup", modeTimerMs: 120, attackCooldownMs: 0, strikes: 0 };

      const hit = resolveStaggerOnHit({ mode: enemy.mode });
      enemy.mode = hit.mode;
      enemy.modeTimerMs = hit.modeTimerMs;

      // 원래 선딜이 끝났을 시점을 지나도 타격은 발생하지 않는다.
      for (let frame = 0; frame < 8; frame += 1) stepFrame(enemy, 16);
      expect(enemy.strikes).toBe(0);
      expect(enemy.mode).toBe("stagger");
      expect(canActInMode(enemy.mode)).toBe(false);

      // 스태거 창이 끝나면 전투 복귀 + 쿨다운이 걸려 있다.
      for (let frame = 0; frame < 8; frame += 1) stepFrame(enemy, 16);
      expect(enemy.mode).toBe("combat");
      // 복귀 프레임 이후로도 몇 프레임 더 흘렀으니 정확한 값이 아니라 "거의 만땅"을 본다.
      expect(enemy.attackCooldownMs).toBeGreaterThan(ATTACK.cooldownMs - 100);
      expect(enemy.strikes).toBe(0);

      // 쿨다운이 다 흐른 뒤에야 다음 선딜이 시작되고 타격이 나온다.
      for (let frame = 0; frame < 200; frame += 1) stepFrame(enemy, 16);
      expect(enemy.strikes).toBe(1);
    });
  });
});
