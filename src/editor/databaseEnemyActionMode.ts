import type { EnemyActionPattern, SkillId } from "@/project/types";

export type EnemyActionBehaviourMode = "basic" | "skill";

export function enemyActionBehaviourMode(action: Pick<EnemyActionPattern, "skillId">): EnemyActionBehaviourMode {
  return action.skillId ? "skill" : "basic";
}

/** Apply behaviour mode: basic clears skillId; skill sets/keeps a skill id. */
export function applyEnemyActionBehaviourMode(
  action: EnemyActionPattern,
  mode: EnemyActionBehaviourMode,
  skillId: SkillId | "" = "",
): EnemyActionPattern {
  if (mode === "basic") {
    return { ...action, skillId: "" as SkillId };
  }
  return { ...action, skillId: (skillId || action.skillId || "") as SkillId };
}
