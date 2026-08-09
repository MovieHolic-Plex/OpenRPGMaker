import type { ItemRecord, Project } from "@/project/types";

/**
 * 순수 아이템 사용 자격 규칙. UI/Phaser 참조 없음 — project 도메인 규칙이다.
 * `src/player/playerItemUse.ts` 의 메뉴 경로와 `src/battle/runtime.ts` 의 전투 경로가
 * 모두 이 정본을 사용한다.
 */
export function isItemActorEligible(
  project: Project,
  item: ItemRecord,
  actorId: string | undefined,
  effectiveClassId?: string
): boolean {
  if (item.type !== "medicine" && item.type !== "book" && item.type !== "seed") return true;
  if (!actorId || !project.database.actors.some((actor) => actor.id === actorId)) return false;
  if (item.usableActorIds.length > 0 && !item.usableActorIds.includes(actorId)) return false;
  const classId = effectiveClassId ?? project.database.actors.find((actor) => actor.id === actorId)?.classId;
  if (item.usableClassIds.length > 0 && (!classId || !item.usableClassIds.includes(classId))) return false;
  return true;
}
