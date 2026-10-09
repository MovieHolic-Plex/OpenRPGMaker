// 편집기 안의 「이 게임 만들기」 — 메뉴 「새 프로젝트」(새 폴더)와 첫 부팅 환영 창(지금 열린 빈 프로젝트).
// 둘 다 확정 기획을 generationPending 으로 심는다. 그다음은 기존 prepareProjectInterviewStartup 이 뼈대·저장·팀 첫 생성을 넘긴다.
import { conceptBrief } from "@/concepts/brief";
import type { GameConcept } from "@/concepts/format";
import type { GameDesignBrief, GamePresetId } from "@/project/gameDesignBrief";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { conceptProjectTitle } from "@/start/conceptFeed/launcherMake";

export type EditorMakeDeps = {
  readonly ensureAiConnected: (label: string) => Promise<boolean>;
  readonly made: (slug: string) => void;
};

function choiceFor(presetId: GamePresetId) {
  const choice = newProjectChoiceById(presetId);
  if (!choice) throw new Error("이 컨셉의 장르 틀을 찾을 수 없습니다.");
  return choice;
}

/** 컨셉 카드 → (기획, 제목). 빠른 인터뷰는 기획을 바로 준다. */
function fromConcept(make: (brief: GameDesignBrief, title: string) => Promise<boolean>, made: (slug: string) => void) {
  return async (concept: GameConcept, tweak: string): Promise<boolean> => {
    if (!(await make(conceptBrief(concept, tweak), conceptProjectTitle(concept)))) return false;
    made(concept.slug);
    return true;
  };
}

/** 메뉴 「새 프로젝트」: 새 폴더에 씨앗 + 기획을 저장하고 다시 읽는다. 폴더는 묻지 않는다(데스크톱 기본 위치). */
export function menuMakeHandler(deps: EditorMakeDeps & { readonly reload: () => void }): (concept: GameConcept, tweak: string) => Promise<boolean> {
  return fromConcept(menuBriefHandler(deps), deps.made);
}

export function menuBriefHandler(deps: Omit<EditorMakeDeps, "made"> & { readonly reload: () => void }): (brief: GameDesignBrief, title: string) => Promise<boolean> {
  return async (brief, rawTitle) => {
    const choice = choiceFor(brief.presetId);
    if (!(await deps.ensureAiConnected(choice.label))) return false;
    const title = rawTitle.trim().slice(0, 80) || "새 게임";
    const { createProjectStartSeed } = await import("@/editor/projectStartSeed");
    const seed = await createProjectStartSeed(brief.presetId, title, "ai", "wide");
    seed.gameDesignBrief = { ...brief, generationPending: true };
    const { saveProjectNow } = await import("@/editor/saveActions");
    if (store.hasUnsavedChanges() && !store.isSharedDemoSession() && !(await saveProjectNow())) return false;
    const suggested = await window.oprn?.start?.suggestProjectDir?.({ title }).catch(() => null);
    const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
    const created = await createProjectFolderWithSeed(title, seed, suggested?.projectDir);
    if (!created) throw new Error("프로젝트 저장 서버에 연결하거나 데스크톱 앱에서 열어 주세요.");
    deps.reload();
    return true;
  };
}

/**
 * 첫 부팅 환영 창: 셸이 이미 연 빈 프로젝트를 메뉴·런처와 **같은 씨앗**(createProjectStartSeed — 장르 시작 맵·타일셋·메타·DB 까지)으로
 * 바꾸고 기획을 심어 저장한다(화면 크기는 보존). 시스템만 옮기면 몬스터 수집 키트 같은 장르 준비가 첫 부팅에서만 빠졌다.
 * 첫 구간 뼈대와 생성 전달은 mode.ts 가 바로 이어서 부르는 prepareProjectInterviewStartup 이 맡는다.
 */
export function welcomeMakeHandler(deps: EditorMakeDeps & { readonly adopt?: (project: Project) => Promise<void> }): (concept: GameConcept, tweak: string) => Promise<boolean> {
  return fromConcept(welcomeBriefHandler(deps), deps.made);
}

export function welcomeBriefHandler(deps: Omit<EditorMakeDeps, "made"> & { readonly adopt?: (project: Project) => Promise<void> }): (brief: GameDesignBrief, title: string) => Promise<boolean> {
  return async (brief, rawTitle) => {
    const choice = choiceFor(brief.presetId);
    if (!(await deps.ensureAiConnected(choice.label))) return false;
    const title = rawTitle.trim().slice(0, 80) || "새 게임";
    const playResolution = store.getCurrent().system.playResolution;
    const { createProjectStartSeed } = await import("@/editor/projectStartSeed");
    const seed = await createProjectStartSeed(brief.presetId, title, "ai", "wide");
    if (playResolution) seed.system.playResolution = playResolution;
    seed.gameDesignBrief = { ...brief, generationPending: true };
    const adopt = deps.adopt ?? (async (project: Project) => {
      const { adoptSeedIntoOpenProject } = await import("@/editor/welcomeGenreSystemPresetAction");
      await adoptSeedIntoOpenProject(project, "컨셉으로 새 게임 시작", { acceptUnsavedSession: true });
    });
    await adopt(seed);
    return true;
  };
}
