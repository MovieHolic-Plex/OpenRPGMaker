import { describe, expect, it } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { createInterpreter } from "@/player/interpreter";
import { createSaveSnapshot, applySaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { canEquip } from "@/player/playerEquipmentRules";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { runTool } from "@/editor/tools/toolRunner";
import { changeActorClass, effectiveActorClassId, promoteActor } from "@/project/sessionClass";
import { startSession, type PlaySession } from "@/project/session";
import type { Command, Project } from "@/project/types";

const HERO_ID = "actor_hero";
const GUARDIAN_ID = "actor_guardian";
const APPRENTICE_CLASS_ID = "class_apprentice_warrior";
const WARRIOR_CLASS_ID = "class_warrior_phase8";
const BADGE_ID = "item_warrior_badge";
const DOUBLE_SWORD_ID = "equip_double_attack_sword";
const FIRE_GUARD_ID = "equip_fire_guard";
const STATE_GUARD_ID = "equip_state_guard";

function flatCurve(value: number): number[] {
  return Array.from({ length: 99 }, () => value);
}

function curves(values: { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number }) {
  return {
    maxHp: flatCurve(values.maxHp),
    maxMp: flatCurve(values.maxMp),
    attack: flatCurve(values.attack),
    defense: flatCurve(values.defense),
    mind: flatCurve(values.mind),
    agility: flatCurve(values.agility),
  };
}

function phase8aProject(): Project {
  const project = createBlankProject();
  project.session.partyActorIds = [HERO_ID];
  project.system.startActorIds = [HERO_ID];
  project.switches.push({ id: "sw_promotion", name: "승급 허가" });
  project.variables.push({ id: "var_reputation", name: "명성" });
  project.database.elements = [
    { id: "fire", name: "화염", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
  ];
  project.database.items.push(normalizeItemRecord({ id: BADGE_ID, name: "전사 증표", description: "승급 시험 통과 증표" }));
  project.database.skills.push(
    normalizeSkillRecord({ id: "skill_keep", name: "기존기", power: 1 }),
    normalizeSkillRecord({ id: "skill_warrior_slash", name: "전사 베기", power: 20 }),
    normalizeSkillRecord({
      id: "skill_fire_enemy",
      name: "화염탄",
      power: 80,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      elementId: "fire",
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
    }),
    normalizeSkillRecord({
      id: "skill_sleep_enemy",
      name: "수면침",
      power: 20,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      stateEffects: [{ stateId: "state_poison", chance: 100, operation: "add" }],
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
    })
  );
  const hero = project.database.actors.find((actor) => actor.id === HERO_ID);
  if (!hero) throw new Error("missing hero");
  hero.classId = APPRENTICE_CLASS_ID;
  hero.initialLevel = 5;
  hero.learnedSkills = [{ level: 1, skillId: "skill_keep" }];
  hero.elementRates = { ...hero.elementRates, fire: "C" };
  hero.parameterCurves = curves({ maxHp: 100, maxMp: 40, attack: 40, defense: 10, mind: 10, agility: 20 });
  project.database.classes.push(
    normalizeClassRecord({
      id: APPRENTICE_CLASS_ID,
      name: "견습전사",
      learnedSkills: [{ level: 1, skillId: "skill_keep" }],
      battleCommands: [{ id: "cmd_attack", name: "공격", kind: "attack" }],
      equipmentPermissions: { actorIds: [], classIds: [], equipmentIds: [] },
      parameterCurves: curves({ maxHp: 100, maxMp: 40, attack: 40, defense: 10, mind: 10, agility: 20 }),
      promotions: [{ toClassId: WARRIOR_CLASS_ID, requires: { level: 5, itemId: BADGE_ID } }],
    }),
    normalizeClassRecord({
      id: WARRIOR_CLASS_ID,
      name: "전사",
      learnedSkills: [{ level: 5, skillId: "skill_warrior_slash" }],
      battleCommands: [
        { id: "cmd_attack", name: "공격", kind: "attack" },
        { id: "cmd_skill", name: "전법", kind: "skill" },
        { id: "cmd_defend", name: "방어", kind: "defend" },
      ],
      equipmentPermissions: { actorIds: [], classIds: [], equipmentIds: [DOUBLE_SWORD_ID] },
      parameterCurves: curves({ maxHp: 60, maxMp: 10, attack: 55, defense: 20, mind: 8, agility: 18 }),
    })
  );
  project.database.equipment.push(
    normalizeEquipmentRecord({
      id: DOUBLE_SWORD_ID,
      name: "더블어택 검",
      slot: "weapon",
      description: "두 번 베는 승급 보상 검",
      statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
      equippableClassIds: [WARRIOR_CLASS_ID],
      effectFlags: {
        preemptive: false,
        doubleAttack: true,
        attackAll: false,
        ignoreDodge: false,
        preventCriticalHits: false,
        increasePhysicalDodge: false,
        halfMpCost: false,
        negateTerrainDamage: false,
        fixedEquipment: false,
      },
    }),
    normalizeEquipmentRecord({
      id: FIRE_GUARD_ID,
      name: "화염 방패",
      slot: "shield",
      statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [HERO_ID],
      elementalDefenseIds: ["fire"],
    }),
    normalizeEquipmentRecord({
      id: STATE_GUARD_ID,
      name: "수면 방울",
      slot: "accessory",
      statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [HERO_ID],
      stateDefenseIds: ["state_poison"],
      stateResistanceChance: 100,
    })
  );
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing slime");
  enemy.level = 1;
  enemy.stats = { maxHp: 999, maxMp: 999, attack: 60, defense: 1, mind: 20, agility: 10 };
  enemy.rewards = { exp: 100, gold: 0, dropItemId: undefined, dropRatePercent: 0 };
  return project;
}

function startPhase8aSession(project: Project): PlaySession {
  const session = startSession(project);
  session.actorLevels[HERO_ID] = 5;
  session.actorSkillIds[HERO_ID] = ["skill_keep"];
  session.actorVitals[HERO_ID] = { hp: 90, mp: 30, maxHp: 100, maxMp: 40 };
  return session;
}

function setEnemyAction(project: Project, skillId: string): void {
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing slime");
  enemy.skillIds = [skillId];
  enemy.actions = [{
    skillId,
    priority: 100,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  }];
}

function strictDamageToHero(project: Project, equipment: Record<string, { weapon?: string; shield?: string; accessory?: string }>): number {
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    battleFlow: "strict",
    canEscape: false,
    canLose: true,
    party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 5 }, experience: {}, equipment },
    rng: () => 0,
  });
  const before = runtime.snapshot().actors[0]?.hp ?? 0;
  runtime.performActorCommand({ kind: "defend" });
  return before - (runtime.snapshot().actors[0]?.hp ?? 0);
}

function strictAttackDamage(project: Project, weaponId: string | undefined): number {
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    battleFlow: "strict",
    canEscape: false,
    canLose: true,
    party: {
      partyActorIds: [HERO_ID],
      levels: { [HERO_ID]: 5 },
      experience: {},
      equipment: { [HERO_ID]: weaponId ? { weapon: weaponId } : {} },
    },
    rng: () => 0,
  });
  const before = runtime.snapshot().enemies[0]?.hp ?? 0;
  runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
  return before - (runtime.snapshot().enemies[0]?.hp ?? 0);
}

describe("Phase 8a 런타임 직업 변경", () => {
  it("Change Actor Class가 classOverrides와 스탯/스킬/장비/커맨드 기준을 바꾼다", () => {
    const project = phase8aProject();
    const session = startPhase8aSession(project);
    const actor = project.database.actors.find((record) => record.id === HERO_ID)!;
    const sword = project.database.equipment.find((record) => record.id === DOUBLE_SWORD_ID)!;

    expect(canEquip(project, actor, sword)).toBe(false);
    const result = changeActorClass(session, project, HERO_ID, WARRIOR_CLASS_ID);

    expect(result.ok).toBe(true);
    expect(session.actorLevels[HERO_ID]).toBe(5);
    expect(session.classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);
    expect(session.actorVitals[HERO_ID]).toEqual({ hp: 60, mp: 10, maxHp: 60, maxMp: 10 });
    expect(session.actorSkillIds[HERO_ID]).toEqual(expect.arrayContaining(["skill_keep", "skill_warrior_slash"]));
    expect(canEquip(project, actor, sword, effectiveActorClassId(project, session, HERO_ID))).toBe(true);
    expect(battleCommandsForActor(project, HERO_ID, { classId: effectiveActorClassId(project, session, HERO_ID) }).map((command) => command.name))
      .toEqual(["공격", "전법", "방어"]);

    const status = createStatusMenuDetail({ project, session, selectedCommand: "status", slots: [], waitModeEnabled: false });
    expect(status.entries[0]?.value).toBe("전사 L5");
    session.inventory[DOUBLE_SWORD_ID] = 1;
    const equipment = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "equipment",
      equipmentActorId: HERO_ID,
      equipmentSlotId: "weapon",
      slots: [],
      waitModeEnabled: false,
    });
    const entry = equipment.entries.find((item) => item.testId === `status-menu-equipment-item-${DOUBLE_SWORD_ID}`);
    expect(entry?.description).toContain("더블어택");
  });

  it("m2 Change Actor Class도 PlaySession override를 저장한다", () => {
    const project = phase8aProject();
    const session = startPhase8aSession(project);
    const command: Command = { kind: "m2Command", commandId: "m2-091-change-actor-class", fields: { target: HERO_ID, value: WARRIOR_CLASS_ID } };

    createInterpreter([command], session, project).start();

    expect(session.classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);
    expect(session.actorSkillIds[HERO_ID]).toContain("skill_warrior_slash");
  });

  it("세이브/로드 왕복은 override를 보존하고 구 세이브 누락은 빈 override로 로드한다", () => {
    const project = phase8aProject();
    const session = startPhase8aSession(project);
    changeActorClass(session, project, HERO_ID, WARRIOR_CLASS_ID);

    const snapshot = createSaveSnapshot(project, session);
    expect(applySaveSnapshot(project, snapshot).classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);

    const legacy = structuredClone(snapshot) as SaveSnapshot;
    delete (legacy.session as { classOverrides?: Record<string, string> }).classOverrides;
    expect(applySaveSnapshot(project, legacy).classOverrides).toEqual({});
  });
});

describe("Phase 8a 승급 트리", () => {
  it("승급 조건 4종과 자동 첫 후보 선택, 아이템 소모를 처리한다", () => {
    const project = phase8aProject();
    const source = project.database.classes.find((record) => record.id === APPRENTICE_CLASS_ID)!;
    for (const id of ["class_level", "class_switch", "class_item", "class_variable"]) {
      project.database.classes.push(normalizeClassRecord({ id, name: id, parameterCurves: curves({ maxHp: 70, maxMp: 10, attack: 30, defense: 10, mind: 10, agility: 10 }) }));
    }
    source.promotions = [
      { toClassId: "class_level", requires: { level: 5 } },
      { toClassId: "class_switch", requires: { switchId: "sw_promotion" } },
      { toClassId: "class_item", requires: { itemId: BADGE_ID } },
      { toClassId: "class_variable", requires: { variableId: "var_reputation", atLeast: 7 } },
    ];

    const lowLevel = startPhase8aSession(project);
    lowLevel.actorLevels[HERO_ID] = 4;
    expect(promoteActor(lowLevel, project, HERO_ID, "class_level").ok).toBe(false);

    const auto = startPhase8aSession(project);
    auto.inventory[BADGE_ID] = 1;
    expect(promoteActor(auto, project, HERO_ID).ok).toBe(true);
    expect(auto.classOverrides[HERO_ID]).toBe("class_level");

    const switchSession = startPhase8aSession(project);
    expect(promoteActor(switchSession, project, HERO_ID, "class_switch").ok).toBe(false);
    switchSession.switches.sw_promotion = true;
    expect(promoteActor(switchSession, project, HERO_ID, "class_switch").ok).toBe(true);

    const itemSession = startPhase8aSession(project);
    expect(promoteActor(itemSession, project, HERO_ID, "class_item").ok).toBe(false);
    itemSession.inventory[BADGE_ID] = 1;
    expect(promoteActor(itemSession, project, HERO_ID, "class_item").ok).toBe(true);
    expect(itemSession.inventory[BADGE_ID] ?? 0).toBe(0);

    const variableSession = startPhase8aSession(project);
    variableSession.variables.var_reputation = 6;
    expect(promoteActor(variableSession, project, HERO_ID, "class_variable").ok).toBe(false);
    variableSession.variables.var_reputation = 7;
    expect(promoteActor(variableSession, project, HERO_ID, "class_variable").ok).toBe(true);
  });

  it("승급 아이템의 마지막 충전된 복사본을 소모하면 커서를 지운다", () => {
    const project = phase8aProject();
    const badge = project.database.items.find((item) => item.id === BADGE_ID)!;
    badge.consumptionLimit = 3;
    const session = startPhase8aSession(project);
    session.inventory[BADGE_ID] = 1;
    session.itemUseCharges![BADGE_ID] = 2;

    expect(promoteActor(session, project, HERO_ID, WARRIOR_CLASS_ID).ok).toBe(true);
    expect(session.inventory[BADGE_ID]).toBeUndefined();
    expect(session.itemUseCharges?.[BADGE_ID]).toBeUndefined();
  });

  it("존재하지 않는 승급 대상은 아이템과 충전 커서를 변경하지 않는다", () => {
    const project = phase8aProject();
    const source = project.database.classes.find((record) => record.id === APPRENTICE_CLASS_ID)!;
    source.promotions = [{ toClassId: "class_missing", requires: { itemId: BADGE_ID } }];
    const session = startPhase8aSession(project);
    session.inventory[BADGE_ID] = 1;
    session.itemUseCharges![BADGE_ID] = 2;

    expect(promoteActor(session, project, HERO_ID, "class_missing")).toMatchObject({ ok: false, reason: "class-not-found" });
    expect(session.inventory[BADGE_ID]).toBe(1);
    expect(session.itemUseCharges?.[BADGE_ID]).toBe(2);
    expect(session.classOverrides[HERO_ID]).toBeUndefined();
  });

  it("promoteActor 커맨드는 성공/실패 분기로 진행한다", () => {
    const project = phase8aProject();
    const success = startPhase8aSession(project);
    success.inventory[BADGE_ID] = 1;
    const commands: Command[] = [{
      kind: "promoteActor",
      actorId: HERO_ID,
      toClassId: WARRIOR_CLASS_ID,
      successBranch: [{ kind: "setFlag", flag: "promotion_ok", value: true }],
      failureBranch: [{ kind: "setFlag", flag: "promotion_fail", value: true }],
    }];
    expect(createInterpreter(commands, success, project).start()).toEqual({ kind: "done" });
    expect(success.flags.promotion_ok).toBe(true);
    expect(success.flags.promotion_fail).toBeUndefined();
    expect(success.classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);

    const failure = startPhase8aSession(project);
    expect(createInterpreter(commands, failure, project).start()).toEqual({ kind: "done" });
    expect(failure.flags.promotion_fail).toBe(true);
    expect(failure.flags.promotion_ok).toBeUndefined();
    expect(failure.classOverrides[HERO_ID]).toBeUndefined();
  });

  it("define_promotion write tool이 ClassRecord 승급을 반영한다", () => {
    const ctx = { project: phase8aProject() };
    const result = runTool(ctx, "define_promotion", {
      classId: APPRENTICE_CLASS_ID,
      toClassId: WARRIOR_CLASS_ID,
      requires: { level: 5, itemId: BADGE_ID },
    }, { dryRun: false });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.database.classes.find((record) => record.id === APPRENTICE_CLASS_ID)?.promotions).toContainEqual({
      toClassId: WARRIOR_CLASS_ID,
      requires: { level: 5, itemId: BADGE_ID, switchId: undefined, variableId: undefined, atLeast: undefined },
    });
  });
});

describe("Phase 8a 보상 정책", () => {
  it("기본값은 전원 EXP, participationOnly는 참전자만, levelGapPenalty는 5/10레벨 격차를 감산한다", () => {
    const project = createBlankProject();
    project.session.partyActorIds = [HERO_ID, GUARDIAN_ID];
    let session = startSession(project);
    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 },
      participatingActorIds: [HERO_ID],
    }, project);
    expect(session.actorExperience[HERO_ID]).toBe(100);
    expect(session.actorExperience[GUARDIAN_ID]).toBe(100);

    project.system.rewardPolicy = { participationOnly: true };
    session = startSession(project);
    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 },
      participatingActorIds: [HERO_ID],
    }, project);
    expect(session.actorExperience[HERO_ID]).toBe(100);
    expect(session.actorExperience[GUARDIAN_ID]).toBe(0);

    project.system.rewardPolicy = { participationOnly: true, levelGapPenalty: true };
    session = startSession(project);
    session.actorLevels[HERO_ID] = 6;
    applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 }, participatingActorIds: [HERO_ID] }, project);
    expect(session.actorExperience[HERO_ID]).toBe(50);

    session = startSession(project);
    session.actorLevels[HERO_ID] = 11;
    applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 }, participatingActorIds: [HERO_ID] }, project);
    expect(session.actorExperience[HERO_ID]).toBe(10);
  });

  it("simulate_battle 참전 기록으로 참전자만 EXP와 레벨차 페널티를 적용한다", () => {
    const project = createBlankProject();
    project.session.partyActorIds = [HERO_ID, GUARDIAN_ID];
    project.system.rewardPolicy = { participationOnly: true, levelGapPenalty: true };
    const hero = project.database.actors.find((actor) => actor.id === HERO_ID)!;
    hero.parameterCurves.attack = flatCurve(999);
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    enemy.level = 1;
    enemy.stats = { ...enemy.stats, maxHp: 1, defense: 1 };

    const simulated = simulateBattle({
      project,
      troopId: "troop_slime",
      heroLevel: 11,
      partyActorIds: [HERO_ID, GUARDIAN_ID],
      battleFlow: "strict",
      activeSlots: 1,
      strictScript: [[{ actorId: HERO_ID, command: "attack", target: "enemy-1" }]],
      n: 1,
      seed: 8,
    });
    const session = startSession(project);
    session.actorLevels[HERO_ID] = 11;
    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 },
      participatingActorIds: simulated.participatingActorIds,
    }, project);

    expect(simulated.participatingActorIds).toEqual([HERO_ID]);
    expect(session.actorExperience[HERO_ID]).toBe(10);
    expect(session.actorExperience[GUARDIAN_ID]).toBe(0);
  });
});

describe("Phase 8a 장비 특수 효과", () => {
  it("속성 방어, 상태 방어, 더블어택을 전투에 반영하고 메뉴 상세에 표기한다", () => {
    const project = phase8aProject();
    const menuSession = startPhase8aSession(project);
    changeActorClass(menuSession, project, HERO_ID, WARRIOR_CLASS_ID);
    menuSession.inventory[DOUBLE_SWORD_ID] = 1;
    menuSession.inventory[FIRE_GUARD_ID] = 1;
    menuSession.inventory[STATE_GUARD_ID] = 1;
    const detail = createStatusMenuDetail({
      project,
      session: menuSession,
      selectedCommand: "equipment",
      equipmentActorId: HERO_ID,
      equipmentSlotId: "weapon",
      slots: [],
      waitModeEnabled: false,
    });
    expect(detail.entries.find((entry) => entry.testId === `status-menu-equipment-item-${DOUBLE_SWORD_ID}`)?.description).toContain("더블어택");

    const singleDamage = strictAttackDamage(project, undefined);
    const doubleDamage = strictAttackDamage(project, DOUBLE_SWORD_ID);
    expect(doubleDamage).toBe(singleDamage * 2);

    setEnemyAction(project, "skill_fire_enemy");
    const plainFire = strictDamageToHero(project, { [HERO_ID]: {} });
    const guardedFire = strictDamageToHero(project, { [HERO_ID]: { shield: FIRE_GUARD_ID } });
    expect(guardedFire).toBeGreaterThan(0);
    expect(guardedFire).toBeLessThan(plainFire);

    setEnemyAction(project, "skill_sleep_enemy");
    const noGuard = createBattleRuntime({
      project,
      troopId: "troop_slime",
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 5 }, experience: {}, equipment: { [HERO_ID]: {} } },
      rng: () => 0,
    });
    noGuard.performActorCommand({ kind: "defend" });
    expect(noGuard.snapshot().actors[0]?.stateIds).toContain("state_poison");

    const guarded = createBattleRuntime({
      project,
      troopId: "troop_slime",
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 5 }, experience: {}, equipment: { [HERO_ID]: { accessory: STATE_GUARD_ID } } },
      rng: () => 0,
    });
    guarded.performActorCommand({ kind: "defend" });
    expect(guarded.snapshot().actors[0]?.stateIds).not.toContain("state_poison");
  });
});
