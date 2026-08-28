// 액션 전투 데모 프로젝트 팩토리의 저작 계약(오프라인).
// Supabase 저장 스크립트(scripts/save-action-demo.mts)가 이 팩토리를 그대로 쓰므로,
// 여기서 깨지는 계약은 원격 저장/재로드 검증도 같이 깨진다.
import { describe, expect, it } from "vitest";

import { activeActionSkillId, cycleActionSkillSlot, resolveActionSkillSlots } from "@/battle/action/skillSlots";
import { normalizeActorRecord } from "@/project/actorModel";
import {
  isActionCombatMap,
  normalizeActionSkillProfile,
  normalizeActionWeaponProfile,
  normalizeEnemyActionProfile,
  resolveActionCombatConfig,
} from "@/project/actionCombat";
import {
  ACTION_DEMO_AMMO_ITEM_ID,
  ACTION_DEMO_MAP_ID,
  ACTION_DEMO_PROJECT_ID,
  ACTION_DEMO_SKILL_IDS,
  ACTION_DEMO_WEAPON_ID,
  createActionCombatDemoProject,
} from "@/project/defaults/actionCombatDemoProject";
import type { Project } from "@/project/types";

const DEMO_ACTOR_ID = "actor_hero";

function actionMap(project: Project) {
  const map = project.maps[ACTION_DEMO_MAP_ID];
  expect(map, `${ACTION_DEMO_MAP_ID} 맵이 있어야 한다`).toBeTruthy();
  return map!;
}

/** 액션 맵이 스폰하는 troop → enemy 레코드 전개. */
function spawnedEnemies(project: Project) {
  const troops = new Map(project.database.troops.map((troop) => [troop.id, troop]));
  const enemies = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy]));
  return (actionMap(project).fieldSpawns ?? [])
    .flatMap((spawn) => troops.get(spawn.troopId)?.enemyIds ?? [])
    .map((enemyId) => enemies.get(enemyId))
    .filter((enemy): enemy is NonNullable<typeof enemy> => Boolean(enemy));
}

/**
 * `normalized: true` 는 저장/재로드 경로를 흉내낸다 — 원격 왕복은 actor 레코드를
 * `normalizeActorRecord` 로 통과시키고, 그 정규화가 learnedSkills 를 (level, skillId) 로
 * **정렬**한다. 즉 슬롯 순서는 저작 순서가 아니라 id 순서가 정한다.
 */
function heroActionSkillSlots(project: Project, options?: { readonly normalized?: boolean }) {
  const found = project.database.actors.find((actor) => actor.id === DEMO_ACTOR_ID);
  expect(found, "주인공 레코드가 있어야 한다").toBeTruthy();
  const hero = options?.normalized ? normalizeActorRecord(found!) : found!;
  const level = hero.initialLevel;
  const learned = hero.learnedSkills.filter((entry) => entry.level <= level).map((entry) => entry.skillId);
  return resolveActionSkillSlots(learned, (skillId) => (
    project.database.skills.find((skill) => skill.id === skillId)?.actionSkill != null
  ));
}

describe("액션 전투 데모 프로젝트 팩토리", () => {
  it("맵 옵트인 + 시스템 스위치가 둘 다 켜져 액션 전투로 라우팅된다", () => {
    const project = createActionCombatDemoProject();
    const map = actionMap(project);
    expect(map.actionCombat).toBe(true);
    expect(project.system.actionCombat?.enabled).toBe(true);
    expect(isActionCombatMap(project, map)).toBe(true);
    // 데모를 열면 곧바로 액션 맵에서 시작해야 한다(플레이 경로가 한 단계도 필요 없다).
    expect(project.startMapId).toBe(ACTION_DEMO_MAP_ID);
    expect(ACTION_DEMO_PROJECT_ID).toBe("rpg-zzu-action-demo");
  });

  it("이번 런의 액션 노브(회피 비용·무적창·가드·HUD·스태미나)를 모두 저작한다", () => {
    const project = createActionCombatDemoProject();
    const authored = project.system.actionCombat!;
    expect(authored.dodgeStaminaCost).toBe(20);
    expect(authored.dodgeIframesMs).toBe(320);
    expect(authored.guardDamageReductionPercent).toBe(60);
    expect(authored.guardStaminaDrainPerSec).toBe(18);
    expect(authored.playerIframesMs).toBe(700);
    expect(authored.swingCooldownMs).toBe(300);
    expect(authored.hud).toEqual({ hearts: true, stamina: true, enemyHpBars: "damaged" });

    // 저작값이 런타임 해석을 그대로 통과해야 한다(정규화가 값을 삼키면 안 된다).
    const resolved = resolveActionCombatConfig(project);
    expect(resolved.dodgeStaminaCost).toBe(20);
    expect(resolved.dodgeIframesMs).toBe(320);
    expect(resolved.guardDamageReductionPercent).toBe(60);
    expect(resolved.guardStaminaDrainPerSec).toBe(18);
    expect(resolved.playerIframesMs).toBe(700);
    expect(resolved.swingCooldownMs).toBe(300);
    expect(resolved.stamina).toBe(true);
    expect(resolved.staminaEnabled).toBe(true);
    expect(resolved.hearts).toBe(true);
    expect(resolved.enemyHpBars).toBe("damaged");
  });

  it("액션 맵이 스폰하는 적들이 두 종류 이상의 저작된 공격을 들고 있다", () => {
    const project = createActionCombatDemoProject();
    const profiles = spawnedEnemies(project).map((enemy) => normalizeEnemyActionProfile(enemy.actionProfile));
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.every((profile) => profile?.attack != null)).toBe(true);
    const kinds = new Set(profiles.map((profile) => profile!.attack!.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(kinds.has("melee")).toBe(true);
    expect(kinds.has("projectile")).toBe(true);
    expect(kinds.has("dash")).toBe(true);
    for (const profile of profiles) {
      expect(profile!.attack!.damage).toBeGreaterThan(0);
      expect(profile!.attack!.windupMs).toBeGreaterThan(0);
      expect(profile!.aggroRange).toBeGreaterThan(0);
    }
  });

  it("주인공이 액션 스킬 둘 이상을 배워 슬롯 순환이 실제로 닿는다", () => {
    const project = createActionCombatDemoProject();
    const slots = heroActionSkillSlots(project);
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots.slice(0, ACTION_DEMO_SKILL_IDS.length)).toEqual([...ACTION_DEMO_SKILL_IDS]);
    const first = activeActionSkillId(slots, 0);
    const second = activeActionSkillId(slots, cycleActionSkillSlot(0, slots.length));
    expect(first).toBe(ACTION_DEMO_SKILL_IDS[0]);
    expect(second).toBe(ACTION_DEMO_SKILL_IDS[1]);
    expect(second).not.toBe(first);

    for (const skillId of ACTION_DEMO_SKILL_IDS) {
      const skill = project.database.skills.find((entry) => entry.id === skillId);
      expect(skill, `${skillId} 스킬 레코드`).toBeTruthy();
      const profile = normalizeActionSkillProfile(skill!.actionSkill);
      expect(profile?.kind).toBe("projectile");
      expect(profile!.damage).toBeGreaterThan(0);
      expect(profile!.range).toBeGreaterThan(0);
    }
  });

  it("슬롯 순서가 저장 정규화(learnedSkills 정렬)를 건너가도 그대로다", () => {
    // 실제 Supabase 왕복에서 잡힌 버그: 재로드하면 learnedSkills 가 (level, skillId) 로
    // 정렬되어 슬롯 1/2 가 서로 바뀌었다. 저작 순서가 아니라 id 정렬이 슬롯을 정하므로,
    // 데모의 스킬 id 는 의도한 슬롯 순서로 정렬되어야 한다.
    const project = createActionCombatDemoProject();
    expect(heroActionSkillSlots(project, { normalized: true })).toEqual([...ACTION_DEMO_SKILL_IDS]);
    expect([...ACTION_DEMO_SKILL_IDS].sort((a, b) => a.localeCompare(b))).toEqual([...ACTION_DEMO_SKILL_IDS]);
  });

  it("탄약 소모 스킬의 아이템과 시작 지급, 액션 무기 프로필이 함께 저작된다", () => {
    const project = createActionCombatDemoProject();
    const costed = project.database.skills.find((skill) => skill.actionSkill?.itemCost);
    expect(costed?.actionSkill?.itemCost?.itemId).toBe(ACTION_DEMO_AMMO_ITEM_ID);
    expect(project.database.items.some((item) => item.id === ACTION_DEMO_AMMO_ITEM_ID)).toBe(true);
    expect(project.session.inventory?.[ACTION_DEMO_AMMO_ITEM_ID] ?? 0).toBeGreaterThanOrEqual(12);

    const weapon = project.database.equipment.find((entry) => entry.id === ACTION_DEMO_WEAPON_ID);
    expect(weapon, "액션 무기 레코드").toBeTruthy();
    const weaponProfile = normalizeActionWeaponProfile(weapon!.actionWeapon);
    expect(weaponProfile?.swingDamageBonus).toBeGreaterThan(0);
    expect(weaponProfile?.swingRange).toBeGreaterThanOrEqual(1);
    const hero = project.database.actors.find((actor) => actor.id === DEMO_ACTOR_ID);
    expect(hero?.initialEquipment?.weapon).toBe(ACTION_DEMO_WEAPON_ID);
  });
});
