// Executable authoring registry; editor/worker owners route through this entry point.
import type { Project } from '../../project/types';
import { supportsRomanceScene } from '../romance-scene/contract';
import { seedRomanceScene, inspectRomanceScene, romanceWritePrerequisite, ROMANCE_SCENE_TOOLS } from '../romance-scene/runtime';

export const AUTHORING_HARNESSES = [{ id: 'romance-scene', supports: supportsRomanceScene,
  seed: seedRomanceScene, inspect: inspectRomanceScene, writePrerequisite: romanceWritePrerequisite, tools: ROMANCE_SCENE_TOOLS }] as const;
export const AUTHORING_HARNESS_TOOLS = AUTHORING_HARNESSES.flatMap(h => [...h.tools]);
export function authoringHarnessFor(project: Project) {
  return AUTHORING_HARNESSES.find(h => h.id === project.gameDesignBrief?.implementation?.harnessId);
}
export function eligibleAuthoringHarnessFor(project: Project) {
  return AUTHORING_HARNESSES.find(h => h.supports(project));
}
export function inspectAuthoringHarness(project: Project, base: Project = project) {
  return authoringHarnessFor(base)?.inspect(project, base);
}
export function authoringWritePrerequisite(project: Project): string | undefined {
  return authoringHarnessFor(project)?.writePrerequisite(project);
}
