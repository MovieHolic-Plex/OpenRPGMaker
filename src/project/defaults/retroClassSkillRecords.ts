// retro2003 직업 스킬 96개(src/assets/retroClassSkills.ts 계약: 기존 6직업 48 + 2026-09-28 확장 6직업 48)의 기본 DB 레코드.
//
// 계약은 연출(모션·레이어)만 정한다. 여기서는 규칙 엔진이 이미 지원하는 필드만으로 효과를 준다 —
// 위력·MP·scope·효과 종류·속성·상태 효과. 대상 편의 정본은 이 레코드의 scope 다(런타임 연출도 scope 를 본다).
// 규칙 엔진에 없는 뜻(도발의 시선 끌기, 반격 태세의 반격, 연막의 명중 저하)은 가장 가까운 상태로 대신한다.
// animationId 는 retro2003 이 아닌 스킨에서 쓰는 기존 생성 이펙트다. retro2003 은 이 층을 띄우지 않는다.
import type { DatabaseStateEffect, SkillRecord } from "../types";
import { RETRO_CLASS_SKILLS } from "@/assets/retroClassSkills";
import { generatedEffectDatabaseAnimationId as anim } from "@/assets/generatedEffectSheets";
import { normalizeSkillRecord } from "../databaseRecordModel";

type Scope = SkillRecord["scope"];
interface Seed {
  readonly scope: Scope;
  readonly mp: number;
  readonly animation: string;
  /** damage(attack|mind) · healing · support · steal */
  readonly kind: "attack" | "mind" | "healing" | "support" | "steal";
  readonly power?: number;
  readonly element?: string;
  readonly states?: readonly DatabaseStateEffect[];
  readonly critical?: number;
  readonly hitRate?: number;
}

const add = (stateId: string, chance = 100): DatabaseStateEffect => ({ stateId, chance, operation: "add" });
const remove = (stateId: string): DatabaseStateEffect => ({ stateId, chance: 100, operation: "remove" });

const SEEDS: Readonly<Record<string, Seed>> = {
  // 전사: 공격력 근접기. 필살기는 신성 속성 대형 일격.
  skill_hero_cross_slash: { scope: "enemy", mp: 3, kind: "attack", power: 62, element: "sword", animation: anim("slash-steel") },
  skill_hero_rush_pierce: { scope: "enemy", mp: 5, kind: "attack", power: 72, element: "spear", animation: anim("slash-steel"), critical: 15 },
  skill_hero_rising_blade: { scope: "enemy", mp: 6, kind: "attack", power: 80, element: "sword", animation: anim("slash-steel"), states: [add("state_defense_down", 35)] },
  skill_hero_flame_sword: { scope: "enemy", mp: 8, kind: "attack", power: 90, element: "fire", animation: anim("fire-burst") },
  skill_hero_whirlwind: { scope: "allEnemies", mp: 12, kind: "attack", power: 64, element: "sword", animation: anim("wind-slice") },
  skill_hero_war_cry: { scope: "allAllies", mp: 10, kind: "support", animation: anim("power-aura"), states: [add("state_attack_up")] },
  skill_hero_meteor_drop: { scope: "enemy", mp: 16, kind: "attack", power: 135, animation: anim("meteor-fall"), critical: 20 },
  skill_hero_brave_blade: { scope: "enemy", mp: 30, kind: "attack", power: 230, element: "holy", animation: anim("holy-beam"), critical: 25 },
  // 수호자: 방패·방어 강화·대지.
  skill_guard_shield_bash: { scope: "enemy", mp: 3, kind: "attack", power: 54, element: "hit", animation: anim("tackle-impact"), states: [add("state_paralysis", 25)] },
  skill_guard_taunt: { scope: "self", mp: 4, kind: "support", animation: anim("power-aura"), states: [add("state_defense_up")] },
  skill_guard_iron_wall: { scope: "allAllies", mp: 12, kind: "support", animation: anim("guard-barrier"), states: [add("state_defense_up")] },
  skill_guard_counter: { scope: "self", mp: 6, kind: "support", animation: anim("power-aura"), states: [add("state_attack_up"), add("state_defense_up")] },
  skill_guard_charge: { scope: "enemy", mp: 8, kind: "attack", power: 82, element: "hit", animation: anim("tackle-impact"), states: [add("state_agility_down", 40)] },
  skill_guard_holy_shield: { scope: "ally", mp: 10, kind: "healing", power: 40, animation: anim("guard-barrier"), states: [add("state_defense_up")] },
  skill_guard_quake: { scope: "allEnemies", mp: 16, kind: "attack", power: 92, element: "earth", animation: anim("earth-spike") },
  skill_guard_fortress: { scope: "allEnemies", mp: 30, kind: "attack", power: 175, element: "earth", animation: anim("earth-spike") },
  // 마도사: 정신력 원소 마법.
  skill_mage_fireball: { scope: "enemy", mp: 4, kind: "mind", power: 72, element: "fire", animation: anim("fire-burst") },
  skill_mage_magic_missile: { scope: "enemy", mp: 3, kind: "mind", power: 64, animation: anim("projectile-shot"), hitRate: 100 },
  skill_mage_blizzard: { scope: "allEnemies", mp: 12, kind: "mind", power: 70, element: "ice", animation: anim("ice-shatter") },
  skill_mage_chain_lightning: { scope: "allEnemies", mp: 10, kind: "mind", power: 62, element: "thunder", animation: anim("thunder-strike"), states: [add("state_paralysis", 15)] },
  skill_mage_gravity: { scope: "enemy", mp: 12, kind: "mind", power: 92, element: "dark", animation: anim("shadow-pulse"), states: [add("state_agility_down", 60)] },
  skill_mage_mana_shield: { scope: "self", mp: 8, kind: "support", animation: anim("guard-barrier"), states: [add("state_defense_up")] },
  skill_mage_meteor: { scope: "allEnemies", mp: 24, kind: "mind", power: 125, element: "fire", animation: anim("meteor-fall") },
  skill_mage_starfall: { scope: "allEnemies", mp: 36, kind: "mind", power: 195, animation: anim("arcane-nova") },
  // 정찰병: 빠른 연속기·독·훔치기.
  skill_scout_twin_strike: { scope: "enemy", mp: 4, kind: "attack", power: 66, element: "sword", animation: anim("claw-rake"), critical: 15 },
  skill_scout_venom_blade: { scope: "enemy", mp: 5, kind: "attack", power: 52, animation: anim("poison-mist"), states: [add("state_poison", 90)] },
  skill_scout_shadow_step: { scope: "enemy", mp: 7, kind: "attack", power: 84, animation: anim("smoke-vanish"), critical: 30 },
  skill_scout_smoke_bomb: { scope: "allEnemies", mp: 8, kind: "support", animation: anim("blind-veil"), states: [add("state_attack_down", 70)] },
  skill_scout_steal: { scope: "enemy", mp: 0, kind: "steal", animation: anim("smoke-vanish") },
  skill_scout_evasion: { scope: "self", mp: 5, kind: "support", animation: anim("power-aura"), states: [add("state_agility_up")] },
  skill_scout_knife_storm: { scope: "allEnemies", mp: 14, kind: "attack", power: 68, animation: anim("projectile-shot") },
  skill_scout_assassinate: { scope: "enemy", mp: 30, kind: "attack", power: 235, element: "dark", animation: anim("critical-burst"), critical: 40 },
  // 성직자: 회복·정화·부활·신성.
  skill_cleric_heal_light: { scope: "ally", mp: 4, kind: "healing", power: 46, animation: anim("heal-bloom") },
  skill_cleric_holy_smite: { scope: "enemy", mp: 5, kind: "mind", power: 68, element: "holy", animation: anim("holy-beam") },
  skill_cleric_purify: { scope: "ally", mp: 4, kind: "support", animation: anim("cleanse-sparkle"),
    states: ["state_poison", "state_deep_poison", "state_sleep", "state_paralysis", "state_silence", "state_attack_down", "state_defense_down", "state_agility_down"].map(remove) },
  skill_cleric_blessing: { scope: "allAllies", mp: 12, kind: "support", animation: anim("power-aura"), states: [add("state_attack_up")] },
  skill_cleric_mass_heal: { scope: "allAllies", mp: 14, kind: "healing", power: 50, animation: anim("heal-bloom") },
  skill_cleric_sanctuary: { scope: "allAllies", mp: 14, kind: "support", animation: anim("guard-barrier"), states: [add("state_regen"), add("state_defense_up")] },
  // 부활: healing + state_death 해제가 런타임의 "쓰러진 아군도 대상" 판정이다(runtime.commandRevives).
  skill_cleric_revive: { scope: "ally", mp: 20, kind: "healing", power: 60, animation: anim("revive-rise"), states: [remove("state_death")] },
  skill_cleric_divine_judgment: { scope: "allEnemies", mp: 34, kind: "mind", power: 185, element: "holy", animation: anim("holy-beam") },
  // 궁수: 활(bow) 속성 공격력 사격, 원소 화살, 자연 회복.
  skill_ranger_power_shot: { scope: "enemy", mp: 3, kind: "attack", power: 74, element: "bow", animation: anim("projectile-shot"), critical: 15 },
  skill_ranger_multi_shot: { scope: "enemy", mp: 5, kind: "attack", power: 72, element: "bow", animation: anim("projectile-shot") },
  skill_ranger_fire_arrow: { scope: "enemy", mp: 6, kind: "attack", power: 78, element: "fire", animation: anim("fire-burst") },
  skill_ranger_frost_arrow: { scope: "enemy", mp: 6, kind: "attack", power: 78, element: "ice", animation: anim("ice-shatter"), states: [add("state_agility_down", 40)] },
  skill_ranger_arrow_rain: { scope: "allEnemies", mp: 12, kind: "attack", power: 66, element: "bow", animation: anim("projectile-shot") },
  skill_ranger_snipe: { scope: "enemy", mp: 12, kind: "attack", power: 125, element: "bow", animation: anim("projectile-shot"), critical: 50, hitRate: 100 },
  skill_ranger_nature_call: { scope: "allAllies", mp: 14, kind: "healing", power: 40, animation: anim("leaf-volley") },
  skill_ranger_storm_arrow: { scope: "allEnemies", mp: 32, kind: "attack", power: 175, element: "thunder", animation: anim("thunder-strike") },
  // ── 2026-09-28 확장 6직업. 규칙 엔진에 없는 뜻은 가장 가까운 상태로 대신한다(아래 주석과 openwiki/runtime-battle.md 표).
  // 사무라이: 발도·검풍 공격력기, 심안 = 민첩 상승(회피·급소 대용), 혈월 = 공격 하락.
  skill_samurai_iai: { scope: "enemy", mp: 3, kind: "attack", power: 66, element: "sword", animation: anim("slash-steel"), critical: 25 },
  skill_samurai_twin_moon: { scope: "enemy", mp: 5, kind: "attack", power: 76, element: "sword", animation: anim("slash-steel") },
  skill_samurai_wind_cut: { scope: "allEnemies", mp: 8, kind: "attack", power: 58, element: "wind", animation: anim("wind-slice") },
  skill_samurai_mind_eye: { scope: "self", mp: 6, kind: "support", animation: anim("power-aura"), states: [add("state_agility_up"), add("state_attack_up")] },
  skill_samurai_cherry: { scope: "enemy", mp: 12, kind: "attack", power: 112, element: "sword", animation: anim("slash-steel"), critical: 20 },
  skill_samurai_thunder_draw: { scope: "allEnemies", mp: 16, kind: "attack", power: 84, element: "thunder", animation: anim("thunder-strike"), states: [add("state_paralysis", 20)] },
  skill_samurai_blood_moon: { scope: "allEnemies", mp: 18, kind: "attack", power: 96, element: "dark", animation: anim("shadow-pulse"), states: [add("state_attack_down", 50)] },
  skill_samurai_final_cut: { scope: "allEnemies", mp: 32, kind: "attack", power: 190, element: "sword", animation: anim("critical-burst"), critical: 30 },
  // 닌자: 투척·둔술. 변신술(통나무 바꿔치기) = 민첩 상승 + 방어 상승, 분신술 = 단일 대상 고위력 연속기(분신 자체는 표현).
  skill_ninja_shuriken: { scope: "enemy", mp: 3, kind: "attack", power: 62, animation: anim("projectile-shot"), critical: 15 },
  skill_ninja_kunai_rain: { scope: "allEnemies", mp: 7, kind: "attack", power: 54, animation: anim("projectile-shot") },
  skill_ninja_fire_style: { scope: "enemy", mp: 6, kind: "mind", power: 80, element: "fire", animation: anim("fire-burst") },
  skill_ninja_substitute: { scope: "self", mp: 6, kind: "support", animation: anim("smoke-vanish"), states: [add("state_agility_up"), add("state_defense_up")] },
  skill_ninja_shadow_clone: { scope: "enemy", mp: 12, kind: "attack", power: 118, element: "sword", animation: anim("smoke-vanish"), critical: 20 },
  skill_ninja_water_dragon: { scope: "allEnemies", mp: 16, kind: "mind", power: 90, element: "water", animation: anim("water-column") },
  skill_ninja_paralyze: { scope: "enemy", mp: 10, kind: "attack", power: 48, animation: anim("paralysis-bind"), states: [add("state_paralysis", 75)] },
  skill_ninja_thousand_blades: { scope: "allEnemies", mp: 32, kind: "attack", power: 182, element: "sword", animation: anim("wind-slice"), critical: 25 },
  // 무도가: 타격(hit) 공격력기. 금강불괴 = 방어 상승, 명상 = 자기 회복 + 재생.
  skill_monk_hundred_fist: { scope: "enemy", mp: 4, kind: "attack", power: 70, element: "hit", animation: anim("tackle-impact") },
  skill_monk_rising_kick: { scope: "enemy", mp: 5, kind: "attack", power: 78, element: "hit", animation: anim("tackle-impact"), states: [add("state_defense_down", 35)] },
  skill_monk_chi_wave: { scope: "enemy", mp: 7, kind: "mind", power: 86, animation: anim("psychic-wave") },
  skill_monk_iron_body: { scope: "self", mp: 6, kind: "support", animation: anim("guard-barrier"), states: [add("state_defense_up")] },
  skill_monk_whirl_kick: { scope: "allEnemies", mp: 12, kind: "attack", power: 68, element: "hit", animation: anim("wind-slice") },
  skill_monk_meditate: { scope: "self", mp: 8, kind: "healing", power: 70, animation: anim("heal-bloom"), states: [add("state_regen")] },
  skill_monk_earth_palm: { scope: "enemy", mp: 14, kind: "attack", power: 128, element: "earth", animation: anim("earth-spike"), states: [add("state_agility_down", 40)] },
  skill_monk_dragon_fist: { scope: "enemy", mp: 30, kind: "attack", power: 240, element: "hit", animation: anim("critical-burst"), critical: 30 },
  // 음유시인: 노래 = 아군 상태·적 상태. 불협화음(혼란) = 공격 하락 + 방어 하락(혼란 상태가 기본 DB 에 없다).
  skill_bard_battle_song: { scope: "allAllies", mp: 6, kind: "support", animation: anim("sonic-wave"), states: [add("state_attack_up")] },
  skill_bard_lullaby: { scope: "allEnemies", mp: 6, kind: "support", animation: anim("sleep-dust"), states: [add("state_sleep", 55)] },
  skill_bard_sonic: { scope: "enemy", mp: 5, kind: "mind", power: 74, element: "wind", animation: anim("sonic-wave") },
  skill_bard_healing_hymn: { scope: "allAllies", mp: 12, kind: "healing", power: 42, animation: anim("heal-bloom") },
  skill_bard_discord: { scope: "allEnemies", mp: 10, kind: "support", animation: anim("confusion-spiral"), states: [add("state_attack_down", 60), add("state_defense_down", 60)] },
  skill_bard_haste: { scope: "allAllies", mp: 12, kind: "support", animation: anim("power-aura"), states: [add("state_agility_up")] },
  skill_bard_requiem: { scope: "allEnemies", mp: 18, kind: "mind", power: 100, element: "dark", animation: anim("shadow-pulse"), states: [add("state_silence", 35)] },
  skill_bard_grand_finale: { scope: "allEnemies", mp: 32, kind: "mind", power: 178, element: "holy", animation: anim("holy-beam") },
  // 드루이드: 자연 마법. 가시 덩굴·대지의 속박 = 민첩 하락(속박), 곰 변신 = 공격력 할퀴기(변신 자체는 표현).
  skill_druid_thorn: { scope: "enemy", mp: 4, kind: "mind", power: 64, element: "earth", animation: anim("leaf-volley"), states: [add("state_agility_down", 40)] },
  skill_druid_regrowth: { scope: "ally", mp: 5, kind: "healing", power: 44, animation: anim("heal-bloom"), states: [add("state_regen")] },
  skill_druid_swarm: { scope: "enemy", mp: 6, kind: "mind", power: 56, animation: anim("poison-mist"), states: [add("state_poison", 80)] },
  skill_druid_bark_skin: { scope: "allAllies", mp: 10, kind: "support", animation: anim("guard-barrier"), states: [add("state_defense_up")] },
  skill_druid_entangle: { scope: "allEnemies", mp: 12, kind: "mind", power: 58, element: "earth", animation: anim("earth-spike"), states: [add("state_agility_down", 60)] },
  skill_druid_moonbeam: { scope: "enemy", mp: 12, kind: "mind", power: 118, element: "holy", animation: anim("holy-beam") },
  skill_druid_bear_form: { scope: "enemy", mp: 14, kind: "attack", power: 132, animation: anim("claw-rake"), critical: 15 },
  skill_druid_world_tree: { scope: "allEnemies", mp: 34, kind: "mind", power: 176, element: "earth", animation: anim("leaf-volley") },
  // 마녀: 저주·흡수. 개구리 변신 = 공격 하락 + 침묵, 생명 흡수 = 어둠 피해(흡수 회복은 규칙에 없다), 거울 장막 = 방어 상승.
  skill_witch_hex: { scope: "enemy", mp: 4, kind: "mind", power: 48, element: "dark", animation: anim("shadow-pulse"), states: [add("state_defense_down", 80)] },
  skill_witch_frog: { scope: "enemy", mp: 8, kind: "support", animation: anim("smoke-vanish"), states: [add("state_attack_down", 75), add("state_silence", 75)] },
  skill_witch_cauldron: { scope: "allEnemies", mp: 10, kind: "mind", power: 50, animation: anim("poison-mist"), states: [add("state_poison", 70)] },
  skill_witch_drain: { scope: "enemy", mp: 8, kind: "mind", power: 84, element: "dark", animation: anim("drain-orbs") },
  skill_witch_bats: { scope: "allEnemies", mp: 12, kind: "mind", power: 70, element: "dark", animation: anim("shadow-pulse") },
  skill_witch_mirror: { scope: "self", mp: 10, kind: "support", animation: anim("guard-barrier"), states: [add("state_defense_up")] },
  skill_witch_nightmare: { scope: "allEnemies", mp: 18, kind: "mind", power: 92, element: "dark", animation: anim("sleep-dust"), states: [add("state_sleep", 40)] },
  skill_witch_moon_sabbath: { scope: "allEnemies", mp: 36, kind: "mind", power: 198, element: "dark", animation: anim("shadow-pulse") },
};

function record(id: string, name: string, description: string, seed: Seed): SkillRecord {
  const effect: SkillRecord["effect"] = seed.kind === "attack" || seed.kind === "mind"
    ? { kind: "damage", statistic: seed.kind, affects: "hp" }
    : seed.kind === "healing" ? { kind: "healing", statistic: "mind", affects: "hp" }
      : seed.kind === "steal" ? { kind: "steal" } : { kind: "support" };
  return normalizeSkillRecord({
    id,
    name,
    scope: seed.scope,
    power: seed.power ?? 0,
    animationId: seed.animation,
    description: description.endsWith(".") ? description : description + ".",
    mpCost: { flat: seed.mp, percentMax: 0 },
    successRate: 100,
    variance: seed.kind === "support" || seed.kind === "steal" ? 0 : 15,
    hitRate: seed.hitRate ?? (seed.kind === "attack" ? 95 : 100),
    effect,
    elementId: seed.element,
    stateEffects: seed.states ? [...seed.states] : undefined,
    ...(seed.critical !== undefined ? { criticalRate: seed.critical } : {}),
  });
}

/** 계약 순서 그대로 96개. 계약에 레코드 씨앗이 없으면 곧바로 실패한다(계약과 DB 가 어긋나지 않게). */
export function retroClassSkillRecords(): SkillRecord[] {
  return RETRO_CLASS_SKILLS.map((skill) => {
    const seed = SEEDS[skill.id];
    if (!seed) throw new Error("retro 직업 스킬 레코드 씨앗 누락: " + skill.id);
    return record(skill.id, skill.name, skill.description, seed);
  });
}

/** 직업별 레벨 습득 목록(계약의 level). defaultClassRecords 가 기존 스킬 뒤에 붙인다. */
export function retroClassLearnedSkills(classId: string): { level: number; skillId: string }[] {
  return RETRO_CLASS_SKILLS.filter((skill) => skill.classId === classId).map((skill) => ({ level: skill.level, skillId: skill.id }));
}

