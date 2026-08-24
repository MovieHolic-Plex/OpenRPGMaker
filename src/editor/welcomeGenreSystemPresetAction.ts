import {
  materializeGenreBlankProjectSystemPreset,
  type GenreBlankProjectSystemPresetPlan,
  type GenreBlankProjectSystemPresetResult,
} from "@/editor/genrePacks";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type WelcomeGenreSystemPresetDependencies = {
  readonly switchToVerifiedRemoteProject: (
    project: Project,
    options: { readonly title: string },
  ) => Promise<unknown>;
  readonly focusStartMap: () => unknown;
};

const productionDependencies: WelcomeGenreSystemPresetDependencies = {
  switchToVerifiedRemoteProject: (project, options) =>
    store.loadNewRemoteProjectTransactionally(project, options),
  focusStartMap: () => focusProjectStartMap(),
};

/**
 * Production boundary for a confirmed blank-project system preset. The store
 * keeps the open project intact until the detached target is saved and reloaded.
 */
export async function applyWelcomeGenreSystemPresetPlan(
  plan: GenreBlankProjectSystemPresetPlan,
  dependencies: WelcomeGenreSystemPresetDependencies = productionDependencies,
): Promise<GenreBlankProjectSystemPresetResult> {
  const result = materializeGenreBlankProjectSystemPreset(plan);
  await dependencies.switchToVerifiedRemoteProject(result.project, { title: plan.title });
  dependencies.focusStartMap();
  return result;
}
