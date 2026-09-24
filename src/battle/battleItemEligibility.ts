import type { ItemRecord, Project } from "@/project/types";
import { isItemActorEligible } from "@/project/itemEligibility";

type ItemUser = {
  readonly recordId: string;
  readonly classId?: string;
  readonly monsterInstanceId?: string;
  readonly speciesId?: string;
};

/** Battle instance IDs are not database actor IDs. Keep admission and execution aligned. */
export function isBattleItemUserEligible(project: Project, item: ItemRecord, user: ItemUser): boolean {
  if (!user.monsterInstanceId) return isItemActorEligible(project, item, user.recordId, user.classId);
  if (item.type !== "medicine" && item.type !== "book" && item.type !== "seed") return true;
  // Books/seeds and actor/class-restricted medicine retain their actor-only contract.
  return item.type === "medicine"
    && Boolean(user.speciesId && project.database.monsterSpecies?.some(species => species.id === user.speciesId))
    && item.usableActorIds.length === 0
    && item.usableClassIds.length === 0;
}
