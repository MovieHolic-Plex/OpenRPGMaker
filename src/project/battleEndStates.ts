import type { Project, StateId, StateRecord } from "@/project/types";

// 전투가 끝날 때 어떤 상태가 남는가(2026-10-25, 폴른 스타 사용자 지적 「상태 이상이 전투 뒤에도 남는다」).
// 일반 규칙(system.clearStatesAfterBattle) 또는 상태 하나(StateRecord.clearOnBattleEnd) — 조수가 둘 다 쓸 수 있다.
// 전투 불능(state_death)은 HP 와 짝이라 여기서 풀지 않는다(부활은 회복·여관의 몫).

const DEATH_STATE_ID = "state_death";
// 「전투 종료」(풀림) 와 「전투 종료 후 유지」(남음)를 가른다.
const BATTLE_END_TEXT = /(전투\s*종료|전투가?\s*끝나|battle\s*end)(?!\S*\s*(후|뒤|에도)?\s*(유지|남|persist|remain))/iu;

export function stateClearsOnBattleEnd(project: Pick<Project, "system">, state: StateRecord | undefined, stateId: StateId): boolean {
  if (stateId === DEATH_STATE_ID) return false;
  if (state?.clearOnBattleEnd === true) return true;
  if (state?.clearOnBattleEnd === false) return false;
  if (project.system.clearStatesAfterBattle === true) return true;
  return BATTLE_END_TEXT.test(state?.removalCondition ?? "");
}

/** 전투 뒤 세션에 남길 상태만. */
export function statesKeptAfterBattle(project: Pick<Project, "system" | "database">, stateIds: readonly StateId[]): StateId[] {
  return stateIds.filter((id) => !stateClearsOnBattleEnd(project, project.database.states.find((state) => state.id === id), id));
}
