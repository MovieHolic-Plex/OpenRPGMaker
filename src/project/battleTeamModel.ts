// 팀 교대 전투(system.battleTeams) 정규화·상수. 전투 런타임·편집기·도구가 함께 쓴다.
import type { BattleTeamRecord, TeamSwapCost } from "@/project/types";

export const MAX_BATTLE_TEAMS = 4;

export const TEAM_SWAP_COST_LABELS: Readonly<Record<TeamSwapCost, string>> = {
  free: "즉시 — 들어온 팀이 바로 행동한다",
  gauge: "게이지 — 들어온 팀은 게이지 0 에서 시작한다(기본)",
  turn: "한 턴 — 들어온 팀은 적이 한 번 행동할 때까지 쉰다",
};

export function isTeamSwapCost(value: unknown): value is TeamSwapCost {
  return value === "free" || value === "gauge" || value === "turn";
}

/** 로드·저장 정규화. 모양이 깨진 팀은 버리고, 같은 배우는 앞 팀이 가진다. 팀이 없으면 undefined(키를 만들지 않는다). */
export function normalizeBattleTeams(value: unknown): BattleTeamRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seenTeams = new Set<string>();
  const claimed = new Set<string>();
  const teams: BattleTeamRecord[] = [];
  for (const raw of value.slice(0, MAX_BATTLE_TEAMS)) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as { id?: unknown; name?: unknown; actorIds?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || seenTeams.has(id)) continue;
    seenTeams.add(id);
    const actorIds = (Array.isArray(record.actorIds) ? record.actorIds : [])
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0 && !claimed.has(entry))
      .filter((entry, index, all) => all.indexOf(entry) === index);
    for (const actorId of actorIds) claimed.add(actorId);
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 24) : id;
    teams.push({ id, name, actorIds });
  }
  return teams.length > 0 ? teams : undefined;
}
