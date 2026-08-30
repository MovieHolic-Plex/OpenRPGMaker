// 적/종족 레코드에 몬스터 그래픽을 강제로 붙인다.
// EnemyRecord 는 안 보이게 하려면 `transparent: true` 를 쓰므로, monsterResourceId 가 비어 있는
// 상태는 언제나 저작 실수다(전투에서 스킨 공용 스프라이트로 대체돼 모든 적이 같은 모습이 된다).

import { searchResources } from "@/assets/resourceSearch";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { Project } from "@/project/types";

/** 이름으로 아무것도 못 찾았을 때 돌려쓰는 대표 몬스터. 종류가 겹치지 않게 계열별로 하나씩 골랐다. */
const GENERIC_MONSTER_RESOURCE_IDS: readonly string[] = [
  "generated-enemy-slime-01",
  "generated-enemy-bat-01",
  "generated-enemy-skeleton-01",
  "generated-enemy-orc-01",
  "generated-enemy-spider-01",
  "generated-enemy-ghost-01",
  "generated-enemy-wolf-01",
  "generated-enemy-golem-01",
  "generated-enemy-zombie-01",
  "generated-enemy-dragon-01",
];

/** 같은 레코드 id 는 항상 같은 폴백을 받고, 다른 id 끼리는 서로 다른 스프라이트로 흩어진다. */
function stableIndex(seed: string, size: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 0x7fffffff;
  }
  return hash % size;
}

export type MonsterGraphicAssignment = {
  readonly resourceId: string;
  readonly matchedByName: boolean;
};

export function assignMonsterResourceId(
  project: Project,
  record: { readonly id: string; readonly name: string },
): MonsterGraphicAssignment | undefined {
  const available = collectResourceIds(project);
  const byName = searchResources("monster", record.name).find((match) => available.has(match.id));
  if (byName) return { resourceId: byName.id, matchedByName: true };

  const generic = GENERIC_MONSTER_RESOURCE_IDS.filter((id) => available.has(id));
  const pool = generic.length > 0
    ? generic
    : searchResources("monster", "*").filter((match) => available.has(match.id)).map((match) => match.id).sort();
  if (pool.length === 0) return undefined;
  return { resourceId: pool[stableIndex(record.id, pool.length)], matchedByName: false };
}

export function monsterGraphicAssignmentWarning(
  label: string,
  record: { readonly name: string },
  assignment: MonsterGraphicAssignment,
): string {
  return assignment.matchedByName
    ? `${label} 누락 → 이름 "${record.name}" 으로 "${assignment.resourceId}" 를 붙였습니다. 다른 외형을 원하면 list_resources(kind:"monster")로 고른 뒤 다시 지정하세요.`
    : `${label} 누락 → 이름 "${record.name}" 에 맞는 몬스터 리소스가 없어 "${assignment.resourceId}" 를 임시로 붙였습니다. list_resources(kind:"monster")로 어울리는 외형을 골라 지정하세요.`;
}
