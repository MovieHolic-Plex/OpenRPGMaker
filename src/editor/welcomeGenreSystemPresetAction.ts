import {
  materializeGenreBlankProjectSystemPreset,
  type GenreBlankProjectSystemPresetPlan,
  type GenreBlankProjectSystemPresetResult,
} from "@/editor/genrePacks";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type WelcomeGenreSystemPresetDependencies = {
  /** 확정된 시드 프로젝트를 **열려 있는 폴더 프로젝트**로 채택하고 저장한다. */
  readonly adoptProject: (
    project: Project,
    options: { readonly title: string },
  ) => Promise<unknown>;
  readonly focusStartMap: () => unknown;
};

const productionDependencies: WelcomeGenreSystemPresetDependencies = {
  // P6 이후 새 프로젝트는 셸이 폴더로 만든다 — 여기서는 이미 열린 프로젝트에 시드를 채택한다.
  adoptProject: async (project) => {
    store.replaceProject(project, { label: "장르 시스템 프리셋" });
    await store.flush();
  },
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
  await dependencies.adoptProject(result.project, { title: plan.title });
  dependencies.focusStartMap();
  return result;
}
