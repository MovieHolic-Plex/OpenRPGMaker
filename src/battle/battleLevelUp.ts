// 자동 레벨업 순수 로직. 누적 경험치를 expCurve 와 대조해 레벨을 올리고,
// 파라미터 곡선으로 능력치 성장분을 산출하며, 새로 습득하는 스킬을 모은다.
import { ACTOR_LEVEL_MAX, normalizeActorRecord, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import type { Project, SkillId } from "@/project/types";

export interface BattleLevelUpResult {
  readonly actorId: string;
  readonly actorName: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  // maxHp/maxMp 증가분(현재치 보전에 가산). RM2K3 방식: 증가분만큼 현재 HP/MP 를 올린다.
  readonly maxHpGain: number;
  readonly maxMpGain: number;
  readonly attackGain: number;
  readonly defenseGain: number;
  readonly mindGain: number;
  readonly agilityGain: number;
  // 새 레벨 구간(fromLevel < level <= toLevel)에서 습득하는 스킬.
  readonly learnedSkillIds: readonly SkillId[];
}

// 액터 한 명의 레벨업을 판정. 변화가 없으면 null.
// currentLevel: 판정 전 레벨, totalExp: 판정 후의 누적 경험치.
export function computeActorLevelUp(
  project: Project,
  actorId: string,
  currentLevel: number,
  totalExp: number
): BattleLevelUpResult | null {
  const record = project.database.actors.find((entry) => entry.id === actorId);
  if (!record) return null;
  const actor = normalizeActorRecord(record);
  const maxLevel = actor.maxLevel;
  let level = Math.max(1, Math.min(currentLevel, maxLevel));
  const fromLevel = level;
  // 다중 레벨업 지원: 다음 레벨 누적 필요 경험치를 넘는 동안 계속 올린다.
  while (level < maxLevel && level < ACTOR_LEVEL_MAX && totalExp >= totalExpForLevel(actor.expCurve, level + 1)) {
    level += 1;
  }
  if (level === fromLevel) return null;

  const curves = actor.parameterCurves;
  const gainOf = (curve: readonly number[]) => parameterValueAtLevel(curve, level) - parameterValueAtLevel(curve, fromLevel);
  const learnedSkillIds = actor.learnedSkills
    .filter((entry) => entry.level > fromLevel && entry.level <= level)
    .map((entry) => entry.skillId);

  return {
    actorId,
    actorName: actor.name,
    fromLevel,
    toLevel: level,
    maxHpGain: gainOf(curves.maxHp),
    maxMpGain: gainOf(curves.maxMp),
    attackGain: gainOf(curves.attack),
    defenseGain: gainOf(curves.defense),
    mindGain: gainOf(curves.mind),
    agilityGain: gainOf(curves.agility),
    learnedSkillIds,
  };
}
