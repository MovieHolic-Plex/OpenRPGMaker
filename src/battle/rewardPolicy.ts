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
  if (gap >= 10) return Math.floor(exp * 0.5);
  if (gap >= 5) return Math.floor(exp * 0.7);
  return exp;
}
