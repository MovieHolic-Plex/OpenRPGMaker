/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advanceSkillCharge,
  chargeTierMultiplier,
  createInputSequenceTracker,
  inputSequencePowerMultiplier,
  normalizeChargeTiers,
} from "@/battle/battleInputSequence";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { normalizeActionSkillProfile } from "@/project/actionCombat";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project, SkillInputSequence, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

const SEQUENCE: SkillInputSequence = { keys: ["up", "down", "confirm"], timeLimitMs: 2000, successMultiplier: 2, failMultiplier: 0.5 };

function projectWithInputSkill(): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  const skill: SkillRecord = {
    ...project.database.skills[0]!,
    id: "skill_input", name: "입력기", scope: "enemy", power: 1, damageFormula: "40",
    mpCost: { flat: 0, percentMax: 0 }, successRate: 100, hitRate: 100, variance: 0, criticalRate: 0,
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [], inputSequence: SEQUENCE,
  };
  delete (skill as Partial<SkillRecord>).hitSequence;
  project.database.skills.push(skill);
  project.database.actors[0]!.learnedSkills = [{ level: 1, skillId: "skill_input" }];
  project.database.enemies[0]!.stats = { ...project.database.enemies[0]!.stats, maxHp: 5000, defense: 0 };
  return project;
}

function runtimeFor(project: Project) {
  return createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
}

function untilActorCommand(runtime: ReturnType<typeof runtimeFor>): void {
  for (let index = 0; index < 200; index += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
  }
}

function lossAfter(inputResult: "success" | "fail" | undefined): number {
  const project = projectWithInputSkill();
  const runtime = runtimeFor(project);
  untilActorCommand(runtime);
  const enemy = runtime.snapshot().enemies[0]!;
  runtime.performActorCommand({ kind: "skill", skillId: "skill_input", targetEnemyId: enemy.id, ...(inputResult ? { inputResult } : {}) });
  return enemy.hp - runtime.snapshot().enemies.find((entry) => entry.id === enemy.id)!.hp;
}

describe("mg L4 input-command skills (#4)", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("tracker succeeds only on the exact order within the time limit", () => {
    const ok = createInputSequenceTracker(SEQUENCE, 0);
    expect(ok.press("up", 100)).toBe("pending");
    expect(ok.press("down", 200)).toBe("pending");
    expect(ok.press("confirm", 300)).toBe("success");
    const wrong = createInputSequenceTracker(SEQUENCE, 0);
    wrong.press("up", 100);
    expect(wrong.press("left", 200)).toBe("fail");
    const late = createInputSequenceTracker(SEQUENCE, 0);
    late.press("up", 100);
    expect(late.press("down", 2500)).toBe("fail");
    expect(createInputSequenceTracker(SEQUENCE, 0).expire(2000)).toBe("fail");
    expect(inputSequencePowerMultiplier(SEQUENCE, undefined)).toBe(1);
  });

  it("runtime scales skill damage by the input result; no result keeps legacy power", () => {
    const neutral = lossAfter(undefined);
    const success = lossAfter("success");
    const fail = lossAfter("fail");
    expect(neutral).toBeGreaterThan(0);
    expect(success).toBe(neutral * 2);
    expect(fail).toBe(Math.round(neutral * 0.5));
  });

  it("battle DOM shows the input prompt after target selection and sends the judged command", () => {
    vi.useFakeTimers();
    const project = projectWithInputSkill();
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = runtimeFor(project);
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    try {
      untilActorCommand(runtime);
      vi.advanceTimersByTime(250);
      runtime.beginActorCommand({ kind: "skill", skillId: "skill_input" });
      expect(runtime.snapshot().phase).toBe("targetSelect");
      vi.advanceTimersByTime(250);
      const hpBefore = runtime.snapshot().enemies[0]!.hp;
      const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      press("Enter");
      const prompt = controller.root.querySelector("[data-testid='battle-input-prompt']");
      expect(prompt).not.toBeNull();
      expect(prompt?.textContent).toContain("↑↓Z");
      expect(runtime.snapshot().enemies[0]!.hp).toBe(hpBefore);
      press("ArrowUp");
      press("ArrowDown");
      press("z");
      expect(controller.root.querySelector("[data-testid='battle-input-prompt']")).toBeNull();
      const loss = hpBefore - runtime.snapshot().enemies[0]!.hp;
      expect(loss).toBe(lossAfter("success"));
    } finally {
      controller.destroy();
    }
  });

  it("battle DOM prompt times out into a failed (weaker) command", () => {
    vi.useFakeTimers();
    const project = projectWithInputSkill();
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = runtimeFor(project);
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    try {
      untilActorCommand(runtime);
      vi.advanceTimersByTime(250);
      runtime.beginActorCommand({ kind: "skill", skillId: "skill_input" });
      vi.advanceTimersByTime(250);
      const hpBefore = runtime.snapshot().enemies[0]!.hp;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(controller.root.querySelector("[data-testid='battle-input-prompt']")).not.toBeNull();
      vi.advanceTimersByTime(SEQUENCE.timeLimitMs);
      expect(controller.root.querySelector("[data-testid='battle-input-prompt']")).toBeNull();
      expect(hpBefore - runtime.snapshot().enemies[0]!.hp).toBe(lossAfter("fail"));
    } finally {
      controller.destroy();
    }
  });

  it("inputSequence and chargeTiers survive save/load", () => {
    const project = projectWithInputSkill();
    const skill = project.database.skills.find((entry) => entry.id === "skill_input")!;
    skill.actionSkill = { kind: "projectile", damage: 10, range: 5, chargeTiers: [{ holdMs: 1200, multiplier: 3 }, { holdMs: 400, multiplier: 1.5 }] };
    const round = deserialize(serialize(project)).database.skills.find((entry) => entry.id === "skill_input")!;
    expect(round.inputSequence).toEqual(SEQUENCE);
    expect(round.actionSkill?.chargeTiers).toEqual([{ holdMs: 400, multiplier: 1.5 }, { holdMs: 1200, multiplier: 3 }]);
  });
});

describe("mg L4 action-combat hold charge tiers (#4)", () => {
  const tiers = normalizeChargeTiers([{ holdMs: 1000, multiplier: 3 }, { holdMs: 300, multiplier: 1.5 }])!;

  it("picks the highest tier reached, 1x below the first tier", () => {
    expect(chargeTierMultiplier(tiers, 0)).toBe(1);
    expect(chargeTierMultiplier(tiers, 299)).toBe(1);
    expect(chargeTierMultiplier(tiers, 300)).toBe(1.5);
    expect(chargeTierMultiplier(tiers, 5000)).toBe(3);
    expect(normalizeActionSkillProfile({ kind: "melee", damage: 5, range: 1 })?.chargeTiers).toBeUndefined();
  });

  it("accumulates while held and fires once on release with the reached multiplier", () => {
    const state: { heldMs?: number } = { heldMs: 0 };
    for (let frame = 0; frame < 30; frame += 1) expect(advanceSkillCharge(state, tiers, 1000 / 60, true)).toBeUndefined();
    expect(state.heldMs).toBeCloseTo(500, 5);
    expect(advanceSkillCharge(state, tiers, 1000 / 60, false)).toBe(1.5);
    expect(state.heldMs).toBeUndefined();
    expect(advanceSkillCharge(state, tiers, 1000 / 60, false)).toBeUndefined();
  });
});
