// 연출 자동 추천 — 계약도 없고 retroChoreographyId 도 없는 스킬에 **기믹(종류·대상·타수·속성·상태)** 으로 기본 연출을 고른다.
// 순수·결정적 함수 하나를 세 자리가 같이 쓴다: 런타임(전투 재생), 편집기 스킬 탭(「자동: ○○」), 조수 upsert_skill 결과 문구.
// 기본 검(sword_slash)·마법탄(arcane_bolt) 한 벌로 떨어지지 않게, 기존 96개 기본 계약 중 상황에 맞는 것을 고르고
// 속성이 계약 고유 속성과 다르면 충격·투사체 층에 속성색(tint 프리셋)을 입힌다. 새 그림은 만들지 않는다.
import { retroClassSkill } from "@/assets/retroSkillCatalog";
import type { RetroClassSkill, RetroFxLayer } from "@/assets/retroClassSkills";
import { retroTintFilter } from "@/assets/retroChoreographyTints";
import type { SkillRecord } from "@/project/types/database";

export type RetroRecommendInput = Pick<SkillRecord, "id" | "name" | "scope" | "effect"> & Partial<Pick<SkillRecord, "elementId" | "hitSequence" | "stateEffects">>;

export interface RetroChoreographyRecommendation {
  /** 바탕이 되는 기본 계약 id. */
  readonly baseId: string;
  /** 속성 색(tint 프리셋 id). 계약 고유 속성과 같으면 없다. */
  readonly tint?: string;
  /** 다단 스킬이면 타수마다 착탄 층을 다시 깐다. */
  readonly each: boolean;
  /** 사람이 읽는 이름. 「자동: ○○」 라벨에 그대로 쓴다. */
  readonly label: string;
  /** 왜 이 연출인지 한 줄(라벨 툴팁·조수 결과용). */
  readonly reason: string;
  /** 이 추천을 그대로 재생하는 합성 계약(id 는 스킬 id). */
  readonly skill: RetroClassSkill;
}

const ELEMENTS = new Set(["fire", "ice", "thunder", "water", "earth", "wind", "holy", "dark"]);
const ELEMENT_WORDS: readonly [RegExp, string][] = [
  [/화염|불꽃|fire|flame|inferno|blaze/i, "fire"], [/빙결|얼음|냉기|눈보라|\bice\b|frost|blizzard/i, "ice"], [/번개|낙뢰|전격|thunder|lightning/i, "thunder"],
  [/대지|암석|지진|earth|quake/i, "earth"], [/질풍|돌풍|\bwind\b|gale/i, "wind"], [/성스|신성|성광|holy|divine|smite/i, "holy"],
  [/암흑|어둠|dark|shadow|abyss/i, "dark"], [/독침|맹독|독안개|poison|venom/i, "poison"],
];
/** 계약이 이미 그 속성이라 색을 덧입히지 않는 경우(계약 id → 속성). */
const NATIVE_ELEMENT: Readonly<Record<string, string>> = {
  skill_hero_flame_sword: "fire", skill_mage_fireball: "fire", skill_mage_meteor: "fire", skill_ranger_fire_arrow: "fire",
  skill_mage_blizzard: "ice", skill_ranger_frost_arrow: "ice", skill_mage_chain_lightning: "thunder",
  skill_cleric_holy_smite: "holy", skill_cleric_divine_judgment: "holy", skill_witch_bats: "dark", skill_scout_venom_blade: "poison",
};

function elementOf(skill: RetroRecommendInput): string | undefined {
  if (skill.elementId && ELEMENTS.has(skill.elementId)) return skill.elementId;
  if (skill.elementId === "poison") return "poison";
  const named = ELEMENT_WORDS.find(([word]) => word.test(skill.name))?.[1];
  if (named) return named;
  return skill.stateEffects?.some((effect) => effect.operation === "add" && effect.stateId === "state_poison") ? "poison" : undefined;
}

interface Pick3 { readonly baseId: string; readonly reason: string; readonly each?: boolean }

function choose(skill: RetroRecommendInput, element: string | undefined): Pick3 | undefined {
  const effect = skill.effect;
  const hits = skill.hitSequence?.length ?? 1;
  const multi = hits > 1;
  const all = skill.scope === "allEnemies";
  const states = skill.stateEffects?.filter((row) => row.operation === "add").map((row) => row.stateId) ?? [];
  if (effect.kind === "healing") {
    return skill.scope === "allAllies"
      ? { baseId: "skill_cleric_mass_heal", reason: "전체 회복 — 아군 전체에 회복 빛" }
      : { baseId: "skill_cleric_heal_light", reason: "단일 회복 — 대상에 회복 빛" };
  }
  if (effect.kind === "steal") return { baseId: "skill_scout_steal", reason: "훔치기 — 기습 접근" };
  if (effect.kind === "scan") return { baseId: "skill_cleric_purify", reason: "조사 — 대상에 맑은 빛" };
  if (effect.kind === "support") {
    if (skill.scope === "allAllies") return { baseId: "skill_cleric_blessing", reason: "전체 강화 — 아군 전체 축복" };
    if (skill.scope === "self") return { baseId: "skill_hero_war_cry", reason: "자기 강화 — 시전자 기합" };
    if (skill.scope === "ally") return { baseId: "skill_guard_holy_shield", reason: "아군 강화 — 대상에 보호막" };
    if (states.includes("state_sleep")) return { baseId: "skill_bard_lullaby", reason: "적 수면 — 잠재우는 음표" };
    return all
      ? { baseId: "skill_bard_discord", reason: "적 전체 약화 — 어지러운 음파" }
      : { baseId: "skill_witch_hex", reason: "적 약화 — 저주 표식" };
  }
  if (effect.kind !== "damage") return undefined;
  const magic = effect.statistic === "mind";
  if (magic) {
    if (all) {
      const byElement: Readonly<Record<string, string>> = { fire: "skill_mage_meteor", ice: "skill_mage_blizzard", thunder: "skill_mage_chain_lightning", dark: "skill_witch_bats" };
      return { baseId: byElement[element ?? ""] ?? "skill_mage_chain_lightning", reason: `마법 전체 공격${element ? ` · ${element}` : ""}` };
    }
    const byElement: Readonly<Record<string, string>> = { fire: "skill_mage_fireball", holy: "skill_cleric_holy_smite" };
    return { baseId: byElement[element ?? ""] ?? (multi ? "skill_mage_magic_missile" : element ? "skill_mage_fireball" : "skill_mage_magic_missile"), reason: `마법 단일 공격${multi ? ` · ${hits}연타` : ""}${element ? ` · ${element}` : ""}`, each: multi };
  }
  if (all) return { baseId: "skill_hero_whirlwind", reason: `물리 전체 공격${element ? ` · ${element}` : ""}` };
  if (skill.elementId === "bow") return { baseId: multi ? "skill_ranger_multi_shot" : "skill_ranger_power_shot", reason: "활 공격", each: multi };
  if (skill.elementId === "spear") return { baseId: "skill_hero_rush_pierce", reason: "창 공격" };
  if (hits >= 4) return { baseId: "skill_monk_hundred_fist", reason: `${hits}연타 — 난타 동작`, each: true };
  if (multi) return { baseId: "skill_scout_twin_strike", reason: `${hits}연타 — 다단 동작${element ? ` + ${element} 충격` : ""}`, each: true };
  if (element === "fire") return { baseId: "skill_hero_flame_sword", reason: "불 속성 검격" };
  if (element === "poison") return { baseId: "skill_scout_venom_blade", reason: "독 속성 검격" };
  return { baseId: "skill_hero_cross_slash", reason: element ? `${element} 속성 검격` : "물리 단일 공격" };
}

/** 색을 입힐 층 — 시전자 쪽 준비 층(먼지·기합)은 원색으로 둔다. */
function tintLayers(layers: readonly RetroFxLayer[], tint: string | undefined, each: boolean): RetroFxLayer[] {
  const lastImpact = (() => { for (let i = layers.length - 1; i >= 0; i -= 1) if (layers[i].anchor === "target" || layers[i].anchor === "allTargets") return i; return -1; })();
  return layers.map((layer, index) => ({
    ...layer,
    ...(tint && layer.anchor !== "user" ? { tint } : {}),
    ...(each && index === lastImpact && layer.anchor === "target" ? { onHit: "each" as const } : {}),
  }));
}

/**
 * 계약·연출 지정이 없는 스킬의 자동 연출. 종류(피해/회복/강화) → 대상 → 타수 → 속성 순으로 정한다.
 * 정할 수 없는 종류(switch 등)는 undefined — 호출자가 예전 방식(낱말 레시피)으로 내려간다.
 */
export function recommendRetroChoreography(skill: RetroRecommendInput | undefined): RetroChoreographyRecommendation | undefined {
  if (!skill) return undefined;
  const element = elementOf(skill);
  const pick = choose(skill, element);
  const base = pick ? retroClassSkill(pick.baseId) : undefined;
  if (!pick || !base) return undefined;
  const native = NATIVE_ELEMENT[base.id];
  const tint = element && element !== native && retroTintFilter(element) ? element : undefined;
  const each = Boolean(pick.each) && (skill.hitSequence?.length ?? 1) > 1;
  const skillShape: RetroClassSkill = { ...base, id: skill.id, name: skill.name, layers: tintLayers(base.layers, tint, each) };
  return { baseId: base.id, ...(tint ? { tint } : {}), each, label: `${base.name}${tint ? ` (${element})` : ""}`, reason: pick.reason, skill: skillShape };
}
