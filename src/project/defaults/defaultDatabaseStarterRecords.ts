import type {
  BattleAnimationFlash,
  BattleAnimationPosition,
  BattleAnimationRecord,
  BattleAnimationScope,
  BattleAnimationScreenShake,
  BattleAnimationTiming,
  BattlerAnimationPoseKind,
  BattlerAnimationRecord,
  DatabaseStateEffect,
  SkillRecord,
  StateRecord,
} from "../types";
import { SCARLOXY_BATTLE_ANIMATION_SHEET } from "@/assets/scarloxyPack";
import { normalizeBattleAnimationRecord, normalizeBattlerAnimationRecord } from "../databaseAnimationRecordModel";
import { normalizeSkillRecord } from "../databaseRecordModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_SKILL_ID, DEFAULT_STATE_ID } from "./constants";
export { defaultItemRecords } from "./defaultDatabaseItemRecords";

type BattleEffectAnimationSeed = {
  readonly id: string;
  readonly name: string;
  readonly resourceId: string;
  readonly scope: BattleAnimationScope;
  readonly position: BattleAnimationPosition;
  readonly timings: readonly BattleAnimationTiming[];
};

type BattleAnimationFlashSeed = {
  readonly frameIndex: number;
  readonly target: BattleAnimationFlash["target"];
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly durationFrames: number;
  readonly soundResourceId?: string;
};

const DEFAULT_BATTLER_POSES = ["idle", "ready", "attack", "defend", "damage", "victory", "dead"] as const satisfies readonly BattlerAnimationPoseKind[];

export function defaultSkillRecords(): SkillRecord[] {
  return [
    skill(DEFAULT_SKILL_ID, "공격", "enemy", 10, DEFAULT_ANIMATION_ID, "기본 무기 공격입니다.", "attack", "hp"),
    skill("skill_sword_slash", "검격", "enemy", 22, "anim_sword", "검으로 적 하나를 강하게 베어냅니다.", "attack", "hp", { variance: 15, hitRate: 95 }),
    skill("skill_arcane_bolt", "마법탄", "enemy", 28, "anim_arrow", "정신력으로 만든 파동을 적에게 날립니다.", "mind", "hp", {
      mpCost: 4,
      variance: 10,
    }),
    skill("skill_fire", "화염", "enemy", 30, "anim_magic", "불 속성 공격에 대응하는 기본 마법입니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "fire" }),
    skill("skill_water", "물대포", "enemy", 28, "anim_magic", "물 타입 공격에 대응하는 기본 기술입니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "water" }),
    skill("skill_leaf", "잎날", "enemy", 28, "anim_arrow", "풀 타입 공격에 대응하는 기본 기술입니다.", "attack", "hp", { mpCost: 3, variance: 10, elementId: "grass" }),
    skill("skill_heal", "치유", "ally", 32, "anim_heal", "아군 하나의 HP를 회복합니다.", "mind", "hp", { mpCost: 3, kind: "healing" }),
    skill("skill_poison_sting", "독침", "enemy", 8, "anim_poison", "독 상태를 노리는 찌르기 기술입니다.", "mind", "hp", {
      successRate: 85,
      hitRate: 90,
      stateEffects: [{ stateId: DEFAULT_STATE_ID, chance: 85, operation: "add" }],
    }),
    supportSkill("skill_sleep_mist", "수면 안개", "enemy", "수면 상태 연출에 쓰는 보조 기술입니다.", "anim_magic", 5, 75, [
      { stateId: "state_sleep", chance: 75, operation: "add" },
    ]),
    supportSkill("skill_focus", "집중", "self", "공격 상승 상태를 노리는 자기 강화 기술입니다.", DEFAULT_ANIMATION_ID, 2, 100, [
      { stateId: "state_attack_up", chance: 100, operation: "add" },
    ]),
    supportSkill("skill_weaken", "약화", "enemy", "방어 하락 상태를 노리는 약화 기술입니다.", "anim_magic", 3, 80, [
      { stateId: "state_defense_down", chance: 80, operation: "add" },
    ]),
    skill("skill_item_potion", "회복약 효과", "ally", 40, "anim_heal", "회복약이 사용하는 HP 회복 효과입니다.", "mind", "hp", { kind: "healing" }),
    skill("skill_item_hi_potion", "상급 회복약 효과", "ally", 80, "anim_heal", "상급 회복약이 사용하는 HP 회복 효과입니다.", "mind", "hp", { kind: "healing" }),
    skill("skill_item_ether", "마력약 효과", "ally", 24, "anim_magic", "마력약이 사용하는 MP 회복 효과입니다.", "mind", "mp", { kind: "healing" }),
    skill("skill_item_elixir", "엘릭서 효과", "ally", 100, "anim_magic", "엘릭서가 사용하는 HP 회복 효과입니다. MP는 아이템 회복 필드로 처리합니다.", "mind", "hp", { kind: "healing" }),
    skill("skill_throwing_knife", "투척 단검", "enemy", 18, "anim_arrow", "투척 단검이 사용하는 물리 피해 효과입니다.", "attack", "hp", {
      variance: 10,
      hitRate: 95,
    }),
    skill("skill_item_poison_vial", "독병 효과", "enemy", 6, "anim_poison", "독병이 사용하는 독 부여 공격입니다.", "mind", "hp", {
      successRate: 90,
      hitRate: 95,
      stateEffects: [{ stateId: DEFAULT_STATE_ID, chance: 85, operation: "add" }],
    }),
    supportSkill("skill_item_antidote", "해독 효과", "ally", "해독초가 사용하는 독 해제 효과입니다.", "anim_heal", 0, 100, [
      { stateId: DEFAULT_STATE_ID, chance: 100, operation: "remove" },
    ]),
    supportSkill("skill_item_wake", "각성 효과", "ally", "각성 아이템이 사용하는 수면 해제 효과입니다.", "anim_heal", 0, 100, [
      { stateId: "state_sleep", chance: 100, operation: "remove" },
    ]),
    supportSkill("skill_item_panacea", "만능 치료 효과", "ally", "만능약이 사용하는 상태이상 해제 효과입니다.", "anim_heal", 0, 100, [
      { stateId: DEFAULT_STATE_ID, chance: 100, operation: "remove" },
      { stateId: "state_sleep", chance: 100, operation: "remove" },
    ]),
    supportSkill("skill_item_guard", "수호 효과", "ally", "수호 부적이 사용하는 방어 상승 효과입니다.", "anim_heal", 0, 100, [
      { stateId: "state_defense_up", chance: 100, operation: "add" },
    ]),
  ];
}

export function defaultStateRecords(): StateRecord[] {
  return [
    // 독: 매 턴 지속 피해, 전투 종료 후에도 유지(해독 필요). 3턴째부터 자연 회복 시도.
    { id: DEFAULT_STATE_ID, name: "독", restriction: "없음", removalCondition: "전투 종료 후 유지", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 20 },
    // 수면: 행동 불가, 피격 시 50% 해제, 전투 종료 시 해제.
    { id: "state_sleep", name: "수면", restriction: "행동 불가", removalCondition: "피격 또는 전투 종료", recoverWhenHitChance: 50, recoverNaturallyFromTurn: 2, recoverNaturallyChance: 35 },
    // 공격 상승: 공격 2배 강화, 전투 종료 시 해제.
    { id: "state_attack_up", name: "공격 상승", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 25 },
    // 방어 상승: 방어 2배 강화, 전투 종료 시 해제.
    {
      id: "state_defense_up",
      name: "방어 상승",
      restriction: "없음",
      removalCondition: "전투 종료",
      recoverNaturallyFromTurn: 4,
      recoverNaturallyChance: 25,
      runtimeEffects: { defenseMultiplier: 2, removeOnBattleEnd: true },
    },
    // 방어 하락: 방어 절반 약화, 전투 종료 시 해제.
    { id: "state_defense_down", name: "방어 하락", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 25 },
  ];
}

export function defaultBattleAnimationRecords(): BattleAnimationRecord[] {
  return [
    effectAnimation({
      id: DEFAULT_ANIMATION_ID,
      name: "타격",
      resourceId: "easyrpg-battle-blow",
      scope: "singleTarget",
      position: "center",
      timings: [timingFlash({ frameIndex: 0, target: "target", red: 255, green: 255, blue: 255, durationFrames: 4 })],
    }),
    effectAnimation({
      id: "anim_sword",
      name: "검격",
      resourceId: "easyrpg-battle-sword1",
      scope: "singleTarget",
      position: "center",
      timings: [timingFlash({ frameIndex: 1, target: "target", red: 255, green: 240, blue: 220, durationFrames: 5 })],
    }),
    effectAnimation({
      id: "anim_arrow",
      name: "화살",
      resourceId: "easyrpg-battle-arrow",
      scope: "singleTarget",
      position: "center",
      timings: [timingShake({ frameIndex: 1, power: 2, speed: 4, durationFrames: 5 })],
    }),
    effectAnimation({
      id: "anim_magic",
      name: "마법 충격",
      resourceId: "easyrpg-battle-blow",
      scope: "allTargets",
      position: "screen",
      timings: [
        timingFlash({ frameIndex: 0, target: "screen", red: 120, green: 180, blue: 255, durationFrames: 8, soundResourceId: "easyrpg-sound-magic1" }),
        timingShake({ frameIndex: 2, power: 3, speed: 5, durationFrames: 8 }),
      ],
    }),
    effectAnimation({
      id: "anim_heal",
      name: "회복 빛",
      resourceId: "easyrpg-battle-blow",
      scope: "singleTarget",
      position: "head",
      timings: [timingFlash({ frameIndex: 0, target: "target", red: 160, green: 255, blue: 180, durationFrames: 6, soundResourceId: "easyrpg-sound-recovery5" })],
    }),
    effectAnimation({
      id: "anim_poison",
      name: "독침",
      resourceId: "easyrpg-battle-arrow",
      scope: "singleTarget",
      position: "center",
      timings: [timingFlash({ frameIndex: 1, target: "target", red: 120, green: 255, blue: 120, durationFrames: 5, soundResourceId: "easyrpg-sound-poison" })],
    }),
    // Scarloxy MPWSP01 팩 이펙트 — 96x96 4프레임 가로 스트립(scripts/import-scarloxy-pack.py 변환).
    scarloxyEffectAnimation("anim_scarloxy_explosion", "폭발 (Scarloxy)", "explosion", [
      timingFlash({ frameIndex: 0, target: "target", red: 255, green: 200, blue: 120, durationFrames: 5 }),
      timingShake({ frameIndex: 1, power: 3, speed: 5, durationFrames: 6 }),
    ]),
    scarloxyEffectAnimation("anim_scarloxy_fire", "화염 (Scarloxy)", "fire", [
      timingFlash({ frameIndex: 1, target: "target", red: 255, green: 140, blue: 60, durationFrames: 5 }),
    ]),
    scarloxyEffectAnimation("anim_scarloxy_green", "풀잎 (Scarloxy)", "green", [
      timingFlash({ frameIndex: 1, target: "target", red: 140, green: 255, blue: 120, durationFrames: 5 }),
    ]),
    scarloxyEffectAnimation("anim_scarloxy_ice", "얼음 (Scarloxy)", "ice", [
      timingFlash({ frameIndex: 1, target: "target", red: 170, green: 230, blue: 255, durationFrames: 5 }),
    ]),
    scarloxyEffectAnimation("anim_scarloxy_scratch", "할퀴기 (Scarloxy)", "scratch", [
      timingFlash({ frameIndex: 1, target: "target", red: 255, green: 255, blue: 255, durationFrames: 4 }),
    ]),
    scarloxyEffectAnimation("anim_scarloxy_splash", "물보라 (Scarloxy)", "splash", [
      timingFlash({ frameIndex: 1, target: "target", red: 120, green: 180, blue: 255, durationFrames: 5 }),
    ]),
  ];
}

export function defaultBattlerAnimationRecords(): BattlerAnimationRecord[] {
  return [
    battlerAnimation("battler_anim_hero", "영웅 배틀 포즈", "generated-actor-hero-01-battle"),
    battlerAnimation("battler_anim_guardian", "수호자 배틀 포즈", "generated-actor-hero-02-battle"),
  ];
}

function skill(
  id: string,
  name: string,
  scope: SkillRecord["scope"],
  power: number,
  animationId: string,
  description: string,
  statistic: "attack" | "mind",
  affects: "hp" | "mp",
  options: { readonly kind?: "damage" | "healing"; readonly mpCost?: number; readonly successRate?: number; readonly variance?: number; readonly hitRate?: number; readonly elementId?: string; readonly stateEffects?: DatabaseStateEffect[] } = {},
): SkillRecord {
  return normalizeSkillRecord({
    id,
    name,
    scope,
    power,
    animationId,
    description,
    mpCost: { flat: options.mpCost ?? 0, percentMax: 0 },
    successRate: options.successRate ?? 100,
    variance: options.variance ?? 20,
    hitRate: options.hitRate ?? 100,
    effect: options.kind === "healing" ? { kind: "healing", statistic: "mind", affects } : { kind: "damage", statistic, affects },
    elementId: options.elementId,
    stateEffects: options.stateEffects,
  });
}

function supportSkill(id: string, name: string, scope: SkillRecord["scope"], description: string, animationId: string, mpCost: number, successRate = 100, stateEffects?: DatabaseStateEffect[]): SkillRecord {
  return normalizeSkillRecord({
    id,
    name,
    scope,
    power: 0,
    animationId,
    description,
    mpCost: { flat: mpCost, percentMax: 0 },
    successRate,
    effect: { kind: "support" },
    stateEffects,
  });
}

function effectAnimation(seed: BattleEffectAnimationSeed): BattleAnimationRecord {
  return normalizeBattleAnimationRecord({
    id: seed.id,
    name: seed.name,
    resourceId: seed.resourceId,
    sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
    scope: seed.scope,
    position: seed.position,
    large: seed.scope === "screen",
    frames: [
      { cells: [{ pattern: 0, x: 0, y: -8, zoom: 100, opacity: 255, visible: true }] },
      { cells: [{ pattern: 1, x: 0, y: -8, zoom: 110, opacity: 220, visible: true }] },
      { cells: [{ pattern: 2, x: 0, y: -8, zoom: 120, opacity: 180, visible: true }] },
    ],
    timings: [...seed.timings],
  });
}

// Scarloxy 이펙트는 4프레임 전체를 순서대로 재생한다(96x96, columns 4).
function scarloxyEffectAnimation(id: string, name: string, key: string, timings: readonly BattleAnimationTiming[]): BattleAnimationRecord {
  return normalizeBattleAnimationRecord({
    id,
    name,
    resourceId: `scarloxy-battle-anim-${key}`,
    sheet: { ...SCARLOXY_BATTLE_ANIMATION_SHEET },
    scope: "singleTarget",
    position: "center",
    frames: [0, 1, 2, 3].map((pattern) => ({
      cells: [{ pattern, x: 0, y: -8, zoom: 100, opacity: 255, visible: true }],
    })),
    timings: [...timings],
  });
}

function timingFlash(seed: BattleAnimationFlashSeed): BattleAnimationTiming {
  return {
    frameIndex: seed.frameIndex,
    flash: {
      target: seed.target,
      color: { red: seed.red, green: seed.green, blue: seed.blue, gray: 0 },
      durationFrames: seed.durationFrames,
    },
    soundResourceId: seed.soundResourceId,
  };
}

function timingShake(seed: BattleAnimationScreenShake & { readonly frameIndex: number }): BattleAnimationTiming {
  return { frameIndex: seed.frameIndex, screenShake: { power: seed.power, speed: seed.speed, durationFrames: seed.durationFrames } };
}

function battlerAnimation(id: string, name: string, resourceId: string): BattlerAnimationRecord {
  return normalizeBattlerAnimationRecord({
    id,
    name,
    resourceId,
    poses: DEFAULT_BATTLER_POSES.map((pose) => ({
      pose,
      frames: [
        { pattern: 0, durationMs: 180 },
        { pattern: 1, durationMs: 180 },
      ],
    })),
  });
}
