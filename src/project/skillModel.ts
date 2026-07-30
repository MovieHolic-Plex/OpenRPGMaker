// 생활 스킬(Life Skill) 정규화 — 농사/채광/채집/나씨/전투 XP 레벨링 시스템.
import type { LifeSkillLevelUpReward, LifeSkillRecord, LifeSkillType } from "@/project/types";

const VALID_SKILL_TYPES: readonly LifeSkillType[] = ["farming", "mining", "foraging", "fishing", "combat"];

function isLifeSkillType(value: unknown): value is LifeSkillType {
  return typeof value === "string" && (VALID_SKILL_TYPES as readonly string[]).includes(value);
}

export function normalizeLifeSkillRecord(record: Partial<LifeSkillRecord> & Pick<LifeSkillRecord, "id" | "name">): LifeSkillRecord {
  // maxLevel 은 XP 테이블 길이를 넘을 수 없다 — 넘게 허용하면 levelForXp 가 조용히 10 에서 잘려
  // "maxLevel 50" 레코드가 영원히 레벨 10 에 머문다(스키마와 런타임 불일치).
  const maxLevel = Math.max(1, Math.min(MAX_LIFE_SKILL_LEVEL, Math.trunc(record.maxLevel ?? 0) || 10));
  const levelUpRewards = (record.levelUpRewards ?? []).flatMap((reward): LifeSkillLevelUpReward[] => {
    // 도달 불가능한 레벨의 보상은 발화되지 않으므로 maxLevel 로 클램프한다.
    const level = Math.min(maxLevel, Math.max(1, Math.trunc(reward.level) || 1));
    if (!reward.switchId && !reward.recipeId) return [];
    return [{
      level,
      ...(reward.switchId ? { switchId: String(reward.switchId) } : {}),
      ...(reward.recipeId ? { recipeId: String(reward.recipeId) } : {}),
    }];
  });
  return {
    id: record.id,
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : "스킬",
    skillType: isLifeSkillType(record.skillType) ? record.skillType : "farming",
    maxLevel,
    levelUpRewards,
  };
}

/** XP → 레벨 변환 (임계값: 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500). */
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500];

/** XP 곡선이 지원하는 최대 레벨 — 스타듀밸리와 동일한 10단계. maxLevel 정규화 상한이다. */
export const MAX_LIFE_SKILL_LEVEL = LEVEL_THRESHOLDS.length;

export function levelForXp(xp: number, maxLevel: number = 10): number {
  const capped = Math.max(1, Math.min(maxLevel, LEVEL_THRESHOLDS.length));
  for (let i = capped - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function xpForLevel(level: number): number {
  const idx = Math.max(0, Math.min(LEVEL_THRESHOLDS.length - 1, level - 1));
  return LEVEL_THRESHOLDS[idx];
}

/** 레벨업 보상 중 level에 해당하는 것을 반환. */
export function rewardsForLevel(skill: LifeSkillRecord, level: number): readonly LifeSkillLevelUpReward[] {
  return skill.levelUpRewards.filter((r) => r.level === level);
}
