import { describe, expect, it } from "vitest";
import { createBattleRuntime, damageToMpRateForStates, escapeChance } from "@/battle/runtime";
import { normalizeStateRecord, normalizeSystemRecords, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { Project, SkillRecord, Command, GameMap, MonsterSpeciesRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { battleFormationChances, contactFormation, formationStartRow, rollBattleFormation } from "@/battle/battleFormation";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { battleSkillMpCost, battleSkillUseFailure } from "@/battle/battleSkillUse";
import { startSession, evalCondition, GOLD_MAX } from "@/project/session";
import { applyItemUpgrade } from "@/project/upgrades";
import { createBlankProject } from "@/project/defaults";
import { activeDifficultyId, difficultyRate, normalizeDifficulties } from "@/project/difficulty";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { applyCareItem, applyWalkCareTicks, resolveMonsterCare } from "@/project/monsterCare";
import { evolveMonster, giveMonster, moveMonster, applyMonsterExperienceAndEvolution, previewMonsterExperience, splitLearnedMonsterSkills, monsterBattleStats, monsterBattleStatsForSpecies, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { useItemFromMenu } from "@/player/playerItemUse";
import { totalExpForLevel } from "@/project/actorModel";
import { MONSTER_NATURES, addMonsterEvs, clampMonsterEvs, monsterEvYieldOf, monsterNatureEffectText, natureIdFromSeed } from "@/project/monsterStatRules";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import { contributeBundle } from "@/project/bundles";
import { isolateTimers } from "./mergedTeardown";

describe("mgL2BflowDamageToMp", () => {
  isolateTimers();
  function battleProject(rate?: number): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 9999, maxMp: 999, defense: 0 };
    if (rate !== undefined) {
      project.database.states.push(normalizeStateRecord({ id: "state_mana_shield", name: "마나 실드", runtimeEffects: { damageToMpRate: rate, removeOnBattleEnd: true } }));
    }
    return project;
  }
  /** 아군 통상 공격 한 번으로 적 HP/MP 가 얼마나 줄었는지. rng 0.5 = 분산 1.0·크리티컬 없음. */
  function hitSlime(project: Project): { hpLoss: number; mpLoss: number; reported: number } {
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    const enemy = runtime.snapshot().enemies[0]!;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot().enemies[0]!;
    const entry = runtime.snapshot().timeline.find((item) => item.kind === "damage" && item.side === "actor")!;
    return { hpLoss: enemy.hp - after.hp, mpLoss: enemy.mp - after.mp, reported: entry.amount ?? 0 };
  }
  describe("mg-l2-bflow #33 피해 MP 전환 상태", () => {
    it("비율을 합산해 1 로 자른다", () => {
      const project = battleProject(0.6);
      project.database.states.push(normalizeStateRecord({ id: "state_extra", name: "추가", runtimeEffects: { damageToMpRate: 0.7 } }));
      expect(damageToMpRateForStates(project, { stateIds: ["state_mana_shield"] })).toBe(0.6);
      expect(damageToMpRateForStates(project, { stateIds: ["state_mana_shield", "state_extra"] })).toBe(1);
      expect(damageToMpRateForStates(project, { stateIds: [] })).toBe(0);
    });

    it("damageToMpRate 0.5 상태의 배우는 적 통상 공격 피해의 절반을 MP 로 받는다", () => {
      const project = battleProject(0.5);
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, attack: 200, agility: 999 };
      const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      const shielded = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { stateIds: { actor_hero: ["state_mana_shield"] } } });
      const plainBefore = plain.snapshot().actors[0]!;
      const shieldBefore = shielded.snapshot().actors[0]!;
      plain.performActorCommand({ kind: "defend" });
      shielded.performActorCommand({ kind: "defend" });
      const plainAfter = plain.snapshot().actors[0]!;
      const shieldAfter = shielded.snapshot().actors[0]!;
      const total = plainBefore.hp - plainAfter.hp;
      expect(total).toBeGreaterThan(1);
      const hpLoss = shieldBefore.hp - shieldAfter.hp;
      const mpLoss = shieldBefore.mp - shieldAfter.mp;
      const expectedMp = Math.min(shieldBefore.mp, Math.floor(total * 0.5));
      expect(mpLoss).toBe(expectedMp);
      expect(hpLoss).toBe(total - expectedMp);
      // 타임라인 피해량은 실제 HP 감소와 같다.
      const entry = shielded.snapshot().timeline.find((item) => item.kind === "damage" && item.side === "enemy")!;
      expect(entry.amount).toBe(hpLoss);
    });

    it("MP 가 모자라면 남은 MP 만큼만 돌리고 나머지는 HP 로 받는다", () => {
      const project = battleProject(1);
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, attack: 200, agility: 999 };
      const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { vitals: { actor_hero: { hp: 9999, mp: 0 } } } });
      const shielded = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { vitals: { actor_hero: { hp: 9999, mp: 3 } }, stateIds: { actor_hero: ["state_mana_shield"] } } });
      const plainHp = plain.snapshot().actors[0]!.hp;
      const shieldHp = shielded.snapshot().actors[0]!.hp;
      expect(shieldHp).toBe(plainHp);
      expect(shielded.snapshot().actors[0]!.mp).toBe(3);
      plain.performActorCommand({ kind: "defend" });
      shielded.performActorCommand({ kind: "defend" });
      const total = plainHp - plain.snapshot().actors[0]!.hp;
      expect(shielded.snapshot().actors[0]!.mp).toBe(0);
      expect(shieldHp - shielded.snapshot().actors[0]!.hp).toBe(total - 3);
    });

    it("상태가 없으면 피해는 예전처럼 전부 HP 로 간다", () => {
      const project = battleProject();
      const result = hitSlime(project);
      expect(result.mpLoss).toBe(0);
      expect(result.hpLoss).toBe(result.reported);
    });

    it("damageToMpRate 는 저장·불러오기를 지난다", () => {
      const reloaded = deserialize(serialize(battleProject(0.25)));
      expect(reloaded.database.states.find((state) => state.id === "state_mana_shield")?.runtimeEffects?.damageToMpRate).toBe(0.25);
    });
  });
});

describe("mgL2BflowEscape", () => {
  isolateTimers();
  function battleProject(): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    // 민첩이 같으면 기본 도주 확률은 정확히 50%.
    slime.stats = { ...slime.stats, maxHp: 9999, attack: 1 };
    return project;
  }
  function heroAgility(project: Project): number {
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.99 });
    return runtime.snapshot().actors[0]!.effectiveStats!.agility;
  }
  describe("mg-l2-bflow #34 도주 실패 가산", () => {
    it("필드가 없으면 예전 식 그대로, 가산을 켜면 실패마다 붙고 100% 에서 멈춘다", () => {
      expect(escapeChance(10, 10, 0, undefined)).toBe(0.5);
      expect(escapeChance(10, 10, 3, undefined)).toBe(0.5);
      expect(escapeChance(10, 10, 1, 10)).toBeCloseTo(0.6);
      expect(escapeChance(10, 10, 3, 20)).toBe(1);
      expect(escapeChance(10, 10, 4, 0)).toBe(0.5);
    });

    it("같은 rng 값이 첫 시도는 실패, 한 번 실패한 뒤에는 성공한다(strict)", () => {
      const project = battleProject();
      project.system.escapeBonusPercent = 10;
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, agility: heroAgility(project) };
      // 0.55: 기본 50% 에서는 실패, +10%p(60%) 에서는 성공.
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.55 });
      runtime.performActorCommand({ kind: "escape" });
      expect(runtime.snapshot().result).toBeUndefined();
      expect(runtime.snapshot().failedEscapeAttempts).toBe(1);
      runtime.performActorCommand({ kind: "escape" });
      expect(runtime.snapshot().result).toBe("escape");
    });

    it("escapeBonusPercent 가 없는 옛 프로젝트는 가산이 없어 같은 값으로 계속 실패한다", () => {
      const project = battleProject();
      expect(project.system.escapeBonusPercent).toBeUndefined();
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, agility: heroAgility(project) };
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.55 });
      runtime.performActorCommand({ kind: "escape" });
      runtime.performActorCommand({ kind: "escape" });
      runtime.performActorCommand({ kind: "escape" });
      expect(runtime.snapshot().result).toBeUndefined();
      expect(runtime.snapshot().failedEscapeAttempts).toBe(3);
    });

    it("시스템 정규화는 기본값 0 을 저장하지 않고 다른 값은 0~100 으로 자른다", () => {
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 0 }).escapeBonusPercent).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 10 }).escapeBonusPercent).toBe(10);
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 25 }).escapeBonusPercent).toBe(25);
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 250 }).escapeBonusPercent).toBe(100);
      expect(normalizeSystemRecords({ startActorIds: [], battleFormationRoll: true }).battleFormationRoll).toBe(true);
    });
  });
});

describe("mgL2BflowFormation", () => {
  isolateTimers();
  function battleProject(): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 9999 };
    return project;
  }
  const fixed = (value: number) => () => value;
  describe("mg-l2-bflow #3 전투 개시 진형", () => {
    it("민첩 우위와 장비 선제 플래그가 선제 확률을 올리고 기습을 없앤다", () => {
      const even = battleFormationChances({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false });
      const fast = battleFormationChances({ partyAgility: 30, enemyAgility: 10, preemptiveEquipment: false });
      const gear = battleFormationChances({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: true });
      expect(fast.preemptive).toBeGreaterThan(even.preemptive);
      expect(gear.preemptive).toBe(even.preemptive + 25);
      expect(gear.surprise).toBe(0);
      // rng 0 은 첫 구간(선제), 0.999 는 보통.
      expect(rollBattleFormation({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false }, fixed(0))).toBe("preemptive");
      expect(rollBattleFormation({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false }, fixed(0.999))).toBe("normal");
    });

    it("심볼 접촉: 같은 쪽을 볼 때 적 등 뒤에서 닿으면 선제, 등을 잡히면 기습, 정면은 굴림에 맡긴다", () => {
      expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 6, y: 5, facing: "right" })).toBe("preemptive");
      expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 4, y: 5, facing: "right" })).toBe("surprise");
      expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 6, y: 5, facing: "left" })).toBeUndefined();
      expect(contactFormation({ x: 5, y: 5, facing: "down" }, { x: 5, y: 6, facing: undefined })).toBeUndefined();
    });

    it("선제(gauge): 아군 게이지가 가득 차 첫 틱에 명령 차례가 온다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", formation: "preemptive", rng: fixed(0.5) });
      expect(runtime.snapshot().formation).toBe("preemptive");
      expect(runtime.snapshot().actors[0]?.gauge).toBe(100);
      runtime.tick(1);
      expect(runtime.snapshot().phase).toBe("actorCommand");
    });

    it("기습(gauge): 적 게이지가 가득 차 적이 먼저 행동한다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", formation: "surprise", rng: fixed(0.5) });
      expect(runtime.snapshot().enemies[0]?.gauge).toBe(100);
      expect(runtime.snapshot().actors[0]?.gauge).toBe(0);
      runtime.tick(1);
      expect(runtime.snapshot().timeline.some((entry) => entry.side === "enemy" && entry.commandKind === "enemyAttack")).toBe(true);
    });

    it("선제(strict): 첫 라운드에 적이 행동하지 않고, 둘째 라운드부터 행동한다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", formation: "preemptive", rng: fixed(0.5) });
      runtime.performActorCommand({ kind: "defend" });
      const first = runtime.snapshot().roundLogs[0]!;
      expect(first.actions.some((action) => action.side === "enemy")).toBe(false);
      runtime.performActorCommand({ kind: "defend" });
      expect(runtime.snapshot().roundLogs[1]!.actions.some((action) => action.side === "enemy")).toBe(true);
    });

    it("기습(strict): 첫 라운드는 명령 없이 적만 행동하고 둘째 라운드에 명령 차례가 온다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", formation: "surprise", rng: fixed(0.5) });
      const first = runtime.snapshot().roundLogs[0]!;
      expect(first.actions.every((action) => action.side === "enemy")).toBe(true);
      expect(first.actions.length).toBeGreaterThan(0);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      expect(runtime.snapshot().strictRound).toBe(2);
    });

    it("백어택은 대열을 뒤집는다(전열 → 후열)", () => {
      expect(formationStartRow("front", "backAttack")).toBe("back");
      expect(formationStartRow("back", "pincer")).toBe("front");
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, formation: "backAttack", party: { rows: { actor_hero: "front" } }, rng: fixed(0.5) });
      expect(runtime.snapshot().actors[0]?.row).toBe("back");
    });

    it("battleFormationRoll 이 꺼진 레거시 프로젝트는 항상 보통 개시다(rng 를 쓰지 않는다)", () => {
      let calls = 0;
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => { calls += 1; return 0; } });
      expect(runtime.snapshot().formation).toBe("normal");
      expect(calls).toBe(0);
    });

    it("battleFormationRoll + 장비 선제 플래그가 굴림을 선제로 만든다", () => {
      const project = battleProject();
      project.system.battleFormationRoll = true;
      project.database.equipment.push(normalizeEquipmentRecord({ id: "equip_scout", name: "척후 장화", slot: "accessory" }));
      project.database.equipment.find((record) => record.id === "equip_scout")!.effectFlags.preemptive = true;
      // 선제 확률(5 + 25 = 30%) 안쪽 값.
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: fixed(0.2), party: { equipment: { actor_hero: { accessory: "equip_scout" } } } });
      expect(runtime.snapshot().formation).toBe("preemptive");
      const bare = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, rng: fixed(0.2), formation: undefined });
      expect(bare.snapshot().formation).toBe("normal");
    });

    it("battleProcessing.formation 과 system.battleFormationRoll 이 저장·불러오기를 지난다", () => {
      const project = battleProject();
      project.system.battleFormationRoll = true;
      const map = Object.values(project.maps)[0]!;
      const event = map.events.find((entry) => entry.id === "battle-start")!;
      const battle = event.commands[0] as Extract<(typeof event.commands)[number], { kind: "battleProcessing" }>;
      battle.formation = "surprise";
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.battleFormationRoll).toBe(true);
      const command = Object.values(reloaded.maps)[0]!.events.find((entry) => entry.id === "battle-start")!.commands[0]!;
      expect(command).toMatchObject({ kind: "battleProcessing", formation: "surprise" });
    });
  });
});

// 장비가 주는 전투 명령·스킬, MP 소모 절반, 장착 중 장비의 제자리 강화(#7).
describe("mgL3EquipmentGrants", () => {
  isolateTimers();
  function project(): Project {
    const p = deserialize(JSON.stringify(battleFixture));
    p.database.skills.push(skill(p, { id: "skill_blade", name: "칼바람", mpCost: { flat: 9, percentMax: 0 } }));
    p.database.equipment.push(
      normalizeEquipmentRecord({
        id: "equip_runeblade", name: "룬 검", slot: "weapon", equippableActorIds: ["actor_hero"],
        grantsSkillIds: ["skill_blade"],
        grantsCommand: { id: "cmd_rune", name: "룬 베기", kind: "skill", skillId: "skill_blade" },
      }),
      normalizeEquipmentRecord({
        id: "equip_ring", name: "절약 반지", slot: "accessory", equippableActorIds: ["actor_hero"],
        effectFlags: { preemptive: false, doubleAttack: false, attackAll: false, ignoreDodge: false, preventCriticalHits: false, increasePhysicalDodge: false, halfMpCost: true, negateTerrainDamage: false, fixedEquipment: false },
      }),
    );
    return p;
  }
  function skill(p: Project, patch: Partial<SkillRecord> & Pick<SkillRecord, "id">): SkillRecord {
    return {
      ...p.database.skills[0]!,
      name: patch.id,
      scope: "enemy",
      power: 10,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      stateEffects: [],
      ...patch,
    };
  }
  function battle(p: Project, equipment: Record<string, string>) {
    return createBattleRuntime({
      project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
      party: { levels: {}, experience: {}, equipment: { actor_hero: equipment } },
    });
  }
  function actorTurn(runtime: ReturnType<typeof createBattleRuntime>): void {
    for (let guard = 0; guard < 200 && runtime.snapshot().phase !== "actorCommand"; guard += 1) runtime.tick(100);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  }
  describe("equipment grants battle skills and commands", () => {
    it("an equipped weapon makes its granted skill usable without learning it", () => {
      const p = project();
      const bare = battle(p, {});
      actorTurn(bare);
      expect(battleSkillUseFailure(p, bare.snapshot().actors[0]!, "skill_blade")).toBe("notLearned");

      const armed = battle(p, { weapon: "equip_runeblade" });
      actorTurn(armed);
      const hero = armed.snapshot().actors[0]!;
      expect(hero.skillIds).not.toContain("skill_blade");
      expect(hero.equipmentEffects?.grantedSkillIds).toEqual(["skill_blade"]);
      expect(battleSkillUseFailure(p, hero, "skill_blade")).toBeUndefined();
      armed.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
      expect(armed.snapshot().timeline.some((entry) => entry.skillName === "칼바람" && entry.hit)).toBe(true);
    });

    it("adds the granted command to the actor's menu only while equipped", () => {
      const p = project();
      const armed = battle(p, { weapon: "equip_runeblade" });
      actorTurn(armed);
      const hero = armed.snapshot().actors[0]!;
      const withGrant = battleCommandsForActor(p, hero.recordId, { classId: hero.classId, grantedCommands: hero.equipmentEffects?.grantedCommands });
      expect(withGrant.find((command) => command.id === "cmd_rune")).toMatchObject({ name: "룬 베기", kind: "skill", skillId: "skill_blade" });
      const without = battleCommandsForActor(p, hero.recordId, { classId: hero.classId });
      expect(without.some((command) => command.id === "cmd_rune")).toBe(false);
    });

    it("auto-battle can pick a granted skill", () => {
      const p = project();
      // 배운 기술을 비워 장비 기술만 후보로 남긴다(클래스 기술도 뺀다).
      p.database.actors[0]!.learnedSkills = [];
      p.database.classes[0]!.learnedSkills = [];
      p.database.classes[0]!.skillIds = [];
      const armed = battle(p, { weapon: "equip_runeblade" });
      actorTurn(armed);
      const command = chooseAutoBattleCommand(p, armed.snapshot(), () => 0);
      expect(command).toMatchObject({ kind: "skill", skillId: "skill_blade" });
    });

    it("grant fields survive save/load", () => {
      const reloaded = deserialize(serialize(project()));
      const blade = reloaded.database.equipment.find((entry) => entry.id === "equip_runeblade");
      expect(blade?.grantsSkillIds).toEqual(["skill_blade"]);
      expect(blade?.grantsCommand).toEqual({ id: "cmd_rune", name: "룬 베기", kind: "skill", skillId: "skill_blade" });
    });
  });
  describe("halfMpCost equipment flag", () => {
    it("halves MP cost with round-up (9 → 5) in legality and consumption", () => {
      expect(battleSkillMpCost({ mpCost: { flat: 9, percentMax: 0 } }, 0, true)).toBe(5);
      expect(battleSkillMpCost({ mpCost: { flat: 1, percentMax: 0 } }, 0, true)).toBe(1);
      const p = project();
      const runtime = battle(p, { weapon: "equip_runeblade", accessory: "equip_ring" });
      actorTurn(runtime);
      const before = runtime.snapshot().actors[0]!;
      expect(before.equipmentEffects?.halfMpCost).toBe(true);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().actors[0]!.mp).toBe(before.mp - 5);
    });

    it("without the ring the full cost is paid", () => {
      const p = project();
      const runtime = battle(p, { weapon: "equip_runeblade" });
      actorTurn(runtime);
      const before = runtime.snapshot().actors[0]!.mp;
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().actors[0]!.mp).toBe(before - 9);
    });
  });
  describe("in-place upgrade of equipped gear", () => {
    function upgradeProject(): Project {
      const p = project();
      p.database.equipment.push(normalizeEquipmentRecord({ id: "equip_runeblade_plus", name: "룬 검+", slot: "weapon", equippableActorIds: ["actor_hero"], statBonuses: { attack: 20, defense: 0, mind: 0, agility: 0 } }));
      p.database.items.push({ ...p.database.items[0]!, id: "item_ore", name: "광석" });
      p.system.itemUpgrades = [{ id: "up_rune", fromItemId: "equip_runeblade", toItemId: "equip_runeblade_plus", target: "equipment", goldCost: 50, ingredients: [{ itemId: "item_ore", count: 1 }] }];
      return p;
    }

    it("replaces the equipped weapon in its slot and pays gold and materials", () => {
      const p = upgradeProject();
      const session = startSession(p);
      session.actorEquipment.actor_hero = { weapon: "equip_runeblade" };
      session.inventory = { item_ore: 2 };
      session.gold = 80;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: true, ruleId: "up_rune", toItemId: "equip_runeblade_plus", equippedActorId: "actor_hero" });
      expect(session.actorEquipment.actor_hero?.weapon).toBe("equip_runeblade_plus");
      expect(session.inventory.item_ore).toBe(1);
      expect(session.inventory.equip_runeblade_plus).toBeUndefined();
      expect(session.gold).toBe(30);

      const runtime = createBattleRuntime({ project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5, sessionState: session });
      expect(runtime.snapshot().actors[0]!.effectiveStats?.attack).toBeGreaterThanOrEqual(20);
    });

    it("upgrades a bag copy when nobody wears it, and rejects without the item or gold", () => {
      const p = upgradeProject();
      const session = startSession(p);
      session.actorEquipment = {};
      session.inventory = { item_ore: 1 };
      session.gold = 80;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: false, reason: "missing-item" });
      session.inventory.equip_runeblade = 1;
      session.gold = 10;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: false, reason: "missing-gold" });
      session.gold = 50;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: true, ruleId: "up_rune", toItemId: "equip_runeblade_plus" });
      expect(session.inventory.equip_runeblade ?? 0).toBe(0);
      expect(session.inventory.equip_runeblade_plus).toBe(1);
    });

    it("rejects a cross-slot upgrade and keeps the equipped item untouched", () => {
      const p = upgradeProject();
      p.system.itemUpgrades = [{ id: "up_bad", fromItemId: "equip_runeblade", toItemId: "equip_ring", target: "equipment" }];
      const session = startSession(p);
      session.actorEquipment.actor_hero = { weapon: "equip_runeblade" };
      expect(applyItemUpgrade(p, session, "up_bad")).toEqual({ ok: false, reason: "invalid-state" });
      expect(session.actorEquipment.actor_hero?.weapon).toBe("equip_runeblade");
    });

    it("equipment-target rules pass reference validation and survive save/load", () => {
      const reloaded = deserialize(serialize(upgradeProject()));
      expect(reloaded.system.itemUpgrades?.[0]?.target).toBe("equipment");
    });
  });
});

describe("mgL7sysDifficulty", () => {
  isolateTimers();
  function difficultyProject(): Project {
    const project = createBlankProject();
    project.system.difficulties = [
      { id: "easy", name: "쉬움", enemyHpRate: 0.5, expRate: 2, goldRate: 3 },
      { id: "hard", name: "어려움", enemyHpRate: 2, enemyAttackRate: 1.5, encounterRate: 2 },
    ];
    project.system.defaultDifficultyId = "hard";
    return project;
  }
  function runAll(commands: Command[], project: Project, session = startSession(project, 1)) {
    const interpreter = createInterpreter(commands, session, project);
    let step = interpreter.start();
    while (step.kind !== "done") step = interpreter.resume();
    return session;
  }
  function slimeBattle(project: Project, difficultyId: string | undefined) {
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 2 };
    return createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      sessionState: { switches: {}, variables: {}, inventory: {}, ...(difficultyId ? { difficultyId } : {}) },
    });
  }
  function winBattle(runtime: ReturnType<typeof createBattleRuntime>): void {
    for (let i = 0; i < 200 && !runtime.snapshot().result; i += 1) {
      if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      runtime.tick(1_000);
    }
  }
  describe("difficulty modes (#19)", () => {
    it("seeds new sessions with the authored default difficulty and legacy projects with none", () => {
      expect(startSession(difficultyProject(), 1).difficultyId).toBe("hard");
      expect(startSession(createBlankProject(), 1).difficultyId).toBeUndefined();
    });

    it("scales enemy HP/attack by the active difficulty and leaves the default untouched", () => {
      const base = slimeBattle(difficultyProject(), undefined).snapshot().enemies[0]!;
      // 세션 난이도 없음 → 기본 난이도(hard) 배율.
      const hard = slimeBattle(difficultyProject(), "hard").snapshot().enemies[0]!;
      const easy = slimeBattle(difficultyProject(), "easy").snapshot().enemies[0]!;
      const legacy = slimeBattle(createBlankProject(), undefined).snapshot().enemies[0]!;
      expect(legacy.maxHp).toBe(2);
      expect(hard.maxHp).toBe(4);
      expect(base.maxHp).toBe(4);
      expect(easy.maxHp).toBe(1);
      expect(hard.effectiveStats?.attack ?? 0).toBeGreaterThan(legacy.effectiveStats?.attack ?? 0);
    });

    it("multiplies victory exp and gold by the difficulty rates", () => {
      const legacyProject = createBlankProject();
      const legacy = slimeBattle(legacyProject, undefined);
      winBattle(legacy);
      const easy = slimeBattle(difficultyProject(), "easy");
      winBattle(easy);
      expect(legacy.snapshot().result).toBe("victory");
      expect(easy.snapshot().result).toBe("victory");
      expect(easy.snapshot().rewards.exp).toBe(legacy.snapshot().rewards.exp * 2);
      expect(easy.snapshot().rewards.gold).toBe(legacy.snapshot().rewards.gold * 3);
    });

    it("setDifficulty changes the session difficulty and the difficulty condition reads it", () => {
      const project = difficultyProject();
      const session = runAll([{ kind: "setDifficulty", difficultyId: "easy" }], project);
      expect(session.difficultyId).toBe("easy");
      expect(evalCondition(session, { kind: "difficulty", difficultyId: "easy" })).toBe(true);
      expect(evalCondition(session, { kind: "difficulty", difficultyId: "hard" })).toBe(false);
      // 없는 id 는 무시한다.
      runAll([{ kind: "setDifficulty", difficultyId: "nope" }], project, session);
      expect(session.difficultyId).toBe("easy");
    });

    it("scales the random-encounter accumulator by encounterRate", () => {
      // 세션 시드 1 의 첫 인카운트 난수는 0.789 — 누적 500 은 발동하지 않고, ×2(hard) = 1000 은 반드시 발동한다.
      const encounterCalls = (difficultyId: string | undefined): string[] => {
        const project = difficultyProject();
        project.system.actionCombat = { enabled: false };
        const map = project.maps[project.startMapId]!;
        map.encounterRate = 500;
        map.troopIds = ["troop_slime"];
        map.encounterTable = undefined;
        store.replaceProject(project);
        const calls: string[] = [];
        const session = startSession(project, 1);
        if (difficultyId) session.difficultyId = difficultyId;
        const scene = {
          running: false,
          inputEnabled: true,
          map: store.getCurrent().maps[project.startMapId] as GameMap,
          tileX: project.startPos.x,
          tileY: project.startPos.y,
          session,
          playBattle: async () => { calls.push("battle"); return "escape" as const; },
          setInputEnabled: (enabled: boolean) => { scene.inputEnabled = enabled; },
        } as unknown as PlaySceneContext & { inputEnabled: boolean };
        resetEncounterCounter();
        maybeTriggerRandomEncounter(scene);
        return calls;
      };
      expect(encounterCalls("easy")).toEqual([]);
      expect(encounterCalls("hard")).toEqual(["battle"]);
    });

    it("survives normalize, project shape validation and save/load", () => {
      const project = difficultyProject();
      const normalized = normalizeSystemRecords(project.system);
      expect(normalized.difficulties?.map((row) => row.id)).toEqual(["easy", "hard"]);
      expect(normalized.defaultDifficultyId).toBe("hard");
      expect(normalizeSystemRecords(createBlankProject().system).difficulties).toBeUndefined();
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.difficulties?.map((row) => row.id)).toEqual(["easy", "hard"]);
      expect(reloaded.system.defaultDifficultyId).toBe("hard");

      const session = startSession(project, 1);
      session.difficultyId = "easy";
      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.difficultyId).toBe("easy");
    });

    it("normalizes rates, drops blank ids and falls back when the session difficulty was deleted", () => {
      const rows = normalizeDifficulties([
        { id: " a ", name: "", enemyHpRate: 99, expRate: 1 },
        { id: "", name: "빈 id" },
        { id: "a", name: "중복" },
      ]);
      expect(rows).toEqual([{ id: "a", name: "a", enemyHpRate: 10 }]);
      const system = { difficulties: rows, defaultDifficultyId: undefined };
      expect(activeDifficultyId(system, { difficultyId: "deleted" })).toBe("a");
      expect(difficultyRate(system, { difficultyId: "deleted" }, "enemyHpRate")).toBe(10);
    });
  });
});

describe("monsterCare", () => {
  isolateTimers();
  function careProject(): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    project.database.items.push(
      normalizeItemRecord({
        id: "item_monster_berry",
        name: "몬스터 열매",
        scope: "none",
        price: 10,
        type: "special",
        occasion: "field",
        consumable: true,
        careProfile: { kind: "feed", friendshipDelta: 20, expDelta: 0 },
      }),
      normalizeItemRecord({
        id: "item_monster_toy",
        name: "장난감",
        scope: "none",
        price: 15,
        type: "special",
        occasion: "field",
        consumable: true,
        careProfile: { kind: "toy", friendshipDelta: 15 },
      })
    );
    return project;
  }
  describe("monster out-of-battle care", () => {
    it("resolves monsterCare defaults", () => {
      const project = createBlankProject();
      expect(resolveMonsterCare(project)).toEqual({
        stepsPerTick: 50,
        walkFriendship: 1,
        walkExp: 1,
        dailyCareCap: 30,
      });

      project.system.monsterCare = {
        stepsPerTick: 10,
        walkFriendship: 2,
        walkExp: 3,
        dailyCareCap: 5,
      };
      expect(resolveMonsterCare(project)).toEqual({
        stepsPerTick: 10,
        walkFriendship: 2,
        walkExp: 3,
        dailyCareCap: 5,
      });

      const normalized = normalizeSystemRecords({
        startActorIds: project.system.startActorIds,
        monsterCare: { stepsPerTick: 0, walkFriendship: -1, walkExp: 4, dailyCareCap: 9 },
      });
      expect(normalized.monsterCare).toEqual({
        stepsPerTick: 50,
        walkFriendship: 0,
        walkExp: 4,
        dailyCareCap: 9,
      });
    });

    it("care item on party monster increases friendship and consumes item", () => {
      const project = careProject();
      const session = startSession(project, 1);
      session.inventory.item_monster_berry = 2;
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;

      const result = applyCareItem(project, session, {
        itemId: "item_monster_berry",
        instanceId: gift.instance.instanceId,
      });
      expect(result).toMatchObject({
        ok: true,
        friendship: 90,
        friendshipDelta: 20,
        kind: "feed",
      });
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(90);
      expect(session.inventory.item_monster_berry).toBe(1);

      const menu = useItemFromMenu(project, session, "item_monster_berry", undefined, gift.instance.instanceId);
      expect(menu.kind).toBe("used");
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(110);
      expect(session.inventory.item_monster_berry ?? 0).toBe(0);
    });

    it.each([
      ["astronomical", 1e300],
      ["over cap", ITEM_QUANTITY_MAX + 1],
      ["infinite", Number.POSITIVE_INFINITY],
      ["zero", 0],
      ["missing", undefined],
    ])("rejects %s care-item inventory without mutating any session state", (_label, quantity) => {
      const project = careProject();
      const careItem = project.database.items.find((item) => item.id === "item_monster_berry");
      if (!careItem) throw new Error("missing care item");
      careItem.careProfile = { kind: "feed", friendshipDelta: 20, expDelta: 500 };
      const session = startSession(project, 11);
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;
      if (quantity === undefined) delete session.inventory.item_monster_berry;
      else session.inventory.item_monster_berry = quantity;
      const before = structuredClone(session);

      expect(applyCareItem(project, session, {
        itemId: "item_monster_berry",
        instanceId: gift.instance.instanceId,
      })).toEqual({ ok: false, reason: "noInventory" });
      expect(session).toEqual(before);
    });

    it("care item on box monster fails", () => {
      const project = careProject();
      const session = startSession(project, 2);
      session.inventory.item_monster_toy = 1;
      for (let index = 0; index < 6; index += 1) {
        giveMonster(project, session, { speciesId: "species_wild_slime", level: 2 });
      }
      const boxed = giveMonster(project, session, { speciesId: "species_wild_slime", level: 2, friendship: 40 });
      expect(boxed.ok && boxed.location).toBe("box");
      if (!boxed.ok) return;

      const result = applyCareItem(project, session, {
        itemId: "item_monster_toy",
        instanceId: boxed.instance.instanceId,
      });
      expect(result).toEqual({ ok: false, reason: "notInParty" });
      expect(session.inventory.item_monster_toy).toBe(1);
      expect(session.monsterInstances[boxed.instance.instanceId]?.friendship).toBe(40);

      const moved = moveMonster(session, boxed.instance.instanceId, "box", project);
      expect(moved.ok).toBe(true);
      const menu = useItemFromMenu(project, session, "item_monster_toy", undefined, boxed.instance.instanceId);
      expect(menu.kind).toBe("unusable");
      expect(session.inventory.item_monster_toy).toBe(1);
    });

    it("walk ticks at 50 steps apply +1 friendship under cap", () => {
      const project = careProject();
      const session = startSession(project, 3);
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 10 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;

      const partial = applyWalkCareTicks(project, session, 49);
      expect(partial.ticksApplied).toBe(0);
      expect(session.monsterCareSteps).toBe(49);
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(10);

      const tick = applyWalkCareTicks(project, session, 1);
      expect(tick.ticksApplied).toBe(1);
      expect(tick.friendshipGranted).toBe(1);
      expect(session.monsterCareSteps).toBe(0);
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(11);
      expect(session.monsterCareDaily?.["no-time"]).toBe(1);
    });

    it("dailyCareCap blocks further walk friendship", () => {
      const project = careProject();
      project.system.monsterCare = {
        stepsPerTick: 1,
        walkFriendship: 5,
        walkExp: 0,
        dailyCareCap: 12,
      };
      const session = startSession(project, 4);
      session.gameTime = { minute: 0, hour: 8, day: 1, season: "spring", year: 1 };
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 0 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;

      applyWalkCareTicks(project, session, 3);
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(12);
      expect(session.monsterCareDaily?.["1:spring:1"]).toBe(12);

      applyWalkCareTicks(project, session, 10);
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(12);
      expect(session.monsterCareDaily?.["1:spring:1"]).toBe(12);

      session.gameTime = { minute: 0, hour: 8, day: 2, season: "spring", year: 1 };
      applyWalkCareTicks(project, session, 1);
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(17);
      expect(session.monsterCareDaily?.["1:spring:2"]).toBe(5);
    });

    it("save/load preserves care counters and friendship", () => {
      const project = careProject();
      const session = startSession(project, 5);
      session.inventory.item_monster_berry = 1;
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 50 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;

      applyCareItem(project, session, { itemId: "item_monster_berry", instanceId: gift.instance.instanceId });
      applyWalkCareTicks(project, session, 75);
      expect(session.monsterCareSteps).toBe(25);
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(71);

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.monsterCareSteps).toBe(25);
      expect(restored.monsterCareDaily).toEqual(session.monsterCareDaily);
      expect(restored.monsterInstances[gift.instance.instanceId]?.friendship).toBe(71);
      expect(restored.inventory.item_monster_berry ?? 0).toBe(0);
    });

    it("care item friendship can unlock friendship evolution", () => {
      const project = careProject();
      const species = project.database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime");
      if (!species) throw new Error("missing slime");
      species.evolutions = [{ toSpeciesId: "species_king_slime", requires: { friendshipAtLeast: 200 } }];

      const session = startSession(project, 6);
      session.inventory.item_monster_berry = 7;
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;

      for (let index = 0; index < 6; index += 1) {
        const care = applyCareItem(project, session, {
          itemId: "item_monster_berry",
          instanceId: gift.instance.instanceId,
        });
        expect(care.ok).toBe(true);
      }
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(190);

      const blocked = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
      expect(blocked.ok).toBe(false);

      applyCareItem(project, session, { itemId: "item_monster_berry", instanceId: gift.instance.instanceId });
      expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(210);

      const evolved = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
      expect(evolved.ok && evolved.toSpeciesId).toBe("species_king_slime");
      expect(session.monsterInstances[gift.instance.instanceId]?.speciesId).toBe("species_king_slime");
    });
  });
});

// 레벨업 기술 배우기 — 칸이 모자라 보류로 가는 기술은 미리보기에서 overflowSkillIds 로 가려야 한다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterLearnOverflowPreview", () => {
  isolateTimers();
  const IDS = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;
  function move(id: string): SkillRecord {
    return normalizeSkillRecord({
      id, name: id, scope: "enemy", power: 10, description: "", type: "normal",
      mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
      effect: { kind: "damage", statistic: "attack", affects: "hp" }, maxPp: 10,
    });
  }
  function fixture(skillLevels: readonly number[]): Project {
    const project = createBlankProject();
    project.database.skills = [...project.database.skills, ...IDS.map(move)];
    const species: MonsterSpeciesRecord = {
      id: "sp",
      name: "Sp",
      graphic: { graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 30, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
      expCurve: { base: 30, extra: 20, acceleration: 30 },
      captureRate: 0.5,
      skillsByLevel: skillLevels.map((level, index) => ({ level, skillId: IDS[index]! })),
    };
    project.database.monsterSpecies = [species];
    project.system.monsterCollection = true;
    return project;
  }
  describe("splitLearnedMonsterSkills", () => {
    it("fills the free slots first and overflows the rest in learn order", () => {
      expect(splitLearnedMonsterSkills(["a", "b", "c"], ["x", "y"])).toEqual({ learned: ["x"], overflow: ["y"] });
      expect(splitLearnedMonsterSkills(["a"], ["x", "y"])).toEqual({ learned: ["x", "y"], overflow: [] });
      expect(splitLearnedMonsterSkills(["a", "b", "c", "d"], ["x"])).toEqual({ learned: [], overflow: ["x"] });
    });

    it("ignores moves that are already active and de-duplicates", () => {
      expect(splitLearnedMonsterSkills(["a", "b", "c", "d"], ["a", "x", "x"])).toEqual({ learned: [], overflow: ["x"] });
    });
  });
  describe("previewMonsterExperience overflowSkillIds", () => {
    it("marks the fifth move as overflow and leaves the field out when nothing overflows", () => {
      // Break: the result narration said 「배웠다!」 for a move that only went to pendingSkillIds.
      const project = fixture([1, 2, 3, 4, 5]);
      const species = project.database.monsterSpecies![0]!;
      const session = startSession(project, 7);
      const given = giveMonster(project, session, { speciesId: "sp", level: 4 });
      if (!given.ok) throw new Error("fixture monster was not created");
      const instance = { ...given.instance, exp: totalExpForLevel(species.expCurve!, 5) - 1 };

      const [preview] = previewMonsterExperience(project, [instance], 1, [instance.instanceId]);
      expect(preview!.learnedSkillIds).toEqual(["m5"]);
      expect(preview!.overflowSkillIds).toEqual(["m5"]);

      // 같은 입력으로 실제 적립하면 보류로 간다 — 미리보기와 일치해야 한다.
      session.monsterInstances[instance.instanceId] = instance;
      applyMonsterExperienceAndEvolution(project, session, 1, [instance.instanceId]);
      expect(session.monsterInstances[instance.instanceId]!.pendingSkillIds).toEqual(["m5"]);
    });

    it("has no overflow field while a slot is free", () => {
      const project = fixture([1, 2, 5]);
      const species = project.database.monsterSpecies![0]!;
      const session = startSession(project, 7);
      const given = giveMonster(project, session, { speciesId: "sp", level: 4 });
      if (!given.ok) throw new Error("fixture monster was not created");
      const instance = { ...given.instance, exp: totalExpForLevel(species.expCurve!, 5) - 1 };
      const [preview] = previewMonsterExperience(project, [instance], 1, [instance.instanceId]);
      expect(preview!.learnedSkillIds).toEqual(["m3"]);
      expect(preview!.overflowSkillIds).toBeUndefined();
    });
  });
});

// 몬스터 성격·노력치(옵트인) — 공식, 저장 바이트, 노력치 상한·합산, evYield 정규화, giveMonster 의 성격 부여.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterStatRules", () => {
  isolateTimers();
  function speciesRecord(extra: Partial<MonsterSpeciesRecord> = {}): MonsterSpeciesRecord {
    return normalizeMonsterSpeciesRecord({
      id: "sp", name: "Sp", graphic: { graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 40, maxMp: 0, attack: 50, defense: 50, mind: 50, agility: 50 },
      captureRate: 0.5, ...extra,
    });
  }
  function fixture(rules?: { natures?: boolean; evs?: boolean }): Project {
    const project = createBlankProject();
    project.database.monsterSpecies = [speciesRecord()];
    project.system.monsterCollection = true;
    if (rules) project.system.monsterStatRules = rules;
    return project;
  }
  const IVS = { hp: 10, atk: 10, def: 10, spd: 10 };
  describe("monsterBattleStatsForSpecies extras", () => {
    const species = speciesRecord();

    it("is byte-identical to the old formula without extras", () => {
      // 50 level: floor((100+10)*50/100)+5 = 60, HP floor((80+10)*50/100)+60 = 105
      expect(monsterBattleStatsForSpecies(species, 50, IVS)).toMatchObject({ maxHp: 105, attack: 60, defense: 60, agility: 60 });
      expect(monsterBattleStatsForSpecies(species, 50, IVS, {})).toEqual(monsterBattleStatsForSpecies(species, 50, IVS));
    });

    it("applies +10% / -10% after the base formula and leaves HP and the other stats alone", () => {
      const stats = monsterBattleStatsForSpecies(species, 50, IVS, { nature: "brave" });
      expect(stats.attack).toBe(66);
      expect(stats.agility).toBe(54);
      expect(stats.defense).toBe(60);
      expect(stats.maxHp).toBe(105);
    });

    it("still moves a single-digit stat by at least 1 (small-stat games)", () => {
      const tiny = speciesRecord({ baseStats: { maxHp: 5, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 } });
      const plain = monsterBattleStatsForSpecies(tiny, 5, IVS);
      const brave = monsterBattleStatsForSpecies(tiny, 5, IVS, { nature: "brave" });
      expect(brave.attack).toBe(plain.attack + 1);
      expect(brave.agility).toBe(Math.max(1, plain.agility - 1));
    });

    it("a neutral nature changes nothing", () => {
      expect(monsterBattleStatsForSpecies(species, 50, IVS, { nature: "steady" })).toEqual(monsterBattleStatsForSpecies(species, 50, IVS));
    });

    it("adds floor(ev/4) to the stat before the level scale", () => {
      // Levels clamp to ACTOR_LEVEL_MAX (99), so the requested Lv100 is scaled by 99/100: the +63 lands before the scale.
      const base = monsterBattleStatsForSpecies(species, 100, IVS);
      const withEv = monsterBattleStatsForSpecies(species, 100, IVS, { evs: { atk: 252, hp: 252 } });
      const scaled = (raw: number): number => Math.floor(raw * 99 / 100);
      expect(withEv.attack - base.attack).toBe(scaled(2 * 50 + 10 + 63) - scaled(2 * 50 + 10));
      expect(withEv.maxHp - base.maxHp).toBe(scaled(2 * 40 + 10 + 63) - scaled(2 * 40 + 10));
      expect(withEv.maxHp - base.maxHp).toBe(62);
    });
  });
  describe("rules gate", () => {
    it("ignores nature and evs on the instance while the project rules are off", () => {
      const project = fixture();
      const session = startSession(project, 1);
      const given = giveMonster(project, session, { speciesId: "sp", level: 50, nature: "brave" });
      if (!given.ok) throw new Error("fixture");
      expect(given.instance.nature).toBeUndefined();
      expect(monsterBattleStats(project, { ...given.instance, nature: "brave", evs: { hp: 0, atk: 252, def: 0, spd: 0 } })).toEqual(monsterBattleStats(project, given.instance));
    });

    it("gives a deterministic nature when natures is on, and honours an authored one", () => {
      const project = fixture({ natures: true });
      const session = startSession(project, 1);
      const first = giveMonster(project, session, { speciesId: "sp", level: 5 });
      const authored = giveMonster(project, session, { speciesId: "sp", level: 5, nature: "timid" });
      if (!first.ok || !authored.ok) throw new Error("fixture");
      expect(MONSTER_NATURES.some((nature) => nature.id === first.instance.nature)).toBe(true);
      expect(authored.instance.nature).toBe("timid");
      expect(natureIdFromSeed("a")).toBe(natureIdFromSeed("a"));
    });
  });
  describe("evs helpers", () => {
    it("clamps per stat 255 and total 510", () => {
      // Over the 510 total, clampMonsterEvs trims from the last stat backwards (spd → def → atk → hp).
      expect(clampMonsterEvs({ hp: 300, atk: 300, def: 300, spd: 0 })).toEqual({ hp: 255, atk: 255, def: 0, spd: 0 });
      expect(clampMonsterEvs({ hp: 200, atk: 200, def: 200, spd: 200 })).toEqual({ hp: 200, atk: 200, def: 110, spd: 0 });
      expect(clampMonsterEvs(undefined)).toEqual({ hp: 0, atk: 0, def: 0, spd: 0 });
    });

    it("adds a gain without exceeding the caps and returns the base when nothing is gained", () => {
      expect(addMonsterEvs({ hp: 0, atk: 254, def: 0, spd: 0 }, { atk: 3 }).atk).toBe(255);
      expect(addMonsterEvs({ hp: 1, atk: 2, def: 3, spd: 4 }, undefined)).toEqual({ hp: 1, atk: 2, def: 3, spd: 4 });
    });

    it("sums evYield over defeated species and is undefined when there is none", () => {
      const a = speciesRecord({ evYield: { atk: 2 } });
      const b = speciesRecord({ evYield: { atk: 1, spd: 1 } });
      expect(monsterEvYieldOf([a, b, undefined])).toEqual({ atk: 3, spd: 1 });
      expect(monsterEvYieldOf([speciesRecord()])).toBeUndefined();
    });
  });
  describe("normalization", () => {
    it("cuts evYield to 0-3 per stat, total 3, and drops it when empty", () => {
      expect(speciesRecord({ evYield: { hp: 9, atk: 9 } }).evYield).toEqual({ hp: 3 });
      expect(speciesRecord({ evYield: { hp: 0 } }).evYield).toBeUndefined();
      expect(speciesRecord().evYield).toBeUndefined();
    });

    it("keeps monsterStatRules only for the axes that are on", () => {
      // Break: the system normalizer is a whitelist; a field it forgets vanishes on one save/load round trip.
      expect(normalizeSystemRecords({ startActorIds: [] }).monsterStatRules).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], monsterStatRules: { natures: false, evs: false } }).monsterStatRules).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], monsterStatRules: { natures: true, evs: false } }).monsterStatRules).toEqual({ natures: true });
    });

    it("describes a nature in a few characters", () => {
      expect(monsterNatureEffectText(MONSTER_NATURES.find((nature) => nature.id === "brave"))).toBe("공격↑ 속도↓");
      expect(monsterNatureEffectText(MONSTER_NATURES.find((nature) => nature.id === "steady"))).toBe("능력 보정 없음");
    });
  });
});

describe("normalAttackEquipmentStateOrder", () => {
  isolateTimers();
  // 상태를 피해보다 먼저 기록하면 「방어 하락」이 타격 전에 뜨고 그 타격에 쓰러진 적에게도 뜬다(2026-11-04 ultrabrain #4202).

  const HERO_ID = "actor_hero";
  const ENEMY_ID = "enemy_slime";
  const TROOP_ID = "troop_slime";
  const WEAPON_ID = "equip_order_probe";
  function project(enemyHp: number, { startAsleep = false } = {}): Project {
    const p = createBlankProject();
    p.system.battleFlow = "strict";
    p.session.partyActorIds = [HERO_ID];
    p.system.startActorIds = [HERO_ID];
    const actor = p.database.actors.find((record) => record.id === HERO_ID)!;
    actor.critical = { enabled: false, chanceDenominator: 20 };
    actor.parameterCurves.attack = actor.parameterCurves.attack.map(() => 60);
    const enemy = p.database.enemies.find((record) => record.id === ENEMY_ID)!;
    enemy.stats = { maxHp: enemyHp, maxMp: 999, attack: 40, defense: 10, mind: 10, agility: 1 };
    enemy.actions = [];
    p.database.states.find((record) => record.id === "state_sleep")!.recoverWhenHitChance = 100;
    p.database.equipment.push(normalizeEquipmentRecord({
      id: WEAPON_ID,
      name: WEAPON_ID,
      slot: "weapon",
      description: "평타 상태 순서 검증용 무기",
      statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [HERO_ID],
      stateInflictIds: ["state_defense_down"],
      stateInflictionChance: 100,
    }));
    if (startAsleep) {
      const sleepCommand = { kind: "m2Command", commandId: "m2-100-change-enemy-state", fields: { target: "enemy-1", operation: "add", value: "state_sleep" } } as unknown as Command;
      p.database.troops.find((record) => record.id === TROOP_ID)!.battleEventPages = [
        { id: "page_sleep", name: "잠든 채 시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }], commands: [sleepCommand] },
      ];
    }
    return p;
  }
  function heroAttack(p: Project, { warmUpRounds = 0 } = {}): BattleTimelineEntrySnapshot[] {
    const runtime = createBattleRuntime({
      project: p,
      troopId: TROOP_ID,
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 1 }, experience: {}, equipment: { [HERO_ID]: { weapon: WEAPON_ID } } },
      rng: () => 0,
    });
    for (let i = 0; i < warmUpRounds; i += 1) runtime.performActorCommand({ kind: "defend" });
    if (warmUpRounds > 0) expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_sleep");
    const before = runtime.snapshot().timeline.length;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    return runtime.snapshot().timeline.slice(before).filter((entry) => entry.targetId === "enemy-1");
  }
  const order = (entries: readonly BattleTimelineEntrySnapshot[]): string[] =>
    entries
      .filter((entry) => entry.kind === "damage" || entry.kind === "stateAdded" || entry.kind === "stateRemoved")
      .map((entry) => (entry.kind === "damage" ? "damage" : `${entry.kind}:${entry.stateId}`));
  describe("장비 평타 상태 부여 순서", () => {
    it("100% 상태 무기는 피해 다음에 상태를 기록한다", () => {
      expect(order(heroAttack(project(9999)))).toEqual(["damage", "stateAdded:state_defense_down"]);
    });

    it("그 타격에 쓰러진 적에게는 상태를 기록하지 않는다", () => {
      const entries = heroAttack(project(1));
      expect(entries.some((entry) => entry.kind === "damage")).toBe(true);
      expect(entries.some((entry) => entry.kind === "stateAdded")).toBe(false);
    });

    it("잠든 적은 피해 → 깸 → 상태 순서다", () => {
      const entries = heroAttack(project(9999, { startAsleep: true }), { warmUpRounds: 1 });
      expect(order(entries)).toEqual(["damage", "stateRemoved:state_sleep", "stateAdded:state_defense_down"]);
    });
  });
});

describe("p0Bundles", () => {
  isolateTimers();
  function bundleProject() {
    const project = createBlankProject();
    for (const id of ["item_turnip", "item_reward"]) {
      const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
      const index = project.database.items.findIndex((item) => item.id === id);
      if (index >= 0) project.database.items[index] = record;
      else project.database.items.push(record);
    }
    project.switches.push(
      { id: "sw_bundle", name: "Bundle" },
      { id: "sw_bridge", name: "Bridge" },
    );
    project.system.craftRecipes = [{ id: "recipe_preserves", ingredients: [], outputItemId: "item_reward" }];
    project.system.worldUnlocks = [{ id: "region_bridge", switchId: "sw_bridge" }];
    project.system.bundles = [{
      id: "bundle_spring",
      requirements: [{ itemId: "item_turnip", count: 3 }],
      reward: {
        gold: 50,
        itemRewards: [{ itemId: "item_reward", count: 2 }],
        switchId: "sw_bundle",
        worldUnlockIds: ["region_bridge"],
        recipeIds: ["recipe_preserves"],
      },
    }];
    return project;
  }
  describe("P0 bundle contribution rules", () => {
    it("tracks partial progress, then applies completion rewards exactly once", () => {
      // Break caught: partial donation completes early or a repeated completion re-grants rewards.
      const project = bundleProject();
      const session = startSession(project, 1);
      session.inventory = { item_turnip: 3 };
      session.gold = GOLD_MAX - 25;

      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 2)).toMatchObject({
        ok: true,
        contributed: 2,
        required: 3,
        completed: false,
        rewardApplied: false,
      });
      expect(session.inventory.item_turnip).toBe(1);
      expect(session.bundleContributions?.bundle_spring?.item_turnip).toBe(2);

      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 1)).toMatchObject({
        ok: true,
        contributed: 3,
        completed: true,
        rewardApplied: true,
      });
      expect(session.inventory.item_turnip).toBeUndefined();
      expect(session.inventory.item_reward).toBe(2);
      expect(session.gold).toBe(GOLD_MAX);
      expect(session.switches.sw_bundle).toBe(true);
      expect(session.switches.sw_bridge).toBe(true);
      expect(session.completedBundleIds).toEqual(["bundle_spring"]);
      expect(session.bundleRewardAppliedIds).toEqual(["bundle_spring"]);
      expect(session.unlockedRegionIds).toEqual(["region_bridge"]);
      expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);

      const frozen = structuredClone(session);
      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 1)).toMatchObject({
        ok: false,
        reason: "already-complete",
      });
      expect(session).toEqual(frozen);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
      "rejects malformed contribution count %s without mutation",
      (count) => {
        // Break caught: malformed contributions mutate inventory or progress.
        const project = bundleProject();
        const session = startSession(project, 2);
        session.inventory = { item_turnip: 3 };
        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", count)).toMatchObject({
          ok: false,
          reason: "invalid-count",
        });
        expect(session.inventory).toEqual({ item_turnip: 3 });
        expect(session.bundleContributions).toEqual({});
      },
    );

    it("rejects over-donation, insufficient inventory, and unknown targets without item loss", () => {
      // Break caught: an invalid contribution consumes the offered stack before checking the requirement.
      const project = bundleProject();
      const session = startSession(project, 3);
      session.inventory = { item_turnip: 2 };
      const before = structuredClone(session);

      expect(contributeBundle(project, session, "bundle_missing", "item_turnip", 1)).toMatchObject({ ok: false, reason: "missing-bundle" });
      expect(contributeBundle(project, session, "bundle_spring", "item_missing", 1)).toMatchObject({ ok: false, reason: "item-not-required" });
      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 4)).toMatchObject({ ok: false, reason: "exceeds-requirement" });
      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({ ok: false, reason: "insufficient-inventory" });
      expect(session).toEqual(before);
    });

    it("validates every completion reward before consuming the final contribution", () => {
      // Break caught: a missing reward reference is discovered after the donated item is gone.
      const project = bundleProject();
      project.system.bundles![0] = {
        ...project.system.bundles![0]!,
        reward: {
          itemRewards: [{ itemId: "item_missing_reward", count: 1 }],
          switchId: "sw_missing",
          worldUnlockIds: ["region_missing"],
          recipeIds: ["recipe_missing"],
        },
      };
      const session = startSession(project, 4);
      session.inventory = { item_turnip: 3 };
      const before = structuredClone(session);

      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({
        ok: false,
        reason: "invalid-reward",
      });
      expect(session).toEqual(before);
    });

    it("rejects duplicate reward item rows before their combined count can overflow", () => {
      // Break caught: duplicate rows each pass an isolated overflow check, then both mutate inventory.
      const project = bundleProject();
      project.system.bundles![0] = {
        ...project.system.bundles![0]!,
        reward: {
          itemRewards: [
            { itemId: "item_reward", count: 1 },
            { itemId: "item_reward", count: 1 },
          ],
        },
      };
      const session = startSession(project, 6);
      session.inventory = { item_turnip: 3, item_reward: 9_999_998 };
      const before = structuredClone(session);
      expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({
        ok: false,
        reason: "invalid-reward",
      });
      expect(session).toEqual(before);
    });
  });
});
