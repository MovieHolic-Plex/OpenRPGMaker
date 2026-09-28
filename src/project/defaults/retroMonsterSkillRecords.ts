// retro2003 몬스터 스킬 42개(계약 src/assets/retroMonsterSkills.ts)의 기본 DB 레코드와 도트 적 행동 배선.
//
// 계약은 연출(motion·layers)과 효과 방향 힌트만 정한다. 규칙은 여기서 기존 필드로만 준다 —
// 위력·MP·scope·damage/support·속성·상태 효과. 흡혈·소환처럼 규칙에 없는 뜻은 표현만 한다.
//
// ── 위력·MP 규칙 ───────────────────────────────────────────────────────────
// skill_attack 의 실위력은 시전자 attackPower 다(enemyActionArchetypes.ts 머리 주석). 도트 적의 attack 은
// Lv1~34 에서 36~97, 보스 192~220 이다. 스킬 피해 = power + 스탯/2 − 방어/2 이므로 power 가 attack 보다 작으면
// 통상 공격보다 약한 "스킬" 이 된다 — 단일 피해기는 쓰는 적 레벨대 attack 의 약 1.1배, 상태를 얹은 단일기는 0.8배,
// 전체기는 0.6~0.7배로 둔다. 레벨대가 높은 적만 가진 스킬일수록 위력이 크다(산성 침 40 → 암흑의 심판 220).
// 고위급(레벨이 높은 적만 가진) 스킬일수록 위력이 크다. MP 는 비보스 maxMp 10 에서 2~4회, 보스 40 에서 5회 이상 쓰도록 2~8.
//
// ── 우선순위(enemyActionArchetypes 규칙) ─────────────────────────────────────
//   7 앵커 skill_attack(유지) · 8 유료 정체성기(MP 가 횟수를 묶는다) · 9 필살기 turn 버스트 · 5 무료 고정 위력기.
//   필살기 두 개(미궁의 광란·암흑의 심판)는 MP 0 이다: always 유료기가 MP 를 먼저 말리면 turn 버스트도
//   점수 계산 전에 걸러진다(runtime chooseEnemyAction 의 battleSkillUseFailure 필터). 횟수는 turn 조건이 묶는다.
//   MP 0 이어도 상태·속성을 띠어 "평범한 무료 데미지"(앵커를 밀어내는 쪽)로 분류되지 않는다.
//
// ── 테스트 계약 ────────────────────────────────────────────────────────────
// test/enemyActionArchetypes.test.ts 는 generatedEnemyRecords() 출력이 아키타입 서명과 정확히 같은지 역판정한다.
// 그래서 generatedEnemyRecords 는 건드리지 않고 defaultBattleRecords 가 마지막에 withRetroMonsterSkills 로 덮는다.
// 기본 DB 적 106마리 전원 검사(행동 ≥2·MP 0 스킬 ≥1·정체성 데미지기 > 평범한 무료기·정령 속성 7종 이상·
// 보스 속성)는 앵커 유지 + 전 스킬 정체성(유료 또는 상태·속성)으로 지킨다. 식충 식물(보스)은 계약 목록에 속성기가 없어
// 덩굴 채찍에 earth 속성을 붙였다(보스 속성 검사, 무속성이면 저항표가 장식이 된다).
import type { DatabaseStateEffect, EnemyActionPattern, EnemyRecord, SkillRecord } from "../types";
import { RETRO_MONSTER_SKILLS, RETRO_MONSTER_SKILLSETS, type RetroMonsterSkill } from "@/assets/retroMonsterSkills";
import { PIXEL_ENEMY_SHEETS } from "@/assets/pixelEnemySheets";
import { generatedEffectDatabaseAnimationId as anim } from "@/assets/generatedEffectSheets";
import { normalizeSkillRecord } from "../databaseRecordModel";

type Scope = SkillRecord["scope"];
interface Seed {
  readonly mp: number;
  /** attack·mind = 피해(스탯), support = 상태만. */
  readonly kind: "attack" | "mind" | "support";
  readonly power?: number;
  readonly states?: readonly DatabaseStateEffect[];
  readonly critical?: number;
  readonly animation: string;
  /** 계약 element 를 덮는다(규칙 정본은 이 레코드). */
  readonly element?: string;
  /** 필살기 turn 버스트(시작 턴 = 주기). */
  readonly burstEvery?: number;
}

const add = (stateId: string, chance: number): DatabaseStateEffect => ({ stateId, chance, operation: "add" });

const SEEDS: Readonly<Record<string, Seed>> = {
  // ── 짐승·곤충 (Lv1~14) ──
  skill_mon_acid_spit: { mp: 2, kind: "mind", power: 40, states: [add("state_poison", 60)], animation: anim("poison-mist") },
  skill_mon_body_slam: { mp: 3, kind: "attack", power: 70, states: [add("state_paralysis", 15)], animation: anim("tackle-impact") },
  skill_mon_blood_suck: { mp: 3, kind: "mind", power: 60, animation: anim("drain-orbs") },
  skill_mon_sonic_screech: { mp: 3, kind: "support", states: [add("state_sleep", 40)], animation: anim("sonic-wave") },
  skill_mon_poison_sting: { mp: 2, kind: "attack", power: 50, states: [add("state_poison", 80)], animation: anim("poison-mist") },
  skill_mon_web_shot: { mp: 2, kind: "support", states: [add("state_agility_down", 90)], animation: anim("projectile-shot") },
  skill_mon_cross_scythe: { mp: 3, kind: "attack", power: 80, critical: 15, animation: anim("claw-rake") },
  skill_mon_howl: { mp: 3, kind: "support", states: [add("state_attack_up", 100)], animation: anim("power-aura") },
  skill_mon_tusk_charge: { mp: 3, kind: "attack", power: 85, states: [add("state_defense_down", 30)], animation: anim("tackle-impact") },
  skill_mon_savage_maul: { mp: 3, kind: "attack", power: 90, critical: 15, animation: anim("claw-rake") },
  skill_mon_venom_fang: { mp: 3, kind: "attack", power: 60, states: [add("state_deep_poison", 70)], animation: anim("poison-mist") },
  skill_mon_shell_guard: { mp: 2, kind: "support", states: [add("state_defense_up", 100)], animation: anim("guard-barrier") },
  skill_mon_hellfire_fang: { mp: 3, kind: "mind", power: 85, animation: anim("fire-burst") },
  // ── 언데드·마법 (Lv16~29) ──
  skill_mon_bone_curse: { mp: 3, kind: "support", states: [add("state_attack_down", 80)], animation: anim("shadow-pulse") },
  skill_mon_arrow_volley: { mp: 4, kind: "attack", power: 48, animation: anim("projectile-shot") },
  skill_mon_rot_breath: { mp: 4, kind: "mind", power: 40, states: [add("state_deep_poison", 45)], animation: anim("poison-mist") },
  skill_mon_banshee_wail: { mp: 3, kind: "support", states: [add("state_silence", 60)], animation: anim("blind-veil") },
  skill_mon_frost_orb: { mp: 3, kind: "mind", power: 85, states: [add("state_agility_down", 25)], animation: anim("ice-shatter") },
  skill_mon_frost_nova: { mp: 5, kind: "mind", power: 60, animation: anim("ice-shatter") },
  skill_mon_bandage_bind: { mp: 3, kind: "support", states: [add("state_paralysis", 55)], animation: anim("paralysis-bind") },
  skill_mon_flame_burst: { mp: 4, kind: "mind", power: 58, animation: anim("fire-burst") },
  skill_mon_tidal_wave: { mp: 5, kind: "mind", power: 60, animation: anim("water-column") },
  skill_mon_vine_whip: { mp: 4, kind: "attack", power: 200, element: "earth", states: [add("state_agility_down", 40)], animation: anim("claw-rake") },
  skill_mon_spore_cloud: { mp: 6, kind: "support", states: [add("state_sleep", 45)], animation: anim("sleep-dust") },
  // ── 인간형·거구·보스 (Lv12~45) ──
  skill_mon_quake_stomp: { mp: 4, kind: "attack", power: 60, animation: anim("earth-spike") },
  skill_mon_axe_cleave: { mp: 3, kind: "attack", power: 100, critical: 20, animation: anim("slash-steel") },
  skill_mon_mimic_devour: { mp: 4, kind: "attack", power: 110, states: [add("state_defense_down", 40)], animation: anim("claw-rake") },
  skill_mon_eye_beam: { mp: 5, kind: "mind", power: 180, states: [add("state_paralysis", 45)], animation: anim("holy-beam") },
  skill_mon_evil_eye: { mp: 6, kind: "support", states: [add("state_attack_down", 70), add("state_defense_down", 50)], animation: anim("shadow-pulse") },
  skill_mon_hex_fire: { mp: 4, kind: "mind", power: 62, animation: anim("fire-burst") },
  skill_mon_smoke_bomb: { mp: 3, kind: "support", states: [add("state_attack_down", 60)], animation: anim("smoke-vanish") },
  skill_mon_backstab: { mp: 3, kind: "attack", power: 105, critical: 35, animation: anim("critical-burst") },
  skill_mon_spear_thrust: { mp: 3, kind: "attack", power: 105, states: [add("state_defense_down", 30)], animation: anim("slash-steel") },
  skill_mon_gale_wing: { mp: 4, kind: "mind", power: 70, animation: anim("wind-slice") },
  skill_mon_boulder_throw: { mp: 3, kind: "attack", power: 100, animation: anim("earth-spike") },
  skill_mon_maze_rampage: { mp: 0, kind: "attack", power: 110, states: [add("state_defense_down", 50)], animation: anim("earth-spike"), burstEvery: 4 },
  skill_mon_fire_breath: { mp: 6, kind: "mind", power: 130, animation: anim("fire-burst") },
  skill_mon_dragon_roar: { mp: 5, kind: "support", states: [add("state_attack_up", 100)], animation: anim("power-aura") },
  skill_mon_dark_flame: { mp: 6, kind: "mind", power: 140, states: [add("state_attack_down", 25)], animation: anim("shadow-pulse") },
  skill_mon_dark_meteor: { mp: 8, kind: "mind", power: 160, animation: anim("meteor-fall") },
  skill_mon_demon_aura: { mp: 5, kind: "support", states: [add("state_attack_up", 100), add("state_defense_up", 100)], animation: anim("power-aura") },
  skill_mon_dark_judgment: { mp: 0, kind: "mind", power: 220, animation: anim("shadow-pulse"), burstEvery: 3 },
};

/** 계약 effect → scope. debuff 는 단일, debuffAll/damageAll 은 아군 전체, buffSelf 는 자기, buffAllies 는 몬스터 편 전체. */
function scopeFor(skill: RetroMonsterSkill): Scope {
  switch (skill.effect) {
    case "damage": case "debuff": return "enemy";
    case "damageAll": case "debuffAll": return "allEnemies";
    case "buffSelf": return "self";
    case "buffAllies": return "allAllies";
  }
}

function record(skill: RetroMonsterSkill, seed: Seed): SkillRecord {
  const effect: SkillRecord["effect"] = seed.kind === "support" ? { kind: "support" } : { kind: "damage", statistic: seed.kind, affects: "hp" };
  return normalizeSkillRecord({
    id: skill.id,
    name: skill.name,
    scope: scopeFor(skill),
    power: seed.power ?? 0,
    animationId: seed.animation,
    description: skill.description.endsWith(".") ? skill.description : skill.description + ".",
    mpCost: { flat: seed.mp, percentMax: 0 },
    successRate: 100,
    variance: seed.kind === "support" ? 0 : 15,
    hitRate: seed.kind === "attack" ? 95 : 100,
    effect,
    elementId: seed.element ?? skill.element,
    stateEffects: seed.states ? [...seed.states] : undefined,
    ...(seed.critical !== undefined ? { criticalRate: seed.critical } : {}),
  });
}

/** 계약 순서 그대로 42개. 씨앗이 없으면 곧바로 실패한다(계약과 DB 가 어긋나지 않게). */
export function retroMonsterSkillRecords(): SkillRecord[] {
  return RETRO_MONSTER_SKILLS.map((skill) => {
    const seed = SEEDS[skill.id];
    if (!seed) throw new Error("retro 몬스터 스킬 레코드 씨앗 누락: " + skill.id);
    return record(skill, seed);
  });
}

const ANCHOR = 7;
const IDENTITY = 8;
const FIXED_FREE = 5;
const BURST = 9;

function pattern(skillId: string, priority: number, condition: EnemyActionPattern["condition"]): EnemyActionPattern {
  return {
    skillId: skillId as EnemyActionPattern["skillId"],
    priority,
    condition,
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

/** 도트 시트 slug(pixel-enemies/<slug>.png) ← 적 monsterResourceId. */
const SLUG_BY_RESOURCE: ReadonlyMap<string, string> = new Map(
  PIXEL_ENEMY_SHEETS.map((sheet) => [sheet.resourceId, sheet.path.replace(/^.*\//, "").replace(/\.png$/, "")]),
);

export function retroMonsterSlugFor(monsterResourceId: string | undefined): string | undefined {
  return monsterResourceId ? SLUG_BY_RESOURCE.get(monsterResourceId) : undefined;
}

/**
 * 도트 시트 적의 행동: 앵커 skill_attack(7) + 계약 목록의 스킬(레벨대가 높을수록 많다).
 * 유료 → 8, 필살기 → turn 버스트 9(burstEvery 턴마다), MP 0·무속성·무상태 피해기 → 5.
 * 계약 목록이 없는 slug 는 undefined(호출자가 기존 archetypeActions 를 유지한다).
 */
export function retroMonsterActions(slug: string | undefined): EnemyActionPattern[] | undefined {
  const ids = slug ? RETRO_MONSTER_SKILLSETS[slug] : undefined;
  if (!ids || ids.length === 0) return undefined;
  const actions = [pattern("skill_attack", ANCHOR, { kind: "always" })];
  for (const id of ids) {
    const seed = SEEDS[id];
    if (!seed) throw new Error("retro 몬스터 스킬 레코드 씨앗 누락: " + id);
    if (seed.burstEvery) {
      actions.push(pattern(id, BURST, { kind: "turn", start: seed.burstEvery, interval: seed.burstEvery }));
      continue;
    }
    const skill = RETRO_MONSTER_SKILLS.find((entry) => entry.id === id);
    const plainFree = seed.mp === 0 && seed.kind !== "support" && !(seed.element ?? skill?.element) && !(seed.states?.length);
    actions.push(pattern(id, plainFree ? FIXED_FREE : IDENTITY, { kind: "always" }));
  }
  return actions;
}

/** 기본 DB 적 한 행에 몬스터 스킬 행동을 입힌다. 도트 시트가 없거나 계약 목록이 없으면 그대로 돌려준다. */
export function withRetroMonsterSkills<T extends Pick<EnemyRecord, "monsterResourceId" | "actions">>(enemy: T): T {
  const actions = retroMonsterActions(retroMonsterSlugFor(enemy.monsterResourceId));
  return actions ? { ...enemy, actions } : enemy;
}

