import type { BattleBattlerSnapshot } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { Project, SkillId, SkillRecord } from "@/project/types";

export type BattleSkillUser = Pick<
  MutableBattler | BattleBattlerSnapshot,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp"
>;
export type MutableBattleSkillUser = Pick<
  MutableBattler,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp"
>;
export type BattleSkillUseFailure = "missingSkill" | "notLearned" | "insufficientMp" | "noPp";
export type BattleSkillResourceConsumption =
  | { readonly kind: "pp" | "mp"; readonly remaining: number }
  | { readonly kind: "none" };

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
  if (usesSkillPp(project, user, skill)) {
    const currentPp = user.skillPp?.[skillId] ?? Math.max(1, Math.trunc(skill.maxPp ?? 1));
    if (currentPp <= 0) return "noPp";
    return undefined;
  }
  if (user.mp < battleSkillMpCost(skill, user.maxMp)) return "insufficientMp";
  return undefined;
}

/** Runtime-ready single authority for MP/PP consumption. */
export function consumeBattleSkillResource(
  project: Project,
  user: MutableBattleSkillUser,
  skillId: SkillId,
): BattleSkillResourceConsumption {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) return { kind: "none" };
  if (usesSkillPp(project, user, skill)) {
    const maxPp = Math.max(1, Math.trunc(skill.maxPp ?? 1));
    const currentPp = user.skillPp?.[skillId] ?? maxPp;
    const remaining = Math.max(0, Math.trunc(currentPp) - 1);
    user.skillPp ??= {};
    user.skillPp[skillId] = remaining;
    return { kind: "pp", remaining };
  }
  const remaining = Math.max(0, user.mp - battleSkillMpCost(skill, user.maxMp));
  user.mp = remaining;
  return { kind: "mp", remaining };
}

function usesSkillPp(
  project: Pick<Project, "system">,
  user: Pick<BattleSkillUser, "monsterInstanceId">,
  skill: Pick<SkillRecord, "maxPp">,
): boolean {
  return skill.maxPp !== undefined
    && (typeof user.monsterInstanceId === "string" || project.system.battleModel === "gen1");
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
    case "noPp":
      return "PP가 부족합니다.";
  }
}
