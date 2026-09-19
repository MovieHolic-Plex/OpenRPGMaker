import type { Project } from "@/project/types";
import { commandsReferenceLocations } from "./databaseCommandReferences";

/** Shared by manual deletion/rename and AI deletion; inspect the supplied draft. */
export function craftRecipeReferenceMessage(project: Project, id: string): string | undefined {
  const locations = commandsReferenceLocations(project, "craftRecipes", id);
  if (locations.length) return `이벤트 명령 ${locations.length}곳에서 이 제작법을 사용 중입니다.`;
  const skill = (project.database.lifeSkills ?? []).find((entry) => entry.levelUpRewards.some((reward) => reward.recipeId === id));
  if (skill) return `생활 기술 '${skill.name}'의 레벨 보상이 이 제작법을 사용 중입니다.`;
  const bundle = (project.system.bundles ?? []).find((entry) => entry.reward?.recipeIds?.includes(id));
  if (bundle) return `꾸러미 '${bundle.name ?? bundle.id}'의 보상이 이 제작법을 사용 중입니다.`;
  const museum = (project.system.museum?.rewards ?? []).find((entry) => entry.reward?.recipeIds?.includes(id));
  if (museum) return `박물관 보상 '${museum.name ?? museum.id}'이 이 제작법을 사용 중입니다.`;
  return undefined;
}
