import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeEquipmentRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import type { EquipmentRecord, Project } from "@/project/types";

const HERO_ID = "actor_hero";
const ENEMY_ID = "enemy_slime";
const TROOP_ID = "troop_slime";

function equipment(id: string, patch: Partial<EquipmentRecord>): EquipmentRecord {
  return normalizeEquipmentRecord({
    id,
    name: id,
    slot: "weapon",
    description: "런타임 장비 축 검증용 장비",
    statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
    equippableActorIds: [HERO_ID],
    ...patch,
  });
}

function runtimeProject(): Project {
  const project = createBlankProject();
  project.system.battleFlow = "strict";
  project.session.partyActorIds = [HERO_ID];
  project.system.startActorIds = [HERO_ID];
  const actor = project.database.actors.find((record) => record.id === HERO_ID)!;
  actor.critical = { enabled: false, chanceDenominator: 20 };
  actor.parameterCurves.attack = actor.parameterCurves.attack.map(() => 60);
  actor.parameterCurves.agility = actor.parameterCurves.agility.map(() => 20);
  actor.elementRates = { ...actor.elementRates, fire: "C" };
  const enemy = project.database.enemies.find((record) => record.id === ENEMY_ID)!;
  enemy.stats = { maxHp: 9999, maxMp: 999, attack: 40, defense: 10, mind: 10, agility: 20 };
  enemy.elementRates = { ...enemy.elementRates, fire: "C" };
  enemy.actions = [];
  return project;
}

function runActorAttack(project: Project, weapon: EquipmentRecord, rng: () => number) {
  project.database.equipment.push(weapon);
  const runtime = createBattleRuntime({
    project,
    troopId: TROOP_ID,
    battleFlow: "strict",
    canEscape: false,
    canLose: true,
    party: {
      partyActorIds: [HERO_ID],
      levels: { [HERO_ID]: 1 },
      experience: {},
      equipment: { [HERO_ID]: { weapon: weapon.id } },
    },
    rng,
  });
  runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
  const attack = runtime.snapshot().timeline.find(
    (entry) => entry.userRecordId === HERO_ID && entry.commandKind === "attack" && (entry.kind === "damage" || entry.kind === "miss"),
  );
  return { runtime, attack };
}

function enemySkillRuntime(project: Project, shield: EquipmentRecord | undefined, rng: () => number) {
  if (shield) project.database.equipment.push(shield);
  const enemy = project.database.enemies.find((record) => record.id === ENEMY_ID)!;
  enemy.actions = [{
    skillId: "skill_axis_enemy",
    priority: 100,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  }];
  enemy.skillIds = ["skill_axis_enemy"];
  const runtime = createBattleRuntime({
    project,
    troopId: TROOP_ID,
    battleFlow: "strict",
    canEscape: false,
    canLose: true,
    party: {
      partyActorIds: [HERO_ID],
      levels: { [HERO_ID]: 1 },
      experience: {},
      equipment: { [HERO_ID]: shield ? { shield: shield.id } : {} },
    },
    rng,
  });
  runtime.performActorCommand({ kind: "defend" });
  return runtime.snapshot();
}

describe("기본 장비가 사용하는 전투 런타임 축", () => {
  it("장비 명중률 차이가 같은 난수에서 일반 공격의 적중 여부를 바꾼다", () => {
    const accurate = runActorAttack(runtimeProject(), equipment("equip_accuracy_high", { accuracy: 100 }), () => 0.9);
    const inaccurate = runActorAttack(runtimeProject(), equipment("equip_accuracy_low", { accuracy: 80 }), () => 0.9);

    expect(accurate.attack?.kind).toBe("damage");
    expect(inaccurate.attack?.kind).toBe("miss");
  });

  it("장비 치명타율 차이가 같은 난수에서 일반 공격 피해를 바꾼다", () => {
    const ordinary = runActorAttack(runtimeProject(), equipment("equip_critical_none", { criticalRate: 0 }), () => 0);
    const critical = runActorAttack(runtimeProject(), equipment("equip_critical_certain", { criticalRate: 100 }), () => 0);

    expect(ordinary.attack?.critical).toBe(false);
    expect(critical.attack?.critical).toBe(true);
    expect(critical.attack?.amount).toBeGreaterThan(ordinary.attack?.amount ?? 0);
  });

  it("장비 상태 부여가 적중한 일반 공격 뒤 실제 대상 상태가 된다", () => {
    const result = runActorAttack(runtimeProject(), equipment("equip_poison_weapon", {
      stateInflictIds: ["state_poison"],
      stateInflictionChance: 100,
    }), () => 0);

    expect(result.attack?.kind).toBe("damage");
    expect(result.runtime.snapshot().enemies[0]?.stateIds).toContain("state_poison");
  });

  it("장비 공격 속성이 대상의 일치 속성 등급으로 일반 공격 피해를 줄인다", () => {
    const neutralProject = runtimeProject();
    const resistantProject = runtimeProject();
    resistantProject.database.enemies.find((record) => record.id === ENEMY_ID)!.elementRates.fire = "D";
    const neutral = runActorAttack(neutralProject, equipment("equip_fire_neutral", { attackElementIds: ["fire"] }), () => 0.5);
    const resisted = runActorAttack(resistantProject, equipment("equip_fire_resisted", { attackElementIds: ["fire"] }), () => 0.5);

    expect(neutral.attack?.amount).toBeGreaterThan(resisted.attack?.amount ?? 0);
  });

  it("일치하는 장비 속성 방어가 실제 속성 피해를 줄인다", () => {
    const plainProject = runtimeProject();
    plainProject.database.skills.push(normalizeSkillRecord({
      id: "skill_axis_enemy",
      name: "화염 시험",
      power: 80,
      hitRate: 100,
      variance: 0,
      elementId: "fire",
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
    }));
    const guardedProject = structuredClone(plainProject);
    const plain = enemySkillRuntime(plainProject, undefined, () => 0.5);
    const guarded = enemySkillRuntime(guardedProject, equipment("equip_fire_guard_test", {
      slot: "shield",
      elementalDefenseIds: ["fire"],
    }), () => 0.5);
    const plainDamage = plain.actors[0]!.maxHp - plain.actors[0]!.hp;
    const guardedDamage = guarded.actors[0]!.maxHp - guarded.actors[0]!.hp;

    expect(guardedDamage).toBeGreaterThan(0);
    expect(guardedDamage).toBeLessThan(plainDamage);
  });

  it("일치하는 장비 상태 방어가 실제 상태 부여를 저항한다", () => {
    const plainProject = runtimeProject();
    plainProject.database.skills.push(normalizeSkillRecord({
      id: "skill_axis_enemy",
      name: "독 시험",
      power: 0,
      hitRate: 100,
      variance: 0,
      stateEffects: [{ stateId: "state_poison", chance: 100, operation: "add" }],
      effect: { kind: "support" },
    }));
    const guardedProject = structuredClone(plainProject);
    const plain = enemySkillRuntime(plainProject, undefined, () => 0);
    const guarded = enemySkillRuntime(guardedProject, equipment("equip_poison_guard_test", {
      slot: "shield",
      stateDefenseIds: ["state_poison"],
      stateResistanceChance: 100,
    }), () => 0);

    expect(plain.actors[0]?.stateIds).toContain("state_poison");
    expect(guarded.actors[0]?.stateIds).not.toContain("state_poison");
  });
});
