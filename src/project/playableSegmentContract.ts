// project/playableSegmentContract.ts
// 첫 구간 뼈대의 고정 id 와 AI 에게 주는 계약 문장. 무거운 의존(편집 도구·검사기) 없이 프롬프트 모듈이 읽는다.
// 뼈대를 깔고 판정하는 코드는 playableSegment.ts.

import type { Project } from "@/project/types";

export const SEGMENT_END_ENDING_ID = "ending_first_segment";
export const SEGMENT_END_EVENT_ID = "ev_segment_end";
export const SEGMENT_ROUTE_MAP_ID = "map_segment_route";
/** 구간의 핵심 행동 이벤트(몬스터: 박사, JRPG: 촌장, 스토리: 기억의 조각). 끝나면 SEGMENT_KEY_SWITCH_ID 를 켠다. */
export const SEGMENT_STARTER_EVENT_ID = "ev_segment_starter";
export const SEGMENT_WILD_TROOP_ID = "troop_segment_wild";
/** 구간 끝을 여는 스위치. 핵심 행동을 건너뛰고 끝까지 걸어가는 것은 합격이 아니다. */
export const SEGMENT_KEY_SWITCH_ID = "sw_segment_key";
/** @deprecated 몬스터 전용 이름. SEGMENT_KEY_SWITCH_ID 와 같다. */
export const SEGMENT_PARTNER_SWITCH_ID = SEGMENT_KEY_SWITCH_ID;

/** 연애 뼈대의 자리표시 이름(길 맵 · 핵심 행동 이벤트 · 구간 끝 이벤트 · 구간 끝 엔딩). playableSegment.ts 의 ROMANCE_SKELETON 과 romance 검사가 같이 쓴다. */
export const ROMANCE_PLACEHOLDER_NAMES = ["산책로", "떨어진 수첩", "산책로 끝", "첫 만남의 끝"] as const;

/**
 * 연애 뼈대의 호감 갈림 엔딩(2026-10-16 romance-real-2 R01). 연애 뼈대는 엔딩이 1개뿐이고 호감과 무관해 3판 모두 같은 결말이었다.
 * 이제 구간 끝 이벤트는 엔딩을 이름으로 부르지 않고(endingId 없는 triggerEnding) 누적 호감으로 고른다 — 가장 높은 호감(「*」)이
 * HAPPY 이상이면 해피, NORMAL 이상이면 평범, 아니면 혼자(= 뼈대 엔딩 ending_first_segment, 조건 없는 기본 결말).
 * 인물이 정해진 뒤에는 히로인별 엔딩을 define_ending(friendshipAtLeast characterId) 로 더 높은 priority 에 얹는다.
 */
export const ROMANCE_ENDING_HAPPY_ID = "ending_romance_happy";
export const ROMANCE_ENDING_NORMAL_ID = "ending_romance_normal";
export const ROMANCE_ENDING_HAPPY_AT = 60;
export const ROMANCE_ENDING_NORMAL_AT = 25;
export const ROMANCE_ENDING_NAMES = { happy: "마음이 닿은 결말", normal: "좋은 사이로", solo: "혼자 걷는 길" } as const;
/** 연애 뼈대가 깔아 두는 엔딩 id 셋 — 첫 구간 판정은 이 중 어느 것에 닿아도 합격으로 본다. */
export const ROMANCE_SKELETON_ENDING_IDS: readonly string[] = [SEGMENT_END_ENDING_ID, ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_ID];

export type PlayableSegmentGenre = "monster-collect" | "adventure-jrpg" | "story-cutscene";

/** 이 프로젝트의 장르에 결정적 뼈대가 있으면 그 장르. 첫 화면·새 프로젝트의 세 장르다. */
export function playableSegmentGenre(project: Project): PlayableSegmentGenre | null {
  const genre = project.system.genre;
  if (genre === "monster-collect") return project.system.monsterCollection === true ? genre : null;
  if (genre === "adventure-jrpg" || genre === "story-cutscene") return genre;
  return null;
}

export function supportsPlayableSegment(project: Project): boolean {
  return playableSegmentGenre(project) !== null;
}

/** 뼈대가 이미 깔려 있는가(구간 끝 엔딩과 길 맵). 판정의 대상이 되는 프로젝트다. */
export function hasPlayableSegmentSkeleton(project: Project): boolean {
  return Boolean(project.maps[SEGMENT_ROUTE_MAP_ID]) && (project.endings ?? []).some((ending) => ending.id === SEGMENT_END_ENDING_ID);
}

const PATH: Record<PlayableSegmentGenre, string> = {
  "monster-collect": "시작 맵의 박사(" + SEGMENT_STARTER_EVENT_ID + ", 첫 몬스터 고르기) → 동쪽 문 → 1번 길(" + SEGMENT_ROUTE_MAP_ID + ", 풀숲 조우 " + SEGMENT_WILD_TROOP_ID + ", 포획 구슬 5개는 시작 소지품) → 길 끝 구간 끝(" + SEGMENT_END_EVENT_ID + ")",
  "adventure-jrpg": "시작 맵의 촌장(" + SEGMENT_STARTER_EVENT_ID + ", 의뢰 받기) → 동쪽 문 → 숲길(" + SEGMENT_ROUTE_MAP_ID + ", 무작위 전투 " + SEGMENT_WILD_TROOP_ID + ") → 길 끝 문지기(" + SEGMENT_END_EVENT_ID + ", 이길 수 있는 전투 뒤 구간 끝)",
  "story-cutscene": "시작 맵의 기억의 조각(" + SEGMENT_STARTER_EVENT_ID + ", 조사하면 기억이 떠오름) → 동쪽 문 → 기억의 길(" + SEGMENT_ROUTE_MAP_ID + ") → 길 끝 구간 끝(" + SEGMENT_END_EVENT_ID + ")",
};

/** 팀장·시공에게 주는 뼈대 계약. 뼈대를 끊지 말 것과, 끝난 뒤 코드 판정이 있다는 것. */
export function playableSegmentContract(project?: Project): string {
  const genre = (project && playableSegmentGenre(project)) ?? "monster-collect";
  return [
    "[끝낼 수 있는 첫 구간 — 코드가 판정한다]",
    "이 프로젝트에는 이미 끝까지 갈 수 있는 뼈대가 있다: " + PATH[genre] + ". 구간 끝은 스위치 " + SEGMENT_KEY_SWITCH_ID + " 가 켜져야 열리고 triggerEnding " + SEGMENT_END_ENDING_ID + " 를 부른다.",
    "- 이 뼈대가 보장하는 것은 연결(핵심 행동 → 문 → 길 → 구간 끝)뿐이다. 맵 모양(마을 배치·길 맵 크기와 줄·광장·십자 길)은 보존 대상이 아니다 — 기획에 맞게 마을을 다시 짓고, 이름·대사·주민·분위기를 바꾸고, 필요하면 구간 중간에 사건을 더한다.",
    "- 뼈대 이벤트 id·문·스위치·엔딩 id 는 지우거나 끊지 않는다. 마을이나 길을 다시 지으면 문(시작 맵 동쪽 끝)과 구간 끝이 여전히 이어지는지 확인한다. 길을 일부러 똑같이 24×12 직선으로 되돌리지 않는다.",
    "- finish 때 코드가 자동 플레이로 시작부터 구간 끝까지 걸어 본다. 닿지 못하면 finish 가 막힌 곳 목록과 함께 거절된다(최대 2번). 그래도 닿지 못한 결과는 적용되지 않는다.",
  ].join("\n");
}

