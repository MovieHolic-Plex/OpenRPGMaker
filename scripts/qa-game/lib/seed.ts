// 브라우저 새 프로젝트 마법사 → 폴더 생성 → 다시 열기 → 기동 준비까지를 같은 함수로 재현한다(Bun 전용 모듈 없음 — vitest 에서도 쓴다).
import { deserialize, serialize } from "../../../src/project/io.ts";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { newProjectChoiceById } from "../../../src/editor/newProjectChoices.ts";
import { briefOpeningSequence, isUntouchedDefaultOpening } from "../../../src/project/defaults/defaultOpeningSequence.ts";
import { normalizeGameDesignBrief, type GameDesignBrief } from "../../../src/project/gameDesignBrief.ts";
import type { AiConfig } from "../../../src/ai/llmClient.ts";
import type { Project } from "../../../src/project/types.ts";

export interface QaBrief {
  /** 새 프로젝트 이름(마법사 1단계). */
  readonly title: string;
  /** 시작 장르(newProjectChoices id, 예: adventure-jrpg). */
  readonly presetId: string;
  readonly screenSize?: "standard" | "wide";
  /** 인터뷰 결과 — GameDesignBrief(version 1) 그대로. presetId 는 위와 같아야 한다. */
  readonly brief: Omit<GameDesignBrief, "generationPending">;
  /** 조수 설정 덮어쓰기(localStorage oprn:ai-config 와 같은 모양의 일부). */
  readonly ai?: Partial<AiConfig>;
}

/** 반환값이 조수 턴 시작 시점의 프로젝트다. */
export function buildBrowserSeed(input: QaBrief): { project: Project; brief: GameDesignBrief } {
  const choice = newProjectChoiceById(input.presetId);
  if (!choice) throw new Error(`알 수 없는 시작 장르: ${input.presetId}`);
  const brief = normalizeGameDesignBrief({ ...input.brief, version: 1, presetId: input.presetId });
  const seed = createNewProjectSeed(choice.packId, input.title.trim() || "새 프로젝트");
  if (input.screenSize === "wide") seed.system.playResolution = { width: 640, height: 360 };
  seed.gameDesignBrief = { ...brief, generationPending: true };
  // createProjectFolderWithSeed 는 serialize(seed) 를 저장하고, 다시 열면 로더가 읽는다.
  const project = deserialize(serialize(seed));
  // prepareProjectInterviewStartup 과 같은 변경.
  if (project.gameDesignBrief) delete project.gameDesignBrief.generationPending;
  const opening = project.system.opening;
  if (opening && isUntouchedDefaultOpening(opening, project.meta.title)) {
    project.system.opening = briefOpeningSequence(opening, brief.answers.experience?.text ?? "", project.meta.title);
  }
  return { project: deserialize(serialize(project)), brief };
}
