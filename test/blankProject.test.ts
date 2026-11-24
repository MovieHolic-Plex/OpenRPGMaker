import { describe, expect, it, vi } from "vitest";
import { battlerSkillIdsWithGrants } from "@/battle/battleSkillUse";
import { resolveRetroClassChoreography, resolveRetroMonsterChoreography } from "@/assets/retroSkillCatalog";
import { createBattleRuntime, exploitBonusPercent } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord, normalizeStateRecord, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { skillHelpTags } from "@/battle/skillHelp";
import { deserialize, serialize } from "@/project/io/serialize";
import type { SkillRecord } from "@/project/types";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import type { BattleFlow, BattleRuntimeOptions } from "@/battle/types";
import { resolveBattlerAuras, resolveStateAura } from "@/assets/battleStateAuras";
import { runTool } from "@/editor/tools";
import { normalizeBattleBackdropLayers, resolvedBattleBackdropLayer } from "@/project/battleBackdropLayers";
import { cellTransformFields, normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeDisplayFilter } from "@/project/displayFilter";
import { normalizeEnemyCollapseEffect } from "@/project/enemyCollapse";
import { automaticCharacterScale, characterRenderScale, mapCharacterScale } from "@/project/characterScale";
import { syncPlayerCharacterScale } from "@/player/playerCharacterScale";
import { eventSpriteScale, isCharsetSpriteTexture, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { store } from "@/project/store";
import { compileCutscene } from "@/editor/cutscene";
import { isolateTimers } from "./mergedTeardown";

describe("battleChoreographyAuditRegressions", () => {
  isolateTimers();
  describe("battle choreography audit identity", () => {
    it("keeps own class and monster contracts ahead of cross-kind borrowed fields", () => {
      const actor = { id: "skill_ranger_snipe", retroChoreographyId: "skill_mon_acid_spit" };
      const monster = { id: "skill_mon_acid_spit", retroChoreographyId: "skill_ranger_snipe" };
      expect(resolveRetroClassChoreography(actor)?.id).toBe(actor.id);
      expect(resolveRetroMonsterChoreography(actor)).toBeUndefined();
      expect(resolveRetroMonsterChoreography(monster)?.id).toBe(monster.id);
      expect(resolveRetroClassChoreography(monster)).toBeUndefined();
    });

    it("borrows either kind for a custom ID", () => {
      expect(resolveRetroClassChoreography({ id: "custom", retroChoreographyId: "skill_gunner_snipe" })?.id).toBe("skill_gunner_snipe");
      expect(resolveRetroMonsterChoreography({ id: "custom", retroChoreographyId: "skill_mon_acid_spit" })?.id).toBe("skill_mon_acid_spit");
    });

    it("keeps exact equipped skill identity when the actor owns another skill with the same name", () => {
      const project = createBlankProject();
      const actor = project.database.actors.find(row => row.id === "actor_ranger")!;
      const troop = project.database.troops[0]!;
      const enemy = project.database.enemies.find(row => row.id === troop.enemyIds[0])!;
      const charm = project.database.equipment.find(row => row.id === "equip_focus_charm")!;
      actor.initialEquipment = { accessory: charm.id };
      actor.parameterCurves.maxMp = Array(99).fill(100);
      actor.parameterCurves.agility = Array(99).fill(999);
      charm.grantsSkillIds = ["skill_gunner_snipe"];
      enemy.stats.maxHp = 9999;
      enemy.stats.agility = 1;
      enemy.actions = [];
      troop.enemyIds = [enemy.id];
      troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
      troop.battleEventPages = [];
      const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { partyActorIds: [actor.id], levels: { [actor.id]: 22 }, experience: {} } });
      expect(runtime.snapshot().actors[0]!.skillIds).toContain("skill_ranger_snipe");
      // 장비가 준 기술은 스냅샷 skillIds 가 아니라 equipmentEffects.grantedSkillIds 에 실린다 — 메뉴와 같은 합(battlerSkillIdsWithGrants)으로 본다.
      expect(battlerSkillIdsWithGrants(runtime.snapshot().actors[0]!)).toContain("skill_gunner_snipe");
      runtime.performActorCommand({ kind: "skill", skillId: "skill_gunner_snipe", targetEnemyId: "enemy-1" });
      const fact = runtime.snapshot().timeline.find(row => row.kind === "damage" && row.userRecordId === actor.id)!;
      expect(fact).toMatchObject({ skillName: "저격", skillId: "skill_gunner_snipe" });
    });

    it("carries enemy special skill identity and command kind into its presentation fact", () => {
      const project = createBlankProject();
      const actor = project.database.actors[0]!;
      const troop = project.database.troops[0]!;
      const enemy = project.database.enemies.find(row => row.id === troop.enemyIds[0])!;
      const skill = normalizeSkillRecord({ id: "audit_scan", name: "Borrowed scan", scope: "enemy", effect: { kind: "scan" },
        retroChoreographyId: "skill_gunner_snipe", mpCost: { flat: 0, percentMax: 0 }, hitRate: 100, successRate: 100 });
      project.database.skills.push(skill);
      actor.parameterCurves.agility = Array(99).fill(1);
      enemy.stats.agility = 999;
      enemy.stats.maxHp = 9999;
      enemy.actions = [{ skillId: skill.id, priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      troop.enemyIds = [enemy.id];
      troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
      troop.battleEventPages = [];
      const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { partyActorIds: [actor.id], levels: { [actor.id]: 1 }, experience: {} } });
      runtime.performActorCommand({ kind: "defend" });
      expect(runtime.snapshot().timeline.find(row => row.kind === "special" && row.side === "enemy"))
        .toMatchObject({ skillId: skill.id, skillName: skill.name, commandKind: "enemySkill", targetId: actor.id });
    });
  });
});

describe("battleExploitTierBonus", () => {
  isolateTimers();
  const MARKS = ["tier_mark_1", "tier_mark_2", "tier_mark_3"] as const;
  function setup() {
    const project = createBlankProject();
    project.system.battleModel = "rm2k3";
    project.system.atbSpeed = 4;
    const actor = project.database.actors[0]!;
    const enemy = project.database.enemies[0]!;
    const troop = project.database.troops.find((record) => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
    troop.enemyIds = [enemy.id];
    troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
    troop.battleEventPages = [];
    actor.initialEquipment = {};
    actor.learnedSkills = [];
    actor.parameterCurves.maxHp = Array(99).fill(500);
    actor.parameterCurves.agility = Array(99).fill(999);
    for (const klass of project.database.classes) klass.learnedSkills = [];
    enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 1, defense: 20, mind: 20, agility: 1 };
    enemy.actions = [];
    MARKS.forEach((id, index) => {
      project.database.states.push(normalizeStateRecord({ id, name: id, recoverNaturallyChance: 0, recoverWhenHitChance: 0, emotion: { family: "tier_mark", tier: index + 1 } }));
      enemy.stateRates[id] = "A";
    });
    const skill = (extra: Partial<SkillRecord>, id = "finisher") => {
      const record = normalizeSkillRecord({ id, name: id, scope: "enemy", power: 10, damageFormula: "100",
        mpCost: { flat: 0, percentMax: 0 }, variance: 0, criticalRate: 0, hitRate: 100, successRate: 100,
        effect: { kind: "damage", statistic: "attack", affects: "hp" }, ...extra });
      project.database.skills.push(record);
      return record;
    };
    /** marks 번 표식을 실제 기술로 새긴 뒤 마무리기를 쓴다. 마무리기 피해와 끝난 뒤 대상 상태를 돌려준다. */
    let mark: SkillRecord | undefined;
    const strike = (finisherId: string, marks: number) => {
      mark ??= skill({ damageFormula: undefined, effect: { kind: "support" }, stateEffects: [{ stateId: MARKS[0], chance: 100, operation: "add" }] }, "mark");
      const runtime = createBattleRuntime({
        project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: [mark!.id, finisherId] } },
      });
      for (let i = 0; i < marks; i += 1) runtime.performActorCommand({ kind: "skill", skillId: mark!.id, targetEnemyId: "enemy-1" });
      const before = runtime.snapshot().timeline.length;
      runtime.performActorCommand({ kind: "skill", skillId: finisherId, targetEnemyId: "enemy-1" });
      const hit = runtime.snapshot().timeline.slice(before).find((entry) => entry.kind === "damage" && entry.userRecordId === actor.id && entry.targetId === "enemy-1");
      return { amount: hit?.amount ?? 0, exploit: Boolean(hit?.exploit), statesAfter: runtime.snapshot().enemies[0]!.stateIds };
    };
    return { project, skill, strike };
  }
  describe("exploitStates.bonusByState (tiered set-up → payoff)", () => {
    it("uses the largest per-state bonus among the matched states, falling back to bonusPercent", () => {
      const exploit = { stateIds: [...MARKS], bonusPercent: 10, bonusByState: { tier_mark_1: 25, tier_mark_2: 50, tier_mark_3: 75 } };
      expect(exploitBonusPercent(exploit, ["tier_mark_1"])).toBe(25);
      expect(exploitBonusPercent(exploit, ["tier_mark_2"])).toBe(50);
      expect(exploitBonusPercent(exploit, ["tier_mark_1", "tier_mark_3"])).toBe(75);
      expect(exploitBonusPercent({ stateIds: ["a", "b"], bonusPercent: 40, bonusByState: { a: 10 } }, ["b"])).toBe(40);
      expect(exploitBonusPercent({ stateIds: ["a"], bonusPercent: 50 }, ["a"])).toBe(50);
    });

    it("in battle, each mark tier gives its own bonus and the finisher consumes it in the same action", () => {
      const tiered = setup();
      tiered.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } } });
      const none = tiered.strike("finisher", 0);
      const one = tiered.strike("finisher", 1);
      const two = tiered.strike("finisher", 2);
      const three = tiered.strike("finisher", 3);
      expect(none.exploit).toBe(false);
      expect([one, two, three].every((row) => row.exploit)).toBe(true);
      expect(one.amount / none.amount).toBeCloseTo(1.25, 1);
      expect(two.amount / none.amount).toBeCloseTo(1.5, 1);
      expect(three.amount / none.amount).toBeCloseTo(1.75, 1);
      for (const row of [one, two, three]) expect(row.statesAfter.some((id) => (MARKS as readonly string[]).includes(id))).toBe(false);
    });

    it("without bonusByState every matched state gives bonusPercent (existing skills unchanged)", () => {
      const plain = setup();
      plain.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25 } });
      const none = plain.strike("finisher", 0);
      const three = plain.strike("finisher", 3);
      expect(three.amount / none.amount).toBeCloseTo(1.25, 1);
      expect(three.statesAfter).toContain("tier_mark_3");
    });

    it("normalizes the table: keeps only listed states, clamps 1..300, drops an empty table", () => {
      const record = normalizeSkillRecord({ id: "s", name: "s", scope: "enemy",
        exploitStates: { stateIds: ["a", "b"], bonusPercent: 50, bonusByState: { a: 999, b: 0, c: 30 } as Record<string, number> } } as never);
      expect(record.exploitStates).toEqual({ stateIds: ["a", "b"], bonusPercent: 50, bonusByState: { a: 300 } });
      const plain = normalizeSkillRecord({ id: "p", name: "p", scope: "enemy", exploitStates: { stateIds: ["a"], bonusPercent: 50, consume: true } } as never);
      expect(plain.exploitStates).toEqual({ stateIds: ["a"], bonusPercent: 50, consume: true });
    });

    it("round-trips through save and load", () => {
      const s = setup();
      s.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } } });
      const loaded = deserialize(serialize(s.project));
      expect(loaded.database.skills.find((skill) => skill.id === "finisher")!.exploitStates)
        .toEqual({ stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } });
    });

    it("help text lists each tier", () => {
      const s = setup();
      const skill = s.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } } });
      const tags = skillHelpTags(s.project, skill).join(" ");
      expect(tags).toContain("tier_mark_1 +25%");
      expect(tags).toContain("tier_mark_2 +50%");
      expect(tags).toContain("tier_mark_3 +75%");
    });
  });
});

describe("battleRulesAdversarialRegression", () => {
  isolateTimers();
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
});

describe("battleStaging", () => {
  isolateTimers();
  describe("적 쓰러짐 연출", () => {
    it("기본(dissolve)·모르는 값은 저장하지 않는다", () => {
      expect(normalizeEnemyCollapseEffect("pixelBreak")).toBe("pixelBreak");
      expect(normalizeEnemyCollapseEffect("dissolve")).toBeUndefined();
      expect(normalizeEnemyCollapseEffect("explode")).toBeUndefined();
      const record = normalizeEnemyRecord({ id: "e", name: "보스", collapseEffect: "bossSink" });
      expect(record.collapseEffect).toBe("bossSink");
      expect("collapseEffect" in normalizeEnemyRecord({ id: "e", name: "잡몹" })).toBe(false);
    });

    it("upsert_enemy 가 collapseEffect 를 받아 저장하고 dissolve 로 되돌린다", () => {
      const ctx = { project: createBlankProject() };
      const set = runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_boss_fx", name: "마왕", collapseEffect: "bossSink" } });
      expect(set.ok, JSON.stringify(set.issues)).toBe(true);
      expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_boss_fx")?.collapseEffect).toBe("bossSink");
      runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_boss_fx", name: "마왕", collapseEffect: "dissolve" } });
      expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_boss_fx")?.collapseEffect).toBeUndefined();
    });
  });
  describe("전투 배경 겹", () => {
    it("프리셋도 그림도 없는 겹은 버리고, 최대 4겹·범위로 자른다", () => {
      const layers = normalizeBattleBackdropLayers([
        { preset: "fog" },
        { front: true },
        { preset: "rain", scrollY: 99999, opacity: 140, blendMode: "normal" },
        { resourceId: "  my-clouds  ", front: true, blendMode: "screen" },
        { preset: "snow" },
        { preset: "stars" },
      ]);
      expect(layers).toEqual([
        { preset: "fog" },
        { preset: "rain", scrollY: 1200, opacity: 100 },
        { resourceId: "my-clouds", front: true, blendMode: "screen" },
        { preset: "snow" },
      ]);
      expect(normalizeBattleBackdropLayers([{ preset: "lava" }])).toBeUndefined();
    });

    it("값을 주지 않으면 프리셋 기본값으로 그리고, 그림 겹은 정지·불투명", () => {
      expect(resolvedBattleBackdropLayer({ preset: "embers" })).toEqual({ scrollX: 8, scrollY: -50, opacity: 85, blendMode: "add" });
      expect(resolvedBattleBackdropLayer({ preset: "fog", opacity: 30 }).opacity).toBe(30);
      expect(resolvedBattleBackdropLayer({ resourceId: "x", preset: "rain" })).toEqual({ scrollX: 0, scrollY: 0, opacity: 100, blendMode: "normal" });
    });

    it("트룹 정규화가 겹을 보존하고, upsert_troop 이 받는다", () => {
      const troop = normalizeTroopRecord({ id: "t", name: "동굴", enemyIds: [], backdropLayers: [{ preset: "mist", front: true, opacity: 40 }] });
      expect(troop.backdropLayers).toEqual([{ preset: "mist", front: true, opacity: 40 }]);
      const ctx = { project: createBlankProject() };
      // upsert_enemy 는 이름에 확실히 맞는 외형이 없으면 거절한다(monster-graphic-required) — 외형을 명시한다.
      runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_fx", name: "까마귀", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 30, attack: 10 } } });
      const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_fx", name: "폭풍 전야", enemyIds: ["enemy_fx"], backdropLayers: [{ preset: "rain" }, { preset: "fog", front: true, opacity: 35 }] } });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.database.troops.find((entry) => entry.id === "troop_fx")?.backdropLayers).toHaveLength(2);
    });

    it("members 만 준 새 트룹도 받는다(enemyIds 는 members 에서)", () => {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_fx", name: "까마귀", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 30, attack: 10 } } });
      const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_members", name: "배치만", members: [{ enemyId: "enemy_fx", x: 120, y: 140 }, { enemyId: "enemy_fx", x: 200, y: 150 }] } });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.database.troops.find((entry) => entry.id === "troop_members")?.enemyIds).toEqual(["enemy_fx", "enemy_fx"]);
    });
  });
  describe("상태 오라", () => {
    it("수면·마비·침묵·혼란·매혹·화상이 기본 상태 id 로 자동", () => {
      expect(resolveStateAura("state_sleep")).toBe("sleep-zzz");
      expect(resolveStateAura("state_paralysis")).toBe("paralyze-spark");
      expect(resolveStateAura("state_silence")).toBe("silence-mute");
      expect(resolveStateAura("state_confuse")).toBe("confuse-stars");
      expect(resolveStateAura("state_charm")).toBe("charm-heart");
      expect(resolveStateAura("state_burn")).toBe("burn-ember");
    });

    it("몬스터 주 상태는 id 와 무관하게 의미로 고르고, 저자 지정·none 이 앞선다", () => {
      expect(resolveStateAura("st_gen1_slp", { gen1MajorStatus: "sleep" })).toBe("sleep-zzz");
      expect(resolveStateAura("st_gen1_brn", { gen1MajorStatus: "burn", battleAura: "none" })).toBeNull();
      expect(resolveStateAura("state_sleep", { battleAura: "charm-heart" })).toBe("charm-heart");
      expect(resolveBattlerAuras(["st_x"], [{ id: "st_x", gen1MajorStatus: "paralysis" }])).toEqual(["paralyze-spark"]);
    });
  });
  describe("전투 이펙트 셀 회전·뒤집기·겹치기", () => {
    it("기본값(0·false)은 저장하지 않고, 회전은 -360~360 정수", () => {
      expect(cellTransformFields({ rotation: 0, mirror: false })).toEqual({});
      expect(cellTransformFields({ rotation: 721.4, mirror: true })).toEqual({ rotation: 360, mirror: true });
      const record = normalizeBattleAnimationRecord({
        id: "a", name: "베기", blendMode: "add",
        frames: [{ cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true, rotation: 45, mirror: true }] }],
      });
      expect(record.blendMode).toBe("add");
      expect(record.frames?.[0]?.cells[0]).toMatchObject({ rotation: 45, mirror: true });
      expect("blendMode" in normalizeBattleAnimationRecord({ id: "b", name: "b", blendMode: "normal" as never })).toBe(false);
    });

    it("upsert_battle_animation 이 blendMode 를 걸고 normal 로 걷는다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "upsert_battle_animation", { animation: { id: "anim_fx", name: "번개", blendMode: "add" } }).ok).toBe(true);
      expect(ctx.project.database.battleAnimations.find((entry) => entry.id === "anim_fx")?.blendMode).toBe("add");
      runTool(ctx, "upsert_battle_animation", { animation: { id: "anim_fx", name: "번개", blendMode: "normal" } });
      expect(ctx.project.database.battleAnimations.find((entry) => entry.id === "anim_fx")?.blendMode).toBeUndefined();
    });
  });
  describe("화면 필터", () => {
    it("none·모르는 값은 저장하지 않고, set_project_settings 가 켜고 끈다", () => {
      expect(normalizeDisplayFilter("crt")).toBe("crt");
      expect(normalizeDisplayFilter("none")).toBeUndefined();
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "set_project_settings", { displayFilter: "scanlines" }).ok).toBe(true);
      expect(ctx.project.system.displayFilter).toBe("scanlines");
      runTool(ctx, "set_project_settings", { displayFilter: "none" });
      expect(ctx.project.system.displayFilter).toBeUndefined();
      expect(runTool(ctx, "set_project_settings", { displayFilter: "vhs" }).ok).toBe(false);
    });
  });
  describe("연출 지침", () => {
    it("전투 연출 절이 새 칸을 모두 안내한다", () => {
      const text = JSON.stringify(runTool({ project: createBlankProject() }, "read_directing_guide", {}));
      for (const word of ["collapseEffect", "backdropLayers", "battleAura", "blendMode", "displayFilter"]) expect(text).toContain(word);
    });
  });
});

describe("characterScale", () => {
  isolateTimers();
  describe("automatic walking-character scale", () => {
    it("uses the requested middle size for the 24px frame on a 48px map", () => {
      expect([16, 32, 48].map(size => automaticCharacterScale(24, size))).toEqual([1, 1, 2]);
      expect(automaticCharacterScale(48, 48)).toBe(1);
      expect(automaticCharacterScale(16, 48)).toBe(3);
      expect(automaticCharacterScale(32, 48)).toBe(1); // no uneven 1.5x pixels
      expect(automaticCharacterScale(96, 48)).toBe(1); // large authored art isn't shrunk
      expect(automaticCharacterScale(0, 48)).toBe(1);
    });

    it("preserves legacy/manual scales, including 1x, and separates the auto body multiplier", () => {
      expect(characterRenderScale(24, 48)).toBe(2);
      expect(characterRenderScale(24, 48, { scale: 1 })).toBe(1);
      expect(characterRenderScale(24, 48, { scale: 1, scaleMode: "manual" })).toBe(1);
      expect(characterRenderScale(24, 48, { scale: 1.5 })).toBe(1.5);
      expect(characterRenderScale(24, 48, { scale: 3, scaleMode: "auto" })).toBe(6);
      expect(characterRenderScale(24, 48, { scale: 8, scaleMode: "auto" })).toBe(8);
    });

    it("refreshes after map/graphic changes without overwriting an in-progress squash", () => {
      const project = createBlankProject();
      const map = { ...project.maps[project.startMapId]!, tileSize: 48 };
      // Single-size project: the store's maps object is replaced on every edit, so hand out a fresh one.
      vi.spyOn(store, "getCurrent").mockImplementation(() => ({ ...project, maps: { [map.id]: { ...map } } }));
      const player = { width: 24, setScale: vi.fn() };
      syncPlayerCharacterScale({ map, player });
      syncPlayerCharacterScale({ map, player });
      expect(player.setScale.mock.calls).toEqual([[2]]);
      map.tileSize = 16;
      syncPlayerCharacterScale({ map, player });
      map.tileSize = 48;
      syncPlayerCharacterScale({ map, player });
      player.width = 48;
      syncPlayerCharacterScale({ map, player });
      expect(player.setScale.mock.calls).toEqual([[2], [1], [2], [1]]);
      vi.restoreAllMocks();
    });

    it("keeps the reference-cell fit on maps whose cell differs, so the on-screen size holds", () => {
      // 16px project with one 32px map: fit on 16 (1x), then x2 in 32px world pixels.
      expect(mapCharacterScale(24, 32, 16)).toBe(2);
      expect(mapCharacterScale(24, 48, 16)).toBe(3);
      // 32px project visiting a 16px map: 1x on 32, half in 16px world pixels (camera zooms x2).
      expect(mapCharacterScale(24, 16, 32)).toBe(0.5);
      // Same cell as the reference is exactly the old rule.
      expect([16, 32, 48].map(size => mapCharacterScale(24, size))).toEqual([1, 1, 2]);
      expect(characterRenderScale(24, 32, undefined, 16)).toBe(2);
      expect(characterRenderScale(24, 32, { scale: 1, scaleMode: "manual" }, 16)).toBe(1); // manual stays absolute
      expect(characterRenderScale(24, 32, { scale: 2, scaleMode: "auto" }, 16)).toBe(4);
    });

    it("applies the same rule to charset NPCs/followers, leaving props and fitted monsters alone", () => {
      const project = createBlankProject();
      const charset = resolveEventSpriteTexture(project, "tex_easyrpg_charset_actor1", 0);
      expect(isCharsetSpriteTexture(charset)).toBe(true);
      expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 48)).toBe(2);
      expect(eventSpriteScale(charset, { width: 24, height: 32 }, 1, 48)).toBe(1);
      expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 48)).toBe(1);
      expect(eventSpriteScale({ texture: "monster", frame: 0, fitSize: 32 }, { width: 384, height: 192 }, 2, 48)).toBe(1 / 6);
      expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 32, undefined, 16)).toBe(2);
      expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 32, undefined, 16)).toBe(1);
    });
  });
});

describe("cutsceneShakeIntensity", () => {
  isolateTimers();
  describe("컷신 shake beat", () => {
    it("script_cutscene 이 shake beat 를 명령 형식 오류 없이 받는다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene", {
        mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true,
        beats: [{ kind: "fade", direction: "in", durationMs: 800 }, { kind: "shake", durationMs: 500 }, { kind: "say", speaker: "탐정", text: "비명이다!" }],
      });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    });

    it("intensity 숫자는 선택지 문자열로 맞추고 런타임 value 도 채운다", () => {
      const project = createBlankProject();
      const commands = compileCutscene([{ kind: "shake", intensity: 7 }], { project } as never) as unknown as { kind: string; fields?: Record<string, unknown> }[];
      const shake = JSON.stringify(commands);
      expect(shake).toContain('"intensity":"6"');
      expect(shake).toContain('"value":6');
    });
  });
});

describe("equipmentStatBonusSave", () => {
  isolateTimers();
  describe("equipment stat penalties survive project save", () => {
    it("keeps a negative agility penalty through normalize and a save round trip", () => {
      const heavy = normalizeEquipmentRecord({
        id: "equip_heavy_spear",
        name: "무거운 창",
        slot: "weapon",
        statBonuses: { attack: 22, defense: 0, mind: -4, agility: -3 },
      });
      expect(heavy.statBonuses).toEqual({ attack: 22, defense: 0, mind: -4, agility: -3 });

      const clamped = normalizeEquipmentRecord({
        id: "equip_clamp",
        name: "한계",
        slot: "weapon",
        statBonuses: { attack: 99_999, defense: -99_999, mind: 1.8, agility: -1.2 },
      });
      expect(clamped.statBonuses).toEqual({ attack: 9999, defense: -9999, mind: 1, agility: -1 });

      const project = createBlankProject();
      project.database.equipment.push(heavy);
      const loaded = deserialize(serialize(project));
      expect(loaded.database.equipment.find((row) => row.id === "equip_heavy_spear")?.statBonuses).toEqual({
        attack: 22,
        defense: 0,
        mind: -4,
        agility: -3,
      });
    });
  });
});
