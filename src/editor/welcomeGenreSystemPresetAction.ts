import {
  materializeGenreBlankProjectSystemPreset,
  type GenreBlankProjectSystemPresetPlan,
  type GenreBlankProjectSystemPresetResult,
} from "@/editor/genrePacks";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { normalizeGameDesignBrief, type GameDesignBrief } from "@/project/gameDesignBrief";
import { newProjectChoiceById } from "./newProjectChoices";

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
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("프로젝트 저장을 완료하지 못했습니다.");
  },
  focusStartMap: () => focusProjectStartMap(),
};

/**
 * Adopt a confirmed blank-project preset into the folder opened by the shell.
 * A failed flush keeps the candidate in memory but must not release an AI intent.
 */
export async function applyWelcomeGenreSystemPresetPlan(
  plan: GenreBlankProjectSystemPresetPlan,
  dependencies: WelcomeGenreSystemPresetDependencies = productionDependencies,
  brief?: GameDesignBrief,
): Promise<GenreBlankProjectSystemPresetResult> {
  const result = materializeGenreBlankProjectSystemPreset(plan);
  if (brief) {
    if (newProjectChoiceById(brief.presetId)?.packId !== plan.packId) throw new Error("게임 기획과 시스템 프리셋이 다릅니다.");
    result.project.gameDesignBrief = normalizeGameDesignBrief(brief);
  }
  await dependencies.adoptProject(result.project, { title: plan.title });
  dependencies.focusStartMap();
  return result;
}
