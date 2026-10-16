import type { ActorId, Project, RewardPolicy } from "@/project/types";

export function rewardActorIds(
  project: Project,
  partyActorIds: readonly ActorId[],
  participatingActorIds: readonly ActorId[] | undefined
): ActorId[] {
  if (project.system.rewardPolicy?.participationOnly !== true) return [...partyActorIds];
  const participants = new Set(participatingActorIds ?? []);
  return partyActorIds.filter((actorId) => participants.has(actorId));
}

export function expForRewardActor(
  baseExp: number,
  actorLevel: number,
  enemyLevel: number | undefined,
  policy: RewardPolicy | undefined
): number {
  const exp = Math.max(0, Math.trunc(baseExp));
  if (policy?.levelGapPenalty !== true) return exp;
  const gap = Math.max(0, Math.trunc(actorLevel) - Math.max(1, Math.trunc(enemyLevel ?? 1)));
  if (gap >= 10) return Math.floor(exp * 0.1);
  if (gap >= 5) return Math.floor(exp * 0.5);
  return exp;
}

export interface MonsterExpPlan {
  /** 몬스터 한 마리가 받는 경험치. */
  readonly exp: number;
  /** 경험치를 받는 몬스터. undefined = 파티 전원(기존 동작). */
  readonly participantIds: readonly string[] | undefined;
}

/**
 * 몬스터 파티 전투의 경험치 분배. rewardPolicy.expSplitAlive 가 켜져 있으면 참전자 중 쓰러지지 않은 몬스터만 받고
 * 총량을 그 수로 나눈다(총량이 있으면 최소 1). 꺼져 있으면 전원 전액 — 기존 동작 그대로.
 * 런타임 미리보기와 세션 적립이 같은 함수를 써서 결과 화면의 숫자와 실제 적립이 어긋나지 않는다.
 */
export function monsterExpPlan(
  policy: RewardPolicy | undefined,
  earnedExp: number,
  participantIds: readonly string[] | undefined,
  aliveIds: ReadonlySet<string>,
): MonsterExpPlan {
  const exp = Math.max(0, Math.trunc(earnedExp));
  if (policy?.expSplitAlive !== true || participantIds === undefined) return { exp, participantIds };
  const alive = participantIds.filter((id) => aliveIds.has(id));
  if (alive.length === 0 || exp <= 0) return { exp: 0, participantIds: alive };
  return { exp: Math.max(1, Math.floor(exp / alive.length)), participantIds: alive };
}
