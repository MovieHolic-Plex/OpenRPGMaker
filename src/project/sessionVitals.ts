import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import type { ActorId, Project } from "@/project/types";

export type ActorVitals = {
  readonly maxHp: number;
  readonly maxMp: number;
  hp: number;
  mp: number;
};

export function initialActorVitals(project: Project): Record<ActorId, ActorVitals> {
  const vitals: Record<ActorId, ActorVitals> = {};
  for (const actorId of project.session.partyActorIds) {
    syncActorVitals(project, vitals, actorId);
  }
  return vitals;
}

export function syncActorVitals(project: Project, vitals: Record<ActorId, ActorVitals>, actorId: ActorId): void {
  if (vitals[actorId]) return;
  const actor = project.database.actors.find((entry) => entry.id === actorId);
  if (!actor) return;
  const normalizedActor = normalizeActorRecord(actor);
  const level = normalizedActor.initialLevel;
  const maxHp = parameterValueAtLevel(normalizedActor.parameterCurves.maxHp, level);
  const maxMp = parameterValueAtLevel(normalizedActor.parameterCurves.maxMp, level);
  vitals[actorId] = { hp: maxHp, mp: maxMp, maxHp, maxMp };
}

export function recoverPartyVitals(vitals: Record<ActorId, ActorVitals>, partyActorIds: readonly ActorId[]): void {
  for (const actorId of partyActorIds) {
    const actor = vitals[actorId];
    if (!actor) continue;
    actor.hp = actor.maxHp;
    actor.mp = actor.maxMp;
  }
}
