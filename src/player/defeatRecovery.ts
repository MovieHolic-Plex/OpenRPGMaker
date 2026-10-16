import { resolveGameOverSettings, type GameOverSettings } from "@/project/cinematicSettings";
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { recoverAll } from "@/project/sessionActorCommands";
import { isPassableLanding } from "@/project/collision";
import { getSessionCheckpoint } from "@/player/checkpoints";

/** A blackout heals the current run. It must never load an older save's progress. */
export function createDefeatRecovery(project: Project, session: PlaySession, settings: GameOverSettings | undefined = resolveGameOverSettings(project.system)): PlaySession | null {
  const checkpoint = getSessionCheckpoint(session);
  const destination = settings?.recovery
    ?? (checkpoint ? { mapId: checkpoint.session.currentMapId, x: checkpoint.session.x, y: checkpoint.session.y } : undefined)
    ?? settings?.recoveryFallback
    ?? { mapId: project.startMapId, ...project.startPos };
  const map = project.maps[destination.mapId];
  if (!map || !Number.isSafeInteger(destination.x) || !Number.isSafeInteger(destination.y)
    || !isPassableLanding(project, map, destination.x, destination.y)) return null;
  const recovered = structuredClone(session);
  recoverAll(recovered, undefined, project);
  for (const actorId of recovered.partyActorIds) {
    if (recovered.actorStateIds) recovered.actorStateIds[actorId] = [];
  }
  // 블랙아웃 소지금 손실(옵트인). 정수로 내림해 잃으므로 0원은 그대로 0원이다.
  const lossPercent = settings?.goldLossPercent ?? 0;
  if (lossPercent > 0) recovered.gold = Math.max(0, recovered.gold - Math.floor(recovered.gold * Math.min(100, lossPercent) / 100));
  recovered.currentMapId = destination.mapId;
  recovered.x = destination.x;
  recovered.y = destination.y;
  // The destination starts its own map BGM, not the defeated battle/field track.
  recovered.audio = {};
  return recovered;
}
