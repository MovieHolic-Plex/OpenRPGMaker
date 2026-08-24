import {
  adaptGenreStarterPlan,
  type GenreStarterAdapterResult,
  type GenreStarterPlan,
} from "@/editor/genrePacks";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type WelcomeGenreStarterDependencies = {
  readonly loadNewProject: (project: Project, options: { readonly title: string }) => Promise<unknown>;
  readonly focusStartMap: () => unknown;
};

const productionDependencies: WelcomeGenreStarterDependencies = {
  loadNewProject: (project, options) => store.loadNewRemoteProject(project, options),
  focusStartMap: () => focusProjectStartMap(),
};

/**
 * Production boundary for a confirmed welcome starter. The adapter creates a
 * detached Project; loadNewRemoteProject mints/switches to a new persistence target.
 */
export async function applyWelcomeGenreStarterPlan(
  plan: GenreStarterPlan,
  dependencies: WelcomeGenreStarterDependencies = productionDependencies,
): Promise<GenreStarterAdapterResult> {
  const result = adaptGenreStarterPlan(plan);
  await dependencies.loadNewProject(result.project, { title: plan.title });
  dependencies.focusStartMap();
  return result;
}
