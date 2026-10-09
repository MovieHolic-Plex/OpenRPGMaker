import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { battleSkillUseFailure, battleSkillUseFailureLabel } from "@/battle/battleSkillUse";
import { createBattleRuntime } from "@/battle/runtime";
import { stateBehavior } from "@/battle/battleStates";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { ActorRecord, EnemyRecord, Project, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom } from "./fakeDom";

const NEW_STATE_IDS = [
  "state_attack_down",
  "state_agility_up",
  "state_agility_down",
  "state_paralysis",
  "state_deep_poison",
  "state_regen",
  "state_silence",
] as const;

const ITEM_SKILLS = [
  { id: "skill_item_frost_vial", elementId: "ice", power: 32, animationId: "anim_gen_ice_shatter" },
  { id: "skill_item_quake_stone", elementId: "earth", power: 38, animationId: "anim_gen_earth_spike" },
  { id: "skill_item_gale_fan", elementId: "wind", power: 29, animationId: "anim_gen_wind_slice" },
  { id: "skill_item_shadow_dust", elementId: "dark", power: 36, animationId: "anim_gen_shadow_pulse" },
] as const;

type BattleSetup = {
  project: Project;
  actor: ActorRecord;
  enemy: EnemyRecord;
  troopId: string;
};

function battleSetup(): BattleSetup {
  const project = createBlankProject();
  const actor = project.database.actors[0];
  const enemy = project.database.enemies[0];
  const troop = project.database.troops.find((record) => record.id === project.system.initialTroopId)
    ?? project.database.troops[0];
  if (!actor || !enemy || !troop) throw new Error("기본 전투 레코드가 없습니다.");
  troop.enemyIds = [enemy.id];
  troop.members = [{ enemyId: enemy.id, x: 100, y: 100 }];
  troop.battleEventPages = [];
  enemy.stats = { ...enemy.stats, maxHp: 9_999, maxMp: 999, attack: 1, defense: 10, mind: 10, agility: 10 };
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 100);
  actor.parameterCurves.maxMp = Array.from({ length: 99 }, () => 100);
  actor.parameterCurves.attack = Array.from({ length: 99 }, () => 40);
  actor.parameterCurves.defense = Array.from({ length: 99 }, () => 20);
  actor.parameterCurves.mind = Array.from({ length: 99 }, () => 40);
  actor.parameterCurves.agility = Array.from({ length: 99 }, () => 20);
  actor.initialEquipment = {};
  for (const klass of project.database.classes) klass.learnedSkills = [];
  actor.learnedSkills = [];
  return { project, actor, enemy, troopId: troop.id };
}

function runtimeFor(
  setup: BattleSetup,
  options: {
    stateIds?: readonly string[];
    skillIds?: readonly string[];
    hp?: number;
    inventory?: Readonly<Record<string, number>>;
    rng?: () => number;
  } = {},
) {
  return createBattleRuntime({
    project: setup.project,
    troopId: setup.troopId,
    canEscape: false,
    canLose: true,
    battleFlow: "strict",
    rng: options.rng ?? (() => 0.5),
    sessionState: { switches: {}, variables: {}, inventory: { ...(options.inventory ?? {}) } },
    party: {
      levels: { [setup.actor.id]: 1 },
      experience: { [setup.actor.id]: 0 },
      vitals: { [setup.actor.id]: { hp: options.hp ?? 100, mp: 100 } },
      stateIds: { [setup.actor.id]: [...(options.stateIds ?? [])] },
      skillIds: { [setup.actor.id]: [...(options.skillIds ?? [])] },
      partyActorIds: [setup.actor.id],
    },
  });
}

function damageFromAttack(stateIds: readonly string[]): number {
  const setup = battleSetup();
  setup.actor.parameterCurves.agility = Array.from({ length: 99 }, () => 100);
  setup.enemy.stats = { ...setup.enemy.stats, agility: 1 };
  const runtime = runtimeFor(setup, { stateIds, rng: () => 0.5 });
  const before = runtime.snapshot().enemies[0]!.hp;
  runtime.performActorCommand({ kind: "attack", targetEnemyId: runtime.snapshot().enemies[0]!.id });
  return before - runtime.snapshot().enemies[0]!.hp;
}

function firstRoundOrder(stateId: "state_agility_up" | "state_agility_down", actorAgility: number, enemyAgility: number): string[] {
  const setup = battleSetup();
  setup.actor.parameterCurves.agility = Array.from({ length: 99 }, () => actorAgility);
  setup.enemy.stats = { ...setup.enemy.stats, agility: enemyAgility };
  const runtime = runtimeFor(setup, { stateIds: [stateId], rng: () => 0.999999 });
  runtime.performActorCommand({ kind: "defend" });
  return runtime.snapshot().roundLogs[0]!.actions.map((action) => action.userRecordId);
}

function firstGaugeSide(stateId: "state_agility_up" | "state_agility_down", actorAgility: number, enemyAgility: number): "actor" | "enemy" {
  const setup = battleSetup();
  setup.actor.parameterCurves.agility = Array.from({ length: 99 }, () => actorAgility);
  setup.enemy.stats = { ...setup.enemy.stats, agility: enemyAgility };
  const runtime = createBattleRuntime({
    project: setup.project,
    troopId: setup.troopId,
    canEscape: false,
    canLose: true,
    battleFlow: "gauge",
    rng: () => 0.999999,
    party: {
      levels: { [setup.actor.id]: 1 },
      experience: { [setup.actor.id]: 0 },
      stateIds: { [setup.actor.id]: [stateId] },
      partyActorIds: [setup.actor.id],
    },
  });
  runtime.tick(100_000);
  if (runtime.snapshot().phase === "actorCommand") return "actor";
  return runtime.snapshot().timeline.some((entry) => entry.side === "enemy" && (entry.kind === "damage" || entry.kind === "miss"))
    ? "enemy"
    : (() => { throw new Error("게이지 전투에서 첫 행동이 발생하지 않았습니다."); })();
}

function damageFromItemSkill(skillId: string, resistance: "C" | "D") {
  const setup = battleSetup();
  setup.actor.parameterCurves.agility = Array.from({ length: 99 }, () => 100);
  setup.enemy.stats = { ...setup.enemy.stats, agility: 1 };
  setup.enemy.elementRates = { ...setup.enemy.elementRates, [setup.project.database.skills.find((skill) => skill.id === skillId)!.elementId!]: resistance };
  const runtime = runtimeFor(setup, { skillIds: [skillId], rng: () => 0.5 });
  const before = runtime.snapshot().enemies[0]!.hp;
  runtime.performActorCommand({ kind: "skill", skillId, targetEnemyId: runtime.snapshot().enemies[0]!.id });
  const snapshot = runtime.snapshot();
  const actorAnimation = snapshot.timeline.find((entry) => entry.userRecordId === setup.actor.id && entry.skillName)?.animation?.animationId;
  return {
    damage: before - snapshot.enemies[0]!.hp,
    animationId: actorAnimation,
  };
}

describe("확장 상태 런타임", () => {
  it("공격 하락은 실제 기본 공격 피해를 낮춘다", () => {
    expect(damageFromAttack(["state_attack_down"])).toBeLessThan(damageFromAttack([]));
  });

  it("민첩 상승은 엄격 전투와 게이지 전투에서 더 빠른 적보다 먼저 행동하게 한다", () => {
    const setup = battleSetup();
    expect(firstRoundOrder("state_agility_up", 10, 15)[0]).toBe(setup.actor.id);
    expect(firstGaugeSide("state_agility_up", 10, 15)).toBe("actor");
  });

  it("민첩 하락은 엄격 전투와 게이지 전투에서 더 느린 적보다 늦게 행동하게 한다", () => {
    const setup = battleSetup();
    expect(firstRoundOrder("state_agility_down", 20, 15)[0]).toBe(setup.enemy.id);
    expect(firstGaugeSide("state_agility_down", 20, 15)).toBe("enemy");
  });

  it("마비는 행동을 막고 자연 회복 판정 뒤 다시 명령을 받는다", () => {
    const setup = battleSetup();
    const runtime = runtimeFor(setup, { stateIds: ["state_paralysis"], rng: () => 0 });
    const snapshot = runtime.snapshot();
    expect(snapshot.timeline.some((entry) => entry.kind === "incapacitated" && entry.side === "actor")).toBe(true);
    expect(snapshot.timeline.some((entry) => entry.kind === "stateRemoved" && entry.stateId === "state_paralysis" && entry.reason === "natural")).toBe(true);
    expect(snapshot.actors[0]!.stateIds).not.toContain("state_paralysis");
    expect(snapshot.phase).toBe("actorCommand");
  });

  it("맹독은 독보다 큰 턴당 피해를 실제 전투 시작 유지 처리에서 준다", () => {
    const poisonSetup = battleSetup();
    const poison = runtimeFor(poisonSetup, { stateIds: ["state_poison"], rng: () => 0.999999 }).snapshot();
    const deepSetup = battleSetup();
    const deep = runtimeFor(deepSetup, { stateIds: ["state_deep_poison"], rng: () => 0.999999 }).snapshot();
    expect(poison.actors[0]!.hp).toBe(94);
    expect(deep.actors[0]!.hp).toBe(88);
    expect(deep.timeline).toContainEqual(expect.objectContaining({ kind: "stateUpkeep", amount: 12 }));
  });

  it("재생은 실제 전투 유지 처리에서 최대 HP 비율만큼 회복한다", () => {
    const setup = battleSetup();
    const snapshot = runtimeFor(setup, { stateIds: ["state_regen"], hp: 50, rng: () => 0.999999 }).snapshot();
    expect(snapshot.actors[0]!.hp).toBe(58);
    expect(snapshot.timeline).toContainEqual(expect.objectContaining({ kind: "stateRecovery", amount: 8 }));
  });

  it("침묵은 스킬만 막고 기본 공격과 아이템은 허용하며 적 스킬에도 적용된다", () => {
    const skillSetup = battleSetup();
    const skill = skillSetup.project.database.skills.find((record) => record.id === "skill_fire")!;
    const silenced = runtimeFor(skillSetup, { stateIds: ["state_silence"], skillIds: [skill.id], rng: () => 0.5 });
    const actor = silenced.snapshot().actors[0]!;
    expect(battleSkillUseFailure(skillSetup.project, actor, skill.id)).toBe("skillBlocked");
    expect(battleSkillUseFailureLabel("skillBlocked", skill, actor)).toContain("침묵 상태");
    const beforeSkill = silenced.snapshot().enemies[0]!.hp;
    silenced.performActorCommand({ kind: "skill", skillId: skill.id, targetEnemyId: silenced.snapshot().enemies[0]!.id });
    expect(silenced.snapshot().enemies[0]!.hp).toBe(beforeSkill);
    silenced.performActorCommand({ kind: "attack", targetEnemyId: silenced.snapshot().enemies[0]!.id });
    expect(silenced.snapshot().enemies[0]!.hp).toBeLessThan(beforeSkill);

    const itemSetup = battleSetup();
    const itemRuntime = runtimeFor(itemSetup, { stateIds: ["state_silence"], inventory: { item_poison_dart: 1 }, rng: () => 0.5 });
    itemRuntime.performActorCommand({ kind: "item", itemId: "item_poison_dart", targetEnemyId: itemRuntime.snapshot().enemies[0]!.id });
    expect(itemRuntime.snapshot().eventState.inventory.item_poison_dart ?? 0).toBe(0);

    const enemySetup = battleSetup();
    const silenceSkill: SkillRecord = {
      ...enemySetup.project.database.skills[0]!,
      id: "skill_test_silence",
      name: "침묵 시험",
      scope: "enemy",
      power: 0,
      effect: { kind: "damage", statistic: "mind", affects: "hp" },
      stateEffects: [{ stateId: "state_silence", chance: 100, operation: "add" }],
    };
    enemySetup.project.database.skills.push(silenceSkill);
    enemySetup.enemy.actions = [{
      skillId: "skill_fire",
      priority: 100,
      condition: { kind: "always" },
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    }];
    enemySetup.actor.parameterCurves.agility = Array.from({ length: 99 }, () => 100);
    enemySetup.enemy.stats = { ...enemySetup.enemy.stats, agility: 1 };
    const enemyRuntime = runtimeFor(enemySetup, { skillIds: [silenceSkill.id], rng: () => 0.5 });
    const actorHpBefore = enemyRuntime.snapshot().actors[0]!.hp;
    enemyRuntime.performActorCommand({ kind: "skill", skillId: silenceSkill.id, targetEnemyId: enemyRuntime.snapshot().enemies[0]!.id });
    const enemySkillLog = enemyRuntime.snapshot().roundLogs[0]!.actions.find((action) => action.commandKind === "enemySkill");
    expect(enemyRuntime.snapshot().enemies[0]!.stateIds).toContain("state_silence");
    expect(enemySkillLog?.hit).toBeUndefined();
    expect(enemySkillLog?.amount).toBeUndefined();
    expect(enemyRuntime.snapshot().actors[0]!.hp).toBe(actorHpBefore);
  });
});

describe("확장 상태 데이터 계약", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });

  it("모든 기본 상태가 런타임에서 최소 한 가지 효과를 가진다", () => {
    const project = createBlankProject();
    const inert = project.database.states.filter((state) => {
      const behavior = stateBehavior(state);
      return !behavior.restrictsAction
        && !behavior.blocksSkillUse
        && behavior.hpDamagePercentPerTurn === 0
        && behavior.hpHealPercentPerTurn === 0
        && behavior.attackMultiplier === 1
        && behavior.defenseMultiplier === 1
        && behavior.agilityMultiplier === 1
        && !behavior.removeOnBattleEnd
        && behavior.recoverNaturallyChance <= 0
        && behavior.recoverWhenHitChance <= 0;
    });
    expect(inert).toEqual([]);
  });

  it("새 상태 id와 이름을 보존하고 전용 런타임 필드를 직렬화 왕복한다", () => {
    const project = createBlankProject();
    expect(project.database.states.filter((state) => NEW_STATE_IDS.includes(state.id as typeof NEW_STATE_IDS[number])).map((state) => [state.id, state.name])).toEqual([
      ["state_attack_down", "공격 하락"],
      ["state_agility_up", "민첩 상승"],
      ["state_agility_down", "민첩 하락"],
      ["state_paralysis", "마비"],
      ["state_deep_poison", "맹독"],
      ["state_regen", "재생"],
      ["state_silence", "침묵"],
    ]);
    const restored = deserialize(serialize(project));
    expect(restored.database.states.find((state) => state.id === "state_regen")?.runtimeEffects?.hpHealPercentPerTurn).toBe(8);
    expect(restored.database.states.find((state) => state.id === "state_silence")?.runtimeEffects?.blocksSkillUse).toBe(true);
    expect(restored.database.states.find((state) => state.id === "state_agility_up")?.runtimeEffects?.agilityMultiplier).toBe(2);
  });

  it("상태 편집기에 회복, 침묵, 민첩 전용 필드를 표시하고 저장한다", () => {
    const project = createBlankProject();
    store.replace(project);
    const regen = project.database.states.find((state) => state.id === "state_regen")!;
    const form = el("div") as unknown as import("./fakeDom").FakeElement;
    renderStateRecordForm(form as unknown as HTMLElement, regen);
    const heal = findByTestId(form, "db-state-rt-hp-heal-percent");
    const block = findByTestId(form, "db-state-rt-blocks-skill");
    const agility = findByTestId(form, "db-state-rt-agility-mult");
    if (!heal || !block || !agility) throw new Error("확장 상태 런타임 필드가 없습니다.");
    heal.value = "11";
    heal.dispatchEvent(new Event("input"));
    block.checked = true;
    block.dispatchEvent(new Event("change"));
    agility.value = "1.5";
    agility.dispatchEvent(new Event("input"));
    expect(store.getCurrent().database.states.find((state) => state.id === "state_regen")?.runtimeEffects).toMatchObject({
      hpHealPercentPerTurn: 11,
      blocksSkillUse: true,
      agilityMultiplier: 1.5,
    });
  });
});

describe("확장 아이템 속성 스킬", () => {
  for (const expected of ITEM_SKILLS) {
    it(`${expected.id}은 ${expected.elementId} 저항과 전투 애니메이션을 실제 피해에 반영한다`, () => {
      const project = createBlankProject();
      const skill = project.database.skills.find((record) => record.id === expected.id);
      expect(skill).toMatchObject({ elementId: expected.elementId, power: expected.power, animationId: expected.animationId });
      expect(project.database.battleAnimations.some((animation) => animation.id === expected.animationId)).toBe(true);
      expect(project.database.actors.flatMap((actor) => actor.learnedSkills.map((entry) => entry.skillId))).not.toContain(expected.id);
      expect(project.database.classes.flatMap((record) => record.skillIds)).not.toContain(expected.id);
      expect(project.database.classes.flatMap((record) => record.learnedSkills.map((entry) => entry.skillId))).not.toContain(expected.id);

      const neutral = damageFromItemSkill(expected.id, "C");
      const resistant = damageFromItemSkill(expected.id, "D");
      expect(neutral.animationId).toBe(expected.animationId);
      expect(resistant.animationId).toBe(expected.animationId);
      expect(resistant.damage).toBeLessThan(neutral.damage);
    });
  }
});
