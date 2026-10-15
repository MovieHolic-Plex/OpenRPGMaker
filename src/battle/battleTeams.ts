// FF6 식 팀 교대 전투. 팀 = 교대 묶음: 한 번에 한 팀만 싸우고 나머지 팀은 대기 열에 선다.
// 정본 계약은 openwiki/runtime-battle.md 「팀 교대」. 설정이 없으면 이 모듈은 아무것도 하지 않는다(기존 동작 그대로).
import { MAX_BATTLE_TEAMS } from "@/project/battleTeamModel";
import type { ActorId, BattleTeamRecord, TeamSwapCost, TroopRecord } from "@/project/types";

export interface ResolvedBattleTeam {
  readonly id: string;
  readonly name: string;
  /** 이번 전투 파티에 실제로 있는 구성원만, 파티 순서대로. */
  readonly actorIds: readonly ActorId[];
}

export const DEFAULT_TEAM_SWAP_COST: TeamSwapCost = "gauge";

/**
 * 저작된 팀을 이번 전투 파티에 맞춘다. 팀에 속하지 않은 파티원은 첫 번째 팀에 붙는다(도구가 경고한다).
 * 구성원이 있는 팀이 둘 미만이면 undefined — 팀 전투가 아니다(기존 동작).
 */
export function resolveBattleTeams(
  teams: readonly BattleTeamRecord[] | undefined,
  partyActorIds: readonly ActorId[],
): readonly ResolvedBattleTeam[] | undefined {
  if (!teams || teams.length < 2) return undefined;
  const inParty = new Set(partyActorIds);
  const claimed = new Set<ActorId>();
  const draft = teams.slice(0, MAX_BATTLE_TEAMS).map((team) => {
    const ids = team.actorIds.filter((id) => inParty.has(id) && !claimed.has(id));
    for (const id of ids) claimed.add(id);
    return { id: team.id, name: team.name, ids };
  });
  const loose = partyActorIds.filter((id) => !claimed.has(id));
  const first = draft.find((team) => team.ids.length > 0) ?? draft[0];
  if (first) first.ids.push(...loose);
  const order = new Map(partyActorIds.map((id, index) => [id, index] as const));
  const resolved = draft
    .map((team) => ({ id: team.id, name: team.name, actorIds: [...team.ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) }))
    .filter((team) => team.actorIds.length > 0);
  return resolved.length >= 2 ? resolved : undefined;
}

export function effectiveTeamSwapCost(
  system: { readonly teamSwapCost?: TeamSwapCost },
  troop: Pick<TroopRecord, "teamSwapCost"> | undefined,
): TeamSwapCost {
  return troop?.teamSwapCost ?? system.teamSwapCost ?? DEFAULT_TEAM_SWAP_COST;
}
