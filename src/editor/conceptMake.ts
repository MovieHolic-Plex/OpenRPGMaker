// 편집기 안의 「이 게임 만들기」 — 메뉴 「새 프로젝트」(새 폴더)와 첫 부팅 환영 창(지금 열린 빈 프로젝트).
// 둘 다 확정 기획을 generationPending 으로 심는다. 그다음은 기존 prepareProjectInterviewStartup 이 뼈대·저장·팀 첫 생성을 넘긴다.
import { conceptBrief } from "@/concepts/brief";
import type { GameConcept } from "@/concepts/format";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { store } from "@/project/store";
import { conceptProjectTitle } from "@/start/conceptFeed/launcherMake";

export type EditorMakeDeps = {
  readonly ensureAiConnected: (label: string) => Promise<boolean>;
  readonly made: (slug: string) => void;
};

function choiceFor(concept: GameConcept) {
  const choice = newProjectChoiceById(concept.presetId);
  if (!choice) throw new Error("이 컨셉의 장르 틀을 찾을 수 없습니다.");
  return choice;
}

/** 메뉴 「새 프로젝트」: 새 폴더에 씨앗 + 기획을 저장하고 다시 읽는다. 폴더는 묻지 않는다(데스크톱 기본 위치). */
export function menuMakeHandler(deps: EditorMakeDeps & { readonly reload: () => void }): (concept: GameConcept, tweak: string) => Promise<boolean> {
  return async (concept, tweak) => {
    const choice = choiceFor(concept);
    if (!(await deps.ensureAiConnected(choice.label))) return false;
    const title = conceptProjectTitle(concept);
    const { createProjectStartSeed } = await import("@/editor/projectStartSeed");
    const seed = await createProjectStartSeed(concept.presetId, title, "ai", "wide");
    seed.gameDesignBrief = { ...conceptBrief(concept, tweak), generationPending: true };
    const { saveProjectNow } = await import("@/editor/saveActions");
    if (store.hasUnsavedChanges() && !store.isSharedDemoSession() && !(await saveProjectNow())) return false;
    const suggested = await window.oprn?.start?.suggestProjectDir?.({ title }).catch(() => null);
    const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
    const created = await createProjectFolderWithSeed(title, seed, suggested?.projectDir);
    if (!created) throw new Error("프로젝트 저장 서버에 연결하거나 데스크톱 앱에서 열어 주세요.");
    deps.made(concept.slug);
    deps.reload();
    return true;
  };
}

/**
 * 첫 부팅 환영 창: 지금 열린 빈 프로젝트에 적용한다. 장르 틀의 시스템 씨앗으로 바꾸고(화면 크기는 보존) 기획을 심는다.
 * 저장과 생성 전달은 mode.ts 가 바로 이어서 부르는 prepareProjectInterviewStartup 이 맡는다.
 */
export function welcomeMakeHandler(deps: EditorMakeDeps): (concept: GameConcept, tweak: string) => Promise<boolean> {
  return async (concept, tweak) => {
    const choice = choiceFor(concept);
    if (!(await deps.ensureAiConnected(choice.label))) return false;
    const title = conceptProjectTitle(concept);
    const brief = { ...conceptBrief(concept, tweak), generationPending: true };
    const { createNewProjectSeed } = await import("@/editor/genrePacks");
    const system = createNewProjectSeed(choice.packId, title).system;
    store.update((project) => {
      const playResolution = project.system.playResolution;
      project.system = system;
      if (playResolution) project.system.playResolution = playResolution;
      project.meta.title = title;
      project.gameDesignBrief = brief;
    }, { scope: "project", label: "컨셉으로 새 게임 시작", origin: "human" });
    deps.made(concept.slug);
    return true;
  };
}
