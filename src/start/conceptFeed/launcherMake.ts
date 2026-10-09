// 런처(start-screen.html)의 「이 게임 만들기」. 묻지 않는다 — 제목 = 컨셉 제목, 폴더 = 기본 위치, 화면 = 와이드.
// 폴더를 만든 뒤 확정 기획을 startIntent 로 편집기 부팅에 넘긴다(src/editor/startScreenHandoff.ts 가 검증·저장한다).
// 런처 번들에 편집기 모듈을 끌어오지 않게 가벼운 것만 정적으로 import 한다.
import { conceptBrief } from "@/concepts/brief";
import type { GameConcept } from "@/concepts/format";
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
  return async (concept, tweak) => {
    const label = NEW_PROJECT_CHOICES.find((choice) => choice.id === concept.presetId)?.label ?? concept.title;
    // 연결을 거절하면 폴더를 만들지 않는다 — 빈 폴더만 남기고 편집기로 가면 「아무 일도 안 일어났다」가 된다.
    if (!(await deps.ensureAiConnected(label))) return false;
    const title = conceptProjectTitle(concept);
    const brief = { ...conceptBrief(concept, tweak), generationPending: true };
    const suggested = await bridge.suggestProjectDir?.({ title }).catch(() => null);
    const created = await bridge.createProject({ title, ...(suggested?.projectDir ? { projectDir: suggested.projectDir } : {}) });
    if (!created) throw new Error("새 게임 폴더를 만들지 못했습니다.");
    writeStartScreenIntent(deps.storage, {
      projectDir: created.projectDir, title, choiceId: concept.presetId, intent: "", startMode: "ai", screenSize: "wide", gameDesignBrief: brief,
    });
    deps.made(concept.slug);
    deps.goEditor();
    return true;
  };
}
