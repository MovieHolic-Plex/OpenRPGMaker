// 런처(start-screen.html)의 「이 게임 만들기」. 묻지 않는다 — 제목 = 컨셉 제목, 폴더 = 기본 위치, 화면 = 와이드.
// 폴더를 만든 뒤 확정 기획을 startIntent 로 편집기 부팅에 넘긴다(src/editor/startScreenHandoff.ts 가 검증·저장한다).
// 런처 번들에 편집기 모듈을 끌어오지 않게 가벼운 것만 정적으로 import 한다.
import { conceptBrief } from "@/concepts/brief";
import type { GameConcept } from "@/concepts/format";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import { NEW_PROJECT_CHOICES } from "@/editor/newProjectChoices";
import type { OprnBridgeStart } from "@/project/persistence/electronRepository";
import { writeStartScreenIntent } from "@/start/startIntent";

export type LauncherMakeDeps = {
  readonly ensureAiConnected: (label: string) => Promise<boolean>;
  readonly made: (slug: string) => void;
  readonly goEditor: () => void;
  readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

export function conceptProjectTitle(concept: GameConcept): string {
  return concept.title.trim().slice(0, 80) || "새 게임";
}

export function launcherMakeHandler(bridge: OprnBridgeStart, deps: LauncherMakeDeps): (concept: GameConcept, tweak: string) => Promise<boolean> {
  const make = launcherBriefHandler(bridge, deps);
  return async (concept, tweak) => {
    if (!(await make(conceptBrief(concept, tweak), conceptProjectTitle(concept)))) return false;
    deps.made(concept.slug);
    return true;
  };
}

/** 확정 기획 하나로 만들기 — 컨셉 카드와 빠른 인터뷰(src/start/quickInterview)가 같이 쓴다. */
export type LauncherBriefDeps = Omit<LauncherMakeDeps, "made"> & {
  /**
   * 첫 사용자 프롬프트 홈(src/start/firstRun) 전용: AI 연결을 거절해도 폴더·기획을 만든다.
   * 편집기는 연결을 기다렸다가 이어 짓는다(src/editor/projectInterviewStartup.ts).
   */
  readonly allowWithoutAi?: boolean;
  /** 첫 빌드 표시 — 부팅 로더가 이 문장과 「세계를 펼치는 중」을 보인다(public/boot-splash.js). */
  readonly firstBuildText?: string;
};

export function launcherBriefHandler(bridge: OprnBridgeStart, deps: LauncherBriefDeps): (brief: GameDesignBrief, title: string) => Promise<boolean> {
  return async (base, rawTitle) => {
    const label = NEW_PROJECT_CHOICES.find((choice) => choice.id === base.presetId)?.label ?? rawTitle;
    // 연결을 거절하면 폴더를 만들지 않는다 — 빈 폴더만 남기고 편집기로 가면 「아무 일도 안 일어났다」가 된다.
    // 첫 사용자 경로는 기획이 있어 연결 뒤 이어 지을 수 있으므로 막지 않는다.
    if (!(await deps.ensureAiConnected(label)) && !deps.allowWithoutAi) return false;
    const title = rawTitle.trim().slice(0, 80) || "새 게임";
    const brief = { ...base, generationPending: true };
    const suggested = await bridge.suggestProjectDir?.({ title }).catch(() => null);
    const created = await bridge.createProject({ title, ...(suggested?.projectDir ? { projectDir: suggested.projectDir } : {}) });
    if (!created) throw new Error("새 게임 폴더를 만들지 못했습니다.");
    const firstBuildText = deps.firstBuildText?.trim() ?? "";
    writeStartScreenIntent(deps.storage, {
      projectDir: created.projectDir, title, choiceId: base.presetId, intent: firstBuildText, startMode: "ai", screenSize: "wide", gameDesignBrief: brief,
      ...(firstBuildText ? { firstBuild: true } : {}),
    });
    deps.goEditor();
    return true;
  };
}
