import type { BattleBattlerSnapshot } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import { stateBlocksSkillUse } from "@/battle/battleStates";
import type { Project, SkillId, SkillRecord } from "@/project/types";

export type BattleSkillUser = Pick<
  MutableBattler | BattleBattlerSnapshot,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp" | "skillCooldowns" | "stateIds"
>;
export type MutableBattleSkillUser = Pick<
  MutableBattler,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp" | "skillCooldowns"
>;
export type BattleSkillUseFailure = "missingSkill" | "notLearned" | "skillBlocked" | "insufficientMp" | "noPp" | "cooldown";
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
  if ((user.skillCooldowns?.[skillId] ?? 0) > 0) return "cooldown";
  if (stateBlocksSkillUse(project, user)) return "skillBlocked";
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
  startBattleSkillCooldown(user, skill);
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
    case "skillBlocked":
      return "침묵 상태라 스킬을 사용할 수 없습니다.";
    case "insufficientMp": {
      const cost = skill ? battleSkillMpCost(skill, user.maxMp) : 0;
      return `MP 부족 (필요 ${cost} / 현재 ${user.mp})`;
    }
    case "cooldown": return "재사용 대기 중입니다.";
    case "noPp":
      return "PP가 부족합니다.";
  }
}

/** Includes the casting round; end-of-round decrement leaves N subsequent blocked rounds. */
export function startBattleSkillCooldown(user: Pick<MutableBattler, "skillCooldowns">, skill: SkillRecord): void {
  if ((skill.cooldownTurns ?? 0) > 0) (user.skillCooldowns ??= {})[skill.id] = skill.cooldownTurns! + 1;
}
export function advanceBattleSkillCooldowns(battlers: readonly Pick<MutableBattler, "skillCooldowns">[]): void {
  for (const battler of battlers) for (const id of Object.keys(battler.skillCooldowns ?? {})) {
    const remaining = battler.skillCooldowns![id] - 1;
    if (remaining > 0) battler.skillCooldowns![id] = remaining;
    else delete battler.skillCooldowns![id];
  }
}
