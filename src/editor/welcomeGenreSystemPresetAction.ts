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
import { withVerifiedPlayableSegment } from "@/project/playableSegment";
import { projectRepository } from "@/project/persistence/repository";
import { prepareProjectMedia } from "@/project/persistence/prepareProjectMedia";
import { sameProjectTarget } from "@/project/persistence/target";

export type WelcomeGenreSystemPresetDependencies = {
  /** 확정된 시드 프로젝트를 **열려 있는 폴더 프로젝트**로 채택하고 저장한다. */
  readonly adoptProject: (
    project: Project,
    options: { readonly title: string },
  ) => Promise<unknown>;
  readonly focusStartMap: () => unknown;
};

/**
 * 셸이 이미 연 폴더 프로젝트에 새 시드를 통째로 채택하고 저장한다. 첫 부팅 컨셉 피드(`conceptMake.ts`)도 이 길을 쓴다.
 * 소재를 준비하는 동안 폴더나 내용이 바뀌었으면 채택하지 않고 던진다(열린 문서는 그대로).
 */
export async function adoptSeedIntoOpenProject(
  project: Project,
  label = "장르 시스템 프리셋",
  /** 저장 대상이 없는 세션(임시·데모)이면 채택만 하고 넘어간다. 저장을 시도했다가 실패한 것은 여전히 던진다. */
  options: { readonly acceptUnsavedSession?: boolean } = {},
): Promise<void> {
  const repository = projectRepository();
  const target = repository.currentTarget();
  const openProject = store.getCurrent();
  const version = store.getVersionToken();
  // New hosted libraries may contain many MB of inline pixels. Write individual files before
  // the renderer clones/stringifies the game; the open project remains intact if this fails.
  await prepareProjectMedia(project, repository);
  const active = repository.currentTarget();
  const currentVersion = store.getVersionToken();
  if (target ? (!sameProjectTarget(target, active) || active?.projectId !== target.projectId) : active !== null) {
    throw new Error("소재를 준비하는 동안 프로젝트 폴더가 바뀌었습니다. 다시 시작하세요.");
  }
  if (store.getCurrent() !== openProject || currentVersion.lineage !== version.lineage || currentVersion.generation !== version.generation) {
    throw new Error("소재를 준비하는 동안 프로젝트 내용이 바뀌었습니다. 변경 내용을 확인하고 다시 시작하세요.");
  }
  store.replaceProject(project, { label });
  const saved = await store.flush();
  if (saved.kind === "saved") return;
  if (options.acceptUnsavedSession && (saved.kind === "not-configured" || saved.kind === "disabled" || saved.kind === "saved-local")) return;
  throw new Error("프로젝트 저장을 완료하지 못했습니다.");
}

const productionDependencies: WelcomeGenreSystemPresetDependencies = {
  // P6 이후 새 프로젝트는 셸이 폴더로 만든다 — 여기서는 이미 열린 프로젝트에 시드를 채택한다.
  adoptProject: (project) => adoptSeedIntoOpenProject(project),
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
  let result = materializeGenreBlankProjectSystemPreset(plan);
  if (brief) {
    if (newProjectChoiceById(brief.presetId)?.packId !== plan.packId) throw new Error("게임 기획과 시스템 프리셋이 다릅니다.");
    result.project.gameDesignBrief = normalizeGameDesignBrief(brief);
    // 레시피 이름(「기본 JRPG 시스템 프리셋」)이 게임 제목·타이틀 화면·오프닝에 그대로 남던 결함(2026-09-24 JRPG 도그푸딩).
    // 인터뷰는 제목을 묻지 않는다 — 임시 제목을 두고 조수 지시문이 기획에 맞는 제목으로 바꾸게 한다.
    retitleProject(result.project, UNNAMED_GAME_TITLE);
    // 인터뷰를 거친 AI 첫 생성이면 끝낼 수 있는 첫 구간 뼈대를 먼저 깐다(메뉴 경로는 prepareProjectInterviewStartup 이 같은 일을 한다).
    // ⚙ 시스템 프리셋(brief 없음)은 설정만 바꾸는 길이라 뼈대를 깔지 않는다.
    const skeleton = withVerifiedPlayableSegment(result.project);
    if (skeleton) result = { ...result, project: skeleton };
  }
  await dependencies.adoptProject(result.project, { title: plan.title });
  dependencies.focusStartMap();
  return result;
}
