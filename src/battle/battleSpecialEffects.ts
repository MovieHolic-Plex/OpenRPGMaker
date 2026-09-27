import type { EnemyRecord, EnemyStealItem, ItemId, Project, SkillEffect, SkillId, SkillRecord } from "@/project/types";

/** 전투 특수 명령 효과(훔치기·라이브라·청마법·무작위 기술). 피해 계산에서는 support 처럼 0 을 낸다. */
export type SpecialSkillEffectKind = "steal" | "scan" | "learnEnemySkill" | "randomSkillFrom";

export function isSpecialSkillEffectKind(kind: SkillEffect["kind"]): kind is SpecialSkillEffectKind {
  return kind === "steal" || kind === "scan" || kind === "learnEnemySkill" || kind === "randomSkillFrom";
}

/** 피해 공식이 아는 효과 종류로 접는다 — 특수 효과는 피해 0 의 support 다. */
export function damageEffectKind(kind: SkillEffect["kind"]): "damage" | "healing" | "support" | "switch" {
  return isSpecialSkillEffectKind(kind) ? "support" : kind;
}

export function specialSkillEffectLabel(effect: SkillEffect): string {
  switch (effect.kind) {
    case "steal": return "훔치기";
    case "scan": return "라이브라(능력 탐색)";
    case "learnEnemySkill": return "적 기술 습득(청마법)";
    case "randomSkillFrom": return `무작위 기술 ${effect.skillIds.length}종 중 하나`;
    default: return "특수 효과";
  }
}

/** 훔치기 표 정규화. 아이템 id 가 비었거나 rate 가 숫자가 아니면 버린다. */
export function normalizeStealItems(items: readonly Partial<EnemyStealItem>[] | undefined): EnemyStealItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((entry): entry is EnemyStealItem => typeof entry?.itemId === "string" && entry.itemId.length > 0 && Number.isFinite(entry.rate))
    .slice(0, 8)
    .map((entry) => ({ itemId: entry.itemId, rate: Math.max(0, Math.min(100, Math.round(entry.rate))) }));
}

/** 표를 위에서부터 차례로 굴린다(첫 성공 하나). rng 는 [0,1). */
export function rollStealItem(enemy: Pick<EnemyRecord, "stealItems">, rng: () => number): ItemId | undefined {
  for (const entry of normalizeStealItems(enemy.stealItems)) {
    if (rng() * 100 < entry.rate) return entry.itemId;
  }
  return undefined;
}

/** 약점(A·B 등급) 속성 이름. 적 레코드 등급과 상태 덮어쓰기를 합친 최종 등급은 호출자가 넘긴다. */
export function weaknessElementNames(project: Project, rates: Record<string, string | undefined>): string[] {
  return (project.database.elements ?? [])
    .filter((element) => rates[element.id] === "A" || rates[element.id] === "B")
    .map((element) => element.name || element.id);
}

export function scanMessage(
  name: string,
  vitals: { readonly hp: number; readonly maxHp: number; readonly mp: number; readonly maxMp: number },
  weaknesses: readonly string[],
): string {
  const weak = weaknesses.length > 0 ? `약점 ${weaknesses.join("·")}` : "약점 없음";
  return `${name} — HP ${vitals.hp}/${vitals.maxHp} · MP ${vitals.mp}/${vitals.maxMp} · ${weak}`;
}

/** 대상 적이 쓰는 learnable 기술 중 아직 모르는 첫 번째. */
export function firstLearnableSkill(project: Project, enemySkillIds: readonly SkillId[], known: readonly SkillId[]): SkillRecord | undefined {
  for (const skillId of enemySkillIds) {
    if (known.includes(skillId)) continue;
    const skill = project.database.skills.find((record) => record.id === skillId);
    if (skill?.learnable) return skill;
  }
  return undefined;
}

/** 무작위 기술 후보 — 존재하고 자기 자신처럼 다시 무작위인 기술은 뺀다(무한 재귀 방지). */
export function pickRandomSkill(project: Project, skillIds: readonly SkillId[], rng: () => number): SkillRecord | undefined {
  const candidates = skillIds
    .map((id) => project.database.skills.find((record) => record.id === id))
    .filter((skill): skill is SkillRecord => Boolean(skill) && skill!.effect.kind !== "randomSkillFrom");
  if (candidates.length === 0) return undefined;
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
}
