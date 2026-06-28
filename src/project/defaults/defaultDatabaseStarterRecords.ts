import type {
  BattleAnimationFlash,
  BattleAnimationPosition,
  BattleAnimationRecord,
  BattleAnimationScope,
  BattleAnimationScreenShake,
  BattleAnimationTiming,
  BattlerAnimationPoseKind,
  BattlerAnimationRecord,
  SkillRecord,
  StateRecord,
} from "../types";
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
    skill("skill_fire", "화염", "enemy", 30, "anim_magic", "불 속성 공격에 대응하는 기본 마법입니다.", "mind", "hp", { mpCost: 4, variance: 10 }),
    skill("skill_heal", "치유", "ally", 32, "anim_heal", "아군 하나의 HP를 회복합니다.", "mind", "hp", { mpCost: 3, kind: "healing" }),
    skill("skill_poison_sting", "독침", "enemy", 8, "anim_poison", "독 상태를 노리는 찌르기 기술입니다.", "mind", "hp", {
      successRate: 85,
      hitRate: 90,
    }),
    supportSkill("skill_sleep_mist", "수면 안개", "enemy", "수면 상태 연출에 쓰는 보조 기술입니다.", "anim_magic", 5, 75),
    supportSkill("skill_focus", "집중", "self", "공격 상승 상태를 노리는 자기 강화 기술입니다.", DEFAULT_ANIMATION_ID, 2),
    supportSkill("skill_weaken", "약화", "enemy", "방어 하락 상태를 노리는 약화 기술입니다.", "anim_magic", 3, 80),
    skill("skill_item_potion", "회복약 효과", "ally", 40, "anim_heal", "회복약이 사용하는 HP 회복 효과입니다.", "mind", "hp", { kind: "healing" }),
    skill("skill_item_ether", "마력약 효과", "ally", 24, "anim_magic", "마력약이 사용하는 MP 회복 효과입니다.", "mind", "mp", { kind: "healing" }),
  ];
}

export function defaultStateRecords(): StateRecord[] {
  return [
    { id: DEFAULT_STATE_ID, name: "독" },
    { id: "state_sleep", name: "수면" },
    { id: "state_attack_up", name: "공격 상승" },
    { id: "state_defense_down", name: "방어 하락" },
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
  options: { readonly kind?: "damage" | "healing"; readonly mpCost?: number; readonly successRate?: number; readonly variance?: number; readonly hitRate?: number } = {},
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
  });
}

function supportSkill(id: string, name: string, scope: SkillRecord["scope"], description: string, animationId: string, mpCost: number, successRate = 100): SkillRecord {
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
