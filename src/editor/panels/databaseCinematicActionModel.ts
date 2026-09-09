import type { CinematicScene, CinematicSequence } from "@/project/cinematicSettings";
import type { Project } from "@/project/types";

export type CinematicTarget = "opening" | "gameOver";

export function readCinematicSequence(
  project: Project,
  target: CinematicTarget,
): CinematicSequence | undefined {
  return target === "opening" ? project.system.opening : project.system.gameOver?.sequence;
}

export function emptySequence(): CinematicSequence {
  return { enabled: false, skippable: true, scenes: [] };
}

export function writeSequence(
  project: Project,
  target: CinematicTarget,
  sequence: CinematicSequence,
): void {
  if (target === "opening") project.system.opening = sequence;
  else (project.system.gameOver ??= {}).sequence = sequence;
}

/** Resolve the actual draft after synchronous history notifications, never an old snapshot. */
export function requireCinematicSequence(
  project: Project,
  target: CinematicTarget,
): CinematicSequence {
  const sequence = readCinematicSequence(project, target);
  if (!sequence) throw new TypeError("Cinematic sequence disappeared during an edit.");
  return sequence;
}

export function sceneWithKind(
  scene: CinematicScene,
  kind: CinematicScene["kind"],
  resourceId: string,
): CinematicScene {
  // Explicit common fields are essential: spreading the old union member
  // would leave image.motion on video/text, or resourceId on text.
  const common = {
    id: scene.id,
    narration: scene.narration,
    durationMs: scene.durationMs,
    ...(scene.narrationAudioResourceId
      ? { narrationAudioResourceId: scene.narrationAudioResourceId }
      : {}),
  };
  if (kind === "text") return { ...common, kind };
  if (kind === "video") return { ...common, kind, resourceId };
  return {
    ...common,
    kind,
    resourceId,
    motion: scene.kind === "image" ? scene.motion : "none",
  };
}

export function sameRecord(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
