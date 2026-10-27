import type { SkillRecord } from "@/project/types";

/**
 * 기술 하나가 가질 수 있는 포켓몬식 전투 규칙 어휘(모두 선택 필드 — 생략하면 기존 기술 그대로):
 * 고정 피해(fixedDamage) · 반동(recoilPercent) · 무작위 연속 타수(multiHit) · 풀죽음(flinchChance).
 * 정규화·굴림·문장 계산을 한 곳에 둔다. 전투 런타임·저장 정규화·자료집 화면이 이 값만 읽는다.
 */

const FIXED_DAMAGE_MAX = 999;
export const MULTI_HIT_LIMIT = 5;

export function normalizeFixedDamage(value: unknown): SkillRecord["fixedDamage"] {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { mode?: unknown; amount?: unknown };
  if (raw.mode === "level") return { mode: "level" };
  if (raw.mode === "amount" && typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount >= 1) {
    return { mode: "amount", amount: Math.min(FIXED_DAMAGE_MAX, Math.floor(raw.amount)) };
  }
  return undefined;
}

export function normalizeMultiHit(value: unknown): SkillRecord["multiHit"] {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { min?: unknown; max?: unknown };
  if (typeof raw.min !== "number" || typeof raw.max !== "number" || !Number.isFinite(raw.min) || !Number.isFinite(raw.max)) return undefined;
  const min = Math.max(2, Math.min(MULTI_HIT_LIMIT, Math.floor(raw.min)));
  const max = Math.max(min, Math.min(MULTI_HIT_LIMIT, Math.floor(raw.max)));
  return { min, max };
}

/** 고정 피해 양. 시전자 레벨은 몬스터가 아니면 1 로 읽는다. 상한 FIXED_DAMAGE_MAX. */
/** 충전 끊기(SkillRecord.chargeBreak) 정규화. 조건(damage·elementIds·stateIds)이 하나도 없으면 버린다. */
export function normalizeChargeBreak(value: unknown): SkillRecord["chargeBreak"] {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const ids = (list: unknown): string[] => Array.isArray(list)
    ? [...new Set(list.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))].slice(0, 8)
    : [];
  const damage = typeof raw.damage === "number" && Number.isFinite(raw.damage) && raw.damage >= 1 ? Math.min(999999, Math.floor(raw.damage)) : undefined;
  const elementIds = ids(raw.elementIds);
  const stateIds = ids(raw.stateIds);
  if (damage === undefined && elementIds.length === 0 && stateIds.length === 0) return undefined;
  const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim().slice(0, 120) : undefined;
  return {
    ...(damage !== undefined ? { damage } : {}),
    ...(elementIds.length ? { elementIds } : {}),
    ...(stateIds.length ? { stateIds } : {}),
    ...(message ? { message } : {}),
    ...(raw.stagger === false ? { stagger: false } : {}),
  };
}

export function fixedDamageAmount(rule: SkillRecord["fixedDamage"], userLevel: number | undefined): number | undefined {
  if (!rule) return undefined;
  if (rule.mode === "level") return Math.max(1, Math.min(FIXED_DAMAGE_MAX, Math.floor(userLevel ?? 1)));
  return rule.amount;
}

/**
 * 연속 기술의 이번 타수. `roll` 은 0 이상 1 미만 난수(전투 rng). 2~5 는 원작 비율(2·3 번 3/8, 4·5 번 1/8),
 * 그 밖의 구간은 같은 확률. 규칙이 없으면 undefined(= 한 번, rng 를 쓰지 않는다).
 */
export function rollMultiHitCount(rule: SkillRecord["multiHit"], roll: () => number): number | undefined {
  if (!rule) return undefined;
  if (rule.min === rule.max) return rule.min;
  if (rule.min === 2 && rule.max === 5) {
    const r = roll();
    return r < 0.375 ? 2 : r < 0.75 ? 3 : r < 0.875 ? 4 : 5;
  }
  return rule.min + Math.min(rule.max - rule.min, Math.floor(roll() * (rule.max - rule.min + 1)));
}

/** 반동으로 시전자가 입을 피해. 피해를 줬을 때만, 최소 1. */
export function recoilDamageFor(recoilPercent: number | undefined, dealt: number): number {
  if (!recoilPercent || recoilPercent <= 0 || dealt <= 0) return 0;
  return Math.max(1, Math.floor(dealt * recoilPercent / 100));
}

/** 자료집·조수가 읽는 한 줄 요약(없으면 빈 배열). */
export function skillBattleRuleLabels(skill: Pick<SkillRecord, "fixedDamage" | "recoilPercent" | "multiHit" | "flinchChance">): string[] {
  const labels: string[] = [];
  if (skill.fixedDamage) labels.push(skill.fixedDamage.mode === "level" ? "고정 피해(레벨만큼)" : `고정 피해 ${skill.fixedDamage.amount}`);
  if (skill.multiHit) labels.push(skill.multiHit.min === skill.multiHit.max ? `${skill.multiHit.min}회 연속` : `${skill.multiHit.min}~${skill.multiHit.max}회 연속`);
  if (skill.recoilPercent) labels.push(`반동 ${skill.recoilPercent}%`);
  if (skill.flinchChance) labels.push(`풀죽음 ${skill.flinchChance}%`);
  return labels;
}
