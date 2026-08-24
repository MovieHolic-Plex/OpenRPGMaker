import { setSwitch, type PlaySession } from "@/project/session";
import { levelForXp, rewardsForLevel, xpForLevel } from "@/project/skillModel";
import type { Project } from "@/project/types";

export type LifeSkillProgressResult =
  | {
      readonly ok: true;
      readonly skillId: string;
      readonly previousXp: number;
      readonly xp: number;
      readonly previousLevel: number;
      readonly level: number;
      readonly levelsGained: readonly number[];
      readonly switchIdsApplied: readonly string[];
      readonly recipeIdsUnlocked: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: "disabled" | "missing-skill" | "invalid-amount" | "invalid-state" | "invalid-reward";
      readonly skillId: string;
    };

export function awardLifeSkillXp(
  project: Project,
  session: PlaySession,
  skillId: string,
  amount: number,
): LifeSkillProgressResult {
  if (!isPositiveSafeInteger(amount)) return { ok: false, reason: "invalid-amount", skillId };
  return changeLifeSkillXp(project, session, skillId, "+=", amount);
}

export function changeLifeSkillXp(
  project: Project,
  session: PlaySession,
  skillId: string,
  op: "=" | "+=" | "-=",
  amount: number,
): LifeSkillProgressResult {
  if (project.system.skillSystem?.enabled !== true) return { ok: false, reason: "disabled", skillId };
  const skill = project.database.lifeSkills?.find((entry) => entry.id === skillId);
  if (!skill) return { ok: false, reason: "missing-skill", skillId };
  if (!isNonNegativeSafeInteger(amount)) return { ok: false, reason: "invalid-amount", skillId };

  const current = session.lifeSkills?.[skillId] ?? { xp: 0, level: 1 };
  const maxXp = xpForLevel(skill.maxLevel);
  if (!isNonNegativeSafeInteger(current.xp) ||
    !isPositiveSafeInteger(current.level) ||
    current.xp > maxXp ||
    current.level !== levelForXp(current.xp, skill.maxLevel)) {
    return { ok: false, reason: "invalid-state", skillId };
  }

  const nextXp = op === "="
    ? Math.min(maxXp, amount)
    : op === "+="
      ? Math.min(maxXp, current.xp + amount)
      : Math.max(0, current.xp - amount);
  const nextLevel = levelForXp(nextXp, skill.maxLevel);
  const levelsGained = nextLevel > current.level
    ? Array.from({ length: nextLevel - current.level }, (_, index) => current.level + index + 1)
    : [];

  const crossedRewards = levelsGained.flatMap((level) => rewardsForLevel(skill, level));
  const switchIds = new Set(project.switches.map((entry) => entry.id));
  const recipeIds = new Set((project.system.craftRecipes ?? []).map((entry) => entry.id));
  if (crossedRewards.some((reward) =>
    (reward.switchId !== undefined && !switchIds.has(reward.switchId)) ||
    (reward.recipeId !== undefined && !recipeIds.has(reward.recipeId)))) {
    return { ok: false, reason: "invalid-reward", skillId };
  }

  session.lifeSkills ??= {};
  session.lifeSkills[skillId] = { xp: nextXp, level: nextLevel };
  const switchIdsApplied: string[] = [];
  const recipeIdsUnlocked: string[] = [];
  for (const reward of crossedRewards) {
    if (reward.switchId) {
      setSwitch(session, reward.switchId, true);
      if (!switchIdsApplied.includes(reward.switchId)) switchIdsApplied.push(reward.switchId);
    }
    if (reward.recipeId) {
      session.unlockedRecipeIds ??= [];
      if (!session.unlockedRecipeIds.includes(reward.recipeId)) {
        session.unlockedRecipeIds.push(reward.recipeId);
        recipeIdsUnlocked.push(reward.recipeId);
      }
    }
  }
  return {
    ok: true,
    skillId,
    previousXp: current.xp,
    xp: nextXp,
    previousLevel: current.level,
    level: nextLevel,
    levelsGained,
    switchIdsApplied,
    recipeIdsUnlocked,
  };
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
