import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import type { BattleFlow, BattleRuntimeOptions } from "@/battle/types";
import type { SkillRecord } from "@/project/types";

function setup() {
  const project = createBlankProject();
  project.system.battleModel = "rm2k3";
  project.system.battleUiStyle = "retro2003";
  project.system.atbSpeed = 4;
  const actor = project.database.actors[0]!;
  const enemy = project.database.enemies[0]!;
  const troop = project.database.troops.find(record => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
  troop.enemyIds = [enemy.id];
  troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
  troop.battleEventPages = [];
  actor.initialEquipment = {};
  actor.learnedSkills = [];
  actor.parameterCurves.maxHp = Array(99).fill(500);
  actor.parameterCurves.maxMp = Array(99).fill(100);
  actor.parameterCurves.agility = Array(99).fill(999);
  for (const klass of project.database.classes) klass.learnedSkills = [];
  enemy.stats = { ...enemy.stats, maxHp: 9999, maxMp: 100, attack: 1, defense: 20, mind: 20, agility: 1 };
  enemy.actions = [];
  const start = (flow: BattleFlow = "strict", party: BattleRuntimeOptions["party"] = {}) => createBattleRuntime({
    project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: flow, rng: () => 0.5,
    party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], ...party },
  });
  const skill = (id: string, extra: Partial<SkillRecord> = {}) => {
    const record = normalizeSkillRecord({ id, name: id, scope: "enemy", power: 10, damageFormula: "10",
      mpCost: { flat: 0, percentMax: 0 }, variance: 0, criticalRate: 0, hitRate: 100, successRate: 100,
      effect: { kind: "damage", statistic: "attack", affects: "hp" }, ...extra });
    project.database.skills.push(record);
    return record;
  };
  const enemyAction = (skillId: string) => {
    enemy.actions = [{ skillId, priority: 50, condition: { kind: "always" },
      switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  };
  return { project, actor, enemy, troop, start, skill, enemyAction };
}

function hits(runtime: ReturnType<typeof createBattleRuntime>, userId: string, targetId: string) {
  return runtime.snapshot().timeline.filter(entry => entry.kind === "damage" && entry.userRecordId === userId && entry.targetId === targetId);
}

describe("battle rules adversarial regression R1–R5", () => {
  it.each(["restrictsAction", "freezesGauge"] as const)("R1: a queued attack is skipped after a faster enemy applies %s", restriction => {
    const s = setup();
    s.actor.parameterCurves.agility = Array(99).fill(1);
    s.enemy.stats.agility = 999;
    s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Audit stop",
      runtimeEffects: { [restriction]: true, removeOnBattleEnd: false }, recoverNaturallyChance: 0 }));
    const stop = s.skill("stop", { damageFormula: undefined, effect: { kind: "support" },
      stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
    s.enemyAction(stop.id);
    const runtime = s.start();
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const round = runtime.snapshot().roundLogs[0]!;
    expect(round.timeline.some(entry => entry.kind === "stateAdded" && entry.targetId === s.actor.id)).toBe(true);
    expect(round.timeline.some(entry => entry.kind === "incapacitated" && entry.userRecordId === s.actor.id)).toBe(true);
    expect(hits(runtime, s.actor.id, "enemy-1")).toHaveLength(0);
  });

  it("R1: an invalidated queued skill consumes neither MP nor HP", () => {
    const s = setup();
    s.actor.parameterCurves.agility = Array(99).fill(1);
    s.enemy.stats.agility = 999;
    s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
      runtimeEffects: { restrictsAction: true, removeOnBattleEnd: false }, recoverNaturallyChance: 0 }));
    const stop = s.skill("stop", { damageFormula: undefined, effect: { kind: "support" },
      stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
    const queued = s.skill("queued", { mpCost: { flat: 25, percentMax: 0 }, hpCostPercent: 50 });
    s.enemyAction(stop.id);
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [queued.id] } });
    runtime.performActorCommand({ kind: "skill", skillId: queued.id, targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().actors[0]).toMatchObject({ hp: 500, mp: 100 });
    expect(hits(runtime, s.actor.id, "enemy-1")).toHaveLength(0);
  });

  it("R1: a faster actor also invalidates an enemy's queued attack", () => {
    const s = setup();
    s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
      runtimeEffects: { restrictsAction: true }, recoverNaturallyChance: 0 }));
    s.enemy.stateRates.audit_stop = "A";
    const stop = s.skill("stop", { damageFormula: undefined, effect: { kind: "support" },
      stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [stop.id] } });
    runtime.performActorCommand({ kind: "skill", skillId: stop.id, targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().actors[0]!.hp).toBe(500);
    expect(runtime.snapshot().roundLogs[0]!.timeline.some(entry => entry.kind === "incapacitated" && entry.side === "enemy")).toBe(true);
  });

  it.each(["wait", "active"] as const)("R2: %s ATB recovers an entirely frozen battle at the same simulation time for different tick partitions", mode => {
    const s = setup();
    s.project.system.atbMode = mode;
    s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
      runtimeEffects: { freezesGauge: true, removeOnBattleEnd: false }, recoverNaturallyFromTurn: 2, recoverNaturallyChance: 100 }));
    const stop = s.skill("self_stop", { scope: "self", damageFormula: undefined, effect: { kind: "support" },
      stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
    s.enemy.stateRates.audit_stop = "A";
    s.enemyAction(stop.id);
    const create = () => {
      const runtime = s.start("gauge", { stateIds: { [s.actor.id]: ["audit_stop"] } });
      runtime.tick(100000); // The only unfrozen battler freezes itself; cycle 1 closes.
      expect(runtime.snapshot().turn).toBe(1);
      return runtime;
    };
    const whole = create();
    const pieces = create();
    whole.tick(999);
    for (let i = 0; i < 999; i++) pieces.tick(1);
    expect(whole.snapshot().actors[0]!.stateTurns.audit_stop).toBe(1);
    expect(pieces.snapshot().actors[0]!.stateTurns.audit_stop).toBe(1);
    whole.tick(1);
    pieces.tick(1);
    expect(pieces.snapshot()).toEqual(whole.snapshot());
    expect(whole.snapshot().turn).toBe(2);
    expect(whole.snapshot().actors[0]!.stateIds).not.toContain("audit_stop");
    expect(whole.snapshot().enemies[0]!.stateIds).not.toContain("audit_stop");
    whole.tick(100000);
    expect(whole.snapshot().phase).toBe("actorCommand");
  });

  it("R2: permanent all-stop reaches the existing stalemate cap", () => {
    const s = setup();
    s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
      runtimeEffects: { freezesGauge: true, removeOnBattleEnd: false }, recoverNaturallyChance: 0 }));
    const stop = s.skill("self_stop", { scope: "self", damageFormula: undefined, effect: { kind: "support" },
      stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
    s.enemyAction(stop.id);
    const runtime = s.start("gauge", { stateIds: { [s.actor.id]: ["audit_stop"] } });
    runtime.tick(100000);
    runtime.tick(1000000);
    expect(runtime.snapshot()).toMatchObject({ result: "escape", phase: "resolved", turn: 200 });
    expect(runtime.snapshot().timeline.some(entry => entry.kind === "stalemate")).toBe(true);
  });

  it.each([
    { scope: "allEnemies", pickedScope: "allEnemies" },
    { scope: "enemy", pickedScope: "allEnemies" },
    { scope: "enemy", pickedScope: "enemy" },
  ] as const)("R3: a $scope wrapper resolves one $pickedScope choice for two targets", ({ scope, pickedScope }) => {
    const s = setup();
    s.troop.enemyIds = [s.enemy.id, s.enemy.id];
    s.troop.members = [{ enemyId: s.enemy.id, x: 80, y: 80 }, { enemyId: s.enemy.id, x: 100, y: 80 }];
    const picked = s.skill("picked", { scope: pickedScope, area: { shape: "circle", radius: 200 }, mpCost: { flat: 50, percentMax: 0 } });
    const wrapper = s.skill("wrapper", { scope, area: scope === "enemy" ? { shape: "circle", radius: 200 } : undefined,
      effect: { kind: "randomSkillFrom", skillIds: [picked.id] },
      mpCost: { flat: 15, percentMax: 0 },
      inputSequence: { keys: ["confirm"], timeLimitMs: 1000, successMultiplier: 2 } });
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [wrapper.id] } });
    runtime.performActorCommand({ kind: "skill", skillId: wrapper.id, targetEnemyId: "enemy-1", inputResult: "success" });
    expect(hits(runtime, s.actor.id, "enemy-1").map(entry => entry.amount)).toEqual([20]);
    expect(hits(runtime, s.actor.id, "enemy-2").map(entry => entry.amount)).toEqual([20]);
    expect(runtime.snapshot().timeline.filter(entry => entry.kind === "special")).toHaveLength(1);
    expect(runtime.snapshot().actors[0]!.mp).toBe(85);
  });

  it("R3: an enemy all-enemies wrapper hits each actor once", () => {
    const s = setup();
    const other = s.project.database.actors[1]!;
    other.initialEquipment = {};
    other.parameterCurves.maxHp = Array(99).fill(500);
    other.parameterCurves.agility = Array(99).fill(1);
    s.actor.parameterCurves.agility = Array(99).fill(1);
    s.enemy.stats.agility = 999;
    const picked = s.skill("picked", { scope: "allEnemies" });
    const wrapper = s.skill("wrapper", { scope: "allEnemies", effect: { kind: "randomSkillFrom", skillIds: [picked.id] } });
    s.enemyAction(wrapper.id);
    const runtime = s.start("strict", { partyActorIds: [s.actor.id, other.id] });
    runtime.performActorCommand({ kind: "defend" });
    runtime.performActorCommand({ kind: "defend" });
    expect(hits(runtime, s.enemy.id, s.actor.id).map(entry => entry.amount)).toEqual([10]);
    expect(hits(runtime, s.enemy.id, other.id).map(entry => entry.amount)).toEqual([10]);
    expect(runtime.snapshot().timeline.filter(entry => entry.kind === "special")).toHaveLength(1);
  });

  it.each([
    { name: "HP cast cost", hp: 500, extra: { hpCostPercent: 50, damageFormula: "a.hp" }, expected: 250 },
    { name: "HP drain between hits", hp: 100, extra: { drainPercent: 50, damageFormula: "a.hp", hitSequence: [1, 1] }, expected: 250 },
    { name: "HP drain saturation", hp: 480, extra: { drainPercent: 50, damageFormula: "a.hp", hitSequence: [1, 1] }, expected: 980 },
    { name: "HP cost survival floor", hp: 500, extra: { hpCostPercent: 100, damageFormula: "a.hp" }, expected: 1 },
    { name: "MP drain between hits", hp: 500, extra: { drainPercent: 50, damageFormula: "a.mp", hitSequence: [1, 1], effect: { kind: "damage", statistic: "attack", affects: "mp" } }, expected: 25 },
  ] satisfies { name: string; hp: number; extra: Partial<SkillRecord>; expected: number }[])("R4: prediction follows $name and leaves snapshots unchanged", ({ hp, extra, expected }) => {
    const s = setup();
    const skill = s.skill("vitals", extra);
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [skill.id] }, vitals: { [s.actor.id]: { hp, mp: 10 } } });
    const before = runtime.snapshot();
    const saved = structuredClone(before);
    const prediction = predictSkillDamageFor(s.project, before.actors[0]!, skill, before.enemies[0]!);
    expect(before).toEqual(saved);
    runtime.performActorCommand({ kind: "skill", skillId: skill.id, targetEnemyId: "enemy-1" });
    expect(prediction.amount).toBe(expected);
    expect(hits(runtime, s.actor.id, "enemy-1").reduce((sum, entry) => sum + (entry.amount ?? 0), 0)).toBe(expected);
  });

  it("R4: self multi-hit drain uses the same caster and target clone", () => {
    const s = setup();
    const skill = s.skill("self_drain", { scope: "self", drainPercent: 50, damageFormula: "a.hp / 4", hitSequence: [1, 1] });
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [skill.id] }, vitals: { [s.actor.id]: { hp: 100, mp: 100 } } });
    const before = runtime.snapshot();
    expect(predictSkillDamageFor(s.project, before.actors[0]!, skill, before.actors[0]!).amount).toBe(47);
    runtime.performActorCommand({ kind: "skill", skillId: skill.id, targetActorId: s.actor.id });
    expect(hits(runtime, s.actor.id, s.actor.id).map(entry => entry.amount)).toEqual([25, 22]);
  });

  it.each(["attack", "mind"] as const)("R5: prediction applies %s defense and formula contexts", statistic => {
    const s = setup();
    s.actor.parameterCurves.attack = Array(99).fill(0);
    s.actor.parameterCurves.mind = Array(99).fill(0);
    s.project.database.states.push(normalizeStateRecord({ id: "protect", name: "Protect", runtimeEffects: {
      physicalDefenseMultiplier: statistic === "attack" ? 2.5 : 1,
      magicDefenseMultiplier: statistic === "mind" ? 2.5 : 1,
    } }));
    s.enemy.stateRates.protect = "A";
    const protect = s.skill("protect_skill", { scope: "self", damageFormula: undefined, effect: { kind: "support" },
      stateEffects: [{ stateId: "protect", chance: 100, operation: "add" }] });
    s.enemyAction(protect.id);
    s.actor.parameterCurves.agility = Array(99).fill(1);
    s.enemy.stats.agility = 999;
    const damage = s.skill("test_damage", { power: 100, damageFormula: undefined, effect: { kind: "damage", statistic, affects: "hp" } });
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [damage.id] } });
    runtime.performActorCommand({ kind: "defend" }); // Enemy applies protection before next preview.
    const snapshot = runtime.snapshot();
    const predicted = predictSkillDamageFor(s.project, snapshot.actors[0]!, damage, snapshot.enemies[0]!);
    runtime.performActorCommand({ kind: "skill", skillId: damage.id, targetEnemyId: "enemy-1" });
    expect(predicted.amount).toBe(75);
    expect(hits(runtime, s.actor.id, "enemy-1")[0]!.amount).toBe(75);
    damage.damageFormula = statistic === "attack" ? "100 - b.def" : "100 - b.mind";
    const next = runtime.snapshot();
    expect(predictSkillDamageFor(s.project, next.actors[0]!, damage, next.enemies[0]!).amount).toBe(50);
    runtime.performActorCommand({ kind: "skill", skillId: damage.id, targetEnemyId: "enemy-1" });
    expect(hits(runtime, s.actor.id, "enemy-1")[1]!.amount).toBe(50);
  });

  it("R5: a guaranteed first-hit element override affects the next hit and auto battle choice", () => {
    const s = setup();
    const element = s.project.database.elements![0]!;
    element.damageMultipliers = { A: 200, B: 150, C: 100, D: 50, E: 0 };
    s.enemy.elementRates[element.id] = "C";
    s.enemy.stateRates.wet = "A";
    s.project.database.states.push(normalizeStateRecord({ id: "wet", name: "Wet", runtimeEffects: { elementRates: { [element.id]: "A" } } }));
    const combo = s.skill("wet_combo", { damageFormula: "100", hitSequence: [1, 1], elementId: element.id,
      stateEffects: [{ stateId: "wet", chance: 100, operation: "add" }] });
    const alternative = s.skill("alternative", { damageFormula: "250" });
    const runtime = s.start("strict", { skillIds: { [s.actor.id]: [combo.id, alternative.id] } });
    const before = runtime.snapshot();
    const prediction = predictSkillDamageFor(s.project, before.actors[0]!, combo, before.enemies[0]!);
    expect(prediction.amount).toBe(300);
    expect(chooseAutoBattleCommand(s.project, before, () => 0.5)).toMatchObject({ kind: "skill", skillId: combo.id });
    runtime.performActorCommand({ kind: "skill", skillId: combo.id, targetEnemyId: "enemy-1" });
    expect(hits(runtime, s.actor.id, "enemy-1").map(entry => entry.amount)).toEqual([100, 200]);
  });

  it("R5: guaranteed emotion changes update the next hit's matchup", () => {
    const s = setup();
    s.project.database.states.push(
      normalizeStateRecord({ id: "joy", name: "Joy", emotion: { family: "joy", tier: 1 } }),
      normalizeStateRecord({ id: "anger", name: "Anger", emotion: { family: "anger", tier: 1 } }),
    );
    s.project.system.emotionCycle = [{ attackerFamily: "joy", targetFamily: "anger", multiplier: 2 }];
    s.enemy.stateRates.anger = "A";
    const skill = s.skill("emotion_combo", { damageFormula: "100", hitSequence: [1, 1],
      stateEffects: [{ stateId: "anger", chance: 100, operation: "add" }] });
    const runtime = s.start("strict", { stateIds: { [s.actor.id]: ["joy"] }, skillIds: { [s.actor.id]: [skill.id] } });
    const before = runtime.snapshot();
    expect(predictSkillDamageFor(s.project, before.actors[0]!, skill, before.enemies[0]!).amount).toBe(300);
    runtime.performActorCommand({ kind: "skill", skillId: skill.id, targetEnemyId: "enemy-1" });
    expect(hits(runtime, s.actor.id, "enemy-1").map(entry => entry.amount)).toEqual([100, 200]);
  });
});
