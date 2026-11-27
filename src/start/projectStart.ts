import { NEW_PROJECT_CHOICES, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { GenrePackId } from "@/project/genrePackId";
import type { PlayResolution } from "@/project/types";

/** Shared by the lightweight launcher and the editor. Missing mode preserves old AI handoffs. */
export type ProjectStartMode = "example" | "ai" | "blank";
export type ProjectStartScreenSize = "classic" | "wide";

/** 새 프로젝트가 처음 고르는 화면 크기. 옛 프로젝트(필드 없음)는 그대로 320×240 으로 읽힌다. */
export const DEFAULT_START_SCREEN_SIZE: ProjectStartScreenSize = "wide";

/**
 * 시작 화면 크기 → 저장할 논리 뷰포트. classic 은 기본값(320×240)이라 필드를 비워 둔다.
 * wide 기본은 480×270(30×17칸, FHD 4배·4K 8배)이며, 장르별 차등은 GENRE_START_VIEW_PROFILES 가 정한다.
 */
export const START_SCREEN_RESOLUTIONS: Readonly<Record<ProjectStartScreenSize, Readonly<PlayResolution> | undefined>> = {
  classic: undefined,
  wide: { width: 480, height: 270 },
};

export type GenreStartViewProfile = {
  readonly resolution: Readonly<PlayResolution>;
  /** 640×360 처럼 넓은 야외 시야를 쓰는 장르는 작은 실내 방을 자동 확대(smallMapFill)해 휑함을 막는다. */
  readonly smallMapFill?: boolean;
};

/**
 * 장르별 와이드(wide) 데스크톱 기본 시야(2026-11-27).
 * 16px 타일 기준 FHD·4K 정수 배율이 딱 떨어지는 3단계(384×216·5x / 480×270·4x / 640×360·3x)로 나눈다:
 * - farm-life · action-rpg: 넓은 640×360(40×22.5칸) + 작은 방 자동 채움(smallMapFill: true)
 * - adventure-jrpg · story-cutscene: 균형 480×270(30×17칸)
 * - horror-chase: 밀착 384×216(24×13.5칸)
 * - monster-collect: 에메랄드 전용 규격(480×320, configureEmeraldMonsterStyle)을 보존해 덮어쓰지 않는다.
 */
export const GENRE_START_VIEW_PROFILES: Readonly<Partial<Record<GenrePackId, GenreStartViewProfile>>> = {
  "farm-life": { resolution: { width: 640, height: 360 }, smallMapFill: true },
  "action-rpg": { resolution: { width: 640, height: 360 }, smallMapFill: true },
  "adventure-jrpg": { resolution: { width: 480, height: 270 } },
  "story-cutscene": { resolution: { width: 480, height: 270 } },
  "horror-chase": { resolution: { width: 384, height: 216 } },
};

/** 새 프로젝트 시작 시 적용할 화면 프로필. classic 이거나 몬스터 수집(전용 480×320 보존)이면 undefined. */
export function resolveStartViewProfile(
  packId: GenrePackId | null | undefined,
  size: ProjectStartScreenSize = DEFAULT_START_SCREEN_SIZE,
): GenreStartViewProfile | undefined {
  if (size !== "wide") return undefined;
  if (packId === "monster-collect") return undefined;
  if (packId && GENRE_START_VIEW_PROFILES[packId]) return GENRE_START_VIEW_PROFILES[packId];
  const fallback = START_SCREEN_RESOLUTIONS[size];
  return fallback ? { resolution: fallback } : undefined;
}

export const START_EXAMPLES = NEW_PROJECT_CHOICES.filter(choice => choice.featured);
export const START_EXAMPLE_DETAILS: Partial<Record<NewProjectChoiceId, { title: string; description: string; includes: readonly string[] }>> = {
  "monster-collect": { title: "풀숲의 친구들", description: "첫 파트너를 고르고 풀숲에서 몬스터를 만나요.", includes: ["작은 마을과 풀숲", "첫 파트너 선택", "조우 · 포획 · 구간 끝"] },
  "story-cutscene": { title: "다시, 그날의 기억", description: "기억의 조각을 조사하고 다음 장면으로 걸어가요.", includes: ["작은 마을과 기억의 길", "기억을 여는 대사", "조사 · 장면 이동 · 구간 끝"] },
  "adventure-jrpg": { title: "바람이 머무는 마을", description: "마을에서 의뢰를 받고 숲길의 첫 모험을 떠나요.", includes: ["작은 마을과 숲길", "촌장의 의뢰", "파티 · 전투 · 구간 끝"] },
};

export function projectStartMode(choiceId: NewProjectChoiceId | null, mode?: ProjectStartMode): ProjectStartMode {
  return choiceId === null ? "blank" : mode ?? "ai";
}
