import type { CinematicScene, CinematicSequence, GameOverSettings } from "@/project/cinematicSettings";
import type { Project } from "@/project/types";

export type CinematicTarget = "opening" | "gameOver" | { readonly gameOverId: string };

export function readGameOverSettings(project: Project, target: CinematicTarget): GameOverSettings | undefined {
  return typeof target === "object" ? project.system.gameOvers?.find(row => row.id === target.gameOverId)?.settings : project.system.gameOver;
}
export function requireGameOverSettings(project: Project, target: CinematicTarget): GameOverSettings {
  if (typeof target !== "object") return project.system.gameOver ??= {};
  const settings = readGameOverSettings(project, target);
  if (!settings) throw new TypeError("Game-over definition disappeared during an edit.");
  return settings;
}

export function readCinematicSequence(
  project: Project,
  target: CinematicTarget,
): CinematicSequence | undefined {
  return target === "opening" ? project.system.opening : readGameOverSettings(project, target)?.sequence;
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
  else requireGameOverSettings(project, target).sequence = sequence;
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
    ...(scene.presentation ? { presentation: structuredClone(scene.presentation) } : {}),
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
    ...(scene.kind === 'image' && scene.direction ? { direction: structuredClone(scene.direction) } : {}),
  };
}

export function sameRecord(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
