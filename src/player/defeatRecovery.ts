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
    ?? { mapId: project.startMapId, ...project.startPos };
  const map = project.maps[destination.mapId];
  if (!map || !Number.isSafeInteger(destination.x) || !Number.isSafeInteger(destination.y)
    || !isPassableLanding(project, map, destination.x, destination.y)) return null;
  const recovered = structuredClone(session);
  recoverAll(recovered, undefined, project);
  for (const actorId of recovered.partyActorIds) {
    if (recovered.actorStateIds) recovered.actorStateIds[actorId] = [];
  }
  recovered.currentMapId = destination.mapId;
  recovered.x = destination.x;
  recovered.y = destination.y;
  // The destination starts its own map BGM, not the defeated battle/field track.
  recovered.audio = {};
  return recovered;
}
