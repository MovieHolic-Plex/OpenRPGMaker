import type { Project } from "./types";

export class BattleAdmissionError extends Error {
  readonly name = "BattleAdmissionError";
  constructor(
    readonly code: "BATTLE_TROOP_MISSING" | "BATTLE_TROOP_EMPTY" | "BATTLE_ENEMY_MISSING" | "BATTLE_VARIABLE_INVALID" | "BATTLE_MONSTER_PARTY_EMPTY",
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
  const enemyIds = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
  const known = new Set(project.database.enemies.map((enemy) => enemy.id));
  const missing = [...new Set(enemyIds.filter((id) => !known.has(id)))];
  if (missing.length > 0) {
    return new BattleAdmissionError("BATTLE_ENEMY_MISSING",
      `전투를 시작할 수 없습니다. 적 그룹 '${troop.name}' (${troop.id})의 적이 없습니다: ${missing.join(", ")}. 적 그룹 구성을 다시 선택하세요.`);
  }
  return undefined;
}
