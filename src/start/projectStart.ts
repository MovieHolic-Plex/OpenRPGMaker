import { NEW_PROJECT_CHOICES, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { PlayResolution } from "@/project/types";

/** Shared by the lightweight launcher and the editor. Missing mode preserves old AI handoffs. */
export type ProjectStartMode = "example" | "ai" | "blank";
export type ProjectStartScreenSize = "classic" | "wide";

/** 새 프로젝트가 처음 고르는 화면 크기. 옛 프로젝트(필드 없음)는 그대로 320×240 으로 읽힌다. */
export const DEFAULT_START_SCREEN_SIZE: ProjectStartScreenSize = "wide";

/**
 * 시작 화면 크기 → 저장할 논리 뷰포트. classic 은 기본값(320×240)이라 필드를 비워 둔다.
 * wide 480×270 은 1080p 에서 정확히 4배로 꽉 차(720p 2배, 4K 8배) 도트 굵기가 고르고, 가로 30칸을 보여 준다.
 */
export const START_SCREEN_RESOLUTIONS: Readonly<Record<ProjectStartScreenSize, Readonly<PlayResolution> | undefined>> = {
  classic: undefined,
  wide: { width: 480, height: 270 },
};

export const START_EXAMPLES = NEW_PROJECT_CHOICES.filter(choice => choice.featured);
export const START_EXAMPLE_DETAILS: Partial<Record<NewProjectChoiceId, { title: string; description: string; includes: readonly string[] }>> = {
  "monster-collect": { title: "풀숲의 친구들", description: "첫 파트너를 고르고 풀숲에서 몬스터를 만나요.", includes: ["작은 마을과 풀숲", "첫 파트너 선택", "조우 · 포획 · 구간 끝"] },
  "story-cutscene": { title: "다시, 그날의 기억", description: "기억의 조각을 조사하고 다음 장면으로 걸어가요.", includes: ["작은 마을과 기억의 길", "기억을 여는 대사", "조사 · 장면 이동 · 구간 끝"] },
  "adventure-jrpg": { title: "바람이 머무는 마을", description: "마을에서 의뢰를 받고 숲길의 첫 모험을 떠나요.", includes: ["작은 마을과 숲길", "촌장의 의뢰", "파티 · 전투 · 구간 끝"] },
};

export function projectStartMode(choiceId: NewProjectChoiceId | null, mode?: ProjectStartMode): ProjectStartMode {
  return choiceId === null ? "blank" : mode ?? "ai";
}
