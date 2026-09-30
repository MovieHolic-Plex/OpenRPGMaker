import type {
  BattleAnimationFlash,
  BattleAnimationPosition,
  BattleAnimationRecord,
  BattleAnimationScope,
  BattleAnimationScreenShake,
  BattleAnimationTiming,
  DatabaseStateEffect,
  SkillRecord,
  StateRecord,
} from "../types";
import { SCARLOXY_BATTLE_ANIMATION_SHEET } from "@/assets/scarloxyPack";
import {
  GENERATED_EFFECT_SHEETS,
  generatedEffectCellZoom,
  generatedEffectDatabaseAnimationId,
  generatedEffectFollowUps,
  generatedEffectResourceId,
  generatedEffectSheet,
  type GeneratedEffectSheetSeed,
} from "@/assets/generatedEffectSheets";
import { applyGeneratedBattleEffectSkillBindings } from "./generatedBattleEffectBindings";
import { normalizeBattleAnimationRecord } from "../databaseAnimationRecordModel";
import { normalizeSkillRecord } from "../databaseRecordModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_SKILL_ID, DEFAULT_STATE_ID } from "./constants";
import { retroClassSkillRecords } from "./retroClassSkillRecords";
import { retroMonsterSkillRecords } from "./retroMonsterSkillRecords";
import { retroRosterSkillRecords } from "./retroRosterRecords";
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

export function defaultSkillRecords(): SkillRecord[] {
  const records = [
    skill(DEFAULT_SKILL_ID, "공격", "enemy", 10, DEFAULT_ANIMATION_ID, "기본 무기 공격입니다.", "attack", "hp"),
    skill("skill_sword_slash", "검격", "enemy", 67, "anim_sword", "검으로 적 하나를 강하게 베어냅니다.", "attack", "hp", { variance: 15, hitRate: 95 }),
    skill("skill_arcane_bolt", "마법탄", "enemy", 73, "anim_arrow", "정신력으로 만든 파동을 적에게 날립니다.", "mind", "hp", {
      mpCost: 4,
      variance: 10,
    }),
    skill("skill_fire", "화염", "enemy", 75, "anim_magic", "불 속성 공격에 대응하는 기본 마법입니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "fire" }),
    skill("skill_water", "물대포", "enemy", 73, "anim_magic", "물 타입 공격에 대응하는 기본 기술입니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "water" }),
    // 적 전용 속성 공격. 적마다 11개씩 저작된 속성 저항은 적이 속성 공격을 해야만
    // 의미를 갖는데, 기존에는 fire/water/grass 3종뿐이라 나머지 저항이 전부 사문이었다.
    // 아이템 효과 스킬(skill_item_thunder_stone = "뇌전석 효과")을 적 기술로 재사용하면
    // 드래곤의 기술 이름이 "뇌전석 효과"로 뜬다. 그래서 별도 레코드를 둔다.
    skill("skill_ice", "빙결", "enemy", 75, "anim_gen_ice_shatter", "얼음 속성으로 적을 얼립니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "ice" }),
    skill("skill_thunder", "낙뢰", "enemy", 75, "anim_gen_thunder_strike", "번개 속성으로 적을 내리칩니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "thunder" }),
    skill("skill_earth", "암석 파쇄", "enemy", 75, "anim_gen_earth_spike", "대지 속성으로 적을 짓누릅니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "earth" }),
    skill("skill_wind", "질풍참", "enemy", 73, "anim_gen_wind_slice", "바람 속성으로 적을 베어냅니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "wind" }),
    skill("skill_dark", "암흑 파동", "enemy", 75, "anim_gen_shadow_pulse", "어둠 속성으로 적을 침식합니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "dark" }),
    skill("skill_holy", "성광", "enemy", 75, "anim_gen_holy_beam", "신성 속성으로 적을 정화합니다.", "mind", "hp", { mpCost: 4, variance: 10, elementId: "holy" }),
    skill("skill_item_holy_water", "성수 효과", "enemy", 75, "anim_magic", "성수 계열 아이템이 사용하는 신성 피해 효과입니다.", "mind", "hp", { variance: 10, elementId: "holy" }),
    skill("skill_item_thunder_stone", "뇌전석 효과", "enemy", 79, "anim_magic", "뇌전석 계열 아이템이 사용하는 번개 피해 효과입니다.", "mind", "hp", { variance: 10, elementId: "thunder" }),
    skill("skill_item_frost_vial", "서리병 효과", "enemy", 77, "anim_magic", "서리병 계열 아이템이 사용하는 얼음 피해 효과입니다.", "mind", "hp", { variance: 10, elementId: "ice" }),
    skill("skill_item_quake_stone", "지진석 효과", "enemy", 83, "anim_magic", "지진석 계열 아이템이 사용하는 대지 피해 효과입니다.", "mind", "hp", { variance: 10, elementId: "earth" }),
    skill("skill_item_gale_fan", "질풍 부채 효과", "enemy", 74, "anim_magic", "질풍 부채 계열 아이템이 사용하는 바람 피해 효과입니다.", "mind", "hp", { variance: 10, elementId: "wind" }),
    skill("skill_item_shadow_dust", "그림자 가루 효과", "enemy", 81, "anim_magic", "그림자 가루 계열 아이템이 사용하는 어둠 피해 효과입니다.", "mind", "hp", { variance: 10, elementId: "dark" }),
    skill("skill_leaf", "잎날", "enemy", 73, "anim_arrow", "풀 타입 공격에 대응하는 기본 기술입니다.", "attack", "hp", { mpCost: 3, variance: 10, elementId: "grass" }),
    skill("skill_heal", "치유", "ally", 32, "anim_heal", "아군 하나의 HP를 회복합니다.", "mind", "hp", { mpCost: 3, kind: "healing" }),
    skill("skill_poison_sting", "독침", "enemy", 53, "anim_poison", "독 상태를 노리는 찌르기 기술입니다.", "mind", "hp", {
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
    skill("skill_throwing_knife", "투척 단검", "enemy", 63, "anim_arrow", "투척 단검이 사용하는 물리 피해 효과입니다.", "attack", "hp", {
      variance: 10,
      hitRate: 95,
    }),
    skill("skill_item_poison_vial", "독병 효과", "enemy", 51, "anim_poison", "독병이 사용하는 독 부여 공격입니다.", "mind", "hp", {
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
    // retro2003 직업 스킬 48개(계약 src/assets/retroClassSkills.ts). 기존 스킬 뒤에 붙인다.
    ...retroClassSkillRecords(),
    // retro2003 2차 로스터 스킬(묶음 파일 src/assets/retroRosterSkills/*). 규칙 필드는 계약에서 유도한다(retroRosterRecords.ts).
    ...retroRosterSkillRecords(),
    // retro2003 몬스터 스킬 42개(계약 src/assets/retroMonsterSkills.ts). 도트 적 행동이 쓴다(defaultBattleRecords).
    ...retroMonsterSkillRecords(),
  ];
  applyGeneratedBattleEffectSkillBindings(records);
  return records;
}

export function defaultStateRecords(): StateRecord[] {
  return [
    // 독: 매 턴 지속 피해, 전투 종료 후에도 유지(해독 필요). 3턴째부터 자연 회복 시도.
    { id: DEFAULT_STATE_ID, name: "독", battleAura: "poison-bubble", restriction: "없음", removalCondition: "전투 종료 후 유지", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 20 },
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
    // 공격 하락: 공격 절반 약화, 전투 종료 시 해제.
    { id: "state_attack_down", name: "공격 하락", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 25, runtimeEffects: { attackMultiplier: 0.5, removeOnBattleEnd: true } },
    // 민첩 상승/하락: 엄격 턴 순서와 게이지 충전 속도에 같은 배율을 적용한다.
    { id: "state_agility_up", name: "민첩 상승", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 25, runtimeEffects: { agilityMultiplier: 2, removeOnBattleEnd: true } },
    { id: "state_agility_down", name: "민첩 하락", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 25, runtimeEffects: { agilityMultiplier: 0.5, removeOnBattleEnd: true } },
    // 마비: 행동을 막지만 2턴부터 35% 확률로 자연 회복한다.
    { id: "state_paralysis", name: "마비", restriction: "행동 불가", removalCondition: "턴 경과", recoverNaturallyFromTurn: 2, recoverNaturallyChance: 35, runtimeEffects: { restrictsAction: true, removeOnBattleEnd: true } },
    // 맹독: 독보다 강한 턴당 최대 HP 12% 피해, 치료 전까지 유지한다.
    { id: "state_deep_poison", name: "맹독", battleAura: "poison-bubble", restriction: "없음", removalCondition: "전투 종료 후 유지", recoverNaturallyFromTurn: 4, recoverNaturallyChance: 10, runtimeEffects: { hpDamagePercentPerTurn: 12, removeOnBattleEnd: false } },
    // 재생: 턴당 최대 HP 8%를 회복하고 전투 종료 시 해제한다.
    { id: "state_regen", name: "재생", battleAura: "regen-sparkle", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 5, recoverNaturallyChance: 25, runtimeEffects: { hpHealPercentPerTurn: 8, removeOnBattleEnd: true } },
    // 침묵: 스킬만 막고 기본 공격과 아이템은 허용한다.
    { id: "state_silence", name: "침묵", restriction: "스킬 사용 불가", removalCondition: "전투 종료", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 30, runtimeEffects: { blocksSkillUse: true, removeOnBattleEnd: true } },
    // ── 기믹 상태(2차 로스터 기믹 명시화, 2026-09-29). 크로노 트리거·FF6·FFT 의 시간·방어막·약점 만들기 ──
    // 암흑: 통상 공격 명중 절반(연막·먹물).
    { id: "state_blind", name: "암흑", battleAura: "dark-fog", restriction: "없음", removalCondition: "전투 종료", accuracyModifier: 50, recoverNaturallyFromTurn: 3, recoverNaturallyChance: 30, runtimeEffects: { removeOnBattleEnd: true } },
    // 스톱: 게이지가 멈추고 행동 불가. 짧게(2턴부터 50%) 풀린다.
    { id: "state_stop", name: "스톱", battleAura: "freeze-grey", restriction: "행동 불가", removalCondition: "턴 경과", recoverNaturallyFromTurn: 2, recoverNaturallyChance: 50, runtimeEffects: { freezesGauge: true, restrictsAction: true, removeOnBattleEnd: true } },
    // 프로텍트: 공격력 계열 피해를 ⅔ 로(방어 배율 1.5).
    { id: "state_protect", name: "프로텍트", battleAura: "shield-shimmer", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 5, recoverNaturallyChance: 20, runtimeEffects: { physicalDefenseMultiplier: 1.5, removeOnBattleEnd: true } },
    // 실드: 정신력 계열 피해를 ⅔ 로.
    { id: "state_shell", name: "실드", battleAura: "shield-shimmer", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 5, recoverNaturallyChance: 20, runtimeEffects: { magicDefenseMultiplier: 1.5, removeOnBattleEnd: true } },
    // 버서크(도발 겸): 명령 없이 무작위 상대를 통상 공격한다. 공격은 1.5배.
    { id: "state_berserk", name: "버서크", battleAura: "berserk-pulse", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 30, runtimeEffects: { forcedAction: "attackRandom", attackMultiplier: 1.5, removeOnBattleEnd: true } },
    // 석화: 전투 불능으로 치고 행동 불가. 저절로 풀리지 않는다(치료·전투 종료).
    { id: "state_petrify", name: "석화", battleAura: "petrify-still", restriction: "행동 불가", removalCondition: "전투 종료", runtimeEffects: { incapacitates: true, restrictsAction: true, removeOnBattleEnd: true } },
    // 젖음: 번개 약점(A). 불은 반감(D).
    { id: "state_wet", name: "젖음", battleAura: "wet-drip", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 35, runtimeEffects: { elementRates: { thunder: "A", fire: "D" }, removeOnBattleEnd: true } },
    // 기름: 불 약점(A).
    { id: "state_oiled", name: "기름", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 35, runtimeEffects: { elementRates: { fire: "A" }, removeOnBattleEnd: true } },
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
    // 절차 생성 이펙트 — 96x96 셀을 용도별 8~12프레임으로 렌더한다.
    ...GENERATED_EFFECT_SHEETS.map(generatedEffectAnimation),
  ];
}

// 회복·마법·독은 원래 근접 타격 아트(blow/arrow)를 돌려썼다 — 화면에서 셋이 구분되지 않는
// 근본 원인이었다. id 는 유지해야 기존 스킬·아이템 참조가 안 깨지므로 아트만 갈아탄다.
const LEGACY_EFFECT_NAMES: Readonly<Record<string, string>> = {
  "arcane-nova": "마법 충격",
  "heal-bloom": "회복 빛",
  "poison-mist": "독침",
};

function generatedEffectAnimation(seed: GeneratedEffectSheetSeed): BattleAnimationRecord {
  return normalizeBattleAnimationRecord({
    id: generatedEffectDatabaseAnimationId(seed.slug),
    name: LEGACY_EFFECT_NAMES[seed.slug] ?? seed.name,
    resourceId: generatedEffectResourceId(seed.slug),
    sheet: generatedEffectSheet(seed),
    scope: seed.scope,
    position: seed.position,
    large: seed.scope === "screen" || seed.position === "screen",
    // 시트의 모든 프레임을 순서대로 재생한다. 끝부분 감쇠·소멸 컷을 자르면 뚝 끊긴다.
    frames: Array.from({ length: seed.frameCount }, (_unused, pattern) => ({
      // zoom 은 카탈로그가 정한다 — 전체화면 이펙트만 200 으로 무대 384 논리 px 를 덮는다.
      cells: [{ pattern, x: 0, y: -8, zoom: generatedEffectCellZoom(seed), opacity: 255, visible: true }],
    })),
    timings: generatedEffectTimings(seed),
    // 연출 합성: 착탄 뒤 연기·잔광을 둘째 레코드가 같은 자리에 겹쳐 잇는다(카탈로그 followUps).
    followUps: [...generatedEffectFollowUps(seed)],
  });
}

function generatedEffectTimings(seed: GeneratedEffectSheetSeed): BattleAnimationTiming[] {
  const byFrame = new Map<number, BattleAnimationTiming>();
  const merge = (timing: BattleAnimationTiming): void => {
    byFrame.set(timing.frameIndex, { ...byFrame.get(timing.frameIndex), ...timing });
  };
  if (seed.flash !== undefined) merge(timingFlash(seed.flash));
  if (seed.shake !== undefined) merge(timingShake(seed.shake));
  merge({ frameIndex: seed.sound.frameIndex, soundResourceId: seed.sound.resourceId });
  return [...byFrame.values()].sort((left, right) => left.frameIndex - right.frameIndex);
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
  };
}

function timingShake(seed: BattleAnimationScreenShake & { readonly frameIndex: number }): BattleAnimationTiming {
  return { frameIndex: seed.frameIndex, screenShake: { power: seed.power, speed: seed.speed, durationFrames: seed.durationFrames } };
}

