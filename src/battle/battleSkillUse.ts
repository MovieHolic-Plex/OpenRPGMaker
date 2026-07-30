import type { BattleBattlerSnapshot } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { Project, SkillId, SkillRecord } from "@/project/types";

export type BattleSkillUser = Pick<MutableBattler | BattleBattlerSnapshot, "mp" | "maxMp" | "skillIds">;
export type BattleSkillUseFailure = "missingSkill" | "notLearned" | "insufficientMp";

export function battleSkillMpCost(skill: Pick<SkillRecord, "mpCost">, maxMp: number): number {
  const flat = skill.mpCost.flat ?? 0;
  const percentMax = skill.mpCost.percentMax ?? 0;
  return Math.max(0, Math.trunc(flat) + Math.floor((Math.max(0, maxMp) * percentMax) / 100));
}

export function battleSkillUseFailure(
  project: Project,
  user: BattleSkillUser,
  skillId: SkillId,
  options: { readonly requireLearned?: boolean } = {},
): BattleSkillUseFailure | undefined {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) return "missingSkill";
  if (options.requireLearned !== false && !user.skillIds.includes(skillId)) return "notLearned";
  if (user.mp < battleSkillMpCost(skill, user.maxMp)) return "insufficientMp";
  return undefined;
}

export function battleSkillUseFailureLabel(
  failure: BattleSkillUseFailure,
  skill: SkillRecord | undefined,
  user: Pick<BattleSkillUser, "mp" | "maxMp">,
): string {
  switch (failure) {
    case "missingSkill":
      return "스킬 데이터가 없습니다.";
    case "notLearned":
      return "아직 습득하지 않은 스킬입니다.";
    case "insufficientMp": {
      const cost = skill ? battleSkillMpCost(skill, user.maxMp) : 0;
      return `MP 부족 (필요 ${cost} / 현재 ${user.mp})`;
    }
  }
}
