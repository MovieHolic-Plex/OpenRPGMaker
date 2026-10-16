import type { ItemRecord, Project } from "@/project/types";
import { activeItemEffects, itemAllowsMenu } from "@/project/itemUsage";
import { isEvolutionItemId } from "@/project/monsterCollection";

/**
 * 진화의 돌: 별도 필드 없이 «어떤 종의 진화 조건(requires.itemId)이 가리키는 아이템»으로 정해진다.
 * 그래서 조수가 돌 아이템을 upsert_item 으로 만들고 종에 진화 조건만 적으면 필드 메뉴에서도 바로 쓴다.
 * 돌봄·지닌 도구·기술머신·실제 회복 효과가 있는 약은 그 자기 효과가 우선이다(돌이 아니다).
 */
export function isEvolutionStone(project: Project, item: ItemRecord): boolean {
  if (!isEvolutionItemId(project, item.id)) return false;
  if (item.careProfile || item.heldEffect || item.learnedSkillId) return false;
  if (item.type === "medicine") {
    const heals = item.hpRecovery.flat > 0 || item.hpRecovery.percentMax > 0
      || item.mpRecovery.flat > 0 || item.mpRecovery.percentMax > 0
      || (item.ppRecovery?.flat ?? 0) > 0 || (item.ppRecovery?.percentMax ?? 0) > 0
      || item.healStateIds.length > 0 || item.stateEffects.length > 0;
    if (heals) return false;
  }
  return item.type !== "book" && item.type !== "switch" && item.type !== "seed";
}

/** 필드 메뉴에서 쓸 수 있는가 — 기존 종류별 규칙에 더해, 쓸 수 있는 때(field/always)의 진화의 돌. */
export function itemAllowsFieldMenu(project: Project, item: ItemRecord): boolean {
  if (itemAllowsMenu(activeItemEffects(item))) return true;
  return (item.occasion === "field" || item.occasion === "always") && isEvolutionStone(project, item);
}
