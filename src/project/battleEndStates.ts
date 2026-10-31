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
  // 「전투 N번 뒤 풀림」 상태(칼 기름)는 전투를 넘어 이어져야 센다 — 일반 규칙(clearStatesAfterBattle)으로 지우지 않는다.
  if (Math.trunc(state?.releaseAfterBattles ?? 0) > 0) return false;
  if (project.system.clearStatesAfterBattle === true) return true;
  return BATTLE_END_TEXT.test(state?.removalCondition ?? "");
}

/** 전투 뒤 세션에 남길 상태만. */
export function statesKeptAfterBattle(project: Pick<Project, "system" | "database">, stateIds: readonly StateId[]): StateId[] {
  return stateIds.filter((id) => !stateClearsOnBattleEnd(project, project.database.states.find((state) => state.id === id), id));
}

/**
 * 전투 하나가 끝났다 — releaseAfterBattles 가 있는 상태의 전투 수를 올리고, 다 채운 상태는 뺀다(칼 기름 「싸움 N번」).
 * counts 는 세션의 actorId → stateId → 치른 전투 수. 더는 걸려 있지 않은 상태의 수는 치운다(다시 걸리면 0 부터).
 */
export function releaseStatesAfterBattle(
  project: Pick<Project, "database">,
  counts: Record<string, Record<string, number>>,
  actorId: string,
  stateIds: readonly StateId[],
): StateId[] {
  const mine = (counts[actorId] ??= {});
  const kept: StateId[] = [];
  for (const id of stateIds) {
    const limit = Math.trunc(project.database.states.find((state) => state.id === id)?.releaseAfterBattles ?? 0);
    if (limit > 0) {
      const fought = (mine[id] ?? 0) + 1;
      if (fought >= limit) { delete mine[id]; continue; }
      mine[id] = fought;
    }
    kept.push(id);
  }
  for (const id of Object.keys(mine)) if (!kept.includes(id)) delete mine[id];
  if (Object.keys(mine).length === 0) delete counts[actorId];
  return kept;
}
