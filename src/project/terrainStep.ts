import type { Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { syncActorVitals } from "@/project/sessionVitals";

export function scaledEncounterRate(mapRate: number, encounterRatePercent: number | undefined): number {
  const percent = encounterRatePercent === undefined ? 100 : encounterRatePercent;
  if (!Number.isFinite(mapRate) || mapRate <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return mapRate * (percent / 100);
}

export function applyTerrainWalkDamage(
  project: Project,
  session: PlaySessionLike,
  damage: number,
): { readonly applied: number; readonly defeated: boolean } {
  const amount = Math.max(0, Math.trunc(damage));
  if (amount <= 0) return { applied: 0, defeated: false };
  const party = session.partyActorIds ?? [];
  if (party.length === 0) return { applied: 0, defeated: false };
  for (const actorId of party) {
    syncActorVitals(project, session.actorVitals, actorId);
    const vitals = session.actorVitals[actorId];
    if (!vitals) continue;
    vitals.hp = Math.max(0, vitals.hp - amount);
  }
  const defeated = party.every((actorId) => (session.actorVitals[actorId]?.hp ?? 0) <= 0);
  return { applied: amount, defeated };
}
