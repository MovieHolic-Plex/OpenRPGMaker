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
import { UNNAMED_GAME_TITLE } from "./welcomeGenrePresets";
import { defaultOpeningSequence } from "@/project/defaults/defaultOpeningSequence";

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
function retitleProject(project: Project, title: string): void {
  project.meta = { ...project.meta, title };
  project.system.opening = defaultOpeningSequence(title);
  if (project.system.titleScreen) project.system.titleScreen.title = title;
}

export async function applyWelcomeGenreSystemPresetPlan(
  plan: GenreBlankProjectSystemPresetPlan,
  dependencies: WelcomeGenreSystemPresetDependencies = productionDependencies,
  brief?: GameDesignBrief,
): Promise<GenreBlankProjectSystemPresetResult> {
  const result = materializeGenreBlankProjectSystemPreset(plan);
  if (brief) {
    if (newProjectChoiceById(brief.presetId)?.packId !== plan.packId) throw new Error("게임 기획과 시스템 프리셋이 다릅니다.");
    result.project.gameDesignBrief = normalizeGameDesignBrief(brief);
    // 레시피 이름(「기본 JRPG 시스템 프리셋」)이 게임 제목·타이틀 화면·오프닝에 그대로 남던 결함(2026-09-24 JRPG 도그푸딩).
    // 인터뷰는 제목을 묻지 않는다 — 임시 제목을 두고 조수 지시문이 기획에 맞는 제목으로 바꾸게 한다.
    retitleProject(result.project, UNNAMED_GAME_TITLE);
  }
  await dependencies.adoptProject(result.project, { title: plan.title });
  dependencies.focusStartMap();
  return result;
}
