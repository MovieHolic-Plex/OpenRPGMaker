import type { Project } from "./types";

export class BattleAdmissionError extends Error {
  readonly name = "BattleAdmissionError";
  constructor(
    readonly code: "BATTLE_TROOP_MISSING" | "BATTLE_TROOP_EMPTY" | "BATTLE_VARIABLE_INVALID" | "BATTLE_MONSTER_PARTY_EMPTY",
    message: string,
  ) {
    super(message);
  }
}

/** Match enemyBattlers: populated members win; otherwise legacy enemyIds apply.
 * Hidden members still belong to the encounter and may appear through battle events. */
export function battleTroopError(project: Project, troopId: string): BattleAdmissionError | undefined {
  const troop = project.database.troops.find(record => record.id === troopId);
  if (!troop) return new BattleAdmissionError("BATTLE_TROOP_MISSING",
    troopId ? `전투를 시작할 수 없습니다. 적 그룹 '${troopId}'이 없습니다. 적 그룹을 다시 선택하세요.`
      : "전투를 시작할 수 없습니다. 적 그룹을 선택하세요.");
  if (!troop.members?.length && !troop.enemyIds?.length) {
    return new BattleAdmissionError("BATTLE_TROOP_EMPTY", `전투를 시작할 수 없습니다. 적 그룹 '${troop.name}' (${troop.id})에 적을 추가하세요.`);
  }
  return undefined;
}
