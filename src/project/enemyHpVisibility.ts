import type { Project } from "@/project/types";

/** 보스 HP 숨김(EnemyRecord.hideHp) — 전투 화면이 이 적의 HP 막대·숫자를 그리지 않는다. 아군·없는 기록은 false. */
export function enemyHidesHp(project: Project, recordId: string | undefined): boolean {
  if (!recordId) return false;
  return project.database.enemies.find((entry) => entry.id === recordId)?.hideHp === true;
}
