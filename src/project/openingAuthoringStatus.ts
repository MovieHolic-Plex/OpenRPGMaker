import type { Project } from "./types";
import { isUntouchedDefaultOpening } from "./defaults/defaultOpeningSequence";

/** Configuration evidence only: actual playback must be checked in New Game. */
export function openingAuthoringStatus(project: Project) {
  const opening = project.system.opening;
  return {
    entryMode: opening?.entry?.mode ?? "new-game",
    exists: opening !== undefined,
    enabled: opening?.enabled === true,
    sceneCount: opening?.scenes.length ?? 0,
    defaultPlaceholder: isUntouchedDefaultOpening(opening, project.meta.title)
      || isUntouchedDefaultOpening(opening, "새 프로젝트"),
    configuredToPlay: opening?.enabled === true && opening.scenes.length > 0,
    musicResourceId: opening?.musicResourceId ?? null,
    verificationScope: "configuration-only" as const,
  };
}
